"use client";

import { useCallback, type ReactNode } from "react";
import { NextStepProvider, NextStep } from "nextstepjs";
import { useNextAdapter } from "nextstepjs/adapters/next";
import { demoTourSteps } from "./tour-steps";
import { TourCard } from "./tour-card";

const TOUR_DONE_KEY = "demo-tour-completed";

const allSteps = demoTourSteps[0]?.steps ?? [];

export function TourProvider({ children }: { children: ReactNode }) {
  const handleStepChange = useCallback((step: number) => {
    const target = allSteps[step];
    if (!target?.selector) return;

    const waitForElement = (retries: number) => {
      const el = document.querySelector(target.selector!);
      if (!el && retries > 0) {
        setTimeout(() => waitForElement(retries - 1), 200);
        return;
      }
    };
    setTimeout(() => waitForElement(15), 300);
  }, []);

  return (
    <NextStepProvider>
      <NextStep
        steps={demoTourSteps}
        cardComponent={TourCard}
        navigationAdapter={useNextAdapter}
        shadowRgb="0, 0, 0"
        shadowOpacity="0.6"
        displayArrow
        scrollToTop={false}
        onStepChange={handleStepChange}
        onComplete={() => {
          try {
            localStorage.setItem(TOUR_DONE_KEY, "true");
          } catch {}
        }}
        onSkip={() => {
          try {
            localStorage.setItem(TOUR_DONE_KEY, "true");
          } catch {}
        }}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
