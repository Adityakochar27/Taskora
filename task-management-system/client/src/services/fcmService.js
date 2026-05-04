// Backward-compat: re-exports the universal push service. Existing imports
// of './fcmService' still work; new code should import from './pushService'.
export { initPushNotifications } from './pushService';
