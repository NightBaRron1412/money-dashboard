import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { OWNER_ID } from "@/lib/money/constants";

const MAX_FIELD_LENGTH = 2048;

interface PushSubscriptionPayload {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  let payload: PushSubscriptionPayload;
  try {
    payload = (await req.json()) as PushSubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = payload.endpoint?.trim();
  const p256dh = payload.keys?.p256dh?.trim();
  const auth = payload.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, p256dh, and auth are required" },
      { status: 400 }
    );
  }

  const PUSH_SERVICE_PATTERNS = [
    "https://fcm.googleapis.com/",
    "https://updates.push.services.mozilla.com/",
    "https://wns2-par02p.notify.windows.com/",
    "https://web.push.apple.com/",
  ];
  if (!PUSH_SERVICE_PATTERNS.some((p) => endpoint.startsWith(p))) {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.startsWith("127.") || url.hostname.startsWith("10.") || url.hostname.startsWith("192.168.")) {
        return NextResponse.json({ error: "Invalid push endpoint" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid push endpoint" }, { status: 400 });
    }
  }

  if (endpoint.length > MAX_FIELD_LENGTH || p256dh.length > MAX_FIELD_LENGTH || auth.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ error: "Field value too long" }, { status: 400 });
  }

  const expiresAt =
    typeof payload.expirationTime === "number"
      ? new Date(payload.expirationTime).toISOString()
      : null;

  const supabase = getServerSupabase();
  const { error } = await supabase.from("money_push_subscriptions").upsert(
    {
      user_id: OWNER_ID,
      endpoint,
      p256dh,
      auth,
      expires_at: expiresAt,
      user_agent: req.headers.get("user-agent"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("push/subscription: upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  let endpoint: string | undefined;
  try {
    const body = (await req.json()) as { endpoint?: string };
    endpoint = body.endpoint?.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("money_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", OWNER_ID);

  if (error) {
    console.error("push/subscription: delete failed:", error.message);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
