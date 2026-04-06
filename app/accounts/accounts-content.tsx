"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
  PiggyBank,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  Pencil,
  ArrowRightLeft,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  BookOpen,
} from "lucide-react";
import {
  createAccount,
  updateAccount,
  deleteAccount as deleteAccountApi,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  computeCreditCardBalance,
} from "@/lib/money/queries";
import type { AccountType, Account, CurrencyCode, TransactionWithBalance } from "@/lib/money/database.types";
import { convertCurrency } from "@/lib/money/fx";
import { format } from "date-fns";
import { useBalanceVisibility } from "../balance-visibility-provider";

export function AccountsContent() {
  const { accounts, transactions, balances, creditCards, creditCardCharges, creditCardPayments, settings, loading, refresh } = useMoneyData();
  const { fx, ready: fxReady } = useMoneyFx();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState<CurrencyCode>("CAD");
  const [startingBalance, setStartingBalance] = useState("");
  const [formError, setFormError] = useState("");

  // Edit state
  const [editing, setEditing] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("checking");
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>("CAD");
  const [editStarting, setEditStarting] = useState("");
  const [editError, setEditError] = useState("");

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReceivedAmount, setTransferReceivedAmount] = useState("");
  const [transferRate, setTransferRate] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferDate, setTransferDate] = useState(todayEST());

  // Balance correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionAccountId, setCorrectionAccountId] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionError, setCorrectionError] = useState("");

  // Inline transfer edit state
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editTxDate, setEditTxDate] = useState("");
  const [editTxFrom, setEditTxFrom] = useState("");
  const [editTxTo, setEditTxTo] = useState("");
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxReceivedAmount, setEditTxReceivedAmount] = useState("");
  const [editTxNote, setEditTxNote] = useState("");

  // Transfer sorting
  // Running balance ledger state
  const [ledgerAccountId, setLedgerAccountId] = useState<string>("");
  const [ledgerTxs, setLedgerTxs] = useState<TransactionWithBalance[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadLedger = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setLedgerAccountId(accountId);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/running-balance?account_id=${accountId}`);
      const data = await res.json();
      if (res.ok) {
        setLedgerTxs(data.transactions || []);
      }
    } catch { /* ignore */ }
    finally { setLedgerLoading(false); }
  }, []);

  const [txSortKey, setTxSortKey] = useState<"date" | "from" | "to" | "amount">("date");
  const [txSortDir, setTxSortDir] = useState<"asc" | "desc">("desc");
  const toggleTxSort = (key: typeof txSortKey) => {
    if (txSortKey === key) setTxSortDir(d => d === "asc" ? "desc" : "asc");
    else { setTxSortKey(key); setTxSortDir(key === "date" ? "desc" : "asc"); }
  };
  const TxSortIcon = ({ col }: { col: typeof txSortKey }) =>
    txSortKey === col ? (txSortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  // Ledger sorting
  const [ledgerSortKey, setLedgerSortKey] = useState<"date" | "type" | "description" | "amount" | "balance">("date");
  const [ledgerSortDir, setLedgerSortDir] = useState<"asc" | "desc">("desc");
  const toggleLedgerSort = (key: typeof ledgerSortKey) => {
    if (ledgerSortKey === key) setLedgerSortDir(d => d === "asc" ? "desc" : "asc");
    else { setLedgerSortKey(key); setLedgerSortDir(key === "date" ? "desc" : "asc"); }
  };
  const LedgerSortIcon = ({ col }: { col: typeof ledgerSortKey }) =>
    ledgerSortKey === col ? (ledgerSortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : null;

  const sortedLedgerTxs = useMemo(() => {
    const sorted = [...ledgerTxs];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (ledgerSortKey) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "description": cmp = (a.merchant || a.category || a.notes || "").localeCompare(b.merchant || b.category || b.notes || ""); break;
        case "amount": cmp = a.signed_amount - b.signed_amount; break;
        case "balance": cmp = a.running_balance - b.running_balance; break;
      }
      if (cmp === 0) {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = (a.created_at || "").localeCompare(b.created_at || "");
      }
      return ledgerSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [ledgerTxs, ledgerSortKey, ledgerSortDir]);

  const startEditTransfer = (tx: { id: string; date: string; from_account_id: string | null; to_account_id: string | null; amount: number; received_amount: number | null; notes: string | null }) => {
    setEditingTransferId(tx.id);
    setEditTxDate(tx.date);
    setEditTxFrom(tx.from_account_id || "");
    setEditTxTo(tx.to_account_id || "");
    setEditTxAmount(tx.amount.toString());
    setEditTxReceivedAmount(tx.received_amount?.toString() || "");
    setEditTxNote(tx.notes || "");
  };

  const handleSaveTransfer = async (id: string) => {
    const amt = parseFloat(editTxAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!editTxFrom || !editTxTo || editTxFrom === editTxTo) return;
    const fromA = accounts.find((a) => a.id === editTxFrom);
    const toA = accounts.find((a) => a.id === editTxTo);
    const isCross = fromA && toA && fromA.currency !== toA.currency;
    const recv = isCross ? parseFloat(editTxReceivedAmount) : null;
    if (isCross && (!recv || recv <= 0)) return;
    setSaving(true);
    try {
      await updateTransaction(id, {
        date: editTxDate,
        amount: amt,
        from_account_id: editTxFrom,
        to_account_id: editTxTo,
        notes: editTxNote.trim() || null,
        received_amount: recv,
      });
      await refresh();
      setEditingTransferId(null);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const cashTotalBase = accounts
    .filter((a) => a.type === "checking")
    .reduce((sum, a) => {
      const bal = balances[a.id] || 0;
      return sum + convertCurrency(bal, a.currency, baseCurrency, fx);
    }, 0);
  const investTotalBase = accounts
    .filter((a) => a.type === "investing")
    .reduce((sum, a) => {
      const bal = balances[a.id] || 0;
      return sum + convertCurrency(bal, a.currency, baseCurrency, fx);
    }, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const sb = parseFloat(startingBalance) || 0;
      await createAccount({ name: name.trim(), type, currency, starting_balance: sb });
      await refresh();
      setShowAdd(false);
      setName("");
      setStartingBalance("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (acct: Account) => {
    setEditing(acct);
    setEditName(acct.name);
    setEditType(acct.type);
    setEditCurrency(acct.currency);
    setEditStarting((acct.starting_balance ?? 0).toString());
    setEditError("");
  };

  const fromAcct = accounts.find((a) => a.id === transferFrom);
  const toAcct = accounts.find((a) => a.id === transferTo);
  const isCrossCurrency = !!(fromAcct && toAcct && fromAcct.currency !== toAcct.currency);

  const computeDefaultRate = useCallback(() => {
    if (!fromAcct || !toAcct || fromAcct.currency === toAcct.currency) return "";
    return convertCurrency(1, fromAcct.currency, toAcct.currency, fx).toFixed(4);
  }, [fromAcct, toAcct, fx]);

  useEffect(() => {
    if (isCrossCurrency) {
      const r = computeDefaultRate();
      if (r) {
        setTransferRate(r);
        const amt = parseFloat(transferAmount);
        if (amt > 0) setTransferReceivedAmount((amt * parseFloat(r)).toFixed(2));
      }
    } else {
      setTransferRate("");
      setTransferReceivedAmount("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferFrom, transferTo, isCrossCurrency, computeDefaultRate]);

  const handleFromAmountChange = (val: string) => {
    setTransferAmount(val);
    const amt = parseFloat(val);
    const rate = parseFloat(transferRate);
    if (amt > 0 && rate > 0) setTransferReceivedAmount((amt * rate).toFixed(2));
  };

  const handleReceivedAmountChange = (val: string) => {
    setTransferReceivedAmount(val);
    const recv = parseFloat(val);
    const rate = parseFloat(transferRate);
    if (recv > 0 && rate > 0) setTransferAmount((recv / rate).toFixed(2));
  };

  const handleRateChange = (val: string) => {
    setTransferRate(val);
    const rate = parseFloat(val);
    const amt = parseFloat(transferAmount);
    if (rate > 0 && amt > 0) setTransferReceivedAmount((amt * rate).toFixed(2));
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError("");
    if (!transferFrom) { setTransferError("Select source account"); return; }
    if (!transferTo) { setTransferError("Select destination account"); return; }
    if (transferFrom === transferTo) { setTransferError("Pick two different accounts"); return; }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) { setTransferError("Enter a valid amount"); return; }
    if (!fromAcct || !toAcct) { setTransferError("Invalid account selection"); return; }

    let receivedAmount: number | null = null;
    if (isCrossCurrency) {
      receivedAmount = parseFloat(transferReceivedAmount);
      if (!receivedAmount || receivedAmount <= 0) { setTransferError("Enter the received amount"); return; }
    }

    setSaving(true);
    try {
      await createTransaction({
        type: "transfer",
        date: transferDate,
        amount: amt,
        currency: fromAcct.currency,
        category: "Transfer",
        account_id: null,
        from_account_id: transferFrom,
        to_account_id: transferTo,
        merchant: null,
        notes: transferNote.trim() || null,
        is_recurring: false,
        recurrence: null,
        received_amount: receivedAmount,
      });
      await refresh();
      setShowTransfer(false);
      setTransferFrom("");
      setTransferTo("");
      setTransferAmount("");
      setTransferReceivedAmount("");
      setTransferRate("");
      setTransferNote("");
      setTransferDate(todayEST());
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionError("");
    const acct = accounts.find((a) => a.id === correctionAccountId);
    if (!acct) { setCorrectionError("Invalid account"); return; }
    const target = parseFloat(correctionAmount);
    if (isNaN(target)) { setCorrectionError("Enter a valid amount"); return; }
    const current = balances[acct.id] || 0;
    const diff = Math.round((target - current) * 100) / 100;
    if (diff === 0) { setCorrectionError("Balance already matches"); return; }

    setSaving(true);
    try {
      await createTransaction({
        type: "correction",
        date: todayEST(),
        amount: Math.abs(diff),
        currency: acct.currency,
        category: "Balance Correction",
        account_id: null,
        from_account_id: diff < 0 ? acct.id : null,
        to_account_id: diff > 0 ? acct.id : null,
        merchant: null,
        notes: `Corrected from ${formatMoney(current, acct.currency)} to ${formatMoney(target, acct.currency)}`,
        is_recurring: false,
        recurrence: null,
      });
      await refresh();
      setShowCorrection(false);
    } catch (err: unknown) {
      setCorrectionError(err instanceof Error ? err.message : "Correction failed");
    } finally {
      setSaving(false);
    }
  };

  const openCorrection = (acctId: string) => {
    setCorrectionAccountId(acctId);
    setCorrectionAmount("");
    setCorrectionError("");
    setShowCorrection(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError("");
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateAccount(editing.id, {
        name: editName.trim(),
        type: editType,
        currency: editCurrency,
        starting_balance: parseFloat(editStarting) || 0,
      });
      await refresh();
      setEditing(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, accountName: string) => {
    const linkedTxs = transactions.filter(
      (t) =>
        t.account_id === id ||
        t.from_account_id === id ||
        t.to_account_id === id
    );
    if (linkedTxs.length > 0) {
      const ok = confirm(
        `"${accountName}" has ${linkedTxs.length} linked transaction(s). These references will be cleared. Continue?`
      );
      if (!ok) return;
    } else {
      if (!confirm(`Delete "${accountName}"?`)) return;
    }
    await deleteAccountApi(id);
    await refresh();
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
      <PageHeader
        title="Accounts"
        description="Manage your financial accounts"
        action={
          <div className="flex items-center gap-2">
            {accounts.length >= 2 && (
              <button
                onClick={() => setShowTransfer(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:-translate-y-0.5 hover:border-accent-blue/40"
              >
                <ArrowRightLeft className="h-4 w-4" /> Transfer
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" /> Add Account
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title={`Checking Total (≈ ${baseCurrency})`}
          value={m(cashTotalBase)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title={`Investing Total (≈ ${baseCurrency})`}
          value={m(investTotalBase)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Accounts"
          value={accounts.length.toString()}
          icon={<PiggyBank className="h-5 w-5" />}
        />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No accounts"
          description="Create your first account to start tracking."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => {
            const bal = balances[acct.id] || 0;
            const txCount = transactions.filter(
              (t) =>
                t.account_id === acct.id ||
                t.from_account_id === acct.id ||
                t.to_account_id === acct.id
            ).length;
            return (
              <div
                key={acct.id}
                className="rounded-2xl border border-border-subtle bg-bg-secondary p-5 transition hover:border-accent-blue/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        acct.type === "investing"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-accent-blue/10 text-accent-blue"
                      }`}
                    >
                      {acct.type === "investing" ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <Wallet className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {acct.name}
                      </h3>
                      <p className="text-xs text-text-secondary capitalize">
                        {acct.type} • {acct.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(acct)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acct.id, acct.name)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-text-primary">
                    {showBalances ? formatMoney(bal, acct.currency) : HIDDEN_BALANCE}
                  </p>
                  {(() => {
                    // Pending CC payments for this account
                    const pendingCC = creditCards
                      .filter((c) => c.linked_account_id === acct.id)
                      .reduce((sum, c) => {
                        const ccBal = computeCreditCardBalance(c.id, creditCardCharges, creditCardPayments);
                        return sum + (ccBal > 0 ? ccBal : 0);
                      }, 0);
                    const afterCC = bal - pendingCC;
                    return showBalances && pendingCC > 0 ? (
                      <div className="mt-1.5 flex items-center justify-between rounded-lg bg-yellow-500/5 px-2 py-1">
                        <span className="text-[10px] text-text-secondary">After CC payments</span>
                        <span className="text-xs font-semibold text-yellow-400">
                          {formatMoney(afterCC, acct.currency)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-text-secondary">
                      {txCount} transaction{txCount !== 1 ? "s" : ""}
                    </p>
                    {(acct.starting_balance ?? 0) > 0 && (
                      <p className="text-xs text-text-secondary">
                        Starting: {showBalances ? formatMoney(acct.starting_balance ?? 0, acct.currency) : HIDDEN_BALANCE}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => loadLedger(acct.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent-blue hover:text-accent-blue"
                    >
                      <BookOpen className="h-3 w-3" /> Ledger
                    </button>
                    <button
                      onClick={() => openCorrection(acct.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent-purple hover:text-accent-purple"
                    >
                      <Check className="h-3 w-3" /> Correct
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer History */}
      {(() => {
        const transfers = transactions
          .filter((t) => t.type === "transfer");
        if (transfers.length === 0) return null;
        const accountName = (id: string | null) =>
          accounts.find((a) => a.id === id)?.name ?? "—";
        const sortedTransfers = [...transfers].sort((a, b) => {
          let cmp = 0;
          switch (txSortKey) {
            case "date": cmp = a.date.localeCompare(b.date); break;
            case "amount": cmp = a.amount - b.amount; break;
            case "from": cmp = (accountName(a.from_account_id)).localeCompare(accountName(b.from_account_id)); break;
            case "to": cmp = (accountName(a.to_account_id)).localeCompare(accountName(b.to_account_id)); break;
          }
          return txSortDir === "asc" ? cmp : -cmp;
        });
        return (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-semibold text-text-primary flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-accent-blue" />
              Transfer History
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-border-subtle">
              <table className="w-full min-w-[500px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-secondary">
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleTxSort("date")}>Date<TxSortIcon col="date" /></th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleTxSort("from")}>From<TxSortIcon col="from" /></th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleTxSort("to")}>To<TxSortIcon col="to" /></th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleTxSort("amount")}>Amount<TxSortIcon col="amount" /></th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-text-secondary">Note</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary sm:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransfers.map((tx) => {
                    const isEditing = editingTransferId === tx.id;
                    return (
                    <tr
                      key={tx.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-text-primary sm:px-4">
                        {isEditing ? (
                          <input type="date" value={editTxDate} onChange={(e) => setEditTxDate(e.target.value)} className="w-32 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary" />
                        ) : (
                          format(new Date(tx.date + "T00:00:00"), "MMM d, yyyy")
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-primary sm:px-4">
                        {isEditing ? (
                          <select value={editTxFrom} onChange={(e) => setEditTxFrom(e.target.value)} className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary">
                            <option value="">—</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        ) : (
                          <span className="block max-w-[130px] truncate" title={accountName(tx.from_account_id)}>{accountName(tx.from_account_id)}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-primary sm:px-4">
                        {isEditing ? (
                          <select value={editTxTo} onChange={(e) => setEditTxTo(e.target.value)} className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary">
                            <option value="">—</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        ) : (
                          <span className="block max-w-[130px] truncate" title={accountName(tx.to_account_id)}>{accountName(tx.to_account_id)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-accent-blue sm:px-4">
                        {isEditing ? (
                          <input type="number" step="0.01" value={editTxAmount} onChange={(e) => setEditTxAmount(e.target.value)} className="w-24 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-right text-sm text-text-primary" />
                        ) : showBalances ? (
                          <span>
                            {formatMoney(tx.amount, tx.currency)}
                            {tx.received_amount != null && tx.received_amount !== tx.amount && (() => {
                              const destAcct = accounts.find((a) => a.id === tx.to_account_id);
                              return <span className="block text-[10px] font-normal text-text-secondary">{"→"} {formatMoney(tx.received_amount, destAcct?.currency ?? tx.currency)}</span>;
                            })()}
                          </span>
                        ) : HIDDEN_BALANCE}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-text-secondary">
                        {isEditing ? (
                          <input type="text" value={editTxNote} onChange={(e) => setEditTxNote(e.target.value)} className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary" />
                        ) : (
                          <span className="block max-w-[160px] truncate" title={tx.notes || undefined}>{tx.notes || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right sm:px-4">
                        {isEditing ? (
                          <span className="inline-flex gap-1">
                            <button onClick={() => handleSaveTransfer(tx.id)} disabled={saving} className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setEditingTransferId(null)} className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-1">
                            <button onClick={() => startEditTransfer(tx)} className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"><Pencil className="h-3.5 w-3.5" /></button>
                            <button
                              onClick={async () => {
                                if (!confirm("Delete this transfer?")) return;
                                await deleteTransaction(tx.id);
                                await refresh();
                              }}
                              className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* Running Balance Ledger */}
      {ledgerAccountId && (() => {
        const acct = accounts.find((a) => a.id === ledgerAccountId);
        if (!acct) return null;
        return (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent-purple" />
                Ledger — {acct.name}
              </h2>
              <button
                onClick={() => { setLedgerAccountId(""); setLedgerTxs([]); }}
                className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {ledgerLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-accent-purple" />
              </div>
            ) : ledgerTxs.length === 0 ? (
              <p className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 text-center text-sm text-text-secondary">
                No transactions for this account.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                <table className="w-full min-w-[600px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border-subtle bg-bg-secondary">
                      <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleLedgerSort("date")}>Date<LedgerSortIcon col="date" /></th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleLedgerSort("type")}>Type<LedgerSortIcon col="type" /></th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleLedgerSort("description")}>Description<LedgerSortIcon col="description" /></th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleLedgerSort("amount")}>Amount<LedgerSortIcon col="amount" /></th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary sm:px-4 cursor-pointer select-none hover:text-text-primary" onClick={() => toggleLedgerSort("balance")}>Balance<LedgerSortIcon col="balance" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLedgerTxs.map((tx) => {
                      const isPositive = tx.signed_amount >= 0;
                      return (
                        <tr
                          key={tx.id}
                          className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50"
                        >
                          <td className="px-3 py-2.5 text-text-secondary sm:px-4">
                            {format(new Date(tx.date + "T00:00:00"), "MMM d, yyyy")}
                          </td>
                          <td className="px-3 py-2.5 sm:px-4">
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                              tx.category === "CC Payment"
                                ? "bg-accent-purple/10 text-accent-purple"
                                : tx.type === "income"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : tx.type === "correction"
                                    ? "bg-yellow-500/10 text-yellow-400"
                                    : tx.type === "expense"
                                      ? "bg-red-500/10 text-red-400"
                                      : "bg-accent-blue/10 text-accent-blue"
                            }`}>
                              {tx.category === "CC Payment" ? "cc payment" : tx.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-text-primary sm:px-4">
                            <span className="block max-w-[200px] truncate" title={tx.merchant || tx.category || tx.notes || undefined}>{tx.merchant || tx.category || tx.notes || "—"}</span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-medium sm:px-4 ${
                            isPositive ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {showBalances ? (
                              <span>
                                {isPositive ? "+" : ""}{formatMoney(tx.signed_amount, acct.currency)}
                                {tx.currency !== acct.currency && (
                                  <span className="block text-[10px] font-normal text-text-secondary">{formatMoney(tx.amount, tx.currency)}</span>
                                )}
                              </span>
                            ) : HIDDEN_BALANCE}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-text-primary sm:px-4">
                            {showBalances
                              ? formatMoney(tx.running_balance, acct.currency)
                              : HIDDEN_BALANCE
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

      {/* Add Account Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Account">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Savings"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="checking">Checking</option>
                <option value="investing">Investing</option>
              </select>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Starting Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
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
              onClick={() => setShowAdd(false)}
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

      {/* Edit Account Modal */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Account">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Type
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as AccountType)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="checking">Checking</option>
                <option value="investing">Investing</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Currency
              </label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Starting Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={editStarting}
                onChange={(e) => setEditStarting(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
          {editError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {editError}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
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

      {/* Transfer Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="Transfer Between Accounts">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">From</label>
              <select
                value={transferFrom}
                onChange={(e) => { setTransferFrom(e.target.value); }}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency}) — {showBalances ? formatMoney(balances[a.id] || 0, a.currency) : HIDDEN_BALANCE}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">To</label>
              <select
                value={transferTo}
                onChange={(e) => { setTransferTo(e.target.value); }}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="">Select account…</option>
                {accounts.filter((a) => a.id !== transferFrom).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-text-secondary">Date</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full max-w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple [&::-webkit-datetime-edit]:min-w-0" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Amount {fromAcct ? `(${fromAcct.currency})` : ""}
            </label>
            <input type="number" min="0.01" step="0.01" value={transferAmount} onChange={(e) => handleFromAmountChange(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple" />
          </div>

          {isCrossCurrency && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2">
                <span className="whitespace-nowrap text-xs text-text-secondary">1 {fromAcct?.currency} =</span>
                <input type="number" step="0.0001" value={transferRate} onChange={(e) => handleRateChange(e.target.value)} className="w-24 rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-center text-sm text-text-primary outline-none focus:border-accent-purple" />
                <span className="whitespace-nowrap text-xs text-text-secondary">{toAcct?.currency}</span>
                <button type="button" onClick={() => { const r = computeDefaultRate(); setTransferRate(r); const a = parseFloat(transferAmount); if (a > 0 && parseFloat(r) > 0) setTransferReceivedAmount((a * parseFloat(r)).toFixed(2)); }} className="ml-auto whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-medium text-accent-blue hover:bg-accent-blue/10">Use live rate</button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Received ({toAcct?.currency})
                </label>
                <input type="number" min="0.01" step="0.01" value={transferReceivedAmount} onChange={(e) => handleReceivedAmountChange(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple" />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Note (optional)</label>
            <input type="text" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="e.g., Moving to savings" className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple" />
          </div>
          {transferError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{transferError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowTransfer(false)} className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Balance Correction Modal */}
      <Modal open={showCorrection} onClose={() => setShowCorrection(false)} title="Correct Balance">
        <form onSubmit={handleCorrection} className="space-y-4">
          {(() => {
            const acct = accounts.find((a) => a.id === correctionAccountId);
            if (!acct) return null;
            const current = balances[acct.id] || 0;
            return (
              <>
                <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{acct.name}</span>
                    <span className="text-lg font-bold text-text-primary">{showBalances ? formatMoney(current, acct.currency) : HIDDEN_BALANCE}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">Current computed balance</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Correct Balance ({acct.currency})</label>
                  <input type="number" step="0.01" value={correctionAmount} onChange={(e) => setCorrectionAmount(e.target.value)} placeholder={current.toFixed(2)} className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple" />
                </div>
                {correctionAmount && !isNaN(parseFloat(correctionAmount)) && parseFloat(correctionAmount) !== current && (
                  <div className={`rounded-xl border px-3 py-2 text-xs ${parseFloat(correctionAmount) > current ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
                    Adjustment: {parseFloat(correctionAmount) > current ? "+" : ""}{formatMoney(Math.round((parseFloat(correctionAmount) - current) * 100) / 100, acct.currency)}
                  </div>
                )}
              </>
            );
          })()}
          {correctionError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{correctionError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCorrection(false)} className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Correction
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
