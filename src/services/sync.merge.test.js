// Tests for the cross-device library merge — newest wins, nothing lost.
import { describe, it, expect, vi } from 'vitest';

// sync.js imports the firebase singleton, which cannot initialise inside
// happy-dom. mergeLibrary is pure, so stub the module out entirely.
vi.mock('./firebase', () => ({ firebase: {}, fbAuth: { currentUser: null }, fbDb: {} }));

import { mergeLibrary } from './sync';

function run(remote, local) {
  const remoteByKey = new Map(Object.entries(remote));
  const localByKey = new Map(Object.entries(local));
  const allKeys = new Set([...remoteByKey.keys(), ...localByKey.keys()]);
  return mergeLibrary(allKeys, remoteByKey, localByKey);
}

describe('mergeLibrary', () => {
  it('remote-only entry is written locally (new-device restore)', () => {
    const r = run({ a: { phraseId: 'a', _updatedAt: 5 } }, {});
    expect(r.writesToLocal).toHaveLength(1);
    expect(r.writesToRemote).toHaveLength(0);
  });

  it('local-only unstamped entry is stamped and seeded to remote', () => {
    const r = run({}, { a: { phraseId: 'a' } });
    expect(r.writesToRemote).toHaveLength(1);
    expect(r.writesToRemote[0]._updatedAt).toBeTruthy();
    expect(r.writesToLocal).toHaveLength(1); // stamp persisted locally too
  });

  it('newer remote beats older local', () => {
    const r = run(
      { a: { phraseId: 'a', best: 90, _updatedAt: 10 } },
      { a: { phraseId: 'a', best: 50, _updatedAt: 5 } },
    );
    expect(r.writesToLocal).toHaveLength(1);
    expect(r.writesToLocal[0].best).toBe(90);
    expect(r.writesToRemote).toHaveLength(0);
  });

  it('newer local beats older remote and is pushed up', () => {
    const r = run(
      { a: { phraseId: 'a', best: 50, _updatedAt: 5 } },
      { a: { phraseId: 'a', best: 90, _updatedAt: 10 } },
    );
    expect(r.writesToRemote).toHaveLength(1);
    expect(r.writesToRemote[0].best).toBe(90);
    expect(r.writesToLocal).toHaveLength(0);
  });

  it('equal timestamps change nothing (no write churn on every app start)', () => {
    const r = run(
      { a: { phraseId: 'a', _updatedAt: 7 } },
      { a: { phraseId: 'a', _updatedAt: 7 } },
    );
    expect(r.writesToLocal).toHaveLength(0);
    expect(r.writesToRemote).toHaveLength(0);
  });
});
