// src/services/toneWeakness.js — tracks per-tone pronunciation accuracy across
// all shadowing practice, so a recurring tone confusion (e.g. always
// flattening tone 4) can bias SRS scheduling instead of sitting invisible in
// a per-phrase score.

import { getToneStat, saveToneStat, getAllToneStats } from './storage';
import { TONE_WEAKNESS_MIN_ATTEMPTS, TONE_WEAKNESS_ERROR_RATE } from '../utils/constants';
import { extractToneDigit } from '../utils/pinyinTones';

/**
 * Record the tone-level outcome of one scored attempt. Only 'correct' and
 * 'tone' statuses count toward tone accuracy — 'sound'/'missing'/'extra' are
 * consonant/vowel or recognition issues, not tone issues.
 * @param {Array<{expected: string|null, status: string}>} diff - diffJyutping() output
 * @param {string} language - 'cantonese' | 'mandarin' — keeps each language's tone stats separate
 */
async function recordToneDiff(diff, language) {
  const relevant = diff.filter(s => s.status === 'correct' || s.status === 'tone');
  // Sequential, not Promise.all — two syllables sharing a tone in the same
  // phrase must read-modify-write in order or the second overwrites the first.
  for (const s of relevant) {
    const toneDigit = extractToneDigit(s.expected);
    if (!toneDigit) continue;
    const existing = (await getToneStat(language, toneDigit)) ?? { language, toneDigit, correct: 0, total: 0 };
    existing.total += 1;
    if (s.status === 'correct') existing.correct += 1;
    await saveToneStat(existing);
  }
}

/**
 * @param {string} [language] - filter to one language; omit for both (legacy/global)
 * @returns {Promise<Array<{toneDigit: string, language: string, correct: number, total: number, errorRate: number}>>}
 */
async function getToneWeaknessProfile(language) {
  const rows = await getAllToneStats();
  return rows
    .filter(r => !language || r.language === language)
    .map(r => ({ ...r, errorRate: r.total > 0 ? 1 - r.correct / r.total : 0 }));
}

/**
 * Tones with enough attempts and a high enough error rate to bias scheduling.
 * @param {string} [language] - filter to one language; omit for both (legacy/global)
 * @returns {Promise<Set<string>>}
 */
async function getWeakTones(language) {
  const profile = await getToneWeaknessProfile(language);
  return new Set(
    profile
      .filter(r => r.total >= TONE_WEAKNESS_MIN_ATTEMPTS && r.errorRate >= TONE_WEAKNESS_ERROR_RATE)
      .map(r => r.toneDigit)
  );
}

/**
 * Does this phrase contain a syllable whose tone is in the weak set?
 * @param {string} romanization - the phrase's own romanization (e.g.
 *   entry.romanization) — Jyutping ("nei5 hou2") or diacritic Pinyin ("nǐ hǎo")
 * @param {Set<string>} weakTones
 * @returns {boolean}
 */
function phraseHasWeakTone(romanization, weakTones) {
  if (!romanization || !weakTones || weakTones.size === 0) return false;
  return romanization
    .split(/\s+/)
    .some(syllable => {
      const tone = extractToneDigit(syllable);
      return tone && weakTones.has(tone);
    });
}

export { recordToneDiff, getToneWeaknessProfile, getWeakTones, phraseHasWeakTone };
