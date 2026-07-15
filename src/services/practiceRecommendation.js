// src/services/practiceRecommendation.js — decides which single practice
// mode the user actually needs right now, instead of "Everything" always
// defaulting to Shadow. Real signals only: the tone-weakness profile first
// (a specific, fixable problem), then SRS-due phrase count.

import { getWeakTones } from './toneWeakness';
import { getDueByLanguage } from './srs';

/**
 * @param {string} language
 * @returns {Promise<{ focus: 'tones'|'speaking', reason: string, count: number }>}
 */
async function recommendFocus(language) {
  const weakTones = await getWeakTones(language);
  if (weakTones.size > 0) {
    return {
      focus: 'tones',
      reason: weakTones.size === 1
        ? "You're mixing up a tone. Tone Gym targets it directly."
        : `You're mixing up ${weakTones.size} tones. Tone Gym targets them directly.`,
      count: weakTones.size,
    };
  }

  const due = await getDueByLanguage(language);
  if (due.length > 0) {
    return {
      focus: 'speaking',
      reason: `${due.length} phrase${due.length !== 1 ? 's' : ''} need review. Shadow a scene to catch up.`,
      count: due.length,
    };
  }

  return { focus: 'speaking', reason: '', count: 0 };
}

export { recommendFocus };
