// src/services/offlineManager.js — Offline queue processing + audio download

import { getQueueItems, deleteQueueItem, updateQueueItem } from './storage';
import { scorePronunciation } from './api';
import { logger } from '../utils/logger';

const MAX_QUEUE_ATTEMPTS = 3;

/**
 * Process all pending items in the offline queue.
 * Called when the app comes back online.
 */
async function processOfflineQueue() {
  const items = await getQueueItems();
  if (items.length === 0) return;

  logger.info(`Processing ${items.length} queued items`);

  for (const item of items) {
    try {
      await executeQueuedAction(item);
      await deleteQueueItem(item.id);
    } catch (error) {
      logger.warn(`Queue item ${item.id} failed`, error);
      if (item.attempts >= MAX_QUEUE_ATTEMPTS) {
        await deleteQueueItem(item.id);
        logger.warn(`Removed queue item ${item.id} after ${MAX_QUEUE_ATTEMPTS} failures`);
      } else {
        await updateQueueItem({ ...item, attempts: item.attempts + 1 });
      }
    }
  }
}

/**
 * Execute a single queued action.
 * @param {Object} item - Queue item with action and data
 */
async function executeQueuedAction(item) {
  switch (item.action) {
    case 'score-pronunciation': {
      const { audioBase64, expectedText, language, phraseId } = item.data;
      const blob = base64ToBlob(audioBase64, 'audio/ogg');
      const result = await scorePronunciation(blob, expectedText, language);
      // Apply the score to the phrase's review schedule — without this the
      // offline session scored the user's speech and then threw it away.
      if (phraseId && typeof result?.score === 'number') {
        const { updateAfterPractice } = await import('./srs');
        await updateAfterPractice(phraseId, result.score).catch((e) =>
          logger.warn(`Queued score for ${phraseId} not applied`, e?.message));
      }
      logger.info(`Scored queued phrase ${phraseId}:`, result.score);
      return result;
    }
    default:
      logger.warn(`Unknown queue action: ${item.action}`);
  }
}

/**
 * Convert a base64 string back to a Blob.
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Blob}
 */
function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Convert a Blob to base64 for queue storage.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = /** @type {string} */ (reader.result);
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Initialize offline queue listener.
 */
function initOfflineQueueListener() {
  window.addEventListener('online', () => {
    logger.info('Back online — processing queue');
    processOfflineQueue();
  });
}

// Data files at public/*.json that carry phrases. Keep in sync with the
// files shipped in public/ (scripts/generate-scene-audio.mjs walks the same set).
const DATA_FILES = [
  'survival', 'numbers', 'colours', 'calendar', 'time',
  'the-very-basics', 'everyday-essentials', 'food-and-drink',
  'getting-around', 'home-and-family', 'social-life', 'at-a-coffee-shop',
  'body-parts',
];

const STATIC_AUDIO_CACHE = 'shadowhk-static-audio'; // same cache the service worker route reads
const CJK = /[\u4e00-\u9fff]/;

async function fetchJson(url) {
  try {
    const resp = await fetch(url);
    if (resp.ok) return await resp.json();
  } catch (e) { /* precached in the SW, so this only fails on first-ever offline visit */ }
  return null;
}

/**
 * Collect the URL of every pre-generated audio file the app can play:
 * Cantonese + English per scene line and phrase, plus every word/character.
 */
async function collectAudioUrls() {
  const base = import.meta.env.BASE_URL || '/';
  const ids = [];
  const words = new Set();

  const addWords = (list, text) => {
    for (const w of list || []) if (w.chinese?.trim()) words.add(w.chinese.trim());
    for (const c of text || '') if (CJK.test(c)) words.add(c);
  };

  const index = (await fetchJson(`${base}scenes/index.json`)) || [];
  for (const entry of index) {
    const scene = await fetchJson(`${base}scenes/${entry.id}.json`);
    for (const l of scene?.lines || []) {
      ids.push(l.id);
      addWords(l.words, l.cjk);
    }
  }

  for (const name of DATA_FILES) {
    const data = await fetchJson(`${base}${name}.json`);
    const sets = Array.isArray(data) ? data : data ? [data] : [];
    for (const s of sets) {
      for (const p of s.phrases || []) {
        ids.push(p.id);
        addWords(p.words, p.chinese);
      }
    }
  }

  return [
    ...ids.map((id) => ({ url: `${base}audio/cantonese/${id}.mp3`, section: 'Cantonese recordings' })),
    ...ids.map((id) => ({ url: `${base}audio/english/${id}.mp3`, section: 'English narration' })),
    ...[...words].map((w) => ({ url: `${base}audio/cantonese-words/${encodeURIComponent(w)}.mp3`, section: 'Word-by-word audio' })),
  ];
}

/**
 * Download every pre-generated recording into the static audio cache so the
 * whole app works offline. Already-cached and not-yet-published files are
 * skipped. The `language` param is unused (everything is fetched) but kept
 * for the existing call signature.
 * @param {string} language
 * @param {(progress: {done: number, total: number, currentTopic: string}) => void} onProgress
 * @param {{ cancelled: boolean }} cancelRef - Set .cancelled = true to abort
 */
async function downloadAllAudio(language, onProgress, cancelRef = { cancelled: false }) {
  const items = await collectAudioUrls();
  const cache = await caches.open(STATIC_AUDIO_CACHE);
  const total = items.length;
  let done = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    if (cancelRef.cancelled) {
      logger.info('Download cancelled');
      break;
    }
    const batch = items.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (item) => {
      try {
        const hit = await cache.match(item.url);
        if (!hit) {
          const resp = await fetch(item.url);
          // 404 = file not generated/published yet — skip, a later run picks it up
          if (resp.ok && resp.status === 200) await cache.put(item.url, resp);
        }
      } catch (e) { /* single-file failure never kills the run */ }
      done += 1;
    }));
    onProgress?.({ done, total, currentTopic: batch[batch.length - 1]?.section || '' });
  }
}

export { processOfflineQueue, initOfflineQueueListener, blobToBase64, downloadAllAudio };
