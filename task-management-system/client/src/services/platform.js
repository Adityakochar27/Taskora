/**
 * Detects whether we're running inside a Capacitor native shell vs a regular
 * browser / PWA. Capacitor injects a `Capacitor` global on the window.
 */
export const isNative = () =>
  typeof window !== 'undefined' &&
  !!window.Capacitor?.isNativePlatform?.();

export const platform = () => {
  if (typeof window === 'undefined') return 'server';
  if (window.Capacitor?.getPlatform) return window.Capacitor.getPlatform();
  return 'web';
};
