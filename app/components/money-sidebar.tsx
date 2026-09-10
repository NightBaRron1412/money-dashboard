"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "../auth-provider";
import { useBalanceVisibility } from "../balance-visibility-provider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowDownUp,
  Wallet,
  Target,
  PiggyBank,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Home,
  Eye,
  EyeOff,
  TrendingUp,
  BarChart3,
  CreditCard,
  Receipt,
  Sun,
  Moon,
  MoreHorizontal,
  X,
  Scale,
  MessageSquare,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/income", label: "Income", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: ArrowDownUp },
  { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/accounts", label: "Accounts", icon: PiggyBank },
  { href: "/subscriptions", label: "Subscriptions", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reconcile", label: "Reconcile", icon: Scale },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MoneySidebar({
  collapsed,
  setCollapsed,
  demoMode = false,
  routeBase = "",
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  demoMode?: boolean;
  routeBase?: string;
}) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { showBalances, toggleBalances } = useBalanceVisibility();
  const { theme, setTheme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const isDark = (resolvedTheme ?? "dark") === "dark";
  const remapHref = (href: string) =>
    routeBase ? `${routeBase}${href === "/" ? "" : href}` : href;
  const mappedNavItems = navItems.map((item) => ({ ...item, href: remapHref(item.href) }));
  const mobileNavItems = [
    { href: remapHref("/"), label: "Home", icon: LayoutDashboard },
    { href: remapHref("/income"), label: "Income", icon: Wallet },
    { href: remapHref("/expenses"), label: "Expenses", icon: ArrowDownUp },
    { href: remapHref("/credit-cards"), label: "Cards", icon: CreditCard },
    { href: remapHref("/accounts"), label: "Accounts", icon: PiggyBank },
  ];

  const mobileOverflowItems = [
    { href: remapHref("/stocks"), label: "Stocks", icon: TrendingUp },
    { href: remapHref("/goals"), label: "Goals", icon: Target },
    { href: remapHref("/subscriptions"), label: "Subscriptions", icon: Receipt },
    { href: remapHref("/reports"), label: "Reports", icon: BarChart3 },
    { href: remapHref("/reconcile"), label: "Reconcile", icon: Scale },
    { href: remapHref("/chat"), label: "AI Chat", icon: MessageSquare },
    { href: remapHref("/settings"), label: "Settings", icon: Settings },
  ];

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreMenuOpen]);

  // If active page is in overflow, check for active state
  const isOverflowActive = mobileOverflowItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-bg-secondary/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-6 items-center py-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/" || item.href === routeBase
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] transition",
                  isActive
                    ? "text-accent-purple"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            aria-expanded={moreMenuOpen}
            aria-controls="mobile-more-navigation"
            aria-label="More navigation"
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] transition",
              isOverflowActive || moreMenuOpen
                ? "text-accent-purple"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

        {/* Keep the sheet outside the blurred nav. Mobile Safari otherwise
            treats the nav as the containing block for fixed descendants. */}
        {moreMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close more navigation"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setMoreMenuOpen(false)}
            />
            <section
              id="mobile-more-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-navigation-title"
              className="fixed inset-x-0 z-[60] mx-2 mb-1 rounded-2xl border border-border-subtle bg-bg-secondary p-3 shadow-lg md:hidden"
              style={{ bottom: "calc(3.5rem + 1px + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span id="mobile-more-navigation-title" className="text-xs font-semibold text-text-primary">More</span>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen(false)}
                  aria-label="Close more navigation menu"
                  className="rounded-lg p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mobileOverflowItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      onClick={() => setMoreMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                        isActive
                          ? "bg-accent-purple/10 text-accent-purple font-medium"
                          : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border-subtle pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTheme(isDark ? "light" : "dark");
                    setMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
                >
                  {isDark ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleBalances();
                    setMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
                >
                  {showBalances ? <EyeOff className="h-5 w-5 flex-shrink-0" /> : <Eye className="h-5 w-5 flex-shrink-0" />}
                  <span>{showBalances ? "Hide Balances" : "Show Balances"}</span>
                </button>
                {demoMode ? (
                  <Link
                    href="/"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    <span>Exit Demo</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      signOut();
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-400 transition hover:bg-red-500/10"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </section>
          </>
        )}

      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-bg-secondary transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed && (
            <span className="text-sm font-bold text-text-primary">💰 Finance</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {mappedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/" || item.href === routeBase
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition",
                  isActive
                    ? "bg-accent-purple/10 text-accent-purple font-medium"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border-subtle px-2 py-2 space-y-0.5">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "Toggle Theme" : undefined}
          >
            <Sun className="hidden h-4 w-4 flex-shrink-0 dark:block" />
            <Moon className="h-4 w-4 flex-shrink-0 dark:hidden" />
            {!collapsed && <span>Theme</span>}
          </button>
          <button
            data-tour="balance-toggle"
            onClick={toggleBalances}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? (showBalances ? "Hide Balances" : "Show Balances") : undefined}
          >
            {showBalances ? (
              <Eye className="h-4 w-4 flex-shrink-0" />
            ) : (
              <EyeOff className="h-4 w-4 flex-shrink-0" />
            )}
            {!collapsed && (
              <span>{showBalances ? "Hide Balances" : "Show Balances"}</span>
            )}
          </button>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "Back to Site" : undefined}
          >
            <Home className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Back to Site</span>}
          </Link>
          {demoMode ? (
            <Link
              href="/"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "Exit Demo" : undefined}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>Exit Demo</span>}
            </Link>
          ) : (
            <button
              onClick={() => signOut()}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-text-secondary transition hover:bg-red-500/10 hover:text-red-400",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "Sign Out" : undefined}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
