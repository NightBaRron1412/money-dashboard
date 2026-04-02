import { NextRequest, NextResponse } from "next/server";
import { isGeminiConfigured, generateText } from "@/lib/money/ai";
import { getServerFxRates, convertToBase, getStockQuotes } from "@/lib/money/server-fx";
import { computeAccountBalance } from "@/lib/money/queries";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import { getDemoMoneyData } from "../../../hooks/demo-data";
import { checkDemoRateLimit } from "@/lib/money/demo-rate-limit";
import type { CurrencyCode } from "@/lib/money/database.types";

export const maxDuration = 30;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, remaining, resetIn } = checkDemoRateLimit(ip);

  if (!allowed) {
    const minutes = Math.ceil(resetIn / 60000);
    return NextResponse.json(
      {
        reply: `You've reached the demo chat limit (10 messages/hour). Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or sign up to get unlimited access!`,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
        },
      }
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      reply: "AI chat isn't available right now. The Gemini API key hasn't been configured.",
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

    const demo = getDemoMoneyData();
    const now = new Date();

    const txs = demo.transactions;
    const subs = demo.subscriptions;
    const settings = demo.settings;
    const accounts = demo.accounts;
    const holdings = demo.holdings;
    const goals = demo.goals;
    const goalAccounts = demo.goalAccounts;
    const creditCards = demo.creditCards;
    const ccCharges = demo.creditCardCharges;
    const ccPayments = demo.creditCardPayments;
    const dividends = demo.dividends;

    const fx = await getServerFxRates();
    const base: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const toBase = (amount: number, currency: CurrencyCode) =>
      convertToBase(amount, currency, base, fx);

    const balances: Record<string, number> = {};
    for (const acct of accounts) {
      balances[acct.id] = computeAccountBalance(
        acct.id,
        txs,
        acct.starting_balance ?? 0,
        ccPayments
      );
    }

    const holdingSymbols = [...new Set(holdings.map((h) => h.symbol))];
    const stockQuotes = await getStockQuotes(holdingSymbols);

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
        pctChange: costBase > 0 ? (gainLoss / costBase) * 100 : 0,
        dayChange: quote?.changePercent ?? 0,
        name: quote?.name ?? h.symbol,
      };
    });

    const cashNetWorth = accounts
      .filter((a) => a.type === "checking")
      .reduce((sum, a) => sum + toBase(balances[a.id] ?? 0, a.currency), 0);
    const totalDividends = dividends
      .filter((d) => !d.reinvested)
      .reduce((s, d) => s + toBase(d.amount, d.currency), 0);
    const investTotalBase = portfolioValue + totalDividends;
    const totalNetWorth = cashNetWorth + investTotalBase;

    const ccDetails = creditCards.map((card) => {
      const charges = ccCharges
        .filter((c) => c.card_id === card.id)
        .reduce((s, c) => s + c.amount, 0);
      const payments = ccPayments
        .filter((p) => p.card_id === card.id)
        .reduce((s, p) => s + p.amount, 0);
      const balance = charges - payments;
      const utilization =
        card.credit_limit > 0 ? (balance / card.credit_limit) * 100 : 0;
      return {
        name: card.name,
        balance: toBase(balance, card.currency),
        limit: toBase(card.credit_limit, card.currency),
        utilization,
      };
    });

    const goalProgress = computeGoalProgress(goals, goalAccounts, balances);

    const totalDividends6m = dividends.reduce(
      (s, d) => s + toBase(d.amount, d.currency),
      0
    );
    const dividendsBySymbol: Record<string, number> = {};
    for (const d of dividends) {
      dividendsBySymbol[d.symbol] =
        (dividendsBySymbol[d.symbol] ?? 0) + toBase(d.amount, d.currency);
    }

    const monthlySummaries: Record<
      string,
      { income: number; expenses: number; byCategory: Record<string, number> }
    > = {};
    for (const t of txs) {
      const month = t.date.slice(0, 7);
      if (!monthlySummaries[month])
        monthlySummaries[month] = { income: 0, expenses: 0, byCategory: {} };
      const amt = toBase(t.amount, t.currency);
      if (t.type === "income") monthlySummaries[month].income += amt;
      else if (t.type === "expense") {
        monthlySummaries[month].expenses += amt;
        if (t.category)
          monthlySummaries[month].byCategory[t.category] =
            (monthlySummaries[month].byCategory[t.category] ?? 0) + amt;
      }
    }

    const topMerchants: Record<string, number> = {};
    for (const t of txs.filter((t) => t.type === "expense" && t.merchant)) {
      topMerchants[t.merchant!] =
        (topMerchants[t.merchant!] ?? 0) + toBase(t.amount, t.currency);
    }

    const context = `
Demo User's Financial Data (all amounts in ${base}, as of ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}):

=== EXCHANGE RATES ===
USD/CAD: ${fx.USDCAD.toFixed(4)}
USD/EGP: ${fx.USDEGP.toFixed(2)}

=== NET WORTH: ${totalNetWorth.toFixed(0)} ${base} ===
Cash/Bank accounts: ${cashNetWorth.toFixed(0)}
Investment portfolio: ${portfolioValue.toFixed(0)}

=== ACCOUNTS ===
${accounts.map((a) => `${a.name} (${a.type}, ${a.currency}): balance ${toBase(balances[a.id] ?? 0, a.currency).toFixed(0)} ${base}`).join("\n")}

=== INVESTMENTS ===
${holdingDetails.length > 0 ? holdingDetails.map((h) => `${h.symbol} (${h.name}): ${h.shares} shares @ ${h.price.toFixed(2)}, value ${h.marketValueBase.toFixed(0)}, gain/loss ${h.gainLoss >= 0 ? "+" : ""}${h.gainLoss.toFixed(0)} (${h.pctChange >= 0 ? "+" : ""}${h.pctChange.toFixed(1)}%), today ${h.dayChange >= 0 ? "+" : ""}${h.dayChange.toFixed(2)}%`).join("\n") : "No holdings"}

=== CREDIT CARDS ===
${ccDetails.length > 0 ? ccDetails.map((c) => `${c.name}: balance ${c.balance.toFixed(0)}, limit ${c.limit.toFixed(0)}, utilization ${c.utilization.toFixed(0)}%`).join("\n") : "No credit cards"}

=== GOALS ===
${goals.length > 0 ? goals.map((g) => {
  const current = goalProgress.goalCurrentById[g.id] ?? 0;
  const target = g.target_amount;
  const pct = target ? ((current / target) * 100).toFixed(0) : "N/A";
  return `${g.name}: ${current.toFixed(0)}${target ? ` / ${target.toFixed(0)} (${pct}%)` : " (no target)"}${g.target_date ? `, deadline ${g.target_date}` : ""}`;
}).join("\n") : "No goals"}

=== SUBSCRIPTIONS (amounts shown as monthly equivalent) ===
${subs.filter((s) => s.is_active).map((s) => {
  const freq = s.frequency as string;
  const mult = freq === "weekly" ? 4.33 : freq === "bi-weekly" ? 2.17 : freq === "monthly" ? 1 : 1 / 12;
  const monthlyBase = toBase(s.amount, s.currency) * mult;
  const billedAs = `billed ${s.amount} ${s.currency} ${freq}`;
  return `${s.name}: ${monthlyBase.toFixed(0)} ${base}/month (${billedAs}), next billing ${s.next_billing}${s.category ? `, category: ${s.category}` : ""}`;
}).join("\n") || "None"}

=== DIVIDENDS: ${totalDividends6m.toFixed(0)} total ===
${Object.entries(dividendsBySymbol).sort((a, b) => b[1] - a[1]).map(([sym, amt]) => `${sym}: ${amt.toFixed(0)}`).join(", ") || "None"}

=== SETTINGS ===
Budget: ${settings?.monthly_essentials_budget ?? 0}/month
Rent: ${settings?.rent_amount ?? 0}/month, due day ${settings?.rent_day ?? 28}
Paycheck: ${settings?.paycheck_amount ?? 0}/${settings?.paycheck_frequency ?? "bi-weekly"}

=== MONTHLY SUMMARIES ===
${Object.entries(monthlySummaries).sort().map(([month, data]) =>
  `${month}: Income ${data.income.toFixed(0)}, Expenses ${data.expenses.toFixed(0)}, Savings ${(data.income - data.expenses).toFixed(0)} (${data.income > 0 ? (((data.income - data.expenses) / data.income) * 100).toFixed(0) : 0}%), Top: ${Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, a]) => `${c} ${a.toFixed(0)}`).join(", ")}`
).join("\n")}

=== TOP MERCHANTS ===
${Object.entries(topMerchants).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([m, a]) => `${m}: ${a.toFixed(0)}`).join(", ")}
`.trim();

    const conversationHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((h: { role: string; text: string }) => `${h.role}: ${h.text}`)
          .join("\n")
      : "";

    const systemPrompt = `You are a knowledgeable personal finance advisor built into a money management app. This is a demo with sample data — the user is exploring the app's AI chat feature.

You should:
- Use specific numbers from the data whenever possible.
- Analyze spending, portfolio, goals, and subscriptions thoughtfully.
- Give real opinions — be direct about what looks good and what could improve.
- Be conversational, like a smart friend who's good with money.
- Keep answers concise — under 150 words. Don't use markdown formatting.
- Do not mention that this is demo or sample data unless the user asks. Treat the data as the user's real data.`;

    const userPrompt = `${context}\n\n${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ""}User: ${message}`;

    const reply = await generateText(systemPrompt, userPrompt);

    return NextResponse.json(
      { reply },
      {
        headers: {
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  } catch (err) {
    console.error("Demo AI chat error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json({
        reply: "The AI service is temporarily busy — please wait a moment and try again.",
      });
    }
    return NextResponse.json({
      reply: "Something went wrong. Please try again.",
    });
  }
}
