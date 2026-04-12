const CACHE_NAME = "finance-v1";
const STATIC_ASSETS = [
  "/favicon.svg",
  "/favicon.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
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

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  // Skip API routes and Supabase calls — always go to network
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (request.url.match(/\.(js|css|png|svg|ico|woff2?)$/) || request.url.includes("/_next/"))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
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
