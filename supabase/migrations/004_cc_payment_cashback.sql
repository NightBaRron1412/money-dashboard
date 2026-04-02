-- Allow credit card payments without a linked bank account (e.g. cashback redemptions).

ALTER TABLE money_credit_card_payments
  ALTER COLUMN account_id DROP NOT NULL;
