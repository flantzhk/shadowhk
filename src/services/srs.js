// src/services/srs.js — FSRS-lite: continuous, mean-reverting difficulty/stability model

import { getDueEntries, getAllLibraryEntries, saveLibraryEntry } from './storage';
import { recordToneDiff, getWeakTones, phraseHasWeakTone } from './toneWeakness';
import { diffJyutping } from '../utils/jyutpingDiff';
import {
  SRS_MIN_EASE, SRS_MAX_EASE, SRS_MAX_INTERVAL, SRS_MASTERED_THRESHOLD,
  FSRS_INITIAL_DIFFICULTY, FSRS_MIN_DIFFICULTY, FSRS_MAX_DIFFICULTY, FSRS_REVERSION_RATE,
  FSRS_INITIAL_STABILITY, FSRS_GROWTH_BASE, FSRS_TARGET_RETENTION, WEAK_TONE_MAX_INTERVAL,
} from '../utils/constants';

/**
 * Calculate next review interval based on user response.
 * @param {Object} entry - Current library entry
 * @param {'correct'|'hard'|'forgot'} quality
 * @param {number|null} [pronunciationScore=null] - Score 0-100
 * @param {boolean} [hasWeakTone=false] - Phrase contains a tone the user is currently weak on
 * @returns {Object} Updated SRS fields to merge into entry
 */
function calculateNextReview(entry, quality, pronunciationScore = null, hasWeakTone = false) {
  const now = Date.now();
  let { stability, difficulty, practiceCount = 0, lastPracticedAt } = entry;
  stability = stability ?? (entry.interval || 0);
  difficulty = difficulty ?? FSRS_INITIAL_DIFFICULTY;

  // score is primary; quality is a legacy fallback mapped to a representative score
  if (!['correct', 'hard', 'forgot'].includes(quality)) quality = 'hard';
  let score = pronunciationScore;
  if (score === null) {
    score = quality === 'correct' ? 92 : quality === 'hard' ? 80 : 50;
  }
  const g = Math.min(1, Math.max(0, score / 100));

  const elapsedDays = lastPracticedAt ? Math.max(0, (now - lastPracticedAt) / 86400000) : 0;
  const isFirstReview = practiceCount === 0 || stability <= 0;
  const retrievability = isFirstReview ? 1 : Math.pow(FSRS_TARGET_RETENTION, elapsedDays / stability);

  // difficulty update — continuous, mean-reverting (this is what kills "ease hell")
  const difficultyDelta = (0.85 - g) * 6;
  const rawDifficulty = difficulty + difficultyDelta;
  let newDifficulty = rawDifficulty + (FSRS_INITIAL_DIFFICULTY - rawDifficulty) * FSRS_REVERSION_RATE;
  newDifficulty = Math.min(FSRS_MAX_DIFFICULTY, Math.max(FSRS_MIN_DIFFICULTY, newDifficulty));

  const isLapse = g < 0.7;
  let newStability;
  if (isLapse) {
    newStability = 0;
  } else if (isFirstReview) {
    newStability = FSRS_INITIAL_STABILITY * (0.5 + g);
  } else {
    const difficultyFactor = (11 - difficulty) / 10;       // use OLD (pre-update) difficulty — easier items grow faster
    const retrievabilityFactor = Math.max(0.1, 1 - retrievability); // reviewing right before forgetting yields the biggest boost; floor keeps well-known items growing a little
    const performanceFactor = (g - 0.5) * 2;
    const growth = 1 + FSRS_GROWTH_BASE * difficultyFactor * retrievabilityFactor * performanceFactor;
    newStability = stability * growth;
  }
  newStability = Math.min(newStability, SRS_MAX_INTERVAL);
  // A phrase that touches a tone the user is currently weak on gets
  // resurfaced sooner regardless of score, instead of drifting to a long
  // interval on a lucky read.
  if (hasWeakTone) newStability = Math.min(newStability, WEAK_TONE_MAX_INTERVAL);

  practiceCount += 1;
  const interval = isLapse ? 0 : Math.max(1, Math.round(newStability));
  const nextReviewAt = now + interval * 24 * 60 * 60 * 1000;
  const status = interval >= SRS_MASTERED_THRESHOLD ? 'mastered' : 'learning';

  // easeFactor kept only for legacy display code that still reads entry.easeFactor — not used in scheduling math anymore
  const easeFactor = SRS_MIN_EASE + ((FSRS_MAX_DIFFICULTY - newDifficulty) / (FSRS_MAX_DIFFICULTY - FSRS_MIN_DIFFICULTY)) * (SRS_MAX_EASE - SRS_MIN_EASE);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    interval,
    easeFactor,
    practiceCount,
    // The library display derives growth state from `reps`; keep it in step
    // with practiceCount so practice visibly advances new -> growing -> strong.
    reps: practiceCount,
    nextReviewAt,
    lastPracticedAt: now,
    status,
  };
}

