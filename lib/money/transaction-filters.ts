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

/** Full ledger value remains intact. Round the personal share in the source currency. */
export function monthlyAmount(transaction: { amount: number; type?: string; exclude_from_monthly?: boolean; personal_share_percent?: number }): number {
  if (transaction.exclude_from_monthly) return 0;
  const rawShare = transaction.personal_share_percent ?? 100;
  const share = transaction.type === "expense" && Number.isFinite(rawShare) ? Math.max(0, Math.min(100, rawShare)) : 100;
  return Math.round((transaction.amount * share / 100 + Number.EPSILON) * 100) / 100;
}
