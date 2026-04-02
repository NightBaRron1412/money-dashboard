import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth, isValidUUID } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";

export async function POST(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    source_account_id,
    destination_account_id,
    goal_id,
    amount,
    decrease_source_split = false,
    increase_destination_split = false,
  } = body;

  if (!isValidUUID(source_account_id) || !isValidUUID(destination_account_id) || !isValidUUID(goal_id)) {
    return NextResponse.json({ error: "Valid account and goal IDs are required" }, { status: 400 });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  if (source_account_id === destination_account_id) {
    return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: srcAcct } = await supabase
    .from("money_accounts")
    .select("id, currency")
    .eq("id", source_account_id)
    .eq("user_id", OWNER_ID)
    .single();

  const { data: dstAcct } = await supabase
    .from("money_accounts")
    .select("id, currency")
    .eq("id", destination_account_id)
    .eq("user_id", OWNER_ID)
    .single();

  if (!srcAcct || !dstAcct) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (srcAcct.currency !== dstAcct.currency) {
    return NextResponse.json({ error: "Cross-currency transfers not supported" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: tx, error: txErr } = await supabase
    .from("money_transactions")
    .insert({
      user_id: OWNER_ID,
      type: "transfer",
      date: today,
      amount,
      currency: srcAcct.currency,
      category: "Goal Contribution",
      account_id: null,
      from_account_id: source_account_id,
      to_account_id: destination_account_id,
      merchant: null,
      notes: `Goal contribution`,
      is_recurring: false,
    })
    .select()
    .single();

  if (txErr) {
    console.error("contribute: transaction insert failed:", txErr.message);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }

  if (decrease_source_split) {
    const { data: srcLink } = await supabase
      .from("money_goal_accounts")
      .select("id, allocated_amount")
      .eq("goal_id", goal_id)
      .eq("account_id", source_account_id)
      .maybeSingle();

    if (srcLink && srcLink.allocated_amount !== null) {
      const newAmount = Math.max(0, srcLink.allocated_amount - amount);
      await supabase
        .from("money_goal_accounts")
        .update({ allocated_amount: newAmount })
        .eq("id", srcLink.id);
    }
  }

  if (increase_destination_split) {
    const { data: dstLink } = await supabase
      .from("money_goal_accounts")
      .select("id, allocated_amount")
      .eq("goal_id", goal_id)
      .eq("account_id", destination_account_id)
      .maybeSingle();

    if (dstLink) {
      const current = dstLink.allocated_amount ?? 0;
      await supabase
        .from("money_goal_accounts")
        .update({ allocated_amount: current + amount })
        .eq("id", dstLink.id);
    } else {
      await supabase.from("money_goal_accounts").insert({
        user_id: OWNER_ID,
        goal_id,
        account_id: destination_account_id,
        allocated_amount: amount,
      });
    }
  }

  return NextResponse.json({ transaction: tx });
}
