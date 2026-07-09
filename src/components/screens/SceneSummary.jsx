// src/components/screens/SceneSummary.jsx — Dialogue scene completion summary

import { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatTime } from '../../utils/formatters';
import { getLibraryEntriesByScene, saveLibraryEntry } from '../../services/storage';
import { BulkSaveModal } from '../shared/BulkSaveModal';
import { RealLifeCelebration } from '../shared/RealLifeCelebration';
import styles from './SceneSummary.module.css';

function getScoreColor(score) {
  if (score >= 90) return 'var(--accent)';
  if (score >= 70) return '#C9A24A';
  if (score >= 50) return '#C8392B';
  return '#E84040';
}

/**
 * @param {{ summary: Object, chatLog?: Array, sceneTitle?: string, onDone: Function, onReplay?: Function, showToast?: Function }} props
 */
export default function SceneSummary({ summary, chatLog, sceneTitle, onDone, onReplay, showToast }) {
  const { settings } = useAppContext();
  const [showBulkSave, setShowBulkSave] = useState(false);
  const sceneId = summary?.sceneId ?? null;
  const [livedState, setLivedState] = useState(() => {
    if (!sceneId) return 'hidden';
    return localStorage.getItem(`lived_asked_${sceneId}`) ? 'hidden' : 'pending';
  });
  const [showRealLifeCelebration, setShowRealLifeCelebration] = useState(false);
  if (!summary) return null;

  // Collect user turns that have a phraseId for saving
  const savablePhrases = chatLog
    ?.filter(t => t.speaker === 'user' && t.chinese)
    .map(t => ({
      id: t.phraseId || `scene-${Date.now()}-${Math.random()}`,
      chinese: t.chinese, romanization: t.romanization || '', english: t.english || '',
    })) || [];

  // Best-scored turn, featured in the real-life celebration if the user confirms
  const bestPhrase = (() => {
    const scored = (chatLog ?? []).filter(t => t.speaker === 'user' && t.score != null);
    if (!scored.length) return null;
    const best = scored.reduce((a, b) => b.score > a.score ? b : a);
    return { cjk: best.chinese ?? '', english: best.english ?? '' };
  })();

  async function handleLivedIt() {
    if (!sceneId) return;
    localStorage.setItem(`lived_asked_${sceneId}`, '1');
    setShowRealLifeCelebration(true);
    const now = Date.now();
    try {
      const entries = await getLibraryEntriesByScene(sceneId);
      for (const e of entries) {
        await saveLibraryEntry({ ...e, lived_at: now });
      }
    } catch {}
  }

  function handleNotYet() {
    if (sceneId) localStorage.setItem(`lived_asked_${sceneId}`, '1');
    setLivedState('hidden');
  }

  const firstName = (settings.name || '').split(' ')[0] || 'there';
  const userTurns = chatLog?.filter(t => t.speaker === 'user') || [];
  const scoredTurns = userTurns.filter(t => t.score != null);
  const avgScore = scoredTurns.length > 0
    ? Math.round(scoredTurns.reduce((acc, t) => acc + t.score, 0) / scoredTurns.length)
    : null;

  return (
    <div className={styles.screen}>
      {showRealLifeCelebration && (
        <RealLifeCelebration
          phrase={bestPhrase}
          onDone={() => { setShowRealLifeCelebration(false); setLivedState('confirmed'); }}
        />
      )}
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

        {/* Lived it prompt */}
        {livedState === 'pending' && (
          <div className={styles.livedSection}>
            <p className={styles.livedQ}>Did you actually use any of these in the wild?</p>
            <div className={styles.livedBtns}>
              <button className={styles.livedNotYet} onClick={handleNotYet}>Not yet</button>
              <button className={styles.livedIt} onClick={handleLivedIt}>📍 I did it</button>
            </div>
          </div>
        )}
        {livedState === 'confirmed' && (
          <div className={styles.livedSection}>
            <p className={styles.livedConfirm}>📍 Marked. That's the real thing.</p>
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
            showToast?.(`${count} phrase${count !== 1 ? 's' : ''} saved to library`, 'success');
          }}
        />
      )}
    </div>
  );
}
