/* eslint-disable no-restricted-globals */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase in the service worker
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

let lastNotifId = null;

// This is a simplified "background" listener. 
// In a real PWA context, FCM would be used.
function setupBackgroundListener(userId) {
  if (!userId) return;

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    const notif = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    
    if (lastNotifId !== notif.id) {
      lastNotifId = notif.id;
      
      // Only show if the app is actually in the background
      self.clients.matchAll().then(clients => {
        const isAppFocused = clients.some(client => client.focused);
        if (!isAppFocused) {
          self.registration.showNotification('School Management', {
            body: notif.message,
            icon: '/favicon.ico',
            tag: 'school-notification',
            data: notif
          });
        }
      });
    }
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_USER_ID') {
    setupBackgroundListener(event.data.userId);
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
