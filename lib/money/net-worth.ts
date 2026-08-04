export interface NetWorthParts {
  cashBase: number;
  holdingsBase: number;
  dividendsBase: number;
  creditCardDebtBase: number;
}

/** Keep every dashboard, snapshot, and AI net-worth calculation identical. */
export function computeNetWorthBase(parts: NetWorthParts): number {
  return (
    parts.cashBase +
    parts.holdingsBase +
    parts.dividendsBase -
    parts.creditCardDebtBase
  );
}
