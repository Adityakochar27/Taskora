/**
 * Universal push notifications.
 *
 * - In a browser / PWA: uses Firebase Cloud Messaging via the web SDK and the
 *   /firebase-messaging-sw.js service worker.
 * - In a Capacitor native shell (Android/iOS app): uses
 *   @capacitor/push-notifications which talks to APNs / FCM natively.
 *
 * Both paths end up sending the device token to /api/auth/fcm-token. The
 * backend treats them identically — they're all FCM tokens to firebase-admin.
 *
 * Note: the original file name (fcmService.js) is preserved as a re-export at
 * the bottom for backward compatibility with the AuthContext import.
 */
import { authService } from './authService';
import { isNative } from './platform';

let initialised = false;

export async function initPushNotifications() {
  if (initialised) return;
  initialised = true;

  try {
    if (isNative()) {
      await initNative();
    } else {
      await initWeb();
    }
  } catch (err) {
    console.warn('Push init skipped:', err.message);
    initialised = false; // allow retry
  }
}

// --- Native (Capacitor) ---
async function initNative() {
  // Lazy-imported so the web bundle never pulls these on the browser path.
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    try {
      await authService.registerFcm(token.value);
      localStorage.setItem('tf_fcm_token', token.value);
    } catch (e) {
      console.warn('Failed to register native push token', e);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('Push registration error', err);
  });

  // Foreground push on native — surface as toast.
  PushNotifications.addListener('pushNotificationReceived', (n) => {
    import('react-hot-toast').then(({ default: toast }) =>
      toast(`${n.title || 'TaskFlow'}\n${n.body || ''}`)
    );
  });

  // User tapped a push — navigate to the task if one is encoded.
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const taskId = action.notification?.data?.taskId;
    if (taskId) window.location.href = `/tasks/${taskId}`;
  });
}

// --- Web (PWA / browser) ---
async function initWeb() {
  if (!('Notification' in window)) return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.VITE_FIREBASE_API_KEY) return; // not configured

  const { initializeApp } = await import('firebase/app');
  const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(config);
  const messaging = getMessaging(app);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
    { scope: '/' }
  );
  await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'INIT_FCM', config });

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (token) {
    await authService.registerFcm(token);
    localStorage.setItem('tf_fcm_token', token);
  }

  onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {};
    if (!title) return;
    import('react-hot-toast').then(({ default: toast }) =>
      toast(`${title}\n${body || ''}`)
    );
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE' && event.data.url) {
      window.location.href = event.data.url;
    }
  });
}
