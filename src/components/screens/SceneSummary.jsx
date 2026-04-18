// src/components/screens/SceneSummary.jsx — Dialogue scene completion summary

import { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatTime } from '../../utils/formatters';
import { BulkSaveModal } from '../shared/BulkSaveModal';
import styles from './SceneSummary.module.css';

function getScoreColor(score) {
  if (score >= 90) return 'var(--color-score-excellent)';
  if (score >= 70) return 'var(--color-score-good)';
  if (score >= 50) return 'var(--color-score-fair)';
  return 'var(--color-score-poor)';
}

/**
 * @param {{ summary: Object, chatLog?: Array, sceneTitle?: string, onDone: Function, onReplay?: Function }} props
 */
export default function SceneSummary({ summary, chatLog, sceneTitle, onDone, onReplay }) {
  const { settings } = useAppContext();
  const [showBulkSave, setShowBulkSave] = useState(false);
  if (!summary) return null;

  // Collect user turns that have a phraseId for saving
  const savablePhrases = chatLog
    ?.filter(t => t.speaker === 'user' && t.chinese)
    .map(t => ({ id: t.phraseId || `scene-${Date.now()}-${Math.random()}`, chinese: t.chinese, english: t.english || '' })) || [];

  const firstName = (settings.name || '').split(' ')[0] || 'there';
  const userTurns = chatLog?.filter(t => t.speaker === 'user') || [];
  const scoredTurns = userTurns.filter(t => t.score != null);
  const avgScore = scoredTurns.length > 0
    ? Math.round(scoredTurns.reduce((acc, t) => acc + t.score, 0) / scoredTurns.length)
    : null;

  return (
    <div className={styles.screen}>
      <div className={styles.scrollArea}>
        {/* Icon */}
        <div className={styles.iconWrap}>
          <span className={styles.iconEmoji}>🗣️</span>
        </div>

        <h1 className={styles.title}>Scene complete!</h1>
        {sceneTitle && <p className={styles.sceneLabel}>{sceneTitle}</p>}
        <p className={styles.subtitle}>Well done, {firstName}</p>

        {/* Stats */}
        <div className={styles.statRow}>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{userTurns.length}</span>
            <span className={styles.statLabel}>turns</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{avgScore != null ? `${avgScore}%` : '—'}</span>
            <span className={styles.statLabel}>avg score</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{formatTime(summary.durationSeconds || 0)}</span>
            <span className={styles.statLabel}>time</span>
          </div>
        </div>

        {/* Streak */}
        {summary.streakCount > 0 && (
          <div className={styles.streakRow}>
            <span className={styles.streakFlame}>🔥</span>
            <span className={styles.streakText}>
              {summary.streakCount} day streak
            </span>
          </div>
        )}

        {/* Chat log replay */}
        {chatLog && chatLog.length > 0 && (
          <div className={styles.chatSection}>
            <h2 className={styles.sectionTitle}>YOUR TURNS</h2>
            <div className={styles.turnList}>
              {chatLog.map((turn, i) => {
                if (turn.speaker !== 'user') return null;
                return (
                  <div key={i} className={styles.turnRow}>
                    <div className={styles.turnText}>
                      <span className={styles.turnRoman}>{turn.romanization}</span>
                      <span className={styles.turnChinese} lang="yue">{turn.chinese}</span>
                      <span className={styles.turnEnglish}>{turn.english}</span>
                    </div>
                    {turn.score != null ? (
                      <span
                        className={styles.turnScore}
                        style={{ color: getScoreColor(turn.score) }}
                      >
                        {turn.score}%
                      </span>
                    ) : (
                      <span className={styles.turnSkipped}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {savablePhrases.length > 0 && (
            <button className={styles.saveAllBtn} onClick={() => setShowBulkSave(true)}>
              Save all {savablePhrases.length} phrase{savablePhrases.length !== 1 ? 's' : ''}
            </button>
          )}
          {onReplay && (
            <button className={styles.replayBtn} onClick={onReplay}>
              Try again
            </button>
          )}
          <button className={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>

      {showBulkSave && (
        <BulkSaveModal
          phrases={savablePhrases}
          sceneName={sceneTitle || 'Scene'}
          onClose={() => setShowBulkSave(false)}
          onSaved={(count) => {
            setShowBulkSave(false);
            // toast shown via parent if needed
          }}
        />
      )}
    </div>
  );
}
