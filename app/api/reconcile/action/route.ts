import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth, isValidUUID } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";

const VALID_ACTION_TYPES = ["merge", "delete", "keep_both"] as const;

export async function POST(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { session_id, action_type, payload_json, tx_ids, keep_id } = body;

  if (!isValidUUID(session_id)) {
    return NextResponse.json({ error: "Valid session_id is required" }, { status: 400 });
  }

  if (!VALID_ACTION_TYPES.includes(action_type)) {
    return NextResponse.json(
      { error: `action_type must be one of: ${VALID_ACTION_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (tx_ids != null && (!Array.isArray(tx_ids) || !tx_ids.every(isValidUUID))) {
    return NextResponse.json({ error: "tx_ids must be an array of valid UUIDs" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: session } = await supabase
    .from("money_reconciliation_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("owner_id", OWNER_ID)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: action, error: actionError } = await supabase
    .from("money_reconciliation_actions")
    .insert({
      session_id,
      owner_id: OWNER_ID,
      action_type,
      payload_json: payload_json || {},
    })
    .select()
    .single();

  if (actionError) {
    console.error("reconcile/action: insert failed:", actionError.message);
    return NextResponse.json({ error: "Failed to log action" }, { status: 500 });
  }

  if (action_type === "delete" && tx_ids && Array.isArray(tx_ids)) {
    for (const txId of tx_ids) {
      await supabase
        .from("money_transactions")
        .delete()
        .eq("id", txId)
        .eq("user_id", OWNER_ID);
    }
  }

  if (action_type === "merge" && tx_ids && Array.isArray(tx_ids) && tx_ids.length > 1) {
    const keepTxId = keep_id && tx_ids.includes(keep_id) ? keep_id : tx_ids[0];
    const remove = tx_ids.filter((id: string) => id !== keepTxId);
    for (const txId of remove) {
      await supabase
        .from("money_transactions")
        .delete()
        .eq("id", txId)
        .eq("user_id", OWNER_ID);
    }
  }

  return NextResponse.json({ action });
}
