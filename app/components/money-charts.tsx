"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { Transaction, Account, CurrencyCode, Holding, Dividend } from "@/lib/money/database.types";
import { computeAccountBalance } from "@/lib/money/queries";
import type { FxRates } from "@/lib/money/fx";
import { getCategoryColorHex } from "./money-ui";
import { convertCurrency } from "@/lib/money/fx";
import {
  format,
  parseISO,
  startOfMonth,
  eachMonthOfInterval,
  subMonths,
} from "date-fns";
import { formatMoney, formatMoneyCompact, nowEST } from "./money-ui";
import { useBalanceVisibility } from "../balance-visibility-provider";

const HIDDEN = "••••••";

const COLORS = [
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#f472b6",
  "#818cf8",
  "#2dd4bf",
  "#fb923c",
  "#38bdf8",
];


const CHART_AXIS_COLOR = "var(--text-secondary)";
const CHART_GRID_COLOR = "color-mix(in srgb, var(--text-secondary) 28%, transparent)";
const CHART_TOOLTIP_BG = "var(--card-bg, var(--bg-secondary))";
const CHART_TOOLTIP_BORDER = "1px solid var(--border-subtle)";
const CHART_TOOLTIP_SHADOW = "0 8px 24px -4px rgba(0,0,0,0.25)";
const CHART_TOOLTIP_TEXT = "var(--text-primary)";
const CHART_TOOLTIP_LABEL = "var(--text-secondary)";
const CHART_CURSOR = "var(--bg-elevated)";

interface StockQuote {
  price: number;
  currency: string;
}

interface ChartsProps {
  transactions: Transaction[];
  accounts: Account[];
  baseCurrency: CurrencyCode;
  fx: FxRates;
  /** Today's actual per-account balances (already adjusted for CC payments, corrections, etc.). */
  balances: Record<string, number>;
  /** Current holdings — used to approximate per-month portfolio value (current price × shares held at that date, based on created_at). */
  holdings?: Holding[];
  /** Cash dividends received (filtered by date for historical inclusion). */
  dividends?: Dividend[];
  /** Current stock quotes, keyed by uppercase symbol. */
  stockQuotes?: Record<string, StockQuote>;
}

