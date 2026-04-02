import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/money/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { OWNER_ID } from "@/lib/money/constants";

interface Reminder {
  key: string;
  title: string;
  body: string;
}

interface ActiveSubscription {
  id: string;
  name: string;
  next_billing: string;
  is_active: boolean;
}

function nowToronto() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildReminders(
  today: Date,
  rentDay: number,
  rentReminderDays: number,
  billReminderDays: number,
  subscriptions: ActiveSubscription[]
): Reminder[] {
  const reminders: Reminder[] = [];

  const nextRentDate = (() => {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), rentDay);
    if (thisMonth > today) return thisMonth;
    return new Date(today.getFullYear(), today.getMonth() + 1, rentDay);
  })();
  const daysUntilRent = Math.ceil(
    (nextRentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilRent >= 0 && daysUntilRent <= rentReminderDays) {
    reminders.push({
      key: `rent:${formatDate(nextRentDate)}`,
      title: "Rent Reminder",
      body:
        daysUntilRent === 0
          ? `Rent is due today (${nextRentDate.toLocaleDateString("en-US")}).`
          : `Rent is due in ${daysUntilRent} day${daysUntilRent !== 1 ? "s" : ""} (${nextRentDate.toLocaleDateString("en-US")}).`,
    });
  }

  const dueSubs = subscriptions
    .filter((sub) => sub.is_active)
    .map((sub) => {
      const dueDate = new Date(sub.next_billing + "T00:00:00");
      const dueDays = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { sub, dueDate, dueDays };
    })
    .filter(({ dueDays }) => dueDays >= 0 && dueDays <= billReminderDays)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  for (const { sub, dueDate, dueDays } of dueSubs.slice(0, 5)) {
    const dueLabel =
      dueDays === 0 ? "today" : `in ${dueDays} day${dueDays !== 1 ? "s" : ""}`;
    reminders.push({
      key: `sub:${sub.id}:${sub.next_billing}`,
      title: "Bill Reminder",
      body: `${sub.name} bill is due ${dueLabel} (${dueDate.toLocaleDateString("en-US")}).`,
    });
  }

  return reminders;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const [{ data: settings, error: settingsErr }, { data: subs, error: subsErr }, { data: pushSubs, error: pushErr }] =
    await Promise.all([
      supabase
        .from("money_settings")
        .select("rent_day, rent_reminder_days, bill_reminder_days")
        .eq("user_id", OWNER_ID)
        .maybeSingle(),
      supabase
        .from("money_subscriptions")
        .select("id, name, next_billing, is_active")
        .eq("user_id", OWNER_ID),
      supabase
        .from("money_push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", OWNER_ID),
    ]);

  if (settingsErr || subsErr || pushErr) {
    console.error("push/cron: data load failed:",
      settingsErr?.message, subsErr?.message, pushErr?.message);
    return NextResponse.json(
      { error: "Failed to load reminder data" },
      { status: 500 }
    );
  }

  if (!pushSubs || pushSubs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, reason: "no_subscribers" });
  }

  const reminders = buildReminders(
    nowToronto(),
    settings?.rent_day ?? 28,
    Math.min(30, Math.max(0, settings?.rent_reminder_days ?? 7)),
    Math.min(30, Math.max(0, settings?.bill_reminder_days ?? 3)),
    (subs ?? []) as ActiveSubscription[]
  );

  if (reminders.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, reason: "no_due_reminders" });
  }

  let sent = 0;
  let skipped = 0;
  let failures = 0;
  const staleEndpoints = new Set<string>();

  for (const reminder of reminders) {
    const { data: logData, error: logErr } = await supabase
      .from("money_notification_logs")
      .insert({
        user_id: OWNER_ID,
        channel: "webpush",
        dedupe_key: reminder.key,
        title: reminder.title,
        body: reminder.body,
      })
      .select("id")
      .maybeSingle();

    if (logErr) {
      // Duplicate keys are expected on repeated cron runs.
      if ((logErr as { code?: string }).code === "23505") {
        skipped += 1;
        continue;
      }
      failures += 1;
      continue;
    }
    if (!logData) {
      skipped += 1;
      continue;
    }

    for (const subscription of pushSubs) {
      try {
        await sendPushNotification(subscription, {
          title: reminder.title,
          body: reminder.body,
          url: "/",
          key: reminder.key,
        });
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

  return NextResponse.json({
    ok: true,
    reminders: reminders.length,
    sent,
    skipped,
    removed,
    failures,
  });
}
