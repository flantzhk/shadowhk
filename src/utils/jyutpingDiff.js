// src/utils/jyutpingDiff.js — syllable-level diagnostic diff between the
// expected Jyutping/Pinyin for a phrase and what the recognizer transcribed.
//
// cantonese.ai's /score-pronunciation response has no per-syllable pitch
// data, but it does return expectedJyutping/transcribedJyutping, and Jyutping
// already encodes tone as a trailing digit (e.g. "aa3" vs "aa4"). Diffing the
// two syllable-by-syllable turns a bare score into "which syllable, which
// tone" feedback without needing any audio signal processing.
//
// Mandarin romanization (Pinyin) marks tone with a diacritic on the vowel
// instead of a trailing digit (e.g. "nǐ" vs Jyutping's "nei5"), so a second
// parse path normalizes those marks to a base letter + tone digit. Which
// path applies is sniffed per syllable from the token itself (presence of a
// tone-mark character) rather than a language flag threaded through every
// call site — a syllable is unambiguously one format or the other.

import { PINYIN_TONE_MARKS, PINYIN_DIACRITIC_RE } from './pinyinTones';

const SYLLABLE_RE = /^([a-z]+)([1-6])?$/i;

function parseSyllable(token) {
  const lower = token.toLowerCase();
  if (PINYIN_DIACRITIC_RE.test(lower)) {
    let tone = null;
    let letters = '';
    for (const ch of lower) {
      const marked = PINYIN_TONE_MARKS[ch];
      if (marked) {
        tone = tone ?? marked[1];
        letters += marked[0];
      } else {
        letters += ch;
      }
    }
    return { letters, tone, raw: lower };
  }
  const match = SYLLABLE_RE.exec(token);
  if (!match) return { letters: lower, tone: null, raw: lower };
  return { letters: match[1].toLowerCase(), tone: match[2] ?? null, raw: lower };
}

function tokenize(jyutping) {
  return (jyutping || '').trim().split(/\s+/).filter(Boolean);
}

/**
 * Align expected vs. transcribed Jyutping syllable-by-syllable and classify
 * each one as correct, wrong tone, wrong sound, missing, or extra.
 * @param {string} expectedJyutping
 * @param {string} transcribedJyutping
 * @returns {Array<{expected: string|null, actual: string|null, status: 'correct'|'tone'|'sound'|'missing'|'extra'}>}
 */
function diffJyutping(expectedJyutping, transcribedJyutping) {
  const expected = tokenize(expectedJyutping).map(parseSyllable);
  const actual = tokenize(transcribedJyutping).map(parseSyllable);
  const n = expected.length;
  const m = actual.length;

  // Edit distance where substitution is free when the base sound matches, so
  // a pure tone mismatch never gets misread as a missing/extra syllable.
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) cost[i][0] = i;
  for (let j = 1; j <= m; j += 1) cost[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const sub = cost[i - 1][j - 1] + (expected[i - 1].letters === actual[j - 1].letters ? 0 : 1);
      cost[i][j] = Math.min(sub, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }

  const toToken = s => s.raw;
  const result = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const sub = i > 0 && j > 0 ? cost[i - 1][j - 1] + (expected[i - 1].letters === actual[j - 1].letters ? 0 : 1) : Infinity;
    if (i > 0 && j > 0 && cost[i][j] === sub) {
      const e = expected[i - 1];
      const a = actual[j - 1];
      const status = e.letters !== a.letters ? 'sound' : e.tone !== a.tone ? 'tone' : 'correct';
      result.unshift({ expected: toToken(e), actual: toToken(a), status });
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      result.unshift({ expected: toToken(expected[i - 1]), actual: null, status: 'missing' });
      i -= 1;
    } else {
      result.unshift({ expected: null, actual: toToken(actual[j - 1]), status: 'extra' });
      j -= 1;
    }
  }
  return result;
}

export { diffJyutping };
