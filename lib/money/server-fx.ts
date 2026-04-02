import type { CurrencyCode } from "./database.types";
import { fetchYahooQuotes, type QuoteResult } from "./yahoo-finance";

export type FxRates = { USDCAD: number; USDEGP: number };
export type { QuoteResult as StockQuote };

let cachedFx: { rates: FxRates; expiresAt: number } | null = null;
let cachedStocks: { quotes: Record<string, QuoteResult>; expiresAt: number } | null = null;

export async function getServerFxRates(): Promise<FxRates> {
  if (cachedFx && Date.now() < cachedFx.expiresAt) return cachedFx.rates;

  try {
    const data = await fetchYahooQuotes(["USDCAD=X", "USDEGP=X"]);
    const rates: FxRates = {
      USDCAD: data["USDCAD=X"]?.price || 1,
      USDEGP: data["USDEGP=X"]?.price || 1,
    };
    cachedFx = { rates, expiresAt: Date.now() + 30 * 60 * 1000 };
    return rates;
  } catch (err) {
    console.error("Failed to fetch FX rates from Yahoo:", err);
  }

  return { USDCAD: 1, USDEGP: 1 };
}

export async function getStockQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
  if (symbols.length === 0) return {};

  const key = symbols.sort().join(",");
  if (cachedStocks && Date.now() < cachedStocks.expiresAt) {
    if (symbols.every((s) => s in cachedStocks!.quotes)) return cachedStocks.quotes;
  }

  try {
    const quotes = await fetchYahooQuotes(symbols);
    cachedStocks = { quotes, expiresAt: Date.now() + 15 * 60 * 1000 };
    return quotes;
  } catch (err) {
    console.error("Failed to fetch stock quotes from Yahoo:", err);
  }

  return {};
}

function safeRate(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function convertToBase(
  amount: number,
  from: CurrencyCode,
  baseCurrency: CurrencyCode,
  fx: FxRates
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === baseCurrency) return amount;

  const USDCAD = safeRate(fx.USDCAD);
  const USDEGP = safeRate(fx.USDEGP);

  const usd =
    from === "USD" ? amount : from === "CAD" ? amount / USDCAD : amount / USDEGP;

  return baseCurrency === "USD" ? usd : baseCurrency === "CAD" ? usd * USDCAD : usd * USDEGP;
}
