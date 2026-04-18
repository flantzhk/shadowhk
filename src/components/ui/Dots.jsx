import styles from './Dots.module.css';

/**
 * Dots — phrase progress indicator for session screens.
 * @param {number} total       - total phrases in session
 * @param {number} completed   - how many are done
 * @param {number} current     - 0-based index of active phrase
 */
export function Dots({ total = 0, completed = 0, current = 0 }) {
  return (
    <div className={styles.dots} aria-label={`Phrase ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        let cls = styles.dotFuture;
        if (i < completed) cls = styles.dotCompleted;
        else if (i === current) cls = styles.dotCurrent;
        return <div key={i} className={`${styles.dot} ${cls}`} />;
      })}
    </div>
  );
}
