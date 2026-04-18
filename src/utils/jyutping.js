// src/utils/jyutping.js — Jyutping display utilities

const TONE_SUPERSCRIPTS = {
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
};

/**
 * Convert plain jyutping (e.g., "nei5 hou2") to display format
 * with tone superscripts (e.g., "Nei⁵ hou²").
 * @param {string} jyutping - Plain jyutping string
 * @returns {string}
 */
function jyutpingToDisplay(jyutping) {
  if (!jyutping) return '';
  return jyutping
    .split(' ')
    .map((syllable, index) => {
      const match = syllable.match(/^([a-z]+)([1-6])$/i);
      if (!match) return syllable;
      const [, base, tone] = match;
      const displayBase = index === 0
        ? base.charAt(0).toUpperCase() + base.slice(1)
        : base;
      return displayBase + (TONE_SUPERSCRIPTS[tone] || tone);
    })
    .join(' ');
}

/**
 * Extract tone numbers from a jyutping string.
 * @param {string} jyutping
 * @returns {number[]}
 */
function extractTones(jyutping) {
  if (!jyutping) return [];
  return jyutping
    .split(' ')
    .map(syllable => {
      const match = syllable.match(/([1-6])$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(tone => tone !== null);
}

/**
 * Get tone color for display.
 * @param {number} tone - Tone number 1-6
 * @returns {string} CSS color
 */
function getToneColor(tone) {
  const colors = {
    1: '#D04040',
    2: '#E8A030',
    3: '#2A5A10',
    4: '#4A6A2A',
    5: '#8BB82B',
    6: '#5A5A5A',
  };
  return colors[tone] || '#1A1A1A';
}

export { jyutpingToDisplay, extractTones, getToneColor };
