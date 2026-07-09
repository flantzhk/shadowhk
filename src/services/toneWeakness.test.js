import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = new Map();
vi.mock('./storage', () => ({
  getToneStat: async (tone) => mockDb.get(tone),
  saveToneStat: async (stat) => { mockDb.set(stat.tone, stat); },
  getAllToneStats: async () => Array.from(mockDb.values()),
}));

import { recordToneDiff, getToneWeaknessProfile, getWeakTones, phraseHasWeakTone } from './toneWeakness';

beforeEach(() => { mockDb.clear(); });

describe('recordToneDiff', () => {
  it('increments total and correct for a correct syllable', async () => {
    await recordToneDiff([{ expected: 'nei5', actual: 'nei5', status: 'correct' }]);
    expect(await getToneWeaknessProfile()).toEqual([{ tone: '5', correct: 1, total: 1, errorRate: 0 }]);
  });

  it('increments total but not correct for a tone error', async () => {
    await recordToneDiff([{ expected: 'aa4', actual: 'aa2', status: 'tone' }]);
    expect(await getToneWeaknessProfile()).toEqual([{ tone: '4', correct: 0, total: 1, errorRate: 1 }]);
  });

  it('ignores sound/missing/extra statuses — those are not tone confusions', async () => {
    await recordToneDiff([
      { expected: 'sei3', actual: 'sap6', status: 'sound' },
      { expected: 'hou2', actual: null, status: 'missing' },
      { expected: null, actual: 'hai6', status: 'extra' },
    ]);
    expect(await getToneWeaknessProfile()).toEqual([]);
  });

  it('accumulates across multiple calls for the same tone', async () => {
    await recordToneDiff([{ expected: 'aa4', status: 'correct' }]);
    await recordToneDiff([{ expected: 'aa4', status: 'tone' }]);
    await recordToneDiff([{ expected: 'aa4', status: 'tone' }]);
    const [stat] = await getToneWeaknessProfile();
    expect(stat).toMatchObject({ tone: '4', correct: 1, total: 3 });
    expect(stat.errorRate).toBeCloseTo(2 / 3);
  });
});

describe('getWeakTones', () => {
  it('excludes a tone below the minimum attempt count, regardless of error rate', async () => {
    for (let i = 0; i < 3; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'tone' }]);
    expect(await getWeakTones()).toEqual(new Set());
  });

  it('flags a tone with enough attempts and a high enough error rate', async () => {
    for (let i = 0; i < 3; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'tone' }]);
    for (let i = 0; i < 2; i += 1) await recordToneDiff([{ expected: 'aa4', status: 'correct' }]);
    // 3 wrong / 5 total = 60% error rate, 5 attempts meets the minimum
    expect(await getWeakTones()).toEqual(new Set(['4']));
  });

  it('excludes a tone with enough attempts but a low error rate', async () => {
    for (let i = 0; i < 5; i += 1) await recordToneDiff([{ expected: 'nei5', status: 'correct' }]);
    expect(await getWeakTones()).toEqual(new Set());
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
});
