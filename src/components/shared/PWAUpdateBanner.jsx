// src/components/shared/PWAUpdateBanner.jsx
// Shows a sticky banner when a new service worker has activated.
// With registerType:'autoUpdate' + skipWaiting + clientsClaim, the SW takes
// over immediately; 'controllerchange' fires and we ask the user to reload.

import { useState, useEffect } from 'react';
import styles from './PWAUpdateBanner.module.css';

export function PWAUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // 'controllerchange' fires when a new SW has claimed this client
    const handleControllerChange = () => {
      setShow(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.text}>✨ ShadowSpeak updated</span>
      <button className={styles.reloadBtn} onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
