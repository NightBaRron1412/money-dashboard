"use client";

import type { CardComponentProps } from "nextstepjs";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="relative w-[340px] max-w-[90vw] rounded-2xl border border-border-subtle bg-bg-secondary shadow-lg">
      {arrow}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {currentStep + 1} of {totalSteps}
          </span>
          {skipTour && (
            <button
              onClick={skipTour}
              className="rounded-lg p-1 text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-3">
          {step.icon && (
            <span className="text-2xl">{step.icon}</span>
          )}
          <h3 className="mt-1 text-base font-semibold text-text-primary">
            {step.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {step.content}
          </p>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={prevStep}
            disabled={isFirst}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {!isLast && skipTour && (
              <button
                onClick={skipTour}
                className="text-xs font-medium text-text-secondary transition hover:text-text-primary"
              >
                Skip tour
              </button>
            )}
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-1 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? "w-4 bg-accent-purple"
                  : i < currentStep
                    ? "w-1.5 bg-accent-purple/40"
                    : "w-1.5 bg-border-subtle"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
