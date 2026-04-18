// src/components/shared/DownloadAllModal.jsx — Item 17: Download All Audio Modal

import { useState, useRef, useEffect } from 'react';
import { downloadAllAudio } from '../../services/offlineManager';
import styles from './DownloadAllModal.module.css';

/**
 * Full download-all modal with SVG progress ring.
 * @param {{ language: string, onClose: Function }} props
 */
export default function DownloadAllModal({ language, onClose }) {
  const [progress, setProgress] = useState({ done: 0, total: 1, currentTopic: '' });
  const [phase, setPhase] = useState('downloading'); // downloading | complete | error
  const cancelRef = useRef({ cancelled: false });
  const startTime = useRef(Date.now());

  useEffect(() => {
    cancelRef.current = { cancelled: false };
    startTime.current = Date.now();

    downloadAllAudio(
      language,
      (p) => setProgress({ done: p.done, total: p.total, currentTopic: p.currentTopic || '' }),
      cancelRef.current
    ).then(() => {
      if (!cancelRef.current.cancelled) setPhase('complete');
    }).catch(() => {
      if (!cancelRef.current.cancelled) setPhase('error');
    });

    return () => { cancelRef.current.cancelled = true; };
  }, [language]);

  const handleCancel = () => {
    cancelRef.current.cancelled = true;
    onClose();
  };

  const handleKeepDownloading = () => {
    // Close modal but download continues (cancelRef stays false)
    onClose('background');
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // Estimate remaining time
  const elapsed = (Date.now() - startTime.current) / 1000;
  const rate = progress.done > 0 ? elapsed / progress.done : 0;
  const remaining = Math.max(0, Math.round(rate * (progress.total - progress.done)));
  const mins = Math.ceil(remaining / 60);

  // SVG ring params
  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  if (phase === 'complete') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.doneEmoji}>✓</div>
          <h2 className={styles.title}>Download complete</h2>
          <p className={styles.statusMain}>{progress.total} phrases downloaded</p>
          <p className={styles.info}>All audio is available offline.</p>
          <button className={styles.primaryBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Downloading audio</h2>

        <div className={styles.ringWrap}>
          <svg className={styles.ring} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-border)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R} fill="none"
              stroke="var(--color-brand-lime)" strokeWidth="8"
              strokeDasharray={C} strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              className={styles.ringFill}
            />
          </svg>
          <span className={styles.pct}>{pct}%</span>
        </div>

        <p className={styles.statusMain}>{progress.done} of {progress.total} phrases</p>
        <p className={styles.statusMeta}>
          {progress.done < progress.total ? `Estimated: ${mins} minute${mins !== 1 ? 's' : ''} left` : 'Finishing up…'}
        </p>

        {progress.currentTopic && (
          <>
            <p className={styles.currentLabel}>CURRENTLY DOWNLOADING</p>
            <p className={styles.currentName}>{progress.currentTopic}</p>
          </>
        )}

        <p className={styles.info}>You can keep using the app while this downloads.</p>

        <button className={styles.primaryBtn} onClick={handleKeepDownloading}>Keep downloading</button>
        <button className={styles.cancelBtn} onClick={handleCancel}>Cancel download</button>
      </div>
    </div>
  );
}
