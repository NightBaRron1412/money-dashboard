import type { Transaction } from "./database.types";

/**
 * Excluded transactions still affect account balances, but should not be used
 * by monthly summaries, reports, charts, or forecasts.
 */
export function isIncludedInMonthlyTotals(
  transaction: Pick<Transaction, "exclude_from_monthly">
): boolean {
  return !transaction.exclude_from_monthly;
}
