/**
 * In-memory mutable store for demo mode.
 * Initialized from getDemoMoneyData() on first access.
 * All mutations operate on this store instead of Supabase.
 * Data resets on page reload (no persistence).
 */

import type {
  Account,
  AllocationPlan,
  CreditCard,
  CreditCardCharge,
  CreditCardPayment,
  Dividend,
  Goal,
  GoalAccount,
  Holding,
  Settings,
  Subscription,
  Transaction,
} from "./database.types";
import { getDemoMoneyData, type DemoMoneyData } from "../../app/hooks/demo-data";

interface DemoStore {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  goalAccounts: GoalAccount[];
  plans: AllocationPlan[];
  settings: Settings;
  holdings: Holding[];
  subscriptions: Subscription[];
  dividends: Dividend[];
  creditCards: CreditCard[];
  creditCardCharges: CreditCardCharge[];
  creditCardPayments: CreditCardPayment[];
}

let _store: DemoStore | null = null;

function ensureStore(): DemoStore {
  if (!_store) {
    _store = { ...getDemoMoneyData() };
  }
  return _store;
}

export function getDemoStore(): DemoMoneyData {
  return ensureStore();
}

export function resetDemoStore(): void {
  _store = null;
}

function uid(): string {
  return "demo-" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// --------------- Accounts ---------------

export function demoCreateAccount(account: Partial<Account>): Account {
  const s = ensureStore();
  const item: Account = {
    id: uid(),
    user_id: "demo",
    name: "New Account",
    type: "checking",
    currency: "CAD",
    starting_balance: 0,
    created_at: now(),
    ...account,
  };
  if (!item.id) item.id = uid();
  s.accounts.push(item);
  return item;
}

export function demoUpdateAccount(id: string, updates: Partial<Account>): Account {
  const s = ensureStore();
  const idx = s.accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Account not found");
  s.accounts[idx] = { ...s.accounts[idx], ...updates };
  return s.accounts[idx];
}

export function demoDeleteAccount(id: string): void {
  const s = ensureStore();
  s.accounts = s.accounts.filter((a) => a.id !== id);
}

// --------------- Transactions ---------------

export function demoCreateTransaction(tx: Partial<Transaction>): Transaction {
  const s = ensureStore();
  const item: Transaction = {
    id: uid(),
    user_id: "demo",
    type: "expense",
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    currency: "CAD",
    category: null,
    account_id: null,
    from_account_id: null,
    to_account_id: null,
    merchant: null,
    notes: null,
    is_recurring: false,
    exclude_from_monthly: false,
    recurrence: null,
    linked_charge_id: null,
    idempotency_key: null,
    received_amount: null,
    created_at: now(),
    ...tx,
  };
  if (!item.id) item.id = uid();
  s.transactions.push(item);
  return item;
}

export function demoUpdateTransaction(id: string, updates: Partial<Transaction>): Transaction {
  const s = ensureStore();
  const idx = s.transactions.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Transaction not found");
  s.transactions[idx] = { ...s.transactions[idx], ...updates };
  return s.transactions[idx];
}

export function demoDeleteTransaction(id: string): void {
  const s = ensureStore();
  const tx = s.transactions.find((t) => t.id === id);
  if (tx?.linked_charge_id) {
    s.creditCardCharges = s.creditCardCharges.filter((c) => c.id !== tx.linked_charge_id);
  }
  s.transactions = s.transactions.filter((t) => t.id !== id);
}

// --------------- Goals ---------------

export function demoCreateGoal(goal: Partial<Goal>, linkedAccounts?: string[]): Goal {
  const s = ensureStore();
  const item: Goal = {
    id: uid(),
    user_id: "demo",
    name: "New Goal",
    target_amount: 0,
    linked_account_id: linkedAccounts?.[0] ?? null,
    target_date: null,
    created_at: now(),
    ...goal,
  };
  if (!item.id) item.id = uid();
  s.goals.push(item);
  if (linkedAccounts) {
    demoSetGoalAccounts(item.id, linkedAccounts);
  }
  return item;
}

export function demoUpdateGoal(id: string, updates: Partial<Goal>, linkedAccounts?: string[]): Goal {
  const s = ensureStore();
  const idx = s.goals.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error("Goal not found");
  if (linkedAccounts !== undefined) {
    updates.linked_account_id = linkedAccounts[0] ?? null;
  }
  s.goals[idx] = { ...s.goals[idx], ...updates };
  if (linkedAccounts !== undefined) {
    demoSetGoalAccounts(id, linkedAccounts);
  }
  return s.goals[idx];
}

export function demoDeleteGoal(id: string): void {
  const s = ensureStore();
  s.goals = s.goals.filter((g) => g.id !== id);
  s.goalAccounts = s.goalAccounts.filter((ga) => ga.goal_id !== id);
}

export function demoSetGoalAccounts(goalId: string, accountIds: string[]): void {
  const s = ensureStore();
  s.goalAccounts = s.goalAccounts.filter((ga) => ga.goal_id !== goalId);
  for (const accountId of accountIds) {
    s.goalAccounts.push({
      id: uid(),
      user_id: "demo",
      goal_id: goalId,
      account_id: accountId,
      allocated_amount: null,
      created_at: now(),
    });
  }
}

export function demoAddGoalAccountAllocation(goalId: string, accountId: string, amountToAdd: number): void {
  const s = ensureStore();
  const delta = Number.isFinite(amountToAdd) ? Math.max(0, amountToAdd) : 0;
  if (delta <= 0) return;
  const existing = s.goalAccounts.find((ga) => ga.goal_id === goalId && ga.account_id === accountId);
  if (existing) {
    existing.allocated_amount = (existing.allocated_amount ?? 0) + delta;
  } else {
    s.goalAccounts.push({
      id: uid(),
      user_id: "demo",
      goal_id: goalId,
      account_id: accountId,
      allocated_amount: delta,
      created_at: now(),
    });
  }
}

// --------------- Allocation Plans ---------------

export function demoCreateAllocationPlan(plan: Partial<AllocationPlan>): AllocationPlan {
  const s = ensureStore();
  const item: AllocationPlan = {
    id: uid(),
    user_id: "demo",
    name: "New Plan",
    is_active: false,
    allocations: {} as Record<string, number>,
    created_at: now(),
    ...plan,
  };
  if (!item.id) item.id = uid();
  s.plans.push(item);
  return item;
}

export function demoUpdateAllocationPlan(id: string, updates: Partial<AllocationPlan>): AllocationPlan {
  const s = ensureStore();
  const idx = s.plans.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Plan not found");
  s.plans[idx] = { ...s.plans[idx], ...updates };
  return s.plans[idx];
}

export function demoDeleteAllocationPlan(id: string): void {
  const s = ensureStore();
  s.plans = s.plans.filter((p) => p.id !== id);
}

export function demoSetActivePlan(id: string): AllocationPlan {
  const s = ensureStore();
  for (const p of s.plans) p.is_active = false;
  const idx = s.plans.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Plan not found");
  s.plans[idx].is_active = true;
  return s.plans[idx];
}

// --------------- Settings ---------------

export function demoUpsertSettings(updates: Partial<Settings>): Settings {
  const s = ensureStore();
  s.settings = { ...s.settings, ...updates };
  return s.settings;
}

// --------------- Holdings ---------------

export function demoCreateHolding(holding: Partial<Holding>): Holding {
  const s = ensureStore();
  const item: Holding = {
    id: uid(),
    user_id: "demo",
    account_id: "",
    symbol: "",
    shares: 0,
    cost_basis: 0,
    cost_currency: "USD",
    created_at: now(),
    ...holding,
  };
  if (!item.id) item.id = uid();
  s.holdings.push(item);
  return item;
}

export function demoUpdateHolding(id: string, updates: Partial<Holding>): Holding {
  const s = ensureStore();
  const idx = s.holdings.findIndex((h) => h.id === id);
  if (idx === -1) throw new Error("Holding not found");
  s.holdings[idx] = { ...s.holdings[idx], ...updates };
  return s.holdings[idx];
}

export function demoDeleteHolding(id: string): void {
  const s = ensureStore();
  s.holdings = s.holdings.filter((h) => h.id !== id);
}

// --------------- Subscriptions ---------------

export function demoCreateSubscription(sub: Partial<Subscription>): Subscription {
  const s = ensureStore();
  const item: Subscription = {
    id: uid(),
    user_id: "demo",
    name: "New Subscription",
    amount: 0,
    currency: "CAD",
    frequency: "monthly",
    category: null,
    next_billing: new Date().toISOString().slice(0, 10),
    is_active: true,
    notes: null,
    payment_account_id: null,
    created_at: now(),
    ...sub,
  };
  if (!item.id) item.id = uid();
  s.subscriptions.push(item);
  return item;
}

export function demoUpdateSubscription(id: string, updates: Partial<Subscription>): Subscription {
  const s = ensureStore();
  const idx = s.subscriptions.findIndex((sub) => sub.id === id);
  if (idx === -1) throw new Error("Subscription not found");
  s.subscriptions[idx] = { ...s.subscriptions[idx], ...updates };
  return s.subscriptions[idx];
}

export function demoDeleteSubscription(id: string): void {
  const s = ensureStore();
  s.subscriptions = s.subscriptions.filter((sub) => sub.id !== id);
}

// --------------- Dividends ---------------

export function demoCreateDividend(div: Partial<Dividend>): Dividend {
  const s = ensureStore();
  const item: Dividend = {
    id: uid(),
    user_id: "demo",
    holding_id: "",
    symbol: "",
    amount: 0,
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    notes: null,
    reinvested: false,
    created_at: now(),
    ...div,
  };
  if (!item.id) item.id = uid();
  s.dividends.push(item);
  return item;
}

export function demoUpdateDividend(id: string, updates: Partial<Dividend>): Dividend {
  const s = ensureStore();
  const idx = s.dividends.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error("Dividend not found");
  s.dividends[idx] = { ...s.dividends[idx], ...updates };
  return s.dividends[idx];
}

export function demoDeleteDividend(id: string): void {
  const s = ensureStore();
  s.dividends = s.dividends.filter((d) => d.id !== id);
}

// --------------- Credit Cards ---------------

export function demoCreateCreditCard(card: Partial<CreditCard>): CreditCard {
  const s = ensureStore();
  const item: CreditCard = {
    id: uid(),
    user_id: "demo",
    name: "New Card",
    credit_limit: 0,
    currency: "CAD",
    linked_account_id: null,
    created_at: now(),
    ...card,
  };
  if (!item.id) item.id = uid();
  s.creditCards.push(item);
  return item;
}

export function demoUpdateCreditCard(id: string, updates: Partial<CreditCard>): CreditCard {
  const s = ensureStore();
  const idx = s.creditCards.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Credit card not found");
  s.creditCards[idx] = { ...s.creditCards[idx], ...updates };
  return s.creditCards[idx];
}

export function demoDeleteCreditCard(id: string): void {
  const s = ensureStore();
  s.creditCards = s.creditCards.filter((c) => c.id !== id);
}

// --------------- Credit Card Charges ---------------

export function demoCreateCreditCardCharge(charge: Partial<CreditCardCharge>): CreditCardCharge {
  const s = ensureStore();
  const item: CreditCardCharge = {
    id: uid(),
    user_id: "demo",
    card_id: "",
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    merchant: null,
    category: null,
    notes: null,
    linked_transaction_id: null,
    created_at: now(),
    ...charge,
  };
  if (!item.id) item.id = uid();
  s.creditCardCharges.push(item);
  return item;
}

export function demoUpdateCreditCardCharge(id: string, updates: Partial<CreditCardCharge>): CreditCardCharge {
  const s = ensureStore();
  const idx = s.creditCardCharges.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Charge not found");
  s.creditCardCharges[idx] = { ...s.creditCardCharges[idx], ...updates };
  const charge = s.creditCardCharges[idx];
  if (charge.linked_transaction_id) {
    const txIdx = s.transactions.findIndex((t) => t.id === charge.linked_transaction_id);
    if (txIdx !== -1) {
      const txUpdates: Partial<Transaction> = {};
      if (updates.date !== undefined) txUpdates.date = updates.date;
      if (updates.amount !== undefined) txUpdates.amount = updates.amount;
      if (updates.merchant !== undefined) txUpdates.merchant = updates.merchant;
      if (updates.category !== undefined) txUpdates.category = updates.category;
      if (Object.keys(txUpdates).length > 0) {
        s.transactions[txIdx] = { ...s.transactions[txIdx], ...txUpdates };
      }
    }
  }
  return charge;
}

export function demoDeleteCreditCardCharge(id: string): void {
  const s = ensureStore();
  const charge = s.creditCardCharges.find((c) => c.id === id);
  if (charge?.linked_transaction_id) {
    s.transactions = s.transactions.filter((t) => t.id !== charge.linked_transaction_id);
  }
  s.creditCardCharges = s.creditCardCharges.filter((c) => c.id !== id);
}

// --------------- Credit Card Payments ---------------

export function demoCreateCreditCardPayment(payment: Partial<CreditCardPayment>): CreditCardPayment {
  const s = ensureStore();
  const item: CreditCardPayment = {
    id: uid(),
    user_id: "demo",
    card_id: "",
    account_id: null,
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    notes: null,
    created_at: now(),
    ...payment,
  };
  if (!item.id) item.id = uid();
  s.creditCardPayments.push(item);
  return item;
}

export function demoDeleteCreditCardPayment(id: string): void {
  const s = ensureStore();
  s.creditCardPayments = s.creditCardPayments.filter((p) => p.id !== id);
}
