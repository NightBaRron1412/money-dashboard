import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID, SESSION_COOKIE } from "@/lib/money/constants";

export async function POST() {
  const authError = await requireAuth();
  if (authError) return authError;

  const supabase = getServerSupabase();

  const tables = [
    "money_credit_card_payments",
    "money_credit_card_charges",
    "money_credit_cards",
    "money_dividends",
    "money_holdings",
    "money_subscriptions",
    "money_reconciliation_actions",
    "money_reconciliation_sessions",
    "money_transactions",
    "money_goal_accounts",
    "money_goals",
    "money_allocation_plans",
    "money_notification_logs",
    "money_push_subscriptions",
    "money_settings",
    "money_accounts",
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(table === "money_reconciliation_sessions" || table === "money_reconciliation_actions" ? "owner_id" : "user_id", OWNER_ID);
    if (error) {
      console.error(`reset: failed to clear ${table}:`, error.message);
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
