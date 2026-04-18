// src/hooks/useSubscription.js — Real-time subscription status from Firestore
//
// Reads users/{uid}.subscription_status via onSnapshot so any webhook update
// (e.g. Stripe lifecycle event) is reflected instantly without a page reload.
//
// Offline safety: the last known status is cached in localStorage under
// CACHE_KEY so users who paid stay unlocked even when Firestore is unreachable.

import { useState, useEffect } from 'react';
import { fbAuth, fbDb } from '../services/firebase';

const CACHE_KEY = 'shadowspeak_sub_status';

function readCache() {
  try {
    return localStorage.getItem(CACHE_KEY) || null;
  } catch {
    return null;
  }
}

function writeCache(status) {
  try {
    localStorage.setItem(CACHE_KEY, status);
  } catch {
    // localStorage unavailable — safe to ignore
  }
}

/**
 * A subscription_status written by the Stripe webhook is 'pro'.
 * Stripe's own subscription status names ('active', 'trialing') are also
 * treated as pro so the hook works before any data normalisation is added
 * to the webhook.
 */
function deriveIsPro(status) {
  return status === 'pro' || status === 'active' || status === 'trialing';
}

/**
 * Hook that reads subscription status from Firestore in real-time.
 * Falls back to localStorage cache when Firestore is unavailable (offline users).
 *
 * @returns {{ isPro: boolean, isLoading: boolean, status: string }}
 *   status is 'free' | 'pro' | 'cancelled' (or Stripe's raw values until normalised)
 */
export function useSubscription() {
  const [state, setState] = useState(() => {
    const cached = readCache();
    return {
      isPro: cached ? deriveIsPro(cached) : false,
      isLoading: true,
      status: cached || 'free',
    };
  });

  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = fbAuth.onAuthStateChanged((user) => {
      // Clean up previous Firestore listener when auth state changes
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!user) {
        setState({ isPro: false, isLoading: false, status: 'free' });
        return;
      }

      unsubDoc = fbDb
        .collection('users')
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            const rawStatus = doc.exists
              ? doc.data().subscription_status || 'free'
              : 'free';
            writeCache(rawStatus);
            setState({
              isPro: deriveIsPro(rawStatus),
              isLoading: false,
              status: rawStatus,
            });
          },
          () => {
            // Firestore unavailable — fall back to localStorage cache
            const cached = readCache();
            setState({
              isPro: cached ? deriveIsPro(cached) : false,
              isLoading: false,
              status: cached || 'free',
            });
          }
        );
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  return state;
}
