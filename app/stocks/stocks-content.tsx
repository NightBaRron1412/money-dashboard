"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMoneyData } from "../hooks/use-money-data";
import { useBalanceVisibility } from "../balance-visibility-provider";
import {
  PageHeader,
  Modal,
  formatMoney,
  HIDDEN_BALANCE,
  EmptyState,
  StatCard,
} from "../components/money-ui";
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  BarChart3,
  RefreshCw,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Check,
  X,
} from "lucide-react";
import {
  createHolding,
  updateHolding,
  deleteHolding as deleteHoldingApi,
  createDividend,
  updateDividend,
  deleteDividend,
} from "@/lib/money/queries";
import type { CurrencyCode, Holding, Dividend } from "@/lib/money/database.types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types for stock quotes                                            */
/* ------------------------------------------------------------------ */
interface Quote {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  name: string;
  currency: string;
}

const COLORS = [
  "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f87171",
  "#f472b6", "#818cf8", "#2dd4bf", "#fb923c", "#38bdf8",
];
const CHART_AXIS_COLOR = "var(--text-secondary)";
const CHART_GRID_COLOR = "color-mix(in srgb, var(--text-secondary) 28%, transparent)";
const CHART_TOOLTIP_BG = "var(--bg-secondary)";
const CHART_TOOLTIP_BORDER = "1px solid var(--border-subtle)";
const CHART_TOOLTIP_TEXT = "var(--text-primary)";
const CHART_TOOLTIP_LABEL = "var(--text-secondary)";
const CHART_CURSOR = "var(--bg-elevated)";

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function StocksContent() {
  const { accounts, holdings, dividends, loading, refresh } = useMoneyData();
  const { showBalances } = useBalanceVisibility();

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Currency toggle (display currency)
  const [currency, setCurrency] = useState<CurrencyCode>("CAD");
  const [fxRate, setFxRate] = useState(1); // USD→CAD rate

  const currencySymbol = currency === "CAD" ? "C$" : "$";
  const m = (v: number) => (showBalances ? formatMoney(v, currency) : HIDDEN_BALANCE);

  const norm = (c: unknown): CurrencyCode => (c === "CAD" || c === "USD" ? c : "USD");
  const fxBetween = useCallback((from: CurrencyCode, to: CurrencyCode): number => {
    if (from === to) return 1;
    if (from === "USD" && to === "CAD") return fxRate || 1;
    if (from === "CAD" && to === "USD") return fxRate > 0 ? 1 / fxRate : 1;
    return 1;
  }, [fxRate]);

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [costCurrency, setCostCurrency] = useState<CurrencyCode>("CAD");
  const [accountId, setAccountId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const investingAccounts = accounts.filter((a) => a.type === "investing");

  // Inline holding edit state
  const [inlineHoldingId, setInlineHoldingId] = useState<string | null>(null);
  const [editHShares, setEditHShares] = useState("");
  const [editHCostBasis, setEditHCostBasis] = useState("");

  const startInlineHolding = (h: Holding) => {
    setInlineHoldingId(h.id);
    setEditHShares(h.shares.toString());
    setEditHCostBasis(h.cost_basis.toString());
  };

  const handleInlineHoldingSave = async (id: string) => {
    const sh = parseFloat(editHShares);
    const cb = parseFloat(editHCostBasis) || 0;
    if (isNaN(sh) || sh <= 0) return;
    setSaving(true);
    try {
      await updateHolding(id, { shares: sh, cost_basis: cb });
      await refresh();
      setInlineHoldingId(null);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  // Holdings sorting
  const [hSortKey, setHSortKey] = useState<"symbol" | "shares" | "value" | "gain">("value");
  const [hSortDir, setHSortDir] = useState<"asc" | "desc">("desc");
  const toggleHSort = (key: typeof hSortKey) => {
    if (hSortKey === key) setHSortDir(d => d === "asc" ? "desc" : "asc");
    else { setHSortKey(key); setHSortDir("desc"); }
  };
  const HSortIcon = ({ col }: { col: typeof hSortKey }) =>
    hSortKey === col ? (hSortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  // Dividends sorting
  const [dSortKey, setDSortKey] = useState<"date" | "symbol" | "amount">("date");
  const [dSortDir, setDSortDir] = useState<"asc" | "desc">("desc");
  const toggleDSort = (key: typeof dSortKey) => {
    if (dSortKey === key) setDSortDir(d => d === "asc" ? "desc" : "asc");
    else { setDSortKey(key); setDSortDir(key === "date" ? "desc" : "asc"); }
  };
  const DSortIcon = ({ col }: { col: typeof dSortKey }) =>
    dSortKey === col ? (dSortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  // Inline dividend edit state
  const [inlineDivId, setInlineDivId] = useState<string | null>(null);
  const [editDivAmount, setEditDivAmount] = useState("");
  const [editDivDate, setEditDivDate] = useState("");
  const [editDivReinvested, setEditDivReinvested] = useState(false);

  const startInlineDividend = (d: Dividend) => {
    setInlineDivId(d.id);
    setEditDivAmount(d.amount.toString());
    setEditDivDate(d.date);
    setEditDivReinvested(d.reinvested);
  };

  const handleInlineDividendSave = async (id: string) => {
    const amt = parseFloat(editDivAmount);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      await updateDividend(id, { amount: amt, date: editDivDate, reinvested: editDivReinvested });
      await refresh();
      setInlineDivId(null);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  // Dividend modal state
  const [showDividend, setShowDividend] = useState(false);
  const [divSymbol, setDivSymbol] = useState("");
  const [divHoldingId, setDivHoldingId] = useState("");
  const [divAmount, setDivAmount] = useState("");
  const [divDate, setDivDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [divNotes, setDivNotes] = useState("");
  const [divReinvested, setDivReinvested] = useState(false);
  const [divError, setDivError] = useState("");
  const [divSaving, setDivSaving] = useState(false);

  // Fetch quotes for all unique symbols
  const uniqueSymbols = useMemo(
    () => [...new Set(holdings.map((h) => h.symbol.toUpperCase()))],
    [holdings]
  );

  const fetchQuotes = useCallback(async () => {
    if (uniqueSymbols.length === 0) {
      setQuotes({});
      return;
    }
    setQuotesLoading(true);
    setQuotesError("");
    try {
      // Fetch quotes + USD/CAD rate in parallel
      const [quotesRes, fxRes] = await Promise.all([
        fetch(`/api/stocks?symbols=${uniqueSymbols.join(",")}`),
        fetch(`/api/stocks?symbols=USDCAD=X`),
      ]);
      const data = await quotesRes.json();
      if (data.results) {
        setQuotes(data.results);
        setLastFetched(new Date());
      } else {
        setQuotesError("Failed to fetch prices");
      }
      const fxData = await fxRes.json();
      const rate = fxData?.results?.["USDCAD=X"]?.price;
      if (rate && rate > 0) setFxRate(rate);
    } catch {
      setQuotesError("Network error fetching prices");
    } finally {
      setQuotesLoading(false);
    }
  }, [uniqueSymbols]);

  useEffect(() => {
    if (uniqueSymbols.length > 0) {
      fetchQuotes();
    }
  }, [fetchQuotes, uniqueSymbols]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (uniqueSymbols.length === 0) return;
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchQuotes, uniqueSymbols]);

  /* ---------- Computed data ---------- */

  const holdingsWithPrices = useMemo(() => {
    return holdings.map((h) => {
      const sym = h.symbol.toUpperCase();
      const quote = quotes[sym];
      // CASH = 1 USD, CASHCAD = 1 CAD (convert to USD equiv so fx works)
      const isCadCash = sym === "CASHCAD";
      const isUsdCash = sym === "CASH";
      const isCash = isCadCash || isUsdCash;
      const quoteCurrency: CurrencyCode = isUsdCash
        ? "USD"
        : isCadCash
          ? "CAD"
          : norm(quote?.currency);
      const priceQuote = isCash ? 1 : (quote?.price ?? 0);
      const price = priceQuote * fxBetween(quoteCurrency, currency);
      const marketValue = h.shares * price;
      // Cash never has gains — cost basis is in native currency
      const costCur: CurrencyCode = norm(h.cost_currency);
      const costInCurrency = isCash
        ? marketValue
        : h.cost_basis * fxBetween(costCur, currency);
      const gain = isCash ? 0 : marketValue - costInCurrency;
      const gainPercent = isCash ? 0 : (costInCurrency > 0 ? (gain / costInCurrency) * 100 : 0);
      const dayChange = isCash ? 0 : (quote ? h.shares * quote.change * fxBetween(quoteCurrency, currency) : 0);
      const dayChangePercent = isCash ? 0 : (quote?.changePercent ?? 0);
      return {
        ...h,
        sym,
        quote,
        price,
        costInCurrency,
        marketValue,
        gain,
        gainPercent,
        dayChange,
        dayChangePercent,
      };
    });
  }, [holdings, quotes, currency, fxBetween]);

  const totalMarketValue = holdingsWithPrices.reduce(
    (s, h) => s + h.marketValue, 0
  );
  const totalCostBasis = holdingsWithPrices.reduce(
    (s, h) => s + h.costInCurrency, 0
  );
  const totalGain = totalMarketValue - totalCostBasis;
  const totalGainPercent =
    totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;
  const totalDayChange = holdingsWithPrices.reduce(
    (s, h) => s + h.dayChange, 0
  );

  // Group by account for per-account summaries
  const byAccount = useMemo(() => {
    const map: Record<string, typeof holdingsWithPrices> = {};
    for (const h of holdingsWithPrices) {
      if (!map[h.account_id]) map[h.account_id] = [];
      map[h.account_id].push(h);
    }
    return map;
  }, [holdingsWithPrices]);

  // Allocation pie: filter by account or show all
  const [pieAccountFilter, setPieAccountFilter] = useState<string>("");

  const pieData = useMemo(() => {
    const source = pieAccountFilter
      ? holdingsWithPrices.filter((h) => h.account_id === pieAccountFilter)
      : holdingsWithPrices;
    const map: Record<string, number> = {};
    for (const h of source) {
      map[h.sym] = (map[h.sym] || 0) + h.marketValue;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [holdingsWithPrices, pieAccountFilter]);

  // Performance bar: separate account filter
  const [perfAccountFilter, setPerfAccountFilter] = useState<string>("");

  const perfData = useMemo(() => {
    const source = perfAccountFilter
      ? holdingsWithPrices.filter((h) => h.account_id === perfAccountFilter)
      : holdingsWithPrices;
    return source
      .filter((h) => h.sym !== "CASH" && h.sym !== "CASHCAD")
      .map((h) => ({
        name: h.sym,
        gain: Math.round(h.gainPercent * 100) / 100,
      }))
      .sort((a, b) => b.gain - a.gain);
  }, [holdingsWithPrices, perfAccountFilter]);

  /* ---------- Form handlers ---------- */

  const resetForm = () => {
    setSymbol("");
    setShares("");
    setCostBasis("");
    setCostCurrency(currency);
    setAccountId("");
    setFormError("");
  };

  const openAdd = () => {
    resetForm();
    setAccountId(investingAccounts[0]?.id ?? "");
    setShowAdd(true);
  };

  const openEdit = (h: Holding) => {
    setEditing(h);
    setSymbol(h.symbol);
    setShares(h.shares.toString());
    setCostBasis(h.cost_basis.toString());
    setCostCurrency(h.cost_currency ?? "USD");
    setAccountId(h.account_id);
    setFormError("");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const sym = symbol.toUpperCase().trim();
    if (!sym) { setFormError("Symbol is required"); return; }
    if (!accountId) { setFormError("Select an account"); return; }
    const sh = parseFloat(shares);
    if (isNaN(sh) || sh <= 0) { setFormError("Enter valid shares"); return; }
    const cb = parseFloat(costBasis) || 0;

    setSaving(true);
    try {
      await createHolding({
        account_id: accountId,
        symbol: sym,
        shares: sh,
        cost_basis: cb,
        cost_currency: costCurrency,
      });
      await refresh();
      setShowAdd(false);
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError("");
    const sym = symbol.toUpperCase().trim();
    if (!sym) { setFormError("Symbol is required"); return; }
    const sh = parseFloat(shares);
    if (isNaN(sh) || sh <= 0) { setFormError("Enter valid shares"); return; }
    const cb = parseFloat(costBasis) || 0;

    setSaving(true);
    try {
      await updateHolding(editing.id, {
        symbol: sym,
        shares: sh,
        cost_basis: cb,
        cost_currency: costCurrency,
        account_id: accountId,
      });
      await refresh();
      setEditing(null);
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holding) => {
    if (!confirm(`Delete ${h.symbol} holding?`)) return;
    await deleteHoldingApi(h.id);
    await refresh();
  };

  /* ---------- Dividend helpers ---------- */

  const totalDividends = useMemo(
    () => dividends.reduce((s, d) => s + d.amount * fxBetween(d.currency, currency), 0),
    [dividends, currency, fxBetween]
  );

  const dividendsBySymbol = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dividends) {
      map[d.symbol] = (map[d.symbol] || 0) + d.amount * fxBetween(d.currency, currency);
    }
    return map;
  }, [dividends, currency, fxBetween]);

  const ytdDividends = useMemo(() => {
    const year = new Date().getFullYear();
    return dividends
      .filter((d) => new Date(d.date).getFullYear() === year)
      .reduce((s, d) => s + d.amount * fxBetween(d.currency, currency), 0);
  }, [dividends, currency, fxBetween]);

  const openDividendModal = (h?: typeof holdingsWithPrices[0]) => {
    setDivSymbol(h?.sym ?? "");
    setDivHoldingId(h?.id ?? "");
    setDivAmount("");
    setDivDate(new Date().toISOString().slice(0, 10));
    setDivNotes("");
    setDivError("");
    setShowDividend(true);
  };

  const handleAddDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    setDivError("");
    if (!divHoldingId) { setDivError("Select a holding"); return; }
    const amt = parseFloat(divAmount);
    if (isNaN(amt) || amt <= 0) { setDivError("Enter a valid amount"); return; }

    const holding = holdings.find((h) => h.id === divHoldingId);
    setDivSaving(true);
    try {
      await createDividend({
        holding_id: divHoldingId,
        symbol: holding?.symbol.toUpperCase() ?? divSymbol,
        amount: amt,
        currency: holding?.cost_currency ?? "USD",
        date: divDate,
        notes: divNotes.trim() || null,
        reinvested: divReinvested,
      });
      await refresh();
      setShowDividend(false);
    } catch (err: unknown) {
      setDivError(err instanceof Error ? err.message : "Failed to add dividend");
    } finally {
      setDivSaving(false);
    }
  };

  const handleDeleteDividend = async (d: Dividend) => {
    if (!confirm(`Delete ${d.symbol} dividend of ${formatMoney(d.amount, d.currency)}?`)) return;
    await deleteDividend(d.id);
    await refresh();
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  const holdingForm = (
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Symbol
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL, VOO, GOLD, CASH, CASHCAD..."
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple font-mono"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Account
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
          >
            <option value="">Select account…</option>
            {investingAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Shares
          </label>
          <input
            type="number"
            step="0.000001"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="10"
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Cost Basis ({costCurrency})
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              placeholder="Total amount paid"
              className="w-full flex-1 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
            <select
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value as CurrencyCode)}
              className="w-24 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
        </div>
      </div>
      {formError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {formError}
        </p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setShowAdd(false);
            setEditing(null);
            resetForm();
          }}
          className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <div data-tour="stocks-header">
      <PageHeader
        title="Stocks & Holdings"
        description="Track your investment portfolio"
        action={
          <div className="flex items-center gap-2">
            {/* USD / CAD toggle */}
            <div className="inline-flex rounded-xl border border-border-subtle overflow-hidden text-xs font-medium">
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-2 transition ${
                  currency === "USD"
                    ? "bg-accent-purple text-white"
                    : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency("CAD")}
                className={`px-3 py-2 transition ${
                  currency === "CAD"
                    ? "bg-accent-purple text-white"
                    : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                }`}
              >
                CAD
              </button>
            </div>
            <button
              onClick={fetchQuotes}
              disabled={quotesLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary transition hover:-translate-y-0.5 hover:border-accent-blue/40 disabled:opacity-50"
              title="Refresh prices"
            >
              <RefreshCw
                className={`h-4 w-4 ${quotesLoading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={openAdd}
              disabled={investingAccounts.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add Holding
            </button>
          </div>
        }
      />
      </div>

      {investingAccounts.length === 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-xs text-yellow-400">
          Create an investing account first in the Accounts page.
        </div>
      )}

      {quotesError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400">
          {quotesError}
        </div>
      )}

      {/* Summary stats */}
      <div data-tour="stocks-holdings" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Portfolio Value (${currency})`}
          value={m(totalMarketValue)}
          subtitle={currency === "CAD" && fxRate !== 1 ? `1 USD = ${fxRate.toFixed(4)} CAD` : undefined}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Total Gain/Loss"
          value={showBalances ? `${totalGain >= 0 ? "+" : ""}${formatMoney(totalGain, currency)}` : HIDDEN_BALANCE}
          subtitle={
            showBalances && totalCostBasis > 0
              ? `${totalGainPercent >= 0 ? "+" : ""}${totalGainPercent.toFixed(2)}%`
              : undefined
          }
          icon={
            totalGain >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
        />
        <StatCard
          title="Today's Change"
          value={
            showBalances
              ? `${totalDayChange >= 0 ? "+" : ""}${formatMoney(totalDayChange, currency)}`
              : HIDDEN_BALANCE
          }
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title="Holdings"
          value={holdings.length.toString()}
          subtitle={lastFetched ? `Updated ${lastFetched.toLocaleTimeString()}` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No holdings yet"
          description="Add your stock and ETF holdings to track your investment portfolio."
          action={
            investingAccounts.length > 0 ? (
              <button
                onClick={openAdd}
                className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
              >
                Add Holding
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Charts */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {/* Allocation pie */}
            {pieData.length > 0 && (
              <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Portfolio Allocation
                  </h3>
                  <select
                    value={pieAccountFilter}
                    onChange={(e) => setPieAccountFilter(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple"
                  >
                    <option value="">All Accounts</option>
                    {investingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      label={({ name, percent }) =>
                        showBalances
                          ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          : name
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={COLORS[idx % COLORS.length]}
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
                      }}
                      itemStyle={{ color: CHART_TOOLTIP_TEXT }}
                      labelStyle={{ color: CHART_TOOLTIP_LABEL }}
                      cursor={{ fill: CHART_CURSOR }}
                      formatter={(value) => [
                        showBalances
                          ? `$${Number(value ?? 0).toLocaleString()}`
                          : HIDDEN_BALANCE,
                        "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Performance bar */}
            {perfData.length > 0 && (
              <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Performance by Holding
                  </h3>
                  <select
                    value={perfAccountFilter}
                    onChange={(e) => setPerfAccountFilter(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple"
                  >
                    <option value="">All Accounts</option>
                    {investingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={perfData} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_GRID_COLOR}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                      tickFormatter={(v) =>
                        showBalances ? `${v}%` : "••••"
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        background: CHART_TOOLTIP_BG,
                        border: CHART_TOOLTIP_BORDER,
                        borderRadius: 12,
                        fontSize: 12,
                        color: CHART_TOOLTIP_TEXT,
                      }}
                      itemStyle={{ color: CHART_TOOLTIP_TEXT }}
                      labelStyle={{ color: CHART_TOOLTIP_LABEL }}
                      cursor={{ fill: CHART_CURSOR }}
                      formatter={(value) => [
                        showBalances
                          ? `${Number(value ?? 0).toFixed(2)}%`
                          : HIDDEN_BALANCE,
                        "Gain",
                      ]}
                    />
                    <Bar dataKey="gain" radius={[0, 4, 4, 0]}>
                      {perfData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.gain >= 0 ? "#10b981" : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Holdings table per account */}
          {investingAccounts.map((acct) => {
            const acctHoldings = byAccount[acct.id];
            if (!acctHoldings || acctHoldings.length === 0) return null;
            const sortedHoldings = [...acctHoldings].sort((a, b) => {
              let cmp = 0;
              switch (hSortKey) {
                case "symbol": cmp = a.sym.localeCompare(b.sym); break;
                case "shares": cmp = a.shares - b.shares; break;
                case "value": cmp = a.marketValue - b.marketValue; break;
                case "gain": cmp = a.gainPercent - b.gainPercent; break;
              }
              return hSortDir === "asc" ? cmp : -cmp;
            });
            const acctTotal = acctHoldings.reduce(
              (s, h) => s + h.marketValue,
              0
            );

            return (
              <div key={acct.id} className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-text-primary">
                    {acct.name}
                  </h2>
                  <span className="text-sm font-medium text-text-secondary">
                    {m(acctTotal)}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                  <table className="w-full min-w-[700px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-secondary">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleHSort("symbol")}>
                          Symbol<HSortIcon col="symbol" />
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleHSort("shares")}>
                          Shares<HSortIcon col="shares" />
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                          Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleHSort("value")}>
                          Value<HSortIcon col="value" />
                        </th>
                        <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium text-text-secondary">
                          Day Change
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleHSort("gain")}>
                          Total Gain<HSortIcon col="gain" />
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHoldings.map((h) => {
                        const isHEditing = inlineHoldingId === h.id;
                        return (
                        <tr
                          key={h.id}
                          className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-mono font-semibold text-text-primary">
                                {h.sym}
                              </span>
                              {h.quote && (
                                <p className="text-[10px] text-text-secondary truncate max-w-[120px]">
                                  {h.quote.name}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-text-primary">
                            {isHEditing ? (
                              <input type="number" step="0.0001" value={editHShares} onChange={(e) => setEditHShares(e.target.value)} className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-sm text-text-primary" />
                            ) : (
                              showBalances
                                ? h.shares % 1 === 0
                                  ? h.shares.toString()
                                  : h.shares.toFixed(4)
                                : "••••"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {isHEditing ? (
                              <input type="number" step="0.01" value={editHCostBasis} onChange={(e) => setEditHCostBasis(e.target.value)} className="w-24 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-sm text-text-primary" />
                            ) : (
                              showBalances
                                ? `${currencySymbol}${h.price.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : HIDDEN_BALANCE
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-text-primary">
                            {m(h.marketValue)}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-right">
                            {showBalances ? (
                              <span
                                className={
                                  h.dayChange >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }
                              >
                                {h.dayChange >= 0 ? "+" : ""}
                                {formatMoney(h.dayChange, currency)}{" "}
                                <span className="text-[10px]">
                                  ({h.dayChangePercent >= 0 ? "+" : ""}
                                  {h.dayChangePercent.toFixed(2)}%)
                                </span>
                              </span>
                            ) : (
                              HIDDEN_BALANCE
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {showBalances ? (
                              <span
                                className={
                                  h.gain >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }
                              >
                                {h.gain >= 0 ? "+" : ""}
                                {formatMoney(h.gain, currency)}{" "}
                                <span className="text-[10px]">
                                  ({h.gainPercent >= 0 ? "+" : ""}
                                  {h.gainPercent.toFixed(2)}%)
                                </span>
                              </span>
                            ) : (
                              HIDDEN_BALANCE
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isHEditing ? (
                              <span className="inline-flex gap-1">
                                <button onClick={() => handleInlineHoldingSave(h.id)} disabled={saving} className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setInlineHoldingId(null)} className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"><X className="h-4 w-4" /></button>
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => startInlineHolding(h)}
                                  className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(h)}
                                  className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Add Modal */}
      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title="Add Holding"
      >
        {holdingForm(handleAdd, "Add Holding")}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          resetForm();
        }}
        title="Edit Holding"
      >
        {holdingForm(handleEdit, "Save Changes")}
      </Modal>

      {/* Dividends Section */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Dividend Tracker
          </h2>
          <button
            onClick={() => openDividendModal()}
            disabled={holdings.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple/10 border border-accent-purple/20 px-3 py-2 text-sm font-medium text-accent-purple transition hover:-translate-y-0.5 hover:bg-accent-purple/20 disabled:opacity-50"
          >
            <DollarSign className="h-4 w-4" /> Log Dividend
          </button>
        </div>

        {/* Dividend summary cards */}
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-4">
            <p className="text-xs text-text-secondary">Total Dividends</p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {m(totalDividends)}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-4">
            <p className="text-xs text-text-secondary">YTD Dividends</p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {m(ytdDividends)}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-4">
            <p className="text-xs text-text-secondary">Yield on Cost</p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {showBalances && totalCostBasis > 0
                ? `${((ytdDividends / totalCostBasis) * 100).toFixed(2)}%`
                : showBalances
                  ? "—"
                  : HIDDEN_BALANCE}
            </p>
          </div>
        </div>

        {/* Per-symbol dividend totals */}
        {Object.keys(dividendsBySymbol).length > 0 && showBalances && (
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(dividendsBySymbol)
              .sort((a, b) => b[1] - a[1])
              .map(([sym, total]) => (
                <span
                  key={sym}
                  className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs"
                >
                  <span className="font-mono font-semibold text-accent-purple">
                    {sym}
                  </span>
                  <span className="ml-2 text-text-primary">
                    {formatMoney(total, currency)}
                  </span>
                </span>
              ))}
          </div>
        )}

        {/* Dividend history table */}
        {dividends.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle">
            <table className="w-full min-w-[560px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleDSort("date")}>
                    Date<DSortIcon col="date" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleDSort("symbol")}>
                    Symbol<DSortIcon col="symbol" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary">
                    Currency
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleDSort("amount")}>
                    Amount<DSortIcon col="amount" />
                  </th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...dividends].sort((a, b) => {
                  let cmp = 0;
                  switch (dSortKey) {
                    case "date": cmp = a.date.localeCompare(b.date); break;
                    case "symbol": cmp = a.symbol.localeCompare(b.symbol); break;
                    case "amount": cmp = a.amount - b.amount; break;
                  }
                  return dSortDir === "asc" ? cmp : -cmp;
                }).slice(0, 20).map((d) => {
                  const isDEditing = inlineDivId === d.id;
                  return (
                  <tr
                    key={d.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                  >
                    <td className="px-4 py-3 text-text-secondary">
                      {isDEditing ? (
                        <input type="date" value={editDivDate} onChange={(e) => setEditDivDate(e.target.value)}
                          className="w-full max-w-[140px] rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                      ) : (
                        new Date(d.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                      {d.symbol}
                      {isDEditing ? (
                        <label className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-text-secondary">
                          <input type="checkbox" checked={editDivReinvested} onChange={(e) => setEditDivReinvested(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border-subtle accent-accent-purple" />
                          DRIP
                        </label>
                      ) : d.reinvested ? (
                        <span className="ml-1.5 rounded bg-accent-purple/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-purple brightness-125">
                          DRIP
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {d.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                      {isDEditing ? (
                        <input type="number" step="0.01" value={editDivAmount} onChange={(e) => setEditDivAmount(e.target.value)}
                          className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-xs text-text-primary outline-none focus:border-accent-purple" />
                      ) : (
                        showBalances ? `+${formatMoney(d.amount, d.currency)}` : HIDDEN_BALANCE
                      )}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-text-secondary text-xs truncate max-w-[200px]">
                      {d.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isDEditing ? (
                        <span className="inline-flex gap-1">
                          <button onClick={() => handleInlineDividendSave(d.id)} disabled={saving} className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setInlineDivId(null)} className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"><X className="h-4 w-4" /></button>
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startInlineDividend(d)}
                            className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDividend(d)}
                            className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 text-center text-sm text-text-secondary">
            No dividends recorded yet. Click &quot;Log Dividend&quot; to add one.
          </div>
        )}
      </div>

      {/* Dividend Modal */}
      <Modal
        open={showDividend}
        onClose={() => setShowDividend(false)}
        title="Log Dividend"
      >
        <form onSubmit={handleAddDividend} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Holding
            </label>
            <select
              value={divHoldingId}
              onChange={(e) => {
                setDivHoldingId(e.target.value);
                const h = holdings.find((h) => h.id === e.target.value);
                if (h) setDivSymbol(h.symbol.toUpperCase());
              }}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">Select holding…</option>
              {holdings
                .filter((h) => h.symbol.toUpperCase() !== "CASH" && h.symbol.toUpperCase() !== "CASHCAD")
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.symbol.toUpperCase()} — {h.shares} shares ({h.cost_currency ?? "USD"})
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Amount ({(() => { const h = holdings.find((h) => h.id === divHoldingId); return h?.cost_currency ?? "USD"; })()})
              </label>
              <input
                type="number"
                step="0.01"
                value={divAmount}
                onChange={(e) => setDivAmount(e.target.value)}
                placeholder="25.00"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Date
              </label>
              <input
                type="date"
                value={divDate}
                onChange={(e) => setDivDate(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Notes (optional)
            </label>
            <input
              type="text"
              value={divNotes}
              onChange={(e) => setDivNotes(e.target.value)}
              placeholder="Q2 dividend, special dividend…"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={divReinvested}
              onChange={(e) => setDivReinvested(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle accent-accent-purple"
            />
            Reinvested (excluded from net worth / portfolio value)
          </label>
          {divError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {divError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDividend(false)}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={divSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {divSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Log Dividend
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
