/* eslint-disable no-restricted-globals */

// This is a direct JS version for easier deployment in this environment
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

let lastNotifId = null;

// Background logic using simple API polling or messaging
// Since we don't have modules here easily (without building sw),
// we will rely on postMessage from the main thread when foregrounded,
// and we'll try to use the Notification API.
// "Even if app isn't open" usually requires Push API + Backend.
// For now, we enable the capability.

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFY') {
    self.registration.showNotification(event.data.title || 'School Management', {
      body: event.data.message,
      icon: '/favicon.ico',
      tag: 'school-notification'
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
