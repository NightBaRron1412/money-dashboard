"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMoneyData } from "./hooks/use-money-data";
import { useMoneyFx } from "./hooks/use-money-fx";
import {
  StatCard,
  ProgressBar,
  PageHeader,
  formatMoney,
  HIDDEN_BALANCE,
  EmptyState,
  nowEST,
  todayEST,
} from "./components/money-ui";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertTriangle,
  Plus,
  ArrowDownUp,
  Loader2,
  BarChart3,
  Target,
  Repeat,
  Copy,
  X,
} from "lucide-react";
import Link from "next/link";
import { getMonthRange, createTransaction, updateTransaction, createLinkedCreditCardCharge } from "@/lib/money/queries";
import type { CurrencyCode, RecurrenceFrequency } from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";
import toast from "react-hot-toast";
import {
  NetWorthChart,
  ExpensesByCategoryChart,
  IncomeVsExpensesChart,
  GoalProgressChart,
} from "./components/money-charts";
import { useBalanceVisibility } from "./balance-visibility-provider";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import { detectSpendingAnomalies, forecastCashFlow, type CashFlowForecast } from "@/lib/money/forecasting";
import { TakeTourButton } from "./tour/take-tour-button";

export function DashboardContent({
  demoMode = false,
  routeBase = "",
}: {
  demoMode?: boolean;
  routeBase?: string;
}) {
  const { accounts, transactions, goals, goalAccounts, holdings, dividends, subscriptions, creditCards, creditCardCharges, balances, settings, loading, error, refresh } =
    useMoneyData({ demoMode });
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const [saving, setSaving] = useState(false);

  // AI insights state (start loading so card + skeleton show immediately, not empty)
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(true);

  const fetchAiInsights = useCallback(async (clearPrevious = false) => {
    setAiInsightsLoading(true);
    if (clearPrevious) setAiInsights(null);
    try {
      const res = await fetch("/api/ai/insights");
      if (!res.ok) { setAiInsightsLoading(false); return; }
      const data = await res.json();
      if (data.insights) {
        setAiInsights(data.insights);
        try { localStorage.setItem("money:ai-insights", JSON.stringify({ text: data.insights, ts: Date.now() })); } catch {}
      }
    } catch { /* silent */ } finally {
      setAiInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (demoMode) {
      setAiInsights(
        "Your savings rate jumped to 42% this month — nicely above your 3-month average of 35%. Food spending is well controlled at $134. Consider bumping your Emergency Fund transfer from $750 to $900/paycheck — at that pace you'd hit the $20K target by September instead of December. Your Condo Down Payment still needs attention — the $300/month broker top-ups alone won't close the $77K gap fast enough."
      );
      setAiInsightsLoading(false);
      return;
    }
    try {
      const cached = localStorage.getItem("money:ai-insights");
      if (cached) {
        const { text, ts } = JSON.parse(cached);
        if (Date.now() - ts < 24 * 60 * 60 * 1000) {
          setAiInsights(text);
          setAiInsightsLoading(false);
          return;
        }
      }
    } catch {}
    setAiInsightsLoading(true);
    const delay = setTimeout(() => fetchAiInsights(), 5000);
    return () => clearTimeout(delay);
  }, [demoMode, fetchAiInsights]);

  // AI greeting state
  const [aiGreeting, setAiGreeting] = useState<string | null>(null);
  const [aiGreetingLoading, setAiGreetingLoading] = useState(false);

  const fetchAiGreeting = useCallback(async () => {
    setAiGreetingLoading(true);
    try {
      const res = await fetch("/api/ai/greeting");
      if (!res.ok) { setAiGreetingLoading(false); return; }
      const data = await res.json();
      if (data.greeting) {
        setAiGreeting(data.greeting);
        try { localStorage.setItem("money:ai-greeting", JSON.stringify({ text: data.greeting, ts: Date.now() })); } catch {}
      }
    } catch { /* silent */ } finally {
      setAiGreetingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (demoMode) {
      setAiGreeting(
        "You're saving 42% this month, up 7% from last month — keep that momentum rolling. Rent lands in 3 days, and you've got it covered."
      );
      return;
    }
    try {
      const cached = localStorage.getItem("money:ai-greeting");
      if (cached) {
        const { text, ts } = JSON.parse(cached);
        if (Date.now() - ts < 6 * 60 * 60 * 1000) { setAiGreeting(text); return; }
      }
    } catch {}
    fetchAiGreeting();
  }, [demoMode, fetchAiGreeting]);
  const appBase = routeBase;
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const goalProgress = computeGoalProgress(goals, goalAccounts, balances);
  const getGoalCurrentInBase = (goalId: string) =>
    Object.entries(goalProgress.goalAccountCurrentByGoalId[goalId] ?? {}).reduce(
      (sum, [accountId, amount]) => {
        const acct = accounts.find((a) => a.id === accountId);
        return sum + convertCurrency(amount, acct?.currency ?? baseCurrency, baseCurrency, fx);
      },
      0
    );

  const savingsRate = (income: number, expenses: number) => {
    if (income <= 0) return null;
    return ((income - expenses) / income) * 100;
  };

  // Fetch stock quotes for portfolio summary
  const [stockQuotes, setStockQuotes] = useState<Record<string, { price: number; change: number; changePercent: number; name: string; currency: string }>>({});
  const uniqueSymbols = useMemo(
    () => [...new Set(holdings.map((h) => h.symbol.toUpperCase()))],
    [holdings]
  );
  const symbolsQuery = useMemo(() => uniqueSymbols.join(","), [uniqueSymbols]);

  const fetchQuotes = useCallback(async () => {
    if (!symbolsQuery) return;
    try {
      const quotesRes = await fetch(`/api/stocks?symbols=${symbolsQuery}`);
      const data = await quotesRes.json();
      if (data.results) setStockQuotes(data.results);
    } catch { /* silent */ }
  }, [symbolsQuery]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (loading || error) return;
    if (typeof window === "undefined") return;

    const todayReminder = nowEST();
    const rentDayReminder = settings?.rent_day ?? 28;
    const rentReminderDays = Math.min(30, Math.max(0, settings?.rent_reminder_days ?? 7));
    const billReminderDays = Math.min(30, Math.max(0, settings?.bill_reminder_days ?? 3));
    const nextRentDateReminder = (() => {
      const thisMonth = new Date(
        todayReminder.getFullYear(),
        todayReminder.getMonth(),
        rentDayReminder
      );
      if (thisMonth > todayReminder) return thisMonth;
      return new Date(
        todayReminder.getFullYear(),
        todayReminder.getMonth() + 1,
        rentDayReminder
      );
    })();
    const daysUntilRentReminder = Math.max(
      0,
      Math.ceil(
        (nextRentDateReminder.getTime() - todayReminder.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const nextRentDateKeyReminder = nextRentDateReminder.toISOString().slice(0, 10);

    const notify = async (key: string, title: string, body: string) => {
      const storageKey = `money:notify:${key}`;
      if (window.localStorage.getItem(storageKey) === "1") return;
      window.localStorage.setItem(storageKey, "1");
      toast(body, { duration: 6000 });

      if (!("Notification" in window)) return;
      try {
        if (Notification.permission === "granted") {
          new Notification(title, { body });
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            new Notification(title, { body });
          }
        }
      } catch {
        // ignore notification errors
      }
    };

    if (daysUntilRentReminder <= rentReminderDays) {
      const rentBody = daysUntilRentReminder === 0
        ? `Rent is due today (${nextRentDateReminder.toLocaleDateString("en-US")}).`
        : `Rent is due in ${daysUntilRentReminder} day${daysUntilRentReminder !== 1 ? "s" : ""} (${nextRentDateReminder.toLocaleDateString("en-US")}).`;
      notify(`rent:${nextRentDateKeyReminder}`, "Rent Reminder", rentBody);
    }

    const dueSubs = subscriptions
      .filter((sub) => sub.is_active)
      .map((sub) => {
        const dueDate = new Date(sub.next_billing + "T00:00:00");
        const dueDays = Math.ceil(
          (dueDate.getTime() - todayReminder.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { sub, dueDate, dueDays };
      })
      .filter(({ dueDays }) => dueDays >= 0 && dueDays <= billReminderDays)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    for (const { sub, dueDate, dueDays } of dueSubs.slice(0, 3)) {
      const dueLabel = dueDays === 0 ? "today" : `in ${dueDays} day${dueDays !== 1 ? "s" : ""}`;
      const body = `${sub.name} bill is due ${dueLabel} (${dueDate.toLocaleDateString("en-US")}).`;
      notify(`sub:${sub.id}:${sub.next_billing}`, "Bill Reminder", body);
    }
  }, [loading, error, settings?.rent_day, settings?.rent_reminder_days, settings?.bill_reminder_days, subscriptions]);

  const portfolioMarketValueBase = holdings.reduce((sum, h) => {
    const sym = h.symbol.toUpperCase();
    const quote = stockQuotes[sym];
    const rawCur = sym === "CASH" ? "USD" : sym === "CASHCAD" ? "CAD" : (quote?.currency ?? "USD");
    const quoteCurrency: CurrencyCode =
      rawCur === "CAD" || rawCur === "USD" || rawCur === "EGP" ? rawCur : "USD";
    const price = sym === "CASH" || sym === "CASHCAD" ? 1 : (quote?.price ?? 0);
    return sum + h.shares * convertCurrency(price, quoteCurrency, baseCurrency, fx);
  }, 0);

  const totalDividendsBase = dividends
    .filter((d) => !d.reinvested)
    .reduce(
      (s, d) => s + convertCurrency(d.amount, d.currency, baseCurrency, fx),
      0
  );

  const portfolioCostBase = holdings.reduce(
    (s, h) => s + convertCurrency(h.cost_basis, h.cost_currency, baseCurrency, fx),
    0
  );

  const portfolioGainBase = portfolioMarketValueBase - portfolioCostBase;

  const portfolioDayChangeBase = holdings.reduce((sum, h) => {
    const sym = h.symbol.toUpperCase();
    if (sym === "CASH" || sym === "CASHCAD") return sum;
    const quote = stockQuotes[sym];
    const rawCur = quote?.currency ?? "USD";
    const quoteCurrency: CurrencyCode =
      rawCur === "CAD" || rawCur === "USD" || rawCur === "EGP" ? rawCur : "USD";
    const dayChange = h.shares * (quote?.change ?? 0);
    return sum + convertCurrency(dayChange, quoteCurrency, baseCurrency, fx);
  }, 0);

  const topHoldings = (() => {
    const grouped: Record<string, { sym: string; value: number; quote: (typeof stockQuotes)[string] | undefined }> = {};
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const quote = stockQuotes[sym];
      const rawCur = sym === "CASH" ? "USD" : sym === "CASHCAD" ? "CAD" : (quote?.currency ?? "USD");
      const quoteCurrency: CurrencyCode =
        rawCur === "CAD" || rawCur === "USD" || rawCur === "EGP" ? rawCur : "USD";
      const price = sym === "CASH" || sym === "CASHCAD" ? 1 : (quote?.price ?? 0);
      const valueBase = h.shares * convertCurrency(price, quoteCurrency, baseCurrency, fx);
      if (grouped[sym]) {
        grouped[sym].value += valueBase;
      } else {
        grouped[sym] = { sym, value: valueBase, quote };
      }
    }
    return Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  })();


  const today = nowEST();
  const { from, to } = getMonthRange(today);

  // Recurring transactions (deduplicated) — exclude anything managed by the subscriptions feature
  const recurringItems = useMemo(() => {
    const recurring = transactions.filter(t =>
      t.is_recurring
      && (t.type === "expense" || t.type === "income")
      && !(t.notes && t.notes.includes("Subscription payment"))
    );
    const groups = new Map<string, typeof recurring>();
    for (const tx of recurring) {
      const key = `${tx.type}|${tx.category || ""}|${tx.merchant || ""}|${tx.account_id || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    const todayStr = todayEST();
    const getPeriodStart = (freq: string | null): string => {
      const d = new Date(todayStr + "T00:00:00");
      if (freq === "weekly") {
        d.setDate(d.getDate() - d.getDay());
      } else if (freq === "bi-weekly") {
        d.setDate(d.getDate() - 13);
      } else if (freq === "yearly") {
        d.setMonth(0, 1);
      } else {
        // monthly default
        d.setDate(1);
      }
      return d.toISOString().slice(0, 10);
    };

    return Array.from(groups.values()).map(txs => {
      txs.sort((a, b) => b.date.localeCompare(a.date));
      const latest = txs[0];
      const periodStart = getPeriodStart(latest.recurrence);
      const loggedThisPeriod = txs.some(t => t.date >= periodStart && t.date <= todayStr);
      return { ...latest, loggedThisPeriod, occurrences: txs.length };
    }).sort((a, b) => a.type.localeCompare(b.type) || b.amount - a.amount);
  }, [transactions]);

  // AI: Spending anomaly detection
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const spendingAnomalies = useMemo(
    () => detectSpendingAnomalies(
      transactions,
      (amount, currency) => convertCurrency(amount, currency as CurrencyCode, baseCurrency, fx)
    ),
    [transactions, baseCurrency, fx]
  );
  const visibleAnomalies = useMemo(
    () => spendingAnomalies.filter((a) => !dismissedAnomalies.has(a.category)),
    [spendingAnomalies, dismissedAnomalies]
  );

  // AI: Cash flow forecast (cashTotalBase computed below, so use 0 as placeholder while loading)
  const cashForecastInput = useMemo(() => {
    if (!settings || transactions.length === 0) return null;
    const cashTotal = accounts
      .filter((a) => a.type === "checking")
      .reduce((sum, a) => sum + (balances[a.id] || 0), 0);
    return { transactions, subscriptions, settings, cashTotal };
  }, [transactions, subscriptions, settings, accounts, balances]);

  const cashForecast = useMemo<CashFlowForecast | null>(() => {
    if (!cashForecastInput) return null;
    return forecastCashFlow(
      cashForecastInput.transactions,
      cashForecastInput.subscriptions,
      cashForecastInput.settings,
      cashForecastInput.cashTotal,
      90
    );
  }, [cashForecastInput]);

  if (loading || !fxReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  // Compute summary values
  const cashTotalBase = accounts
    .filter((a) => a.type === "checking")
    .reduce((sum, a) => sum + convertCurrency(balances[a.id] || 0, a.currency, baseCurrency, fx), 0);

  const investingCashAddedBase = accounts
    .filter((a) => a.type === "investing")
    .reduce((sum, a) => sum + convertCurrency(balances[a.id] || 0, a.currency, baseCurrency, fx), 0);

  const investTotalBase = portfolioMarketValueBase + totalDividendsBase;

  const netWorthBase = cashTotalBase + investTotalBase;

  // This month
  const monthTxs = transactions.filter(
    (t) => t.date >= from && t.date <= to
  );
  const monthIncomeBase = monthTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx), 0);
  const monthExpensesBase = monthTxs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx), 0);
  const monthSavingsBase = monthIncomeBase - monthExpensesBase;
  const monthSavingsRate = savingsRate(monthIncomeBase, monthExpensesBase);
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const { from: previousFrom, to: previousTo } = getMonthRange(previousMonth);
  const previousMonthTxs = transactions.filter((t) => t.date >= previousFrom && t.date <= previousTo);
  const previousMonthIncomeBase = previousMonthTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx), 0);
  const previousMonthExpensesBase = previousMonthTxs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx), 0);
  const previousMonthSavingsRate = savingsRate(previousMonthIncomeBase, previousMonthExpensesBase);
  const savingsRateDelta =
    monthSavingsRate !== null && previousMonthSavingsRate !== null
      ? monthSavingsRate - previousMonthSavingsRate
      : null;

  const displayName = settings?.display_name?.trim() || "Amir";

  const currentHour = today.getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const rentReminderDays = Math.min(30, Math.max(0, settings?.rent_reminder_days ?? 7));
  const billReminderDays = Math.min(30, Math.max(0, settings?.bill_reminder_days ?? 3));
  const dueSoonSubscriptions = subscriptions
    .filter((sub) => sub.is_active)
    .map((sub) => {
      const dueDate = new Date(sub.next_billing + "T00:00:00");
      const dueDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { sub, dueDate, dueDays };
    })
    .filter(({ dueDays }) => dueDays >= 0 && dueDays <= billReminderDays)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const dueSoonBillsCount = dueSoonSubscriptions.length;

  // Rent reminder
  const rentDay = settings?.rent_day ?? 28;
  const rentAmount = settings?.rent_amount ?? 2100;
  const nextRentDate = (() => {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), rentDay);
    if (thisMonth > today) {
      return thisMonth;
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, rentDay);
  })();
  const daysUntilRent = Math.max(
    0,
    Math.ceil((nextRentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
  const rentPaidThisMonth = monthTxs.some(
    (t) => t.type === "expense" && t.category?.toLowerCase() === "rent"
  );
  const isRentDueSoon = daysUntilRent <= rentReminderDays && !rentPaidThisMonth;
  const budgetAmount = settings?.monthly_essentials_budget ?? 0;
  const isOverBudget = budgetAmount > 0 && monthExpensesBase > budgetAmount;

  const hasBillsDueSoon = isRentDueSoon || dueSoonBillsCount > 0;
  const greetingMode = isOverBudget ? "over_budget" : hasBillsDueSoon ? "bills_due" : "stable";

  const greetingTheme =
    greetingMode === "over_budget"
      ? {
          card: "border-rose-500/35 bg-bg-secondary/95",
          wash: "bg-gradient-to-r from-rose-500/14 via-red-500/10 to-transparent dark:from-rose-500/28 dark:via-red-500/18 dark:to-transparent",
          glowA: "bg-rose-500/12 dark:bg-rose-500/24",
          glowB: "bg-red-500/8 dark:bg-red-500/18",
          accent: "text-rose-700 dark:text-rose-200",
          chip: "border-rose-500/35 bg-rose-500/10 text-rose-800 dark:bg-rose-500/22 dark:text-rose-100",
        }
      : greetingMode === "bills_due"
        ? {
            card: "border-amber-500/35 bg-bg-secondary/95",
            wash: "bg-gradient-to-r from-amber-400/14 via-orange-400/8 to-transparent dark:from-amber-500/24 dark:via-orange-500/16 dark:to-transparent",
            glowA: "bg-amber-500/12 dark:bg-amber-500/22",
            glowB: "bg-orange-500/10 dark:bg-orange-500/18",
            accent: "text-amber-700 dark:text-amber-200",
            chip: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
          }
        : {
            card: "border-accent-blue/35 bg-bg-secondary/95",
            wash: "bg-gradient-to-r from-accent-blue/16 via-accent-purple/10 to-transparent dark:from-accent-blue/24 dark:via-accent-purple/18 dark:to-transparent",
            glowA: "bg-accent-blue/12 dark:bg-accent-blue/22",
            glowB: "bg-accent-purple/10 dark:bg-accent-purple/20",
            accent: "text-accent-blue",
            chip: "border-accent-blue/35 bg-accent-blue/10 text-text-primary dark:bg-accent-blue/18 dark:text-blue-100",
          };

  const formatRelativeDay = (days: number) => {
    if (days <= 0) return "today";
    if (days === 1) return "in 1 day";
    return `in ${days} days`;
  };

  const fallbackToneLine = () => {
    if (monthSavingsRate === null) {
      return "Add income this month so we can track your savings momentum.";
    }
    if (savingsRateDelta === null) {
      return `You're saving ${monthSavingsRate.toFixed(0)}% this month.`;
    }
    const direction = savingsRateDelta >= 0 ? "up" : "down";
    const absDelta = Math.abs(savingsRateDelta).toFixed(0);
    return `You're saving ${monthSavingsRate.toFixed(0)}% this month, ${direction} ${absDelta}% from last month.`;
  };

  const getNextPaycheckDate = () => {
    const freq = settings?.paycheck_frequency ?? "bi-weekly";
    const paycheckTxs = transactions
      .filter((tx) => tx.type === "income" && (tx.category || "") === "Paycheck")
      .sort((a, b) => b.date.localeCompare(a.date));
    if (paycheckTxs.length === 0) return null;

    const next = new Date(paycheckTxs[0].date + "T00:00:00");
    const addStep = () => {
      if (freq === "weekly") next.setDate(next.getDate() + 7);
      else if (freq === "bi-weekly") next.setDate(next.getDate() + 14);
      else next.setMonth(next.getMonth() + 1);
    };

    while (next < today) addStep();
    return next;
  };

  const nextPaycheckDate = getNextPaycheckDate();
  const daysUntilPaycheck = nextPaycheckDate
    ? Math.ceil((nextPaycheckDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const timelineChips: string[] = [];
  for (const { sub, dueDays } of dueSoonSubscriptions.slice(0, 3)) {
    timelineChips.push(`${sub.name} ${formatRelativeDay(dueDays)}`);
  }
  if (daysUntilPaycheck !== null && daysUntilPaycheck >= 0 && daysUntilPaycheck <= 3) {
    timelineChips.push(`Paycheck ${formatRelativeDay(daysUntilPaycheck)}`);
  }
  if (timelineChips.length === 0) {
    timelineChips.push(`No bills due in the next ${billReminderDays} day${billReminderDays !== 1 ? "s" : ""}`);
  }

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your personal finance overview" />
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Welcome to your Finance Dashboard"
          description="It looks like your data hasn't been set up yet. This usually means the seed data is still loading. Try refreshing the page."
          action={
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:-translate-y-0.5 transition shadow-glow"
            >
              Refresh
            </button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your personal finance overview"
        action={
          <div className="flex items-center gap-2">
            {demoMode && <TakeTourButton />}
            <Link
              href={`${appBase}/income` as any}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" /> Add Income
            </Link>
            <Link
              href={`${appBase}/expenses` as any}
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent-blue"
            >
              <Plus className="h-4 w-4" /> Add Expense
            </Link>
          </div>
        }
      />

      <div data-tour="greeting" className={`relative mt-3 mb-6 overflow-hidden rounded-2xl border p-5 sm:p-6 ${greetingTheme.card}`}>
        <div className={`pointer-events-none absolute inset-0 ${greetingTheme.wash}`} />
        <div className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl ${greetingTheme.glowA}`} />
        <div className={`pointer-events-none absolute -left-8 -bottom-12 h-32 w-32 rounded-full blur-3xl ${greetingTheme.glowB}`} />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-secondary">{todayLabel}</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {greeting}, <span className={greetingTheme.accent}>{displayName}</span>.
            </p>
            <p className="mt-1.5 text-sm text-text-secondary">
              {aiGreetingLoading ? (
                <span className="inline-flex items-center gap-1.5 text-text-secondary/60">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                </span>
              ) : (
                aiGreeting ?? fallbackToneLine()
              )}
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Today timeline
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {timelineChips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${greetingTheme.chip}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          {isRentDueSoon && (
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/18 dark:text-amber-100 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-300" />
              {`Rent ${formatRelativeDay(daysUntilRent)}`}
            </div>
          )}
        </div>
      </div>

      {/* Spending anomaly alerts */}
      {visibleAnomalies.length > 0 && (
        <div className="mb-4 space-y-2">
          {visibleAnomalies.map((a) => (
            <div
              key={a.category}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                a.severity === "alert"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
              }`}
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">
                <strong>{a.category}</strong> spending is{" "}
                <strong>{a.ratio}x</strong> your 3-month average
                {showBalances ? ` (${formatMoney(a.currentMonthSpend, baseCurrency)} vs avg ${formatMoney(a.averageSpend, baseCurrency)})` : ""}
              </span>
              <button
                onClick={() => setDismissedAnomalies((prev) => new Set([...prev, a.category]))}
                className="rounded-lg p-2 opacity-60 transition hover:opacity-100"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Insights card */}
      {(aiInsights || aiInsightsLoading) && (
        <div data-tour="ai-insights" className="mb-4 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5 animate-in fade-in duration-500">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent-purple" />
              <h3 className="text-sm font-semibold text-text-primary">AI Insights</h3>
            </div>
            {(aiInsights || aiInsightsLoading) && (
              <button
                onClick={() => fetchAiInsights(true)}
                disabled={aiInsightsLoading}
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/10 disabled:opacity-40"
              >
                {aiInsightsLoading ? "Analyzing…" : "Refresh"}
              </button>
            )}
          </div>
          {aiInsights ? (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary whitespace-pre-line">
              {aiInsights.split(/(\$?\d[\d,]*\.?\d*%?|\bCA\$[\d,]+\.?\d*|\b\d+%)/g).map((part, i) =>
                /^\$?\d[\d,]*\.?\d*%?$|^CA\$[\d,]+\.?\d*$|^\d+%$/.test(part)
                  ? <span key={i} className="font-semibold text-text-primary">{part}</span>
                  : part
              )}
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-purple/70" />
                <span className="text-xs font-medium text-accent-purple/80">Loading insights…</span>
              </div>
              <div className="h-3 w-[90%] animate-pulse rounded-full bg-accent-purple/20" />
              <div className="h-3 w-[75%] animate-pulse rounded-full bg-accent-purple/20" />
              <div className="h-3 w-[60%] animate-pulse rounded-full bg-accent-purple/20" />
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div data-tour="summary-stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Cash"
          value={m(cashTotalBase)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Portfolio Snapshot"
          value={m(portfolioMarketValueBase)}
          subtitle={showBalances ? `Cash added: ${formatMoney(investingCashAddedBase, baseCurrency)}` : `Cash added: ${HIDDEN_BALANCE}`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Net Worth"
          value={m(netWorthBase)}
          icon={<DollarSign className="h-5 w-5" />}
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>

      {/* This month */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Income (this month)"
          value={m(monthIncomeBase)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Expenses (this month)"
          value={m(monthExpensesBase)}
          icon={<ArrowDownUp className="h-5 w-5" />}
        />
        <StatCard
          title="Savings (this month)"
          value={m(monthSavingsBase)}
          subtitle={
            showBalances && monthIncomeBase > 0
              ? `${((monthSavingsBase / monthIncomeBase) * 100).toFixed(0)}% savings rate`
              : undefined
          }
          icon={<PiggyBank className="h-5 w-5" />}
        />
      </div>

      {/* Rent reminder */}
      {isRentDueSoon && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Rent due in {daysUntilRent} day{daysUntilRent !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-text-secondary">
              {m(rentAmount)} due on{" "}
              {nextRentDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Budget vs Actual */}
      {(() => {
        if (budgetAmount <= 0) return null;
        const budgetPct = budgetAmount > 0 ? (monthExpensesBase / budgetAmount) * 100 : 0;
        const isNearBudget = budgetPct >= 80 && !isOverBudget;
        // Category breakdown for this month's expenses
        const catMap: Record<string, number> = {};
        for (const tx of monthTxs.filter((t) => t.type === "expense")) {
          const cat = tx.category || "Other";
          catMap[cat] = (catMap[cat] || 0) + convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
        }
        const catBreakdown = Object.entries(catMap)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amount]) => ({ name, amount }));
        const BUDGET_CAT_COLORS: Record<string, string> = {
          Food: "bg-orange-500", Transport: "bg-blue-500", Bills: "bg-purple-500",
          Rent: "bg-red-500", Fun: "bg-pink-500", Health: "bg-emerald-500", "Personal Care": "bg-fuchsia-500", Other: "bg-gray-500",
        };
        return (
          <div className="mt-8 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-text-secondary" />
                <h2 className="text-lg font-semibold text-text-primary">Monthly Budget</h2>
              </div>
              <span className="text-xs text-text-secondary">
                {showBalances ? `${formatMoney(monthExpensesBase, baseCurrency)} / ${formatMoney(budgetAmount, baseCurrency)}` : HIDDEN_BALANCE}
              </span>
            </div>
            <ProgressBar
              value={monthExpensesBase}
              max={budgetAmount}
              color={isOverBudget ? "bg-red-500" : isNearBudget ? "bg-yellow-500" : "bg-emerald-500"}
            />
            {isOverBudget && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Over budget by {m(monthExpensesBase - budgetAmount)}
              </p>
            )}
            {isNearBudget && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {m(budgetAmount - monthExpensesBase)} remaining — approaching limit
              </p>
            )}
            {catBreakdown.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {catBreakdown.map(({ name, amount }) => (
                  <div key={name} className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1">
                    <div className={`h-2 w-2 rounded-full ${BUDGET_CAT_COLORS[name] || "bg-gray-500"}`} />
                    <span className="text-[10px] text-text-secondary">{name}</span>
                    <span className="text-[10px] font-semibold text-text-primary">{m(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}


      {/* Recurring Transactions */}
      {recurringItems.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-accent-purple" />
              <h2 className="text-lg font-semibold text-text-primary">Recurring Transactions</h2>
            </div>
            <span className="text-[10px] text-text-secondary">
              {recurringItems.filter(i => i.loggedThisPeriod).length}/{recurringItems.length} logged this period
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recurringItems.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.type === "income" ? "bg-emerald-500" : ({ Food: "bg-orange-500", Transport: "bg-blue-500", Bills: "bg-purple-500", Rent: "bg-red-500", Fun: "bg-pink-500", Health: "bg-emerald-500", "Personal Care": "bg-fuchsia-500" }[item.category || ""] || "bg-gray-500")}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {item.merchant || item.category || "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${item.type === "income" ? "text-emerald-400" : "text-text-secondary"}`}>{item.type === "income" ? "Income" : "Expense"}</span>
                      {item.recurrence && (
                        <span className="rounded bg-accent-purple/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-purple brightness-125">
                          {item.recurrence}
                        </span>
                      )}
                      {item.loggedThisPeriod && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          ✓ logged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${item.type === "income" ? "text-emerald-400" : "text-text-primary"}`}>
                    {showBalances ? formatMoney(item.amount, item.currency) : HIDDEN_BALANCE}
                  </span>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        if (item.linked_charge_id) {
                          const charge = creditCardCharges.find((c) => c.id === item.linked_charge_id);
                          const card = charge ? creditCards.find((c) => c.id === charge.card_id) : null;
                          if (charge && card) {
                            await createLinkedCreditCardCharge(
                              { card_id: card.id, date: todayEST(), amount: charge.amount, merchant: charge.merchant, category: charge.category, notes: charge.notes },
                              { currency: card.currency, cardName: card.name, is_recurring: true, recurrence: item.recurrence }
                            );
                          }
                        } else {
                          await createTransaction({
                            type: item.type as "income" | "expense",
                            date: todayEST(),
                            amount: item.amount,
                            currency: item.currency,
                            category: item.category,
                            account_id: item.account_id,
                            merchant: item.merchant,
                            notes: null,
                            is_recurring: true,
                            recurrence: item.recurrence as RecurrenceFrequency | null,
                            from_account_id: null,
                            to_account_id: null,
                          });
                        }
                        await refresh();
                        toast.success("Transaction logged!");
                      } catch {
                        toast.error("Failed to log transaction");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    title="Log again today"
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-accent-purple/10 hover:text-accent-purple transition"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await updateTransaction(item.id, { is_recurring: false, recurrence: null });
                        await refresh();
                        toast.success("Removed from recurring");
                      } catch {
                        toast.error("Failed to update");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    title="Remove recurring flag"
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Goal progress */}
      {goals.length > 0 && (
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Goal Progress</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const currentAmt = getGoalCurrentInBase(goal.id);
            const target = goal.target_amount;
            return (
              <div
                key={goal.id}
                className="rounded-2xl border border-border-subtle bg-bg-secondary p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{goal.name}</p>
                  <p className="text-xs text-text-secondary">
                    {showBalances ? formatMoney(currentAmt, baseCurrency) : HIDDEN_BALANCE}
                    {target ? ` / ${showBalances ? formatMoney(target, baseCurrency) : HIDDEN_BALANCE}` : ""}
                  </p>
                </div>
                {target ? (
                  <ProgressBar
                    value={currentAmt}
                    max={target}
                    className="mt-3"
                    color={
                      currentAmt >= target
                        ? "bg-emerald-500"
                        : "bg-accent-purple"
                    }
                  />
                ) : (
                  <p className="mt-2 text-xs text-text-secondary">
                    No cap — {m(currentAmt)} invested
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Quick account balances */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Account Balances
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => {
            const bal = balances[acct.id] || 0;
            const isNative = acct.currency === baseCurrency;
            const convertedBal = isNative ? bal : convertCurrency(bal, acct.currency, baseCurrency, fx);
            return (
              <div
                key={acct.id}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      acct.type === "investing" ? "bg-emerald-400" : "bg-accent-blue"
                    }`}
                  />
                  <span className="text-sm text-text-primary">{acct.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-text-primary">
                    {showBalances ? formatMoney(bal, acct.currency) : HIDDEN_BALANCE}
                  </span>
                  {showBalances && !isNative && (
                    <p className="text-[10px] text-text-secondary">
                      ≈ {formatMoney(convertedBal, baseCurrency)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portfolio summary */}
      {holdings.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Portfolio</h2>
            <Link
              href={`${appBase}/stocks` as any}
              className="text-xs text-accent-blue hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Portfolio Value"
              value={m(portfolioMarketValueBase)}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <StatCard
              title="Total Gain/Loss"
              value={showBalances ? `${portfolioGainBase >= 0 ? "+" : ""}${formatMoney(portfolioGainBase, baseCurrency)}` : HIDDEN_BALANCE}
              subtitle={
                showBalances && portfolioCostBase > 0
                  ? `${portfolioGainBase >= 0 ? "+" : ""}${((portfolioGainBase / portfolioCostBase) * 100).toFixed(1)}%`
                  : undefined
              }
              icon={portfolioGainBase >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            />
            <StatCard
              title="Today's Change"
              value={showBalances ? `${portfolioDayChangeBase >= 0 ? "+" : ""}${formatMoney(portfolioDayChangeBase, baseCurrency)}` : HIDDEN_BALANCE}
              icon={<DollarSign className="h-5 w-5" />}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topHoldings.map((h) => (
              <div
                key={h.sym}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {h.sym}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">
                    {m(h.value)}
                  </p>
                  {showBalances && h.quote && (
                    <p
                      className={`text-[10px] font-medium ${
                        h.quote.changePercent >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {h.quote.changePercent >= 0 ? "+" : ""}
                      {h.quote.changePercent.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash flow forecast */}
      {cashForecast && (
        <div className="mt-8 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingUp className="h-4 w-4 text-accent-blue" />
            90-Day Cash Flow Forecast
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-text-secondary">Avg Monthly Income</p>
              <p className="text-lg font-bold text-emerald-500">{m(cashForecast.monthlyIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Avg Monthly Expenses</p>
              <p className="text-lg font-bold text-red-400">{m(cashForecast.monthlyExpenses)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Monthly Net</p>
              <p className={`text-lg font-bold ${cashForecast.monthlyNet >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {m(cashForecast.monthlyNet)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {cashForecast.points
              .filter((p) => p.label)
              .map((p) => (
                <div key={p.label} className="rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">{p.label}</p>
                  <p className={`text-sm font-bold ${p.balance >= 0 ? "text-text-primary" : "text-red-400"}`}>
                    {m(p.balance)}
                  </p>
                  <p className="text-[10px] text-text-secondary">{p.date}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div data-tour="charts" className="mt-8 grid gap-6 lg:grid-cols-2">
        <NetWorthChart transactions={transactions} accounts={accounts} baseCurrency={baseCurrency} fx={fx} />
        <ExpensesByCategoryChart transactions={transactions} baseCurrency={baseCurrency} fx={fx} />
        <IncomeVsExpensesChart transactions={transactions} baseCurrency={baseCurrency} fx={fx} />
        <GoalProgressChart
          goals={goals.map((g) => ({
            name: g.name,
            current: getGoalCurrentInBase(g.id),
            target: g.target_amount,
          }))}
          baseCurrency={baseCurrency}
        />
      </div>
    </>
  );
}
