// PhrasebookToast — spring-animated bottom toast shown when a phrase
// is saved to the user's phrasebook. Joyful but brief — out of the way fast.

import { useEffect } from 'react';
import styles from './PhrasebookToast.module.css';

/**
 * @param {{ phrase?: { cjk: string, english: string }, onDone: Function }} props
 */
export function PhrasebookToast({ phrase, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={styles.toast} onClick={onDone} role="status" aria-live="polite">
      <div className={styles.iconWrap}>
        <BookmarkIcon />
        <div className={styles.iconRipple} />
      </div>
      <div className={styles.text}>
        <p className={styles.label}>Saved to your phrasebook</p>
        {phrase?.cjk && <p className={styles.phrase} lang="yue">{phrase.cjk}</p>}
      </div>
      <div className={styles.sparkles} aria-hidden="true">
        <span className={styles.spark} />
        <span className={`${styles.spark} ${styles.spark2}`} />
        <span className={`${styles.spark} ${styles.spark3}`} />
      </div>
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
