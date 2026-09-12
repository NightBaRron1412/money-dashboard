import type { RecurrenceFrequency } from "./database.types";

export function subscriptionYearlyEquivalent(
  amount: number,
  frequency: RecurrenceFrequency
): number {
  switch (frequency) {
    case "weekly":
      return amount * 52;
    case "bi-weekly":
      return amount * 26;
    case "monthly":
      return amount * 12;
    case "yearly":
      return amount;
  }
}

export function subscriptionMonthlyEquivalent(
  amount: number,
  frequency: RecurrenceFrequency
): number {
  return subscriptionYearlyEquivalent(amount, frequency) / 12;
}
