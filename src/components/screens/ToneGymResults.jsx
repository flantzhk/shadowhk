// src/components/screens/ToneGymResults.jsx — Tone Gym session summary with per-tone breakdown

import styles from './ToneGymResults.module.css';

const TONE_NAMES = {
  1: 'High level',
  2: 'Mid rising',
  3: 'Mid level',
  4: 'Low falling',
  5: 'Low rising',
  6: 'Low level',
};

function getToneColor(pct) {
  if (pct >= 80) return 'var(--color-brand-green)';
  if (pct >= 60) return 'var(--color-brand-lime)';
  if (pct >= 40) return '#E8A030';
  return '#D04040';
}

/**
 * Tone Gym specific results screen.
 * @param {{ summary: Object, onDone: Function, onPlayAgain: Function }} props
 */
export default function ToneGymResults({ summary, onDone, onPlayAgain }) {
  if (!summary) return null;

  const { correct = 0, total = 10, toneResults = [], streakCount = 0 } = summary;
  const accuracy = Math.round((correct / total) * 100);

  // Build per-tone accuracy map from toneResults array
  // toneResults: [{ tone: number, isCorrect: boolean }]
  const toneMap = {};
  for (let t = 1; t <= 6; t++) toneMap[t] = { correct: 0, total: 0 };
  for (const r of toneResults) {
    if (!toneMap[r.tone]) toneMap[r.tone] = { correct: 0, total: 0 };
    toneMap[r.tone].total++;
    if (r.isCorrect) toneMap[r.tone].correct++;
  }

  // Confusion pairs: tones where accuracy < 70%
  const struggles = Object.entries(toneMap)
    .filter(([, v]) => v.total > 0 && (v.correct / v.total) < 0.7)
    .map(([t]) => parseInt(t));

  // Pair confused tones together (simplified: first 2 struggles)
  const confusionPairs = [];
  for (let i = 0; i < struggles.length - 1; i += 2) {
    confusionPairs.push([struggles[i], struggles[i + 1]]);
  }
  if (struggles.length === 1) confusionPairs.push([struggles[0], null]);

  return (
    <div className={styles.screen}>
      <div className={styles.scrollArea}>
        {/* Icon */}
        <div className={styles.iconWrap}>
          <span className={styles.iconEmoji}>🎵</span>
        </div>

        <h1 className={styles.title}>Tone Gym complete</h1>

        {/* Stats */}
        <div className={styles.statRow}>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{correct}/{total}</span>
            <span className={styles.statLabel}>correct</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNum}>{accuracy}%</span>
            <span className={styles.statLabel}>accuracy</span>
          </div>
          {streakCount > 0 && (
            <div className={styles.statTile}>
              <span className={styles.statNum}>{streakCount}</span>
              <span className={styles.statLabel}>day streak</span>
            </div>
          )}
        </div>

        {/* Tone accuracy breakdown */}
        {toneResults.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>TONE ACCURACY</h2>
            <div className={styles.toneList}>
              {[1, 2, 3, 4, 5, 6].map(t => {
                const data = toneMap[t];
                if (!data || data.total === 0) return null;
                const pct = Math.round((data.correct / data.total) * 100);
                const color = getToneColor(pct);
                return (
                  <div key={t} className={styles.toneRow}>
                    <div className={styles.toneLabelCol}>
                      <span className={styles.toneName}>Tone {t}</span>
                      <span className={styles.toneDesc}>{TONE_NAMES[t]}</span>
                    </div>
                    <div className={styles.toneBar}>
                      <div className={styles.toneBarFill} style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className={styles.tonePct} style={{ color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confusion pairs */}
        {confusionPairs.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>YOU OFTEN CONFUSED</h2>
            <div className={styles.confusionList}>
              {confusionPairs.map(([a, b], i) => (
                <p key={i} className={styles.confusionItem}>
                  {b
                    ? `Tone ${a} (${TONE_NAMES[a]}) with Tone ${b} (${TONE_NAMES[b]})`
                    : `Tone ${a} (${TONE_NAMES[a]}) needs more practice`
                  }
                </p>
              ))}
            </div>

            <p className={styles.practiceNote}>Keep practicing these tones to build confidence.</p>
          </div>
        )}

        {/* Perfect score message */}
        {accuracy === 100 && (
          <div className={styles.perfectBadge}>
            <span className={styles.perfectEmoji}>⭐</span>
            <p className={styles.perfectText}>Perfect score! Your ear is sharp.</p>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.playAgainBtn} onClick={onPlayAgain}>
            Try again
          </button>
          <button className={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
