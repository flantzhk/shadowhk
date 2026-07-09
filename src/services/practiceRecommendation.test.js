import { describe, it, expect, vi } from 'vitest';

const state = { weakTones: new Set(), due: [] };
vi.mock('./toneWeakness', () => ({ getWeakTones: async () => state.weakTones }));
vi.mock('./srs', () => ({ getDueByLanguage: async () => state.due }));

import { recommendFocus } from './practiceRecommendation';

describe('recommendFocus', () => {
  it('recommends tones when the user has a weak tone, even if phrases are also due', async () => {
    state.weakTones = new Set(['4']);
    state.due = [{ id: 'a' }, { id: 'b' }];
    const r = await recommendFocus('cantonese');
    expect(r.focus).toBe('tones');
    expect(r.count).toBe(1);
  });

  it('recommends speaking when phrases are due and no tone is weak', async () => {
    state.weakTones = new Set();
    state.due = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const r = await recommendFocus('cantonese');
    expect(r.focus).toBe('speaking');
    expect(r.count).toBe(3);
    expect(r.reason).toContain('3 phrases');
  });

  it('falls back to speaking with an empty reason when nothing is due or weak', async () => {
    state.weakTones = new Set();
    state.due = [];
    const r = await recommendFocus('cantonese');
    expect(r.focus).toBe('speaking');
    expect(r.reason).toBe('');
  });

  it('singularizes the due-phrase count correctly', async () => {
    state.weakTones = new Set();
    state.due = [{ id: 'a' }];
    const r = await recommendFocus('cantonese');
    expect(r.reason).toContain('1 phrase ');
  });
});
