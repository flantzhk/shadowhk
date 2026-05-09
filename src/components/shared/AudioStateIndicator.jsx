// AudioStateIndicator — small visual glyph that reflects audio playback state.
// Used inside or alongside play buttons so users can tell loading from playing
// from error without needing a separate spinner element per screen.
//
// state: 'idle' | 'loading' | 'playing' | 'error'

import styles from './AudioStateIndicator.module.css';

export function AudioStateIndicator({ state }) {
  if (state === 'idle' || !state) return null;

  if (state === 'loading') {
    return (
      <span className={styles.root} aria-label="Loading audio" role="status">
        <span className={styles.spinner} />
      </span>
    );
  }

  if (state === 'playing') {
    return (
      <span className={styles.root} aria-label="Playing audio" role="status">
        <span className={styles.bars}>
          <span /><span /><span />
        </span>
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className={styles.root} aria-label="Audio error" role="status">
        <span className={styles.error}>⚠</span>
      </span>
    );
  }

  return null;
}

export default AudioStateIndicator;
