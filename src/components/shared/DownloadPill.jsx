// src/components/shared/DownloadPill.jsx — Floating progress pill for the
// background audio download. Mounted once in MainLayout so progress stays
// visible on every screen after the download modal is closed.

import { useState, useEffect } from 'react';
import { subscribeAudioDownload, getAudioDownloadState } from '../../services/audioDownload';
import styles from './DownloadPill.module.css';

export function DownloadPill() {
  const [dl, setDl] = useState(getAudioDownloadState);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let timer;
    const unsubscribe = subscribeAudioDownload((s) => {
      setDl(s);
      clearTimeout(timer);
      if (s.status === 'complete') {
        // Show the completed state briefly, then hide
        timer = setTimeout(() => setHidden(true), 5000);
      } else {
        setHidden(false);
      }
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);

  if (dl.status === 'running') {
    const pct = dl.total > 0 ? Math.round((dl.done / dl.total) * 100) : 0;
    return (
      <div className={styles.pill} role="status">
        <span className={styles.spinner} />
        <span>Downloading audio · {pct}%</span>
      </div>
    );
  }

  if (dl.status === 'complete' && !hidden) {
    return (
      <div className={`${styles.pill} ${styles.done}`} role="status">
        <span>✓ Offline audio ready</span>
      </div>
    );
  }

  return null;
}
