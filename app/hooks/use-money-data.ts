"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
} from "@/lib/money/database.types";
import {
  getAccounts,
  getTransactions,
  getGoals,
  getGoalAccounts,
  getAllocationPlans,
  getSettings,
  getHoldings,
  getSubscriptions,
  getDividends,
  getCreditCards,
  getCreditCardCharges,
  getCreditCardPayments,
  computeAccountBalance,
} from "@/lib/money/queries";
import { getDemoStore } from "@/lib/money/demo-store";

export interface MoneyData {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  goalAccounts: GoalAccount[];
  plans: AllocationPlan[];
  settings: Settings | null;
  holdings: Holding[];
  subscriptions: Subscription[];
  dividends: Dividend[];
  creditCards: CreditCard[];
  creditCardCharges: CreditCardCharge[];
  creditCardPayments: CreditCardPayment[];
  balances: Record<string, number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMoneyData(options?: { demoMode?: boolean }): MoneyData {
  const pathname = usePathname();
  const demoMode = options?.demoMode ?? pathname.startsWith("/demo");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalAccounts, setGoalAccounts] = useState<GoalAccount[]>([]);
  const [plans, setPlans] = useState<AllocationPlan[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [creditCardCharges, setCreditCardCharges] = useState<CreditCardCharge[]>([]);
  const [creditCardPayments, setCreditCardPayments] = useState<CreditCardPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (demoMode) {
        const demo = getDemoStore();
        setAccounts([...demo.accounts]);
        setTransactions([...demo.transactions]);
        setGoals([...demo.goals]);
        setGoalAccounts([...demo.goalAccounts]);
        setPlans([...demo.plans]);
        setSettings(demo.settings ? { ...demo.settings } : null);
        setHoldings([...demo.holdings]);
        setSubscriptions([...demo.subscriptions]);
        setDividends([...demo.dividends]);
        setCreditCards([...demo.creditCards]);
        setCreditCardCharges([...demo.creditCardCharges]);
        setCreditCardPayments([...demo.creditCardPayments]);
        return;
      }

      const [a, t, g, ga, p, s, h, sub, div, cc, ccCharges, ccPayments] = await Promise.all([
        getAccounts(),
        getTransactions(),
        getGoals(),
        getGoalAccounts(),
        getAllocationPlans(),
        getSettings(),
        getHoldings(),
        getSubscriptions(),
        getDividends(),
        getCreditCards(),
        getCreditCardCharges(),
        getCreditCardPayments(),
      ]);
      setAccounts(a);
      setTransactions(t);
      setGoals(g);
      setGoalAccounts(ga);
      setPlans(p);
      setSettings(s);
      setHoldings(h);
      setSubscriptions(sub);
      setDividends(div);
      setCreditCards(cc);
      setCreditCardCharges(ccCharges);
      setCreditCardPayments(ccPayments);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Compute balances from transactions (includes CC payments deducted from accounts)
  const balances: Record<string, number> = {};
  for (const acct of accounts) {
    balances[acct.id] = computeAccountBalance(acct.id, transactions, acct.starting_balance ?? 0, creditCardPayments);
  }

  return {
    accounts,
    transactions,
    goals,
    goalAccounts,
    plans,
    settings,
    holdings,
    subscriptions,
    dividends,
    creditCards,
    creditCardCharges,
    creditCardPayments,
    balances,
    loading,
    error,
    refresh,
  };
}
