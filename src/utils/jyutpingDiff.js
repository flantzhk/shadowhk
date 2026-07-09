// src/utils/jyutpingDiff.js — syllable-level diagnostic diff between the
// expected Jyutping for a phrase and what the recognizer transcribed.
//
// cantonese.ai's /score-pronunciation response has no per-syllable pitch
// data, but it does return expectedJyutping/transcribedJyutping, and Jyutping
// already encodes tone as a trailing digit (e.g. "aa3" vs "aa4"). Diffing the
// two syllable-by-syllable turns a bare score into "which syllable, which
// tone" feedback without needing any audio signal processing.

const SYLLABLE_RE = /^([a-z]+)([1-6])?$/i;

function parseSyllable(token) {
  const match = SYLLABLE_RE.exec(token);
  if (!match) return { letters: token.toLowerCase(), tone: null };
  return { letters: match[1].toLowerCase(), tone: match[2] ?? null };
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

  const toToken = s => s.letters + (s.tone ?? '');
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
