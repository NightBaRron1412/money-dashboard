"use client";
import { TransactionEditDialog, EditField } from "../components/transaction-edit-dialog";
import { MonthlyExclusion } from "../components/monthly-exclusion";

import { useEffect, useMemo, useState, useCallback } from "react";
import { MerchantInput } from "../components/merchant-input";
import { useMoneyData } from "../hooks/use-money-data";
import { useMoneyFx } from "../hooks/use-money-fx";
import {
  PageHeader,
  Modal,
  formatMoney,
  HIDDEN_BALANCE,
  EmptyState,
  StatCard,
  todayEST,
} from "../components/money-ui";
import {
  Plus,
  Wallet,
  Loader2,
  Calendar,
  Zap,
  Trash2,
  Pencil,
  Star,
  Repeat,
  ArrowRight,
  Filter,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Copy,
} from "lucide-react";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/money/queries";
import type {
  Account,
  CurrencyCode,
  IncomeSource,
  RecurrenceFrequency,
} from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";
import { format } from "date-fns";
import { useBalanceVisibility } from "../balance-visibility-provider";

const INCOME_SOURCES: IncomeSource[] = [
  "Paycheck",
  "Stocks",
  "Bonus",
  "Freelance",
  "Dividends",
  "Refund",
  "Gift",
  "Other",
];

const SOURCE_COLORS: Record<string, string> = {
  Paycheck: "bg-[#4f8f7e]",
  Stocks: "bg-[#6581c3]",
  Bonus: "bg-[#8072b2]",
  Freelance: "bg-[#966c98]",
  Dividends: "bg-[#478596]",
  Refund: "bg-[#d4875f]",
  Gift: "bg-[#bc7297]",
  Other: "bg-[#7d8490]",
};

const createdAtMs = (value: string) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeAllocationKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const formatSplitValue = (value: number) =>
  Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, "");

const resolveAllocationAccountId = (
  rawKey: string,
  accounts: Account[]
): string | null => {
  if (accounts.some((a) => a.id === rawKey)) return rawKey;
  const normalized = normalizeAllocationKey(rawKey);

  const byName = accounts.find(
    (a) => normalizeAllocationKey(a.name) === normalized
  );
  if (byName) return byName.id;

  const bySubstring = accounts.find(
    (a) =>
      normalizeAllocationKey(a.name).includes(normalized) ||
      normalized.includes(normalizeAllocationKey(a.name))
  );
  if (bySubstring) return bySubstring.id;

  if (normalized.includes("invest")) {
    return accounts.find((a) => a.type === "investing")?.id ?? null;
  }

  return null;
};

const normalizePlanAllocations = (
  allocations: Record<string, number>,
  accounts: Account[]
) => {
  const resolved: Record<string, number> = {};
  for (const [rawKey, rawAmount] of Object.entries(allocations ?? {})) {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const accountId = resolveAllocationAccountId(rawKey, accounts);
    if (!accountId) continue;
    resolved[accountId] = (resolved[accountId] ?? 0) + amount;
  }
  return resolved;
};

