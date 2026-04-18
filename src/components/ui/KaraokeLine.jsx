import styles from './KaraokeLine.module.css';

/**
 * KaraokeLine — a single transcript line with past/now/future visual states.
 * @param {'past'|'now'|'future'} state
 * @param {string} cjk
 * @param {string} romanization
 */
export function KaraokeLine({ state = 'future', cjk, romanization }) {
  return (
    <div className={`${styles.line} ${styles[state] ?? ''}`}>
      <span className={styles.cjk}>{cjk}</span>
      {romanization && <span className={styles.romanization}>{romanization}</span>}
    </div>
  );
}
