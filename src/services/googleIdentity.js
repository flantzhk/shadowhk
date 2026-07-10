// src/services/googleIdentity.js — Google Identity Services (GIS) token flow
//
// Why this exists: the app is static-hosted on flantzhk.github.io while the
// Firebase authDomain lives on shadowspeak-22f04.firebaseapp.com. Both of
// Firebase's own OAuth flows break on Safari because of that origin split:
// signInWithRedirect parks its result in storage on the authDomain, which
// third-party storage partitioning makes unreadable after the round-trip,
// and signInWithPopup trips Safari's popup blocker. GIS is Google's own
// sign-in widget: it obtains a Google access token directly on our origin
// (no firebaseapp.com round-trip), which auth.js exchanges for a Firebase
// session via signInWithCredential — no redirect, no storage handoff.
//
// Requires this origin to be listed under "Authorized JavaScript origins"
// on the OAuth client in Google Cloud console → APIs & Services →
// Credentials → "Web client (auto created by Google Service)".

import { logger } from '../utils/logger';

const GOOGLE_CLIENT_ID = '332784610142-qfp25144kj7fnqvvebnr0qj9tjl6a2pk.apps.googleusercontent.com';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let loadPromise = null;

/**
 * Load the GIS script. Call on login screen mount, not in the click handler:
 * requestGoogleAccessToken() must run synchronously inside the tap gesture
 * or Safari blocks the token popup.
 * @returns {Promise<void>}
 */
function preloadGoogleIdentity() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow a retry on the next screen mount
      logger.warn('GIS script failed to load');
      reject(new Error('gsi-load-failed'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Open the GIS token popup and resolve with a Google access token.
 * Must be called from a user gesture with the script already loaded —
 * everything up to the popup open happens synchronously in that gesture.
 * Rejects with Error whose message is one of:
 *   'gsi-unavailable'         script not loaded (offline, blocked)
 *   'popup_closed'            user closed the popup without finishing
 *   'popup_failed_to_open'    popup blocked
 *   any consent error from Google (e.g. 'access_denied')
 * @returns {Promise<string>} access token
 */
function requestGoogleAccessToken() {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) { reject(new Error('gsi-unavailable')); return; }
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.access_token);
      },
      error_callback: (err) => reject(new Error(err?.type || 'gsi-error')),
    });
    client.requestAccessToken();
  });
}

export { preloadGoogleIdentity, requestGoogleAccessToken };
