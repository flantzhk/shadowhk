// src/components/shared/BulkSaveModal.jsx — Save multiple phrases from a scene

import { useState, useEffect } from 'react';
import { getAllLibraryEntries, saveLibraryEntry } from '../../services/storage';
import { MAX_LIBRARY_SIZE, SRS_INITIAL_EASE } from '../../utils/constants';
import styles from './BulkSaveModal.module.css';

/**
 * @param {{ phrases: Array, sceneName: string, onClose: Function, onSaved: (count: number) => void }} props
 */
export function BulkSaveModal({ phrases, sceneName, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set(phrases.map((_, i) => i)));
  const [libraryCount, setLibraryCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllLibraryEntries().then(entries => setLibraryCount(entries.length));
  }, []);

  const togglePhrase = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const selectedCount = selected.size;
  const afterCount = libraryCount + selectedCount;
  const wouldExceed = afterCount > MAX_LIBRARY_SIZE;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    let saved = 0;
    for (const i of selected) {
      const p = phrases[i];
      if (!p?.id) continue;
      try {
        await saveLibraryEntry({
          phraseId: p.id, type: 'phrase', addedAt: Date.now(),
          source: 'scene', customData: null, interval: 0,
          easeFactor: SRS_INITIAL_EASE, nextReviewAt: Date.now(),
          lastPracticedAt: null, practiceCount: 0, status: 'learning',
          bestScore: null, lastScore: null, scoreHistory: [],
        });
        saved++;
      } catch { /* skip already-saved */ }
    }
    setSaving(false);
    onSaved?.(saved);
    onClose?.();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>Save to library?</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.divider} />

        <p className={styles.subtext}>
          {selectedCount} phrase{selectedCount !== 1 ? 's' : ''} from "{sceneName}":
        </p>

        <div className={styles.phraseList}>
          {phrases.map((p, i) => (
            <button
              key={i}
              className={`${styles.phraseItem} ${selected.has(i) ? styles.phraseSelected : ''}`}
              onClick={() => togglePhrase(i)}
            >
              <span className={`${styles.check} ${selected.has(i) ? styles.checkOn : ''}`}>
                {selected.has(i) ? '✓' : '○'}
              </span>
              <div className={styles.phraseText}>
                <span className={styles.phraseChinese} lang="yue">{p.chinese}</span>
                <span className={styles.phraseEnglish}>{p.english}</span>
              </div>
            </button>
          ))}
        </div>

        <div className={styles.countBar}>
          <span>Library: {libraryCount} / {MAX_LIBRARY_SIZE}</span>
          {selectedCount > 0 && (
            <span className={wouldExceed ? styles.exceedWarning : styles.countAfter}>
              After save: {Math.min(afterCount, MAX_LIBRARY_SIZE)} / {MAX_LIBRARY_SIZE}
              {wouldExceed && ' (limit!)'}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={selectedCount === 0 || saving || wouldExceed}
          >
            {saving ? 'Saving...' : `Save ${selectedCount > 0 ? selectedCount : ''} phrase${selectedCount !== 1 ? 's' : ''}`}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
