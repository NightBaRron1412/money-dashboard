"use client";

import { useState, useEffect } from "react";
import { useMoneyData } from "../hooks/use-money-data";
import { PageHeader, formatMoney, HIDDEN_BALANCE } from "../components/money-ui";
import {
  Loader2,
  Save,
  Check,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  upsertSettings,
  setActivePlan,
  createAllocationPlan,
  updateAllocationPlan,
  deleteAllocationPlan,
} from "@/lib/money/queries";
import type {
  CurrencyCode,
  GreetingTone,
  PaycheckFrequency,
} from "@/lib/money/database.types";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useBalanceVisibility } from "../balance-visibility-provider";
import { BackgroundNotificationSettings } from "../components/background-notification-settings";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Bills",
  "Food",
  "Fun",
  "Health",
  "Personal Care",
  "Rent",
  "Transport",
  "Other",
];

const DEFAULT_SUBSCRIPTION_CATEGORIES = [
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

export function SettingsContent() {
  const { settings, plans, accounts, loading, refresh } = useMoneyData();
  const { showBalances } = useBalanceVisibility();
  const baseCurrency: CurrencyCode = settings?.base_currency ?? "CAD";
  const m = (v: number) => showBalances ? formatMoney(v, baseCurrency) : HIDDEN_BALANCE;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [baseCurrencyInput, setBaseCurrencyInput] = useState<CurrencyCode>("CAD");
  const [rentAmount, setRentAmount] = useState("2100");
  const [rentDay, setRentDay] = useState("28");
  const [rentReminderDays, setRentReminderDays] = useState("7");
  const [billReminderDays, setBillReminderDays] = useState("3");
  const [budget, setBudget] = useState("3000");
  const [paycheckAmount, setPaycheckAmount] = useState("3400");
  const [paycheckFreq, setPaycheckFreq] = useState<PaycheckFrequency>("bi-weekly");
  const [displayName, setDisplayName] = useState("Amir");
  const [greetingTone, setGreetingTone] = useState<GreetingTone>("coach");
  const [expenseCategories, setExpenseCategories] = useState<string[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [subscriptionCategories, setSubscriptionCategories] = useState<string[]>(
    DEFAULT_SUBSCRIPTION_CATEGORIES
  );
  const [newSubscriptionCategory, setNewSubscriptionCategory] = useState("");

  // Allocation plan modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [planAllocations, setPlanAllocations] = useState<Record<string, string>>({});
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");

  // Populate from loaded settings
  useEffect(() => {
    if (settings) {
      setBaseCurrencyInput(settings.base_currency ?? "CAD");
      setRentAmount(settings.rent_amount.toString());
      setRentDay(settings.rent_day.toString());
      setRentReminderDays((settings.rent_reminder_days ?? 7).toString());
      setBillReminderDays((settings.bill_reminder_days ?? 3).toString());
      setBudget(settings.monthly_essentials_budget.toString());
      setPaycheckAmount(settings.paycheck_amount.toString());
      setPaycheckFreq(settings.paycheck_frequency);
      setDisplayName(settings.display_name || "Amir");
      setGreetingTone(settings.greeting_tone || "coach");
      const loadedCategories = normalizeCategories(
        settings.expense_categories ?? []
      );
      setExpenseCategories(
        loadedCategories.length > 0
          ? loadedCategories
          : DEFAULT_EXPENSE_CATEGORIES
      );
      const loadedSubscriptionCategories = normalizeCategories(
        settings.subscription_categories ?? []
      );
      setSubscriptionCategories(
        loadedSubscriptionCategories.length > 0
          ? loadedSubscriptionCategories
          : DEFAULT_SUBSCRIPTION_CATEGORIES
      );
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const normalizedExpenseCategories = normalizeCategories(expenseCategories);
      const normalizedSubscriptionCategories = normalizeCategories(
        subscriptionCategories
      );
      const parsedRentReminderDays = parseInt(rentReminderDays, 10);
      const parsedBillReminderDays = parseInt(billReminderDays, 10);
      await upsertSettings({
        base_currency: baseCurrencyInput,
        display_name: displayName.trim() || "Amir",
        greeting_tone: greetingTone,
        expense_categories:
          normalizedExpenseCategories.length > 0
            ? normalizedExpenseCategories
            : DEFAULT_EXPENSE_CATEGORIES,
        subscription_categories:
          normalizedSubscriptionCategories.length > 0
            ? normalizedSubscriptionCategories
            : DEFAULT_SUBSCRIPTION_CATEGORIES,
        rent_amount: parseFloat(rentAmount) || 2100,
        rent_day: parseInt(rentDay) || 28,
        rent_reminder_days: Math.min(
          30,
          Math.max(0, Number.isNaN(parsedRentReminderDays) ? 7 : parsedRentReminderDays)
        ),
        bill_reminder_days: Math.min(
          30,
          Math.max(0, Number.isNaN(parsedBillReminderDays) ? 3 : parsedBillReminderDays)
        ),
        monthly_essentials_budget: parseFloat(budget) || 3000,
        paycheck_amount: parseFloat(paycheckAmount) || 3400,
        paycheck_frequency: paycheckFreq,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleActivatePlan = async (planId: string) => {
    await setActivePlan(planId);
    await refresh();
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
        title="Settings"
        description="Configure your finance dashboard"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        }
      />

      <div className="space-y-8">
        {/* Currency */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Currency
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Base Currency
              </label>
              <select
                value={baseCurrencyInput}
                onChange={(e) => setBaseCurrencyInput(e.target.value as CurrencyCode)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
              <p className="mt-1 text-xs text-text-secondary">
                Dashboard totals and reports will be shown in this currency (using live FX rates).
              </p>
            </div>
          </div>
        </section>

        {/* Greeting Preferences */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            AI Greeting Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Amir"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                AI Personality
              </label>
              <p className="mb-2 text-[11px] text-text-secondary">
                Describe how you want the AI to greet you. Pick a preset or write your own.
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {[
                  { value: "minimal", label: "Minimal" },
                  { value: "coach", label: "Coach" },
                  { value: "strict", label: "Strict" },
                  { value: "friendly and casual, use humor", label: "Funny" },
                  { value: "like a wise old mentor, philosophical", label: "Wise" },
                  { value: "like a drill sergeant, blunt and motivating", label: "Drill Sgt" },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setGreetingTone(preset.value as GreetingTone)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      greetingTone === preset.value
                        ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                        : "border-border-subtle text-text-secondary hover:border-accent-blue/40"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={greetingTone}
                onChange={(e) => setGreetingTone(e.target.value as GreetingTone)}
                placeholder="e.g., friendly and casual, use Egyptian slang"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
        </section>

        {/* Expense Categories */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Expense Categories
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map((categoryName) => (
                <span
                  key={categoryName}
                  className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-primary"
                >
                  {categoryName}
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseCategories((prev) =>
                        prev.filter((item) => item !== categoryName)
                      )
                    }
                    className="rounded p-0.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-400"
                    title={`Remove ${categoryName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                placeholder="Add category (e.g. Education)"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
              <button
                type="button"
                onClick={() => {
                  const value = newExpenseCategory.trim();
                  if (!value) return;
                  setExpenseCategories((prev) =>
                    normalizeCategories([...prev, value])
                  );
                  setNewExpenseCategory("");
                }}
                className="inline-flex items-center justify-center rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-elevated"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              These categories appear in Expenses filters and forms.
            </p>
          </div>
        </section>

        {/* Subscription Categories */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Subscription Categories
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {subscriptionCategories.map((categoryName) => (
                <span
                  key={categoryName}
                  className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-primary"
                >
                  {categoryName}
                  <button
                    type="button"
                    onClick={() =>
                      setSubscriptionCategories((prev) =>
                        prev.filter((item) => item !== categoryName)
                      )
                    }
                    className="rounded p-0.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-400"
                    title={`Remove ${categoryName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newSubscriptionCategory}
                onChange={(e) => setNewSubscriptionCategory(e.target.value)}
                placeholder="Add category (e.g. Utilities)"
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
              <button
                type="button"
                onClick={() => {
                  const value = newSubscriptionCategory.trim();
                  if (!value) return;
                  setSubscriptionCategories((prev) =>
                    normalizeCategories([...prev, value])
                  );
                  setNewSubscriptionCategory("");
                }}
                className="inline-flex items-center justify-center rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-elevated"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              These categories appear in the Subscriptions form.
            </p>
          </div>
        </section>

        <BackgroundNotificationSettings />

        {/* Reminder Timing */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Reminder Timing
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Rent Reminder Lead Time (days)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={rentReminderDays}
                onChange={(e) => setRentReminderDays(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Sends rent push reminders this many days before due date.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Bill Reminder Lead Time (days)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={billReminderDays}
                onChange={(e) => setBillReminderDays(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Sends subscription bill push reminders this many days before due date.
              </p>
            </div>
          </div>
        </section>

        {/* Rent Settings */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Rent Settings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Rent Amount ({baseCurrencyInput})
              </label>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Rent Due Day
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={rentDay}
                onChange={(e) => setRentDay(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>
        </section>

        {/* Budget Settings */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Budget & Paycheck
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Monthly Essentials Budget ({baseCurrencyInput})
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Paycheck Amount ({baseCurrencyInput})
              </label>
              <input
                type="number"
                value={paycheckAmount}
                onChange={(e) => setPaycheckAmount(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Paycheck Frequency
              </label>
              <select
                value={paycheckFreq}
                onChange={(e) =>
                  setPaycheckFreq(e.target.value as PaycheckFrequency)
                }
                className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </section>

        {/* Dismissed Recurring Charges */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <h2 className="mb-1 text-base font-semibold text-text-primary">
            Dismissed Recurring Charges
          </h2>
          <p className="mb-4 text-[11px] text-text-secondary">
            Merchants you dismiss from detected subscriptions won&apos;t appear again. Restore them here to re-enable detection.
          </p>
          {(settings?.dismissed_merchants ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(settings?.dismissed_merchants ?? []).map((merchant) => (
                <span
                  key={merchant}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-primary"
                >
                  {merchant}
                  <button
                    onClick={async () => {
                      try {
                        await fetch("/api/ai/dismiss-merchant", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ merchant }),
                        });
                        await refresh();
                      } catch { /* silent */ }
                    }}
                    className="ml-0.5 rounded p-0.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    title="Restore"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary/60">
              No dismissed merchants yet. Dismiss a detected recurring charge on the Subscriptions page and it will appear here.
            </p>
          )}
        </section>

        {/* Allocation Plans — CRUD */}
        <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Allocation Plans
            </h2>
            <button
              onClick={() => {
                setEditingPlanId(null);
                setPlanName("");
                setPlanAllocations(
                  Object.fromEntries(accounts.map((a) => [a.id, ""]))
                );
                setPlanError("");
                setShowPlanModal(true);
              }}
              disabled={accounts.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple transition hover:bg-accent-purple/20 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> New Plan
            </button>
          </div>

          {accounts.length === 0 && (
            <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-xs text-yellow-400">
              Create accounts first to build allocation plans.
            </p>
          )}

          {plans.length === 0 && accounts.length > 0 && (
            <p className="text-sm text-text-secondary">
              No allocation plans yet. Create one to define how income gets
              distributed across your accounts.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => {
              const alloc = plan.allocations as Record<string, number>;
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 transition ${
                    plan.is_active
                      ? "border-accent-purple bg-accent-purple/5"
                      : "border-border-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {plan.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      {plan.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-accent-purple/10 px-2 py-0.5 text-xs font-medium text-accent-purple">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivatePlan(plan.id)}
                          className="rounded-lg px-2 py-0.5 text-xs text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingPlanId(plan.id);
                          setPlanName(plan.name);
                          const existing: Record<string, string> = {};
                          for (const a of accounts) {
                            existing[a.id] = (alloc[a.id] ?? 0).toString();
                          }
                          setPlanAllocations(existing);
                          setPlanError("");
                          setShowPlanModal(true);
                        }}
                        className="rounded-lg p-1 text-text-secondary transition hover:bg-bg-elevated hover:text-accent-blue"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete plan "${plan.name}"?`
                            )
                          )
                            return;
                          await deleteAllocationPlan(plan.id);
                          await refresh();
                        }}
                        className="rounded-lg p-1 text-text-secondary transition hover:bg-red-500/10 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {accounts
                      .filter((a) => (alloc[a.id] ?? 0) > 0)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-text-secondary">
                            {a.name} ({a.type})
                          </span>
                          <span className="font-medium text-text-primary">
                            {m(alloc[a.id] ?? 0)}
                          </span>
                        </div>
                      ))}
                    <div className="mt-1 border-t border-border-subtle pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-text-secondary">
                          Total
                        </span>
                        <span className="font-bold text-text-primary">
                          {m(
                            Object.values(alloc).reduce(
                              (s, v) => s + (v || 0),
                              0
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Create / Edit Plan Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">
                  {editingPlanId ? "Edit Plan" : "New Allocation Plan"}
                </h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="rounded-lg p-1 text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Plan Name
                  </label>
                  <input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. 50/30/20 Split"
                    className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-text-secondary">
                    Allocations per Account ({baseCurrencyInput})
                  </label>
                  <div className="space-y-2">
                    {accounts.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3"
                      >
                        <span className="min-w-[120px] text-xs text-text-secondary">
                          {a.name} ({a.type})
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={planAllocations[a.id] ?? ""}
                          onChange={(e) =>
                            setPlanAllocations((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-purple"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-right text-xs text-text-secondary">
                    Total:{" "}
                    <span className="font-bold text-text-primary">
                      {formatMoney(
                        Object.values(planAllocations).reduce(
                          (s, v) => s + (parseFloat(v) || 0),
                          0
                        )
                      )}
                    </span>
                  </p>
                </div>

                {planError && (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {planError}
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setPlanError("");
                    if (!planName.trim()) {
                      setPlanError("Enter a plan name");
                      return;
                    }
                    const allocObj: Record<string, number> = {};
                    for (const [accId, val] of Object.entries(
                      planAllocations
                    )) {
                      const n = parseFloat(val);
                      if (n > 0) allocObj[accId] = n;
                    }
                    if (Object.keys(allocObj).length === 0) {
                      setPlanError(
                        "Assign an amount to at least one account"
                      );
                      return;
                    }

                    setPlanSaving(true);
                    try {
                      if (editingPlanId) {
                        await updateAllocationPlan(editingPlanId, {
                          name: planName.trim(),
                          allocations: allocObj,
                        });
                      } else {
                        await createAllocationPlan({
                          name: planName.trim(),
                          is_active: false,
                          allocations: allocObj,
                        });
                      }
                      await refresh();
                      setShowPlanModal(false);
                    } catch (err: unknown) {
                      setPlanError(
                        err instanceof Error
                          ? err.message
                          : "Failed to save plan"
                      );
                    } finally {
                      setPlanSaving(false);
                    }
                  }}
                  disabled={planSaving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {planSaving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editingPlanId ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change PIN */}
        <ChangePinSection />

        {/* Danger Zone */}
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="mb-2 text-base font-semibold text-red-400">
            Danger Zone
          </h2>
          <p className="mb-4 text-xs text-text-secondary">
            Reset all dashboard data. This will delete all accounts,
            transactions, goals, and settings. Seed data will be recreated on
            next login.
          </p>
          <button
            onClick={async () => {
              if (
                !confirm(
                  "This will permanently delete ALL your finance data. Are you sure?"
                )
              )
                return;
              if (
                !confirm(
                  "Really sure? This cannot be undone."
                )
              )
                return;

              const res = await fetch("/api/reset", { method: "POST" });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "Reset failed");
                return;
              }
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
          >
            <RotateCcw className="h-4 w-4" /> Reset All Data
          </button>
        </section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Change PIN Component                                               */
/* ------------------------------------------------------------------ */

function ChangePinSection() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const PIN_LEN = 6;

  const handleChangePin = async () => {
    setError("");
    setSuccess(false);

    if (!currentPin) {
      setError("Enter your current PIN");
      return;
    }
    if (newPin.length !== PIN_LEN || !/^\d+$/.test(newPin)) {
      setError(`New PIN must be exactly ${PIN_LEN} digits`);
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs don't match");
      return;
    }
    if (newPin === currentPin) {
      setError("New PIN must be different");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin, currentPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change PIN");
      }

      setSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent-purple" />
        <h2 className="text-base font-semibold text-text-primary">Change PIN</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Current PIN
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              maxLength={PIN_LEN}
              inputMode="numeric"
              placeholder="••••••"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 pr-10 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            New PIN
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              maxLength={PIN_LEN}
              inputMode="numeric"
              placeholder="••••••"
              className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 pr-10 text-sm text-text-primary outline-none focus:border-accent-purple"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Confirm New PIN
          </label>
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            maxLength={PIN_LEN}
            inputMode="numeric"
            placeholder="••••••"
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-purple"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
          PIN changed successfully!
        </p>
      )}

      <button
        onClick={handleChangePin}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        Update PIN
      </button>
    </section>
  );
}
