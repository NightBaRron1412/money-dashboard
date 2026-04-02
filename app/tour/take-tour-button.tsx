"use client";

import { useDemoTour } from "./use-demo-tour";
import { HelpCircle } from "lucide-react";

export function TakeTourButton() {
  const { restartTour, hasCompleted, isTourActive } = useDemoTour();

  if (isTourActive) return null;

  return (
    <button
      onClick={restartTour}
      className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent-purple/40 hover:text-accent-purple"
      title="Take a guided tour"
    >
      <HelpCircle className="h-3.5 w-3.5" />
      {hasCompleted ? "Replay Tour" : "Take Tour"}
    </button>
  );
}
