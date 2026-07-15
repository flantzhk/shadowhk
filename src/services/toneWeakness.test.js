import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = new Map();
vi.mock('./storage', () => ({
  getToneStat: async (language, toneDigit) => mockDb.get(`${language}-${toneDigit}`),
  saveToneStat: async (stat) => { mockDb.set(`${stat.language}-${stat.toneDigit}`, stat); },
  getAllToneStats: async () => Array.from(mockDb.values()),
}));

import { recordToneDiff, getToneWeaknessProfile, getWeakTones, phraseHasWeakTone } from './toneWeakness';

beforeEach(() => { mockDb.clear(); });

describe('recordToneDiff', () => {
  it('increments total and correct for a correct syllable', async () => {
    await recordToneDiff([{ expected: 'nei5', actual: 'nei5', status: 'correct' }], 'cantonese');
    expect(await getToneWeaknessProfile('cantonese')).toEqual([{ language: 'cantonese', toneDigit: '5', correct: 1, total: 1, errorRate: 0 }]);
  });

  it('increments total but not correct for a tone error', async () => {
    await recordToneDiff([{ expected: 'aa4', actual: 'aa2', status: 'tone' }], 'cantonese');
    expect(await getToneWeaknessProfile('cantonese')).toEqual([{ language: 'cantonese', toneDigit: '4', correct: 0, total: 1, errorRate: 1 }]);
  });

  it('ignores sound/missing/extra statuses — those are not tone confusions', async () => {
    await recordToneDiff([
      { expected: 'sei3', actual: 'sap6', status: 'sound' },
      { expected: 'hou2', actual: null, status: 'missing' },
      { expected: null, actual: 'hai6', status: 'extra' },
    ], 'cantonese');
    expect(await getToneWeaknessProfile('cantonese')).toEqual([]);
  });

  it('accumulates across multiple calls for the same tone', async () => {
    await recordToneDiff([{ expected: 'aa4', status: 'correct' }], 'cantonese');
    await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'cantonese');
    await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'cantonese');
    const [stat] = await getToneWeaknessProfile('cantonese');
    expect(stat).toMatchObject({ toneDigit: '4', correct: 1, total: 3 });
    expect(stat.errorRate).toBeCloseTo(2 / 3);
  });

  it('keeps a Cantonese tone-digit and a Mandarin tone-digit in separate buckets', async () => {
    await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'cantonese');
    await recordToneDiff([{ expected: 'aa4', status: 'correct' }], 'mandarin');
    const cantoneseStat = (await getToneWeaknessProfile('cantonese'))[0];
    const mandarinStat = (await getToneWeaknessProfile('mandarin'))[0];
    expect(cantoneseStat).toMatchObject({ language: 'cantonese', toneDigit: '4', correct: 0, total: 1 });
    expect(mandarinStat).toMatchObject({ language: 'mandarin', toneDigit: '4', correct: 1, total: 1 });
  });

  it('extracts a tone digit from diacritic-marked Mandarin Pinyin, not just Jyutping digit suffixes', async () => {
    await recordToneDiff([{ expected: 'nǐ', actual: 'nǐ', status: 'correct' }], 'mandarin');
    expect(await getToneWeaknessProfile('mandarin')).toEqual([{ language: 'mandarin', toneDigit: '3', correct: 1, total: 1, errorRate: 0 }]);
  });

  it('accumulates diacritic Pinyin tone errors across multiple syllables in one phrase', async () => {
    // "hǎo" (tone 3) and "mā" (tone 1) — two different tones, one call
    await recordToneDiff([
      { expected: 'hǎo', actual: 'hāo', status: 'tone' },
      { expected: 'mā', actual: 'mā', status: 'correct' },
    ], 'mandarin');
    const stats = await getToneWeaknessProfile('mandarin');
    expect(stats).toEqual(expect.arrayContaining([
      { language: 'mandarin', toneDigit: '3', correct: 0, total: 1, errorRate: 1 },
      { language: 'mandarin', toneDigit: '1', correct: 1, total: 1, errorRate: 0 },
    ]));
  });
});

describe('getWeakTones', () => {
  it('excludes a tone below the minimum attempt count, regardless of error rate', async () => {
    for (let i = 0; i < 3; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'cantonese');
    expect(await getWeakTones('cantonese')).toEqual(new Set());
  });

  it('flags a tone with enough attempts and a high enough error rate', async () => {
    for (let i = 0; i < 3; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'cantonese');
    for (let i = 0; i < 2; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'correct' }], 'cantonese');
    // 3 wrong / 5 total = 60% error rate, 5 attempts meets the minimum
    expect(await getWeakTones('cantonese')).toEqual(new Set(['4']));
  });

  it('excludes a tone with enough attempts but a low error rate', async () => {
    for (let i = 0; i < 5; i += 1) await recordToneDiff([{ expected: 'nei5', status: 'correct' }], 'cantonese');
    expect(await getWeakTones('cantonese')).toEqual(new Set());
  });

  it('does not let a weak Mandarin tone show up in the Cantonese weak set', async () => {
    for (let i = 0; i < 5; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'tone' }], 'mandarin');
    expect(await getWeakTones('cantonese')).toEqual(new Set());
    expect(await getWeakTones('mandarin')).toEqual(new Set(['4']));
  });
});

describe('phraseHasWeakTone', () => {
  it('returns true when a syllable tone is in the weak set', () => {
    expect(phraseHasWeakTone('m4 goi1 aa4', new Set(['4']))).toBe(true);
  });

  it('returns false when no syllable tone is in the weak set', () => {
    expect(phraseHasWeakTone('nei5 hou2', new Set(['4']))).toBe(false);
  });

  it('returns false for an empty weak set', () => {
    expect(phraseHasWeakTone('nei5 hou2', new Set())).toBe(false);
  });

  it('returns false for a missing jyutping string', () => {
    expect(phraseHasWeakTone(null, new Set(['4']))).toBe(false);
  });

  it('returns true when a diacritic Pinyin syllable tone is in the weak set', () => {
    expect(phraseHasWeakTone('nǐ hǎo', new Set(['3']))).toBe(true);
  });

  it('returns false when no diacritic Pinyin syllable tone is in the weak set', () => {
    expect(phraseHasWeakTone('nǐ hǎo', new Set(['1']))).toBe(false);
  });
});
