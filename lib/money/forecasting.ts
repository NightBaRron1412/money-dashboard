import type {
  Transaction,
  Subscription,
  Settings,
  Goal,
  GoalAccount,
  Account,
  CurrencyCode,
} from "./database.types";
import { convertCurrency, type FxRates } from "./fx";

/* ------------------------------------------------------------------ */
/*  Cash Flow Forecasting                                              */
/* ------------------------------------------------------------------ */

export interface ForecastPoint {
  date: string; // YYYY-MM-DD
  balance: number;
  label?: string;
}

export interface CashFlowForecast {
  points: ForecastPoint[];
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
}

export function forecastCashFlow(
  transactions: Transaction[],
  subscriptions: Subscription[],
  settings: Settings,
  currentCashBalance: number,
  daysAhead = 90,
  fx?: FxRates,
  baseCurrency?: CurrencyCode
): CashFlowForecast {
  const toBase = (amount: number, currency: CurrencyCode): number => {
    if (!fx || !baseCurrency) return amount;
    return convertCurrency(amount, currency, baseCurrency, fx);
  };

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

  const recent = transactions.filter(
    (t) => t.date >= cutoff && t.type !== "transfer"
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of recent) {
    const amt = toBase(t.amount, t.currency);
    if (t.type === "income") totalIncome += amt;
    else if (t.type === "expense" && !t.exclude_from_monthly) totalExpenses += amt;
  }

  const months = Math.max(
    1,
    (now.getTime() - threeMonthsAgo.getTime()) / (30.44 * 86400000)
  );
  const monthlyIncome = totalIncome / months;
  const monthlyExpenses = totalExpenses / months;

  const activeSubs = subscriptions.filter((s) => s.is_active);
  let monthlySubCost = 0;
  for (const s of activeSubs) {
    const amtBase = toBase(s.amount, s.currency);
    switch (s.frequency) {
      case "weekly":
        monthlySubCost += amtBase * 4.33;
        break;
      case "bi-weekly":
        monthlySubCost += amtBase * 2.17;
        break;
      case "monthly":
        monthlySubCost += amtBase;
        break;
      case "yearly":
        monthlySubCost += amtBase / 12;
        break;
    }
  }

  const rentMonthly = settings.rent_amount || 0;
  const projectedMonthlyExpenses = Math.max(monthlyExpenses, monthlySubCost + rentMonthly);
  const dailyNet = (monthlyIncome - projectedMonthlyExpenses) / 30.44;

  const points: ForecastPoint[] = [];
  let bal = currentCashBalance;

  for (let d = 0; d <= daysAhead; d += (daysAhead <= 30 ? 1 : 7)) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    bal = currentCashBalance + dailyNet * d;
    points.push({
      date: date.toISOString().slice(0, 10),
      balance: Math.round(bal * 100) / 100,
      ...(d === 30 ? { label: "30d" } : d === 60 ? { label: "60d" } : d === 90 ? { label: "90d" } : {}),
    });
  }

  return {
    points,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlyExpenses: Math.round(projectedMonthlyExpenses * 100) / 100,
    monthlyNet: Math.round((monthlyIncome - projectedMonthlyExpenses) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/*  Goal Completion Prediction                                         */
/* ------------------------------------------------------------------ */

export interface GoalPrediction {
  goalId: string;
  goalName: string;
  currentAmount: number;
  targetAmount: number;
  monthlySavingsRate: number;
  monthsRemaining: number | null; // null = never at current rate
  predictedDate: string | null; // ISO date string
  onTrack: boolean;
}

export function predictGoalCompletion(
  goals: Goal[],
  goalAccounts: GoalAccount[],
  accounts: Account[],
  transactions: Transaction[],
  balances: Record<string, number>,
  fx?: FxRates,
  baseCurrency?: CurrencyCode
): GoalPrediction[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const toBase = (amount: number, currency: CurrencyCode): number => {
    if (!fx || !baseCurrency) return amount;
    return convertCurrency(amount, currency, baseCurrency, fx);
  };
  const accountToBase = (amount: number, accountId: string | null | undefined): number => {
    if (!accountId) return amount;
    const acct = accountById.get(accountId);
    if (!acct) return amount;
    return toBase(amount, acct.currency);
  };

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

  const recent = transactions.filter(
    (t) => t.date >= cutoff && t.type !== "transfer"
  );
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of recent) {
    const amt = toBase(t.amount, t.currency);
    if (t.type === "income") totalIncome += amt;
    else if (t.type === "expense" && !t.exclude_from_monthly) totalExpenses += amt;
  }

  const months = Math.max(
    1,
    (now.getTime() - threeMonthsAgo.getTime()) / (30.44 * 86400000)
  );
  const monthlySavings = (totalIncome - totalExpenses) / months;

  return goals.map((goal) => {
    const linkedGAs = goalAccounts.filter((ga) => ga.goal_id === goal.id);
    let currentAmount = 0;

    if (goal.linked_account_id) {
      currentAmount = accountToBase(balances[goal.linked_account_id] ?? 0, goal.linked_account_id);
    } else {
      for (const ga of linkedGAs) {
        currentAmount += accountToBase(ga.allocated_amount ?? 0, ga.account_id);
      }
    }

    const targetAmount = goal.target_amount ?? 0;
    const remaining = targetAmount - currentAmount;

    let monthsRemaining: number | null = null;
    let predictedDate: string | null = null;

    if (remaining <= 0) {
      monthsRemaining = 0;
      predictedDate = now.toISOString().slice(0, 10);
    } else if (monthlySavings > 0) {
      monthsRemaining = Math.ceil(remaining / monthlySavings);
      const predicted = new Date(now);
      predicted.setMonth(predicted.getMonth() + monthsRemaining);
      predictedDate = predicted.toISOString().slice(0, 10);
    }

    const onTrack =
      goal.target_date && predictedDate
        ? predictedDate <= goal.target_date
        : monthsRemaining !== null;

    return {
      goalId: goal.id,
      goalName: goal.name,
      currentAmount: Math.round(currentAmount * 100) / 100,
      targetAmount,
      monthlySavingsRate: Math.round(monthlySavings * 100) / 100,
      monthsRemaining,
      predictedDate,
      onTrack,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Spending Anomaly Detection                                         */
/* ------------------------------------------------------------------ */

export interface SpendingAnomaly {
  category: string;
  currentMonthSpend: number;
  averageSpend: number;
  ratio: number; // currentMonthSpend / averageSpend
  severity: "warning" | "alert";
}

export function detectSpendingAnomalies(
  transactions: Transaction[],
  toBase?: (amount: number, currency: string) => number
): SpendingAnomaly[] {
  const convert = toBase ?? ((a: number) => a);
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  const expenses = transactions.filter((t) => t.type === "expense" && t.category && !t.exclude_from_monthly);

  const currentMonthExpenses = expenses.filter(
    (t) => t.date.slice(0, 7) === currentMonth
  );
  const currentByCategory: Record<string, number> = {};
  for (const t of currentMonthExpenses) {
    currentByCategory[t.category!] =
      (currentByCategory[t.category!] ?? 0) + convert(t.amount, t.currency);
  }

  // Pin to day-1 before subtracting months — otherwise dates like May 29
  // try to roll back to Feb 29, which JS silently shifts to Mar 1, skipping
  // Feb entirely and double-counting March in the average window.
  const prevMonths: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    prevMonths.push(d.toISOString().slice(0, 7));
  }

  const prevExpenses = expenses.filter((t) =>
    prevMonths.includes(t.date.slice(0, 7))
  );
  // Track sum AND set of distinct months that contributed per category, so
  // sparse categories (rent paid late, quarterly insurance, etc.) average
  // against their actual occurrence count instead of always-3.
  const prevByCategory: Record<string, number> = {};
  const monthsWithCategory: Record<string, Set<string>> = {};
  for (const t of prevExpenses) {
    const cat = t.category!;
    prevByCategory[cat] = (prevByCategory[cat] ?? 0) + convert(t.amount, t.currency);
    if (!monthsWithCategory[cat]) monthsWithCategory[cat] = new Set();
    monthsWithCategory[cat].add(t.date.slice(0, 7));
  }

  const anomalies: SpendingAnomaly[] = [];

  for (const [category, currentSpend] of Object.entries(currentByCategory)) {
    const occurrences = monthsWithCategory[category]?.size ?? 0;
    if (occurrences === 0) continue; // no prior data, can't compare
    const avgSpend = (prevByCategory[category] ?? 0) / occurrences;
    if (avgSpend < 10) continue; // ignore tiny categories

    const ratio = currentSpend / avgSpend;
    if (ratio >= 2) {
      anomalies.push({
        category,
        currentMonthSpend: Math.round(currentSpend * 100) / 100,
        averageSpend: Math.round(avgSpend * 100) / 100,
        ratio: Math.round(ratio * 10) / 10,
        severity: "alert",
      });
    } else if (ratio >= 1.5) {
      anomalies.push({
        category,
        currentMonthSpend: Math.round(currentSpend * 100) / 100,
        averageSpend: Math.round(avgSpend * 100) / 100,
        ratio: Math.round(ratio * 10) / 10,
        severity: "warning",
      });
    }
  }

  return anomalies.sort((a, b) => b.ratio - a.ratio);
}
