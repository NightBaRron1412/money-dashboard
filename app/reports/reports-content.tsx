"use client";

import { useState, useMemo } from "react";
import { useMoneyData } from "../hooks/use-money-data";
import { useMoneyFx } from "../hooks/use-money-fx";
import {
  PageHeader,
  StatCard,
  formatMoney,
  formatMoneyCompact,
  HIDDEN_BALANCE,
  EmptyState,
  nowEST,
} from "../components/money-ui";
import {
  BarChart3,
  TrendingUp,
  PiggyBank,
  Loader2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useBalanceVisibility } from "../balance-visibility-provider";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { CurrencyCode } from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";

const CHART_TOOLTIP_STYLE = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text-primary)",
};
const CHART_AXIS_COLOR = "var(--text-secondary)";
const CHART_GRID_COLOR = "color-mix(in srgb, var(--text-secondary) 28%, transparent)";
const CHART_CURSOR = "var(--bg-elevated)";
const HIDDEN = "••••••";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type View = "month" | "year" | "all";

export function ReportsContent() {
  const { transactions, settings, loading } = useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => (showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE);

  const today = nowEST();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  const [view, setView] = useState<View>("year");
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(
    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
  );

  /* ---------------------------------------------------------------- */
  /*  Available years & months                                        */
  /* ---------------------------------------------------------------- */
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) set.add(tx.date.slice(0, 4));
    if (!set.has(currentYear.toString())) set.add(currentYear.toString());
    return Array.from(set).sort().reverse();
  }, [transactions, currentYear]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) set.add(tx.date.slice(0, 7));
    if (!set.has(selectedMonth)) set.add(selectedMonth);
    return Array.from(set).sort().reverse();
  }, [transactions, selectedMonth]);

  /* ---------------------------------------------------------------- */
  /*  Filtered transactions                                           */
  /* ---------------------------------------------------------------- */
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.type === "transfer") return false;
      if (view === "month") return tx.date.startsWith(selectedMonth);
      if (view === "year") return tx.date.startsWith(selectedYear);
      return true; // all time
    });
  }, [transactions, view, selectedYear, selectedMonth]);

  /* ---------------------------------------------------------------- */
  /*  Chart data                                                      */
  /* ---------------------------------------------------------------- */
  const chartData = useMemo(() => {
    const map: Record<string, { income: number; expenses: number }> = {};

    if (view === "month") {
      // Daily breakdown for selected month
      for (const tx of filteredTxs) {
        const day = tx.date.slice(8, 10); // DD
        if (!map[day]) map[day] = { income: 0, expenses: 0 };
        const amt = convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
        if (tx.type === "income") map[day].income += amt;
        if (tx.type === "expense") map[day].expenses += amt;
      }
    } else if (view === "year") {
      // Monthly breakdown for selected year
      // Pre-fill all 12 months with zero-padded keys for correct sort
      for (let i = 0; i < 12; i++) {
        map[String(i).padStart(2, "0")] = { income: 0, expenses: 0 };
      }
      for (const tx of filteredTxs) {
        const monthIdx = String(parseInt(tx.date.slice(5, 7), 10) - 1).padStart(2, "0");
        if (!map[monthIdx]) map[monthIdx] = { income: 0, expenses: 0 };
        const amt = convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
        if (tx.type === "income") map[monthIdx].income += amt;
        if (tx.type === "expense") map[monthIdx].expenses += amt;
      }
    } else {
      // Year-by-year for all time
      for (const tx of filteredTxs) {
        const yr = tx.date.slice(0, 4);
        if (!map[yr]) map[yr] = { income: 0, expenses: 0 };
        const amt = convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
        if (tx.type === "income") map[yr].income += amt;
        if (tx.type === "expense") map[yr].expenses += amt;
      }
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const savings = values.income - values.expenses;
        const savingsRate =
          values.income > 0 ? Math.round((savings / values.income) * 100) : 0;
        let label: string;
        if (view === "month") {
          label = key; // day number
        } else if (view === "year") {
          label = MONTH_NAMES[parseInt(key, 10)] ?? key;
        } else {
          label = key; // year
        }
        return { period: label, ...values, savings, savingsRate };
      });
  }, [filteredTxs, view, baseCurrency, fx]);

  /* ---------------------------------------------------------------- */
  /*  Top spending categories                                         */
  /* ---------------------------------------------------------------- */
  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of filteredTxs) {
      if (tx.type !== "expense") continue;
      const cat = tx.category || "Other";
      map[cat] = (map[cat] || 0) + convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, amount]) => ({ name, amount }));
  }, [filteredTxs, baseCurrency, fx]);

  /* ---------------------------------------------------------------- */
  /*  Summary stats                                                   */
  /* ---------------------------------------------------------------- */
  const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;
  const avgSavingsRate =
    totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

  const periodLabel =
    view === "month"
      ? MONTH_NAMES[parseInt(selectedMonth.slice(5, 7), 10) - 1] +
        " " +
        selectedMonth.slice(0, 4)
      : view === "year"
        ? selectedYear
        : "All Time";

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  if (loading || !fxReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Reports" description="Financial reports and trends" />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No data yet"
          description="Add some transactions to see your financial reports."
        />
      </>
    );
  }

  return (
    <>
      <div data-tour="reports-header">
      <PageHeader
        title="Reports"
        description="Financial reports and trends"
        action={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl border border-border-subtle bg-bg-elevated p-0.5">
              {(["month", "year", "all"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    view === v
                      ? "bg-accent-purple text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {v === "month" ? "Monthly" : v === "year" ? "Yearly" : "All Time"}
                </button>
              ))}
            </div>

            {/* Month picker */}
            {view === "month" && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
              >
                {months.map((m) => {
                  const [yr, mo] = m.split("-");
                  return (
                    <option key={m} value={m}>
                      {MONTH_NAMES[parseInt(mo, 10) - 1]} {yr}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Year picker */}
            {view === "year" && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Income (${periodLabel})`}
          value={m(totalIncome)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={`Expenses (${periodLabel})`}
          value={m(totalExpenses)}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Net Savings"
          value={m(totalSavings)}
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard
          title="Savings Rate"
          value={showBalances ? `${avgSavingsRate}%` : HIDDEN_BALANCE}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Income vs Expenses chart */}
      {chartData.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Income vs Expenses
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_GRID_COLOR}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                tickFormatter={(v) =>
                  showBalances
                    ? formatMoneyCompact(Number(v ?? 0), baseCurrency)
                    : HIDDEN
                }
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                itemStyle={{ color: "var(--text-primary)" }}
                labelStyle={{ color: "var(--text-secondary)" }}
                cursor={{ fill: CHART_CURSOR }}
                formatter={(value) =>
                  showBalances
                    ? formatMoney(Number(value ?? 0), baseCurrency)
                    : HIDDEN
                }
              />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART_AXIS_COLOR }} />
              <Bar
                dataKey="income"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="Income"
              />
              <Bar
                dataKey="expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="Expenses"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Savings rate over time (skip for single-month view) */}
      {chartData.length > 1 && view !== "month" && (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Savings Rate Over Time
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_GRID_COLOR}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                tickFormatter={(v) => (showBalances ? `${v}%` : HIDDEN)}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                itemStyle={{ color: "var(--text-primary)" }}
                labelStyle={{ color: "var(--text-secondary)" }}
                cursor={{ fill: CHART_CURSOR }}
                formatter={(value) =>
                  showBalances ? `${Number(value ?? 0)}%` : HIDDEN
                }
              />
              <Line
                type="monotone"
                dataKey="savingsRate"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 3 }}
                name="Savings Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top spending categories */}
      <div className="mt-6 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Top Spending Categories
        </h3>
        {topCategories.length === 0 ? (
          <p className="text-sm text-text-secondary">No expenses in this period.</p>
        ) : (
          <div className="space-y-3">
            {topCategories.map(({ name, amount }) => {
              const maxAmt = topCategories[0]?.amount || 1;
              const pct = (amount / maxAmt) * 100;
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-primary font-medium">{name}</span>
                    <span className="text-text-secondary">{m(amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-accent-purple transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breakdown table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-border-subtle">
        <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-secondary">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                Period
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                Income
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                Expenses
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                Savings
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr
                key={row.period}
                className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
              >
                <td className="px-4 py-3 font-medium text-text-primary">
                  {row.period}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400">
                  {m(row.income)}
                </td>
                <td className="px-4 py-3 text-right text-red-400">
                  {m(row.expenses)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${
                    row.savings >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {m(row.savings)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {showBalances ? `${row.savingsRate}%` : HIDDEN_BALANCE}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
