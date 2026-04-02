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
import type { Transaction, Account, CurrencyCode } from "@/lib/money/database.types";
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

interface ChartsProps {
  transactions: Transaction[];
  accounts: Account[];
  baseCurrency: CurrencyCode;
  fx: FxRates;
}

/* ------------------------------------------------------------------ */
/*  Net Worth Over Time                                               */
/* ------------------------------------------------------------------ */
export function NetWorthChart({ transactions, accounts, baseCurrency, fx }: ChartsProps) {
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

    return months.map((month) => {
      const cutoff = format(month, "yyyy-MM-dd");
      // Only count transactions up to the end of this month
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const cutoffEnd = format(endOfMonth, "yyyy-MM-dd");
      const txsUpTo = transactions.filter((t) => t.date <= cutoffEnd);

      let total = 0;
      for (const acct of accounts) {
        const bal = computeAccountBalance(acct.id, txsUpTo, acct.starting_balance ?? 0);
        total += convertCurrency(bal, acct.currency, baseCurrency, fx);
      }

      return {
        month: format(month, "MMM yy"),
        netWorth: Math.round(total),
      };
    });
  }, [transactions, accounts, baseCurrency, fx]);

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
