// src/components/screens/DayDetailScreen.jsx — Sessions for a specific day

import { useState, useEffect } from 'react';
import { getSessionsByDate } from '../../services/storage';
import { formatTime } from '../../utils/formatters';
import styles from './DayDetailScreen.module.css';

const MODE_LABELS = {
  'shadow-session': 'Shadow Session',
  'prompt-drill': 'Prompt Drill',
  'speed-run': 'Speed Run',
  'tone-gym': 'Tone Gym',
  'dialogue': 'Dialogue Scene',
};

const MODE_ICONS = {
  'shadow-session': '🎤',
  'prompt-drill': '💬',
  'speed-run': '⚡',
  'tone-gym': '🎵',
  'dialogue': '🗣️',
};

/**
 * @param {{ date: string, onBack: Function }} props
 */
export default function DayDetailScreen({ date, onBack }) {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    if (!date) return;
    getSessionsByDate(date).then(setSessions);
  }, [date]);

  const formatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '';

  const totalTime = sessions?.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) ?? 0;
  const totalPhrases = sessions?.reduce((acc, s) => acc + (s.phrasesAttempted || 0), 0) ?? 0;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.title}>{formatted}</h1>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {sessions === null ? (
        <div className={styles.loading}>Loading...</div>
      ) : sessions.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyTitle}>No sessions</p>
          <p className={styles.emptyText}>You didn't practice on this day.</p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className={styles.summaryRow}>
            <div className={styles.summaryTile}>
              <span className={styles.summaryNum}>{sessions.length}</span>
              <span className={styles.summaryLabel}>{sessions.length === 1 ? 'session' : 'sessions'}</span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryNum}>{formatTime(totalTime)}</span>
              <span className={styles.summaryLabel}>practiced</span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryNum}>{totalPhrases}</span>
              <span className={styles.summaryLabel}>phrases</span>
            </div>
          </div>

          {/* Session list */}
          <div className={styles.sessionList}>
            {sessions.map((session, i) => {
              const startTime = session.startedAt
                ? new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : null;
              const modeLabel = MODE_LABELS[session.mode] || session.mode || 'Session';
              const modeIcon = MODE_ICONS[session.mode] || '📖';

              return (
                <div key={session.id || i} className={styles.sessionCard}>
                  <div className={styles.sessionIconWrap}>
                    <span className={styles.sessionIcon}>{modeIcon}</span>
                  </div>
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionMode}>{modeLabel}</span>
                    <div className={styles.sessionMeta}>
                      {startTime && <span className={styles.sessionTime}>{startTime}</span>}
                      <span className={styles.sessionDot}>·</span>
                      <span className={styles.sessionDuration}>{formatTime(session.durationSeconds || 0)}</span>
                      {session.phrasesAttempted > 0 && (
                        <>
                          <span className={styles.sessionDot}>·</span>
                          <span className={styles.sessionPhrases}>{session.phrasesAttempted} phrases</span>
                        </>
                      )}
                    </div>
                  </div>
                  {session.averageScore != null && (
                    <div className={styles.sessionScore}>
                      <span className={styles.scoreNum}>{Math.round(session.averageScore)}</span>
                      <span className={styles.scorePct}>%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Phrase breakdown (if any session has results) */}
          {sessions.some(s => s.phraseResults?.length > 0) && (
            <div className={styles.phraseSection}>
              <h2 className={styles.sectionTitle}>Phrases Practiced</h2>
              <div className={styles.phraseList}>
                {sessions.flatMap(s => s.phraseResults || []).map((r, i) => (
                  <div key={i} className={styles.phraseRow}>
                    <span className={styles.phraseName}>{r.romanization || r.english || r.phraseId}</span>
                    {r.score != null && (
                      <span
                        className={styles.phraseScore}
                        style={{ color: r.score >= 90 ? 'var(--color-score-excellent)' : r.score >= 70 ? 'var(--color-score-good)' : 'var(--color-score-fair)' }}
                      >
                        {r.score}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
