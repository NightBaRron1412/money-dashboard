"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  getCategoryColorTw,
} from "../components/money-ui";
import {
  Plus,
  ArrowDownUp,
  Loader2,
  Trash2,
  Pencil,
  Filter,
  ShoppingCart,
  Repeat,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  X,
} from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction, createLinkedCreditCardCharge } from "@/lib/money/queries";
import type { CurrencyCode, RecurrenceFrequency } from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";
import { format } from "date-fns";
import { useBalanceVisibility } from "../balance-visibility-provider";

const DEFAULT_CATEGORIES = [
  "Bills",
  "Food",
  "Fun",
  "Health",
  "Personal Care",
  "Rent",
  "Transport",
  "Other",
];

const normalizeCategories = (raw: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const value = entry.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
};

const createdAtMs = (value: string) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function ExpensesContent() {
  const { accounts, creditCards, creditCardCharges, transactions, settings, goals, loading, refresh } = useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterBankId, setFilterBankId] = useState<string>("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Food");
  const [editMerchant, setEditMerchant] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceFrequency>("monthly");
  const [editAccountId, setEditAccountId] = useState("");

  // Form
  const [date, setDate] = useState(todayEST());
  const [amount, setAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState<CurrencyCode | "">("");
  const [category, setCategory] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [autoCategorizePending, setAutoCategorizePending] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("monthly");
  const [excludeFromMonthly, setExcludeFromMonthly] = useState(false);
  const [editExcludeFromMonthly, setEditExcludeFromMonthly] = useState(false);
  const [goalId, setGoalId] = useState<string>("");
  const [editGoalId, setEditGoalId] = useState<string>("");
  const [formError, setFormError] = useState("");

  const autoCategorize = useCallback(async (merchantName: string, notesText?: string) => {
    if (!merchantName.trim() && !(notesText?.trim())) return;
    if ((merchantName + (notesText || "")).trim().length < 2) return;
    setAutoCategorizePending(true);
    try {
      const cats = settings?.expense_categories ?? [];
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: merchantName.trim(), notes: notesText?.trim() || undefined, categories: cats }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.category) setCategory(data.category);
    } catch { /* silent */ } finally {
      setAutoCategorizePending(false);
    }
  }, [settings?.expense_categories]);

  /* Sorting */
  const [sortKey, setSortKey] = useState<"date" | "amount" | "category" | "merchant" | "account">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
  };
  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  const expenseTransactions = useMemo(() => {
    let txs = transactions.filter((t) => t.type === "expense");
    if (filterBankId) {
      if (filterBankId.startsWith("cc:")) {
        // Filter by credit card – find charge IDs belonging to this card
        const cardId = filterBankId.slice(3);
        const chargeIds = new Set(creditCardCharges.filter((c) => c.card_id === cardId).map((c) => c.id));
        txs = txs.filter((t) => t.linked_charge_id && chargeIds.has(t.linked_charge_id));
      } else {
        txs = txs.filter((t) => t.account_id === filterBankId);
      }
    }
    if (filterCategory) txs = txs.filter((t) => t.category === filterCategory);
    if (filterMonth) txs = txs.filter((t) => t.date.startsWith(filterMonth));
    return txs;
  }, [transactions, creditCardCharges, filterBankId, filterCategory, filterMonth]);

  const categories = useMemo(() => {
    const loaded = normalizeCategories(settings?.expense_categories ?? []);
    const list = loaded.length > 0 ? loaded : DEFAULT_CATEGORIES;
    return [...list].sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [settings?.expense_categories]);

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory(categories[0] || "Other");
    }
    if (!categories.includes(editCategory)) {
      setEditCategory(categories[0] || "Other");
    }
  }, [categories, category, editCategory]);

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenseTransactions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
        case "merchant": cmp = (a.merchant || "").localeCompare(b.merchant || ""); break;
        case "account": cmp = (a.account_id || "").localeCompare(b.account_id || ""); break;
      }
      if (cmp === 0) {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = createdAtMs(a.created_at) - createdAtMs(b.created_at);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [expenseTransactions, sortKey, sortDir]);

  // Running balance per transaction (when filtered by a bank account, not CC)
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
    if (filterBankId && !filterBankId.startsWith("cc:")) {
      fetchRunningBalance(filterBankId);
    } else {
      setRunningBalances({});
    }
  }, [filterBankId, fetchRunningBalance, transactions]);

  const showBalance = filterBankId && !filterBankId.startsWith("cc:") && Object.keys(runningBalances).length > 0;

  const totalExpensesBase = expenseTransactions.reduce(
    (s, t) => s + convertCurrency(t.amount, t.currency, baseCurrency, fx),
    0
  );

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of expenseTransactions) {
      const cat = tx.category || "Other";
      map[cat] = (map[cat] || 0) + convertCurrency(tx.amount, tx.currency, baseCurrency, fx);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount }));
  }, [expenseTransactions, baseCurrency, fx]);

  // Available months
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions.filter((t) => t.type === "expense")) {
      if (filterBankId && tx.account_id !== filterBankId) continue;
      set.add(tx.date.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [transactions, filterBankId]);

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
        setFormError("Select an account or credit card");
        setSaving(false);
        return;
      }

      const isCC = accountId.startsWith("cc:");
      if (isCC) {
        const cardId = accountId.slice(3);
        const card = creditCards.find((c) => c.id === cardId);
        const txCurrency: CurrencyCode = expenseCurrency || card?.currency || baseCurrency;
        const cardCurrency = card?.currency || baseCurrency;
        const chargeAmt = txCurrency !== cardCurrency ? convertCurrency(amt, txCurrency, cardCurrency, fx) : amt;
        await createLinkedCreditCardCharge(
          {
            card_id: cardId,
            date,
            amount: chargeAmt,
            merchant: merchant || null,
            category,
            notes: txCurrency !== cardCurrency ? `${expenseNotes ? expenseNotes + " — " : ""}${amt} ${txCurrency} converted` : (expenseNotes || null),
          },
          { currency: cardCurrency, cardName: card?.name ?? "Credit Card", is_recurring: isRecurring, recurrence: isRecurring ? recurrence : null }
        );
      } else {
        const acct = accounts.find((a) => a.id === accountId);
        const txCurrency: CurrencyCode = expenseCurrency || acct?.currency || baseCurrency;
        await createTransaction({
          type: "expense",
          date,
          amount: amt,
          currency: txCurrency,
          category,
          account_id: accountId,
          from_account_id: null,
          to_account_id: null,
          merchant: merchant || null,
          notes: expenseNotes || null,
          is_recurring: isRecurring,
          recurrence: isRecurring ? recurrence : null,
          exclude_from_monthly: excludeFromMonthly,
          goal_id: goalId || null,
        });
      }
      await refresh();
      setShowAdd(false);
      setAmount("");
      setMerchant("");
      setExpenseNotes("");
      setExpenseCurrency("");
      setIsRecurring(false);
      setExcludeFromMonthly(false);
      setGoalId("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await deleteTransaction(id);
    await refresh();
  };

  const handleDuplicate = async (tx: { date: string; amount: number; currency: CurrencyCode; category: string | null; account_id: string | null; merchant: string | null; is_recurring: boolean; recurrence: RecurrenceFrequency | null; linked_charge_id: string | null; exclude_from_monthly: boolean; goal_id: string | null }) => {
    setSaving(true);
    try {
      const isCC = !!tx.linked_charge_id;
      if (isCC) {
        // Find the original charge to get card info
        const charge = creditCardCharges.find((c) => c.id === tx.linked_charge_id);
        const card = charge ? creditCards.find((c) => c.id === charge.card_id) : null;
        if (charge && card) {
          await createLinkedCreditCardCharge(
            {
              card_id: charge.card_id,
              date: todayEST(),
              amount: tx.amount,
              merchant: tx.merchant ?? null,
              category: tx.category ?? null,
              notes: null,
            },
            {
              currency: card.currency,
              cardName: card.name,
              is_recurring: tx.is_recurring,
              recurrence: tx.recurrence,
            }
          );
        }
      } else {
        await createTransaction({
          type: "expense",
          date: todayEST(),
          amount: tx.amount,
          currency: tx.currency,
          category: tx.category,
          account_id: tx.account_id,
          from_account_id: null,
          to_account_id: null,
          merchant: tx.merchant,
          notes: null,
          is_recurring: tx.is_recurring,
          recurrence: tx.recurrence,
          exclude_from_monthly: tx.exclude_from_monthly,
          goal_id: tx.goal_id,
        });
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tx: { id: string; date: string; amount: number; category: string | null; merchant: string | null; is_recurring: boolean; recurrence: RecurrenceFrequency | null; account_id: string | null; exclude_from_monthly: boolean; goal_id: string | null }) => {
    setEditingId(tx.id);
    setEditDate(tx.date);
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category || categories[0] || "Other");
    setEditMerchant(tx.merchant || "");
    setEditIsRecurring(tx.is_recurring);
    setEditRecurrence(tx.recurrence || "monthly");
    setEditExcludeFromMonthly(tx.exclude_from_monthly);
    setEditGoalId(tx.goal_id || "");
    setEditAccountId(tx.account_id || "");
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const amt = parseFloat(editAmount);
      if (isNaN(amt) || amt <= 0) return;
      const tx = transactions.find((t) => t.id === id);
      const updates: Record<string, unknown> = {
        date: editDate,
        amount: amt,
        category: editCategory,
        merchant: editMerchant || null,
        is_recurring: editIsRecurring,
        recurrence: editIsRecurring ? editRecurrence : null,
        exclude_from_monthly: editExcludeFromMonthly,
        goal_id: editGoalId || null,
      };
      if (!tx?.linked_charge_id) {
        updates.account_id = editAccountId || null;
      }
      await updateTransaction(id, updates);
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

  return (
    <>
      <div data-tour="expenses-header">
      <PageHeader
        title="Expenses"
        description="Track and categorize your spending"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        }
      />
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Expenses"
          value={m(totalExpensesBase)}
          subtitle={filterMonth || filterCategory || filterBankId ? "Filtered" : "All time"}
          icon={<ArrowDownUp className="h-5 w-5" />}
        />
        <StatCard
          title="Transactions"
          value={expenseTransactions.length.toString()}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title="Avg per Transaction"
          value={m(
            expenseTransactions.length > 0
              ? totalExpensesBase / expenseTransactions.length
              : 0
          )}
          icon={<ArrowDownUp className="h-5 w-5" />}
        />
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div data-tour="category-breakdown" className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            Category Breakdown
          </h3>
          <div className="flex flex-wrap gap-2">
            {categoryBreakdown.map(({ name, amount }) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2"
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${getCategoryColorTw(name)}`}
                />
                <span className="text-xs text-text-secondary">{name}</span>
                <span className="text-xs font-semibold text-text-primary">
                  {m(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-text-secondary" />
        <select
          value={filterBankId}
          onChange={(e) => setFilterBankId(e.target.value)}
          className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          {creditCards.length > 0 && (
            <optgroup label="Credit Cards">
              {creditCards.map((cc) => (
                <option key={cc.id} value={`cc:${cc.id}`}>
                  💳 {cc.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {format(new Date(m + "-01T00:00:00"), "MMMM yyyy")}
            </option>
          ))}
        </select>
        {(filterCategory || filterMonth || filterBankId) && (
          <button
            onClick={() => {
              setFilterBankId("");
              setFilterCategory("");
              setFilterMonth("");
            }}
            className="text-xs text-accent-blue hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {expenseTransactions.length === 0 ? (
        <EmptyState
          icon={<ArrowDownUp className="h-6 w-6" />}
          title="No expenses found"
          description={
            filterCategory || filterMonth || filterBankId
              ? "Try adjusting your filters."
              : "Add your first expense to start tracking spending."
          }
          action={
            !filterCategory && !filterMonth && !filterBankId ? (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
              >
                Add Expense
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle">
          <table className="w-full min-w-[600px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("date")}>
                  Date<SortIcon col="date" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("amount")}>
                  Amount<SortIcon col="amount" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("category")}>
                  Category<SortIcon col="category" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary max-w-[180px]" onClick={() => toggleSort("merchant")}>
                  Merchant<SortIcon col="merchant" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("account")}>
                  Account<SortIcon col="account" />
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
              {sortedExpenses.map((tx) => {
                const acct = accounts.find((a) => a.id === tx.account_id);
                // Resolve credit card name for CC-linked transactions
                const linkedCharge = tx.linked_charge_id
                  ? creditCardCharges.find((c) => c.id === tx.linked_charge_id)
                  : null;
                const linkedCard = linkedCharge
                  ? creditCards.find((c) => c.id === linkedCharge.card_id)
                  : null;
                const accountDisplay = acct?.name || (linkedCard ? `💳 ${linkedCard.name}` : null) || "—";
                const isEditing = editingId === tx.id;
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {isEditing ? (
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                          className="w-full max-w-[140px] rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                      ) : (
                        format(new Date(tx.date + "T00:00:00"), "MMM d, yyyy")
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-red-400">
                      {isEditing ? (
                        <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                          className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                      ) : showBalances ? (
                        <span>
                          -{formatMoney(tx.amount, tx.currency)}
                          {(() => {
                            const paymentCurrency = acct?.currency ?? linkedCard?.currency;
                            if (paymentCurrency && paymentCurrency !== tx.currency) {
                              const converted = convertCurrency(tx.amount, tx.currency, paymentCurrency, fx);
                              return <span className="block text-[10px] font-normal text-text-secondary">{formatMoney(converted, paymentCurrency)}</span>;
                            }
                            return null;
                          })()}
                        </span>
                      ) : HIDDEN_BALANCE}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                          className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple">
                          {!categories.includes(editCategory) && (
                            <option value={editCategory}>{editCategory}</option>
                          )}
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${getCategoryColorTw(tx.category || "Other")}`} />
                          <span className="text-text-primary">{tx.category || "Other"}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-[180px]">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input type="text" value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)}
                            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditIsRecurring(!editIsRecurring)}
                              className={`relative h-5 w-9 shrink-0 rounded-full transition ${editIsRecurring ? "bg-accent-purple" : "bg-bg-elevated border border-border-subtle"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${editIsRecurring ? "translate-x-4" : ""}`} />
                            </button>
                            <span className="text-[10px] text-text-secondary">Recurring</span>
                          </div>
                          {editIsRecurring && (
                            <select
                              value={editRecurrence}
                              onChange={(e) => setEditRecurrence(e.target.value as RecurrenceFrequency)}
                              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="bi-weekly">Bi-weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditExcludeFromMonthly(!editExcludeFromMonthly)}
                              className={`relative h-5 w-9 shrink-0 rounded-full transition ${editExcludeFromMonthly ? "bg-accent-purple" : "bg-bg-elevated border border-border-subtle"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${editExcludeFromMonthly ? "translate-x-4" : ""}`} />
                            </button>
                            <span className="text-[10px] text-text-secondary">Exclude monthly</span>
                          </div>
                          {goals.length > 0 && (
                            <select
                              value={editGoalId}
                              onChange={(e) => setEditGoalId(e.target.value)}
                              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple"
                              title="Link to goal"
                            >
                              <option value="">No goal</option>
                              {goals.map((g) => (
                                <option key={g.id} value={g.id}>↳ {g.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-[200px]">
                          <span className="block truncate text-text-primary" title={tx.merchant || undefined}>{tx.merchant || "—"}</span>
                          {tx.notes && (
                            <span className="block truncate text-[10px] text-text-secondary/70" title={tx.notes}>{tx.notes}</span>
                          )}
                          {tx.is_recurring && (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-accent-purple/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-purple brightness-125" title={tx.recurrence || "recurring"}>
                              <Repeat className="h-2.5 w-2.5" /> {tx.recurrence}
                            </span>
                          )}
                          {tx.exclude_from_monthly && (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400" title="Excluded from monthly totals">
                              Excluded
                            </span>
                          )}
                          {tx.goal_id && (() => {
                            const g = goals.find((g) => g.id === tx.goal_id);
                            return g ? (
                              <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400" title={`Counted against goal: ${g.name}`}>
                                ↳ {g.name}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {isEditing ? (
                        <select value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}
                          className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple">
                          <option value="">Select…</option>
                          {accounts.length > 0 && (
                            <optgroup label="Accounts">
                              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </optgroup>
                          )}
                          {creditCards.length > 0 && (
                            <optgroup label="Credit Cards">
                              {creditCards.map((cc) => <option key={cc.id} value={`cc:${cc.id}`}>💳 {cc.name}</option>)}
                            </optgroup>
                          )}
                        </select>
                      ) : (
                        <span className="block max-w-[140px] truncate" title={accountDisplay}>{accountDisplay}</span>
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
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSaveEdit(tx.id)} disabled={saving}
                            className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10" title="Save">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400" title="Cancel">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {tx.is_recurring && (
                            <button onClick={() => handleDuplicate(tx)} disabled={saving}
                              title="Duplicate this recurring transaction"
                              className="rounded-lg p-1 text-text-secondary hover:bg-accent-purple/10 hover:text-accent-purple">
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => startEdit(tx)}
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

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full max-w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple [&::-webkit-datetime-edit]:min-w-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                />
                <select
                  value={expenseCurrency || (accountId.startsWith("cc:") ? creditCards.find((c) => c.id === accountId.slice(3))?.currency ?? baseCurrency : accounts.find((a) => a.id === accountId)?.currency ?? baseCurrency)}
                  onChange={(e) => setExpenseCurrency(e.target.value as CurrencyCode)}
                  className="w-20 shrink-0 rounded-xl border border-border-subtle bg-bg-elevated px-2 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>
              {(() => {
                const amt = parseFloat(amount);
                if (!amt || amt <= 0) return null;
                const selectedCurrency = expenseCurrency || (accountId.startsWith("cc:") ? creditCards.find((c) => c.id === accountId.slice(3))?.currency : accounts.find((a) => a.id === accountId)?.currency) || baseCurrency;
                const acctCurrency = accountId.startsWith("cc:")
                  ? creditCards.find((c) => c.id === accountId.slice(3))?.currency
                  : accounts.find((a) => a.id === accountId)?.currency;
                if (!acctCurrency || acctCurrency === selectedCurrency) return null;
                const converted = convertCurrency(amt, selectedCurrency as CurrencyCode, acctCurrency, fx);
                return (
                  <p className="text-[11px] text-text-secondary mt-1">
                    ≈ {formatMoney(converted, acctCurrency)} in account currency
                  </p>
                );
              })()}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Pay From
              </label>
              {accounts.length === 0 && creditCards.length === 0 ? (
                <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-400">
                  Create an account or credit card first.
                </p>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                >
                  <option value="">Select account or card…</option>
                  {accounts.length > 0 && (
                    <optgroup label="Accounts">
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type}, {a.currency})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {creditCards.length > 0 && (
                    <optgroup label="Credit Cards">
                      {creditCards.map((cc) => (
                        <option key={cc.id} value={`cc:${cc.id}`}>
                          {cc.name} ({cc.currency})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Merchant
            </label>
            <input
              id="expense-merchant"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              onBlur={(e) => {
                const notesEl = document.getElementById("expense-notes") as HTMLInputElement | null;
                autoCategorize(e.target.value, notesEl?.value);
              }}
              placeholder="e.g., Trader Joe's"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
            {autoCategorizePending && (
              <p className="mt-1 text-[10px] text-accent-purple">Suggesting category…</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Notes <span className="text-text-secondary/50">(optional)</span>
            </label>
            <input
              id="expense-notes"
              type="text"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              onBlur={(e) => {
                const merchantEl = document.getElementById("expense-merchant") as HTMLInputElement | null;
                autoCategorize(merchantEl?.value || "", e.target.value);
              }}
              placeholder="Add a note..."
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${isRecurring ? "bg-accent-purple" : "bg-bg-elevated"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isRecurring ? "translate-x-5" : ""}`} />
            </button>
            <span className="text-sm text-text-primary">Recurring expense</span>
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
            <span className="text-sm text-text-primary">Exclude from monthly totals</span>
          </div>
          {goals.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Link to goal (optional)</label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="">None</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
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
              disabled={saving || (accounts.length === 0 && creditCards.length === 0)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Expense
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
