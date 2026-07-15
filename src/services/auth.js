// src/services/auth.js — Authentication service (Firebase)

import { firebase, fbAuth, fbDb } from './firebase';
import { requestGoogleAccessToken } from './googleIdentity';
import { logger } from '../utils/logger';
import { clearAllData } from './storage';
import { phCapture, phReset } from './posthog';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Create a Firestore user document at users/{uid} on first registration.
 * Does NOT overwrite if the document already exists (returning user protection).
 *
 * Required fields per spec:
 *   - email
 *   - language_choice   ('cantonese' | 'mandarin')
 *   - created_at        (Firestore server timestamp)
 *   - subscription_status ('free')
 *
 * @param {string} uid
 * @param {string} email
 * @param {string} [languageChoice]
 * @returns {Promise<void>}
 */
async function createUserDocument(uid, email, languageChoice = 'cantonese') {
  try {
    const docRef = fbDb.collection('users').doc(uid);
    const existing = await docRef.get();
    // A merge-write elsewhere (e.g. last_active) can create the doc before we
    // do — treat a doc without created_at as new and fill the core fields in.
    if (existing.exists && existing.data()?.created_at) return; // returning user

    await docRef.set({
      uid,
      email: email || '',
      language_choice: languageChoice || 'cantonese',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      subscription_status: existing.data()?.subscription_status || 'free',
    }, { merge: true });
  } catch (dbErr) {
    logger.error('Failed to create user document', dbErr);
    // Non-fatal — auth still succeeded
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new user with email/password.
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @param {string} [languageChoice] - 'cantonese' | 'mandarin' (from onboarding)
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signUp(email, password, name, languageChoice = 'cantonese') {
  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
    if (cred.user && name) {
      await cred.user.updateProfile({ displayName: name });
    }
    await createUserDocument(cred.user.uid, email, languageChoice);
    return { user: cred.user, error: null };
  } catch (error) {
    logger.error('Sign up failed', error);
    return { user: null, error: firebaseErrorMessage(error) };
  }
}

/**
 * Sign in with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signIn(email, password) {
  try {
    const cred = await fbAuth.signInWithEmailAndPassword(email, password);
    return { user: cred.user, error: null };
  } catch (error) {
    logger.error('Sign in failed', error);
    return { user: null, error: firebaseErrorMessage(error) };
  }
}

/**
 * Shared tail of an OAuth sign-in (popup or redirect result): create the
 * Firestore user doc on first sign-up and emit analytics.
 */
async function completeOAuthSignIn(result, languageChoice) {
  const method = result.additionalUserInfo?.providerId === 'apple.com' ? 'apple' : 'google';
  if (result.additionalUserInfo?.isNewUser) {
    await createUserDocument(result.user.uid, result.user.email || '', languageChoice);
    phCapture('signup_succeeded', { method });
  } else {
    phCapture('login_succeeded', { method });
  }
}

// Popup errors that mean "this environment can't do popups at all"
// (installed PWA standalone mode, some in-app browsers) — worth retrying
// with the redirect flow. Anything else is a real failure to surface.
const POPUP_UNAVAILABLE_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

/**
 * OAuth sign-in, popup first with redirect fallback.
 *
 * Popup, not redirect: the app (github.io) and the Firebase authDomain
 * (firebaseapp.com) are different origins, and signInWithRedirect parks the
 * result in storage on the authDomain. Browsers that partition third-party
 * storage (Safari always, iOS especially) make that stash unreadable when
 * the browser returns to the app, so getRedirectResult() came back empty
 * and users landed on the login screen still signed out. The popup flow
 * hands the result between windows via postMessage — no shared storage —
 * so it survives. Redirect remains only as a fallback where popups can't
 * open at all.
 * @param {firebase.auth.AuthProvider} provider
 * @param {string} languageChoice - stored for the Firestore doc on first sign-up
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signInWithOAuthProvider(provider, languageChoice) {
  try {
    const result = await fbAuth.signInWithPopup(provider);
    await completeOAuthSignIn(result, languageChoice);
    return { user: result.user, error: null };
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      // Deliberate cancel. Still an "error" to callers so they don't treat
      // it as success and navigate home unauthenticated.
      return { user: null, error: 'Sign-in was cancelled.' };
    }
    if (!POPUP_UNAVAILABLE_CODES.has(error.code)) {
      logger.error('OAuth popup sign-in failed', error);
      return { user: null, error: firebaseErrorMessage(error), code: error.code };
    }
    // Popups unavailable here — fall back to redirect. Stash languageChoice
    // so handleGoogleRedirectResult() can pick it up after the round-trip.
    sessionStorage.setItem('pendingOAuthLang', languageChoice);
    try {
      await fbAuth.signInWithRedirect(provider);
      return { user: null, error: null }; // unreachable — browser navigates away
    } catch (redirectError) {
      sessionStorage.removeItem('pendingOAuthLang');
      logger.error('OAuth redirect sign-in failed', redirectError);
      return { user: null, error: firebaseErrorMessage(redirectError), code: redirectError.code };
    }
  }
}

/**
 * Start Google sign-in. GIS token flow first (see googleIdentity.js for
 * why neither of Firebase's own flows survives Safari on this hosting
 * setup), falling back to the Firebase popup/redirect flows only when GIS
 * itself is unavailable (script blocked or offline).
 * @param {string} [languageChoice]
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signInWithGoogle(languageChoice = 'cantonese') {
  try {
    const accessToken = await requestGoogleAccessToken();
    const credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
    const result = await fbAuth.signInWithCredential(credential);
    await completeOAuthSignIn(result, languageChoice);
    return { user: result.user, error: null };
  } catch (error) {
    switch (error.message) {
      case 'popup_closed':
      case 'access_denied':
        return { user: null, error: 'Sign-in was cancelled.' };
      case 'popup_failed_to_open':
        return { user: null, error: 'Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.' };
      case 'gsi-unavailable':
        // GIS script never loaded — offline or the domain is blocked.
        // Firebase's own flows are the only remaining option.
        logger.warn('GIS unavailable, falling back to Firebase popup flow');
        return signInWithOAuthProvider(new firebase.auth.GoogleAuthProvider(), languageChoice);
      default:
        // Google consent errors or a failed signInWithCredential exchange.
        logger.error('Google sign-in failed', error);
        return { user: null, error: firebaseErrorMessage(error) };
    }
  }
}

/**
 * Handle the Google redirect result after the browser returns from Google auth.
 * Must be called once on app initialisation (before waitForAuth resolves) so
 * new-user Firestore documents are created correctly.
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function handleGoogleRedirectResult() {
  try {
    const result = await fbAuth.getRedirectResult();
    if (!result || !result.user) {
      // A pending flag with no result means we started a redirect sign-in
      // and the result was lost on the way back (third-party storage
      // partitioning, see signInWithOAuthProvider). Surface it instead of
      // silently landing the user back on the login screen.
      if (sessionStorage.getItem('pendingOAuthLang')) {
        sessionStorage.removeItem('pendingOAuthLang');
        return { user: null, error: 'Sign-in did not complete. Please try again.' };
      }
      return { user: null, error: null };
    }

    const languageChoice = sessionStorage.getItem('pendingOAuthLang') || 'cantonese';
    sessionStorage.removeItem('pendingOAuthLang');
    await completeOAuthSignIn(result, languageChoice);
    return { user: result.user, error: null };
  } catch (error) {
    logger.error('Google redirect result failed', error);
    return { user: null, error: firebaseErrorMessage(error) };
  }
}

/**
 * Sign in with Apple via Firebase OAuthProvider (popup first, redirect
 * fallback — see signInWithOAuthProvider for why).
 * Requires Apple Sign In configured in the Firebase console:
 *   Authentication > Sign-in method > Apple > Enable
 *   (Needs Apple Developer account + Service ID + OAuth redirect domain)
 * @param {string} [languageChoice] - passed through to Firestore doc on first sign-up
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signInWithApple(languageChoice = 'cantonese') {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithOAuthProvider(provider, languageChoice);
  if (result.code === 'auth/operation-not-allowed') {
    return { user: null, error: 'Apple Sign In is not enabled yet. Please use email or Google.' };
  }
  return result;
}

/**
 * Sign out the current user.
 */
async function signOut() {
  phCapture('logout');
  phReset();
  try {
    await clearAllData();
  } catch (error) {
    logger.error('Failed to clear IndexedDB on sign out (non-fatal)', error);
  }
  await fbAuth.signOut();
  window.location.hash = '#/login';
}

/**
 * Check if a user is currently signed in.
 * @returns {boolean}
 */
function isAuthenticated() {
  return !!fbAuth.currentUser;
}

/**
 * Get a fresh Firebase ID token (auto-refreshes if near expiry).
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
  try {
    const user = fbAuth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    logger.error('Failed to get auth token', error);
    return null;
  }
}

/**
 * Refresh token if needed — Firebase handles this automatically via getIdToken(),
 * so this is kept for API compatibility.
 * @returns {Promise<boolean>}
 */
async function refreshTokenIfNeeded() {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Send a password reset email.
 * @param {string} email
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
async function requestPasswordReset(email) {
  try {
    await fbAuth.sendPasswordResetEmail(email);
    return { success: true, error: null };
  } catch (error) {
    logger.error('Password reset request failed', error);
    return { success: false, error: firebaseErrorMessage(error) };
  }
}

/**
 * Get current user info.
 * @returns {{name: string, email: string, displayName: string, photoURL: string|null, metadata: Object}|null}
 */
function getCurrentUser() {
  const user = fbAuth.currentUser;
  if (!user) return null;
  return {
    name: user.displayName || '',
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || null,
    metadata: user.metadata || {},
  };
}

/**
 * Wait for Firebase Auth to initialize (resolves on first auth state).
 * @returns {Promise<import('firebase/compat').User|null>}
 */
function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = fbAuth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

/**
 * Map Firebase error codes to user-friendly messages.
 */
function firebaseErrorMessage(error) {
  switch (error.code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please try again.';
    default: return error.message || 'Something went wrong. Please try again.';
  }
}

/**
 * Permanently delete the current user's account and all associated data.
 * Order of operations:
 *   1. Delete Firebase Auth user (the step that can fail, e.g. requires-recent-login)
 *   2. Delete Firestore user document (best-effort)
 *   3. Clear all IndexedDB stores (best-effort)
 *   4. Sign out (clears local auth state)
 *
 * The auth deletion runs first so a failure there (most commonly
 * auth/requires-recent-login) aborts before any Firestore or local data is
 * touched — otherwise the user's cloud/local data would be wiped while their
 * account (and subscription) stayed live.
 *
 * Required for Apple App Store compliance (guideline 5.1.1).
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function deleteAccount() {
  const user = fbAuth.currentUser;
  if (!user) return { success: false, error: 'Not signed in.' };

  try {
    // 1. Delete the Firebase Auth user first — this is the step that can throw
    await user.delete();
  } catch (error) {
    logger.error('Account deletion failed', error);
    if (error.code === 'auth/requires-recent-login') {
      return {
        success: false,
        error: 'For security, please sign out and sign back in before deleting your account.',
      };
    }
    return { success: false, error: error.message || 'Failed to delete account. Please try again.' };
  }

  // 2. Auth user is gone — clean up Firestore data (best-effort).
  // Firestore never cascade-deletes: the library subcollection must be
  // removed explicitly or the user's phrases outlive their account.
  try {
    const libSnap = await fbDb.collection('users').doc(user.uid).collection('library').get();
    const refs = [];
    libSnap.forEach((d) => refs.push(d.ref));
    for (let i = 0; i < refs.length; i += 400) {
      const batch = fbDb.batch();
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    await fbDb.collection('users').doc(user.uid).delete();
  } catch (dbErr) {
    logger.error('Failed to delete Firestore user data (non-fatal)', dbErr);
  }

  // 3. Wipe all local IndexedDB data
  try {
    await clearAllData();
  } catch (storageErr) {
    logger.error('Failed to clear IndexedDB (non-fatal)', storageErr);
  }

  // 4. Sign out to clear any remaining local auth state
  try {
    await fbAuth.signOut();
  } catch (_) {
    // Auth user is already deleted; sign-out failure is safe to ignore
  }

  return { success: true, error: null };
}

/**
 * Write last_active = now to the current user's Firestore doc.
 * Called on each app session start so the admin dashboard can compute DAU.
 * Best-effort — never throws.
 * @returns {Promise<void>}
 */
async function updateLastActive() {
  const user = fbAuth.currentUser;
  if (!user) return;
  try {
    await fbDb.collection('users').doc(user.uid).set(
      { last_active: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    logger.error('Failed to update last_active (non-fatal)', err);
  }
}

export {
  signUp,
  signIn,
  signInWithGoogle,
  handleGoogleRedirectResult,
  signInWithApple,
  signOut,
  isAuthenticated,
  getAuthToken,
  refreshTokenIfNeeded,
  requestPasswordReset,
  getCurrentUser,
  waitForAuth,
  deleteAccount,
  updateLastActive,
  createUserDocument, // exported for testing
};
