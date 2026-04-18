// src/components/shared/MicPermission.jsx — Mic permission explanation + denied states

import { useState, useCallback } from 'react';
import styles from './MicPermission.module.css';

/**
 * Mic permission explanation screen.
 * Shows before requesting browser mic permission.
 * @param {{ onAllow: () => void, onDismiss: () => void }} props
 */
export function MicPermissionExplain({ onAllow, onDismiss }) {
  const [requesting, setRequesting] = useState(false);

  const handleAllow = useCallback(async () => {
    setRequesting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      onAllow();
    } catch {
      onDismiss(); // will show denied state
    }
  }, [onAllow, onDismiss]);

  return (
    <div className={styles.screen}>
      <button className={styles.closeBtn} onClick={onDismiss} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className={styles.iconContainer}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-dark)" strokeWidth="2.5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>

      <h1 className={styles.title}>Microphone access</h1>

      <p className={styles.body}>
        ShadowSpeak needs your microphone to score your pronunciation and give you real feedback.
      </p>

      <ul className={styles.bullets}>
        <li className={styles.bullet}>
          <span className={styles.bulletDot} />
          <span>Recordings are scored instantly</span>
        </li>
        <li className={styles.bullet}>
          <span className={styles.bulletDot} />
          <span>Audio is never stored on our servers</span>
        </li>
        <li className={styles.bullet}>
          <span className={styles.bulletDot} />
          <span>You can disable this anytime in Settings</span>
        </li>
      </ul>

      <button className={styles.primaryBtn} onClick={handleAllow} disabled={requesting}>
        {requesting ? 'Requesting...' : 'Allow microphone'}
      </button>
      <button className={styles.secondaryBtn} onClick={onDismiss}>
        Not now
      </button>
    </div>
  );
}

/**
 * Mic permission denied state.
 * Shows when user has blocked mic access.
 * @param {{ onDismiss: () => void }} props
 */
export function MicPermissionDenied({ onDismiss }) {
  return (
    <div className={styles.screen}>
      <button className={styles.closeBtn} onClick={onDismiss} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className={styles.iconContainerDenied}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2.5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
        <div className={styles.deniedBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>

      <h1 className={styles.title}>Microphone blocked</h1>

      <p className={styles.body}>
        ShadowSpeak can't access your microphone. You need to enable it to score your pronunciation.
      </p>

      <span className={styles.sectionLabel}>HOW TO ENABLE:</span>

      <div className={styles.steps}>
        <div className={styles.stepCard}><strong>1.</strong> Open device Settings</div>
        <div className={styles.stepCard}><strong>2.</strong> Find ShadowSpeak</div>
        <div className={styles.stepCard}><strong>3.</strong> Turn on Microphone</div>
      </div>

      <button className={styles.primaryBtn} onClick={() => {
        // Try to open settings (works on some mobile browsers)
        window.open('app-settings:', '_self');
      }}>
        Open Settings
      </button>
      <button className={styles.secondaryBtn} onClick={onDismiss}>
        Skip for now
      </button>
    </div>
  );
}
