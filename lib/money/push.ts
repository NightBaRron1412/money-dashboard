import webpush from "web-push";

let configured = false;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export function getPublicVapidKey(): string {
  return requireEnv("NEXT_PUBLIC_MONEY_PUSH_VAPID_PUBLIC_KEY");
}

function ensureConfigured() {
  if (configured) return;
  const publicKey = requireEnv("NEXT_PUBLIC_MONEY_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = requireEnv("MONEY_PUSH_VAPID_PRIVATE_KEY");
  const subject =
    process.env.MONEY_PUSH_VAPID_SUBJECT ?? "mailto:notifications@money.local";

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: Record<string, unknown>
) {
  ensureConfigured();
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload)
  );
}
