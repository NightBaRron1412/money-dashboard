import { describe, expect, it } from "vitest";
import {
  subscriptionMonthlyEquivalent,
  subscriptionYearlyEquivalent,
} from "@/lib/money/subscription-costs";

describe("subscription cost equivalents", () => {
  it.each([
    ["weekly", 10, 520],
    ["bi-weekly", 10, 260],
    ["monthly", 10, 120],
    ["yearly", 10, 10],
  ] as const)("annualizes a %s subscription exactly", (frequency, amount, yearly) => {
    expect(subscriptionYearlyEquivalent(amount, frequency)).toBe(yearly);
    expect(subscriptionMonthlyEquivalent(amount, frequency)).toBeCloseTo(yearly / 12);
  });
});
