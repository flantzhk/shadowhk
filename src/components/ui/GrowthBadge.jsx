import styles from './GrowthBadge.module.css';

const LABELS = {
  new: 'New',
  growing: 'Growing',
  strong: 'Strong',
  mastered: '⭐ Mastered',
};

export function GrowthBadge({ state = 'new' }) {
  return (
    <span className={`${styles.badge} ${styles[state] || styles.new}`}>
      {LABELS[state] ?? state}
    </span>
  );
}
