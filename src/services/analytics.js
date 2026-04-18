// src/services/analytics.js — Firebase Analytics wrapper
//
// logEvent is a thin, fail-safe wrapper. It never throws and never blocks the
// caller — analytics should never affect app correctness.
//
// STREAK_MILESTONES and isStreakMilestone are pure helpers so the UI can
// decide whether a streak count warrants a milestone event.

import { fbAnalytics } from './firebase';

/**
 * Calculate the personal score percentile for a given score against a list of
 * past scores from the same user. This is a personal percentile (not global).
 *
 * Returns null when there are no past scores to compare against.
 *
 * @param {number} score - The score just achieved (0–100).
 * @param {number[]} pastScores - Array of past average scores (may be empty).
 * @returns {number|null} Percentile 0–100, or null if pastScores is empty.
 */
export function calculatePersonalPercentile(score, pastScores) {
  if (!pastScores || pastScores.length === 0) return null;
  const countAtOrBelow = pastScores.filter(s => s <= score).length;
  return Math.round((countAtOrBelow / pastScores.length) * 100);
}

/** Streak counts that trigger a streak_milestone event. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/**
 * Returns true if n is a recognised streak milestone.
 * @param {number} n
 * @returns {boolean}
 */
export function isStreakMilestone(n) {
  return STREAK_MILESTONES.includes(n);
}

/**
 * Log a Firebase Analytics event.
 * Silently no-ops when Analytics is unavailable (e.g. no measurementId, test env).
 *
 * @param {string} eventName
 * @param {Record<string, string|number|boolean>} [params]
 */
export function logEvent(eventName, params = {}) {
  try {
    if (fbAnalytics) {
      fbAnalytics.logEvent(eventName, params);
    }
  } catch (_) {
    // Non-fatal — analytics must never crash the app
  }
}
