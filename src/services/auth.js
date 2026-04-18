// src/services/auth.js — Authentication service (Firebase)

import { firebase, fbAuth, fbDb } from './firebase';
import { logger } from '../utils/logger';
import { clearAllData } from './storage';
import { phReset } from './posthog';

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
    if (existing.exists) return; // returning user — do not overwrite

    await docRef.set({
      uid,
      email: email || '',
      language_choice: languageChoice || 'cantonese',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      subscription_status: 'free',
    });
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
 * Sign in with Google popup.
 * @param {string} [languageChoice] - passed through to Firestore doc on first sign-up
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
async function signInWithGoogle(languageChoice = 'cantonese') {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const cred = await fbAuth.signInWithPopup(provider);
    if (cred.additionalUserInfo?.isNewUser) {
      await createUserDocument(cred.user.uid, cred.user.email || '', languageChoice);
    }
    return { user: cred.user, error: null };
  } catch (error) {
    logger.error('Google sign-in failed', error);
    if (error.code === 'auth/popup-closed-by-user') {
      return { user: null, error: null };
    }
    return { user: null, error: firebaseErrorMessage(error) };
  }
}

/**
 * Sign in with Apple popup via Firebase OAuthProvider.
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
  try {
    const cred = await fbAuth.signInWithPopup(provider);
    if (cred.additionalUserInfo?.isNewUser) {
      await createUserDocument(cred.user.uid, cred.user.email || '', languageChoice);
    }
    return { user: cred.user, error: null };
  } catch (error) {
    logger.error('Apple sign-in failed', error);
    if (error.code === 'auth/popup-closed-by-user') {
      return { user: null, error: null };
    }
    if (error.code === 'auth/operation-not-allowed') {
      return { user: null, error: 'Apple Sign In is not enabled yet. Please use email or Google.' };
    }
    return { user: null, error: firebaseErrorMessage(error) };
  }
}

/**
 * Sign out the current user.
 */
async function signOut() {
  phReset();
  await fbAuth.signOut();
  window.location.hash = '#login';
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
 *   1. Delete Firestore user document (best-effort)
 *   2. Clear all IndexedDB stores
 *   3. Delete Firebase Auth user
 *   4. Sign out (clears local auth state)
 *
 * Required for Apple App Store compliance (guideline 5.1.1).
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function deleteAccount() {
  const user = fbAuth.currentUser;
  if (!user) return { success: false, error: 'Not signed in.' };

  try {
    // 1. Delete Firestore user document (best-effort — don't abort if this fails)
    try {
      await fbDb.collection('users').doc(user.uid).delete();
    } catch (dbErr) {
      logger.error('Failed to delete Firestore user doc (non-fatal)', dbErr);
    }

    // 2. Wipe all local IndexedDB data
    try {
      await clearAllData();
    } catch (storageErr) {
      logger.error('Failed to clear IndexedDB (non-fatal)', storageErr);
    }

    // 3. Delete the Firebase Auth user — this is the critical step
    await user.delete();

    // 4. Sign out to clear any remaining local auth state
    try {
      await fbAuth.signOut();
    } catch (_) {
      // Auth user is already deleted; sign-out failure is safe to ignore
    }

    return { success: true, error: null };
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
