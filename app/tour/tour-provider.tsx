"use client";

import type { ReactNode } from "react";
import { NextStepProvider, NextStep } from "nextstepjs";
import { useNextAdapter } from "nextstepjs/adapters/next";
import { demoTourSteps } from "./tour-steps";
import { TourCard } from "./tour-card";

const TOUR_DONE_KEY = "demo-tour-completed";

export function TourProvider({ children }: { children: ReactNode }) {
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
        noInViewScroll
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
