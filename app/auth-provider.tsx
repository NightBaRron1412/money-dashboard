"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { seedDefaultData } from "@/lib/money/queries";

interface AuthCtx {
  authenticated: boolean;
  loading: boolean;
  configured: boolean;
  pinExists: boolean | null;
  signIn: (pin: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthCtx>({
  authenticated: false,
  loading: true,
  configured: false,
  pinExists: null,
  signIn: async () => {},
  setPin: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function MoneyAuthProvider({
  children,
  demoMode = false,
}: {
  children: ReactNode;
  demoMode?: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const configured = demoMode || isSupabaseConfigured();
  const [pinExists, setPinExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (demoMode) {
      setAuthenticated(true);
      setPinExists(true);
      setLoading(false);
      return;
    }

    if (!configured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function checkSession() {
      try {
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();

        if (!cancelled) {
          setAuthenticated(sessionData.authenticated === true);
          setPinExists(sessionData.pinExists === true);
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
          setPinExists(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [configured, demoMode]);

  const signIn = async (pin: string) => {
    if (demoMode) {
      setAuthenticated(true);
      return;
    }

    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Invalid PIN");
    }

    setAuthenticated(true);

    if (configured) {
      seedDefaultData().catch(console.error);
    }
  };

  const setPin = async (pin: string) => {
    if (demoMode) {
      setAuthenticated(true);
      setPinExists(true);
      return;
    }

    const res = await fetch("/api/set-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to set PIN");
    }

    setPinExists(true);
    setAuthenticated(true);

    if (configured) {
      seedDefaultData().catch(console.error);
    }
  };

  const signOut = async () => {
    if (demoMode) return;
    await fetch("/api/session", { method: "DELETE" }).catch(() => {});
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, configured, pinExists, signIn, setPin, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
