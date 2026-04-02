import { NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { isGeminiConfigured, generateText } from "@/lib/money/ai";
import { getMonthRange, computeAccountBalance } from "@/lib/money/queries";
import { getServerFxRates, convertToBase, getStockQuotes } from "@/lib/money/server-fx";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import type { CurrencyCode } from "@/lib/money/database.types";

export const maxDuration = 30;

export async function GET() {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  if (!isGeminiConfigured()) {
    return NextResponse.json({ insights: null, reason: "unavailable" });
  }

  try {
    const supabase = getServerSupabase();
    const now = new Date();
    const { from, to } = getMonthRange(now);

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { from: prevFrom, to: prevTo } = getMonthRange(prevMonth);

    const [txRes, allTxRes, subRes, settingsRes, accountRes, holdingRes, goalRes, goalAcctRes, ccRes, ccChargeRes, allPayRes, dividendRes, fx] = await Promise.all([
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID).gte("date", prevFrom).lte("date", to),
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_subscriptions").select("*").eq("user_id", OWNER_ID).eq("is_active", true),
      supabase.from("money_settings").select("base_currency, display_name, expense_categories, subscription_categories, rent_amount, rent_day, monthly_essentials_budget, paycheck_amount, paycheck_frequency").eq("user_id", OWNER_ID).single(),
      supabase.from("money_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_holdings").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goals").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goal_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_cards").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_charges").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_payments").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_dividends").select("*").eq("user_id", OWNER_ID).gte("date", prevFrom),
      getServerFxRates(),
    ]);

    const txs = txRes.data ?? [];
    const allTxs = allTxRes.data ?? [];
    const subs = subRes.data ?? [];
    const settings = settingsRes.data;
    const accounts = accountRes.data ?? [];
    const holdings = holdingRes.data ?? [];
    const goals = goalRes.data ?? [];
    const goalAccounts = goalAcctRes.data ?? [];
    const creditCards = ccRes.data ?? [];
    const ccCharges = ccChargeRes.data ?? [];
    const allPayments = allPayRes.data ?? [];
    const dividends = dividendRes.data ?? [];
    const base: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const toBase = (amount: number, currency: CurrencyCode) => convertToBase(amount, currency, base, fx);

    const currentMonthTxs = txs.filter((t) => t.date >= from && t.date <= to);
    const prevMonthTxs = txs.filter((t) => t.date >= prevFrom && t.date <= prevTo);

    const curIncome = currentMonthTxs.filter((t) => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const curExpenses = currentMonthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const prevIncome = prevMonthTxs.filter((t) => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const prevExpenses = prevMonthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency), 0);

    const categoryBreakdown: Record<string, number> = {};
    for (const t of currentMonthTxs.filter((t) => t.type === "expense" && t.category)) {
      categoryBreakdown[t.category!] = (categoryBreakdown[t.category!] ?? 0) + toBase(t.amount, t.currency);
    }

    const savingsRate = curIncome > 0 ? ((curIncome - curExpenses) / curIncome * 100).toFixed(1) : "N/A";
    const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome * 100).toFixed(1) : "N/A";

    const monthlySubCost = subs.reduce((s, sub) => {
      const f = sub.frequency as string;
      const mult = f === "weekly" ? 4.33 : f === "bi-weekly" ? 2.17 : f === "monthly" ? 1 : 1/12;
      return s + toBase(sub.amount, sub.currency) * mult;
    }, 0);
    const yearlySubCost = monthlySubCost * 12;
    const subDetails = subs.map(sub => {
      const f = sub.frequency as string;
      const mult = f === "weekly" ? 4.33 : f === "bi-weekly" ? 2.17 : f === "monthly" ? 1 : 1/12;
      const mo = toBase(sub.amount, sub.currency) * mult;
      return `${sub.name}: ${mo.toFixed(0)} ${base}/month (billed ${sub.amount} ${sub.currency} ${f})`;
    }).join(", ");

    // Account balances & net worth
    const balances: Record<string, number> = {};
    for (const acct of accounts) {
      balances[acct.id] = computeAccountBalance(acct.id, allTxs, acct.starting_balance ?? 0, allPayments);
    }
    const cashNetWorth = accounts
      .filter((a) => a.type === "checking")
      .reduce((sum, a) => sum + toBase(balances[a.id] ?? 0, a.currency), 0);

    // Stock portfolio
    const holdingSymbols = [...new Set(holdings.map((h) => h.symbol))];
    const stockQuotes = await getStockQuotes(holdingSymbols);
    let portfolioValue = 0;
    for (const h of holdings) {
      const quote = stockQuotes[h.symbol];
      const mv = h.shares * (quote?.price ?? 0);
      portfolioValue += quote?.currency ? toBase(mv, quote.currency as CurrencyCode) : toBase(mv, h.cost_currency);
    }
    const totalDividendsNR = dividends.filter((d) => !d.reinvested).reduce((s, d) => s + toBase(d.amount, d.currency), 0);
    const totalNetWorth = cashNetWorth + portfolioValue + totalDividendsNR;

    // Credit card utilization
    const totalCCBalance = creditCards.reduce((sum, card) => {
      const ch = ccCharges.filter((c) => c.card_id === card.id).reduce((s, c) => s + c.amount, 0);
      const py = allPayments.filter((p) => p.card_id === card.id).reduce((s, p) => s + p.amount, 0);
      return sum + toBase(Math.max(0, ch - py), card.currency);
    }, 0);

    // Goal progress
    const goalProgress = computeGoalProgress(goals, goalAccounts, balances);
    const goalSummary = goals.map((g) => {
      const cur = goalProgress.goalCurrentById[g.id] ?? 0;
      const pct = g.target_amount ? ((cur / g.target_amount) * 100).toFixed(0) : "N/A";
      return `${g.name}: ${cur.toFixed(0)}${g.target_amount ? `/${g.target_amount} (${pct}%)` : ""}`;
    }).join(", ");

    // Dividend income
    const totalDividends = dividends.reduce((s, d) => s + toBase(d.amount, d.currency), 0);

    const summary = `
Financial Summary for ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })} (all amounts in ${base}):

NET WORTH: ${totalNetWorth.toFixed(0)} (Cash: ${cashNetWorth.toFixed(0)}, Investments: ${portfolioValue.toFixed(0)})
Credit card debt: ${totalCCBalance.toFixed(0)}

This month: Income ${curIncome.toFixed(0)}, Expenses ${curExpenses.toFixed(0)}, Savings rate ${savingsRate}%
Last month: Income ${prevIncome.toFixed(0)}, Expenses ${prevExpenses.toFixed(0)}, Savings rate ${prevSavingsRate}%
Top expense categories: ${Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, a]) => `${c}: ${a.toFixed(0)}`).join(", ") || "None"}
Active subscriptions: ${subs.length} totaling ~${monthlySubCost.toFixed(0)} ${base}/month (~${yearlySubCost.toFixed(0)}/year): ${subDetails}
Dividend income (2 months): ${totalDividends.toFixed(0)}
Goals: ${goalSummary || "None"}
Budget: ${settings?.monthly_essentials_budget ?? 0}/month
Rent: ${settings?.rent_amount ?? 0}/month
Exchange rates: USD/CAD ${fx.USDCAD.toFixed(4)}, USD/EGP ${fx.USDEGP.toFixed(2)}
`.trim();

    const systemPrompt = `You are a concise personal finance advisor. Given a comprehensive financial summary (including net worth, investments, credit card debt, and goal progress), provide 3-4 short, actionable insights. Use the EXACT numbers provided in the data — never calculate your own totals or estimates. When mentioning subscription costs, use the monthly and yearly totals given. Keep it under 150 words. Use plain text, no markdown. Interpret trends and suggest actions. Address the user directly as "you".`;

    const insights = await generateText(systemPrompt, summary);

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("AI insights error:", err);
    return NextResponse.json({ insights: null, reason: "Failed to generate insights" });
  }
}
