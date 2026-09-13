"use client";
import { Users } from "lucide-react";
import { formatMoney } from "./money-ui";
import { monthlyAmount } from "@/lib/money/transaction-filters";
import type { CurrencyCode } from "@/lib/money/database.types";

export function ExpenseShare({ percent, onPercentChange, sharedWith, onSharedWithChange, amount, currency, excluded = false }: {
  percent: number; onPercentChange: (value: number) => void;
  sharedWith: string; onSharedWithChange: (value: string) => void;
  amount: number; currency: CurrencyCode; excluded?: boolean;
}) {
  const shared = percent < 100 || !!sharedWith;
  const personal = monthlyAmount({amount: Number.isFinite(amount) ? amount : 0, type:"expense", personal_share_percent:percent, exclude_from_monthly:excluded});
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 whitespace-normal">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-text-primary">
        <input type="checkbox" checked={shared} onChange={event => { onPercentChange(event.target.checked ? 50 : 100); if (!event.target.checked) onSharedWithChange(""); }} className="h-4 w-4 accent-[var(--accent-blue)]" />
        <Users className="h-4 w-4" /> Shared expense
      </label>
      {shared && <div className="mt-4 space-y-4">
        <label className="block text-xs text-text-secondary">Shared with <span>(optional)</span>
          <input aria-label="Shared with" maxLength={100} value={sharedWith} onChange={event => onSharedWithChange(event.target.value)} placeholder="A person or group" className="mt-1.5 w-full rounded-xl border border-border-subtle bg-[var(--card-bg)] px-3 py-2.5 text-sm text-text-primary" />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-text-secondary">Your share (%)
            <input aria-label="Your share (%)" type="number" inputMode="decimal" min={0} max={100} step="0.01" required value={percent} onChange={event => onPercentChange(Math.max(0, Math.min(100, Number(event.target.value))))} className="mt-1.5 w-full rounded-xl border border-border-subtle bg-[var(--card-bg)] px-3 py-2.5 text-sm text-text-primary" />
          </label>
          <button type="button" onClick={() => onPercentChange(50)} className="rounded-xl border border-border-subtle px-3 py-2.5 text-xs text-text-primary">Split 50/50</button>
        </div>
        <p className="text-xs leading-relaxed text-text-secondary" aria-live="polite">
          <strong className="text-text-primary">{formatMoney(personal, currency)}</strong> counts in your spending. {excluded ? "This expense is fully excluded." : `${(100 - percent).toFixed(2).replace(/\.00$/, "")}% is excluded as someone else’s share.`} The full payment stays in your account or card balance. This does not track repayments.
        </p>
      </div>}
    </div>
  );
}
