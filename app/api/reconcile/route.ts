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

  const { account_id, date_from, date_to, expected_balance } = body;

  if (!isValidUUID(account_id)) {
    return NextResponse.json({ error: "Valid account_id is required" }, { status: 400 });
  }

  if (expected_balance != null && typeof expected_balance !== "number") {
    return NextResponse.json({ error: "expected_balance must be a number" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: account } = await supabase
    .from("money_accounts")
    .select("id, starting_balance")
    .eq("id", account_id)
    .eq("user_id", OWNER_ID)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  let q = supabase
    .from("money_transactions")
    .select("*")
    .eq("user_id", OWNER_ID)
    .or(`account_id.eq.${account_id},from_account_id.eq.${account_id},to_account_id.eq.${account_id}`);

  if (date_from) q = q.gte("date", date_from);
  if (date_to) q = q.lte("date", date_to);

  const { data: txs, error: txError } = await q;
  if (txError) {
    console.error("reconcile: tx query failed:", txError.message);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }

  let computed = account.starting_balance ?? 0;
  for (const tx of txs || []) {
    if (tx.type === "income" && tx.account_id === account_id) computed += tx.amount;
    else if (tx.type === "expense" && tx.account_id === account_id) computed -= tx.amount;
    else if (tx.type === "transfer") {
      if (tx.from_account_id === account_id) computed -= tx.amount;
      if (tx.to_account_id === account_id) computed += tx.amount;
    }
  }

  const delta = expected_balance != null ? expected_balance - computed : null;

  const { data: session, error: sessionError } = await supabase
    .from("money_reconciliation_sessions")
    .insert({
      owner_id: OWNER_ID,
      account_id,
      date_from: date_from || null,
      date_to: date_to || null,
      expected_balance: expected_balance ?? null,
      computed_balance: computed,
      delta,
      status: "open",
    })
    .select()
    .single();

  if (sessionError) {
    console.error("reconcile: session insert failed:", sessionError.message);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ session, computed_balance: computed, delta });
}

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("money_reconciliation_sessions")
    .select("*")
    .eq("owner_id", OWNER_ID)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("reconcile: sessions query failed:", error.message);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}
