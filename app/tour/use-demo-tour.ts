"use client";

import { useEffect, useCallback, useState } from "react";
import { useNextStep } from "nextstepjs";

const TOUR_DONE_KEY = "demo-tour-completed";

export function useDemoTour() {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_DONE_KEY);
      setHasCompleted(done === "true");

      if (done !== "true") {
        const timer = setTimeout(() => {
          startNextStep("demoTour");
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      setHasCompleted(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restartTour = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_DONE_KEY);
    } catch {}
    setHasCompleted(false);
    startNextStep("demoTour");
  }, [startNextStep]);

  return { restartTour, hasCompleted, isTourActive: isNextStepVisible };
}
