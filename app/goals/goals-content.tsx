"use client";

import { useState, useEffect } from "react";
import { useMoneyData } from "../hooks/use-money-data";
import {
  PageHeader,
  Modal,
  ProgressBar,
  formatMoney,
  HIDDEN_BALANCE,
  EmptyState,
  todayEST,
} from "../components/money-ui";
import {
  Target,
  Loader2,
  Plus,
  PartyPopper,
  ArrowRight,
  Pencil,
  Trash2,
  CalendarClock,
} from "lucide-react";
import {
  createTransaction,
  createGoal,
  updateGoal,
  deleteGoal as deleteGoalApi,
  setActivePlan,
  addGoalAccountAllocation,
  type GoalAccountLinkInput,
} from "@/lib/money/queries";
import type { CurrencyCode, Goal } from "@/lib/money/database.types";
import { useBalanceVisibility } from "../balance-visibility-provider";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import { predictGoalCompletion } from "@/lib/money/forecasting";

export function GoalsContent() {
  const { accounts, goals, goalAccounts, plans, balances, transactions, settings, loading, refresh } =
    useMoneyData();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const [showContribute, setShowContribute] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeAccountId, setContributeAccountId] = useState("");
  const [contributeSourceAccountId, setContributeSourceAccountId] = useState("");
  const [contributeError, setContributeError] = useState("");
  const [decreaseSourceSplit, setDecreaseSourceSplit] = useState(false);
  const [increaseDestSplit, setIncreaseDestSplit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPhase2Modal, setShowPhase2Modal] = useState(false);
  const [phase2Dismissed, setPhase2Dismissed] = useState(false);

  // Add / Edit state
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalAccountIds, setGoalAccountIds] = useState<string[]>([]);
  const [goalAccountAmounts, setGoalAccountAmounts] = useState<Record<string, string>>({});
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [formError, setFormError] = useState("");

  const goalProgress = computeGoalProgress(goals, goalAccounts, balances);

  // Sum expense amounts linked to each goal (raw, no FX — assumes single base currency)
  const spentByGoal: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type === "expense" && tx.goal_id) {
      spentByGoal[tx.goal_id] = (spentByGoal[tx.goal_id] || 0) + tx.amount;
    }
  }

  const getGoalAccountLinks = (goal: Goal): GoalAccountLinkInput[] => {
    const linked = goalAccounts
      .filter((link) => link.goal_id === goal.id)
      .map((link) => ({
        account_id: link.account_id,
        allocated_amount: link.allocated_amount,
      }));
    if (linked.length > 0) {
      return linked;
    }
    if (goal.linked_account_id) {
      return [{ account_id: goal.linked_account_id, allocated_amount: null }];
    }
    return [];
  };

  const getGoalAccountIds = (goal: Goal) => {
    const linked = goalProgress.goalAccountIdsByGoalId[goal.id] ?? [];
    if (linked.length === 0 && goal.linked_account_id) {
      return [goal.linked_account_id];
    }
    return linked;
  };

  const getGoalCurrentBalance = (goal: Goal) => goalProgress.goalCurrentById[goal.id] ?? 0;

  // Check if Emergency fund is complete
  const emergencyGoal = goals.find((g) => g.name === "Emergency Fund");
  const emergencyBalance = emergencyGoal ? getGoalCurrentBalance(emergencyGoal) : 0;
  const emergencyComplete =
    emergencyGoal &&
    emergencyGoal.target_amount &&
    emergencyBalance >= emergencyGoal.target_amount;

  // Check if Phase 1 is active
  const phase1Active = plans.some(
    (p) => p.is_active && p.name.toLowerCase().includes("phase 1")
  );

  useEffect(() => {
    if (emergencyComplete && phase1Active && !phase2Dismissed) {
      setShowPhase2Modal(true);
    }
  }, [emergencyComplete, phase1Active, phase2Dismissed]);

  const resetForm = () => {
    setGoalName("");
    setGoalTarget("");
    setGoalAccountIds([]);
    setGoalAccountAmounts({});
    setGoalTargetDate("");
    setFormError("");
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (goal: Goal) => {
    const links = getGoalAccountLinks(goal);
    setEditing(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.target_amount?.toString() ?? "");
    setGoalAccountIds(links.map((link) => link.account_id));
    setGoalAccountAmounts(
      Object.fromEntries(
        links.map((link) => [
          link.account_id,
          link.allocated_amount === null || link.allocated_amount === undefined
            ? ""
            : link.allocated_amount.toString(),
        ])
      )
    );
    setGoalTargetDate(goal.target_date ?? "");
    setFormError("");
  };

  const buildGoalAccountLinks = (
    excludeGoalId?: string
  ): { links: GoalAccountLinkInput[]; error: string | null } => {
    const uniqueAccountIds = Array.from(new Set(goalAccountIds.filter(Boolean)));
    const links: GoalAccountLinkInput[] = [];

    for (const accountId of uniqueAccountIds) {
      const rawAmount = (goalAccountAmounts[accountId] ?? "").trim();
      if (rawAmount.length === 0) {
        links.push({ account_id: accountId, allocated_amount: null });
        continue;
      }
      const parsed = parseFloat(rawAmount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        const accountName = accounts.find((a) => a.id === accountId)?.name ?? "Account";
        return {
          links: [],
          error: `${accountName}: allocation must be a non-negative number or blank.`,
        };
      }
      links.push({ account_id: accountId, allocated_amount: parsed });
    }

    const existingExplicitByAccountId = new Map<string, number>();
    for (const link of goalAccounts) {
      if (excludeGoalId && link.goal_id === excludeGoalId) continue;
      if (link.allocated_amount === null || link.allocated_amount === undefined) continue;
      const current = existingExplicitByAccountId.get(link.account_id) ?? 0;
      existingExplicitByAccountId.set(link.account_id, current + Math.max(0, link.allocated_amount));
    }

    for (const link of links) {
      if (link.allocated_amount === null || link.allocated_amount === undefined) continue;
      const existing = existingExplicitByAccountId.get(link.account_id) ?? 0;
      const balance = Math.max(0, balances[link.account_id] ?? 0);
      const nextTotal = existing + link.allocated_amount;
      if (nextTotal > balance + 0.01) {
        const account = accounts.find((a) => a.id === link.account_id);
        const accountName = account?.name ?? "Account";
        const available = Math.max(0, balance - existing);
        return {
          links: [],
          error: `${accountName}: allocated exceeds current balance. Available: ${formatMoney(available, account?.currency ?? baseCurrency)}.`,
        };
      }
    }

    return { links, error: null };
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!goalName.trim()) {
      setFormError("Name is required");
      return;
    }
    if (goalTarget.trim().length > 0) {
      const parsedTarget = parseFloat(goalTarget);
      if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
        setFormError("Target amount must be a non-negative number.");
        return;
      }
    }
    const { links, error } = buildGoalAccountLinks();
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    try {
      const target = goalTarget ? parseFloat(goalTarget) : null;
      await createGoal({
        name: goalName.trim(),
        target_amount: target,
        target_date: goalTargetDate || null,
        linked_account_id: links[0]?.account_id ?? null,
      }, links);
      await refresh();
      setShowAdd(false);
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleEditGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError("");
    if (!goalName.trim()) {
      setFormError("Name is required");
      return;
    }
    if (goalTarget.trim().length > 0) {
      const parsedTarget = parseFloat(goalTarget);
      if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
        setFormError("Target amount must be a non-negative number.");
        return;
      }
    }
    const { links, error } = buildGoalAccountLinks(editing.id);
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    try {
      const target = goalTarget ? parseFloat(goalTarget) : null;
      await updateGoal(editing.id, {
        name: goalName.trim(),
        target_amount: target,
        target_date: goalTargetDate || null,
        linked_account_id: links[0]?.account_id ?? null,
      }, links);
      await refresh();
      setEditing(null);
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (!confirm(`Delete goal "${goal.name}"?`)) return;
    await deleteGoalApi(goal.id);
    await refresh();
  };

  const handleContribute = async (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const targetIds = getGoalAccountIds(goal);
    if (targetIds.length === 0) return;
    const targetId =
      contributeAccountId && targetIds.includes(contributeAccountId)
        ? contributeAccountId
        : targetIds[0];

    const targetAcct = accounts.find((a) => a.id === targetId);
    const defaultSource =
      targetAcct
        ? accounts.find(
            (a) =>
              a.id !== targetId &&
              a.currency === targetAcct.currency &&
              a.name === "Personal"
          ) ||
          accounts.find(
            (a) =>
              a.id !== targetId &&
              a.currency === targetAcct.currency &&
              a.type === "checking"
          ) ||
          accounts.find((a) => a.id !== targetId && a.currency === targetAcct.currency)
        : null;
    const sourceId = contributeSourceAccountId || defaultSource?.id || "";
    const source = accounts.find((a) => a.id === sourceId);
    if (!source) {
      setContributeError("Choose a source account.");
      return;
    }
    if (!targetAcct) {
      setContributeError("Choose a valid target account.");
      return;
    }
    if (source.id === targetId) {
      setContributeError("Source and target accounts must be different.");
      return;
    }
    if (source.currency !== targetAcct.currency) {
      setContributeError("Cross-currency goal transfers are not supported yet. Choose accounts with matching currency.");
      return;
    }

    setContributeError("");
    setSaving(true);
    try {
      const amt = parseFloat(contributeAmount);
      if (isNaN(amt) || amt <= 0) {
        setContributeError("Enter a valid amount.");
        return;
      }

      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_account_id: source.id,
          destination_account_id: targetId,
          goal_id: goal.id,
          amount: amt,
          decrease_source_split: decreaseSourceSplit,
          increase_destination_split: increaseDestSplit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Contribution failed");
      }

      await refresh();
      setShowContribute(null);
      setContributeAmount("");
      setContributeAccountId("");
      setContributeSourceAccountId("");
      setContributeError("");
      setDecreaseSourceSplit(false);
      setIncreaseDestSplit(true);
    } catch (err: unknown) {
      setContributeError(err instanceof Error ? err.message : "Failed to add contribution.");
    } finally {
      setSaving(false);
    }
  };
  const handleSwitchToPhase2 = async () => {
    const phase2 = plans.find((p) =>
      p.name.toLowerCase().includes("phase 2")
    );
    if (phase2) {
      await setActivePlan(phase2.id);
      await refresh();
    }
    setShowPhase2Modal(false);
    setPhase2Dismissed(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  const selectedExplicitAllocation = goalAccountIds.reduce((sum, accountId) => {
    const raw = (goalAccountAmounts[accountId] ?? "").trim();
    if (raw.length === 0) return sum;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return sum;
    return sum + parsed;
  }, 0);

  // Shared form for add/edit
  const goalForm = (
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          Goal Name
        </label>
        <input
          type="text"
          value={goalName}
          onChange={(e) => setGoalName(e.target.value)}
          placeholder="e.g., Emergency Fund"
          className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Target Amount
          </label>
          <input
            type="number"
            step="0.01"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder="Leave empty for no cap"
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Target Date
          </label>
          <input
            type="date"
            value={goalTargetDate}
            onChange={(e) => setGoalTargetDate(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          Linked Accounts
        </label>
        {accounts.length === 0 ? (
          <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
            Create accounts first.
          </p>
        ) : (
          <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated p-3">
            {accounts.map((a) => {
              const checked = goalAccountIds.includes(a.id);
              const allocationValue = goalAccountAmounts[a.id] ?? "";
              return (
                <div key={a.id} className="rounded-lg border border-border-subtle/70 bg-bg-secondary/40 p-3">
                  <label className="flex items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGoalAccountIds((prev) => Array.from(new Set([...prev, a.id])));
                        } else {
                          setGoalAccountIds((prev) => prev.filter((id) => id !== a.id));
                          setGoalAccountAmounts((prev) => {
                            const next = { ...prev };
                            delete next[a.id];
                            return next;
                          });
                        }
                      }}
                      className="h-4 w-4 rounded border-border-subtle bg-bg-secondary accent-accent-purple"
                    />
                    <span>
                      {a.name} ({a.type}, {a.currency})
                    </span>
                  </label>
                  {checked && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={allocationValue}
                        onChange={(e) =>
                          setGoalAccountAmounts((prev) => ({
                            ...prev,
                            [a.id]: e.target.value,
                          }))
                        }
                        placeholder="Allocated amount (blank = auto split)"
                        className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
                      />
                      <span className="text-[11px] text-text-secondary">
                        Bal: {m(Math.max(0, balances[a.id] || 0))}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-text-secondary">
          Selected: {goalAccountIds.length} | Explicit allocated: {m(selectedExplicitAllocation)} (blank amounts auto-split remaining balance)
        </p>
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

  const contributingGoal = showContribute
    ? goals.find((goal) => goal.id === showContribute) ?? null
    : null;
  const contributingGoalAccountIds = contributingGoal
    ? getGoalAccountIds(contributingGoal)
    : [];
  const contributeTargetAccount =
    contributingGoalAccountIds.length === 0
      ? null
      : accounts.find(
          (a) =>
            a.id ===
            (contributeAccountId && contributingGoalAccountIds.includes(contributeAccountId)
              ? contributeAccountId
              : contributingGoalAccountIds[0])
        ) ?? null;
  const contributingSourceAccounts = contributeTargetAccount
    ? accounts.filter(
        (a) =>
          a.id !== contributeTargetAccount.id &&
          a.currency === contributeTargetAccount.currency
      )
    : [];

  return (
    <>
      <div data-tour="goals-header">
      <PageHeader
        title="Goals"
        description="Track your financial goals"
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Add Goal
          </button>
        }
      />
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No goals set"
          description="Create your first goal to start tracking progress."
          action={
            <button
              onClick={openAdd}
              className="rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Add Goal
            </button>
          }
        />
      ) : (
        <div data-tour="goals-cards" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const linkedAccountIds = getGoalAccountIds(goal);
            const linkedAccountIdSet = new Set(linkedAccountIds);
            const current = getGoalCurrentBalance(goal);
            const target = goal.target_amount;
            const isComplete = target !== null && current >= target;

            return (
              <div
                key={goal.id}
                className={`rounded-2xl border p-6 transition ${
                  isComplete
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border-subtle bg-bg-secondary"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {goal.name}
                    </h3>
                    {isComplete && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <PartyPopper className="h-3 w-3" /> Complete!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(goal)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal)}
                      className="rounded-lg p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {linkedAccountIds.length > 0 && (
                    <p className="mb-2 text-xs text-text-secondary">
                      Linked:{" "}
                      {linkedAccountIds
                        .map((id) => accounts.find((a) => a.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-text-primary">
                      {m(current)}
                    </span>
                    {target && (
                      <span className="text-sm text-text-secondary">
                        / {m(target)}
                      </span>
                    )}
                  </div>

                  {target ? (
                    <ProgressBar
                      value={current}
                      max={target}
                      className="mt-3"
                      color={isComplete ? "bg-emerald-500" : "bg-accent-purple"}
                    />
                  ) : (
                    <p className="mt-2 text-xs text-text-secondary">
                      No cap — keep investing!
                    </p>
                  )}

                  {/* Spent against goal (linked expenses) */}
                  {(spentByGoal[goal.id] ?? 0) > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-text-secondary">Spent</span>
                        <span className="font-semibold text-text-primary">{m(spentByGoal[goal.id])}</span>
                      </div>
                      {target && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-secondary">Remaining</span>
                          <span className={`font-semibold ${target - spentByGoal[goal.id] <= 0 ? "text-red-400" : "text-emerald-500"}`}>
                            {m(Math.max(0, target - spentByGoal[goal.id]))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline / projected completion */}
                  {!isComplete && target && target > 0 && (() => {
                    // Calculate avg monthly contribution from goal-linked account transfers
                    const goalTxs = transactions.filter(
                      (t) =>
                        (t.type === "transfer" &&
                          t.to_account_id !== null &&
                          linkedAccountIdSet.has(t.to_account_id)) ||
                        (t.type === "income" &&
                          t.account_id !== null &&
                          linkedAccountIdSet.has(t.account_id))
                    );
                    const remaining = target - current;
                    if (goal.target_date) {
                      const deadlineDate = new Date(goal.target_date + "T00:00:00");
                      const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      const monthsLeft = Math.max(0.1, daysLeft / 30);
                      const neededPerMonth = remaining / monthsLeft;
                      return (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                          <CalendarClock className="h-3 w-3" />
                          <span>Target: {new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })} — need {showBalances ? formatMoney(neededPerMonth) : HIDDEN_BALANCE}/mo</span>
                        </div>
                      );
                    }
                    // Estimate based on avg contributions
                    if (goalTxs.length >= 2) {
                      const dates = goalTxs.map((t) => new Date(t.date + "T00:00:00").getTime()).sort();
                      const spanMonths = Math.max(1, (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 30));
                      const totalContributions = goalTxs.reduce((s, t) => s + t.amount, 0);
                      const avgPerMonth = totalContributions / spanMonths;
                      if (avgPerMonth > 0) {
                        const monthsToGo = remaining / avgPerMonth;
                        const estDate = new Date();
                        estDate.setMonth(estDate.getMonth() + Math.ceil(monthsToGo));
                        return (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                            <CalendarClock className="h-3 w-3" />
                            Est. completion: {estDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        );
                      }
                    }
                    // Fallback: savings-rate-based prediction
                    const predictions = predictGoalCompletion(goals, goalAccounts, accounts, transactions, balances);
                    const pred = predictions.find((p) => p.goalId === goal.id);
                    if (pred?.predictedDate) {
                      return (
                        <div className="mt-2 space-y-1">
                          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <CalendarClock className="h-3 w-3" />
                            Est. completion: {new Date(pred.predictedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                          {pred.onTrack ? (
                            <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">On track</span>
                          ) : (
                            <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Behind schedule</span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <button
                  onClick={() => {
                    const targetIds = getGoalAccountIds(goal);
                    const defaultTargetId = targetIds[0] ?? "";
                    const targetAccount = accounts.find((a) => a.id === defaultTargetId);
                    const defaultSource =
                      targetAccount
                        ? accounts.find(
                            (a) =>
                              a.id !== defaultTargetId &&
                              a.currency === targetAccount.currency &&
                              a.name === "Personal"
                          ) ||
                          accounts.find(
                            (a) =>
                              a.id !== defaultTargetId &&
                              a.currency === targetAccount.currency &&
                              a.type === "checking"
                          ) ||
                          accounts.find(
                            (a) =>
                              a.id !== defaultTargetId &&
                              a.currency === targetAccount.currency
                          )
                        : null;
                    setShowContribute(goal.id);
                    setContributeAmount("");
                    setContributeAccountId(defaultTargetId);
                    setContributeSourceAccountId(defaultSource?.id ?? "");
                    setContributeError("");
                  }}
                  disabled={linkedAccountIds.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm text-text-primary transition hover:border-accent-blue hover:text-accent-blue"
                >
                  <Plus className="h-4 w-4" />
                  {linkedAccountIds.length === 0 ? "Link accounts first" : "Add Contribution"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add Goal">
        {goalForm(handleAddGoal, "Create Goal")}
      </Modal>

      {/* Edit Goal Modal */}
      <Modal open={editing !== null} onClose={() => { setEditing(null); resetForm(); }} title="Edit Goal">
        {goalForm(handleEditGoal, "Save Changes")}
      </Modal>

      {/* Contribute Modal */}
      <Modal
        open={showContribute !== null}
        onClose={() => {
          setShowContribute(null);
          setContributeAccountId("");
          setContributeSourceAccountId("");
          setContributeError("");
        }}
        title="Add Contribution"
      >
        <div className="space-y-4">
          {contributingGoalAccountIds.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Contribute To
              </label>
              <select
                value={contributeAccountId}
                onChange={(e) => {
                  const nextTargetId = e.target.value;
                  const nextTargetAccount = accounts.find((a) => a.id === nextTargetId);
                  const nextDefaultSource =
                    nextTargetAccount
                      ? accounts.find(
                          (a) =>
                            a.id !== nextTargetId &&
                            a.currency === nextTargetAccount.currency &&
                            a.name === "Personal"
                        ) ||
                        accounts.find(
                          (a) =>
                            a.id !== nextTargetId &&
                            a.currency === nextTargetAccount.currency &&
                            a.type === "checking"
                        ) ||
                        accounts.find(
                          (a) =>
                            a.id !== nextTargetId &&
                            a.currency === nextTargetAccount.currency
                        )
                      : null;
                  setContributeAccountId(nextTargetId);
                  setContributeSourceAccountId(nextDefaultSource?.id ?? "");
                  setContributeError("");
                }}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                {contributingGoalAccountIds.map((accountId) => {
                  const account = accounts.find((a) => a.id === accountId);
                  if (!account) return null;
                  return (
                    <option key={accountId} value={accountId}>
                      {account.name} ({account.type}, {account.currency})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          {contributeTargetAccount && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Source Account
              </label>
              {contributingSourceAccounts.length === 0 ? (
                <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-400">
                  No eligible source account with {contributeTargetAccount.currency}. Create one first.
                </p>
              ) : (
                <select
                  value={contributeSourceAccountId}
                  onChange={(e) => {
                    setContributeSourceAccountId(e.target.value);
                    setContributeError("");
                  }}
                  className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                >
                  <option value="">Select source account</option>
                  {contributingSourceAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type}, {account.currency})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={contributeAmount}
              onChange={(e) => {
                setContributeAmount(e.target.value);
                setContributeError("");
              }}
              placeholder="0.00"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
          </div>
          <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated p-3">
            <p className="text-xs font-medium text-text-secondary">Split Adjustments</p>
            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={decreaseSourceSplit}
                onChange={(e) => setDecreaseSourceSplit(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle accent-accent-purple"
              />
              Decrease source account allocation
            </label>
            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={increaseDestSplit}
                onChange={(e) => setIncreaseDestSplit(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle accent-accent-purple"
              />
              Increase destination account allocation
            </label>
            {contributeAmount && parseFloat(contributeAmount) > 0 && (
              <p className="text-[11px] text-text-secondary">
                Preview: transfer {formatMoney(parseFloat(contributeAmount) || 0, contributeTargetAccount?.currency ?? baseCurrency)}
                {decreaseSourceSplit ? " · source split -" + (contributeAmount || "0") : ""}
                {increaseDestSplit ? " · dest split +" + (contributeAmount || "0") : ""}
              </p>
            )}
          </div>
          {contributeError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {contributeError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowContribute(null);
                setContributeAccountId("");
                setContributeSourceAccountId("");
                setContributeError("");
              }}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              onClick={() => showContribute && handleContribute(showContribute)}
              disabled={
                saving ||
                (!contributeAccountId && contributingGoalAccountIds.length > 0) ||
                contributingSourceAccounts.length === 0 ||
                !contributeSourceAccountId
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Contribute
            </button>
          </div>
        </div>
      </Modal>

      {/* Phase 2 switch modal */}
      <Modal
        open={showPhase2Modal}
        onClose={() => {
          setShowPhase2Modal(false);
          setPhase2Dismissed(true);
        }}
        title="🎉 Emergency Fund Complete!"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Congratulations! Your emergency fund has reached its target of{" "}
            {formatMoney(emergencyGoal?.target_amount || 20000)}.
          </p>
          <p className="text-sm text-text-secondary">
            Would you like to switch to <strong>Phase 2</strong> allocation plan?
            This reallocates your emergency fund contributions to your car fund
            and investments.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowPhase2Modal(false);
                setPhase2Dismissed(true);
              }}
              className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated"
            >
              Not Now
            </button>
            <button
              onClick={handleSwitchToPhase2}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Switch to Phase 2 <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

