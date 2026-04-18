// src/services/posthog.js — PostHog analytics wrapper
//
// PostHog is only initialised AFTER the user grants analytics consent.
// All public functions are fail-safe: they never throw and never block callers.
//
// EU region required for GDPR compliance (api_host: https://eu.i.posthog.com).
// VITE_POSTHOG_KEY must be set in .env (see .env.example).

import posthog from 'posthog-js';
import { hasAnalyticsConsent } from './consent';

let _initialized = false;

/**
 * Initialise PostHog. Safe to call multiple times — idempotent.
 * Does nothing if VITE_POSTHOG_KEY is unset or consent has not been granted.
 */
export function initPostHog() {
  if (_initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || !hasAnalyticsConsent()) return;

  try {
    posthog.init(key, {
      api_host: 'https://eu.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      persistence: 'localStorage',
    });
    _initialized = true;
  } catch (_) {
    // Non-fatal — PostHog must never crash the app
  }
}

/**
 * Capture an event. No-ops silently if PostHog is not initialised.
 * @param {string} eventName
 * @param {Record<string, string|number|boolean|null>} [params]
 */
export function phCapture(eventName, params = {}) {
  try {
    if (_initialized) posthog.capture(eventName, params);
  } catch (_) {
    // Non-fatal
  }
}

/**
 * Identify the signed-in user so events are tied to a person in PostHog.
 * Call after successful login.
 * @param {string} uid - Firebase Auth UID
 * @param {Record<string, string>} [traits] - e.g. { email, language_choice }
 */
export function phIdentify(uid, traits = {}) {
  try {
    if (_initialized) posthog.identify(uid, traits);
  } catch (_) {
    // Non-fatal
  }
}

/**
 * Reset the PostHog identity. Call on sign-out so the next user gets a fresh session.
 * Does NOT un-initialise PostHog — subsequent captures still work (as anonymous).
 */
export function phReset() {
  try {
    if (_initialized) posthog.reset();
  } catch (_) {
    // Non-fatal
  }
}

// Exported for testing — allows tests to reset module state.
export function _resetPostHogState() {
  _initialized = false;
}
