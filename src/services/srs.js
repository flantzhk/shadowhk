// src/services/srs.js — Spaced repetition algorithm (simplified SM-2)

import { getDueEntries, getAllLibraryEntries, saveLibraryEntry } from './storage';
import {
  SRS_MIN_EASE, SRS_MAX_EASE, SRS_MAX_INTERVAL, SRS_MASTERED_THRESHOLD,
} from '../utils/constants';

/**
 * Calculate next review interval based on user response.
 * @param {Object} entry - Current library entry
 * @param {'correct'|'hard'|'forgot'} quality
 * @param {number|null} [pronunciationScore=null] - Score 0-100
 * @returns {Object} Updated SRS fields to merge into entry
 */
function calculateNextReview(entry, quality, pronunciationScore = null) {
  let { interval = 0, easeFactor = 2.5, practiceCount = 0 } = entry;

  // Validate quality parameter
  if (!['correct', 'hard', 'forgot'].includes(quality)) quality = 'hard';

  if (pronunciationScore !== null) {
    if (pronunciationScore >= 90) quality = 'correct';
    else if (pronunciationScore >= 70) quality = 'hard';
    else quality = 'forgot';
  }

  practiceCount += 1;

  if (quality === 'forgot') {
    interval = 0;
    easeFactor = Math.max(SRS_MIN_EASE, easeFactor - 0.2);
  } else if (quality === 'hard') {
    interval = Math.max(1, Math.ceil(interval * 1.2));
    easeFactor = Math.max(SRS_MIN_EASE, easeFactor - 0.1);
  } else {
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 3;
    else interval = Math.ceil(interval * easeFactor);
    easeFactor = Math.min(SRS_MAX_EASE, easeFactor + 0.1);
  }

  interval = Math.min(interval, SRS_MAX_INTERVAL);

  const now = Date.now();
  const nextReviewAt = now + interval * 24 * 60 * 60 * 1000;
  const status = interval >= SRS_MASTERED_THRESHOLD ? 'mastered' : 'learning';

  return {
    interval,
    easeFactor,
    practiceCount,
    nextReviewAt,
    lastPracticedAt: now,
    status,
  };
}

/**
 * Update a library entry after practice with a score.
 * @param {string} phraseId
 * @param {number|null} score - Pronunciation score 0-100
 * @param {'correct'|'hard'|'forgot'} [quality='correct']
 */
async function updateAfterPractice(phraseId, score, quality = 'correct') {
  const entries = await getAllLibraryEntries();
  const entry = entries.find(e => e.phraseId === phraseId);
  if (!entry) return null;

  const updates = calculateNextReview(entry, quality, score);
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
    nextReview: entry.nextReviewDate,
    interval: entry.interval,
    reps: entry.reps ?? 0,
  };
}

export { calculateNextReview, updateAfterPractice, getDueForReview, getDueByLanguage, markAsMastered, getSchedule };
