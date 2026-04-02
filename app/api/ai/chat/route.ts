import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { isGeminiConfigured, generateText } from "@/lib/money/ai";
import { getServerFxRates, convertToBase, getStockQuotes } from "@/lib/money/server-fx";
import { computeAccountBalance } from "@/lib/money/queries";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import type { CurrencyCode } from "@/lib/money/database.types";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      reply: "AI chat isn't available right now.",
    });
  }

  try {
    const { message, history } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = new Date();

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthCutoff = sixMonthsAgo.toISOString().slice(0, 10);

    const [txRes, subRes, settingsRes, accountRes, holdingRes, goalRes, goalAcctRes, ccRes, ccChargeRes, ccPayRes, dividendRes, fx, allTxRes, allPayRes] = await Promise.all([
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID).gte("date", sixMonthCutoff).order("date", { ascending: false }).limit(1000),
      supabase.from("money_subscriptions").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_settings").select("base_currency, display_name, expense_categories, subscription_categories, rent_amount, rent_day, monthly_essentials_budget, paycheck_amount, paycheck_frequency").eq("user_id", OWNER_ID).single(),
      supabase.from("money_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_holdings").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goals").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goal_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_cards").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_charges").select("*").eq("user_id", OWNER_ID).gte("date", sixMonthCutoff).order("date", { ascending: false }).limit(500),
      supabase.from("money_credit_card_payments").select("*").eq("user_id", OWNER_ID).gte("date", sixMonthCutoff).order("date", { ascending: false }).limit(200),
      supabase.from("money_dividends").select("*").eq("user_id", OWNER_ID).gte("date", sixMonthCutoff).order("date", { ascending: false }),
      getServerFxRates(),
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_payments").select("*").eq("user_id", OWNER_ID),
    ]);

    const txs = txRes.data ?? [];
    const subs = subRes.data ?? [];
    const settings = settingsRes.data;
    const accounts = accountRes.data ?? [];
    const holdings = holdingRes.data ?? [];
    const goals = goalRes.data ?? [];
    const goalAccounts = goalAcctRes.data ?? [];
    const creditCards = ccRes.data ?? [];
    const ccCharges = ccChargeRes.data ?? [];
    const ccPayments = ccPayRes.data ?? [];
    const dividends = dividendRes.data ?? [];
    const allTxs = allTxRes.data ?? [];
    const allPayments = allPayRes.data ?? [];
    const base: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const toBase = (amount: number, currency: CurrencyCode) => convertToBase(amount, currency, base, fx);

    // Account balances
    const balances: Record<string, number> = {};
    for (const acct of accounts) {
      balances[acct.id] = computeAccountBalance(acct.id, allTxs, acct.starting_balance ?? 0, allPayments);
    }

    // Stock quotes for holdings (symbols now known, fetch in parallel would require a second batch)
    const holdingSymbols = [...new Set(holdings.map((h) => h.symbol))];
    const stockQuotes = await getStockQuotes(holdingSymbols);

    // Compute portfolio value
    let portfolioValue = 0;
    const holdingDetails = holdings.map((h) => {
      const quote = stockQuotes[h.symbol];
      const price = quote?.price ?? 0;
      const marketValue = h.shares * price;
      const marketValueBase = quote?.currency
        ? toBase(marketValue, quote.currency as CurrencyCode)
        : toBase(marketValue, h.cost_currency);
      const costBase = toBase(h.cost_basis, h.cost_currency);
      const gainLoss = marketValueBase - costBase;
      portfolioValue += marketValueBase;
      return {
        symbol: h.symbol,
        shares: h.shares,
        price,
        marketValueBase,
        costBase,
        gainLoss,
        pctChange: costBase > 0 ? ((gainLoss / costBase) * 100) : 0,
        dayChange: quote?.changePercent ?? 0,
        name: quote?.name ?? h.symbol,
      };
    });

    // Net worth (matching dashboard: cash = checking only, invest = portfolio market value + dividends)
    const cashNetWorth = accounts
      .filter((a) => a.type === "checking")
      .reduce((sum, a) => sum + toBase(balances[a.id] ?? 0, a.currency), 0);
    const investingCashAdded = accounts
      .filter((a) => a.type === "investing")
      .reduce((sum, a) => sum + toBase(balances[a.id] ?? 0, a.currency), 0);
    const totalDividends = dividends.filter((d) => !d.reinvested).reduce((s, d) => s + toBase(d.amount, d.currency), 0);
    const investTotalBase = portfolioValue + totalDividends;
    const totalNetWorth = cashNetWorth + investTotalBase;

    // Credit card utilization
    const ccDetails = creditCards.map((card) => {
      const charges = ccCharges.filter((c) => c.card_id === card.id).reduce((s, c) => s + c.amount, 0);
      const payments = ccPayments.filter((p) => p.card_id === card.id).reduce((s, p) => s + p.amount, 0);
      const balance = charges - payments;
      const utilization = card.credit_limit > 0 ? (balance / card.credit_limit) * 100 : 0;
      return { name: card.name, balance: toBase(balance, card.currency), limit: toBase(card.credit_limit, card.currency), utilization };
    });

    // Goal progress
    const goalProgress = computeGoalProgress(goals, goalAccounts, balances);

    // Dividend income
    const totalDividends6m = dividends.reduce((s, d) => s + toBase(d.amount, d.currency), 0);
    const dividendsBySymbol: Record<string, number> = {};
    for (const d of dividends) {
      dividendsBySymbol[d.symbol] = (dividendsBySymbol[d.symbol] ?? 0) + toBase(d.amount, d.currency);
    }

    // Monthly summaries (CC charges are already in money_transactions as linked expenses)
    const monthlySummaries: Record<string, { income: number; expenses: number; byCategory: Record<string, number> }> = {};
    for (const t of txs) {
      const month = t.date.slice(0, 7);
      if (!monthlySummaries[month]) monthlySummaries[month] = { income: 0, expenses: 0, byCategory: {} };
      const amt = toBase(t.amount, t.currency);
      if (t.type === "income") monthlySummaries[month].income += amt;
      else if (t.type === "expense") {
        monthlySummaries[month].expenses += amt;
        if (t.category) monthlySummaries[month].byCategory[t.category] = (monthlySummaries[month].byCategory[t.category] ?? 0) + amt;
      }
    }

    const topMerchants: Record<string, number> = {};
    for (const t of txs.filter(t => t.type === "expense" && t.merchant)) {
      topMerchants[t.merchant!] = (topMerchants[t.merchant!] ?? 0) + toBase(t.amount, t.currency);
    }

    const context = `
User's Financial Data (all amounts in ${base}, as of ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}):

=== EXCHANGE RATES ===
USD/CAD: ${fx.USDCAD.toFixed(4)}
USD/EGP: ${fx.USDEGP.toFixed(2)}

=== NET WORTH: ${totalNetWorth.toFixed(0)} ${base} ===
Cash/Bank accounts: ${cashNetWorth.toFixed(0)}
Investment portfolio: ${portfolioValue.toFixed(0)}

=== ACCOUNTS ===
${accounts.map(a => `${a.name} (${a.type}, ${a.currency}): balance ${toBase(balances[a.id] ?? 0, a.currency).toFixed(0)} ${base}`).join("\n")}

=== INVESTMENTS ===
${holdingDetails.length > 0 ? holdingDetails.map(h =>
  `${h.symbol} (${h.name}): ${h.shares} shares @ ${h.price.toFixed(2)}, value ${h.marketValueBase.toFixed(0)}, gain/loss ${h.gainLoss >= 0 ? "+" : ""}${h.gainLoss.toFixed(0)} (${h.pctChange >= 0 ? "+" : ""}${h.pctChange.toFixed(1)}%), today ${h.dayChange >= 0 ? "+" : ""}${h.dayChange.toFixed(2)}%`
).join("\n") : "No holdings"}

=== CREDIT CARDS ===
${ccDetails.length > 0 ? ccDetails.map(c =>
  `${c.name}: balance ${c.balance.toFixed(0)}, limit ${c.limit.toFixed(0)}, utilization ${c.utilization.toFixed(0)}%`
).join("\n") : "No credit cards"}

=== GOALS ===
${goals.length > 0 ? goals.map(g => {
  const current = goalProgress.goalCurrentById[g.id] ?? 0;
  const target = g.target_amount;
  const pct = target ? ((current / target) * 100).toFixed(0) : "N/A";
  return `${g.name}: ${current.toFixed(0)}${target ? ` / ${target.toFixed(0)} (${pct}%)` : " (no target)"}${g.target_date ? `, deadline ${g.target_date}` : ""}`;
}).join("\n") : "No goals"}

=== SUBSCRIPTIONS (amounts shown as monthly equivalent) ===
${subs.filter(s => s.is_active).map(s => {
  const freq = s.frequency as string;
  const mult = freq === "weekly" ? 4.33 : freq === "bi-weekly" ? 2.17 : freq === "monthly" ? 1 : 1/12;
  const monthlyBase = toBase(s.amount, s.currency) * mult;
  const billedAs = `billed ${s.amount} ${s.currency} ${freq}`;
  return `${s.name}: ${monthlyBase.toFixed(0)} ${base}/month (${billedAs}), next billing ${s.next_billing}${s.category ? `, category: ${s.category}` : ""}`;
}).join("\n") || "None"}

=== DIVIDENDS (last 6 months): ${totalDividends6m.toFixed(0)} total ===
${Object.entries(dividendsBySymbol).sort((a,b) => b[1]-a[1]).map(([sym, amt]) => `${sym}: ${amt.toFixed(0)}`).join(", ") || "None"}

=== SETTINGS ===
Budget: ${settings?.monthly_essentials_budget ?? 0}/month
Rent: ${settings?.rent_amount ?? 0}/month, due day ${settings?.rent_day ?? 28}
Paycheck: ${settings?.paycheck_amount ?? 0}/${settings?.paycheck_frequency ?? "bi-weekly"}

=== MONTHLY SUMMARIES (last 6 months) ===
${Object.entries(monthlySummaries).sort().map(([month, data]) =>
  `${month}: Income ${data.income.toFixed(0)}, Expenses ${data.expenses.toFixed(0)}, Savings ${(data.income - data.expenses).toFixed(0)} (${data.income > 0 ? ((data.income - data.expenses) / data.income * 100).toFixed(0) : 0}%), Top: ${Object.entries(data.byCategory).sort((a,b) => b[1]-a[1]).slice(0,5).map(([c,a]) => `${c} ${a.toFixed(0)}`).join(", ")}`
).join("\n")}

=== TOP MERCHANTS (6 months) ===
${Object.entries(topMerchants).sort((a,b) => b[1]-a[1]).slice(0,15).map(([m,a]) => `${m}: ${a.toFixed(0)}`).join(", ")}
`.trim();

    const conversationHistory = Array.isArray(history)
      ? history.slice(-6).map((h: { role: string; text: string }) => `${h.role}: ${h.text}`).join("\n")
      : "";

    const systemPrompt = `You are a knowledgeable personal finance advisor with full access to the user's financial data — including live exchange rates, real-time stock prices, account balances, credit card utilization, goal progress, dividend income, subscription costs, and 6 months of transaction history.

You should:
- Use specific numbers from the data whenever possible.
- Analyze the user's portfolio performance — flag holdings that are significantly underperforming, overconcentrated, or losing money. Suggest if they should consider rebalancing.
- When asked about stocks or investments, provide thoughtful analysis based on the holdings data (gain/loss, day change, concentration risk). Suggest specific investment strategies (diversification, sector exposure, index funds vs individual stocks).
- Give real opinions — be direct about what looks good, what doesn't, and what the user should consider doing. Don't just read numbers back, interpret them.
- Discuss stocks, ETFs, or sectors the user doesn't currently own. Suggest specific tickers if asked. Use your knowledge about markets, sectors, and trends.
- Speak naturally, like a smart friend who's good with money. Be conversational, not robotic.
- Perform calculations like projections, comparisons, and what-if scenarios.
- Keep answers under 250 words. Don't use markdown formatting.`;

    const userPrompt = `${context}\n\n${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ""}User: ${message}`;

    const reply = await generateText(systemPrompt, userPrompt);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json({ reply: "Rate limit reached — please wait a moment and try again." });
    }
    return NextResponse.json({ reply: "Something went wrong. Please try again." });
  }
}
