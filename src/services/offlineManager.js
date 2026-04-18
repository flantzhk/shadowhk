// src/services/offlineManager.js — Offline queue processing + audio download

import { getQueueItems, deleteQueueItem, updateQueueItem } from './storage';
import { scorePronunciation } from './api';
import { cacheAudioForPhrase } from './audio';
import { getAllPhrasesForLanguage } from './languageManager';
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

/**
 * Download all audio for a language to the cache.
 * @param {string} language
 * @param {(progress: {done: number, total: number, phraseId: string}) => void} onProgress
 * @param {{ cancelled: boolean }} cancelRef - Set .cancelled = true to abort
 */
async function downloadAllAudio(language, onProgress, cancelRef = { cancelled: false }) {
  const phrases = getAllPhrasesForLanguage(language);
  const total = phrases.length;

  for (let i = 0; i < phrases.length; i++) {
    if (cancelRef.cancelled) {
      logger.info('Download cancelled');
      break;
    }
    const phrase = phrases[i];
    try {
      await cacheAudioForPhrase(phrase, language);
    } catch (e) {
      logger.warn(`Failed to cache ${phrase.id}`, e);
    }
    onProgress?.({ done: i + 1, total, phraseId: phrase.id, currentTopic: phrase.topicName || phrase.topic || '' });
  }
}

export { processOfflineQueue, initOfflineQueueListener, blobToBase64, downloadAllAudio };
