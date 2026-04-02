"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, Square, Loader2, X, AlertTriangle, Check } from "lucide-react";
import { Modal, todayEST } from "./money-ui";
import { useVoiceRecorder } from "../hooks/use-voice-recorder";
import { createTransaction, createLinkedCreditCardCharge } from "@/lib/money/queries";
import type { Account, CreditCard, Settings, CurrencyCode, RecurrenceFrequency, ParsedVoiceTransaction } from "@/lib/money/database.types";
import { useMoneyFx } from "../hooks/use-money-fx";
import { convertCurrency } from "@/lib/money/fx";
import { cn } from "@/lib/utils";

interface VoiceTransactionProps {
  accounts: Account[];
  creditCards: CreditCard[];
  settings: Settings | null;
  refresh: () => Promise<void>;
  demoMode?: boolean;
}

const INCOME_SOURCES = ["Paycheck", "Stocks", "Bonus", "Freelance", "Dividends", "Refund", "Gift", "Other"];

export function VoiceTransaction({ accounts, creditCards, settings, refresh, demoMode = false }: VoiceTransactionProps) {
  const { state: recorderState, error: recorderError, duration, volumeRef, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const barsContainerRef = useRef<HTMLDivElement>(null);
  const barsRafRef = useRef<number | null>(null);
  const barsPrevRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const [sending, setSending] = useState(false);
  const [parsed, setParsed] = useState<ParsedVoiceTransaction | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Confirmation form state
  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("CAD");
  const [category, setCategory] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayEST());
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [creditCardId, setCreditCardId] = useState("");
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("monthly");

  // FX for cross-currency transfers
  const { fx } = useMoneyFx();
  const [fxRate, setFxRate] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");

  const fromAcct = accounts.find((a) => a.id === fromAccountId);
  const toAcct = accounts.find((a) => a.id === toAccountId);
  const isCrossCurrencyTransfer = txType === "transfer" && !!fromAcct && !!toAcct && fromAcct.currency !== toAcct.currency;

  // Auto-compute FX rate when transfer accounts change
  useEffect(() => {
    if (isCrossCurrencyTransfer) {
      const rate = convertCurrency(1, fromAcct!.currency, toAcct!.currency, fx);
      setFxRate(rate.toFixed(4));
      const amt = parseFloat(amount);
      if (amt > 0) setReceivedAmount((amt * rate).toFixed(2));
    } else {
      setFxRate("");
      setReceivedAmount("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAccountId, toAccountId, isCrossCurrencyTransfer]);

  const categories = settings?.expense_categories?.length
    ? settings.expense_categories
    : ["Bills", "Food", "Fun", "Health", "Personal Care", "Rent", "Transport", "Other"];
  const baseCurrency = settings?.base_currency ?? "CAD";

  const resetForm = useCallback(() => {
    setParsed(null);
    setApiError(null);
    setSaveError(null);
    setTxType("expense");
    setAmount("");
    setCurrency(baseCurrency as CurrencyCode);
    setCategory("");
    setMerchant("");
    setDate(todayEST());
    setAccountId("");
    setFromAccountId("");
    setToAccountId("");
    setCreditCardId("");
    setNotes("");
    setIsRecurring(false);
    setRecurrence("monthly");
    setFxRate("");
    setReceivedAmount("");
  }, [baseCurrency]);

  const populateForm = useCallback((data: ParsedVoiceTransaction) => {
    setTxType(data.type);
    setAmount(data.amount != null ? String(data.amount) : "");
    setCurrency(data.currency ?? (baseCurrency as CurrencyCode));
    setCategory(data.category ?? (data.type === "expense" ? categories[0] : INCOME_SOURCES[0]));
    setMerchant(data.merchant ?? "");
    setDate(data.date ?? todayEST());
    setNotes(data.notes ?? "");
    setIsRecurring(data.is_recurring);
    setRecurrence((data.recurrence as RecurrenceFrequency) ?? "monthly");

    if (data.credit_card_name) {
      const match = creditCards.find(
        (c) => c.name.toLowerCase() === data.credit_card_name!.toLowerCase()
      );
      if (match) {
        setCreditCardId(match.id);
        setAccountId("");
        if (!data.currency) setCurrency(match.currency);
      }
    } else if (data.account_name) {
      const match = accounts.find(
        (a) => a.name.toLowerCase() === data.account_name!.toLowerCase()
      );
      if (match) {
        setAccountId(match.id);
        setCreditCardId("");
        if (!data.currency) setCurrency(match.currency);
      }
    }

    if (data.from_account_name) {
      const match = accounts.find(
        (a) => a.name.toLowerCase() === data.from_account_name!.toLowerCase()
      );
      if (match) setFromAccountId(match.id);
    }
    if (data.to_account_name) {
      const match = accounts.find(
        (a) => a.name.toLowerCase() === data.to_account_name!.toLowerCase()
      );
      if (match) setToAccountId(match.id);
    }
  }, [accounts, creditCards, categories, baseCurrency]);

  const handleMicClick = useCallback(async () => {
    if (recorderState === "idle") {
      resetForm();
      await startRecording();
    } else if (recorderState === "recording") {
      setSending(true);
      setApiError(null);
      const blob = await stopRecording();

      if (!blob) {
        setApiError("Recording too short — hold the button and speak for at least a second.");
        setSending(false);
        return;
      }

      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");

        const endpoint = demoMode ? "/api/ai/demo-voice" : "/api/ai/voice";
        const res = await fetch(endpoint, { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          setApiError(data.error || "Failed to parse voice recording.");
          setSending(false);
          return;
        }

        const parsed = data as ParsedVoiceTransaction;
        const badTranscript = !parsed.transcript
          || parsed.transcript.toLowerCase().includes("parse this voice")
          || parsed.transcript.toLowerCase().includes("extract the financial")
          || parsed.confidence === 0
          || (parsed.amount == null && !parsed.category && !parsed.merchant);

        if (badTranscript) {
          setApiError("Couldn't understand the recording. Please try again and speak clearly.");
          setSending(false);
          return;
        }

        setParsed(parsed);
        populateForm(parsed);
      } catch {
        setApiError("Network error — check your connection and try again.");
      } finally {
        setSending(false);
      }
    }
  }, [recorderState, startRecording, stopRecording, resetForm, populateForm, demoMode]);

  const handleCancel = useCallback(() => {
    if (recorderState === "recording") {
      cancelRecording();
    }
    resetForm();
    setSending(false);
  }, [recorderState, cancelRecording, resetForm]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setSaveError("Please enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (txType === "expense" && creditCardId) {
        const card = creditCards.find((c) => c.id === creditCardId);
        await createLinkedCreditCardCharge(
          {
            card_id: creditCardId,
            date,
            amount: numAmount,
            merchant: merchant || null,
            category: category || null,
            notes: notes || null,
          },
          {
            currency,
            cardName: card?.name ?? "Card",
            is_recurring: isRecurring,
            recurrence: isRecurring ? recurrence : null,
          }
        );
      } else if (txType === "transfer") {
        let recvAmt: number | null = null;
        if (isCrossCurrencyTransfer) {
          recvAmt = parseFloat(receivedAmount);
          if (!recvAmt || recvAmt <= 0) {
            setSaveError("Enter the received amount for cross-currency transfer.");
            setSaving(false);
            return;
          }
        }
        const fromCurrency = fromAcct?.currency ?? currency;
        await createTransaction({
          type: "transfer",
          date,
          amount: numAmount,
          currency: fromCurrency,
          category: null,
          account_id: null,
          from_account_id: fromAccountId || null,
          to_account_id: toAccountId || null,
          merchant: null,
          notes: notes || null,
          is_recurring: isRecurring,
          recurrence: isRecurring ? recurrence : null,
          received_amount: recvAmt,
        });
      } else {
        await createTransaction({
          type: txType,
          date,
          amount: numAmount,
          currency,
          category: category || null,
          account_id: accountId || null,
          from_account_id: null,
          to_account_id: null,
          merchant: txType === "expense" ? (merchant || null) : null,
          notes: notes || null,
          is_recurring: isRecurring,
          recurrence: isRecurring ? recurrence : null,
        });
      }

      await refresh();
      resetForm();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  }, [txType, amount, currency, category, merchant, date, accountId, fromAccountId, toAccountId, creditCardId, notes, isRecurring, recurrence, creditCards, refresh, resetForm, isCrossCurrencyTransfer, receivedAmount, fromAcct]);

  const isUnclear = (field: string) => parsed?.unclear_fields?.includes(field);
  const fieldClass = (field: string) =>
    isUnclear(field) ? "ring-2 ring-yellow-500/50" : "";

  const isActive = recorderState === "recording" || sending;

  // Animate bars via direct DOM manipulation (bypasses React re-render bottleneck)
  useEffect(() => {
    if (recorderState !== "recording") {
      if (barsRafRef.current) cancelAnimationFrame(barsRafRef.current);
      barsRafRef.current = null;
      barsPrevRef.current = [0, 0, 0, 0, 0, 0, 0];
      return;
    }

    const prev = barsPrevRef.current;
    const tick = () => {
      const container = barsContainerRef.current;
      if (!container) {
        barsRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const raw = volumeRef.current ?? 0;
      const amplitude = Math.min(1, raw * 18);
      const bars = container.children;

      for (let i = 0; i < bars.length; i++) {
        const offset = (Math.sin(Date.now() / (120 + i * 40) + i * 1.8) + 1) / 2;
        const variation = 0.3 + offset * 0.7;
        const target = Math.max(0.15, amplitude * variation);
        prev[i] = target > prev[i] ? target : prev[i] * 0.8 + target * 0.2;
        (bars[i] as HTMLElement).style.height = `${Math.max(4, prev[i] * 24)}px`;
      }

      barsRafRef.current = requestAnimationFrame(tick);
    };

    barsRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (barsRafRef.current) cancelAnimationFrame(barsRafRef.current);
    };
  }, [recorderState, volumeRef]);

  // Keyboard shortcut: Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (parsed) resetForm();
        else if (isActive) handleCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [parsed, isActive, resetForm, handleCancel]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const errorMessage =
    recorderError === "permission-denied"
      ? "Microphone access denied. Please allow microphone in your browser settings."
      : recorderError === "needs-https"
        ? "Microphone requires a secure connection (HTTPS). Please access the app over HTTPS."
        : recorderError === "not-supported"
          ? "Voice recording is not supported in this browser. Try Chrome or Edge."
          : recorderError === "recording-failed"
            ? "Recording failed. Please try again."
            : apiError;

  return (
    <>
      {/* Floating mic button */}
      <div className="fixed z-40 right-4 md:right-6 md:!bottom-6 flex flex-col items-center gap-2" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
        {/* Live waveform + duration when recording */}
        {recorderState === "recording" && (
          <div className="flex items-center gap-2 rounded-2xl bg-accent-purple/90 px-3.5 py-2 shadow-lg backdrop-blur">
            <div ref={barsContainerRef} className="flex items-center gap-[3px] h-6">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-[3px] rounded-full bg-white/90" style={{ height: "4px" }} />
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-white ml-0.5">
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {/* Error toast */}
        {errorMessage && !parsed && (
          <div className="max-w-[260px] rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 shadow-lg backdrop-blur">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Sending indicator */}
        {sending && (
          <div className="rounded-full bg-bg-secondary border border-border-subtle px-3 py-1.5 text-xs text-text-secondary shadow-lg flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Processing...</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Cancel button when recording */}
          {isActive && (
            <button
              onClick={handleCancel}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-text-secondary shadow-lg transition hover:bg-bg-elevated hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Main mic button */}
          <button
            onClick={handleMicClick}
            disabled={sending || recorderState === "requesting" || recorderState === "processing"}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
              recorderState === "recording"
                ? "bg-accent-purple text-white shadow-accent-purple/30 hover:bg-accent-purple/90 scale-110"
                : sending || recorderState === "requesting"
                  ? "bg-bg-elevated text-text-secondary cursor-wait"
                  : "bg-gradient-to-br from-accent-purple to-accent-pink text-white shadow-glow hover:scale-105 active:scale-95"
            )}
            title={recorderState === "recording" ? "Stop recording" : "Record a transaction"}
          >
            {sending || recorderState === "requesting" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : recorderState === "recording" ? (
              <Square className="h-5 w-5 fill-white" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Modal open={!!parsed} onClose={resetForm} title="Confirm Transaction">
        {parsed && (
          <div className="space-y-4">
            {/* Transcript */}
            <div className="rounded-xl bg-bg-elevated px-3 py-2.5">
              <p className="text-xs text-text-secondary mb-1">What I heard:</p>
              <p className="text-sm text-text-primary italic" dir="auto">&ldquo;{parsed.transcript}&rdquo;</p>
              {parsed.confidence < 0.6 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Low confidence — please double-check all fields</span>
                </div>
              )}
            </div>

            {saveError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {saveError}
              </div>
            )}

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Type</label>
              <div className={cn("flex gap-1 rounded-xl bg-bg-elevated p-1", fieldClass("type"))}>
                {(["expense", "income", "transfer"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTxType(t)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                      txType === t
                        ? "bg-accent-purple text-white"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Currency row */}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                    fieldClass("amount"),
                    !amount && "ring-2 ring-red-500/50"
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className={cn(
                    "rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                    fieldClass("currency")
                  )}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>
            </div>
            {/* Cross-currency conversion hint */}
            {(() => {
              const amt = parseFloat(amount);
              if (!amt || amt <= 0 || txType === "transfer") return null;
              const payAcct = creditCardId
                ? creditCards.find((c) => c.id === creditCardId)
                : accounts.find((a) => a.id === accountId);
              const paymentCurrency = payAcct?.currency;
              if (!paymentCurrency || paymentCurrency === currency) return null;
              const converted = convertCurrency(amt, currency, paymentCurrency, fx);
              return (
                <p className="text-[11px] text-text-secondary -mt-2">
                  ≈ {new Intl.NumberFormat("en-US", { style: "currency", currency: paymentCurrency, minimumFractionDigits: 2 }).format(converted)} in account currency
                </p>
              );
            })()}

            {/* Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(
                  "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                  fieldClass("date")
                )}
              />
            </div>

            {/* Category (expense or income) */}
            {txType !== "transfer" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {txType === "income" ? "Source" : "Category"}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                    fieldClass("category")
                  )}
                >
                  <option value="">Select...</option>
                  {(txType === "income" ? INCOME_SOURCES : categories).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Merchant (expense only) */}
            {txType === "expense" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Merchant</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Tim Hortons"
                  className={cn(
                    "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                    fieldClass("merchant")
                  )}
                />
              </div>
            )}

            {/* Account / Credit Card (expense + income) */}
            {txType !== "transfer" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {txType === "expense" ? "Paid from" : "Deposited to"}
                </label>
                <select
                  value={creditCardId ? `cc:${creditCardId}` : accountId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("cc:")) {
                      const cardId = v.slice(3);
                      setCreditCardId(cardId);
                      setAccountId("");
                      const card = creditCards.find((c) => c.id === cardId);
                      if (card) setCurrency(card.currency);
                    } else {
                      setAccountId(v);
                      setCreditCardId("");
                      const acct = accounts.find((a) => a.id === v);
                      if (acct) setCurrency(acct.currency);
                    }
                  }}
                  className={cn(
                    "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                    fieldClass("account_name") || fieldClass("credit_card_name")
                  )}
                >
                  <option value="">Select account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                  {txType === "expense" && creditCards.length > 0 && (
                    <optgroup label="Credit Cards">
                      {creditCards.map((c) => (
                        <option key={c.id} value={`cc:${c.id}`}>{c.name} ({c.currency})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {/* Transfer: from / to */}
            {txType === "transfer" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">From account</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => {
                      setFromAccountId(e.target.value);
                      const acct = accounts.find((a) => a.id === e.target.value);
                      if (acct) setCurrency(acct.currency);
                    }}
                    className={cn(
                      "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                      fieldClass("from_account_name")
                    )}
                  >
                    <option value="">Select...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">To account</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/50",
                      fieldClass("to_account_name")
                    )}
                  >
                    <option value="">Select...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                {/* FX rate + received amount for cross-currency */}
                {isCrossCurrencyTransfer && (
                  <>
                    <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2">
                      <span className="whitespace-nowrap text-xs text-text-secondary">1 {fromAcct?.currency} =</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={fxRate}
                        onChange={(e) => {
                          setFxRate(e.target.value);
                          const rate = parseFloat(e.target.value);
                          const amt = parseFloat(amount);
                          if (rate > 0 && amt > 0) setReceivedAmount((amt * rate).toFixed(2));
                        }}
                        className="w-20 rounded-lg border border-border-subtle bg-bg-main px-2 py-1 text-center text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-purple/50"
                      />
                      <span className="whitespace-nowrap text-xs text-text-secondary">{toAcct?.currency}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const rate = convertCurrency(1, fromAcct!.currency, toAcct!.currency, fx);
                          setFxRate(rate.toFixed(4));
                          const amt = parseFloat(amount);
                          if (amt > 0) setReceivedAmount((amt * rate).toFixed(2));
                        }}
                        className="ml-auto whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/10"
                      >
                        Live rate
                      </button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Received ({toAcct?.currency})
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={receivedAmount}
                        onChange={(e) => {
                          setReceivedAmount(e.target.value);
                          const recv = parseFloat(e.target.value);
                          const rate = parseFloat(fxRate);
                          if (recv > 0 && rate > 0) setAmount((recv / rate).toFixed(2));
                        }}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/50"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/50"
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-border-subtle accent-accent-purple"
                />
                Recurring
              </label>
              {isRecurring && (
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency)}
                  className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>

            {/* Unclear fields hint */}
            {parsed.unclear_fields.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-500">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Please verify: {parsed.unclear_fields.map((f) => f.replace(/_/g, " ")).join(", ")}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={resetForm}
                disabled={saving}
                className="flex-1 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-bg-main hover:text-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !amount}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-pink px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
