// Bump this version whenever the caching strategy changes — the activate
// handler deletes every cache whose name != CACHE_NAME, purging stale ones.
const CACHE_NAME = "finance-v2";

// Only cache genuinely-static, stable icon assets. Do NOT cache Next.js build
// output (/_next/*) or HTML: those change every deploy and content-hashed
// chunks are already immutable, so caching them only risks serving a stale
// HTML/chunk combo after a redeploy — which surfaces as ChunkLoadError and a
// client-side crash. Letting the network serve them is correct and safe.
const STATIC_ASSETS = [
  "/favicon.svg",
  "/favicon.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  // Only intercept the handful of static icon/manifest assets we pre-cache.
  // Everything else — navigation, /_next/* chunks, CSS, API — goes straight
  // to the network untouched, so deploys never serve a mismatched app shell.
  if (!STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// --- Push notification handlers (migrated from money-push-sw.js) ---

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Money Reminder", body: event.data.text() };
  }

  const title = payload.title || "Money Reminder";
  const body = payload.body || "You have a new reminder.";
  const url = payload.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/apple-touch-icon.png",
      badge: "/favicon.ico",
      data: { url },
      tag: payload.key || "money-reminder",
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
