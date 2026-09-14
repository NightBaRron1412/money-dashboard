"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import { Search, Eye, EyeOff, Sun, Moon, ArrowUpRight, LayoutDashboard, Wallet, ArrowDownUp, PiggyBank, CreditCard, TrendingUp, Target, Receipt, BarChart3, Scale, MessageSquare, Settings } from "lucide-react";
import { useBalanceVisibility } from "../balance-visibility-provider";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";

const destinations = [
  { path: "", title: "Overview", detail: "Your financial picture", icon: LayoutDashboard },
  { path: "/income", title: "Income", detail: "Paychecks, deposits and earnings", icon: Wallet },
  { path: "/expenses", title: "Expenses", detail: "Spending and transactions", icon: ArrowDownUp },
  { path: "/accounts", title: "Accounts", detail: "Balances and transfers", icon: PiggyBank },
  { path: "/credit-cards", title: "Credit cards", detail: "Charges and payments", icon: CreditCard },
  { path: "/stocks", title: "Investments", detail: "Stocks, holdings and dividends", icon: TrendingUp },
  { path: "/goals", title: "Goals", detail: "Save for what matters", icon: Target },
  { path: "/subscriptions", title: "Subscriptions", detail: "Recurring bills and renewals", icon: Receipt },
  { path: "/reports", title: "Reports", detail: "Trends and cash flow", icon: BarChart3 },
  { path: "/reconcile", title: "Reconcile", detail: "Check your bank balances", icon: Scale },
  { path: "/chat", title: "AI Assistant", detail: "Ask about your finances", icon: MessageSquare },
  { path: "/settings", title: "Settings", detail: "Preferences and categories", icon: Settings },
];

export function MoneyToolbar({ routeBase = "", demoMode = false, children }: { routeBase?: string; demoMode?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { showBalances, toggleBalances } = useBalanceVisibility();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  const run = (action: () => void) => { setOpen(false); action(); };
  return (
    <header className="money-toolbar flex items-center justify-between gap-3 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="md:hidden">Money<span className="text-accent-blue">.</span></span>
        {demoMode && <span data-tour="nav-anchor" className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">Demo</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button aria-label="Search pages and actions" className="money-tool-button gap-2 sm:px-3">
              <Search className="h-[18px] w-[18px]" />
              <span className="hidden text-xs sm:inline">Search</span>
              <kbd className="ml-4 hidden rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-secondary lg:inline">⌘ / Ctrl K</kbd>
            </button>
          </DialogTrigger>
          <DialogContent showCloseButton={false} aria-describedby={undefined} className="money-command max-w-xl overflow-hidden p-0">
            <DialogTitle className="sr-only">Search pages and actions</DialogTitle>
            <Command label="Pages and actions" loop>
              <div className="flex items-center gap-3 border-b border-border-subtle px-5">
                <Search className="h-5 w-5 shrink-0 text-text-secondary" />
                <Command.Input placeholder="Where would you like to go?" className="h-16 w-full bg-transparent text-base outline-none placeholder:text-text-secondary" />
                <button onClick={() => setOpen(false)} className="text-xs text-text-secondary">Close</button>
              </div>
              <Command.List className="max-h-[min(440px,60dvh)] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-sm text-text-secondary">No matches. Try “accounts”, “spending”, or “theme”.</Command.Empty>
                <Command.Group heading="Go to">
                  {destinations.map(({ path, title, detail, icon: Icon }) => (
                    <Command.Item key={title} value={`${title} ${detail}`} onSelect={() => run(() => router.push(`${routeBase}${path}` || "/"))}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-elevated"><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className="text-xs text-text-secondary">{detail}</span></span>
                      <ArrowUpRight className="h-4 w-4 text-text-secondary" />
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Quick actions">
                  <Command.Item onSelect={() => run(toggleBalances)}><Eye className="h-4 w-4" />{showBalances ? "Hide" : "Show"} balances</Command.Item>
                  <Command.Item onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}><Sun className="h-4 w-4" />Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme</Command.Item>
                </Command.Group>
              </Command.List>
              <div className="hidden border-t border-border-subtle px-5 py-3 text-xs text-text-secondary sm:block">↑ ↓ to navigate · Enter to open · Esc to close</div>
            </Command>
          </DialogContent>
        </Dialog>
        {children}
        <button data-tour="privacy-anchor" onClick={toggleBalances} aria-label={showBalances ? "Hide balances" : "Show balances"} title={showBalances ? "Hide balances" : "Show balances"} className="money-tool-button">
          {showBalances ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme" title="Toggle theme" className="money-tool-button">
          <Sun className="hidden h-[18px] w-[18px] dark:block" /><Moon className="h-[18px] w-[18px] dark:hidden" />
        </button>
      </div>
    </header>
  );
}
