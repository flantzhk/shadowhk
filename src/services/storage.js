// src/services/storage.js — IndexedDB wrapper using idb

import { openDB } from 'idb';
import { DB_NAME, DB_VERSION } from '../utils/constants';
import { logger } from '../utils/logger';

/** @type {import('idb').IDBPDatabase|null} */
let dbInstance = null;

/**
 * Get or create the IndexedDB database.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Settings store (single row keyed 'user')
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Library entries — v2 schema adds scene_id, source_tag, lived_at, growth_state, language
      if (!db.objectStoreNames.contains('library')) {
        const library = db.createObjectStore('library', { keyPath: 'phraseId' });
        library.createIndex('by-status', 'status');
        library.createIndex('by-next-review', 'nextReviewAt');
        library.createIndex('by-scene', 'scene_id');
        library.createIndex('by-language', 'language');
        library.createIndex('by-growth', 'growth_state');
      }

      // Scene records (tracks per-scene progress and lived state)
      if (!db.objectStoreNames.contains('scenes')) {
        const scenes = db.createObjectStore('scenes', { keyPath: 'sceneId' });
        scenes.createIndex('by-language', 'language');
        scenes.createIndex('by-category', 'category');
      }

      // Session records
      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-date', 'date');
      }

      // Offline queue (pending API calls)
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }

      // Cached phrase metadata (legacy — kept for carry-over compatibility)
      if (!db.objectStoreNames.contains('phrases')) {
        db.createObjectStore('phrases', { keyPath: 'id' });
      }

      // Cached topic metadata (legacy — kept for carry-over compatibility)
      if (!db.objectStoreNames.contains('topics')) {
        db.createObjectStore('topics', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

/** Helper: run a DB operation with error handling. */
async function dbOp(label, fn, fallback) {
  try {
    const db = await getDB();
    return await fn(db);
  } catch (error) {
    logger.error(label, error);
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

// === Settings ===

/** @returns {Promise<Object|undefined>} */
async function getSettings() {
  return dbOp('Failed to get settings', (db) => db.get('settings', 'user'), undefined);
}

/** @param {Object} settings */
async function saveSettings(settings) {
  return dbOp('Failed to save settings', (db) => db.put('settings', { ...settings, id: 'user' }));
}

// === Library ===

/** @returns {Promise<Array>} */
async function getAllLibraryEntries() {
  return dbOp('Failed to get library', (db) => db.getAll('library'), []);
}

/** @param {string} phraseId @returns {Promise<Object|undefined>} */
async function getLibraryEntry(phraseId) {
  return dbOp('Failed to get entry', (db) => db.get('library', phraseId), undefined);
}

/** @param {Object} entry */
async function saveLibraryEntry(entry) {
  const stamped = { ...entry, _updatedAt: Date.now() };
  const result = await dbOp('Failed to save entry', (db) => db.put('library', stamped));
  // Fire-and-forget sync to Firestore. Dynamic import avoids circular dep.
  import('./sync').then(({ pushLibraryEntry }) => pushLibraryEntry(stamped)).catch(() => {});
  return result;
}

/** @param {string} phraseId */
async function deleteLibraryEntry(phraseId) {
  const result = await dbOp('Failed to delete entry', (db) => db.delete('library', phraseId));
  import('./sync').then(({ deleteLibraryEntryRemote }) => deleteLibraryEntryRemote(phraseId)).catch(() => {});
  return result;
}

/** @returns {Promise<Array>} */
async function getDueEntries() {
  return dbOp('Failed to get due entries', async (db) => {
    const now = Date.now();
    const all = await db.getAllFromIndex('library', 'by-next-review');
    // Only return phrases that have been practiced at least once.
    // New (never-practiced) phrases show as "New" in the library and go into
    // regular lessons — they don't count as "due for review" yet.
    return all.filter(entry => {
      const count = entry.practiceCount ?? 0;
      const reviewAt = typeof entry.nextReviewAt === 'number' ? entry.nextReviewAt : NaN;
      return count > 0 && reviewAt <= now;
    });
  }, []);
}

// === Sessions ===

/** @param {Object} session */
async function saveSession(session) {
  return dbOp('Failed to save session', (db) => db.put('sessions', session));
}

/**
 * Return the averageScore values from the most recent N sessions that have a
 * non-null averageScore. Used for personal-percentile calculations.
 *
 * Fetches before the current session is saved so the current score is not
 * included in its own baseline.
 *
 * @param {number} [limit=20]
 * @returns {Promise<number[]>} Most-recent-first list of average scores.
 */
async function getRecentScoredSessions(limit = 20) {
  return dbOp('Failed to get recent scored sessions', async (db) => {
    const all = await db.getAll('sessions');
    return all
      .filter(s => s.averageScore != null)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, limit)
      .map(s => s.averageScore);
  }, []);
}

/** @param {string} date - YYYY-MM-DD @returns {Promise<Array>} */
async function getSessionsByDate(date) {
  return dbOp('Failed to get sessions', (db) => db.getAllFromIndex('sessions', 'by-date', date), []);
}

/** @returns {Promise<Array>} */
async function getAllSessions() {
  return dbOp('Failed to get sessions', (db) => db.getAll('sessions'), []);
}

// === Offline Queue ===

/** @param {string} action @param {Object} data */
async function addToQueue(action, data) {
  return dbOp('Failed to add to queue', (db) =>
    db.add('queue', { action, data, createdAt: Date.now(), attempts: 0 })
  );
}

/** @returns {Promise<Array>} */
async function getQueueItems() {
  return dbOp('Failed to get queue', (db) => db.getAll('queue'), []);
}

/** @param {number} id */
async function deleteQueueItem(id) {
  return dbOp('Failed to delete queue item', (db) => db.delete('queue', id));
}

/** @param {Object} item */
async function updateQueueItem(item) {
  return dbOp('Failed to update queue item', (db) => db.put('queue', item));
}

// === Phrases & Topics Cache ===

/** @param {Object} phrase */
async function cachePhrase(phrase) {
  return dbOp('Failed to cache phrase', (db) => db.put('phrases', phrase));
}

/** @param {string} id @returns {Promise<Object|undefined>} */
async function getCachedPhrase(id) {
  return dbOp('Failed to get phrase', (db) => db.get('phrases', id), undefined);
}

/** @param {Object} topic */
async function cacheTopic(topic) {
  return dbOp('Failed to cache topic', (db) => db.put('topics', topic));
}

/**
 * Wipe all data from all IndexedDB stores (used during account deletion).
 * @returns {Promise<void>}
 */
async function clearAllData() {
  const STORES = ['settings', 'library', 'scenes', 'sessions', 'queue', 'phrases', 'topics'];
  const db = await getDB();
  await Promise.all(STORES.map((store) => db.clear(store)));
  dbInstance = null;
}

// === Scene progress store (v2) ===

/**
 * Get scene progress record.
 * @param {string} sceneId
 * @returns {Promise<Object|undefined>}
 */
async function getSceneProgress(sceneId) {
  return dbOp('Failed to get scene progress', (db) => db.get('scenes', sceneId), undefined);
}

/**
 * Save scene progress record.
 * Fields: sceneId, language, category, practiced (bool), livedAt (timestamp|null), lastPracticedAt
 * @param {Object} record
 */
async function saveSceneProgress(record) {
  return dbOp('Failed to save scene progress', (db) =>
    db.put('scenes', { ...record, _updatedAt: Date.now() })
  );
}

/** @returns {Promise<Array>} All scene progress records */
async function getAllSceneProgress() {
  return dbOp('Failed to get scene progress', (db) => db.getAll('scenes'), []);
}

/**
 * Get library entries filtered by scene ID.
 * @param {string} sceneId
 * @returns {Promise<Array>}
 */
async function getLibraryEntriesByScene(sceneId) {
  return dbOp('Failed to get library by scene', (db) =>
    db.getAllFromIndex('library', 'by-scene', sceneId), []
  );
}

/**
 * Get library entries filtered by language.
 * @param {string} language - 'cantonese' | 'mandarin'
 * @returns {Promise<Array>}
 */
async function getLibraryEntriesByLanguage(language) {
  return dbOp('Failed to get library by language', (db) =>
    db.getAllFromIndex('library', 'by-language', language), []
  );
}

async function getLibraryEntries(language) {
  return getLibraryEntriesByLanguage(language);
}

async function removeLibraryEntry(phraseId) {
  return deleteLibraryEntry(phraseId);
}

async function searchLibrary(query, language) {
  const entries = await getLibraryEntriesByLanguage(language);
  const q = query.toLowerCase();
  return entries.filter(e =>
    e.cjk?.includes(query) ||
    e.romanization?.toLowerCase().includes(q) ||
    e.english?.toLowerCase().includes(q)
  );
}

export {
  getDB,
  getSettings,
  saveSettings,
  getAllLibraryEntries,
  getLibraryEntry,
  saveLibraryEntry,
  deleteLibraryEntry,
  removeLibraryEntry,
  getDueEntries,
  saveSession,
  getSessionsByDate,
  getAllSessions,
  getRecentScoredSessions,
  addToQueue,
  getQueueItems,
  deleteQueueItem,
  updateQueueItem,
  clearAllData,
  getSceneProgress,
  saveSceneProgress,
  getAllSceneProgress,
  getLibraryEntriesByScene,
  getLibraryEntriesByLanguage,
  getLibraryEntries,
  searchLibrary,
};
