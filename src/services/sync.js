// src/services/sync.js — Cross-device sync for library entries + streak.
//
// Library lives in IndexedDB locally (fast + offline). Firestore is the
// cross-device merge point. Strategy:
//   - Every saveLibraryEntry fires a fire-and-forget push (library subcollection)
//   - On app load (after auth) we pull from Firestore and merge by _updatedAt
//     (newer wins; ties: remote wins).
//   - Streak: whichever device has the higher streakCount wins on pull.
//
// All writes are best-effort. If Firestore is offline/unavailable the local
// IDB write still succeeds and the user keeps working.

import { firebase, fbAuth, fbDb } from './firebase';
import {
  getAllLibraryEntries,
  getLibraryEntry,
  saveLibraryEntry as idbSaveLibraryEntry,
  deleteLibraryEntry as idbDeleteLibraryEntry,
  getSettings,
  saveSettings,
} from './storage';
import { logger } from '../utils/logger';

/** @returns {string|null} */
function uid() {
  return fbAuth.currentUser?.uid || null;
}

function libraryCollection(userId) {
  return fbDb.collection('users').doc(userId).collection('library');
}

/**
 * Push a single library entry to Firestore. Fire-and-forget; never throws.
 * @param {Object} entry - must have .phraseId
 * @returns {Promise<void>}
 */
async function pushLibraryEntry(entry) {
  const userId = uid();
  if (!userId || !entry?.phraseId) return;
  try {
    await libraryCollection(userId).doc(String(entry.phraseId)).set(
      { ...entry, _updatedAt: entry._updatedAt || Date.now() },
      { merge: false }
    );
  } catch (err) {
    logger.warn('Failed to push library entry', entry.phraseId, err?.message || err);
  }
}

/**
 * Mark a library entry deleted on Firestore. We actually delete the doc;
 * on pull, anything missing from remote but present locally without
 * _updatedAt just stays (it predates sync); entries with _updatedAt that
 * are missing remotely get removed locally.
 * @param {string} phraseId
 * @returns {Promise<void>}
 */
async function deleteLibraryEntryRemote(phraseId) {
  const userId = uid();
  if (!userId || !phraseId) return;
  try {
    await libraryCollection(userId).doc(String(phraseId)).delete();
  } catch (err) {
    logger.warn('Failed to delete remote library entry', phraseId, err?.message || err);
  }
}

/**
 * Pull library from Firestore and merge into local IndexedDB.
 *   - Remote newer → write remote into IDB
 *   - Local newer  → push local up to remote
 *   - Local only, no _updatedAt → stamp + push (seed first-sync)
 *   - Remote only → write into IDB
 *
 * Safe to call on every app start after auth settles.
 * @returns {Promise<{ pulled: number, pushed: number } | null>}
 */
async function pullLibraryFromFirestore() {
  const userId = uid();
  if (!userId) return null;

  try {
    const [snapshot, localEntries] = await Promise.all([
      libraryCollection(userId).get(),
      getAllLibraryEntries(),
    ]);

    const remoteByKey = new Map();
    snapshot.forEach((doc) => remoteByKey.set(doc.id, doc.data()));

    const localByKey = new Map();
    for (const e of localEntries) localByKey.set(String(e.phraseId), e);

    const allKeys = new Set([...remoteByKey.keys(), ...localByKey.keys()]);
    const result = mergeLibrary(allKeys, remoteByKey, localByKey);

    await Promise.all([
      ...result.writesToLocal.map((entry) => idbSaveLibraryEntry(entry)),
      ...result.writesToRemote.map((entry) =>
        libraryCollection(userId).doc(String(entry.phraseId)).set(entry, { merge: false })
          .catch((err) => logger.warn('Seed push failed', entry.phraseId, err?.message || err))
      ),
    ]);

    return { pulled: result.writesToLocal.length, pushed: result.writesToRemote.length };
  } catch (err) {
    logger.warn('pullLibraryFromFirestore failed', err?.message || err);
    return null;
  }
}

/**
 * Pure merge function — exported for testing.
 * Given the union of phraseIds and the remote+local maps, decide what gets
 * written where. Newer _updatedAt wins; ties go to remote.
 *
 * @param {Set<string>} allKeys
 * @param {Map<string, Object>} remoteByKey
 * @param {Map<string, Object>} localByKey
 * @returns {{ writesToLocal: Object[], writesToRemote: Object[] }}
 */
