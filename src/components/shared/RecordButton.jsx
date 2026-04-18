// src/components/shared/RecordButton.jsx — Pulsing mic with countdown

import { useState, useEffect, useRef } from 'react';
import { RECORDING_MAX_SECONDS } from '../../utils/constants';
import styles from './RecordButton.module.css';

/**
 * Recording button with pulsing animation and countdown.
 * @param {{ isRecording: boolean, onStart: () => void, onStop: () => void, error: string|null }} props
 */
function RecordButton({ isRecording, onStart, onStop, error }) {
  const [countdown, setCountdown] = useState(RECORDING_MAX_SECONDS);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      setCountdown(RECORDING_MAX_SECONDS);
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRecording]);

  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${isRecording ? styles.recording : ''}`}
        onClick={isRecording ? onStop : onStart}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <MicIcon />
      </button>

      {isRecording && (
        <div className={styles.indicator}>
          <span className={styles.dot} />
          <span className={styles.text}>Recording... {countdown}s</span>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export { RecordButton };