export function IncomeContent() {
  const { accounts, transactions, plans, settings, loading, refresh } =
    useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const defaultPaycheckRecurrence: RecurrenceFrequency =
    settings?.paycheck_frequency ?? "bi-weekly";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBankId, setFilterBankId] = useState("");

  // Form state
  const [date, setDate] = useState(todayEST());
  const [amount, setAmount] = useState(settings?.paycheck_amount?.toString() || "");
  const [source, setSource] = useState<IncomeSource>("Paycheck");
  const [merchant, setMerchant] = useState("");
  const [accountId, setAccountId] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<Record<string, string>>({});
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>(defaultPaycheckRecurrence);
  const [excludeFromMonthly, setExcludeFromMonthly] = useState(false);
  const [formError, setFormError] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSource, setEditSource] = useState<IncomeSource>("Paycheck");
  const [editMerchant, setEditMerchant] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [incomeNotes, setIncomeNotes] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrence, setEditRecurrence] =
    useState<RecurrenceFrequency>("bi-weekly");
  const [editExcludeFromMonthly, setEditExcludeFromMonthly] = useState(false);

  /* Sorting */
  const [sortKey, setSortKey] = useState<
    "date" | "amount" | "source" | "account" | "description"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
  };
  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  const incomeTransactions = transactions.filter((t) => t.type === "income");
  const filteredIncomeTransactions = useMemo(() => {
    return incomeTransactions.filter(t => (!filterBankId || t.account_id === filterBankId) && (!search.trim() || [t.merchant, t.category, t.notes, t.date].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))));
  }, [incomeTransactions, filterBankId, search]);

  // Group by month for paycheck-only counting
  const monthCounts: Record<string, number> = {};
  for (const tx of filteredIncomeTransactions.filter((t) => (t.category || "") === "Paycheck")) {
    const key = tx.date.slice(0, 7);
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  }

  const parsedAmount = parseFloat(amount) || 0;
  const splitTotal = Object.values(splits).reduce(
    (s, v) => s + (parseFloat(v) || 0),
    0
  );
  const remaining = parsedAmount - splitTotal;

  const sortedIncome = useMemo(() => {
    const sorted = [...filteredIncomeTransactions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "source": cmp = (a.category || "").localeCompare(b.category || ""); break;
        case "account":
          cmp = (accounts.find((acct) => acct.id === a.account_id)?.name || "").localeCompare(
            accounts.find((acct) => acct.id === b.account_id)?.name || ""
          );
          break;
        case "description": cmp = (a.merchant || a.notes || "").localeCompare(b.merchant || b.notes || ""); break;
      }
      if (cmp === 0) {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = createdAtMs(a.created_at) - createdAtMs(b.created_at);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredIncomeTransactions, sortKey, sortDir, accounts]);

  // Running balance per transaction (when filtered by account)
  const [runningBalances, setRunningBalances] = useState<Record<string, number>>({});

  const fetchRunningBalance = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/running-balance?account_id=${accountId}`);
      if (!res.ok) { setRunningBalances({}); return; }
      const data = await res.json();
      const map: Record<string, number> = {};
      for (const tx of data.transactions || []) {
        map[tx.id] = tx.running_balance;
      }
      setRunningBalances(map);
    } catch { setRunningBalances({}); }
  }, []);

  useEffect(() => {
    if (filterBankId) {
      fetchRunningBalance(filterBankId);
    } else {
      setRunningBalances({});
    }
  }, [filterBankId, fetchRunningBalance, transactions]);

  const showBalance = filterBankId && Object.keys(runningBalances).length > 0;

  const activePlan = plans.find((plan) => plan.is_active) ?? null;

  useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId("");
      return;
    }
    setSelectedPlanId((prev) => {
      if (prev && plans.some((plan) => plan.id === prev)) return prev;
      return activePlan?.id ?? plans[0].id;
    });
  }, [plans, activePlan?.id]);

  useEffect(() => {
    if (showAdd) return;
    setAmount(settings?.paycheck_amount?.toString() || "");
  }, [settings?.paycheck_amount, showAdd]);

  const applyAllocationPlan = (planId: string, depositAccountId: string) => {
    const plan = plans.find((p) => p.id === planId);
    const depositAccount = accounts.find((a) => a.id === depositAccountId);
    if (!plan || !depositAccount) return;

    const normalized = normalizePlanAllocations(plan.allocations, accounts);
    const sameCurrencyTargets = accounts.filter(
      (a) => a.id !== depositAccountId && a.currency === depositAccount.currency
    );

    const nextSplits: Record<string, string> = {};
    for (const target of sameCurrencyTargets) {
      const allocationAmount = normalized[target.id];
      if (allocationAmount && allocationAmount > 0) {
        nextSplits[target.id] = formatSplitValue(allocationAmount);
      }
    }

    const plannedTotal = Object.values(nextSplits).reduce(
      (sum, value) => sum + (parseFloat(value) || 0),
      0
    );

    setSplits(nextSplits);
    setSplitEnabled(Object.keys(nextSplits).length > 0);

    const typedAmount = parseFloat(amount) || 0;
    if (typedAmount > 0 && plannedTotal - typedAmount > 0.01) {
      setFormError(
        `${plan.name} exceeds this income amount. Adjust splits or amount.`
      );
    } else {
      setFormError("");
    }
  };

  const handleOpenAdd = () => {
    setShowAdd(true);
    setFormError("");
    setExcludeFromMonthly(false);
    setAmount(settings?.paycheck_amount?.toString() || "");
    setRecurrence(defaultPaycheckRecurrence);
    if (plans.length === 0) {
      setSelectedPlanId("");
      return;
    }
    setSelectedPlanId(activePlan?.id ?? plans[0].id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) {
        setFormError("Enter a valid amount");
        setSaving(false);
        return;
      }

      if (!accountId) {
        setFormError("Select an account");
        setSaving(false);
        return;
      }

      if (splitEnabled && remaining < -0.01) {
        setFormError("Split amounts exceed the income total");
        setSaving(false);
        return;
      }

      const depositAcct = accounts.find((a) => a.id === accountId);
      const txCurrency: CurrencyCode = depositAcct?.currency ?? baseCurrency;

      if (splitEnabled) {
        for (const [targetId, splitAmt] of Object.entries(splits)) {
          const parsed = parseFloat(splitAmt);
          if (!parsed || parsed <= 0 || targetId === accountId) continue;
          const targetAcct = accounts.find((a) => a.id === targetId);
          if (targetAcct && targetAcct.currency !== txCurrency) {
            setFormError("Split targets must use the same currency as the deposit account.");
            setSaving(false);
            return;
          }
        }
      }

      // Create income transaction on selected account
      const splitNote =
        splitEnabled && selectedPlanId
          ? `Plan split: ${plans.find((plan) => plan.id === selectedPlanId)?.name ?? "allocation"}`
          : splitEnabled
            ? "Custom split"
            : null;

      await createTransaction({
        type: "income",
        date,
        amount: amt,
        currency: txCurrency,
        category: source,
        account_id: accountId,
        from_account_id: null,
        to_account_id: null,
        merchant: merchant || null,
        notes: [incomeNotes.trim(), splitNote].filter(Boolean).join(" — ") || null,
        is_recurring: isRecurring,
        recurrence: isRecurring ? recurrence : null,
        exclude_from_monthly: excludeFromMonthly,
      });

      // If split is enabled, create transfer transactions
      if (splitEnabled) {
        for (const [targetId, splitAmt] of Object.entries(splits)) {
          const parsed = parseFloat(splitAmt);
          if (!parsed || parsed <= 0 || targetId === accountId) continue;
          await createTransaction({
            type: "transfer",
            date,
            amount: parsed,
            currency: txCurrency,
            category: "Allocation",
            account_id: null,
            from_account_id: accountId,
            to_account_id: targetId,
            merchant: null,
            notes: "Split from income",
            is_recurring: false,
            recurrence: null,
          });
        }
      }

      await refresh();
      setShowAdd(false);
      setDate(todayEST());
      setAmount(settings?.paycheck_amount?.toString() || "");
      setSource("Paycheck");
      setMerchant("");
      setAccountId("");
      setSplitEnabled(false);
      setSplits({});
      setSelectedPlanId(activePlan?.id ?? plans[0]?.id ?? "");
      setIncomeNotes("");
      setIsRecurring(false);
      setRecurrence(defaultPaycheckRecurrence);
      setExcludeFromMonthly(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this income entry?")) return;
    await deleteTransaction(id);
    await refresh();
  };

  const startEdit = (tx: {
    notes: string | null;
    id: string;
    date: string;
    amount: number;
    category: string | null;
    merchant: string | null;
    account_id: string | null;
    is_recurring: boolean;
    recurrence: RecurrenceFrequency | null;
    exclude_from_monthly: boolean;
  }) => {
    setEditingId(tx.id);
    setEditDate(tx.date);
    setEditAmount(tx.amount.toString());
    setEditSource((tx.category as IncomeSource) || "Paycheck");
    setEditMerchant(tx.merchant || "");
    setEditNotes(tx.notes || "");
    setEditAccountId(tx.account_id || accounts[0]?.id || "");
    setEditIsRecurring(tx.is_recurring);
    setEditRecurrence(tx.recurrence || "bi-weekly");
    setEditExcludeFromMonthly(tx.exclude_from_monthly);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const amt = parseFloat(editAmount);
      if (isNaN(amt) || amt <= 0) return;
      const editAccount = accounts.find((a) => a.id === editAccountId);
      if (!editAccount) return;
      await updateTransaction(id, {
        date: editDate,
        amount: amt,
        category: editSource,
        account_id: editAccount.id,
        currency: editAccount.currency,
        merchant: editMerchant || null,
          notes: editNotes.trim() || null,
        is_recurring: editIsRecurring,
        recurrence: editIsRecurring ? editRecurrence : null,
        exclude_from_monthly: editExcludeFromMonthly,
      });
      await refresh();
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !fxReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  const totalIncomeBase = filteredIncomeTransactions.reduce(
    (s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx),
    0
  );

  // Other accounts for split (exclude the selected deposit account)
  const depositCurrency: CurrencyCode =
    accounts.find((a) => a.id === accountId)?.currency ?? baseCurrency;
  const splitTargets = accounts.filter(
    (a) => a.id !== accountId && a.currency === depositCurrency
  );

  return (
    <>
      <div data-tour="income-header">
      <PageHeader
        title="Income"
        description="Track your paychecks and income"
        action={
          <button
            data-tour="income-add"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Add Income
          </button>
        }
      />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Income"
          value={m(totalIncomeBase)}
          subtitle={filterBankId ? "Filtered" : "All time"}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Entries"
          value={filteredIncomeTransactions.length.toString()}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Avg Income"
          value={m(
            filteredIncomeTransactions.length > 0
              ? totalIncomeBase / filteredIncomeTransactions.length
              : 0
          )}
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" aria-label="Search income" placeholder="Search merchant, category or notes…" value={search} onChange={event => setSearch(event.target.value)} className="money-filter-search" />
        <Filter className="h-4 w-4 text-text-secondary" />
        <select
          value={filterBankId}
          onChange={(e) => setFilterBankId(e.target.value)}
          className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
        >
          <option value="">All banks</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {(filterBankId || search) && (
          <button
            onClick={() => { setFilterBankId(""); setSearch(""); }}
            className="text-xs text-accent-blue hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {filteredIncomeTransactions.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No income recorded"
          description={
            filterBankId || search
              ? "No income entries match. Try another search or clear your filters."
              : "Add your first income entry to start tracking."
          }
          action={
            <button
              onClick={handleOpenAdd}
              className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Add Income
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle">
          <table className="w-full min-w-[700px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("date")}>
                  Date<SortIcon col="date" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("amount")}>
                  Amount<SortIcon col="amount" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("source")}>
                  Source<SortIcon col="source" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("account")}>
                  Account<SortIcon col="account" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary max-w-[180px]" onClick={() => toggleSort("description")}>
                  Description<SortIcon col="description" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                  Month
                </th>
                {showBalance && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                    Balance
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIncome.map((tx) => {
                const monthKey = tx.date.slice(0, 7);
                const isTriplePaycheck = (monthCounts[monthKey] || 0) >= 3;

                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {(
                        format(new Date(tx.date + "T00:00:00"), "MMM d, yyyy")
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-400">
                      {(
                        <>+{showBalances ? formatMoney(tx.amount, tx.currency) : HIDDEN_BALANCE}</>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${SOURCE_COLORS[tx.category || "Other"] || "bg-gray-500"}`} />
                          <span className="text-text-primary text-xs">{tx.category || "Paycheck"}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(
                        <span className="block max-w-[130px] truncate text-xs text-text-primary" title={accounts.find((a) => a.id === tx.account_id)?.name || "-"}>
                          {accounts.find((a) => a.id === tx.account_id)?.name || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-[180px]">
                      {(
                        <span className="inline-flex max-w-[180px] items-center gap-1.5" title={tx.merchant || tx.notes || undefined}>
                          <span className="truncate">{tx.merchant || tx.notes || "-"}</span>
                          {tx.is_recurring && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-accent-purple/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-purple brightness-125" title={tx.recurrence || "recurring"}>
                              <Repeat className="h-2.5 w-2.5" /> {tx.recurrence}
                            </span>
                          )}
                          {tx.exclude_from_monthly && (
                            <span className="inline-flex shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400" title="Excluded from reports, summaries, and forecasts">
                              Excluded
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isTriplePaycheck ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-yellow-400/20 dark:bg-yellow-500/10 dark:text-yellow-300">
                          <Star className="h-3 w-3" /> 3 paychecks
                        </span>
                      ) : (
                        <span className="text-text-secondary text-xs">
                          {monthCounts[monthKey]} paycheck{(monthCounts[monthKey] || 0) !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    {showBalance && (
                      <td className="px-4 py-3 text-right font-semibold text-text-primary">
                        {showBalances && runningBalances[tx.id] != null
                          ? formatMoney(runningBalances[tx.id], tx.currency)
                          : showBalances ? "—" : HIDDEN_BALANCE}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {(
                        <div className="flex items-center justify-end gap-1">
                          <button aria-label="Edit income" onClick={() => startEdit(tx)}
                            className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(tx.id)}
                            className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400">
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
      )}

      {/* Add Income Modal */}
      <TransactionEditDialog open={!!editingId} title="Edit Income" saving={saving} onClose={() => setEditingId(null)} onSave={async () => {if (editingId) await handleSaveEdit(editingId);}}>
        <div className="grid gap-5 sm:grid-cols-2"><EditField label="Date"><input aria-label="Date" type="date" required value={editDate} onChange={event => setEditDate(event.target.value)} /></EditField><EditField label={`Amount (${accounts.find(account => account.id === editAccountId)?.currency || baseCurrency})`}><input aria-label="Amount" type="number" required min="0.01" step="0.01" value={editAmount} onChange={event => setEditAmount(event.target.value)} /></EditField><EditField label="Category"><select aria-label="Category" value={editSource} onChange={event => setEditSource(event.target.value as IncomeSource)}>{INCOME_SOURCES.map(value => <option key={value} value={value}>{value}</option>)}</select></EditField><EditField label="Deposit to"><select aria-label="Account" required value={editAccountId} onChange={event => setEditAccountId(event.target.value)}><option value="">Select an account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></EditField></div>
        <EditField label="Merchant"><MerchantInput value={editMerchant} onChange={setEditMerchant} records={transactions} /></EditField>
        <EditField label="Notes"><textarea aria-label="Notes" rows={2} placeholder="Add a note…" value={editNotes} onChange={event => setEditNotes(event.target.value)} /></EditField>
        <section className="transaction-editor-options"><h3 className="text-sm font-semibold text-text-primary">Income preferences</h3><div className="grid items-center gap-3 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 text-sm text-text-primary"><input type="checkbox" checked={editIsRecurring} onChange={event => setEditIsRecurring(event.target.checked)} />Recurring</label>{editIsRecurring && <EditField label="Frequency"><select aria-label="Frequency" value={editRecurrence} onChange={event => setEditRecurrence(event.target.value as RecurrenceFrequency)}><option value="weekly">Weekly</option><option value="bi-weekly">Bi-weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></EditField>}</div><MonthlyExclusion checked={editExcludeFromMonthly} onChange={setEditExcludeFromMonthly} /></section>
      </TransactionEditDialog>
            <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Income">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Amount ({accounts.find((a) => a.id === accountId)?.currency ?? baseCurrency})
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                placeholder="3400"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => {
                  const nextSource = e.target.value as IncomeSource;
                  setSource(nextSource);
                  if (nextSource === "Paycheck") {
                    setRecurrence(defaultPaycheckRecurrence);
                  }
                }}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                {INCOME_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Deposit Into
              </label>
              {accounts.length === 0 ? (
                <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-400">
                  Create an account first in the Accounts page.
                </p>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => {
                    const nextAccountId = e.target.value;
                    setAccountId(nextAccountId);
                    setFormError("");
                    if (!nextAccountId) {
                      setSplitEnabled(false);
                      setSplits({});
                      return;
                    }
                    if (selectedPlanId) {
                      applyAllocationPlan(selectedPlanId, nextAccountId);
                      return;
                    }
                    setSplits((prev) => {
                      const next = { ...prev };
                      delete next[nextAccountId];
                      return next;
                    });
                  }}
                  className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}, {a.currency})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Merchant / Description
            </label>
            <MerchantInput value={merchant} onChange={setMerchant} records={transactions} />
          </div>

          <label className="block text-xs text-text-secondary">Notes (optional)<textarea aria-label="Notes" value={incomeNotes} onChange={event => setIncomeNotes(event.target.value)} className="mt-1 w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary" /></label>
          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${isRecurring ? "bg-accent-purple" : "bg-bg-elevated"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isRecurring ? "translate-x-5" : ""}`} />
            </button>
            <span className="text-sm text-text-primary">Recurring income</span>
          </div>
          {isRecurring && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Frequency</label>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple">
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExcludeFromMonthly(!excludeFromMonthly)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${excludeFromMonthly ? "bg-accent-purple" : "bg-bg-elevated"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${excludeFromMonthly ? "translate-x-5" : ""}`} />
            </button>
            <span className="text-sm text-text-primary">Exclude from reports and forecasts</span>
          </div>

          {/* Allocation plan shortcut */}
          {accountId && plans.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-text-secondary">
                  Allocation plan
                </label>
                {activePlan && (
                  <span className="text-[11px] text-text-secondary">
                    Active: {activePlan.name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="flex-1 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.is_active ? " (active)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPlanId || !accountId) return;
                    applyAllocationPlan(selectedPlanId, accountId);
                  }}
                  className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-elevated"
                >
                  Apply Plan
                </button>
              </div>
              <p className="text-[11px] text-text-secondary">
                Apply saved allocations to prefill split amounts.
              </p>
            </div>
          )}

          {/* Custom split allocation */}
          {accounts.length > 1 && accountId && (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSplitEnabled(!splitEnabled)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    splitEnabled ? "bg-accent-purple" : "bg-bg-elevated"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      splitEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span className="text-sm text-text-primary">
                  Split across accounts
                </span>
              </div>

              {splitEnabled && splitTargets.length > 0 && (
                <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated/50 p-3">
                  <p className="text-xs text-text-secondary">
                    Specify how much to move from{" "}
                    <span className="font-medium text-text-primary">
                      {accounts.find((a) => a.id === accountId)?.name}
                    </span>{" "}
                    to other accounts:
                  </p>
                  {splitTargets.map((acct) => (
                    <div key={acct.id} className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 shrink-0 text-text-secondary" />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                        {acct.name}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splits[acct.id] || ""}
                        onChange={(e) =>
                          setSplits((prev) => ({
                            ...prev,
                            [acct.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-24 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 text-right text-xs text-text-primary outline-none focus:border-accent-purple"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-xs">
                    <span className="text-text-secondary">
                      Remaining in {accounts.find((a) => a.id === accountId)?.name}:
                    </span>
                    <span
                      className={`font-semibold ${
                        remaining < -0.01
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {formatMoney(Math.max(remaining, 0), depositCurrency)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {formError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || accounts.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Income
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
