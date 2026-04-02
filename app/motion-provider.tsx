"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";

type MotionPreference = {
  hydrated: boolean;
  motionEnabled: boolean;
  setMotionEnabled: (value: boolean) => void;
  toggleMotion: () => void;
};

const MotionPreferenceContext = createContext<MotionPreference | null>(null);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);

  useEffect(() => {
    setHydrated(true);
    try {
      const stored = localStorage.getItem("motion-enabled");
      // Default to true (on) if nothing stored
      setMotionEnabled(stored === null ? true : stored === "true");
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("motion-enabled", motionEnabled ? "true" : "false");
    } catch {
      // ignore storage errors
    }

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-force-motion",
        motionEnabled ? "true" : "false"
      );
    }
  }, [motionEnabled]);

  const value = useMemo<MotionPreference>(() => {
    return {
      hydrated,
      motionEnabled,
      setMotionEnabled,
      toggleMotion: () => setMotionEnabled((v) => !v),
    };
  }, [hydrated, motionEnabled]);

  return (
    <MotionPreferenceContext.Provider value={value}>
      <MotionConfig reducedMotion={motionEnabled ? "never" : "always"}>
        {children}
      </MotionConfig>
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference(): MotionPreference {
  const ctx = useContext(MotionPreferenceContext);
  if (!ctx) {
    throw new Error("useMotionPreference must be used within <MotionProvider />");
  }
  return ctx;
}
