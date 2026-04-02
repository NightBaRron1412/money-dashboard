import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";

export async function POST(request: NextRequest) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  try {
    const { merchant } = await request.json();
    if (!merchant || typeof merchant !== "string") {
      return NextResponse.json({ error: "merchant is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: settings } = await supabase
      .from("money_settings")
      .select("id, dismissed_merchants")
      .eq("user_id", OWNER_ID)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    const current: string[] = Array.isArray(settings.dismissed_merchants) ? settings.dismissed_merchants : [];
    if (!current.includes(merchant)) {
      current.push(merchant);
    }

    await supabase
      .from("money_settings")
      .update({ dismissed_merchants: current })
      .eq("id", settings.id);

    return NextResponse.json({ ok: true, dismissed_merchants: current });
  } catch {
    return NextResponse.json({ error: "Failed to dismiss merchant" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  try {
    const { merchant } = await request.json();
    if (!merchant || typeof merchant !== "string") {
      return NextResponse.json({ error: "merchant is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: settings } = await supabase
      .from("money_settings")
      .select("id, dismissed_merchants")
      .eq("user_id", OWNER_ID)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    const current: string[] = Array.isArray(settings.dismissed_merchants) ? settings.dismissed_merchants : [];
    const updated = current.filter((m) => m !== merchant);

    await supabase
      .from("money_settings")
      .update({ dismissed_merchants: updated })
      .eq("id", settings.id);

    return NextResponse.json({ ok: true, dismissed_merchants: updated });
  } catch {
    return NextResponse.json({ error: "Failed to un-dismiss merchant" }, { status: 500 });
  }
}
