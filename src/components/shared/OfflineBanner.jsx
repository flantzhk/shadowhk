// src/components/shared/OfflineBanner.jsx — Items 38, 37

import { useState, useEffect } from 'react';
import styles from './OfflineBanner.module.css';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
        </svg>
      </span>
      <span className={styles.text}>You're offline. Using cached content.</span>
    </div>
  );
}

export function UpdateBanner({ onDismiss, onUpdate }) {
  return (
    <div className={styles.updateBanner}>
      <span className={styles.updateText}>New version available</span>
      <button className={styles.updateBtn} onClick={onUpdate}>Update</button>
      <button className={styles.dismissBtn} onClick={onDismiss}>✕</button>
    </div>
  );
}
