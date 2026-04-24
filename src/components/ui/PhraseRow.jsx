import styles from './PhraseRow.module.css';

const SIZE_CLASSES = { sm: styles.sm, md: styles.md, lg: styles.lg };

export function PhraseRow({
  jyutping,
  english,
  chinese,
  role,
  score,
  isActive = false,
  onHeartToggle,
  saved = false,
  size = 'md',
  highlightedJyutping,
}) {
  const sizeClass = SIZE_CLASSES[size] ?? styles.md;

  const scorePillClass =
    score >= 85 ? styles.scoreExcellent :
    score >= 70 ? styles.scoreGood :
    styles.scoreFair;

  return (
    <div className={`${styles.row} ${sizeClass} ${isActive ? styles.active : ''}`}>
      <div className={styles.jyutping}>
        {highlightedJyutping ?? jyutping}
        {role && <span className={styles.role}> · {role}</span>}
      </div>
      {english && (
        <div className={styles.english}>"{english}"</div>
      )}
      {chinese && (
        <div className={styles.chinese}>{chinese}</div>
      )}
      <div className={styles.meta}>
        {score != null && (
          <span className={`${styles.scorePill} ${scorePillClass}`}>{score}</span>
        )}
        {onHeartToggle && (
          <button
            className={`${styles.heart} ${saved ? styles.heartSaved : ''}`}
            onClick={onHeartToggle}
            aria-label={saved ? 'Remove from library' : 'Save to library'}
          >
            {saved ? '♥' : '♡'}
          </button>
        )}
      </div>
    </div>
  );
}
