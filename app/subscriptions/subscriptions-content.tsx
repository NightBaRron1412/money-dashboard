"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useMoneyData } from "../hooks/use-money-data";
import { useMoneyFx } from "../hooks/use-money-fx";
import { useBalanceVisibility } from "../balance-visibility-provider";
import type { DetectedSubscription } from "@/lib/money/subscription-detection";
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
  CreditCard,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Pause,
  Play,
  Calendar,
  DollarSign,
  Check,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
} from "lucide-react";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  createTransaction,
  createLinkedCreditCardCharge,
} from "@/lib/money/queries";
import type {
  Subscription,
  RecurrenceFrequency,
  CurrencyCode,
} from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  "Cloud",
  "Finance",
  "Fitness",
  "Food",
  "Gaming",
  "Music",
  "News",
  "Software",
  "Streaming",
  "Other",
] as const;

function monthlyEquivalent(amount: number, freq: RecurrenceFrequency): number {
  switch (freq) {
    case "weekly":
      return amount * (52 / 12);
    case "bi-weekly":
      return amount * (26 / 12);
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
}

function yearlyEquivalent(amount: number, freq: RecurrenceFrequency): number {
  return monthlyEquivalent(amount, freq) * 12;
}

function frequencyLabel(freq: RecurrenceFrequency): string {
  switch (freq) {
    case "weekly":
      return "Weekly";
    case "bi-weekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
  }
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const DEMO_DETECTED_SUBS: DetectedSubscription[] = [
  { merchant: "Uber Eats", avgAmount: 42, frequency: "monthly", occurrences: 4, lastDate: "2026-02-15", confidence: 82, currency: "CAD" },
  { merchant: "Spotify", avgAmount: 11.99, frequency: "monthly", occurrences: 6, lastDate: "2026-02-10", confidence: 95, currency: "CAD" },
];

export function SubscriptionsContent() {
  const pathname = usePathname();
  const isDemoMode = pathname.startsWith("/demo");
  const { subscriptions, accounts, creditCards, settings, loading, refresh } = useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => (showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE);

  /* Form state */
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [category, setCategory] = useState("Other");
  const [nextBilling, setNextBilling] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [defaultPaymentAccountId, setDefaultPaymentAccountId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  /* Payment modal state */
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentError, setPaymentError] = useState("");

  /* Inline edit state */
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [editSubAmount, setEditSubAmount] = useState("");
  const [editSubCurrency, setEditSubCurrency] = useState<CurrencyCode>("CAD");
  const [editSubFrequency, setEditSubFrequency] = useState<RecurrenceFrequency>("monthly");
  const [editSubNextBilling, setEditSubNextBilling] = useState("");

  // Detected subscriptions (AI feature)
  const [detectedSubs, setDetectedSubs] = useState<DetectedSubscription[]>([]);
  const [detectLoading, setDetectLoading] = useState(false);

  const fetchDetectedSubs = useCallback(async () => {
    setDetectLoading(true);
    try {
      const res = await fetch("/api/ai/detect-subscriptions");
      if (!res.ok) { setDetectLoading(false); return; }
      const data = await res.json();
      setDetectedSubs(data.detected ?? []);
    } catch { /* silent */ } finally {
      setDetectLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setDetectedSubs(DEMO_DETECTED_SUBS);
      return;
    }
    fetchDetectedSubs();
  }, [fetchDetectedSubs, isDemoMode]);

  const handleAddDetected = async (d: DetectedSubscription) => {
    setSaving(true);
    try {
      await createSubscription({
        name: d.merchant,
        amount: d.avgAmount,
        currency: d.currency as CurrencyCode,
        frequency: d.frequency,
        category: "Other",
        next_billing: d.lastDate,
        is_active: true,
        notes: "Auto-detected",
        payment_account_id: null,
      });
      setDetectedSubs((prev) => prev.filter((s) => s.merchant !== d.merchant));
      await refresh();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (sub: Subscription) => {
    setInlineEditId(sub.id);
    setEditSubName(sub.name);
    setEditSubAmount(sub.amount.toString());
    setEditSubCurrency(sub.currency ?? baseCurrency);
    setEditSubFrequency(sub.frequency);
    setEditSubNextBilling(sub.next_billing);
  };

  const handleInlineSave = async (id: string) => {
    const amt = parseFloat(editSubAmount);
    if (isNaN(amt) || amt <= 0 || !editSubName.trim()) return;
    setSaving(true);
    try {
      await updateSubscription(id, {
        name: editSubName.trim(),
        amount: amt,
        currency: editSubCurrency,
        frequency: editSubFrequency,
        next_billing: editSubNextBilling,
      });
      await refresh();
      setInlineEditId(null);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  /* Sorting */
  const [sortKey, setSortKey] = useState<"name" | "amount" | "monthly" | "next">("next");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "next" ? "asc" : "asc"); }
  };
  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  const sortSubs = (list: Subscription[]) => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "monthly": cmp = convertCurrency(monthlyEquivalent(a.amount, a.frequency), a.currency ?? baseCurrency, baseCurrency, fx) - convertCurrency(monthlyEquivalent(b.amount, b.frequency), b.currency ?? baseCurrency, baseCurrency, fx); break;
        case "next": cmp = a.next_billing.localeCompare(b.next_billing); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  /* Computed */
  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.is_active),
    [subscriptions]
  );
  const inactiveSubs = useMemo(
    () => subscriptions.filter((s) => !s.is_active),
    [subscriptions]
  );

  const totalMonthly = useMemo(
    () =>
      activeSubs.reduce(
        (sum, s) => {
          const monthly = monthlyEquivalent(s.amount, s.frequency);
          return sum + convertCurrency(monthly, s.currency ?? baseCurrency, baseCurrency, fx);
        },
        0
      ),
    [activeSubs, fx, baseCurrency]
  );
  const totalYearly = useMemo(() => totalMonthly * 12, [totalMonthly]);

  const upcomingCount = useMemo(
    () => activeSubs.filter((s) => daysUntil(s.next_billing) <= 7).length,
    [activeSubs]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of activeSubs) {
      const cat = s.category || "Other";
      const monthly = monthlyEquivalent(s.amount, s.frequency);
      map[cat] = (map[cat] || 0) + convertCurrency(monthly, s.currency ?? baseCurrency, baseCurrency, fx);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeSubs, fx, baseCurrency]);

  /* Form handlers */
  const resetForm = () => {
    setName("");
    setAmount("");
    setCurrency(baseCurrency);
    setFrequency("monthly");
    setCategory("Other");
    setNextBilling("");
    setIsActive(true);
    setNotes("");
    setDefaultPaymentAccountId("");
    setFormError("");
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
    setEditing(null);
  };

  const openEdit = (sub: Subscription) => {
    setEditing(sub);
    setName(sub.name);
    setAmount(sub.amount.toString());
    setCurrency(sub.currency ?? baseCurrency);
    setFrequency(sub.frequency);
    setCategory(sub.category || "Other");
    setNextBilling(sub.next_billing);
    setIsActive(sub.is_active);
    setNotes(sub.notes || "");
    setDefaultPaymentAccountId(sub.payment_account_id ?? "");
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Enter a valid amount");
      return;
    }
    if (!nextBilling) {
      setFormError("Next billing date is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: amt,
        currency,
        frequency,
        category,
        next_billing: nextBilling,
        is_active: isActive,
        notes: notes.trim() || null,
        payment_account_id: defaultPaymentAccountId || null,
      };
      if (editing) {
        await updateSubscription(editing.id, payload);
      } else {
        await createSubscription(payload);
      }
      await refresh();
      setShowModal(false);
      resetForm();
      setEditing(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sub: Subscription) => {
    await updateSubscription(sub.id, { is_active: !sub.is_active });
    await refresh();
  };

  const handleDelete = async (sub: Subscription) => {
    if (!confirm(`Delete "${sub.name}" subscription?`)) return;
    await deleteSubscription(sub.id);
    await refresh();
  };

  const advanceNextBilling = (currentDate: string, freq: RecurrenceFrequency): string => {
    const date = new Date(currentDate + "T00:00:00");
    switch (freq) {
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "bi-weekly":
        date.setDate(date.getDate() + 14);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "yearly":
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split("T")[0];
  };

  const openPaymentModal = (sub: Subscription) => {
    setPayingSub(sub);
    setPaymentAccountId(sub.payment_account_id ?? "");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSub) return;
    setPaymentError("");

    if (!paymentAccountId) {
      setPaymentError("Please select an account or credit card");
      return;
    }

    const isCC = paymentAccountId.startsWith("cc:");

    setSaving(true);
    try {
      const subCurrency = payingSub.currency ?? baseCurrency;

      if (isCC) {
        const cardId = paymentAccountId.slice(3);
        const card = creditCards.find((c) => c.id === cardId);
        const cardCurrency = card?.currency ?? baseCurrency;
        const convertedAmount = subCurrency !== cardCurrency
          ? convertCurrency(payingSub.amount, subCurrency, cardCurrency, fx)
          : payingSub.amount;

        await createLinkedCreditCardCharge(
          {
            card_id: cardId,
            date: todayEST(),
            amount: Math.round(convertedAmount * 100) / 100,
            merchant: payingSub.name,
            category: "Bills",
            notes: subCurrency !== cardCurrency
              ? `Subscription payment (${frequencyLabel(payingSub.frequency).toLowerCase()}) — ${formatMoney(payingSub.amount, subCurrency)} converted`
              : `Subscription payment (${frequencyLabel(payingSub.frequency).toLowerCase()})`,
          },
          {
            currency: cardCurrency,
            cardName: card?.name ?? "Credit Card",
            is_recurring: true,
            recurrence: payingSub.frequency,
          }
        );
      } else {
        const account = accounts.find((a) => a.id === paymentAccountId);
        if (!account) {
          setPaymentError("Invalid account");
          setSaving(false);
          return;
        }
        const acctCurrency = account.currency;
        const convertedAmount = subCurrency !== acctCurrency
          ? convertCurrency(payingSub.amount, subCurrency, acctCurrency, fx)
          : payingSub.amount;

        await createTransaction({
          type: "expense",
          date: todayEST(),
          amount: Math.round(convertedAmount * 100) / 100,
          currency: acctCurrency,
          category: "Bills",
          account_id: paymentAccountId,
          from_account_id: null,
          to_account_id: null,
          merchant: payingSub.name,
          notes: subCurrency !== acctCurrency
            ? `Subscription payment (${frequencyLabel(payingSub.frequency).toLowerCase()}) — ${formatMoney(payingSub.amount, subCurrency)} converted`
            : `Subscription payment (${frequencyLabel(payingSub.frequency).toLowerCase()})`,
          is_recurring: true,
          recurrence: payingSub.frequency,
        });
      }

      // Advance next billing date
      const newNextBilling = advanceNextBilling(payingSub.next_billing, payingSub.frequency);
      await updateSubscription(payingSub.id, { next_billing: newNextBilling });

      await refresh();
      setShowPaymentModal(false);
      setPayingSub(null);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Failed to process payment");
    } finally {
      setSaving(false);
    }
  };

  /* Render */
  if (loading || !fxReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  const renderSubRow = (sub: Subscription) => {
    const days = daysUntil(sub.next_billing);
    const isOverdue = days < 0;
    const isSoon = days >= 0 && days <= 7;
    const isInlineEditing = inlineEditId === sub.id;
    return (
      <tr
        key={sub.id}
        className={`border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 ${
          !sub.is_active ? "opacity-50" : ""
        }`}
      >
        <td className="px-4 py-3">
          {isInlineEditing ? (
            <input type="text" value={editSubName} onChange={(e) => setEditSubName(e.target.value)} className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary" />
          ) : (
            <div className="flex max-w-[200px] items-center gap-1.5">
              <span className="truncate font-medium text-text-primary" title={sub.name}>{sub.name}</span>
              {sub.category && (
                <span className="shrink-0 rounded-full bg-accent-purple/20 px-2 py-0.5 text-[10px] font-medium text-accent-purple brightness-125">
                  {sub.category}
                </span>
              )}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right text-text-primary font-semibold">
          {isInlineEditing ? (
            <div className="flex items-center justify-end gap-1">
              <input type="number" step="0.01" value={editSubAmount} onChange={(e) => setEditSubAmount(e.target.value)} className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-sm text-text-primary" />
              <select value={editSubCurrency} onChange={(e) => setEditSubCurrency(e.target.value as CurrencyCode)} className="rounded-lg border border-border-subtle bg-bg-elevated px-1 py-1 text-xs text-text-primary" title="Currency">
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
              <select value={editSubFrequency} onChange={(e) => setEditSubFrequency(e.target.value as RecurrenceFrequency)} className="rounded-lg border border-border-subtle bg-bg-elevated px-1 py-1 text-xs text-text-primary">
                <option value="weekly">wk</option>
                <option value="bi-weekly">2wk</option>
                <option value="monthly">mo</option>
                <option value="yearly">yr</option>
              </select>
            </div>
          ) : (
            <>
              {showBalances ? formatMoney(sub.amount, sub.currency ?? baseCurrency) : HIDDEN_BALANCE}
              <span className="ml-1 text-[10px] font-normal text-text-secondary">
                /{frequencyLabel(sub.frequency).toLowerCase()}
              </span>
            </>
          )}
        </td>
        <td className="px-4 py-3 text-right text-text-secondary">
          {isInlineEditing ? (
            <span className="text-xs text-text-secondary">
              {formatMoney(convertCurrency(monthlyEquivalent(parseFloat(editSubAmount) || 0, editSubFrequency), editSubCurrency, baseCurrency, fx), baseCurrency)}/mo
            </span>
          ) : (
            <>
              {showBalances
                ? formatMoney(convertCurrency(monthlyEquivalent(sub.amount, sub.frequency), sub.currency ?? baseCurrency, baseCurrency, fx), baseCurrency)
                : HIDDEN_BALANCE}
              <span className="text-[10px]">/mo</span>
            </>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isInlineEditing ? (
            <input type="date" value={editSubNextBilling} onChange={(e) => setEditSubNextBilling(e.target.value)} className="w-32 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary" />
          ) : (
            <span
              className={
                isOverdue
                  ? "text-red-400"
                  : isSoon
                    ? "text-yellow-400"
                    : "text-text-secondary"
              }
            >
              {new Date(sub.next_billing + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {isOverdue && (
                <span className="ml-1 text-[10px]">({Math.abs(days)}d overdue)</span>
              )}
              {isSoon && !isOverdue && (
                <span className="ml-1 text-[10px]">
                  ({days === 0 ? "today" : `in ${days}d`})
                </span>
              )}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isInlineEditing ? (
            <span className="inline-flex gap-1">
              <button onClick={() => handleInlineSave(sub.id)} disabled={saving} className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>
              <button onClick={() => setInlineEditId(null)} className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"><X className="h-4 w-4" /></button>
            </span>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {sub.is_active && (
                <button
                  onClick={() => openPaymentModal(sub)}
                  className="rounded-lg p-1 text-text-secondary hover:bg-emerald-500/10 hover:text-emerald-400"
                  title="Mark as Paid"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => handleToggleActive(sub)}
                className={`rounded-lg p-1 transition ${
                  sub.is_active
                    ? "text-emerald-400 hover:bg-emerald-500/10"
                    : "text-text-secondary hover:bg-accent-purple/10 hover:text-accent-purple"
                }`}
                title={sub.is_active ? "Pause" : "Resume"}
              >
                {sub.is_active ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => startInlineEdit(sub)}
                className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(sub)}
                className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Track recurring subscriptions and memberships"
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Add Subscription
          </button>
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Cost"
          value={m(totalMonthly)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Yearly Cost"
          value={m(totalYearly)}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          title="Active Subs"
          value={activeSubs.length.toString()}
          subtitle={
            inactiveSubs.length > 0
              ? `${inactiveSubs.length} paused`
              : undefined
          }
          icon={<Play className="h-5 w-5" />}
        />
        <StatCard
          title="Due Soon"
          value={upcomingCount.toString()}
          subtitle="Within 7 days"
          icon={<Calendar className="h-5 w-5" />}
        />
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && showBalances && (
        <div className="mb-6 rounded-2xl border border-border-subtle bg-bg-secondary p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            Monthly by Category
          </h3>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, amt]) => (
              <div
                key={cat}
                className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs"
              >
                <span className="text-text-secondary">{cat}</span>
                <span className="ml-2 font-semibold text-text-primary">
                  {formatMoney(amt)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detected subscriptions (AI) */}
      {detectedSubs.length > 0 && (
        <div className="mb-6 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Sparkles className="h-4 w-4 text-accent-purple" />
            Detected Recurring Charges
          </h3>
          <p className="mb-3 text-xs text-text-secondary">
            These look like subscriptions based on your transaction history.
          </p>
          <div className="space-y-2">
            {detectedSubs.map((d) => (
              <div
                key={d.merchant}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{d.merchant}</p>
                  <p className="text-xs text-text-secondary">
                    ~{formatMoney(d.avgAmount, d.currency as CurrencyCode)} / {d.frequency} &middot; {d.occurrences} occurrences &middot; {d.confidence}% confidence
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddDetected(d)}
                    disabled={saving}
                    className="rounded-xl bg-accent-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-purple/80 disabled:opacity-60"
                  >
                    <Plus className="mr-1 inline h-3 w-3" />
                    Add
                  </button>
                  <button
                    onClick={async () => {
                      setDetectedSubs((prev) => prev.filter((s) => s.merchant !== d.merchant));
                      try {
                        await fetch("/api/ai/dismiss-merchant", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ merchant: d.merchant }),
                        });
                      } catch { /* silent */ }
                    }}
                    className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    title="Dismiss — won't show again"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No subscriptions yet"
          description="Add recurring subscriptions to track your monthly commitments."
          action={
            <button
              onClick={openAdd}
              className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Add Subscription
            </button>
          }
        />
      ) : (
        <>
          {/* Active subscriptions */}
          {activeSubs.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-base font-semibold text-text-primary">
                Active ({activeSubs.length})
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border-subtle bg-bg-secondary">
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("name")}>
                        Subscription<SortIcon col="name" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("amount")}>
                        Amount<SortIcon col="amount" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("monthly")}>
                        Monthly Eq.<SortIcon col="monthly" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("next")}>
                        Next Billing<SortIcon col="next" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>{sortSubs(activeSubs).map(renderSubRow)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Inactive subscriptions */}
          {inactiveSubs.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-base font-semibold text-text-secondary">
                Paused ({inactiveSubs.length})
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border-subtle bg-bg-secondary">
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("name")}>
                        Subscription<SortIcon col="name" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("amount")}>
                        Amount<SortIcon col="amount" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("monthly")}>
                        Monthly Eq.<SortIcon col="monthly" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("next")}>
                        Next Billing<SortIcon col="next" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>{sortSubs(inactiveSubs).map(renderSubRow)}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
          resetForm();
        }}
        title={editing ? "Edit Subscription" : "Add Subscription"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Netflix, Spotify…"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="9.99"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as RecurrenceFrequency)
                }
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Next Billing Date
              </label>
              <input
                type="date"
                value={nextBilling}
                onChange={(e) => setNextBilling(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-text-secondary pb-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border-subtle accent-accent-purple"
                />
                Active
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shared with family, annual plan…"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Default pay from (account or card)
            </label>
            <p className="mb-2 text-[11px] text-text-secondary">
              Link this subscription to an account or credit card. When you mark as paid, this will be pre-selected (you can still change it).
            </p>
            <select
              value={defaultPaymentAccountId}
              onChange={(e) => setDefaultPaymentAccountId(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">None — choose each time</option>
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
                setShowModal(false);
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
              {editing ? "Save Changes" : "Add Subscription"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPayingSub(null);
          setPaymentAccountId("");
          setPaymentError("");
        }}
        title="Mark as Paid"
      >
        {payingSub && (
          <form onSubmit={handleMarkAsPaid} className="space-y-4">
            <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
              <div className="text-sm text-text-secondary mb-1">Subscription</div>
              <div className="text-lg font-semibold text-text-primary">{payingSub.name}</div>
              <div className="mt-2 text-sm text-text-secondary">
                Amount: <span className="font-semibold text-text-primary">{formatMoney(payingSub.amount, payingSub.currency ?? baseCurrency)}</span>
              </div>
              {(() => {
                const isCC = paymentAccountId.startsWith("cc:");
                const subCur = payingSub.currency ?? baseCurrency;
                if (isCC) {
                  const card = creditCards.find(c => c.id === paymentAccountId.slice(3));
                  if (card && card.currency !== subCur) {
                    const converted = convertCurrency(payingSub.amount, subCur, card.currency, fx);
                    return (
                      <div className="mt-1 text-sm text-yellow-400">
                        ≈ {formatMoney(Math.round(converted * 100) / 100, card.currency)} will be charged
                      </div>
                    );
                  }
                } else {
                  const selectedAcct = accounts.find(a => a.id === paymentAccountId);
                  if (selectedAcct && selectedAcct.currency !== subCur) {
                    const converted = convertCurrency(payingSub.amount, subCur, selectedAcct.currency, fx);
                    return (
                      <div className="mt-1 text-sm text-yellow-400">
                        ≈ {formatMoney(Math.round(converted * 100) / 100, selectedAcct.currency)} will be deducted
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Pay from {payingSub.payment_account_id ? "(change if needed)" : ""}
              </label>
              {accounts.length === 0 && creditCards.length === 0 ? (
                <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-400">
                  Create an account or credit card first.
                </p>
              ) : (
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
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

            {paymentError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {paymentError}
              </p>
            )}

            <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 px-4 py-2.5 text-xs text-text-secondary">
              This will {paymentAccountId.startsWith("cc:") ? "add a credit card charge" : "create an expense transaction"} and advance the next billing date to{" "}
              <span className="font-semibold text-text-primary">
                {new Date(advanceNextBilling(payingSub.next_billing, payingSub.frequency) + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              .
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPayingSub(null);
                  setPaymentAccountId("");
                  setPaymentError("");
                }}
                className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (accounts.length === 0 && creditCards.length === 0)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Mark as Paid
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
