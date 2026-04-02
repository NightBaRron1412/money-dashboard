import type { CurrencyCode } from "./database.types";

export type FxRates = {
  /** CAD per 1 USD */
  USDCAD: number;
  /** EGP per 1 USD */
  USDEGP: number;
};

export const DEFAULT_FX: FxRates = { USDCAD: 1, USDEGP: 1 };

function safeRate(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  fx: FxRates
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;

  const USDCAD = safeRate(fx.USDCAD);
  const USDEGP = safeRate(fx.USDEGP);

  // Convert to USD as a pivot.
  const usd =
    from === "USD"
      ? amount
      : from === "CAD"
        ? amount / USDCAD
        : amount / USDEGP;

  // Convert USD -> target.
  return to === "USD" ? usd : to === "CAD" ? usd * USDCAD : usd * USDEGP;
}

