"use client";

import { useAuth } from "../auth-provider";
import { LoginForm } from "../login-form";
import { MoneyAuthProvider } from "../auth-provider";
import { BalanceVisibilityProvider } from "../balance-visibility-provider";
import { MoneyToolbar } from "./money-toolbar";
import { MoneySidebar } from "./money-sidebar";
import { VoiceTransaction } from "./voice-transaction";
import { useMoneyData } from "../hooks/use-money-data";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

function NotConfigured() {
  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-bg-main p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-secondary p-8 shadow-soft text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-pink shadow-glow">
          <Loader2 className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-text-primary">Supabase Not Configured</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Add <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs font-mono text-accent-blue">NEXT_PUBLIC_SUPABASE_URL</code> to your{" "}
          <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs font-mono text-accent-blue">.env.local</code> file, plus server-only{" "}
          <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs font-mono text-accent-blue">SUPABASE_PUBLISHABLE_KEY</code> and{" "}
          <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs font-mono text-accent-blue">MONEY_DATA_GATEWAY_SECRET</code> values, to enable the finance dashboard.
        </p>
      </div>
    </div>
  );
}

function VoiceTransactionOverlay({ demoMode }: { demoMode: boolean }) {
  const { accounts, creditCards, settings, refresh } = useMoneyData({ demoMode });
  return (
    <VoiceTransaction
      accounts={accounts}
      creditCards={creditCards}
      settings={settings}
      refresh={refresh}
      demoMode={demoMode}
    />
  );
}

function AuthGateInner({
  children,
  demoMode = false,
  routeBase = "",
}: {
  children: ReactNode;
  demoMode?: boolean;
  routeBase?: string;
}) {
  const { authenticated, loading, configured } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!demoMode && !configured) {
    return <NotConfigured />;
  }

  if (!demoMode && loading) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-bg-main">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  if (!demoMode && !authenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-bg-main">
      <MoneySidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        demoMode={demoMode}
        routeBase={routeBase}
      />
      <main className={cn("min-h-screen transition-all duration-200", sidebarCollapsed ? "md:ml-20" : "md:ml-64")}>
        <a href="#main-content" className="money-skip-link">Skip to content</a>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-10 xl:px-12">
          <MoneyToolbar routeBase={routeBase} demoMode={demoMode} />
        </div>
        <div id="main-content" tabIndex={-1} className="money-content mx-auto max-w-[1400px] px-4 pt-5 pb-28 sm:px-8 lg:px-10 lg:pt-7 xl:px-12 md:pb-10">
          {children}
        </div>
      </main>
      <VoiceTransactionOverlay demoMode={demoMode} />
    </div>
  );
}

export function MoneyShell({
  children,
  demoMode = false,
  routeBase = "",
}: {
  children: ReactNode;
  demoMode?: boolean;
  routeBase?: string;
}) {
  return (
    <MoneyAuthProvider demoMode={demoMode}>
      <BalanceVisibilityProvider>
        <AuthGateInner demoMode={demoMode} routeBase={routeBase}>
          {children}
        </AuthGateInner>
      </BalanceVisibilityProvider>
    </MoneyAuthProvider>
  );
}
