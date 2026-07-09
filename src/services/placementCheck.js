// src/services/placementCheck.js — the onboarding listen-and-repeat check
// runs before the user has an account (FirstRunFlow only ever shows to
// signed-out users — see App.jsx), but scoring requires auth. Recordings are
// queued in settings and scored the first time real auth becomes available,
// then collapsed into a single baseline score shown later ("since day 1").

import { scorePronunciation } from './api';
import { isAuthenticated } from './auth';
import { blobToBase64, base64ToBlob } from './offlineManager';
import { logger } from '../utils/logger';

/**
 * Record one placement-check attempt. Scores immediately if already
 * authenticated (rare during onboarding); otherwise returns a settings patch
 * that appends the raw recording to pendingPlacementCheck for later scoring.
 * @param {string} phraseId
 * @param {string} expectedText
 * @param {Blob} blob
 * @param {Object} settings - current settings (read for pendingPlacementCheck)
 * @returns {Promise<{ score: number|null, settingsUpdate: Object|null }>}
 */
async function submitPlacementAttempt(phraseId, expectedText, blob, settings) {
  if (isAuthenticated()) {
    try {
      const result = await scorePronunciation(blob, expectedText, 'cantonese');
      return { score: typeof result?.score === 'number' ? result.score : null, settingsUpdate: null };
    } catch (err) {
      logger.warn('Placement check score failed', err?.message);
      return { score: null, settingsUpdate: null };
    }
  }

  try {
    const audioBase64 = await blobToBase64(blob);
    const pending = [...(settings?.pendingPlacementCheck || []), { phraseId, expectedText, audioBase64 }];
    return { score: null, settingsUpdate: { pendingPlacementCheck: pending } };
  } catch (err) {
    logger.warn('Placement check queue failed', err?.message);
    return { score: null, settingsUpdate: null };
  }
}

/**
 * Score any pending placement-check recordings and compute a baseline. Call
 * once real auth becomes available (App.jsx, right after sign-in resolves) —
 * the caller merges the returned patch via its own updateSettings so React
 * state and storage stay in sync.
 * @param {Object} settings - current settings (read for pendingPlacementCheck)
 * @returns {Promise<Object|null>} settings patch to apply, or null if nothing was pending
 */
async function resolvePendingPlacementCheck(settings) {
  const pending = settings?.pendingPlacementCheck;
  if (!pending || pending.length === 0) return null;

  const scores = [];
  for (const attempt of pending) {
    try {
      const blob = base64ToBlob(attempt.audioBase64, 'audio/ogg');
      const result = await scorePronunciation(blob, attempt.expectedText, 'cantonese');
      if (typeof result?.score === 'number') scores.push(result.score);
    } catch (err) {
      logger.warn('Deferred placement scoring failed', err?.message);
    }
  }

  const updates = { pendingPlacementCheck: [] };
  if (scores.length > 0) {
    updates.baselineScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    updates.baselineAt = Date.now();
  }
  return updates;
}

export { submitPlacementAttempt, resolvePendingPlacementCheck };
