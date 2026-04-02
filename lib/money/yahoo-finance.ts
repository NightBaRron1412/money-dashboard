/**
 * Shared Yahoo Finance quote fetcher.
 * Used by both the /api/stocks route and server-side helpers (server-fx.ts).
 * Keeps a single crumb/cookie cache per process to avoid duplicate auth requests.
 */

export interface QuoteResult {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  name: string;
  currency: string;
}

/* ---------- Yahoo crumb/cookie cache ---------- */
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiresAt = 0;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiresAt) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  const initRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "manual",
  });

  const setCookies = initRes.headers.getSetCookie?.() ?? [];
  const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");

  const crumbRes = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    { headers: { "User-Agent": "Mozilla/5.0", Cookie: cookieStr } }
  );

  if (!crumbRes.ok) {
    throw new Error(`Failed to get Yahoo crumb: ${crumbRes.status}`);
  }

  const crumb = await crumbRes.text();
  cachedCrumb = crumb;
  cachedCookie = cookieStr;
  crumbExpiresAt = Date.now() + 20 * 60 * 1000;

  return { crumb, cookie: cookieStr };
}

function parseQuotes(quotes: any[], results: Record<string, QuoteResult>) {
  for (const q of quotes) {
    const sym = (q.symbol as string).toUpperCase();
    results[sym] = {
      price: q.regularMarketPrice ?? 0,
      previousClose: q.regularMarketPreviousClose ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      name: q.shortName ?? q.longName ?? sym,
      currency: q.currency ?? "USD",
    };
  }
}

/* ---------- Public API ---------- */

const LOCAL_SYMBOLS: Record<string, QuoteResult> = {
  CASH: { price: 1, previousClose: 1, change: 0, changePercent: 0, name: "Cash (USD)", currency: "USD" },
  CASHCAD: { price: 1, previousClose: 1, change: 0, changePercent: 0, name: "Cash (CAD)", currency: "CAD" },
};

const ALIASES: Record<string, string> = {
  GOLD: "GC=F",
};

/**
 * Fetch quotes for an array of ticker symbols directly from Yahoo Finance.
 * Handles CASH/CASHCAD locally, resolves GOLD→GC=F alias, and does
 * crumb/cookie authentication automatically.
 */
export async function fetchYahooQuotes(
  symbols: string[]
): Promise<Record<string, QuoteResult>> {
  if (symbols.length === 0) return {};

  const requested = symbols.map((s) => s.toUpperCase().trim()).filter(Boolean);
  const results: Record<string, QuoteResult> = {};

  for (const sym of requested) {
    if (LOCAL_SYMBOLS[sym]) results[sym] = LOCAL_SYMBOLS[sym];
  }

  const tickers = [
    ...new Set(
      requested
        .filter((s) => !LOCAL_SYMBOLS[s])
        .map((s) => (ALIASES[s] ?? s).toUpperCase())
    ),
  ];

  if (tickers.length > 0) {
    try {
      const { crumb, cookie } = await getYahooCrumb();
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&crumb=${encodeURIComponent(crumb)}`;

      let res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
      });

      if (!res.ok) {
        cachedCrumb = null;
        const retry = await getYahooCrumb();
        const retryUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&crumb=${encodeURIComponent(retry.crumb)}`;
        res = await fetch(retryUrl, {
          headers: { "User-Agent": "Mozilla/5.0", Cookie: retry.cookie },
        });
      }

      if (res.ok) {
        const data = await res.json();
        parseQuotes(data?.quoteResponse?.result ?? [], results);
      }
    } catch (err) {
      console.error("Yahoo Finance fetch error:", err);
    }

    for (const t of tickers) {
      if (!results[t]) {
        results[t] = { price: 0, previousClose: 0, change: 0, changePercent: 0, name: t, currency: "USD" };
      }
    }

    for (const [reqSym, actualSym] of Object.entries(ALIASES)) {
      if (!requested.includes(reqSym)) continue;
      const actualKey = actualSym.toUpperCase();
      const q = results[actualKey];
      results[reqSym] = q
        ? reqSym === "GOLD" ? { ...q, name: "Gold (oz)", currency: "USD" } : q
        : { price: 0, previousClose: 0, change: 0, changePercent: 0, name: reqSym, currency: "USD" };
      if (!requested.includes(actualKey)) delete results[actualKey];
    }
  }

  return results;
}
