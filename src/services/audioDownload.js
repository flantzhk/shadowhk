// src/services/audioDownload.js — App-wide offline audio download state.
// The download must outlive whichever screen started it ("Keep downloading"
// closes the modal), so a module-level singleton owns the cancelRef and
// progress. Components subscribe for updates.

import { downloadAllAudio } from './offlineManager';

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

export { startAudioDownload, cancelAudioDownload, subscribeAudioDownload, getAudioDownloadState };
