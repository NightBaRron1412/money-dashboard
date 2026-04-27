/* ------------------------------------------------------------------ */
/*  Auto-generated-style type definitions for the Supabase schema     */
/*  Keep in sync with supabase/schema.sql                             */
/* ------------------------------------------------------------------ */

export type AccountType = "checking" | "investing";
export type TransactionType = "income" | "expense" | "transfer" | "correction";
export type CurrencyCode = "CAD" | "USD" | "EGP";
export type IncomeSource =
  | "Paycheck"
  | "Stocks"
  | "Bonus"
  | "Freelance"
  | "Dividends"
  | "Refund"
  | "Gift"
  | "Other";
export type ExpenseCategory = string;
export type PaycheckFrequency = "weekly" | "bi-weekly" | "monthly";
export type GreetingTone = string;

/* ---------- Row types ---------- */

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  starting_balance: number;
  created_at: string;
}

export type RecurrenceFrequency = "weekly" | "bi-weekly" | "monthly" | "yearly";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number;
  currency: CurrencyCode;
  category: string | null;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  merchant: string | null;
  notes: string | null;
  recurrence: RecurrenceFrequency | null;
  is_recurring: boolean;
  exclude_from_monthly: boolean;
  goal_id: string | null;
  linked_charge_id: string | null;
  idempotency_key: string | null;
  received_amount: number | null;
  created_at: string;
}

export interface TransactionWithBalance extends Transaction {
  signed_amount: number;
  running_balance: number;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | null;
  target_date: string | null;
  linked_account_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface GoalAccount {
  id: string;
  user_id: string;
  goal_id: string;
  account_id: string;
  allocated_amount: number | null;
  created_at: string;
}

export interface AllocationPlan {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  allocations: Record<string, number>;
  created_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  pin_hash: string | null;
  base_currency: CurrencyCode;
  display_name: string;
  greeting_tone: GreetingTone;
  expense_categories: string[];
  subscription_categories: string[];
  rent_amount: number;
  rent_day: number;
  rent_reminder_days: number;
  bill_reminder_days: number;
  monthly_essentials_budget: number;
  paycheck_amount: number;
  paycheck_frequency: PaycheckFrequency;
  auto_apply_allocation: boolean;
  dismissed_merchants: string[];
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}


export interface Holding {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;        // e.g. "AAPL", "VOO", "CASH"
  shares: number;
  cost_basis: number;    // total cost paid
  cost_currency: CurrencyCode;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  category: string | null;
  next_billing: string;
  is_active: boolean;
  notes: string | null;
  /** Account id or "cc:" + card id — default account/card to pay this subscription from */
  payment_account_id: string | null;
  created_at: string;
}

export interface Dividend {
  id: string;
  user_id: string;
  holding_id: string;
  symbol: string;
  amount: number;
  currency: CurrencyCode;
  date: string;
  notes: string | null;
  reinvested: boolean;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expires_at: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  currency: CurrencyCode;
  credit_limit: number;
  linked_account_id: string | null;
  created_at: string;
}

export interface CreditCardCharge {
  id: string;
  user_id: string;
  card_id: string;
  date: string;
  amount: number;
  merchant: string | null;
  category: string | null;
  notes: string | null;
  linked_transaction_id: string | null;
  created_at: string;
}

export interface CreditCardPayment {
  id: string;
  user_id: string;
  card_id: string;
  account_id: string | null;
  date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  channel: "webpush";
  dedupe_key: string;
  title: string;
  body: string;
  created_at: string;
}

export type ReconciliationStatus = "open" | "resolved" | "cancelled";
export type ReconciliationActionType = "merge" | "delete" | "keep_both" | "adjust";

export interface ReconciliationSession {
  id: string;
  owner_id: string;
  account_id: string;
  started_at: string;
  date_from: string | null;
  date_to: string | null;
  expected_balance: number | null;
  computed_balance: number | null;
  delta: number | null;
  status: ReconciliationStatus;
  created_at: string;
}

export interface ReconciliationAction {
  id: string;
  session_id: string;
  owner_id: string;
  action_type: ReconciliationActionType;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface DuplicateCandidate {
  tx_a_id: string;
  tx_b_id: string;
  amount: number;
  date_a: string;
  date_b: string;
  merchant_a: string | null;
  merchant_b: string | null;
  score: number;
}

/* ---------- Supabase DB helper type ---------- */

export interface Database {
  public: {
    Tables: {
      money_accounts: {
        Row: Account;
        Insert: Omit<Account, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Account, "id">>;
      };
      money_transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Transaction, "id">>;
      };
      money_goals: {
        Row: Goal;
        Insert: Omit<Goal, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Goal, "id">>;
      };
      money_goal_accounts: {
        Row: GoalAccount;
        Insert: Omit<GoalAccount, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<GoalAccount, "id">>;
      };
      money_allocation_plans: {
        Row: AllocationPlan;
        Insert: Omit<AllocationPlan, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<AllocationPlan, "id">>;
      };
      money_settings: {
        Row: Settings;
        Insert: Omit<Settings, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Settings, "id">>;
      };
      money_holdings: {
        Row: Holding;
        Insert: Omit<Holding, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Holding, "id">>;
      };
      money_subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Subscription, "id">>;
      };
      money_dividends: {
        Row: Dividend;
        Insert: Omit<Dividend, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Dividend, "id">>;
      };
      money_push_subscriptions: {
        Row: PushSubscriptionRecord;
        Insert: Omit<PushSubscriptionRecord, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<PushSubscriptionRecord, "id">>;
      };
      money_notification_logs: {
        Row: NotificationLog;
        Insert: Omit<NotificationLog, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<NotificationLog, "id">>;
      };
      money_credit_cards: {
        Row: CreditCard;
        Insert: Omit<CreditCard, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CreditCard, "id">>;
      };
      money_credit_card_charges: {
        Row: CreditCardCharge;
        Insert: Omit<CreditCardCharge, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CreditCardCharge, "id">>;
      };
      money_credit_card_payments: {
        Row: CreditCardPayment;
        Insert: Omit<CreditCardPayment, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CreditCardPayment, "id">>;
      };
      money_reconciliation_sessions: {
        Row: ReconciliationSession;
        Insert: Omit<ReconciliationSession, "id" | "created_at" | "started_at"> & { id?: string; created_at?: string; started_at?: string };
        Update: Partial<Omit<ReconciliationSession, "id">>;
      };
      money_reconciliation_actions: {
        Row: ReconciliationAction;
        Insert: Omit<ReconciliationAction, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ReconciliationAction, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_running_balance: {
        Args: { p_account_id: string; p_owner_id?: string; p_date_from?: string; p_date_to?: string };
        Returns: TransactionWithBalance[];
      };
      find_duplicate_transactions: {
        Args: { p_account_id: string; p_owner_id?: string; p_date_from?: string; p_date_to?: string };
        Returns: DuplicateCandidate[];
      };
      money_increment_failed_attempts: {
        Args: { p_owner_id?: string; p_max_attempts?: number; p_lockout_minutes?: number };
        Returns: { new_count: number }[];
      };
    };
    Enums: Record<string, never>;
  };
}

/* ---------- Voice transaction parsing ---------- */

export interface ParsedVoiceTransaction {
  type: "expense" | "income" | "transfer";
  amount: number | null;
  currency: CurrencyCode | null;
  category: string | null;
  merchant: string | null;
  date: string | null;
  account_name: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  credit_card_name: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurrence: string | null;
  transcript: string;
  confidence: number;
  unclear_fields: string[];
}
