// src/components/screens/SessionSummary.jsx — End-of-session summary

import { useAppContext } from '../../contexts/AppContext';
import { formatTime } from '../../utils/formatters';
import { ROUTES } from '../../utils/constants';
import styles from './SessionSummary.module.css';

function getScoreColor(score) {
  if (score >= 90) return 'var(--color-score-excellent)';
  if (score >= 70) return 'var(--color-score-good)';
  if (score >= 50) return 'var(--color-score-fair)';
  return 'var(--color-score-poor)';
}

/**
 * Session completion summary screen.
 * @param {{ summary: Object, onDone: () => void }} props
 */
export default function SessionSummary({ summary, onDone }) {
  const { settings } = useAppContext();

  if (!summary) return null;

  const firstName = (settings.name || '').split(' ')[0] || 'there';

  return (
    <div className={styles.screen}>
      <div className={styles.scrollArea}>
        {/* Success icon */}
        <div className={styles.iconWrap}>
          <div className={styles.successCircle}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>Session complete</h1>
        <p className={styles.subtitle}>Great work, {firstName}</p>

        {/* 3 stat tiles */}
        <div className={styles.statRow}>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{summary.phrasesAttempted}</span>
            <span className={styles.statLabel}>phrases</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNum}>
              {summary.averageScore !== null ? Math.round(summary.averageScore) : '—'}
            </span>
            <span className={styles.statLabel}>avg score</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{formatTime(summary.durationSeconds)}</span>
            <span className={styles.statLabel}>time</span>
          </div>
        </div>

        {/* Streak update */}
        {summary.streakCount > 0 && (
          <div className={styles.streakRow}>
            <span className={styles.streakFlame} />
            <span className={styles.streakText}>
              Streak: {summary.streakCount} days <span className={styles.streakPlus}>+1 today</span>
            </span>
          </div>
        )}

        {/* Phrase breakdown */}
        {summary.phraseResults && summary.phraseResults.length > 0 && (
          <>
            <div className={styles.divider} />
            <span className={styles.sectionLabel}>PHRASES PRACTICED</span>
            <div className={styles.phraseList}>
              {summary.phraseResults.map((r, i) => (
                <div key={i} className={styles.phraseRow}>
                  <span
                    className={styles.phraseDot}
                    style={{ background: r.score != null ? getScoreColor(r.score) : 'var(--color-text-muted)' }}
                  />
                  <span className={styles.phraseText}>{r.romanization || r.english || r.phraseId}</span>
                  <span
                    className={styles.phraseScore}
                    style={{ color: r.score != null ? getScoreColor(r.score) : 'var(--color-text-muted)' }}
                  >
                    {r.score != null ? r.score : '—'}
                    {r.score != null && r.score >= 90 && <span className={styles.star}> ★</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className={styles.actions}>
          <button className={styles.practiceMoreBtn} onClick={() => {
            window.location.hash = `#${ROUTES.PRACTICE}`;
            onDone();
          }}>
            Practice more
          </button>
          <button className={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
