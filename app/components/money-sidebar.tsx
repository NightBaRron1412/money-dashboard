"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
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
  CircleDollarSign,
} from "lucide-react";

const navSections = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Everyday money",
    items: [
      { href: "/income", label: "Income", icon: Wallet },
      { href: "/expenses", label: "Expenses", icon: ArrowDownUp },
      { href: "/accounts", label: "Accounts", icon: PiggyBank },
      { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
      { href: "/subscriptions", label: "Subscriptions", icon: Receipt },
    ],
  },
  {
    label: "Plan & grow",
    items: [
      { href: "/stocks", label: "Investments", icon: TrendingUp },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/reconcile", label: "Reconcile", icon: Scale },
      { href: "/chat", label: "AI Assistant", icon: MessageSquare },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
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
  const mappedNavSections = navSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, href: remapHref(item.href) })),
  }));
  const mobileNavItems = [
    { href: remapHref("/"), label: "Home", icon: LayoutDashboard },
    { href: remapHref("/expenses"), label: "Expenses", icon: ArrowDownUp },
    { href: remapHref("/accounts"), label: "Accounts", icon: PiggyBank },
    { href: remapHref("/stocks"), label: "Invest", icon: TrendingUp },
  ];

  const mobileOverflowItems = [
    { href: remapHref("/income"), label: "Income", icon: Wallet },
    { href: remapHref("/credit-cards"), label: "Credit Cards", icon: CreditCard },
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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setMoreMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  // If active page is in overflow, check for active state
  const isOverflowActive = mobileOverflowItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <Dialog open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-3 z-50 overflow-hidden rounded-2xl border border-border-subtle bg-[var(--sidebar-bg)] shadow-card backdrop-blur-xl md:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid grid-cols-5 items-center p-1.5">
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
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition",
                  isActive
                    ? "bg-text-primary text-bg-main"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <DialogTrigger asChild>
          <button
            type="button"
            aria-expanded={moreMenuOpen}
            aria-label="More navigation"
            aria-haspopup="dialog"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition",
              isOverflowActive || moreMenuOpen
                ? "bg-text-primary text-bg-main"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
          </DialogTrigger>
        </div>
      </nav>

        <DialogContent showCloseButton={false} aria-describedby={undefined} className="money-more-sheet md:hidden">
              <div className="mb-2 flex items-center justify-between px-1">
                <DialogTitle className="text-lg">Explore Money</DialogTitle>
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
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                        isActive
                          ? "bg-text-primary text-bg-main"
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
        </DialogContent>

      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-[var(--sidebar-bg)] backdrop-blur-xl transition-all duration-200 md:flex",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn("relative flex items-center gap-3 px-4 py-6", collapsed ? "justify-center" : "justify-between")}>
          <Link
            href={remapHref("/") as any}
            className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}
            title={collapsed ? "Money" : undefined}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple text-text-on-accent shadow-sm">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-base font-semibold tracking-[-0.03em] text-text-primary">Money</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-text-secondary">Personal finance</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn("rounded-full p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary", collapsed && "absolute -right-3 top-8 border border-border-subtle bg-[var(--card-bg)] shadow-sm")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
          {mappedNavSections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-secondary/70">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/" || item.href === routeBase
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-text-primary text-bg-main shadow-sm"
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
            </div>
          ))}
        </nav>

        <div className="mx-3 space-y-1 border-t border-border-subtle py-4">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
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
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
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
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
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
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary",
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
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-red-500/10 hover:text-red-400",
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
    </Dialog>
  );
}
