/**
 * True when running inside a Capacitor native shell (iOS/Android build).
 * Web/PWA always returns false. Native builds must never reach Stripe web
 * checkout (Apple 3.1.1 / Google Play Billing) — gate purchases on this.
 */
export function isNativeApp() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}
