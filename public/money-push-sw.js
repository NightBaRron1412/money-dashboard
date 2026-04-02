self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

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
