import { NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { computeAccountBalance } from "@/lib/money/queries";
import { getServerFxRates, convertToBase, getStockQuotes } from "@/lib/money/server-fx";
import type { CurrencyCode } from "@/lib/money/database.types";

/**
 * POST /api/snapshots/capture
 *
 * Computes today's net worth on the server using the same formula as the
 * dashboard widget and upserts a row into money_net_worth_snapshots
 * (UNIQUE on user_id + date). Called by:
 *   - daily Vercel cron
 *   - dashboard mount (fire-and-forget) as a fallback for active users
 */
export async function POST(req: Request) {
  // Allow the Vercel cron user-agent OR an authenticated session
  const userAgent = req.headers.get("user-agent") ?? "";
  const isCron = userAgent.includes("vercel-cron");
  if (!isCron) {
    const authErr = await requireAuth();
    if (authErr) return authErr;
  }

  try {
    const supabase = getServerSupabase();

    const [accountsRes, txsRes, holdingsRes, dividendsRes, paymentsRes, settingsRes, fx] = await Promise.all([
      supabase.from("money_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_holdings").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_dividends").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_payments").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_settings").select("base_currency").eq("user_id", OWNER_ID).single(),
      getServerFxRates(),
    ]);

    const accounts = accountsRes.data ?? [];
    const allTxs = txsRes.data ?? [];
    const holdings = holdingsRes.data ?? [];
    const dividends = dividendsRes.data ?? [];
    const allPayments = paymentsRes.data ?? [];
    const base: CurrencyCode = (settingsRes.data?.base_currency as CurrencyCode) ?? "CAD";
    const toBase = (amount: number, from: CurrencyCode) => convertToBase(amount, from, base, fx);

    // Cash component — same as dashboard's cashTotalBase (checking accounts only)
    let cashBase = 0;
    for (const acct of accounts) {
      if (acct.type !== "checking") continue;
      const bal = computeAccountBalance(acct.id, allTxs, acct.starting_balance ?? 0, allPayments);
      cashBase += toBase(bal, acct.currency);
    }

    // Holdings market value
    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    const quotes = await getStockQuotes(symbols);

    // Guard: if any real (non-cash) holding is missing a usable price, the
    // quote provider failed for it. Writing the snapshot anyway would record
    // a garbage (too-low) net worth and corrupt the chart. Bail instead —
    // the next cron run or dashboard load will retry with good quotes.
    const missingQuotes = holdings
      .filter((h) => {
        const sym = h.symbol.toUpperCase();
        if (sym === "CASH" || sym === "CASHCAD") return false;
        const price = quotes[sym]?.price;
        return h.shares > 0 && (!price || price <= 0);
      })
      .map((h) => h.symbol);
    if (missingQuotes.length > 0) {
      return NextResponse.json(
        { ok: false, skipped: true, reason: "missing_quotes", symbols: missingQuotes },
        { status: 200 }
      );
    }

    let holdingsBase = 0;
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const quote = quotes[sym];
      const rawCur = sym === "CASH" ? "USD" : sym === "CASHCAD" ? "CAD" : (quote?.currency ?? "USD");
      const quoteCurrency: CurrencyCode =
        rawCur === "CAD" || rawCur === "USD" || rawCur === "EGP" ? rawCur : "USD";
      const price = sym === "CASH" || sym === "CASHCAD" ? 1 : (quote?.price ?? 0);
      holdingsBase += h.shares * toBase(price, quoteCurrency);
    }

    // Non-reinvested dividends
    const dividendsBase = dividends
      .filter((d) => !d.reinvested)
      .reduce((s, d) => s + toBase(d.amount, d.currency), 0);

    // Credit card debt is a liability — subtract from net worth.
    const cards = (await supabase.from("money_credit_cards").select("*").eq("user_id", OWNER_ID)).data ?? [];
    const charges = (await supabase.from("money_credit_card_charges").select("*").eq("user_id", OWNER_ID)).data ?? [];
    let ccDebtBase = 0;
    for (const c of cards) {
      const chg = charges.filter((x) => x.card_id === c.id).reduce((s, x) => s + x.amount, 0);
      const pay = allPayments.filter((p) => p.card_id === c.id).reduce((s, p) => s + p.amount, 0);
      ccDebtBase += toBase(chg - pay, c.currency as CurrencyCode);
    }

    const totalBase = cashBase + holdingsBase + dividendsBase - ccDebtBase;
    const today = new Date().toISOString().slice(0, 10);

    const round = (n: number) => Math.round(n * 100) / 100;

    const { data, error } = await supabase
      .from("money_net_worth_snapshots")
      .upsert(
        {
          user_id: OWNER_ID,
          date: today,
          cash_base: round(cashBase),
          holdings_base: round(holdingsBase),
          dividends_base: round(dividendsBase),
          total_base: round(totalBase),
          base_currency: base,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, snapshot: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to capture snapshot" },
      { status: 500 }
    );
  }
}
