// src/services/audioDownload.js — App-wide offline audio download state.
// The download must outlive whichever screen started it ("Keep downloading"
// closes the modal), so a module-level singleton owns the cancelRef and
// progress. Components subscribe for updates.

import { downloadAllAudio, collectAudioUrls, STATIC_AUDIO_CACHE } from './offlineManager';

// Stamped when a download run completes so screens can answer "is everything
// on this device?" without re-walking the whole file list.
const VERIFIED_KEY = 'shadowhk_offline_verified';

let state = { status: 'idle', done: 0, total: 0, currentTopic: '', startedAt: 0, updatedAt: 0 };
let cancelRef = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(state);
}

function getAudioDownloadState() {
  return state;
}

function subscribeAudioDownload(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function startAudioDownload(language) {
  if (state.status === 'running') return;
  cancelRef = { cancelled: false };
  const ref = cancelRef;
  const startedAt = Date.now();
  state = { status: 'running', done: 0, total: 0, currentTopic: '', startedAt, updatedAt: startedAt };
  notify();

  downloadAllAudio(
    language,
    (p) => {
      if (ref.cancelled) return;
      state = { ...state, done: p.done, total: p.total, currentTopic: p.currentTopic || '', updatedAt: Date.now() };
      notify();
    },
    ref
  ).then(() => {
    if (ref.cancelled) return;
    state = { ...state, status: 'complete' };
    try {
      localStorage.setItem(VERIFIED_KEY, JSON.stringify({ at: Date.now(), total: state.total }));
    } catch { /* storage full or blocked; status just shows not verified */ }
    notify();
  }).catch(() => {
    if (ref.cancelled) return;
    state = { ...state, status: 'error' };
    notify();
  });
}

function cancelAudioDownload() {
  if (cancelRef) cancelRef.cancelled = true;
  state = { ...state, status: 'idle' };
  notify();
}

/**
 * Whether the full audio library is on this device. Compares what's actually
 * in the cache against a freshly-computed expected file list, rather than
 * trusting the "download finished" flag alone — that flag lives in
 * localStorage, which iOS/Safari can evict independently of Cache Storage,
 * which would otherwise make a device with every file cached report
 * "Incomplete" forever. Falls back to the stamped total only if the file
 * list can't be computed (e.g. first-ever offline visit, nothing precached).
 * @returns {Promise<{ready: boolean, cachedCount: number, verifiedAt: number|null}>}
 */
async function getOfflineAudioStatus() {
  let verified = null;
  try { verified = JSON.parse(localStorage.getItem(VERIFIED_KEY)); } catch { /* malformed */ }
  let cachedCount = 0;
  try {
    const cache = await caches.open(STATIC_AUDIO_CACHE);
    cachedCount = (await cache.keys()).length;
  } catch { /* Cache API unavailable */ }

  let expectedTotal = null;
  try {
    const items = await collectAudioUrls();
    if (items.length > 0) expectedTotal = items.length;
  } catch { /* leave null, fall back below */ }

  const total = expectedTotal ?? verified?.total ?? 0;
  const ready = total > 0 && cachedCount >= total * 0.9;
  return { ready, cachedCount, verifiedAt: verified?.at ?? null };
}

export { startAudioDownload, cancelAudioDownload, subscribeAudioDownload, getAudioDownloadState, getOfflineAudioStatus };
