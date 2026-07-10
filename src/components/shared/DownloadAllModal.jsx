// src/components/shared/DownloadAllModal.jsx — Item 17: Download All Audio Modal

import { useState, useEffect } from 'react';
import { startAudioDownload, cancelAudioDownload, subscribeAudioDownload, getAudioDownloadState } from '../../services/audioDownload';
import styles from './DownloadAllModal.module.css';

/**
 * Full download-all modal with SVG progress ring. The download itself lives in
 * the audioDownload service, so closing this modal leaves it running and the
 * global DownloadPill keeps showing progress.
 * @param {{ language: string, onClose: Function }} props
 */
export default function DownloadAllModal({ language, onClose }) {
  const [dl, setDl] = useState(getAudioDownloadState);

  useEffect(() => {
    const unsubscribe = subscribeAudioDownload(setDl);
    startAudioDownload(language);
    return unsubscribe;
  }, [language]);

  const handleCancel = () => {
    cancelAudioDownload();
    onClose();
  };

  const handleKeepDownloading = () => {
    // Close modal; the download continues and the DownloadPill shows progress
    onClose('background');
  };

  const pct = dl.total > 0 ? Math.round((dl.done / dl.total) * 100) : 0;

  // Estimate remaining time
  const elapsed = (dl.updatedAt - dl.startedAt) / 1000;
  const rate = dl.done > 0 ? elapsed / dl.done : 0;
  const remaining = Math.max(0, Math.round(rate * (dl.total - dl.done)));
  const mins = Math.ceil(remaining / 60);

  // SVG ring params
  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  if (dl.status === 'complete') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.doneEmoji}>✓</div>
          <h2 className={styles.title}>Download complete</h2>
          <p className={styles.statusMain}>{dl.total} recordings checked</p>
          <p className={styles.info}>Everything published so far is on this device. Airplane mode away.</p>
          <button className={styles.primaryBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  if (dl.status === 'error') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <h2 className={styles.title}>Download interrupted</h2>
          <p className={styles.info}>Check your connection and try again. Anything already downloaded is saved.</p>
          <button className={styles.primaryBtn} onClick={() => startAudioDownload(language)}>Try again</button>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
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

        <p className={styles.statusMain}>{dl.done} of {dl.total} recordings</p>
        <p className={styles.statusMeta}>
          {dl.done < dl.total ? `Estimated: ${mins} minute${mins !== 1 ? 's' : ''} left` : 'Finishing up…'}
        </p>

        {dl.currentTopic && (
          <>
            <p className={styles.currentLabel}>CURRENTLY DOWNLOADING</p>
            <p className={styles.currentName}>{dl.currentTopic}</p>
          </>
        )}

        <p className={styles.info}>You can keep using the app while this downloads.</p>

        <button className={styles.primaryBtn} onClick={handleKeepDownloading}>Keep downloading</button>
        <button className={styles.cancelBtn} onClick={handleCancel}>Cancel download</button>
      </div>
    </div>
  );
}
