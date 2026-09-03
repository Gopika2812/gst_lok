/* Royal Accounting ERP - Service Worker for Lock Screen & Chrome Web Push Notifications */

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Notification', body: event.data.text() };
    }
  }

  const title = data.title || '🎯 Royal Accounting - New Task';
  const options = {
    body: data.body || 'A new task has been assigned to you.',
    icon: data.icon || '/logo_ra.jpeg',
    badge: data.badge || '/logo_ra.jpeg',
    image: data.image || undefined,
    tag: data.tag || 'royal-accounting-task',
    renotify: true,
    requireInteraction: true, // Crucial for mobile lock screen visibility
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    data: data.data || { url: '/tasks' },
    actions: data.actions || [
      { action: 'open_task', title: '📋 Open Task' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = (event.notification.data && event.notification.data.url) || '/tasks';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the app
      for (let client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(urlToOpen) || client.url.includes('/')) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