/* ------------------------------------------------------------------ */
/*  Net Worth Over Time                                               */
/* ------------------------------------------------------------------ */
export function NetWorthChart({ transactions, accounts, baseCurrency, fx, balances, holdings, dividends, stockQuotes }: ChartsProps) {
  const { showBalances } = useBalanceVisibility();
  const data = useMemo(() => {
    if (accounts.length === 0) return [];

    const end = startOfMonth(nowEST());
    const minWindowStart = startOfMonth(subMonths(end, 5)); // Always show at least 6 months.
    const dates = transactions.map((t) => t.date).sort();
    const firstTxMonth =
      dates.length > 0 ? startOfMonth(parseISO(dates[0])) : null;
    const start =
      firstTxMonth && firstTxMonth < minWindowStart
        ? firstTxMonth
        : minWindowStart;
    const months = eachMonthOfInterval({ start, end });

    // Walk backward from today's actual balance: at each cutoff, undo the
    // net effect of transactions that happened after that month. Anchoring
    // to `balances` keeps today's chart point consistent with the dashboard
    // widget (which correctly accounts for CC payments, corrections, etc.).
    return months.map((month) => {
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const cutoffEnd = format(endOfMonth, "yyyy-MM-dd");

      let total = 0;
      // Cash component: checking accounts only (matches the dashboard's net-worth
      // formula, which counts investing-account cash via holdings, not as cash).
      for (const acct of accounts) {
        if (acct.type !== "checking") continue;
        const currentBal = balances[acct.id] ?? 0;
        let netChangeAfterCutoff = 0;
        for (const tx of transactions) {
          if (tx.date <= cutoffEnd) continue;
          if (tx.type === "income" && tx.account_id === acct.id) {
            netChangeAfterCutoff += tx.amount;
          } else if (tx.type === "expense" && tx.account_id === acct.id) {
            netChangeAfterCutoff -= tx.amount;
          } else if (tx.type === "transfer") {
            if (tx.from_account_id === acct.id) netChangeAfterCutoff -= tx.amount;
            if (tx.to_account_id === acct.id) netChangeAfterCutoff += (tx.received_amount ?? tx.amount);
          } else if (tx.type === "correction") {
            if (tx.to_account_id === acct.id) netChangeAfterCutoff += tx.amount;
            if (tx.from_account_id === acct.id) netChangeAfterCutoff -= tx.amount;
          }
        }
        const historicalBal = currentBal - netChangeAfterCutoff;
        total += convertCurrency(historicalBal, acct.currency, baseCurrency, fx);
      }

      // Holdings: include positions whose row existed on or before the cutoff
      // (created_at is the best proxy we have for "when this position started").
      // Uses current per-share price for all months, so the curve reflects
      // accumulated positions priced consistently rather than fake historical prices.
      if (holdings && stockQuotes) {
        for (const h of holdings) {
          if (h.created_at.slice(0, 10) > cutoffEnd) continue;
          const sym = h.symbol.toUpperCase();
          const quote = stockQuotes[sym];
          const rawCur = sym === "CASH" ? "USD" : sym === "CASHCAD" ? "CAD" : (quote?.currency ?? "USD");
          const quoteCurrency: CurrencyCode =
            rawCur === "CAD" || rawCur === "USD" || rawCur === "EGP" ? rawCur : "USD";
          const price = sym === "CASH" || sym === "CASHCAD" ? 1 : (quote?.price ?? 0);
          total += h.shares * convertCurrency(price, quoteCurrency, baseCurrency, fx);
        }
      }

      // Cash dividends actually received by the cutoff date
      if (dividends) {
        for (const d of dividends) {
          if (d.reinvested) continue;
          if (d.date > cutoffEnd) continue;
          total += convertCurrency(d.amount, d.currency, baseCurrency, fx);
        }
      }

      return {
        month: format(month, "MMM yy"),
        netWorth: Math.round(total),
      };
    });
  }, [transactions, accounts, baseCurrency, fx, balances, holdings, dividends, stockQuotes]);

  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ChartCard title="Net Worth Over Time">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
            tickFormatter={(v) => showBalances ? formatMoneyCompact(Number(v ?? 0), baseCurrency) : HIDDEN}
          />
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: CHART_TOOLTIP_BORDER,
              borderRadius: 12,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
              boxShadow: CHART_TOOLTIP_SHADOW,
              backdropFilter: "blur(8px)",
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
            labelStyle={{ color: CHART_TOOLTIP_LABEL }}
            cursor={{ fill: CHART_CURSOR }}
            formatter={(value) => [showBalances ? formatMoney(Number(value ?? 0), baseCurrency) : HIDDEN, "Net Worth"]}
          />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: "#8b5cf6", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Expenses By Category (Pie)                                        */
/* ------------------------------------------------------------------ */
export function ExpensesByCategoryChart({
  transactions,
  baseCurrency,
  fx,
}: {
  transactions: Transaction[];
  baseCurrency: CurrencyCode;
  fx: FxRates;
}) {
  const { showBalances } = useBalanceVisibility();
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions.filter((t) => t.type === "expense")) {
      const cat = tx.category || "Other";
      map[cat] = (map[cat] || 0) + convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, baseCurrency, fx]);

  if (data.length === 0) return <EmptyChart label="No expenses yet" />;

  return (
    <ChartCard title="Expenses by Category">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            label={({ name, percent }) =>
              showBalances ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : `${name}`
            }
            labelLine={false}
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.name}
                fill={getCategoryColorHex(entry.name)}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: CHART_TOOLTIP_BORDER,
              borderRadius: 12,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
              boxShadow: CHART_TOOLTIP_SHADOW,
              backdropFilter: "blur(8px)",
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
            labelStyle={{ color: CHART_TOOLTIP_LABEL }}
            cursor={{ fill: CHART_CURSOR }}
            formatter={(value) => [showBalances ? formatMoney(Number(value ?? 0), baseCurrency) : HIDDEN, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Income vs Expenses per Month                                      */
/* ------------------------------------------------------------------ */
export function IncomeVsExpensesChart({
  transactions,
  baseCurrency,
  fx,
}: {
  transactions: Transaction[];
  baseCurrency: CurrencyCode;
  fx: FxRates;
}) {
  const { showBalances } = useBalanceVisibility();
  const data = useMemo(() => {
    if (transactions.length === 0) return [];
    const map: Record<string, { income: number; expenses: number }> = {};
    for (const tx of transactions) {
      if (tx.type === "transfer") continue;
      const key = tx.date.slice(0, 7);
      if (!map[key]) map[key] = { income: 0, expenses: 0 };
      const amt = convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
      if (tx.type === "income") map[key].income += amt;
      if (tx.type === "expense") map[key].expenses += amt;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month: format(parseISO(`${month}-01`), "MMM yy"),
        income: Math.round(values.income),
        expenses: Math.round(values.expenses),
      }));
  }, [transactions, baseCurrency, fx]);

  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ChartCard title="Income vs Expenses">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
            tickFormatter={(v) => showBalances ? formatMoneyCompact(Number(v ?? 0), baseCurrency) : HIDDEN}
          />
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: CHART_TOOLTIP_BORDER,
              borderRadius: 12,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
              boxShadow: CHART_TOOLTIP_SHADOW,
              backdropFilter: "blur(8px)",
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
            labelStyle={{ color: CHART_TOOLTIP_LABEL }}
            cursor={{ fill: CHART_CURSOR }}
            formatter={(value) => showBalances ? formatMoney(Number(value ?? 0), baseCurrency) : HIDDEN}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_AXIS_COLOR }} />
          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
          <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Goal Progress Bar Chart                                           */
/* ------------------------------------------------------------------ */
interface GoalChartProps {
  goals: { name: string; current: number; target: number | null }[];
  baseCurrency: CurrencyCode;
}

export function GoalProgressChart({ goals, baseCurrency }: GoalChartProps) {
  const { showBalances } = useBalanceVisibility();
  const data = goals
    .filter((g) => g.target !== null)
    .map((g) => ({
      name: g.name,
      current: Math.round(g.current),
      target: Math.round(g.target!),
      pct: g.target! > 0 ? Math.round((g.current / g.target!) * 100) : 0,
    }));

  if (data.length === 0) return <EmptyChart label="No goals with targets" />;

  return (
    <ChartCard title="Goal Progress">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
            tickFormatter={(v) => showBalances ? formatMoneyCompact(Number(v ?? 0), baseCurrency) : HIDDEN}
          />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} width={100} />
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: CHART_TOOLTIP_BORDER,
              borderRadius: 12,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
              boxShadow: CHART_TOOLTIP_SHADOW,
              backdropFilter: "blur(8px)",
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
            labelStyle={{ color: CHART_TOOLTIP_LABEL }}
            cursor={{ fill: CHART_CURSOR }}
            formatter={(value, name) => [
              showBalances ? formatMoney(Number(value ?? 0), baseCurrency) : HIDDEN,
              name === "current" ? "Current" : "Target",
            ]}
          />
          <Bar dataKey="target" fill="var(--bg-elevated)" radius={[0, 4, 4, 0]} name="Target" />
          <Bar dataKey="current" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Current" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-bg-secondary/50">
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}
