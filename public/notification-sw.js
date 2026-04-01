self.addEventListener('install', () => {
  console.log('[NotifSW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[NotifSW] Activated, claiming clients...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[NotifSW] Push event received!', event);
  let data = { title: '💰 Lembrete de Conta', body: 'Você tem contas vencendo!' };

  try {
    if (event.data) {
      data = event.data.json();
      console.log('[NotifSW] Push payload:', JSON.stringify(data));
    }
  } catch (e) {
    console.warn('[NotifSW] Failed to parse push data, using defaults');
  }

  const tag = data.tag || 'bill-reminder-' + Date.now();

  event.waitUntil((async () => {
    // Notify open tabs for in-app bell
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      console.log('[NotifSW] Found', clients.length, 'open tabs to notify');
      for (const client of clients) {
        client.postMessage({
          type: 'notification-received',
          payload: data,
        });
      }
    } catch (e) {
      console.warn('[NotifSW] postMessage error:', e);
    }

    // Show system notification
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
      console.log('[NotifSW] ✅ showNotification succeeded with tag:', tag);
    } catch (e) {
      console.warn('[NotifSW] showNotification with options failed, trying basic:', e);
      try {
        await self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/favicon.ico',
          tag: tag,
        });
        console.log('[NotifSW] ✅ Basic showNotification succeeded');
      } catch (e2) {
        console.error('[NotifSW] ❌ All showNotification attempts failed:', e2);
      }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  console.log('[NotifSW] Notification clicked:', event.notification.tag);
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
