import { supabase } from "@/lib/supabase";
import type {
  Account,
  Transaction,
  Goal,
  GoalAccount,
  AllocationPlan,
  Settings,
  Holding,
  Subscription,
  Dividend,
  CreditCard,
  CreditCardCharge,
  CreditCardPayment,
  CurrencyCode,
} from "./database.types";
import { OWNER_ID } from "./constants";

export interface GoalAccountLinkInput {
  account_id: string;
  allocated_amount?: number | null;
}

import {
  demoCreateAccount, demoUpdateAccount, demoDeleteAccount,
  demoCreateTransaction, demoUpdateTransaction, demoDeleteTransaction,
  demoCreateGoal, demoUpdateGoal, demoDeleteGoal,
  demoAddGoalAccountAllocation, demoSetGoalAccounts,
  demoCreateAllocationPlan, demoUpdateAllocationPlan, demoDeleteAllocationPlan, demoSetActivePlan,
  demoUpsertSettings,
  demoCreateHolding, demoUpdateHolding, demoDeleteHolding,
  demoCreateSubscription, demoUpdateSubscription, demoDeleteSubscription,
  demoCreateDividend, demoUpdateDividend, demoDeleteDividend,
  demoCreateCreditCard, demoUpdateCreditCard, demoDeleteCreditCard,
  demoCreateCreditCardCharge, demoUpdateCreditCardCharge, demoDeleteCreditCardCharge,
  demoCreateCreditCardPayment, demoDeleteCreditCardPayment,
} from "./demo-store";

export function isDemoModeRoute(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/demo");
}


/* ================================================================== */
/*  Accounts                                                          */
/* ================================================================== */

export async function getAccounts() {
  const { data, error } = await supabase
    .from("money_accounts")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data as Account[];
}

