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
    return NextResponse.json({ greeting: null, reason: "unavailable" });
  }

  try {
    const supabase = getServerSupabase();
    const now = new Date();
    const { from, to } = getMonthRange(now);
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { from: prevFrom, to: prevTo } = getMonthRange(prevMonth);

    const [txRes, allTxRes, subRes, settingsRes, accountRes, holdingRes, goalRes, goalAcctRes, allPayRes, fx] = await Promise.all([
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID).gte("date", prevFrom).lte("date", to),
      supabase.from("money_transactions").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_subscriptions").select("*").eq("user_id", OWNER_ID).eq("is_active", true),
      supabase.from("money_settings").select("base_currency, display_name, greeting_tone, expense_categories, subscription_categories, rent_amount, rent_day, monthly_essentials_budget, paycheck_amount, paycheck_frequency").eq("user_id", OWNER_ID).single(),
      supabase.from("money_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_holdings").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goals").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_goal_accounts").select("*").eq("user_id", OWNER_ID),
      supabase.from("money_credit_card_payments").select("*").eq("user_id", OWNER_ID),
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
    const allPayments = allPayRes.data ?? [];
    const base: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const toBase = (amount: number, currency: CurrencyCode) => convertToBase(amount, currency, base, fx);

    const curTxs = txs.filter((t) => t.date >= from && t.date <= to);
    const prevTxs = txs.filter((t) => t.date >= prevFrom && t.date <= prevTo);

    const curIncome = curTxs.filter((t) => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const curExpenses = curTxs.filter((t) => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const prevIncome = prevTxs.filter((t) => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const prevExpenses = prevTxs.filter((t) => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency), 0);

    const savingsRate = curIncome > 0 ? ((curIncome - curExpenses) / curIncome * 100) : null;
    const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome * 100) : null;

    const categoryBreakdown: Record<string, number> = {};
    for (const t of curTxs.filter((t) => t.type === "expense" && t.category)) {
      categoryBreakdown[t.category!] = (categoryBreakdown[t.category!] ?? 0) + toBase(t.amount, t.currency);
    }
    const topCategories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c, a]) => `${c}: ${a.toFixed(0)}`)
      .join(", ");

    const budget = settings?.monthly_essentials_budget ?? 0;
    const isOverBudget = budget > 0 && curExpenses > budget;

    // Account balances & net worth
    const balances: Record<string, number> = {};
    for (const acct of accounts) {
      balances[acct.id] = computeAccountBalance(acct.id, allTxs, acct.starting_balance ?? 0, allPayments);
    }
    const cashNetWorth = accounts
      .filter((a) => a.type === "checking")
      .reduce((sum, a) => sum + toBase(balances[a.id] ?? 0, a.currency), 0);

    // Portfolio value
    const holdingSymbols = [...new Set(holdings.map((h) => h.symbol))];
    const stockQuotes = await getStockQuotes(holdingSymbols);
    let portfolioValue = 0;
    let portfolioDayChange = 0;
    for (const h of holdings) {
      const quote = stockQuotes[h.symbol];
      const mv = h.shares * (quote?.price ?? 0);
      const base_mv = quote?.currency ? toBase(mv, quote.currency as CurrencyCode) : toBase(mv, h.cost_currency);
      portfolioValue += base_mv;
      if (quote) portfolioDayChange += base_mv * (quote.changePercent / 100);
    }
    const totalNetWorth = cashNetWorth + portfolioValue;

    // Goal progress
    const goalProgress = computeGoalProgress(goals, goalAccounts, balances);
    const closestGoal = goals
      .filter((g) => g.target_amount && g.target_amount > 0)
      .map((g) => ({
        name: g.name,
        pct: ((goalProgress.goalCurrentById[g.id] ?? 0) / g.target_amount!) * 100,
        current: goalProgress.goalCurrentById[g.id] ?? 0,
        target: g.target_amount!,
      }))
      .sort((a, b) => b.pct - a.pct)[0];

    const rentDay = settings?.rent_day ?? 28;
    const nextRent = (() => {
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), rentDay);
      return thisMonth > now ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, rentDay);
    })();
    const daysUntilRent = Math.max(0, Math.ceil((nextRent.getTime() - now.getTime()) / 86400000));

    const dueSoonBills = subs.filter((s) => {
      const d = Math.ceil((new Date(s.next_billing + "T00:00:00").getTime() - now.getTime()) / 86400000);
      return d >= 0 && d <= 5;
    }).map((s) => s.name);

    const hour = now.getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

    const personality = settings?.greeting_tone ?? "coach";

    const context = `
Time: ${timeOfDay}
User's name: ${settings?.display_name || "there"}
Currency: ${base}
Net worth: ${totalNetWorth.toFixed(0)} (cash ${cashNetWorth.toFixed(0)}, investments ${portfolioValue.toFixed(0)})
${portfolioDayChange !== 0 ? `Portfolio today: ${portfolioDayChange >= 0 ? "+" : ""}${portfolioDayChange.toFixed(0)} ${base}` : ""}
This month: Income ${curIncome.toFixed(0)}, Expenses ${curExpenses.toFixed(0)}${savingsRate !== null ? `, Savings rate ${savingsRate.toFixed(0)}%` : ""}
Last month: Income ${prevIncome.toFixed(0)}, Expenses ${prevExpenses.toFixed(0)}${prevSavingsRate !== null ? `, Savings rate ${prevSavingsRate.toFixed(0)}%` : ""}
${savingsRate !== null && prevSavingsRate !== null ? `Savings trend: ${(savingsRate - prevSavingsRate).toFixed(0)}% (${savingsRate > prevSavingsRate ? "improving" : "declining"})` : ""}
Top spending: ${topCategories || "None yet"}
Budget: ${budget > 0 ? `${budget}/month, ${isOverBudget ? "OVER by " + (curExpenses - budget).toFixed(0) : (budget - curExpenses).toFixed(0) + " remaining"}` : "Not set"}
Rent: ${settings?.rent_amount ?? 0}/month, due in ${daysUntilRent} days
Bills due soon: ${dueSoonBills.length > 0 ? dueSoonBills.join(", ") : "None"}
${closestGoal ? `Closest goal: "${closestGoal.name}" at ${closestGoal.pct.toFixed(0)}% (${closestGoal.current.toFixed(0)}/${closestGoal.target.toFixed(0)})` : ""}
Exchange rates: USD/CAD ${fx.USDCAD.toFixed(4)}, USD/EGP ${fx.USDEGP.toFixed(2)}
`.trim();

    const systemPrompt = `You are a personal finance dashboard greeting generator. Write a short, personalized greeting message (1-2 sentences max, under 40 words). It should feel like a quick check-in — pick the most interesting data point to mention (net worth milestone, portfolio movement, savings trend, upcoming bills, goal progress, or budget status). Don't repeat "Good morning/afternoon" — the UI already shows that separately. Don't use markdown. Don't start with their name — the UI already shows it.

The user's preferred personality/tone is: "${personality}"
Adapt your style accordingly. If it says "minimal", be very brief and factual. If "coach", be encouraging and motivational. If "strict", be direct and no-nonsense. If it's a custom description, match that vibe exactly.`;

    const greeting = await generateText(systemPrompt, context);

    return NextResponse.json({ greeting: greeting.trim() });
  } catch (err) {
    console.error("AI greeting error:", err);
    return NextResponse.json({ greeting: null, reason: "Failed to generate greeting" });
  }
}
