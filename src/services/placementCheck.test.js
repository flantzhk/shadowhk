import { describe, it, expect, vi } from 'vitest';

const state = { authed: false, scoreResult: { score: 90 } };
vi.mock('./auth', () => ({ isAuthenticated: () => state.authed }));
vi.mock('./api', () => ({ scorePronunciation: vi.fn(async () => state.scoreResult) }));
vi.mock('./offlineManager', () => ({
  blobToBase64: async (blob) => `b64:${blob.__id ?? 'x'}`,
  base64ToBlob: (b64) => ({ __b64: b64 }),
}));

import { submitPlacementAttempt, resolvePendingPlacementCheck } from './placementCheck';

describe('submitPlacementAttempt', () => {
  it('scores immediately when already authenticated, with no settings patch', async () => {
    state.authed = true;
    state.scoreResult = { score: 77 };
    const r = await submitPlacementAttempt('dim-sum-01', '唔該', { __id: 'a' }, {});
    expect(r).toEqual({ score: 77, settingsUpdate: null });
  });

  it('queues the recording instead of scoring when not authenticated', async () => {
    state.authed = false;
    const r = await submitPlacementAttempt('dim-sum-01', '唔該', { __id: 'a' }, {});
    expect(r.score).toBeNull();
    expect(r.settingsUpdate.pendingPlacementCheck).toEqual([
      { phraseId: 'dim-sum-01', expectedText: '唔該', audioBase64: 'b64:a', language: 'cantonese' },
    ]);
  });

  it('appends to existing pending attempts rather than overwriting them', async () => {
    state.authed = false;
    const existing = { pendingPlacementCheck: [{ phraseId: 'dim-sum-01', expectedText: '唔該', audioBase64: 'b64:a', language: 'cantonese' }] };
    const r = await submitPlacementAttempt('dim-sum-03', '四位', { __id: 'b' }, existing);
    expect(r.settingsUpdate.pendingPlacementCheck).toHaveLength(2);
    expect(r.settingsUpdate.pendingPlacementCheck[1]).toEqual({ phraseId: 'dim-sum-03', expectedText: '四位', audioBase64: 'b64:b', language: 'cantonese' });
  });

  it('queues the recording with the given language when not authenticated', async () => {
    state.authed = false;
    const r = await submitPlacementAttempt('mandarin-restaurant-01', '你好', { __id: 'c' }, {}, 'mandarin');
    expect(r.settingsUpdate.pendingPlacementCheck).toEqual([
      { phraseId: 'mandarin-restaurant-01', expectedText: '你好', audioBase64: 'b64:c', language: 'mandarin' },
    ]);
  });
});

describe('resolvePendingPlacementCheck', () => {
  it('returns null when nothing is pending', async () => {
    expect(await resolvePendingPlacementCheck({})).toBeNull();
    expect(await resolvePendingPlacementCheck({ pendingPlacementCheck: [] })).toBeNull();
  });

  it('scores all pending attempts and averages them into a baseline', async () => {
    state.scoreResult = { score: 80 };
    const settings = {
      pendingPlacementCheck: [
        { phraseId: 'dim-sum-01', expectedText: '唔該', audioBase64: 'x' },
        { phraseId: 'dim-sum-03', expectedText: '四位', audioBase64: 'y' },
      ],
    };
    const updates = await resolvePendingPlacementCheck(settings);
    expect(updates.baselineScore).toBe(80);
    expect(updates.pendingPlacementCheck).toEqual([]);
    expect(updates.baselineAt).toBeTypeOf('number');
  });

  it('clears the queue even if scoring fails for every attempt', async () => {
    const { scorePronunciation } = await import('./api');
    vi.mocked(scorePronunciation).mockRejectedValueOnce(new Error('network'));
    const settings = { pendingPlacementCheck: [{ phraseId: 'dim-sum-01', expectedText: '唔該', audioBase64: 'x' }] };
    const updates = await resolvePendingPlacementCheck(settings);
    expect(updates.pendingPlacementCheck).toEqual([]);
    expect(updates.baselineScore).toBeUndefined();
  });
});
