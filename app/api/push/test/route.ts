import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/money/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { OWNER_ID } from "@/lib/money/constants";

export async function POST(_req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const supabase = getServerSupabase();
  const { data: pushSubs, error: pushErr } = await supabase
    .from("money_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", OWNER_ID);

  if (pushErr) {
    console.error("push/test: query failed:", pushErr.message);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }

  if (!pushSubs || pushSubs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, removed: 0, reason: "no_subscribers" });
  }

  const payload = {
    title: "Money Test Notification",
    body: "Background notifications are working.",
    url: "/",
    key: `test:${Date.now()}`,
  };

  let sent = 0;
  let failures = 0;
  const staleEndpoints = new Set<string>();

  for (const subscription of pushSubs) {
    try {
      await sendPushNotification(subscription, payload);
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.add(subscription.endpoint);
        continue;
      }
      failures += 1;
    }
  }

  if (sent === 0 && failures > 0) {
    return NextResponse.json(
      { error: "Push delivery failed for all subscriptions.", sent, failures },
      { status: 500 }
    );
  }

  let removed = 0;
  if (staleEndpoints.size > 0) {
    const endpoints = Array.from(staleEndpoints);
    const { error: removeErr } = await supabase
      .from("money_push_subscriptions")
      .delete()
      .in("endpoint", endpoints)
      .eq("user_id", OWNER_ID);
    if (!removeErr) {
      removed = endpoints.length;
    }
  }

  return NextResponse.json({ ok: true, sent, removed, failures });
}
