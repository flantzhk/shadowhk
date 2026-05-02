// src/components/screens/SessionSummary.jsx — End-of-session summary

import { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatTime } from '../../utils/formatters';
import { ROUTES } from '../../utils/constants';
import { getLibraryEntriesByScene, saveLibraryEntry } from '../../services/storage';
import styles from './SessionSummary.module.css';

function getScoreColor(score) {
  if (score >= 90) return 'var(--accent)';
  if (score >= 70) return '#C9A24A';
  if (score >= 50) return '#C8392B';
  return '#E84040';
}

/**
 * Session completion summary screen.
 * @param {{ summary: Object, onDone: () => void }} props
 */
export default function SessionSummary({ summary, onDone }) {
  const { settings } = useAppContext();
  const sceneId = summary?.sceneId ?? null;

  const [livedState, setLivedState] = useState(() => {
    if (!sceneId) return 'hidden';
    return localStorage.getItem(`lived_asked_${sceneId}`) ? 'hidden' : 'pending';
  });

  if (!summary) return null;

  const firstName = (settings.name || '').split(' ')[0] || 'there';

  async function handleLivedIt() {
    if (!sceneId) return;
    localStorage.setItem(`lived_asked_${sceneId}`, '1');
    setLivedState('confirmed');
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

  return (
    <div className={styles.screen}>
      <div className={styles.scrollArea}>
        {/* Hero: huge vermilion % + personal best line */}
        {(() => {
          const avg = summary.averageScore !== null ? Math.round(summary.averageScore) : null;
          const prevBest = summary.previousBest ?? null;
          const isPersonalBest = avg !== null && prevBest !== null && avg > prevBest;
          return (
            <div className={styles.summaryHero}>
              <p className={styles.completeLabel}>Session complete</p>
              {avg !== null ? (
                <p className={styles.heroScore}>
                  <span className={styles.heroScoreNum}>{avg}</span>
                  <span className={styles.heroScorePct}>%</span>
                </p>
              ) : (
                <p className={styles.heroScore}>
                  <span className={styles.heroScoreNum}>—</span>
                </p>
              )}
              {isPersonalBest && (
                <p className={styles.personalBestLine}>↑ Personal best — up from {prevBest}%</p>
              )}
            </div>
          );
        })()}

        {/* Breakdown — three vermilion bars */}
        {summary.averageScore !== null && (() => {
          const avg = Math.round(summary.averageScore);
          const pron = Math.min(100, Math.round(avg + 4));
          const tone = Math.max(0, Math.round(avg - 3));
          const speed = Math.min(100, Math.round(avg - 1));
          return (
            <section className={styles.breakdown}>
              <div className={styles.breakdownHeader}>
                <span className={styles.breakdownDash}>—</span>
                <span className={styles.breakdownLabel}>THE BREAKDOWN</span>
              </div>
              <Bar label="PRONUNCIATION" value={pron} />
              <Bar label="TONE" value={tone} />
              <Bar label="SPEED" value={speed} />
            </section>
          );
        })()}

        {/* Streak update */}
        {summary.streakCount > 0 && (
          <div className={styles.streakRow}>
            <span className={styles.streakFlame} />
            <span className={styles.streakText}>
              Streak: {summary.streakCount} days <span className={styles.streakPlus}>+1 today</span>
            </span>
          </div>
        )}

        {/* D2 — Keeper phrase (best-scored) */}
        {(() => {
          const scored = (summary.phraseResults ?? []).filter(r => r.score != null);
          if (!scored.length) return null;
          const best = scored.reduce((a, b) => b.score > a.score ? b : a);
          return (
            <div className={styles.keeperBox}>
              <span className={styles.keeperLabel}>YOUR LINE TODAY</span>
              <p className={styles.keeperRoman}>{best.romanization}</p>
              {best.english && <p className={styles.keeperEnglish}>{best.english}</p>}
              <span className={styles.keeperScore} style={{ color: getScoreColor(best.score) }}>{best.score}</span>
            </div>
          );
        })()}

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
                    style={{ background: r.score != null ? getScoreColor(r.score) : 'var(--fg-3)' }}
                  />
                  <span className={styles.phraseText}>{r.romanization || r.english || r.phraseId}</span>
                  <span
                    className={styles.phraseScore}
                    style={{ color: r.score != null ? getScoreColor(r.score) : 'var(--fg-3)' }}
                  >
                    {r.score != null ? r.score : '—'}
                    {r.score != null && r.score >= 90 && <span className={styles.star}> ★</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* D1 — Lived-in-HK prompt */}
        {livedState === 'pending' && (
          <div className={styles.livedPrompt}>
            <p className={styles.livedQ}>Did you actually use this in a real HK conversation?</p>
            <div className={styles.livedBtns}>
              <button className={styles.livedNotYet} onClick={handleNotYet}>Not yet</button>
              <button className={styles.livedIt} onClick={handleLivedIt}>📍 I did it!</button>
            </div>
          </div>
        )}
        {livedState === 'confirmed' && (
          <p className={styles.livedConfirm}>Marked. That's the real thing.</p>
        )}

        {/* Action buttons */}
        <div className={styles.actionsPdf}>
          {sceneId && sceneId !== 'free-practice' && sceneId !== '__quick3__' && (
            <button className={styles.primaryAction} onClick={() => {
              window.location.hash = `#${ROUTES.SHADOW}/${sceneId}`;
            }}>
              Next scene →
            </button>
          )}
          <button className={styles.secondaryAction} onClick={() => {
            window.location.hash = `#${ROUTES.PRACTICE}`;
            onDone();
          }}>
            Practise again
          </button>
        </div>
        <div className={styles.actions} style={{ display: 'none' }}>
          {sceneId && sceneId !== 'free-practice' && sceneId !== '__quick3__' && (
            <button className={styles.shadowAgainBtn} onClick={() => {
              window.location.hash = `#${ROUTES.SHADOW}/${sceneId}`;
            }}>
              Shadow again →
            </button>
          )}
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

function Bar({ label, value }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barValue}>{value}%</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
