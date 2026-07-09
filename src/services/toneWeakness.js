// src/services/toneWeakness.js — tracks per-tone pronunciation accuracy across
// all shadowing practice, so a recurring tone confusion (e.g. always
// flattening tone 4) can bias SRS scheduling instead of sitting invisible in
// a per-phrase score.

import { getToneStat, saveToneStat, getAllToneStats } from './storage';
import { TONE_WEAKNESS_MIN_ATTEMPTS, TONE_WEAKNESS_ERROR_RATE } from '../utils/constants';

/**
 * Record the tone-level outcome of one scored attempt. Only 'correct' and
 * 'tone' statuses count toward tone accuracy — 'sound'/'missing'/'extra' are
 * consonant/vowel or recognition issues, not tone issues.
 * @param {Array<{expected: string|null, status: string}>} diff - diffJyutping() output
 */
async function recordToneDiff(diff) {
  const relevant = diff.filter(s => s.status === 'correct' || s.status === 'tone');
  // Sequential, not Promise.all — two syllables sharing a tone in the same
  // phrase must read-modify-write in order or the second overwrites the first.
  for (const s of relevant) {
    const tone = s.expected?.match(/([1-6])$/)?.[1];
    if (!tone) continue;
    const existing = (await getToneStat(tone)) ?? { tone, correct: 0, total: 0 };
    existing.total += 1;
    if (s.status === 'correct') existing.correct += 1;
    await saveToneStat(existing);
  }
}

/**
 * @returns {Promise<Array<{tone: string, correct: number, total: number, errorRate: number}>>}
 */
async function getToneWeaknessProfile() {
  const rows = await getAllToneStats();
  return rows.map(r => ({ ...r, errorRate: r.total > 0 ? 1 - r.correct / r.total : 0 }));
}

/**
 * Tones with enough attempts and a high enough error rate to bias scheduling.
 * @returns {Promise<Set<string>>}
 */
async function getWeakTones() {
  const profile = await getToneWeaknessProfile();
  return new Set(
    profile
      .filter(r => r.total >= TONE_WEAKNESS_MIN_ATTEMPTS && r.errorRate >= TONE_WEAKNESS_ERROR_RATE)
      .map(r => r.tone)
  );
}

/**
 * Does this phrase contain a syllable whose tone is in the weak set?
 * @param {string} jyutping - the phrase's own Jyutping (e.g. entry.romanization)
 * @param {Set<string>} weakTones
 * @returns {boolean}
 */
function phraseHasWeakTone(jyutping, weakTones) {
  if (!jyutping || !weakTones || weakTones.size === 0) return false;
  return jyutping
    .split(/\s+/)
    .some(syllable => {
      const tone = syllable.match(/([1-6])$/)?.[1];
      return tone && weakTones.has(tone);
    });
}

export { recordToneDiff, getToneWeaknessProfile, getWeakTones, phraseHasWeakTone };
