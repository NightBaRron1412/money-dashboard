"use client";

import { useState } from "react";
import { useMoneyData } from "../hooks/use-money-data";
import { PageHeader, formatMoney, HIDDEN_BALANCE } from "../components/money-ui";
import { useBalanceVisibility } from "../balance-visibility-provider";
import {
  Loader2,
  Scale,
  Trash2,
  Merge,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { CurrencyCode, DuplicateCandidate } from "@/lib/money/database.types";

interface ReconcileResult {
  session: { id: string };
  computed_balance: number;
  delta: number | null;
}

export function ReconcileContent() {
  const { accounts, loading } = useMoneyData();
  const { showBalances } = useBalanceVisibility();

  const [selectedAccount, setSelectedAccount] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [expectedBalance, setExpectedBalance] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const acct = accounts.find((a) => a.id === selectedAccount);
  const currency: CurrencyCode = acct?.currency ?? "CAD";
  const m = (v: number) => (showBalances ? formatMoney(v, currency) : HIDDEN_BALANCE);

  const handleReconcile = async () => {
    if (!selectedAccount) return;
    setRunning(true);
    setResult(null);
    setDuplicates([]);
    setSearched(false);
    setActionMsg("");

    try {
      const [sessionRes, dupsRes] = await Promise.all([
        fetch("/api/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: selectedAccount,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            expected_balance: expectedBalance ? parseFloat(expectedBalance) : null,
          }),
        }),
        fetch(
          `/api/duplicates?${new URLSearchParams({
            account_id: selectedAccount,
            ...(dateFrom ? { date_from: dateFrom } : {}),
            ...(dateTo ? { date_to: dateTo } : {}),
          })}`
        ),
      ]);

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.error);
      setResult(sessionData);

      const dupsData = await dupsRes.json();
      if (dupsRes.ok) {
        setDuplicates(dupsData.duplicates || []);
      }

      setSearched(true);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Reconciliation failed");
      setSearched(true);
    } finally {
      setRunning(false);
    }
  };

  const [dupActionRunning, setDupActionRunning] = useState(false);

  const handleDupAction = async (
    actionType: "merge" | "delete" | "keep_both",
    txIds: string[]
  ) => {
    if (!result?.session?.id || dupActionRunning) return;
    setDupActionRunning(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/reconcile/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: result.session.id,
          action_type: actionType,
          tx_ids: txIds,
          keep_id: actionType === "merge" ? txIds[0] : undefined,
          payload_json: { tx_ids: txIds },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (actionType === "delete" || actionType === "merge") {
        setDuplicates((prev) =>
          prev.filter(
            (d) => !txIds.includes(d.tx_a_id) && !txIds.includes(d.tx_b_id)
          )
        );
      } else {
        setDuplicates((prev) =>
          prev.filter(
            (d) => !(d.tx_a_id === txIds[0] && d.tx_b_id === txIds[1])
          )
        );
      }

      setActionMsg(`Action "${actionType}" applied successfully.`);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDupActionRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Compare balances and detect duplicate transactions"
      />

      <div className="space-y-6">
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
            <Scale className="h-4 w-4 text-accent-purple" />
            Reconcile Account
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  setResult(null);
                  setDuplicates([]);
                  setSearched(false);
                }}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Expected Balance (optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={expectedBalance}
                onChange={(e) => setExpectedBalance(e.target.value)}
                placeholder="From bank statement"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleReconcile}
              disabled={!selectedAccount || running}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              Reconcile & Find Duplicates
            </button>
          </div>
        </section>

        {result && (
          <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Balance Check
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
                <p className="text-xs text-text-secondary">Computed Balance</p>
                <p className="mt-1 text-lg font-bold text-text-primary">
                  {m(result.computed_balance)}
                </p>
              </div>
              {result.delta !== null && (
                <>
                  <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
                    <p className="text-xs text-text-secondary">Expected Balance</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">
                      {m(parseFloat(expectedBalance))}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border p-4 ${
                      Math.abs(result.delta) < 0.01
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-yellow-500/30 bg-yellow-500/5"
                    }`}
                  >
                    <p className="text-xs text-text-secondary">Delta</p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        Math.abs(result.delta) < 0.01
                          ? "text-emerald-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {Math.abs(result.delta) < 0.01 ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Balanced
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> {m(result.delta)}
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {actionMsg && (
          <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 px-4 py-3 text-sm text-accent-blue">
            {actionMsg}
          </div>
        )}

        {duplicates.length > 0 && (
          <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Potential Duplicates ({duplicates.length})
            </h3>
            <div className="space-y-3">
              {duplicates.map((dup, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-subtle bg-bg-elevated p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-text-primary">
                        Amount: {m(dup.amount)} &middot; Score: {dup.score}/100
                      </p>
                      <p className="text-text-secondary">
                        A: {dup.date_a} &mdash; {dup.merchant_a || "(no merchant)"}
                      </p>
                      <p className="text-text-secondary">
                        B: {dup.date_b} &mdash; {dup.merchant_b || "(no merchant)"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleDupAction("merge", [dup.tx_a_id, dup.tx_b_id])
                        }
                        disabled={dupActionRunning}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent-purple/10 px-2.5 py-1.5 text-xs font-medium text-accent-purple transition hover:bg-accent-purple/20 disabled:opacity-50"
                        title="Keep first, delete second"
                      >
                        <Merge className="h-3 w-3" /> Merge
                      </button>
                      <button
                        onClick={() =>
                          handleDupAction("delete", [dup.tx_b_id])
                        }
                        disabled={dupActionRunning}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        title="Delete duplicate B"
                      >
                        <Trash2 className="h-3 w-3" /> Delete B
                      </button>
                      <button
                        onClick={() =>
                          handleDupAction("keep_both", [dup.tx_a_id, dup.tx_b_id])
                        }
                        disabled={dupActionRunning}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-secondary disabled:opacity-50"
                        title="Keep both"
                      >
                        <CheckCircle className="h-3 w-3" /> Keep Both
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {duplicates.length === 0 && !running && searched && (
          <p className="text-sm text-text-secondary">
            No duplicate transactions found for the selected range.
          </p>
        )}
      </div>
    </>
  );
}
