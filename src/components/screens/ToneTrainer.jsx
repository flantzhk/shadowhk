import { useState, useEffect } from 'react';
import styles from './ToneTrainer.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { Wave } from '../ui/Wave.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { scorePronunciation } from '../../services/api.js';
import { getLibraryEntries } from '../../services/storage.js';
import { updateAfterPractice } from '../../services/srs.js';

const REPS = 10;

export default function ToneTrainer({ onBack }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [phrase, setPhrase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rep, setRep] = useState(0);
  const [scores, setScores] = useState([]);
  const [currentScore, setCurrentScore] = useState(null);
  const [toneResult, setToneResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [phase, setPhase] = useState('ready'); // ready | record | scored | done

  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();

  useEffect(() => {
    getLibraryEntries(language)
      .then(entries => {
        // Pick an entry with the lowest recent score (hardest)
        const sorted = [...entries].sort((a, b) => (a.lastScore ?? 100) - (b.lastScore ?? 100));
        setPhrase(sorted[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [language]);

  async function handleRecord() {
    await startRecording();
    setPhase('record');
  }

  async function handleStop() {
    const blob = await stopRecording();
    if (!blob || !phrase) return;
    setIsScoring(true);
    setCurrentScore(null);
    setToneResult(null);
    try {
      const result = await scorePronunciation(blob, phrase.cjk, language);
      setCurrentScore(result.score);
      setToneResult(result);
      await updateAfterPractice(phrase.id, result.score);
      setScores(prev => [...prev, result.score]);
    } catch (_) {
      setScores(prev => [...prev, null]);
    } finally {
      setIsScoring(false);
      setPhase('scored');
    }
  }

  function handleNext() {
    const nextRep = rep + 1;
    if (nextRep >= REPS) {
      setPhase('done');
    } else {
      setRep(nextRep);
      setCurrentScore(null);
      setToneResult(null);
      setPhase('ready');
    }
  }

  const avgScore = scores.filter(s => s !== null).length > 0
    ? Math.round(scores.filter(s => s !== null).reduce((a, b) => a + b, 0) / scores.filter(s => s !== null).length)
    : null;

  const romanizationLabel = language === 'mandarin' ? 'Pīnyīn' : 'Jyutping';

  if (loading) return <div className={styles.screen}><div className={styles.loading} /></div>;

  if (!phrase) {
    return (
      <div className={styles.screen}>
        <div className={styles.empty}>
          <p>No phrases in your library yet.</p>
          <button className={styles.backBtn} onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className={styles.screen}>
        <div className={styles.doneBlock}>
          <p className={styles.doneTitle}>10 reps done</p>
          <p className={styles.donePhrase}>{phrase.cjk}</p>
          {avgScore !== null && (
            <p className={styles.avgScore} style={{ color: avgScore >= 80 ? 'var(--color-score-excellent)' : avgScore >= 60 ? 'var(--color-brand-green)' : 'var(--color-warning)' }}>
              Average: {avgScore}
            </p>
          )}
          <div className={styles.repDots}>
            {scores.map((s, i) => (
              <div
                key={i}
                className={styles.repDot}
                style={{ background: s === null ? 'var(--color-border)' : s >= 80 ? 'var(--color-brand-green)' : s >= 60 ? 'var(--color-warning)' : 'var(--color-error)' }}
              />
            ))}
          </div>
          <button className={styles.primaryBtn} onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className={styles.repCounter}>Rep {rep + 1} / {REPS}</div>
        <div className={styles.repDots}>
          {Array.from({ length: REPS }).map((_, i) => (
            <div
              key={i}
              className={styles.repDot}
              style={{
                background: i < rep
                  ? (scores[i] !== null && scores[i] >= 60 ? 'var(--color-brand-green)' : 'var(--color-error)')
                  : i === rep ? 'var(--color-brand-dark)'
                  : 'var(--color-border)'
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.phraseCard}>
        <span className={styles.romanizationLabel}>{romanizationLabel}</span>
        <p className={styles.romanization}>{phrase.romanization}</p>
        <p className={styles.cjk} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{phrase.cjk}</p>
        <p className={styles.english}>{phrase.english}</p>

        {phase === 'scored' && !isScoring && (
          <div className={styles.scoreBlock}>
            <span
              className={styles.scoreNum}
              style={{ color: currentScore === null ? 'var(--color-text-muted)' : currentScore >= 80 ? 'var(--color-score-excellent)' : currentScore >= 60 ? 'var(--color-brand-green)' : currentScore >= 40 ? 'var(--color-warning)' : 'var(--color-error)' }}
            >
              {currentScore !== null ? currentScore : '--'}
            </span>
            {toneResult?.toneContours && (
              <ToneTrack
                target={toneResult.toneContours.expected ?? []}
                user={toneResult.toneContours.actual ?? []}
                labels={phrase.romanization?.split(' ') ?? []}
              />
            )}
          </div>
        )}

        {isScoring && <div className={styles.scoringPulse} />}
      </div>

      <div className={styles.controls}>
        {(phase === 'ready') && (
          <button className={styles.micBtn} onMouseDown={handleRecord} onTouchStart={handleRecord}>
            <MicIcon />
            Hold to record
          </button>
        )}

        {phase === 'record' && (
          <div className={styles.recordControls}>
            <Wave active={isRecording} />
            {micError && <p className={styles.micError}>Mic not detected — check permissions</p>}
            <button className={styles.stopBtn} onMouseUp={handleStop} onTouchEnd={handleStop}>
              <StopIcon />
              Done
            </button>
          </div>
        )}

        {phase === 'scored' && !isScoring && (
          <div className={styles.scoredActions}>
            <button className={styles.retryBtn} onClick={() => setPhase('ready')}>
              Retry
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {rep + 1 >= REPS ? 'Finish' : 'Next rep'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="11" rx="3"/>
    <path d="M5 10a7 7 0 0014 0" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" strokeLinecap="round"/>
  </svg>
);
const StopIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);
