"use client";

import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/lib/money/database.types";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Stat Card                                                         */
/* ------------------------------------------------------------------ */
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "money-surface money-interactive-surface min-h-[138px] p-6",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary">{title}</p>
          <p className="mt-3 break-words text-[1.75rem] font-semibold leading-none tracking-[-0.045em] text-text-primary">{value}</p>
          {subtitle && (
            <p className="mt-2 text-xs text-text-secondary">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.value >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value.toFixed(1)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-bg-elevated text-accent-purple">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress Bar                                                      */
/* ------------------------------------------------------------------ */
interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  color = "bg-accent-purple",
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn("space-y-1", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-text-secondary">{label}</span>}
          {showPercentage && (
            <span className="font-medium text-text-primary">{pct.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Header                                                       */
/* ------------------------------------------------------------------ */
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] text-text-primary sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="w-full flex-shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                       */
/* ------------------------------------------------------------------ */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="money-surface flex flex-col items-center justify-center border-dashed px-6 py-20 text-center">
      {icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated text-accent-purple">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal / Dialog wrapper                                            */
/* ------------------------------------------------------------------ */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[1.75rem] border border-border-subtle bg-[var(--card-bg)] p-7 shadow-card transition-all duration-200",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Money formatter                                                   */
/* ------------------------------------------------------------------ */
export function formatMoney(amount: number, currency: CurrencyCode = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const HIDDEN_BALANCE = "••••••";

export function formatMoneyExact(amount: number, currency: CurrencyCode = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(amount: number, currency: CurrencyCode = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  EST timezone helpers                                               */
/* ------------------------------------------------------------------ */
const TZ = "America/New_York";

/** Current date/time in EST */
export function nowEST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ })
  );
}

/** Today's date string in EST as YYYY-MM-DD */
export function todayEST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/* ------------------------------------------------------------------ */
/*  Category colors                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_COLOR_MAP: Record<string, { tw: string; hex: string }> = {
  Food:            { tw: "bg-[#d4875f]", hex: "#d4875f" },
  Transport:       { tw: "bg-[#6581c3]", hex: "#6581c3" },
  Bills:           { tw: "bg-[#8072b2]", hex: "#8072b2" },
  Rent:            { tw: "bg-[#c45f5f]", hex: "#c45f5f" },
  Fun:             { tw: "bg-[#bc7297]", hex: "#bc7297" },
  Health:          { tw: "bg-[#4f8f7e]", hex: "#4f8f7e" },
  "Personal Care": { tw: "bg-[#966c98]", hex: "#966c98" },
  Education:       { tw: "bg-[#6879ad]", hex: "#6879ad" },
  Shopping:        { tw: "bg-[#b66f7f]", hex: "#b66f7f" },
  Groceries:       { tw: "bg-[#789461]", hex: "#789461" },
  Entertainment:  { tw: "bg-[#ac6878]", hex: "#ac6878" },
  Savings:         { tw: "bg-[#478596]", hex: "#478596" },
  Travel:          { tw: "bg-[#568ba1]", hex: "#568ba1" },
  Insurance:       { tw: "bg-[#607a96]", hex: "#607a96" },
  Subscriptions:   { tw: "bg-[#756baa]", hex: "#756baa" },
  Other:           { tw: "bg-[#7d8490]", hex: "#7d8490" },
};

const FALLBACK_COLORS = [
  { tw: "bg-[#4f8f7e]", hex: "#4f8f7e" },
  { tw: "bg-[#568ba1]", hex: "#568ba1" },
  { tw: "bg-[#6879ad]", hex: "#6879ad" },
  { tw: "bg-[#d4875f]", hex: "#d4875f" },
  { tw: "bg-[#ac6878]", hex: "#ac6878" },
  { tw: "bg-[#789461]", hex: "#789461" },
  { tw: "bg-[#607a96]", hex: "#607a96" },
  { tw: "bg-[#b66f7f]", hex: "#b66f7f" },
  { tw: "bg-[#c45f5f]", hex: "#c45f5f" },
  { tw: "bg-[#756baa]", hex: "#756baa" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getCategoryColorTw(category: string): string {
  const entry = CATEGORY_COLOR_MAP[category];
  if (entry) return entry.tw;
  return FALLBACK_COLORS[hashStr(category) % FALLBACK_COLORS.length].tw;
}

export function getCategoryColorHex(category: string): string {
  const entry = CATEGORY_COLOR_MAP[category];
  if (entry) return entry.hex;
  return FALLBACK_COLORS[hashStr(category) % FALLBACK_COLORS.length].hex;
}
