"use client";
import { useId, useState } from "react";
import type { Transaction, CurrencyCode } from "@/lib/money/database.types";
import { formatMoney } from "./money-ui";

export function RefundExpensePicker({
  transactions,
  value,
  onChange,
  currency,
  amount,
  restoredAmount = 0,
  required = true,
}: {
  transactions: Transaction[];
  value: string;
  onChange: (value: string) => void;
  currency: CurrencyCode;
  amount: number;
  restoredAmount?: number;
  required?: boolean;
}) {
  const fieldId = useId();
  const [search, setSearch] = useState("");
  const candidates = transactions.filter(
    (t) =>
      t.type === "expense" &&
      t.currency === currency &&
      (t.id === value ||
        (t.amount > (t.refunded_amount ?? 0) &&
          `${t.merchant} ${t.date} ${t.category}`.toLowerCase().includes(search.toLowerCase())))
  );
  const selected = transactions.find((t) => t.id === value);
  const remaining = selected
    ? Math.max(0, selected.amount - (selected.refunded_amount ?? 0) + restoredAmount)
    : 0;
  return (
    <section className="space-y-3 rounded-2xl border border-border-subtle bg-bg-elevated p-4">
      <label className="block text-sm font-semibold text-text-primary" htmlFor={fieldId}>
        Original expense
      </label>
      <input
        aria-label="Find original expense"
        type="search"
        placeholder="Find a merchant, category or date"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-border-subtle bg-bg-main px-3 py-2 text-sm"
      />
      <select
        id={fieldId}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border-subtle bg-bg-main px-3 py-3 text-sm"
      >
        <option value="">
          {required
            ? "Choose the purchase being refunded"
            : "Statement credit — no purchase to refund"}
        </option>
        {candidates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.date} · {t.merchant || t.category || "Expense"} ·{" "}
            {formatMoney(
              t.amount - (t.refunded_amount ?? 0) + (t.id === value ? restoredAmount : 0),
              t.currency
            )}{" "}
            remaining
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-xs leading-relaxed text-text-secondary">
          {formatMoney(Math.max(0, remaining - (Number.isFinite(amount) ? amount : 0)), currency)}{" "}
          left after this refund. Spending is adjusted in the original purchase month; your balance
          changes on the refund date.
          {amount > remaining && (
            <span role="alert" className="block text-red-500">
              Amount exceeds the remaining {formatMoney(remaining, currency)}.
            </span>
          )}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-text-secondary">
          Link a purchase to reduce its spending total without counting the refund as income. Only
          purchases in {currency} are shown.
        </p>
      )}
    </section>
  );
}
