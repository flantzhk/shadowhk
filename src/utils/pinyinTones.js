// src/utils/pinyinTones.js — shared Mandarin Pinyin tone-mark table.
//
// Jyutping encodes tone as a trailing digit (e.g. "nei5"), but Pinyin marks
// tone with a diacritic on the vowel instead (e.g. "nǐ"). Anything that needs
// to read a tone digit out of romanization — the diff in jyutpingDiff.js and
// the tone-weakness tracker in toneWeakness.js — needs this same mapping, so
// it lives here once instead of being duplicated per file.

// Every toned Pinyin vowel -> [base letter, tone digit]. "v" stands in for
// ü (a common ASCII-Pinyin convention) so it isn't conflated with plain "u".
export const PINYIN_TONE_MARKS = {
  ā: ['a', '1'], á: ['a', '2'], ǎ: ['a', '3'], à: ['a', '4'],
  ē: ['e', '1'], é: ['e', '2'], ě: ['e', '3'], è: ['e', '4'],
  ī: ['i', '1'], í: ['i', '2'], ǐ: ['i', '3'], ì: ['i', '4'],
  ō: ['o', '1'], ó: ['o', '2'], ǒ: ['o', '3'], ò: ['o', '4'],
  ū: ['u', '1'], ú: ['u', '2'], ǔ: ['u', '3'], ù: ['u', '4'],
  ǖ: ['v', '1'], ǘ: ['v', '2'], ǚ: ['v', '3'], ǜ: ['v', '4'],
};

export const PINYIN_DIACRITIC_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

/**
 * Extract a tone digit ('1'-'6') from a single romanized syllable, whichever
 * format it's in: a trailing digit (Jyutping, e.g. "aa3") or a Pinyin
 * diacritic (e.g. "nǐ"). A syllable is unambiguously one format or the
 * other, so checking digit-suffix first and falling back to diacritic scan
 * is safe.
 * @param {string} syllable
 * @returns {string|null}
 */
export function extractToneDigit(syllable) {
  if (!syllable) return null;
  const digitMatch = syllable.match(/([1-6])$/)?.[1];
  if (digitMatch) return digitMatch;
  for (const ch of syllable.toLowerCase()) {
    const marked = PINYIN_TONE_MARKS[ch];
    if (marked) return marked[1];
  }
  return null;
}
