/**
 * Firebase Cloud Messaging — background message handler.
 *
 * This file is loaded by the browser at /firebase-messaging-sw.js when FCM is
 * configured on the client. It receives push payloads while the app tab is
 * closed or backgrounded and renders an OS-level notification.
 *
 * NOTE: SW files cannot read import.meta.env, so the Firebase config is
 * injected at runtime via the postMessage handler below — see
 * client/src/services/fcmService.js where the SW is registered.
 */
/* eslint-disable no-restricted-globals, no-undef */

importScripts(
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js'
);

let messaging = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM' && !messaging) {
    try {
      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const { title, body } = payload.notification || {};
        const data = payload.data || {};
        self.registration.showNotification(title || 'TaskFlow', {
          body: body || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: data.taskId || 'taskflow',
          data,
        });
      });
    } catch (err) {
      console.error('FCM SW init failed', err);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const url = taskId ? `/tasks/${taskId}` : '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NAVIGATE', url });
        return;
      }
      return self.clients.openWindow(url);
    })
  );
});