/**
 * Update a library entry after practice with a score.
 * @param {string} phraseId
 * @param {number|null} score - Pronunciation score 0-100
 * @param {Object} [options]
 * @param {'correct'|'hard'|'forgot'} [options.quality='correct']
 * @param {string} [options.expectedJyutping] - From the scorer response, if this attempt was scored
 * @param {string} [options.transcribedJyutping] - From the scorer response, if this attempt was scored
 */
async function updateAfterPractice(phraseId, score, { quality = 'correct', expectedJyutping, transcribedJyutping } = {}) {
  const entries = await getAllLibraryEntries();
  const entry = entries.find(e => e.phraseId === phraseId);
  if (!entry) return null;

  if (expectedJyutping && transcribedJyutping) {
    // Fire-and-forget: this feeds the tone-weakness profile, not this review's own scheduling.
    recordToneDiff(diffJyutping(expectedJyutping, transcribedJyutping)).catch(() => {});
  }
  const weakTones = await getWeakTones();
  const hasWeakTone = phraseHasWeakTone(entry.romanization, weakTones);

  const updates = calculateNextReview(entry, quality, score, hasWeakTone);
  const scoreEntry = score !== null ? { score, at: Date.now() } : null;

  const updated = {
    ...entry,
    ...updates,
    lastScore: score,
    bestScore: score !== null
      ? Math.max(entry.bestScore || 0, score)
      : entry.bestScore,
    scoreHistory: scoreEntry
      ? [...(entry.scoreHistory || []).slice(-9), scoreEntry]
      : entry.scoreHistory || [],
  };

  await saveLibraryEntry(updated);
  return updated;
}

/**
 * Get all phrases due for review today, sorted by most overdue first.
 * @returns {Promise<Array>}
 */
async function getDueForReview() {
  const due = await getDueEntries();
  return due.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

async function getDueByLanguage(language) {
  const due = await getDueForReview();
  if (!language) return due;
  return due.filter(e => !e.language || e.language === language);
}

async function markAsMastered(phraseId) {
  const { getLibraryEntry, saveLibraryEntry } = await import('./storage.js');
  const entry = await getLibraryEntry(phraseId);
  if (!entry) return;
  await saveLibraryEntry({
    ...entry,
    interval: 21,
    reps: Math.max(entry.reps ?? 0, 3),
    growth_state: 'mastered',
    _updatedAt: Date.now(),
  });
}

async function getSchedule(phraseId) {
  const { getLibraryEntry } = await import('./storage.js');
  const entry = await getLibraryEntry(phraseId);
  if (!entry) return null;
  return {
    nextReview: entry.nextReviewAt,
    interval: entry.interval,
    reps: entry.reps ?? 0,
  };
}

export { calculateNextReview, updateAfterPractice, getDueForReview, getDueByLanguage, markAsMastered, getSchedule };
