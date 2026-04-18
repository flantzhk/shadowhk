import styles from './SceneCard.module.css';

const STATUS_CLASS = {
  fresh: styles.statusFresh,
  practiced: styles.statusPracticed,
  lived: styles.statusLived,
};

const STATUS_LABEL = {
  fresh: 'New',
  practiced: '✓ Practised',
  lived: '📍 Lived',
};

export function SceneCard({ emoji, title, phraseCount, duration, status = 'fresh', onClick }) {
  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <span className={`${styles.statusBadge} ${STATUS_CLASS[status] ?? styles.statusFresh}`}>
        {STATUS_LABEL[status] ?? status}
      </span>
      <span className={styles.emoji}>{emoji}</span>
      <span className={styles.title}>{title}</span>
      <div className={styles.meta}>
        {phraseCount != null && <span>{phraseCount} phrases</span>}
        {phraseCount != null && duration != null && <span className={styles.dot} />}
        {duration != null && <span>{duration} min</span>}
      </div>
    </div>
  );
}
