// src/components/screens/SessionSummary.jsx — End-of-session summary

import { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { ROUTES } from '../../utils/constants';
import { getLibraryEntriesByScene, saveLibraryEntry } from '../../services/storage';
import { RealLifeCelebration } from '../shared/RealLifeCelebration';
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
  const [showRealLifeCelebration, setShowRealLifeCelebration] = useState(false);

  // Pick the best-scored phrase to feature in the celebration
  const bestPhrase = (() => {
    const scored = (summary?.phraseResults ?? []).filter(r => r.score != null);
    if (!scored.length) return null;
    const best = scored.reduce((a, b) => b.score > a.score ? b : a);
    return { cjk: best.cjk ?? '', english: best.english ?? '' };
  })();

  if (!summary) return null;

  const firstName = (settings.name || '').split(' ')[0] || 'there';

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

  const avg = summary.averageScore !== null ? Math.round(summary.averageScore) : null;

  const scored = (summary.phraseResults ?? []).filter(r => r.score != null);
  const best = scored.length ? scored.reduce((a, b) => b.score > a.score ? b : a) : null;

  return (
    <div className={styles.screen}>
      {showRealLifeCelebration && (
        <RealLifeCelebration
          phrase={bestPhrase}
          onDone={() => { setShowRealLifeCelebration(false); setLivedState('confirmed'); }}
        />
      )}

      <div className={styles.scrollArea}>
        {/* Top close */}
        <div className={styles.topBar}>
          <button className={styles.closeBtn} onClick={onDone} aria-label="Close">×</button>
        </div>

        <div className={styles.content}>
          {/* Narrative headline */}
          <span className={styles.completeLabel}>SESSION COMPLETE</span>
          <h1 className={styles.headline}>
            {avg !== null
              ? <>You scored {avg}%{avg >= 85 ? ', strong session.' : avg >= 65 ? ', solid work.' : ', keep pushing.'}</>
              : <>Session done, {firstName}.</>
            }
          </h1>

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

          {/* Score */}
          {avg !== null && (
            <div className={styles.scoreSection}>
              <span className={styles.overallLabel}>OVERALL</span>
              <div className={styles.scoreDisplay}>
                <span className={styles.scoreNum}>{avg}</span>
                <span className={styles.scorePct}>%</span>
              </div>
            </div>
          )}

          {/* Per-line scores — real measurements, one bar per line spoken */}
          {scored.length > 0 && (
            <div className={styles.barsGrid}>
              {scored.map((r) => (
                <div key={r.phraseId}>
                  <span className={styles.barLabel}>{(r.romanization ?? '').split(' ').slice(0, 2).join(' ')} {r.score}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Best line */}
          {best && (
            <div className={styles.bestLine}>
              <span className={styles.bestLineLabel}>BEST LINE</span>
              <div className={styles.bestLineRow}>
                <span className={styles.bestLineText}>{best.romanization}</span>
                <span className={styles.bestLineScore}>{best.score}</span>
              </div>
            </div>
          )}

          {/* Phrase list */}
          {summary.phraseResults && summary.phraseResults.length > 0 && (
            <div className={styles.phraseList}>
              <span className={styles.phraseListLabel}>ALL PHRASES</span>
              {summary.phraseResults.map((r, i) => (
                <div key={i} className={styles.phraseRow}>
                  <span
                    className={styles.phraseDot}
                    style={{ background: r.score != null ? getScoreColor(r.score) : 'rgba(237,231,223,0.2)' }}
                  />
                  <span className={styles.phraseText}>{r.romanization || r.english || r.phraseId}</span>
                  <span className={styles.phraseScore}>{r.score != null ? r.score : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom CTAs */}
      <div className={styles.bottomCtas}>
        <button className={styles.practiceAgainBtn} onClick={() => { window.location.hash = `#${ROUTES.PRACTICE}`; onDone(); }}>
          Practice again
        </button>
        {sceneId && sceneId !== 'free-practice' && sceneId !== '__quick3__' && (
          <button className={styles.nextSceneBtn} onClick={() => { window.location.hash = `#${ROUTES.SCENES}`; onDone(); }}>
            Browse scenes →
          </button>
        )}
      </div>
    </div>
  );
}

