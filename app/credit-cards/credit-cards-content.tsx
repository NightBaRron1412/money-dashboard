"use client";

import { useState, useMemo, useCallback } from "react";
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
  CreditCard as CreditCardIcon,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  DollarSign,
  ShoppingCart,
  ArrowDown,
  ArrowUp,
  Wallet,
  AlertTriangle,
  Filter,
  Check,
  X,
} from "lucide-react";
import {
  createCreditCard,
  updateCreditCard,
  deleteCreditCard,
  createLinkedCreditCardCharge,
  deleteCreditCardCharge,
  updateCreditCardCharge,
  createCreditCardPayment,
  updateCreditCardPayment,
  deleteCreditCardPayment,
  computeCreditCardBalance,
} from "@/lib/money/queries";
import type { CurrencyCode, CreditCard, CreditCardCharge } from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";
import { format } from "date-fns";
import { useBalanceVisibility } from "../balance-visibility-provider";

const DEFAULT_CATEGORIES = [
  "Bills",
  "Food",
  "Fun",
  "Health",
  "Shopping",
  "Transport",
  "Travel",
  "Other",
];

export function CreditCardsContent() {
  const {
    accounts,
    creditCards,
    creditCardCharges,
    creditCardPayments,
    settings,
    balances,
    loading,
    refresh,
  } = useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) =>
    showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;

  // Add card modal
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardCurrency, setCardCurrency] = useState<CurrencyCode>("CAD");
  const [cardLimit, setCardLimit] = useState("");
  const [cardLinkedAccount, setCardLinkedAccount] = useState("");
  const [cardError, setCardError] = useState("");

  // Edit card modal
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardCurrency, setEditCardCurrency] = useState<CurrencyCode>("CAD");
  const [editCardLimit, setEditCardLimit] = useState("");
  const [editCardLinkedAccount, setEditCardLinkedAccount] = useState("");
  const [editCardError, setEditCardError] = useState("");

  // Add charge modal
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeCardId, setChargeCardId] = useState("");
  const [chargeDate, setChargeDate] = useState(todayEST());
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMerchant, setChargeMerchant] = useState("");
  const [chargeCategory, setChargeCategory] = useState("Other");
  const [chargeNotes, setChargeNotes] = useState("");
  const [chargeError, setChargeError] = useState("");
  const [autoCategorizePending, setAutoCategorizePending] = useState(false);

  const autoCategorize = useCallback(async (merchantName: string, notesText?: string) => {
    if (!merchantName.trim() && !(notesText?.trim())) return;
    if ((merchantName + (notesText || "")).trim().length < 2) return;
    setAutoCategorizePending(true);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: merchantName.trim(), notes: notesText?.trim() || undefined, categories: DEFAULT_CATEGORIES }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.category) setChargeCategory(data.category);
    } catch { /* silent */ } finally {
      setAutoCategorizePending(false);
    }
  }, []);

  // Inline edit charge state
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeDate, setEditChargeDate] = useState("");
  const [editChargeAmount, setEditChargeAmount] = useState("");
  const [editChargeMerchant, setEditChargeMerchant] = useState("");
  const [editChargeCategory, setEditChargeCategory] = useState("Other");
  const [editChargeNotes, setEditChargeNotes] = useState("");

  // Pay card modal
  const [showPay, setShowPay] = useState(false);
  const [payCardId, setPayCardId] = useState("");
  const [paySource, setPaySource] = useState<"account" | "cashback" | "credit">("account");
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayEST());
  const [payMode, setPayMode] = useState<"full" | "custom">("full");
  const [payError, setPayError] = useState("");

  // Payment inline edit
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [editPayDate, setEditPayDate] = useState("");
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayAccountId, setEditPayAccountId] = useState("");

  const [saving, setSaving] = useState(false);

  // Charge filters
  const [filterChargeCard, setFilterChargeCard] = useState("");
  const [filterChargeCategory, setFilterChargeCategory] = useState("");
  const [filterChargeMonth, setFilterChargeMonth] = useState("");

  // Payment filters
  const [filterPayCard, setFilterPayCard] = useState("");
  const [filterPayAccount, setFilterPayAccount] = useState("");
  const [filterPayMonth, setFilterPayMonth] = useState("");

  // Sorting for charges
  const [sortKey, setSortKey] = useState<"date" | "amount" | "card" | "merchant">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };
  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? (
      sortDir === "asc" ? (
        <ArrowUp className="ml-1 inline h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 inline h-3 w-3" />
      )
    ) : null;

  // Computed values
  const cardBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of creditCards) {
      map[card.id] = computeCreditCardBalance(
        card.id,
        creditCardCharges,
        creditCardPayments
      );
    }
    return map;
  }, [creditCards, creditCardCharges, creditCardPayments]);

  const totalCCDebtBase = useMemo(
    () =>
      creditCards.reduce((sum, card) => {
        const bal = cardBalances[card.id] || 0;
        return (
          sum +
          (bal > 0
            ? convertCurrency(bal, card.currency, baseCurrency, fx)
            : 0)
        );
      }, 0),
    [creditCards, cardBalances, baseCurrency, fx]
  );

  // Available months for charges
  const chargeMonths = useMemo(() => {
    const set = new Set<string>();
    for (const c of creditCardCharges) set.add(c.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [creditCardCharges]);

  // Available months for payments
  const paymentMonths = useMemo(() => {
    const set = new Set<string>();
    for (const p of creditCardPayments) set.add(p.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [creditCardPayments]);

  // Categories from charges
  const chargeCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of creditCardCharges) if (c.category) set.add(c.category);
    return Array.from(set).sort();
  }, [creditCardCharges]);

  const filteredCharges = useMemo(() => {
    let list = creditCardCharges;
    if (filterChargeCard) list = list.filter((c) => c.card_id === filterChargeCard);
    if (filterChargeCategory) list = list.filter((c) => c.category === filterChargeCategory);
    if (filterChargeMonth) list = list.filter((c) => c.date.startsWith(filterChargeMonth));
    return list;
  }, [creditCardCharges, filterChargeCard, filterChargeCategory, filterChargeMonth]);

  const filteredPayments = useMemo(() => {
    let list = creditCardPayments;
    if (filterPayCard) list = list.filter((p) => p.card_id === filterPayCard);
    if (filterPayAccount) {
      if (filterPayAccount === "cashback") {
        list = list.filter((p) => !p.account_id && !p.notes?.includes("Credit"));
      } else if (filterPayAccount === "credit") {
        list = list.filter((p) => !p.account_id && p.notes?.includes("Credit"));
      } else {
        list = list.filter((p) => p.account_id === filterPayAccount);
      }
    }
    if (filterPayMonth) list = list.filter((p) => p.date.startsWith(filterPayMonth));
    return list;
  }, [creditCardPayments, filterPayCard, filterPayAccount, filterPayMonth]);

  const sortedCharges = useMemo(() => {
    const sorted = [...filteredCharges];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "card":
          cmp = (a.card_id || "").localeCompare(b.card_id || "");
          break;
        case "merchant":
          cmp = (a.merchant || "").localeCompare(b.merchant || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredCharges, sortKey, sortDir]);

  // Running balance for credit card charges when filtered by a single card
  const ccRunningBalances = useMemo(() => {
    if (!filterChargeCard) return {};
    const events: { date: string; created_at: string; id: string; signed: number }[] = [];
    for (const c of creditCardCharges.filter((ch) => ch.card_id === filterChargeCard)) {
      events.push({ date: c.date, created_at: c.created_at, id: c.id, signed: c.amount });
    }
    for (const p of creditCardPayments.filter((py) => py.card_id === filterChargeCard)) {
      events.push({ date: p.date, created_at: p.created_at, id: p.id, signed: -p.amount });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const map: Record<string, number> = {};
    let bal = 0;
    for (const e of events) {
      bal += e.signed;
      map[e.id] = bal;
    }
    return map;
  }, [filterChargeCard, creditCardCharges, creditCardPayments]);

  const showCCBalance = !!filterChargeCard && Object.keys(ccRunningBalances).length > 0;

  // Running balance for payment history when filtered by a single card
  const payRunningBalances = useMemo(() => {
    if (!filterPayCard) return {};
    const events: { date: string; created_at: string; id: string; signed: number }[] = [];
    for (const c of creditCardCharges.filter((ch) => ch.card_id === filterPayCard)) {
      events.push({ date: c.date, created_at: c.created_at, id: c.id, signed: c.amount });
    }
    for (const p of creditCardPayments.filter((py) => py.card_id === filterPayCard)) {
      events.push({ date: p.date, created_at: p.created_at, id: p.id, signed: -p.amount });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const map: Record<string, number> = {};
    let bal = 0;
    for (const e of events) {
      bal += e.signed;
      map[e.id] = bal;
    }
    return map;
  }, [filterPayCard, creditCardCharges, creditCardPayments]);

  const showPayBalance = !!filterPayCard && Object.keys(payRunningBalances).length > 0;

  // Handlers
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError("");
    if (!cardName.trim()) {
      setCardError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await createCreditCard({
        name: cardName.trim(),
        currency: cardCurrency,
        credit_limit: parseFloat(cardLimit) || 0,
        linked_account_id: cardLinkedAccount || null,
      });
      await refresh();
      setShowAddCard(false);
      setCardName("");
      setCardLimit("");
      setCardLinkedAccount("");
    } catch (err: unknown) {
      setCardError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const openEditCard = (card: CreditCard) => {
    setEditCard(card);
    setEditCardName(card.name);
    setEditCardCurrency(card.currency);
    setEditCardLimit(card.credit_limit.toString());
    setEditCardLinkedAccount(card.linked_account_id || "");
    setEditCardError("");
  };

  const handleEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCard) return;
    setEditCardError("");
    if (!editCardName.trim()) {
      setEditCardError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateCreditCard(editCard.id, {
        name: editCardName.trim(),
        currency: editCardCurrency,
        credit_limit: parseFloat(editCardLimit) || 0,
        linked_account_id: editCardLinkedAccount || null,
      });
      await refresh();
      setEditCard(null);
    } catch (err: unknown) {
      setEditCardError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (id: string, name: string) => {
    const chargeCount = creditCardCharges.filter(
      (c) => c.card_id === id
    ).length;
    const msg = chargeCount
      ? `"${name}" has ${chargeCount} charge(s). Delete card and all its data?`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    await deleteCreditCard(id);
    await refresh();
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargeError("");
    const amt = parseFloat(chargeAmount);
    if (isNaN(amt) || amt <= 0) {
      setChargeError("Enter a valid amount");
      return;
    }
    if (!chargeCardId) {
      setChargeError("Select a card");
      return;
    }
    setSaving(true);
    try {
      const card = creditCards.find((c) => c.id === chargeCardId);
      const chargeCurrency: CurrencyCode = card?.currency ?? baseCurrency;
      await createLinkedCreditCardCharge(
        {
          card_id: chargeCardId,
          date: chargeDate,
          amount: amt,
          merchant: chargeMerchant || null,
          category: chargeCategory,
          notes: chargeNotes || null,
        },
        { currency: chargeCurrency, cardName: card?.name ?? "Credit Card" }
      );
      await refresh();
      setShowAddCharge(false);
      setChargeAmount("");
      setChargeMerchant("");
      setChargeNotes("");
    } catch (err: unknown) {
      setChargeError(err instanceof Error ? err.message : "Failed to add charge");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCharge = async (id: string) => {
    if (!confirm("Delete this charge?")) return;
    await deleteCreditCardCharge(id);
    await refresh();
  };

  const startEditCharge = (charge: CreditCardCharge) => {
    setEditingChargeId(charge.id);
    setEditChargeDate(charge.date);
    setEditChargeAmount(charge.amount.toString());
    setEditChargeMerchant(charge.merchant || "");
    setEditChargeCategory(charge.category || "Other");
    setEditChargeNotes(charge.notes || "");
  };

  const handleSaveEditCharge = async (id: string) => {
    setSaving(true);
    try {
      const amt = parseFloat(editChargeAmount);
      if (isNaN(amt) || amt <= 0) return;
      await updateCreditCardCharge(id, {
        date: editChargeDate,
        amount: amt,
        merchant: editChargeMerchant || null,
        category: editChargeCategory,
        notes: editChargeNotes || null,
      });
      await refresh();
      setEditingChargeId(null);
    } finally {
      setSaving(false);
    }
  };

  const openPayModal = (cardId: string) => {
    setPayCardId(cardId);
    const card = creditCards.find((c) => c.id === cardId);
    setPaySource("account");
    setPayAccountId(card?.linked_account_id || "");
    const bal = cardBalances[cardId] || 0;
    setPayAmount(bal > 0 ? bal.toString() : "");
    setPayMode("full");
    setPayDate(todayEST());
    setPayError("");
    setShowPay(true);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError("");
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError("Enter a valid amount");
      return;
    }
    if (paySource === "account" && !payAccountId) {
      setPayError("Select an account to pay from");
      return;
    }
    if (!payCardId) {
      setPayError("No card selected");
      return;
    }
    setSaving(true);
    try {
      await createCreditCardPayment({
        card_id: payCardId,
        account_id: paySource === "account" ? payAccountId : null,
        date: payDate,
        amount: amt,
        notes: paySource === "cashback" ? "Cashback redemption" : paySource === "credit" ? "Credit / Refund" : null,
      });
      await refresh();
      setShowPay(false);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Delete this payment?")) return;
    await deleteCreditCardPayment(id);
    await refresh();
  };

  const startEditPayment = (p: { id: string; date: string; amount: number; account_id: string | null }) => {
    setEditingPayId(p.id);
    setEditPayDate(p.date);
    setEditPayAmount(p.amount.toString());
    setEditPayAccountId(p.account_id || "");
  };

  const handleSavePaymentEdit = async (id: string) => {
    setSaving(true);
    try {
      const amt = parseFloat(editPayAmount);
      if (isNaN(amt) || amt <= 0) return;
      await updateCreditCardPayment(id, {
        date: editPayDate,
        amount: amt,
        account_id: editPayAccountId || null,
      });
      await refresh();
      setEditingPayId(null);
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
      <div data-tour="credit-cards-header">
      <PageHeader
        title="Credit Cards"
        description="Manage cards, charges, and payments"
        action={
          <div className="flex items-center gap-2">
            {creditCards.length > 0 && (
              <button
                onClick={() => setShowAddCharge(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:-translate-y-0.5 hover:border-accent-blue/40"
              >
                <ShoppingCart className="h-4 w-4" /> Add Charge
              </button>
            )}
            <button
              onClick={() => setShowAddCard(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" /> Add Card
            </button>
          </div>
        }
      />
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total CC Debt"
          value={m(totalCCDebtBase)}
          icon={<CreditCardIcon className="h-5 w-5" />}
        />
        <StatCard
          title="Cards"
          value={creditCards.length.toString()}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Charges"
          value={creditCardCharges.length.toString()}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
      </div>

      {/* Cards grid */}
      {creditCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="h-6 w-6" />}
          title="No credit cards"
          description="Add a credit card to start tracking charges and payments."
          action={
            <button
              onClick={() => setShowAddCard(true)}
              className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Add Card
            </button>
          }
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creditCards.map((card) => {
            const bal = cardBalances[card.id] || 0;
            const linkedAcct = accounts.find(
              (a) => a.id === card.linked_account_id
            );
            const utilization =
              card.credit_limit > 0 ? (bal / card.credit_limit) * 100 : 0;
            const isHighUtil = utilization > 75;
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-border-subtle bg-bg-secondary p-5 transition hover:border-accent-blue/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-purple/10 text-accent-purple">
                      <CreditCardIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {card.name}
                      </h3>
                      <p className="text-xs text-text-secondary">
                        {card.currency}
                        {linkedAcct
                          ? ` • Linked: ${linkedAcct.name}`
                          : " • No linked account"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditCard(card)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id, card.name)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-bold text-text-primary">
                      {showBalances
                        ? formatMoney(bal, card.currency)
                        : HIDDEN_BALANCE}
                    </p>
                    {card.credit_limit > 0 && (
                      <span className="text-xs text-text-secondary">
                        / {showBalances ? formatMoney(card.credit_limit, card.currency) : HIDDEN_BALANCE}
                      </span>
                    )}
                  </div>
                  {card.credit_limit > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-bg-elevated">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            isHighUtil ? "bg-red-500" : "bg-accent-purple"
                          }`}
                          style={{
                            width: `${Math.min(utilization, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-text-secondary">
                          {utilization.toFixed(0)}% utilized
                        </span>
                        {isHighUtil && (
                          <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                            <AlertTriangle className="h-2.5 w-2.5" /> High
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openPayModal(card.id)}
                    disabled={bal <= 0}
                    className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <DollarSign className="mr-1 inline h-3 w-3" />
                    Pay
                  </button>
                  <button
                    onClick={() => {
                      setChargeCardId(card.id);
                      setShowAddCharge(true);
                    }}
                    className="flex-1 rounded-xl bg-accent-purple px-3 py-2 text-xs font-medium text-white transition hover:bg-accent-purple/80"
                  >
                    <ShoppingCart className="mr-1 inline h-3 w-3" />
                    Charge
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent charges table */}
      {creditCardCharges.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
            <ShoppingCart className="h-4 w-4 text-accent-purple" />
            Recent Charges
          </h2>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-text-secondary" />
            <select
              value={filterChargeCard}
              onChange={(e) => setFilterChargeCard(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All cards</option>
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterChargeCategory}
              onChange={(e) => setFilterChargeCategory(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All categories</option>
              {chargeCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filterChargeMonth}
              onChange={(e) => setFilterChargeMonth(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All months</option>
              {chargeMonths.map((m) => (
                <option key={m} value={m}>{format(new Date(m + "-01T00:00:00"), "MMMM yyyy")}</option>
              ))}
            </select>
            {(filterChargeCard || filterChargeCategory || filterChargeMonth) && (
              <button
                onClick={() => { setFilterChargeCard(""); setFilterChargeCategory(""); setFilterChargeMonth(""); }}
                className="text-xs text-accent-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          {sortedCharges.length === 0 ? (
            <p className="rounded-2xl border border-border-subtle bg-bg-secondary px-6 py-8 text-center text-sm text-text-secondary">
              No charges match the selected filters.
            </p>
          ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle">
            <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary">
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium text-text-secondary hover:text-text-primary"
                    onClick={() => toggleSort("date")}
                  >
                    Date
                    <SortIcon col="date" />
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium text-text-secondary hover:text-text-primary"
                    onClick={() => toggleSort("card")}
                  >
                    Card
                    <SortIcon col="card" />
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium text-text-secondary hover:text-text-primary max-w-[180px]"
                    onClick={() => toggleSort("merchant")}
                  >
                    Merchant
                    <SortIcon col="merchant" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Category
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-xs font-medium text-text-secondary hover:text-text-primary"
                    onClick={() => toggleSort("amount")}
                  >
                    Amount
                    <SortIcon col="amount" />
                  </th>
                  {showCCBalance && (
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
                {sortedCharges.map((charge) => {
                  const card = creditCards.find(
                    (c) => c.id === charge.card_id
                  );
                  const isEditing = editingChargeId === charge.id;
                  return (
                    <tr
                      key={charge.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                    >
                      <td className="px-4 py-3 text-text-primary">
                        {isEditing ? (
                          <input type="date" value={editChargeDate} onChange={(e) => setEditChargeDate(e.target.value)}
                            className="w-full max-w-[140px] rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                        ) : (
                          format(new Date(charge.date + "T00:00:00"), "MMM d, yyyy")
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        <span className="block max-w-[130px] truncate" title={card?.name || undefined}>{card?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input type="text" value={editChargeMerchant} onChange={(e) => setEditChargeMerchant(e.target.value)}
                              placeholder="Merchant"
                              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                            <input type="text" value={editChargeNotes} onChange={(e) => setEditChargeNotes(e.target.value)}
                              placeholder="Notes"
                              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-secondary outline-none focus:border-accent-purple" />
                          </div>
                        ) : (
                          <span className="block max-w-[180px]">
                            <span className="block truncate" title={charge.merchant || undefined}>{charge.merchant || "—"}</span>
                            {charge.notes && <span className="block truncate text-[10px] text-text-secondary/70" title={charge.notes}>{charge.notes}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {isEditing ? (
                          <select value={editChargeCategory} onChange={(e) => setEditChargeCategory(e.target.value)}
                            className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple">
                            {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          charge.category || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-400">
                        {isEditing ? (
                          <input type="number" step="0.01" value={editChargeAmount} onChange={(e) => setEditChargeAmount(e.target.value)}
                            className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                        ) : (
                          showBalances
                            ? formatMoney(charge.amount, card?.currency ?? baseCurrency)
                            : HIDDEN_BALANCE
                        )}
                      </td>
                      {showCCBalance && (
                        <td className="px-4 py-3 text-right font-semibold text-text-primary">
                          {showBalances && ccRunningBalances[charge.id] != null
                            ? formatMoney(ccRunningBalances[charge.id], card?.currency ?? baseCurrency)
                            : showBalances ? "—" : HIDDEN_BALANCE}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleSaveEditCharge(charge.id)} disabled={saving}
                              className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10" title="Save">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditingChargeId(null)}
                              className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400" title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEditCharge(charge)}
                              className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCharge(charge.id)}
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
          )}
        </section>
      )}

      {/* Recent payments table */}
      {creditCardPayments.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Payment History
          </h2>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-text-secondary" />
            <select
              value={filterPayCard}
              onChange={(e) => setFilterPayCard(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All cards</option>
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterPayAccount}
              onChange={(e) => setFilterPayAccount(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All sources</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value="cashback">Cashback</option>
              <option value="credit">Credit / Refund</option>
            </select>
            <select
              value={filterPayMonth}
              onChange={(e) => setFilterPayMonth(e.target.value)}
              className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">All months</option>
              {paymentMonths.map((m) => (
                <option key={m} value={m}>{format(new Date(m + "-01T00:00:00"), "MMMM yyyy")}</option>
              ))}
            </select>
            {(filterPayCard || filterPayAccount || filterPayMonth) && (
              <button
                onClick={() => { setFilterPayCard(""); setFilterPayAccount(""); setFilterPayMonth(""); }}
                className="text-xs text-accent-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          {filteredPayments.length === 0 ? (
            <p className="rounded-2xl border border-border-subtle bg-bg-secondary px-6 py-8 text-center text-sm text-text-secondary">
              No payments match the selected filters.
            </p>
          ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle">
            <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Card
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Paid From
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                    Amount
                  </th>
                  {showPayBalance && (
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
                {filteredPayments.map((payment) => {
                  const card = creditCards.find(
                    (c) => c.id === payment.card_id
                  );
                  const acct = accounts.find(
                    (a) => a.id === payment.account_id
                  );
                  const isCredit = !payment.account_id && payment.notes?.includes("Credit");
                  const isCashback = !payment.account_id && !isCredit;
                  const isEditingPay = editingPayId === payment.id;
                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                    >
                      <td className="px-4 py-3 text-text-primary">
                        {isEditingPay ? (
                          <input type="date" value={editPayDate} onChange={(e) => setEditPayDate(e.target.value)}
                            className="w-full max-w-[140px] rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple" />
                        ) : format(new Date(payment.date + "T00:00:00"), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        <span className="block max-w-[130px] truncate" title={card?.name || undefined}>{card?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {isEditingPay ? (
                          <select value={editPayAccountId} onChange={(e) => setEditPayAccountId(e.target.value)}
                            className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple">
                            <option value="">No account</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        ) : payment.account_id ? (
                          <span className="block max-w-[130px] truncate" title={acct?.name || undefined}>{acct?.name || "—"}</span>
                        ) : isCredit ? (
                          <span className="inline-flex rounded-lg bg-accent-blue/10 px-2 py-0.5 text-[11px] font-medium text-accent-blue">Credit / Refund</span>
                        ) : isCashback ? (
                          <span className="inline-flex rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">Cashback</span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                        {isEditingPay ? (
                          <input type="number" step="0.01" value={editPayAmount} onChange={(e) => setEditPayAmount(e.target.value)}
                            className="w-20 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-xs text-text-primary outline-none focus:border-accent-purple" />
                        ) : showBalances
                          ? formatMoney(payment.amount, card?.currency ?? baseCurrency)
                          : HIDDEN_BALANCE}
                      </td>
                      {showPayBalance && (
                        <td className="px-4 py-3 text-right font-semibold text-text-primary">
                          {showBalances && payRunningBalances[payment.id] != null
                            ? formatMoney(payRunningBalances[payment.id], card?.currency ?? baseCurrency)
                            : showBalances ? "—" : HIDDEN_BALANCE}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        {isEditingPay ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleSavePaymentEdit(payment.id)} disabled={saving}
                              className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10" title="Save"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingPayId(null)}
                              className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400" title="Cancel"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEditPayment(payment)}
                              className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handleDeletePayment(payment.id)}
                              className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
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
        </section>
      )}

      {/* Add Card Modal */}
      <Modal
        open={showAddCard}
        onClose={() => setShowAddCard(false)}
        title="Add Credit Card"
      >
        <form onSubmit={handleAddCard} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Card Name
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g., Visa Gold"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Currency
              </label>
              <select
                value={cardCurrency}
                onChange={(e) =>
                  setCardCurrency(e.target.value as CurrencyCode)
                }
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Credit Limit
              </label>
              <input
                type="number"
                step="0.01"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Linked Account (payments come from here)
            </label>
            <select
              value={cardLinkedAccount}
              onChange={(e) => setCardLinkedAccount(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          {cardError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {cardError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddCard(false)}
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
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Card Modal */}
      <Modal
        open={editCard !== null}
        onClose={() => setEditCard(null)}
        title="Edit Credit Card"
      >
        <form onSubmit={handleEditCard} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Card Name
            </label>
            <input
              type="text"
              value={editCardName}
              onChange={(e) => setEditCardName(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Currency
              </label>
              <select
                value={editCardCurrency}
                onChange={(e) =>
                  setEditCardCurrency(e.target.value as CurrencyCode)
                }
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Credit Limit
              </label>
              <input
                type="number"
                step="0.01"
                value={editCardLimit}
                onChange={(e) => setEditCardLimit(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Linked Account
            </label>
            <select
              value={editCardLinkedAccount}
              onChange={(e) => setEditCardLinkedAccount(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          {editCardError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {editCardError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditCard(null)}
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Charge Modal */}
      <Modal
        open={showAddCharge}
        onClose={() => setShowAddCharge(false)}
        title="Add Charge"
      >
        <form onSubmit={handleAddCharge} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Date
              </label>
              <input
                type="date"
                value={chargeDate}
                onChange={(e) => setChargeDate(e.target.value)}
                className="w-full max-w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple [&::-webkit-datetime-edit]:min-w-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Card
              </label>
              <select
                value={chargeCardId}
                onChange={(e) => setChargeCardId(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="">Select card…</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category
              </label>
              <select
                value={chargeCategory}
                onChange={(e) => setChargeCategory(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Merchant
            </label>
            <input
              id="charge-merchant"
              type="text"
              value={chargeMerchant}
              onChange={(e) => setChargeMerchant(e.target.value)}
              onBlur={(e) => {
                const notesEl = document.getElementById("charge-notes") as HTMLInputElement | null;
                autoCategorize(e.target.value, notesEl?.value);
              }}
              placeholder="e.g., Amazon"
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
              id="charge-notes"
              type="text"
              value={chargeNotes}
              onChange={(e) => setChargeNotes(e.target.value)}
              onBlur={(e) => {
                const merchantEl = document.getElementById("charge-merchant") as HTMLInputElement | null;
                autoCategorize(merchantEl?.value || "", e.target.value);
              }}
              placeholder="Add a note..."
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          {chargeError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {chargeError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddCharge(false)}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || creditCards.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Charge
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Card Modal */}
      <Modal
        open={showPay}
        onClose={() => setShowPay(false)}
        title={paySource === "credit" ? "Credit Card Credit / Refund" : "Pay Credit Card"}
      >
        <form onSubmit={handlePay} className="space-y-4">
          {(() => {
            const card = creditCards.find((c) => c.id === payCardId);
            const bal = cardBalances[payCardId] || 0;
            return (
              <>
                <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      {card?.name || "Card"}
                    </span>
                    <span className="text-lg font-bold text-text-primary">
                      {showBalances
                        ? formatMoney(bal, card?.currency ?? baseCurrency)
                        : HIDDEN_BALANCE}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Current balance
                  </p>
                </div>

                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full max-w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple [&::-webkit-datetime-edit]:min-w-0"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-text-secondary">
                    Pay From
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPaySource("account")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        paySource === "account"
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                      }`}
                    >
                      Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaySource("cashback")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        paySource === "cashback"
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                      }`}
                    >
                      Cashback
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaySource("credit")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        paySource === "credit"
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                      }`}
                    >
                      Credit / Refund
                    </button>
                  </div>
                  {paySource === "account" && (
                    <select
                      value={payAccountId}
                      onChange={(e) => setPayAccountId(e.target.value)}
                      className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency}) —{" "}
                          {showBalances
                            ? formatMoney(balances[a.id] || 0, a.currency)
                            : HIDDEN_BALANCE}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-text-secondary">
                    Payment Amount
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPayMode("full");
                        setPayAmount(bal.toString());
                      }}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        payMode === "full"
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                      }`}
                    >
                      Full Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayMode("custom");
                        setPayAmount("");
                      }}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        payMode === "custom"
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                      }`}
                    >
                      Custom Amount
                    </button>
                  </div>
                  {payMode === "custom" && (
                    <input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                    />
                  )}
                </div>
              </>
            );
          })()}
          {payError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {payError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPay(false)}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
