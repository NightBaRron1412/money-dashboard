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
        "rounded-2xl border border-border-subtle bg-[var(--card-bg)] p-5 shadow-card backdrop-blur-sm transition hover:border-accent-blue/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary">{title}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary">
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
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-bg-secondary/50 backdrop-blur-sm px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-text-secondary">
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
          "relative z-10 mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border-subtle bg-[var(--card-bg)] p-6 shadow-card backdrop-blur-xl transition-all duration-200",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
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
  Food:            { tw: "bg-orange-500",  hex: "#f97316" },
  Transport:       { tw: "bg-blue-500",    hex: "#3b82f6" },
  Bills:           { tw: "bg-purple-500",  hex: "#8b5cf6" },
  Rent:            { tw: "bg-red-500",     hex: "#ef4444" },
  Fun:             { tw: "bg-pink-500",    hex: "#ec4899" },
  Health:          { tw: "bg-emerald-500", hex: "#10b981" },
  "Personal Care": { tw: "bg-fuchsia-500", hex: "#d946ef" },
  Education:       { tw: "bg-indigo-500",  hex: "#6366f1" },
  Shopping:        { tw: "bg-amber-500",   hex: "#f59e0b" },
  Groceries:       { tw: "bg-lime-500",    hex: "#84cc16" },
  Entertainment:   { tw: "bg-rose-500",    hex: "#f43f5e" },
  Savings:         { tw: "bg-teal-500",    hex: "#14b8a6" },
  Travel:          { tw: "bg-cyan-500",    hex: "#06b6d4" },
  Insurance:       { tw: "bg-sky-500",     hex: "#0ea5e9" },
  Subscriptions:   { tw: "bg-violet-500",  hex: "#8b5cf6" },
  Other:           { tw: "bg-gray-400",    hex: "#9ca3af" },
};

const FALLBACK_COLORS = [
  { tw: "bg-teal-500",    hex: "#14b8a6" },
  { tw: "bg-cyan-500",    hex: "#06b6d4" },
  { tw: "bg-indigo-500",  hex: "#6366f1" },
  { tw: "bg-amber-500",   hex: "#f59e0b" },
  { tw: "bg-rose-500",    hex: "#f43f5e" },
  { tw: "bg-lime-500",    hex: "#84cc16" },
  { tw: "bg-sky-500",     hex: "#0ea5e9" },
  { tw: "bg-yellow-500",  hex: "#eab308" },
  { tw: "bg-red-400",     hex: "#f87171" },
  { tw: "bg-violet-400",  hex: "#a78bfa" },
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
