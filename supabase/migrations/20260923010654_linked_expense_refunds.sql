-- Refund links preserve the original ledger amounts and only adjust spending.
alter table public.money_transactions
  add column refund_of_transaction_id uuid references public.money_transactions(id) on delete restrict,
  add column refunded_amount numeric not null default 0;
alter table public.money_credit_card_payments
  add column refund_of_transaction_id uuid references public.money_transactions(id) on delete restrict;
create index money_transaction_refunds_idx on public.money_transactions(refund_of_transaction_id) where refund_of_transaction_id is not null;
create index money_card_refunds_idx on public.money_credit_card_payments(refund_of_transaction_id) where refund_of_transaction_id is not null;

create function public.money_validate_refund() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  original public.money_transactions;
  refunded numeric;
  refund_currency text;
begin
  if new.refund_of_transaction_id is not null then
    select * into original from public.money_transactions where id = new.refund_of_transaction_id for update;
    if not found or original.user_id <> new.user_id or original.type <> 'expense' or original.refund_of_transaction_id is not null then
      raise exception 'Select an original expense belonging to this workspace';
    end if;
    if new.amount <= 0 or new.date < original.date then
      raise exception 'Refund must be positive and dated on or after the purchase';
    end if;
    if tg_table_name = 'money_transactions' then
      if new.type <> 'income' or new.account_id is null then raise exception 'Bank refunds require an income deposit account'; end if;
      refund_currency := new.currency;
      new.category := 'Refund';
      new.exclude_from_monthly := true;
      new.is_recurring := false;
      new.recurrence := null;
    else
      if new.account_id is not null then raise exception 'Card refunds cannot withdraw from a bank account'; end if;
      select currency into refund_currency from public.money_credit_cards where id = new.card_id and user_id = new.user_id;
      if not exists (select 1 from public.money_credit_card_charges c where c.card_id = new.card_id and (c.id = original.linked_charge_id or c.linked_transaction_id = original.id)) then
        raise exception 'Choose a purchase on this card';
      end if;
    end if;
    if refund_currency is distinct from original.currency then raise exception 'Refund and purchase must use the same currency'; end if;
    select coalesce(sum(amount),0) into refunded from (
      select amount from public.money_transactions where refund_of_transaction_id = original.id and not (tg_table_name = 'money_transactions' and id = new.id)
      union all
      select amount from public.money_credit_card_payments where refund_of_transaction_id = original.id and not (tg_table_name = 'money_credit_card_payments' and id = new.id)
    ) r;
    if round(refunded + new.amount,2) > original.amount then raise exception 'Refund exceeds the remaining purchase amount'; end if;
  end if;
  if tg_table_name = 'money_transactions' then
    select coalesce(sum(amount),0) into refunded from (
      select amount from public.money_transactions where refund_of_transaction_id = new.id
      union all select amount from public.money_credit_card_payments where refund_of_transaction_id = new.id
    ) r;
    new.refunded_amount := refunded;
    if refunded > 0 then
      if new.type <> 'expense' or new.amount < refunded then raise exception 'Purchase amount cannot be less than its linked refunds'; end if;
      if tg_op = 'UPDATE' and (new.currency <> old.currency or new.date > old.date or new.linked_charge_id is distinct from old.linked_charge_id) then
        raise exception 'Remove refund links before changing purchase currency, date or payment source';
      end if;
    end if;
  end if;
  return new;
end $$;

create function public.money_refresh_refunded_amount() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare old_target uuid; new_target uuid;
begin
  if tg_op <> 'INSERT' then old_target := old.refund_of_transaction_id; end if;
  if tg_op <> 'DELETE' then new_target := new.refund_of_transaction_id; end if;
  -- The before trigger recomputes this derived column, including deletes/edits.
  update public.money_transactions set refunded_amount = 0
    where id in (old_target, new_target);
  return null;
end $$;

create trigger money_validate_transaction_refund before insert or update on public.money_transactions
for each row execute function public.money_validate_refund();
create trigger money_validate_card_refund before insert or update on public.money_credit_card_payments
for each row execute function public.money_validate_refund();
create trigger money_refresh_transaction_refund after insert or update or delete on public.money_transactions
for each row execute function public.money_refresh_refunded_amount();
create trigger money_refresh_card_refund after insert or update or delete on public.money_credit_card_payments
for each row execute function public.money_refresh_refunded_amount();

-- Do not partially delete or move a linked card purchase while refunds exist.
create function public.money_protect_refunded_charge() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare refunded numeric;
begin
  select coalesce(sum(refunded_amount),0) into refunded from public.money_transactions
    where id = old.linked_transaction_id or linked_charge_id = old.id;
  if refunded > 0 then
    if tg_op = 'DELETE' then raise exception 'Remove linked refunds before deleting this purchase'; end if;
    if new.amount < refunded or new.date > old.date or new.card_id <> old.card_id or new.linked_transaction_id is distinct from old.linked_transaction_id then
      raise exception 'Remove refund links before changing this purchase';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger money_protect_refunded_charge before update or delete on public.money_credit_card_charges
for each row execute function public.money_protect_refunded_charge();
