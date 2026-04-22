import styles from './KaraokeLine.module.css';

/**
 * KaraokeLine — a single transcript line with past/now/future visual states.
 * @param {'past'|'now'|'future'} state
 * @param {string} romanization
 * @param {string} english
 * @param {string} cjk
 */
export function KaraokeLine({ state = 'future', romanization, english, cjk }) {
  return (
    <div className={`${styles.line} ${styles[state] ?? ''}`}>
      {romanization && <span className={styles.romanization}>{romanization}</span>}
      {english && <span className={styles.english}>{english}</span>}
      {cjk && <span className={styles.cjk}>{cjk}</span>}
    </div>
  );
}
