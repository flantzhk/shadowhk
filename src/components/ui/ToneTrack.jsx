import styles from './ToneTrack.module.css';

/**
 * ToneTrack — bar chart comparing target tone contour vs. user contour.
 * @param {number[]} target - array of pitch values (0–100) per syllable
 * @param {number[]} user   - array of pitch values (0–100) per syllable
 * @param {string[]} labels - syllable labels (romanization)
 */
export function ToneTrack({ target = [], user = [], labels = [] }) {
  const maxLen = Math.max(target.length, user.length);
  if (maxLen === 0) return null;

  const maxVal = Math.max(...target, ...user, 1);

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span className={styles.legendTarget}>Target</span>
        <span className={styles.legendUser}>You</span>
      </div>
      <div className={styles.bars}>
        {Array.from({ length: maxLen }).map((_, i) => {
          const t = target[i] ?? 0;
          const u = user[i] ?? 0;
          return (
            <div key={i} className={styles.pair}>
              <div
                className={`${styles.bar} ${styles.barTarget}`}
                style={{ height: `${(t / maxVal) * 100}%` }}
              />
              <div
                className={`${styles.bar} ${styles.barUser}`}
                style={{ height: `${(u / maxVal) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      {labels.length > 0 && (
        <div className={styles.syllables}>
          {labels.map((l, i) => (
            <span key={i} className={styles.syllable}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
