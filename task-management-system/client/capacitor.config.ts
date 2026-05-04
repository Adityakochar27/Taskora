import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the Vite build into a real Android / iOS app shell.
 *
 * IMPORTANT — set `server.url` to your deployed API host before building for
 * release. In dev, you can point this at your laptop's LAN IP (e.g.
 * http://192.168.1.10:5173) and capacitor will load the live Vite dev server.
 *
 * For release builds, leave `server.url` unset so the bundled webDir is used,
 * and configure VITE_API_BASE in client/.env.production to your live API URL
 * before `npm run build`.
 */
const config: CapacitorConfig = {
  appId: 'dev.taskflow.app',
  appName: 'TaskFlow',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#2542e2',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
