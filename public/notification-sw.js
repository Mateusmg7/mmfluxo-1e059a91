self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '💰 Lembrete de Conta', body: 'Você tem contas vencendo!' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // use defaults
  }

  const tag = data.tag || 'bill-reminder-' + Date.now();

  event.waitUntil((async () => {
    // Notify open tabs for in-app bell
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({
          type: 'notification-received',
          payload: data,
        });
      }
    } catch (e) {
      // ignore postMessage errors
    }

    // Show system notification - this is what makes it appear in the OS notification bar
    try {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: '/alertas' },
      });
    } catch (e) {
      // fallback: try without optional features
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/favicon.ico',
        tag: tag,
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const url = event.notification.data?.url || '/alertas';
      if (clients.length > 0) {
        clients[0].navigate(url);
        clients[0].focus();
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