export async function createAccount(account: {
  name: string;
  type: Account["type"];
  currency?: Account["currency"];
  starting_balance?: number;
}) {
  if (isDemoModeRoute()) return demoCreateAccount({ ...account, currency: account.currency ?? "CAD", starting_balance: account.starting_balance ?? 0 });
  const { data, error } = await supabase
    .from("money_accounts")
    .insert({
      name: account.name,
      type: account.type,
      currency: account.currency ?? "CAD",
      starting_balance: account.starting_balance ?? 0,
      user_id: OWNER_ID,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function updateAccount(
  id: string,
  updates: {
    name?: string;
    type?: Account["type"];
    currency?: Account["currency"];
    starting_balance?: number;
  }
) {
  if (isDemoModeRoute()) return demoUpdateAccount(id, updates);
  const { data, error } = await supabase
    .from("money_accounts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  if (isDemoModeRoute()) { demoDeleteAccount(id); return; }
  await supabase.from("money_transactions").update({ account_id: null }).eq("account_id", id);
  await supabase.from("money_transactions").update({ from_account_id: null }).eq("from_account_id", id);
  await supabase.from("money_transactions").update({ to_account_id: null }).eq("to_account_id", id);
  await supabase.from("money_holdings").delete().eq("account_id", id);
  await supabase.from("money_goal_accounts").delete().eq("account_id", id);
  await supabase.from("money_credit_card_payments").update({ account_id: null }).eq("account_id", id);
  const { error } = await supabase.from("money_accounts").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Transactions                                                      */
/* ================================================================== */

export async function getTransactions(filters?: {
  type?: Transaction["type"];
  accountId?: string;
  from?: string;
  to?: string;
  category?: string;
}) {
  let q = supabase
    .from("money_transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.accountId) q = q.eq("account_id", filters.accountId);
  if (filters?.from) q = q.gte("date", filters.from);
  if (filters?.to) q = q.lte("date", filters.to);
  if (filters?.category) q = q.eq("category", filters.category);

  const { data, error } = await q;
  if (error) throw error;
  return data as Transaction[];
}

export async function createTransaction(
  tx: Omit<Transaction, "id" | "created_at" | "user_id" | "linked_charge_id" | "idempotency_key" | "received_amount"> & {
    linked_charge_id?: string | null;
    idempotency_key?: string | null;
    received_amount?: number | null;
  }
) {
  if (isDemoModeRoute()) return demoCreateTransaction({ ...tx, linked_charge_id: tx.linked_charge_id ?? null, idempotency_key: tx.idempotency_key ?? null, received_amount: tx.received_amount ?? null });
  const { data, error } = await supabase
    .from("money_transactions")
    .insert({
      ...tx,
      linked_charge_id: tx.linked_charge_id ?? null,
      idempotency_key: tx.idempotency_key ?? null,
      received_amount: tx.received_amount ?? null,
      user_id: OWNER_ID,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  if (isDemoModeRoute()) { demoDeleteTransaction(id); return; }
  // Also delete linked credit-card charge if one exists
  const { data: tx } = await supabase
    .from("money_transactions")
    .select("linked_charge_id")
    .eq("id", id)
    .single();
  if (tx?.linked_charge_id) {
    // Clear the back-link first so the cascade doesn't loop
    await supabase
      .from("money_credit_card_charges")
      .update({ linked_transaction_id: null })
      .eq("id", tx.linked_charge_id);
    await supabase
      .from("money_credit_card_charges")
      .delete()
      .eq("id", tx.linked_charge_id);
  }
  const { error } = await supabase.from("money_transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, "id" | "created_at" | "user_id">>
) {
  if (isDemoModeRoute()) return demoUpdateTransaction(id, updates);
  const { data, error } = await supabase
    .from("money_transactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const tx = data as Transaction;
  // Sync changes to linked CC charge if one exists
  if (tx.linked_charge_id) {
    const chargeUpdates: Record<string, unknown> = {};
    if (updates.date !== undefined) chargeUpdates.date = updates.date;
    if (updates.amount !== undefined) chargeUpdates.amount = updates.amount;
    if (updates.merchant !== undefined) chargeUpdates.merchant = updates.merchant;
    if (updates.category !== undefined) chargeUpdates.category = updates.category;
    if (Object.keys(chargeUpdates).length > 0) {
      await supabase
        .from("money_credit_card_charges")
        .update(chargeUpdates)
        .eq("id", tx.linked_charge_id);
    }
  }
  return tx;
}

/* ================================================================== */
/*  Goals                                                             */
/* ================================================================== */

export async function getGoals() {
  const { data, error } = await supabase
    .from("money_goals")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data as Goal[];
}

export async function getGoalAccounts() {
  const { data, error } = await supabase
    .from("money_goal_accounts")
    .select("*")
    .order("created_at");
  if (error) {
    // Backward-compatible fallback when the migration has not run yet.
    
    return [] as GoalAccount[];
  }
  return data as GoalAccount[];
}

function normalizeGoalAccountLinks(
  linksOrIds: Array<string | GoalAccountLinkInput> | undefined
): GoalAccountLinkInput[] {
  if (!linksOrIds || linksOrIds.length === 0) return [];
  const byAccountId = new Map<string, GoalAccountLinkInput>();
  for (const linkOrId of linksOrIds) {
    const accountId = typeof linkOrId === "string" ? linkOrId : linkOrId.account_id;
    if (!accountId) continue;
    const rawAmount = typeof linkOrId === "string" ? null : linkOrId.allocated_amount ?? null;
    const amount =
      rawAmount === null || rawAmount === undefined || !Number.isFinite(rawAmount)
        ? null
        : Math.max(0, rawAmount);
    byAccountId.set(accountId, {
      account_id: accountId,
      allocated_amount: amount,
    });
  }
  return Array.from(byAccountId.values());
}

async function setGoalAccounts(goalId: string, linksOrIds: Array<string | GoalAccountLinkInput>) {
  // Replace links in one shot to keep writes simple.
  const { error: deleteError } = await supabase
    .from("money_goal_accounts")
    .delete()
    .eq("goal_id", goalId);
  if (deleteError) {
    // Fallback when table does not exist yet.
    
    return;
  }
  const uniqueLinks = normalizeGoalAccountLinks(linksOrIds);
  if (uniqueLinks.length === 0) return;
  const { error: insertError } = await supabase.from("money_goal_accounts").insert(
    uniqueLinks.map((link) => ({
      user_id: OWNER_ID,
      goal_id: goalId,
      account_id: link.account_id,
      allocated_amount: link.allocated_amount ?? null,
    }))
  );
  if (insertError) {
    
  }
}

export async function createGoal(
  goal: Omit<Goal, "id" | "created_at" | "user_id">,
  linkedAccounts?: Array<string | GoalAccountLinkInput>
) {
  if (isDemoModeRoute()) {
    const ids = linkedAccounts?.map((l) => (typeof l === "string" ? l : l.account_id));
    return demoCreateGoal(goal, ids);
  }
  const normalizedLinks = normalizeGoalAccountLinks(linkedAccounts);
  const normalizedLinkedId =
    normalizedLinks.length > 0
      ? normalizedLinks[0].account_id
      : goal.linked_account_id;
  const { data, error } = await supabase
    .from("money_goals")
    .insert({ ...goal, linked_account_id: normalizedLinkedId ?? null, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  if (linkedAccounts) {
    await setGoalAccounts(data.id, normalizedLinks);
  }
  return data as Goal;
}

export async function updateGoal(
  id: string,
  updates: Partial<Goal>,
  linkedAccounts?: Array<string | GoalAccountLinkInput>
) {
  if (isDemoModeRoute()) {
    const ids = linkedAccounts?.map((l) => (typeof l === "string" ? l : l.account_id));
    return demoUpdateGoal(id, updates, ids);
  }
  const normalizedLinks = normalizeGoalAccountLinks(linkedAccounts);
  const normalizedLinkedId =
    linkedAccounts !== undefined
      ? normalizedLinks[0]?.account_id ?? null
      : updates.linked_account_id;
  const { data, error } = await supabase
    .from("money_goals")
    .update(
      linkedAccounts !== undefined
        ? { ...updates, linked_account_id: normalizedLinkedId }
        : updates
    )
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (linkedAccounts !== undefined) {
    await setGoalAccounts(id, normalizedLinks);
  }
  return data as Goal;
}

export async function deleteGoal(id: string) {
  if (isDemoModeRoute()) { demoDeleteGoal(id); return; }
  const { error } = await supabase.from("money_goals").delete().eq("id", id);
  if (error) throw error;
}

export async function addGoalAccountAllocation(
  goalId: string,
  accountId: string,
  amountToAdd: number
) {
  if (isDemoModeRoute()) { demoAddGoalAccountAllocation(goalId, accountId, amountToAdd); return; }
  const delta = Number.isFinite(amountToAdd) ? Math.max(0, amountToAdd) : 0;
  if (delta <= 0) return;

  const { data: existing, error: selectError } = await supabase
    .from("money_goal_accounts")
    .select("id, allocated_amount")
    .eq("goal_id", goalId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const current = existing.allocated_amount ?? 0;
    const { error: updateError } = await supabase
      .from("money_goal_accounts")
      .update({ allocated_amount: current + delta })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("money_goal_accounts").insert({
    user_id: OWNER_ID,
    goal_id: goalId,
    account_id: accountId,
    allocated_amount: delta,
  });
  if (insertError) throw insertError;
}

/* ================================================================== */
/*  Allocation Plans                                                  */
/* ================================================================== */

export async function getAllocationPlans() {
  const { data, error } = await supabase
    .from("money_allocation_plans")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data as AllocationPlan[];
}

export async function setActivePlan(id: string) {
  if (isDemoModeRoute()) return demoSetActivePlan(id);
  // Deactivate all, then activate the chosen one
  await supabase
    .from("money_allocation_plans")
    .update({ is_active: false })
    .eq("user_id", OWNER_ID);
  const { data, error } = await supabase
    .from("money_allocation_plans")
    .update({ is_active: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AllocationPlan;
}

export async function createAllocationPlan(
  plan: Omit<AllocationPlan, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateAllocationPlan(plan);
  const { data, error } = await supabase
    .from("money_allocation_plans")
    .insert({ ...plan, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as AllocationPlan;
}

export async function updateAllocationPlan(id: string, updates: Partial<AllocationPlan>) {
  if (isDemoModeRoute()) return demoUpdateAllocationPlan(id, updates);
  const { data, error } = await supabase
    .from("money_allocation_plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AllocationPlan;
}

export async function deleteAllocationPlan(id: string) {
  if (isDemoModeRoute()) { demoDeleteAllocationPlan(id); return; }
  const { error } = await supabase
    .from("money_allocation_plans")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Settings                                                          */
/* ================================================================== */

export const SETTINGS_SAFE_COLUMNS = "id, user_id, base_currency, display_name, greeting_tone, expense_categories, subscription_categories, rent_amount, rent_day, rent_reminder_days, bill_reminder_days, monthly_essentials_budget, paycheck_amount, paycheck_frequency, auto_apply_allocation, dismissed_merchants, created_at";

export async function getSettings() {
  const { data, error } = await supabase
    .from("money_settings")
    .select(SETTINGS_SAFE_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data as Settings | null;
}

export async function upsertSettings(settings: Partial<Settings>) {
  if (isDemoModeRoute()) return demoUpsertSettings(settings);
  const existing = await getSettings();
  if (existing) {
    const { data, error } = await supabase
      .from("money_settings")
      .update(settings)
      .eq("id", existing.id)
      .select(SETTINGS_SAFE_COLUMNS)
      .single();
    if (error) throw error;
    return data as Settings;
  } else {
    const { data, error } = await supabase
      .from("money_settings")
      .insert({
        user_id: OWNER_ID,
        base_currency: "CAD",
        display_name: "Amir",
        greeting_tone: "coach",
        expense_categories: [
          "Food",
          "Transport",
          "Bills",
          "Rent",
          "Fun",
          "Health",
          "Personal Care",
          "Other",
        ],
        subscription_categories: [
          "Streaming",
          "Music",
          "Software",
          "Cloud",
          "Gaming",
          "News",
          "Fitness",
          "Food",
          "Finance",
          "Other",
        ],
        rent_amount: 2100,
        rent_day: 28,
        rent_reminder_days: 7,
        bill_reminder_days: 3,
        monthly_essentials_budget: 3000,
        paycheck_amount: 3400,
        paycheck_frequency: "bi-weekly" as const,
        auto_apply_allocation: true,
        dismissed_merchants: [],
        ...settings,
      })
      .select(SETTINGS_SAFE_COLUMNS)
      .single();
    if (error) throw error;
    return data as Settings;
  }
}

/* ================================================================== */
/*  Seed Data – runs once on first login                               */
/* ================================================================== */

export async function seedDefaultData() {
  // Check if already seeded
  const { data: existing } = await supabase
    .from("money_accounts")
    .select("id")
    .eq("user_id", OWNER_ID)
    .limit(1);
  if (existing && existing.length > 0) return;

  const uid = OWNER_ID;

  // Create accounts
  const accountDefs = [
    { name: "Bills", type: "checking" as const, currency: "CAD" as const },
    { name: "Emergency", type: "checking" as const, currency: "CAD" as const },
    { name: "Car", type: "checking" as const, currency: "CAD" as const },
    { name: "Personal", type: "checking" as const, currency: "CAD" as const },
    { name: "Brokerage", type: "investing" as const, currency: "CAD" as const },
  ];

  const { data: accounts, error: accErr } = await supabase
    .from("money_accounts")
    .insert(accountDefs.map((a) => ({ ...a, user_id: uid })))
    .select();
  if (accErr) throw accErr;

  const acctMap: Record<string, string> = {};
  for (const a of accounts!) {
    acctMap[a.name] = a.id;
  }

  // Create goals
  const { data: seededGoals, error: goalErr } = await supabase.from("money_goals").insert([
    {
      user_id: uid,
      name: "Emergency Fund",
      target_amount: 20000,
      linked_account_id: acctMap["Emergency"],
    },
    {
      user_id: uid,
      name: "Car Fund",
      target_amount: 25000,
      linked_account_id: acctMap["Car"],
    },
    {
      user_id: uid,
      name: "Investing",
      target_amount: null,
      linked_account_id: acctMap["Brokerage"],
    },
  ]).select();
  if (goalErr) throw goalErr;

  // Seed many-to-many goal links when the table exists.
  if (seededGoals && seededGoals.length > 0) {
    const goalIdByName = Object.fromEntries(
      seededGoals.map((goal) => [goal.name, goal.id])
    ) as Record<string, string>;
    const { error: goalLinkErr } = await supabase.from("money_goal_accounts").insert([
      {
        user_id: uid,
        goal_id: goalIdByName["Emergency Fund"],
        account_id: acctMap["Emergency"],
        allocated_amount: null,
      },
      {
        user_id: uid,
        goal_id: goalIdByName["Car Fund"],
        account_id: acctMap["Car"],
        allocated_amount: null,
      },
      {
        user_id: uid,
        goal_id: goalIdByName["Investing"],
        account_id: acctMap["Brokerage"],
        allocated_amount: null,
      },
    ]);
    if (goalLinkErr) {
      
    }
  }

  // Create allocation plans
  await supabase.from("money_allocation_plans").insert([
    {
      user_id: uid,
      name: "Phase 1: Emergency First",
      is_active: true,
      allocations: {
        Bills: 1500,
        Emergency: 1500,
        Car: 250,
        Invest: 100,
        Personal: 50,
      },
    },
    {
      user_id: uid,
      name: "Phase 2: After Emergency",
      is_active: false,
      allocations: {
        Bills: 1500,
        Car: 1350,
        Invest: 400,
        Personal: 150,
        Emergency: 0,
      },
    },
  ]);

  // Create default settings
  await supabase.from("money_settings").insert({
    user_id: uid,
    base_currency: "CAD",
    display_name: "Amir",
    greeting_tone: "coach",
    expense_categories: [
      "Food",
      "Transport",
      "Bills",
      "Rent",
      "Fun",
      "Health",
      "Personal Care",
      "Other",
    ],
    subscription_categories: [
      "Streaming",
      "Music",
      "Software",
      "Cloud",
      "Gaming",
      "News",
      "Fitness",
      "Food",
      "Finance",
      "Other",
    ],
    rent_amount: 2100,
    rent_day: 28,
    rent_reminder_days: 7,
    bill_reminder_days: 3,
    monthly_essentials_budget: 3000,
    paycheck_amount: 3400,
    paycheck_frequency: "bi-weekly",
    auto_apply_allocation: true,
    dismissed_merchants: [],
  });
}

/* ================================================================== */
/*  Holdings                                                          */
/* ================================================================== */

export async function getHoldings() {
  const { data, error } = await supabase
    .from("money_holdings")
    .select("*")
    .order("created_at");
  if (error) {
    // Table may not exist yet — return empty array instead of crashing
    
    return [] as Holding[];
  }
  return data as Holding[];
}

export async function createHolding(holding: {
  account_id: string;
  symbol: string;
  shares: number;
  cost_basis: number;
  cost_currency?: Holding["cost_currency"];
}) {
  if (isDemoModeRoute()) return demoCreateHolding({ ...holding, cost_currency: holding.cost_currency ?? "USD" });
  const { data, error } = await supabase
    .from("money_holdings")
    .insert({
      ...holding,
      cost_currency: holding.cost_currency ?? "USD",
      user_id: OWNER_ID,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Holding;
}

export async function updateHolding(
  id: string,
  updates: {
    shares?: number;
    cost_basis?: number;
    cost_currency?: Holding["cost_currency"];
    symbol?: string;
    account_id?: string;
  }
) {
  if (isDemoModeRoute()) return demoUpdateHolding(id, updates);
  const { data, error } = await supabase
    .from("money_holdings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Holding;
}

export async function deleteHolding(id: string) {
  if (isDemoModeRoute()) { demoDeleteHolding(id); return; }
  const { error } = await supabase.from("money_holdings").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */

export function computeAccountBalance(
  accountId: string,
  transactions: Transaction[],
  startingBalance: number = 0,
  creditCardPayments?: CreditCardPayment[]
): number {
  let balance = startingBalance;
  for (const tx of transactions) {
    if (tx.type === "income" && tx.account_id === accountId) {
      balance += tx.amount;
    } else if (tx.type === "expense" && tx.account_id === accountId) {
      balance -= tx.amount;
    } else if (tx.type === "transfer") {
      if (tx.from_account_id === accountId) balance -= tx.amount;
      if (tx.to_account_id === accountId) balance += (tx.received_amount ?? tx.amount);
    } else if (tx.type === "correction") {
      if (tx.to_account_id === accountId) balance += tx.amount;
      if (tx.from_account_id === accountId) balance -= tx.amount;
    }
  }
  // Subtract credit card payments made from this account
  if (creditCardPayments) {
    for (const p of creditCardPayments) {
      if (p.account_id === accountId) {
        balance -= p.amount;
      }
    }
  }
  return balance;
}

export function getMonthRange(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const from = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { from, to };
}

/* ================================================================== */
/*  Subscriptions                                                     */
/* ================================================================== */

export async function getSubscriptions() {
  const { data, error } = await supabase
    .from("money_subscriptions")
    .select("*")
    .order("next_billing");
  if (error) {
    
    return [] as Subscription[];
  }
  return data as Subscription[];
}

export async function createSubscription(
  sub: Omit<Subscription, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateSubscription(sub);
  const { data, error } = await supabase
    .from("money_subscriptions")
    .insert({ ...sub, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as Subscription;
}

export async function updateSubscription(
  id: string,
  updates: Partial<Omit<Subscription, "id" | "created_at" | "user_id">>
) {
  if (isDemoModeRoute()) return demoUpdateSubscription(id, updates);
  const { data, error } = await supabase
    .from("money_subscriptions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Subscription;
}

export async function deleteSubscription(id: string) {
  if (isDemoModeRoute()) { demoDeleteSubscription(id); return; }
  const { error } = await supabase.from("money_subscriptions").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Dividends                                                         */
/* ================================================================== */

export async function getDividends() {
  const { data, error } = await supabase
    .from("money_dividends")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    
    return [] as Dividend[];
  }
  return data as Dividend[];
}

export async function createDividend(
  div: Omit<Dividend, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateDividend({ ...div, reinvested: div.reinvested ?? false });
  const { data, error } = await supabase
    .from("money_dividends")
    .insert({ ...div, reinvested: div.reinvested ?? false, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as Dividend;
}

export async function updateDividend(
  id: string,
  updates: Partial<Omit<Dividend, "id" | "created_at" | "user_id">>
) {
  if (isDemoModeRoute()) return demoUpdateDividend(id, updates);
  const { data, error } = await supabase
    .from("money_dividends")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Dividend;
}

export async function deleteDividend(id: string) {
  if (isDemoModeRoute()) { demoDeleteDividend(id); return; }
  const { error } = await supabase.from("money_dividends").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Credit Cards                                                      */
/* ================================================================== */

export async function getCreditCards() {
  const { data, error } = await supabase
    .from("money_credit_cards")
    .select("*")
    .order("created_at");
  if (error) {
    
    return [] as CreditCard[];
  }
  return data as CreditCard[];
}

export async function createCreditCard(
  card: Omit<CreditCard, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateCreditCard(card);
  const { data, error } = await supabase
    .from("money_credit_cards")
    .insert({ ...card, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as CreditCard;
}

export async function updateCreditCard(
  id: string,
  updates: Partial<Omit<CreditCard, "id" | "created_at" | "user_id">>
) {
  if (isDemoModeRoute()) return demoUpdateCreditCard(id, updates);
  const { data, error } = await supabase
    .from("money_credit_cards")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CreditCard;
}

export async function deleteCreditCard(id: string) {
  if (isDemoModeRoute()) { demoDeleteCreditCard(id); return; }
  const { error } = await supabase.from("money_credit_cards").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================== */
/*  Credit Card Charges                                               */
/* ================================================================== */

export async function getCreditCardCharges() {
  const { data, error } = await supabase
    .from("money_credit_card_charges")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    
    return [] as CreditCardCharge[];
  }
  return data as CreditCardCharge[];
}

export async function createCreditCardCharge(
  charge: Omit<CreditCardCharge, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateCreditCardCharge(charge);
  const { data, error } = await supabase
    .from("money_credit_card_charges")
    .insert({ ...charge, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as CreditCardCharge;
}

/** Create a CC charge AND its linked expense transaction in one shot. */
export async function createLinkedCreditCardCharge(
  charge: Omit<CreditCardCharge, "id" | "created_at" | "user_id" | "linked_transaction_id">,
  txOverrides: {
    currency: CurrencyCode;
    cardName: string;
    is_recurring?: boolean;
    recurrence?: string | null;
  }
) {
  if (isDemoModeRoute()) {
    const recurring = txOverrides.is_recurring ?? false;
    const tx = demoCreateTransaction({
      type: "expense",
      date: charge.date,
      amount: charge.amount,
      currency: txOverrides.currency,
      category: charge.category ?? null,
      account_id: null,
      from_account_id: null,
      to_account_id: null,
      merchant: charge.merchant ?? null,
      notes: charge.notes ? `CC: ${txOverrides.cardName} — ${charge.notes}` : `CC: ${txOverrides.cardName}`,
      is_recurring: recurring,
      recurrence: recurring ? (txOverrides.recurrence as import("./database.types").RecurrenceFrequency ?? null) : null,
    });
    const ccCharge = demoCreateCreditCardCharge({ ...charge, linked_transaction_id: tx.id });
    demoUpdateTransaction(tx.id, { linked_charge_id: ccCharge.id });
    return ccCharge;
  }
  const recurring = txOverrides.is_recurring ?? false;
  // 1. Create the expense transaction first
  const tx = await createTransaction({
    type: "expense",
    date: charge.date,
    amount: charge.amount,
    currency: txOverrides.currency,
    category: charge.category ?? null,
    account_id: null,
    from_account_id: null,
    to_account_id: null,
    merchant: charge.merchant ?? null,
    notes: charge.notes ? `CC: ${txOverrides.cardName} — ${charge.notes}` : `CC: ${txOverrides.cardName}`,
    is_recurring: recurring,
    recurrence: recurring ? (txOverrides.recurrence as import("./database.types").RecurrenceFrequency ?? null) : null,
    linked_charge_id: null, // will be updated after charge is created
  });
  // 2. Create the charge with back-link
  const { data, error } = await supabase
    .from("money_credit_card_charges")
    .insert({ ...charge, linked_transaction_id: tx.id, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  const ccCharge = data as CreditCardCharge;
  // 3. Update transaction with forward-link
  await supabase
    .from("money_transactions")
    .update({ linked_charge_id: ccCharge.id })
    .eq("id", tx.id);
  return ccCharge;
}

export async function deleteCreditCardCharge(id: string) {
  if (isDemoModeRoute()) { demoDeleteCreditCardCharge(id); return; }
  // Also delete linked expense transaction if one exists
  const { data: charge } = await supabase
    .from("money_credit_card_charges")
    .select("linked_transaction_id")
    .eq("id", id)
    .single();
  if (charge?.linked_transaction_id) {
    // Clear back-link first to avoid loops
    await supabase
      .from("money_transactions")
      .update({ linked_charge_id: null })
      .eq("id", charge.linked_transaction_id);
    await supabase
      .from("money_transactions")
      .delete()
      .eq("id", charge.linked_transaction_id);
  }
  const { error } = await supabase.from("money_credit_card_charges").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCreditCardCharge(
  id: string,
  updates: Partial<Omit<CreditCardCharge, "id" | "created_at" | "user_id">>
) {
  if (isDemoModeRoute()) return demoUpdateCreditCardCharge(id, updates);
  const { data, error } = await supabase
    .from("money_credit_card_charges")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const charge = data as CreditCardCharge;
  // Sync changes to linked expense transaction if one exists
  if (charge.linked_transaction_id) {
    const txUpdates: Record<string, unknown> = {};
    if (updates.date !== undefined) txUpdates.date = updates.date;
    if (updates.amount !== undefined) txUpdates.amount = updates.amount;
    if (updates.merchant !== undefined) txUpdates.merchant = updates.merchant;
    if (updates.category !== undefined) txUpdates.category = updates.category;
    if (Object.keys(txUpdates).length > 0) {
      await supabase
        .from("money_transactions")
        .update(txUpdates)
        .eq("id", charge.linked_transaction_id);
    }
  }
  return charge;
}

/* ================================================================== */
/*  Credit Card Payments                                              */
/* ================================================================== */

export async function getCreditCardPayments() {
  const { data, error } = await supabase
    .from("money_credit_card_payments")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    
    return [] as CreditCardPayment[];
  }
  return data as CreditCardPayment[];
}

export async function createCreditCardPayment(
  payment: Omit<CreditCardPayment, "id" | "created_at" | "user_id">
) {
  if (isDemoModeRoute()) return demoCreateCreditCardPayment(payment);
  const { data, error } = await supabase
    .from("money_credit_card_payments")
    .insert({ ...payment, user_id: OWNER_ID })
    .select()
    .single();
  if (error) throw error;
  return data as CreditCardPayment;
}

export async function updateCreditCardPayment(id: string, updates: Partial<Omit<CreditCardPayment, "id" | "created_at" | "user_id">>) {
  if (isDemoModeRoute()) {
    const s = (await import("./demo-store")).getDemoStore();
    const idx = s.creditCardPayments.findIndex((p) => p.id === id);
    if (idx >= 0) Object.assign(s.creditCardPayments[idx], updates);
    return;
  }
  const { error } = await supabase.from("money_credit_card_payments").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteCreditCardPayment(id: string) {
  if (isDemoModeRoute()) { demoDeleteCreditCardPayment(id); return; }
  const { error } = await supabase.from("money_credit_card_payments").delete().eq("id", id);
  if (error) throw error;
}

/** Compute the outstanding balance on a credit card:
 *  Sum of charges - Sum of payments */
export function computeCreditCardBalance(
  cardId: string,
  charges: CreditCardCharge[],
  payments: CreditCardPayment[]
): number {
  const totalCharges = charges
    .filter((c) => c.card_id === cardId)
    .reduce((s, c) => s + c.amount, 0);
  const totalPayments = payments
    .filter((p) => p.card_id === cardId)
    .reduce((s, p) => s + p.amount, 0);
  const bal = totalCharges - totalPayments;
  return Math.abs(bal) < 0.005 ? 0 : Math.round(bal * 100) / 100;
}

/** Compute pending payments from a specific account (sum of cc payments from that account) */
export function computePendingCreditCardPayments(
  accountId: string,
  charges: CreditCardCharge[],
  payments: CreditCardPayment[],
  creditCards: CreditCard[]
): number {
  // Sum of outstanding balances on cards linked to this account
  let pending = 0;
  for (const card of creditCards) {
    if (card.linked_account_id === accountId) {
      const bal = computeCreditCardBalance(card.id, charges, payments);
      if (bal > 0) pending += bal;
    }
  }
  return pending;
}
