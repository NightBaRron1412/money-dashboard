import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth, isValidUUID } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");
  const dateFrom = searchParams.get("date_from") || null;
  const dateTo = searchParams.get("date_to") || null;

  if (!isValidUUID(accountId)) {
    return NextResponse.json({ error: "Valid account_id is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("get_running_balance", {
    p_account_id: accountId,
    p_owner_id: OWNER_ID,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (error) {
    console.error("running-balance: rpc failed:", error.message);
    return NextResponse.json({ error: "Failed to compute running balance" }, { status: 500 });
  }

  return NextResponse.json({ transactions: data || [] });
}
