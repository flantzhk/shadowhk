// src/components/cards/ScoreBadge.jsx

import { memo } from 'react';
import styles from './ScoreBadge.module.css';
import { SCORE_THRESHOLDS } from '../../utils/constants';

/**
 * Displays a pronunciation score as a colored badge.
 * @param {Object} props
 * @param {number|null} props.score - Score from 0-100, or null for pending
 * @param {'compact'|'full'} [props.variant='compact']
 */
const ScoreBadge = memo(function ScoreBadge({ score, variant = 'compact' }) {
  if (score === null) {
    return (
      <div className={`${styles.badge} ${styles.pending} ${styles[variant]}`}>
        <span className={styles.score}>...</span>
        {variant === 'full' && <span className={styles.label}>Pending</span>}
      </div>
    );
  }

  const level = score >= SCORE_THRESHOLDS.EXCELLENT ? 'excellent'
    : score >= SCORE_THRESHOLDS.GOOD ? 'good'
    : score >= SCORE_THRESHOLDS.FAIR ? 'fair'
    : 'needsWork';

  return (
    <div className={`${styles.badge} ${styles[level]} ${styles[variant]}`}>
      <span className={styles.score}>{score}</span>
      {variant === 'full' && (
        <span className={styles.label}>{LEVEL_LABELS[level]}</span>
      )}
    </div>
  );
});

const LEVEL_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needsWork: 'Needs work',
};

export { ScoreBadge };
