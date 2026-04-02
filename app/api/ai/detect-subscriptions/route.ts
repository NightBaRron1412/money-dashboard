import { NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { detectSubscriptions } from "@/lib/money/subscription-detection";

export async function GET() {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  try {
    const supabase = getServerSupabase();

    const [txRes, chargeRes, subRes, settingsRes] = await Promise.all([
      supabase
        .from("money_transactions")
        .select("*")
        .eq("user_id", OWNER_ID)
        .eq("type", "expense")
        .order("date", { ascending: false })
        .limit(2000),
      supabase
        .from("money_credit_card_charges")
        .select("*")
        .eq("user_id", OWNER_ID)
        .order("date", { ascending: false })
        .limit(2000),
      supabase
        .from("money_subscriptions")
        .select("*")
        .eq("user_id", OWNER_ID),
      supabase
        .from("money_settings")
        .select("dismissed_merchants")
        .eq("user_id", OWNER_ID)
        .single(),
    ]);

    const dismissed: string[] = Array.isArray(settingsRes.data?.dismissed_merchants)
      ? settingsRes.data.dismissed_merchants
      : [];

    const detected = detectSubscriptions(
      txRes.data ?? [],
      chargeRes.data ?? [],
      subRes.data ?? []
    ).filter((d) => !dismissed.includes(d.merchant));

    return NextResponse.json({ detected });
  } catch {
    return NextResponse.json(
      { error: "Failed to detect subscriptions" },
      { status: 500 }
    );
  }
}
