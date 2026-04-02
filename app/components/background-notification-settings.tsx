"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = "checking" | "unsupported" | "idle" | "enabled" | "blocked" | "error";

export function BackgroundNotificationSettings() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
    []
  );

  const refreshStatus = async () => {
    if (!supported) {
      setState("unsupported");
      setMessage("This browser does not support web push notifications.");
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      setMessage("Notifications are blocked in your browser settings.");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register("/money-push-sw.js", {
        updateViaCache: "none",
      });
      await reg.update();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setState("enabled");
        setMessage("Background notifications are enabled.");
      } else {
        setState("idle");
        setMessage("Background notifications are currently disabled.");
      }
    } catch {
      setState("error");
      setMessage("Unable to read notification status.");
    }
  };

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "idle");
        setMessage(
          permission === "denied"
            ? "Notifications were blocked. Allow them in browser site settings."
            : "Notification permission was dismissed."
        );
        return;
      }

      const reg = await navigator.serviceWorker.register("/money-push-sw.js", {
        updateViaCache: "none",
      });
      await reg.update();
      const keyRes = await fetch("/api/push/public-key");
      if (!keyRes.ok) {
        throw new Error("Push key is not configured on the server.");
      }
      const keyData = (await keyRes.json()) as { publicKey?: string };
      if (!keyData.publicKey) {
        throw new Error("Missing push public key.");
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }));

      const saveRes = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!saveRes.ok) {
        const data = (await saveRes.json()) as { error?: string };
        throw new Error(data.error || "Failed to save push subscription.");
      }

      setState("enabled");
      setMessage("Background notifications are enabled.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Failed to enable notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/money-push-sw.js", {
        updateViaCache: "none",
      });
      await reg.update();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
      setMessage("Background notifications are disabled.");
    } catch {
      setState("error");
      setMessage("Failed to disable notifications.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        removed?: number;
        failures?: number;
        reason?: string;
        error?: string;
        details?: string[];
      };
      if (!res.ok) {
        const extra =
          Array.isArray(data.details) && data.details.length > 0
            ? ` ${data.details[0]}`
            : "";
        throw new Error((data.error || "Failed to send test notification.") + extra);
      }
      if (data.reason === "no_subscribers") {
        setMessage("No active push subscription found. Enable first.");
        return;
      }
      setMessage(
        `Test sent to ${data.sent ?? 0} device${(data.sent ?? 0) === 1 ? "" : "s"}${(data.failures ?? 0) > 0 ? ` (${data.failures} failed)` : ""}.`
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Failed to send test notification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
      <h2 className="mb-2 text-base font-semibold text-text-primary">
        Background Notifications
      </h2>
      <p className="mb-4 text-xs text-text-secondary">
        Enables rent and bill reminders even when the website is closed.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enable}
          disabled={busy || state === "enabled" || state === "unsupported"}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Enable
        </button>
        <button
          type="button"
          onClick={disable}
          disabled={busy || state !== "enabled"}
          className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-elevated disabled:opacity-60"
        >
          <BellOff className="h-4 w-4" />
          Disable
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={busy || state !== "enabled"}
          className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-elevated disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Test
        </button>
      </div>

      <p className="mt-3 text-xs text-text-secondary">{message}</p>
      {state === "blocked" && (
        <p className="mt-1 text-xs text-yellow-500 dark:text-yellow-300">
          Open browser site settings and set Notifications to Allow.
        </p>
      )}
    </section>
  );
}