function mergeLibrary(allKeys, remoteByKey, localByKey) {
  const writesToLocal = [];
  const writesToRemote = [];

  for (const key of allKeys) {
    const remote = remoteByKey.get(key);
    const local = localByKey.get(key);

    if (remote && !local) {
      writesToLocal.push(remote);
      continue;
    }
    if (local && !remote) {
      // Seed: stamp if not already stamped
      const stamped = { ...local, _updatedAt: local._updatedAt || Date.now() };
      writesToRemote.push(stamped);
      if (!local._updatedAt) writesToLocal.push(stamped); // also persist stamp locally
      continue;
    }
    // Both exist — newer wins, tie goes to remote
    const rT = remote._updatedAt || 0;
    const lT = local._updatedAt || 0;
    if (rT >= lT) {
      // Only write locally if remote is strictly newer or local has no stamp
      if (rT > lT || !local._updatedAt) writesToLocal.push(remote);
    } else {
      writesToRemote.push(local);
    }
  }

  return { writesToLocal, writesToRemote };
}

/**
 * Push streak state to users/{uid}. Merge-write so it coexists with other
 * profile fields (email, language_choice, etc).
 * @param {{ streakCount: number, streakLastDate: string|null, streakFreezeUsedWeek: string|null }} streak
 * @returns {Promise<void>}
 */
async function pushStreak(streak) {
  const userId = uid();
  if (!userId) return;
  try {
    await fbDb.collection('users').doc(userId).set(
      {
        streakCount: streak.streakCount ?? 0,
        streakLastDate: streak.streakLastDate ?? null,
        streakFreezeUsedWeek: streak.streakFreezeUsedWeek ?? null,
        _streakUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    logger.warn('Failed to push streak', err?.message || err);
  }
}

/**
 * Pull streak from Firestore. If the remote streakCount is higher than local,
 * overwrite local settings. Returns the merged streak for the caller to
 * refresh React state.
 * @returns {Promise<{ streakCount: number, streakLastDate: string|null, streakFreezeUsedWeek: string|null } | null>}
 */
async function pullStreakFromFirestore() {
  const userId = uid();
  if (!userId) return null;

  try {
    const [doc, settings] = await Promise.all([
      fbDb.collection('users').doc(userId).get(),
      getSettings(),
    ]);
    if (!doc.exists) return null;
    const data = doc.data() || {};

    const remoteCount = typeof data.streakCount === 'number' ? data.streakCount : 0;
    const localCount = settings?.streakCount ?? 0;

    if (remoteCount > localCount && settings) {
      const merged = {
        ...settings,
        streakCount: remoteCount,
        streakLastDate: data.streakLastDate ?? settings.streakLastDate,
        streakFreezeUsedWeek: data.streakFreezeUsedWeek ?? settings.streakFreezeUsedWeek,
      };
      await saveSettings(merged);
      return {
        streakCount: merged.streakCount,
        streakLastDate: merged.streakLastDate,
        streakFreezeUsedWeek: merged.streakFreezeUsedWeek,
      };
    }

    // Local is equal or higher — push local up so remote catches up
    if (settings && localCount >= remoteCount) {
      pushStreak({
        streakCount: settings.streakCount ?? 0,
        streakLastDate: settings.streakLastDate ?? null,
        streakFreezeUsedWeek: settings.streakFreezeUsedWeek ?? null,
      });
    }
    return null;
  } catch (err) {
    logger.warn('pullStreakFromFirestore failed', err?.message || err);
    return null;
  }
}

/**
 * Run full sync after auth settles. Fire-and-forget from App.jsx.
 * @returns {Promise<void>}
 */
async function syncOnAuthReady() {
  if (!uid()) return;
  try {
    await Promise.all([pullLibraryFromFirestore(), pullStreakFromFirestore()]);
  } catch (err) {
    logger.warn('syncOnAuthReady failed', err?.message || err);
  }
}

// Re-export a wrapped saveLibraryEntry that stamps + pushes. Callers that want
// sync go through here; storage.js stays purely local (no Firebase coupling).
async function saveLibraryEntryAndSync(entry) {
  const stamped = { ...entry, _updatedAt: Date.now() };
  await idbSaveLibraryEntry(stamped);
  pushLibraryEntry(stamped); // fire-and-forget
  return stamped;
}

async function deleteLibraryEntryAndSync(phraseId) {
  await idbDeleteLibraryEntry(phraseId);
  deleteLibraryEntryRemote(phraseId); // fire-and-forget
}

export {
  pushLibraryEntry,
  deleteLibraryEntryRemote,
  pullLibraryFromFirestore,
  mergeLibrary,
  pushStreak,
  pullStreakFromFirestore,
  syncOnAuthReady,
  saveLibraryEntryAndSync,
  deleteLibraryEntryAndSync,
};
