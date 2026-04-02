"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface BalanceVisibilityCtx {
  showBalances: boolean;
  toggleBalances: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityCtx>({
  showBalances: true,
  toggleBalances: () => {},
});

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}

const STORAGE_KEY = "money_show_balances";

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [showBalances, setShowBalances] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "0") {
      setShowBalances(false);
    }
  }, []);

  const toggleBalances = () => {
    setShowBalances((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <BalanceVisibilityContext.Provider value={{ showBalances, toggleBalances }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}
