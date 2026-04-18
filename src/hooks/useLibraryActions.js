// src/hooks/useLibraryActions.js — Library save/mark-known actions

import { useCallback } from 'react';
import { saveLibraryEntry, getLibraryEntry, getAllLibraryEntries } from '../services/storage';
import { cacheAudioForPhrase } from '../services/audio';
import { SRS_INITIAL_EASE, MAX_LIBRARY_SIZE } from '../utils/constants';

/**
 * Hook for library actions (save, mark known).
 * @param {Function} showToast
 * @param {string} language
 * @param {Function} [onStorageFull] - called when library is at MAX_LIBRARY_SIZE
 * @returns {{ handleSaveToLibrary: Function, handleMarkKnown: Function }}
 */
function useLibraryActions(showToast, language, onStorageFull) {
  const handleSaveToLibrary = useCallback(async (phrase) => {
    try {
      const existing = await getAllLibraryEntries();
      if (existing.length >= MAX_LIBRARY_SIZE) {
        onStorageFull?.();
        return;
      }
      await saveLibraryEntry({
        phraseId: phrase.id, type: 'phrase', addedAt: Date.now(),
        source: 'browse', customData: null, interval: 0,
        easeFactor: SRS_INITIAL_EASE, nextReviewAt: Date.now(),
        lastPracticedAt: null, practiceCount: 0, status: 'learning',
        bestScore: null, lastScore: null, scoreHistory: [],
      });
      showToast('Saved to library', 'success');
      cacheAudioForPhrase(phrase, language).catch(() => {});
    } catch (error) {
      showToast('Failed to save', 'error');
    }
  }, [showToast, language, onStorageFull]);

  const handleMarkKnown = useCallback(async (phrase) => {
    try {
      const existing = await getLibraryEntry(phrase.id);
      if (existing) {
        await saveLibraryEntry({
          ...existing,
          interval: 14, status: 'mastered',
          nextReviewAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
          lastPracticedAt: Date.now(),
        });
        showToast('Marked as known', 'success');
      } else {
        showToast('Save to library first', 'info');
      }
    } catch (error) {
      showToast('Failed to update', 'error');
    }
  }, [showToast]);

  return { handleSaveToLibrary, handleMarkKnown };
}

export { useLibraryActions };
