// src/services/consent.js — GDPR/UK consent management
//
// Stores: localStorage key 'ss_consent'
// Value shape: { analytics: boolean, timestamp: number }
//
// "Not native iOS" note: when a Capacitor native iOS app ships, that build
// will use a different entry point that never imports this module. For now
// this runs in all web contexts (browser + installed PWA).

const CONSENT_KEY = 'ss_consent';

/**
 * @typedef {{ analytics: boolean, timestamp: number }} ConsentRecord
 */

/**
 * Read stored consent. Returns null if the user has never responded.
 * @returns {ConsentRecord | null}
 */
function getConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save a consent decision.
 * @param {{ analytics: boolean }} prefs
 * @returns {ConsentRecord}
 */
function saveConsent(prefs) {
  const record = { analytics: !!prefs.analytics, timestamp: Date.now() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // localStorage blocked (private mode, storage full) — silently continue
  }
  return record;
}

/**
 * Accept all cookies (analytics on).
 */
function acceptAll() {
  return saveConsent({ analytics: true });
}

/**
 * Decline optional cookies (analytics off).
 */
function declineAll() {
  return saveConsent({ analytics: false });
}

/**
 * Returns true when the user has given analytics consent.
 * Use this guard before firing any analytics event.
 */
function hasAnalyticsConsent() {
  const record = getConsent();
  return record !== null && record.analytics === true;
}

/**
 * Returns true when the user has already responded (any answer).
 */
function hasResponded() {
  return getConsent() !== null;
}

export { getConsent, saveConsent, acceptAll, declineAll, hasAnalyticsConsent, hasResponded };
