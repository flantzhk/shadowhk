import { describe, it, expect } from 'vitest';
import { diffJyutping } from './jyutpingDiff';

describe('diffJyutping', () => {
  it('marks a perfect match as all correct', () => {
    const r = diffJyutping('nei5 hou2', 'nei5 hou2');
    expect(r).toEqual([
      { expected: 'nei5', actual: 'nei5', status: 'correct' },
      { expected: 'hou2', actual: 'hou2', status: 'correct' },
    ]);
  });

  it('flags a same-sound wrong-tone syllable as "tone", not a realignment', () => {
    const r = diffJyutping('m4 goi1 aa4', 'm4 goi1 aa2');
    expect(r).toEqual([
      { expected: 'm4', actual: 'm4', status: 'correct' },
      { expected: 'goi1', actual: 'goi1', status: 'correct' },
      { expected: 'aa4', actual: 'aa2', status: 'tone' },
    ]);
  });

  it('flags a different base sound as "sound"', () => {
    const r = diffJyutping('sei3', 'sap6');
    expect(r).toEqual([{ expected: 'sei3', actual: 'sap6', status: 'sound' }]);
  });

  it('marks a dropped syllable as "missing" without misaligning the rest', () => {
    const r = diffJyutping('nei5 hou2 aa3', 'nei5 aa3');
    expect(r).toEqual([
      { expected: 'nei5', actual: 'nei5', status: 'correct' },
      { expected: 'hou2', actual: null, status: 'missing' },
      { expected: 'aa3', actual: 'aa3', status: 'correct' },
    ]);
  });

  it('marks an inserted syllable as "extra"', () => {
    const r = diffJyutping('nei5 hou2', 'nei5 hai6 hou2');
    expect(r).toEqual([
      { expected: 'nei5', actual: 'nei5', status: 'correct' },
      { expected: null, actual: 'hai6', status: 'extra' },
      { expected: 'hou2', actual: 'hou2', status: 'correct' },
    ]);
  });

  it('handles the real API\'s double-space-around-punctuation quirk', () => {
    const r = diffJyutping('m4 goi1  bo1 lo4 baau1', 'm4 goi1  bo1 lo4 baau1');
    expect(r.every(s => s.status === 'correct')).toBe(true);
    expect(r).toHaveLength(5);
  });

  it('returns an empty array for two empty strings', () => {
    expect(diffJyutping('', '')).toEqual([]);
  });

  it('treats a fully empty transcription as all missing', () => {
    const r = diffJyutping('nei5 hou2', '');
    expect(r).toEqual([
      { expected: 'nei5', actual: null, status: 'missing' },
      { expected: 'hou2', actual: null, status: 'missing' },
    ]);
  });
});
