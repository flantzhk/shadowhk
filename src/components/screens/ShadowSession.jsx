import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../contexts/AudioContext.jsx';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { updateAfterPractice } from '../../services/srs.js';
import { saveSession, addToQueue } from '../../services/storage.js';
import { scorePronunciation } from '../../services/api.js';
import { isAuthenticated } from '../../services/auth.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { blobToBase64 } from '../../services/offlineManager.js';
import { getSceneById, getYouLines } from '../../services/sceneLoader.js';
import { buildPhraseQueueFromScene } from '../../services/lessonBuilder.js';
import { Dots } from '../ui/Dots.jsx';
import { KaraokeLine } from '../ui/KaraokeLine.jsx';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { Wave } from '../ui/Wave.jsx';
import { PostIt } from '../ui/PostIt.jsx';
import { SCORE_THRESHOLDS } from '../../utils/constants.js';
import styles from './ShadowSession.module.css';

const STEPS = ['Listen', 'Say it', 'Score'];
const SPEEDS = [0.75, 1, 1.25];

export default function ShadowSession({ sceneId, onBack, onComplete }) {
  const { settings } = useAppContext();
  const audio = useAudio();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();

  const [scene, setScene] = useState(null);
  const [youLines, setYouLines] = useState([]);
  const [allLines, setAllLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);

  // phase: ready | listen | record | scored
  const [phase, setPhase] = useState('ready');
  const [activeStep, setActiveStep] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [currentScore, setCurrentScore] = useState(null);
  const [toneResult, setToneResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [showPostIt, setShowPostIt] = useState(false);

  const language = settings?.currentLanguage ?? 'cantonese';
  const romanizationLabel = language === 'mandarin' ? 'Pīnyīn' : 'Jyutping';

  useEffect(() => {
    if (!sceneId) { setLoading(false); return; }
    getSceneById(sceneId)
      .then(s => {
        setScene(s);
        setYouLines(getYouLines(s));
        setAllLines(s.lines ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sceneId]);

  const currentYouLine = youLines[currentLineIndex] ?? null;
  const totalYou = youLines.length;

  // Find where in allLines the current youLine is to drive KaraokeLine states
  const currentAllIndex = currentYouLine
    ? allLines.findIndex(l => l.id === currentYouLine.id)
    : -1;

  const handleStart = useCallback(async () => {
    if (!currentYouLine) return;
    setPhase('listen');
    setActiveStep(0);
    audio.prime();
    try {
      await audio.loadQueue([currentYouLine], language, speed === 1 ? 'natural' : speed < 1 ? 'slow' : 'fast');
      await audio.play();
    } catch (_) {}
  }, [audio, currentYouLine, language, speed]);

  const handleRecord = useCallback(async () => {
    audio.pause();
    setActiveStep(1);
    setPhase('record');
    await startRecording();
  }, [audio, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob || !currentYouLine) return;

    setPhase('scored');
    setActiveStep(2);
    setIsScoring(true);
    setCurrentScore(null);
    setToneResult(null);

    if (isOnline && isAuthenticated()) {
      try {
        const result = await scorePronunciation(blob, currentYouLine.cjk, language);
        setCurrentScore(result.score);
        setToneResult(result);
        await updateAfterPractice(currentYouLine.id, result.score);
        setResults(prev => [...prev, { phraseId: currentYouLine.id, score: result.score, romanization: currentYouLine.romanization }]);
        if (result.score >= SCORE_THRESHOLDS.EXCELLENT && scene?.culturalFact) {
          setShowPostIt(true);
        }
      } catch (_) {
        setCurrentScore(null);
        setResults(prev => [...prev, { phraseId: currentYouLine.id, score: null, romanization: currentYouLine.romanization }]);
      }
    } else {
      if (blob) {
        try {
          const b64 = await blobToBase64(blob);
          await addToQueue('score-pronunciation', { audioBase64: b64, expectedText: currentYouLine.cjk, language, phraseId: currentYouLine.id });
        } catch (_) {}
      }
      setResults(prev => [...prev, { phraseId: currentYouLine.id, score: null, romanization: currentYouLine.romanization }]);
    }
    setIsScoring(false);
  }, [stopRecording, currentYouLine, language, isOnline, scene]);

  const handleNext = useCallback(async () => {
    setShowPostIt(false);
    const nextIndex = currentLineIndex + 1;
    if (nextIndex < totalYou) {
      setCurrentLineIndex(nextIndex);
      setCompletedCount(nextIndex);
      setCurrentScore(null);
      setToneResult(null);
      setPhase('listen');
      setActiveStep(0);
    } else {
      await finishSession();
    }
  }, [currentLineIndex, totalYou]);

  const finishSession = useCallback(async () => {
    audio.setAutoAdvance(true);
    audio.pause();
    try {
      const dur = Math.round((Date.now() - sessionStart) / 1000);
      const streakResult = await updateStreak();
      const scores = results.filter(r => r.score !== null).map(r => r.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      await saveSession({
        id: crypto.randomUUID(),
        date: getTodayString(),
        startedAt: sessionStart,
        completedAt: Date.now(),
        durationSeconds: dur,
        mode: 'shadow',
        sceneId: sceneId ?? null,
        phrasesAttempted: results.length,
        phrasesMastered: results.filter(r => r.score !== null && r.score >= SCORE_THRESHOLDS.EXCELLENT).length,
        averageScore: avg,
        phraseResults: results,
      });
      onComplete?.({ sceneId, phrasesAttempted: results.length, averageScore: avg, streakCount: streakResult?.count ?? 0 });
    } catch (_) {
      onComplete?.({ sceneId, phrasesAttempted: results.length, averageScore: null, streakCount: 0 });
    }
  }, [audio, sessionStart, results, sceneId, onComplete]);

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.loadingPulse} />
      </div>
    );
  }

  if (!scene || youLines.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.empty}>
          <p>Scene not found or has no phrases to practice.</p>
          <button className={styles.backBtn} onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  const scoreColor = currentScore === null ? undefined
    : currentScore >= 80 ? 'var(--color-score-excellent)'
    : currentScore >= 60 ? 'var(--color-brand-green)'
    : currentScore >= 40 ? 'var(--color-warning)'
    : 'var(--color-error)';

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit session">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <StepHeader activeStep={activeStep} />
        <div className={styles.speedToggle}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Dots progress */}
      <div className={styles.dotsRow}>
        <Dots total={totalYou} completed={completedCount} current={currentLineIndex} />
      </div>

      {/* Phrase card */}
      <div className={styles.phraseCard}>
        <span className={styles.romanizationLabel}>{romanizationLabel}</span>
        <p className={styles.romanization}>{currentYouLine?.romanization}</p>
        <p className={styles.cjk} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{currentYouLine?.cjk}</p>
        {settings?.showEnglish !== false && (
          <p className={styles.english}>{currentYouLine?.english}</p>
        )}

        {/* Inline score reveal */}
        {phase === 'scored' && (
          <div className={styles.scoreReveal}>
            {isScoring ? (
              <div className={styles.scoringPulse} />
            ) : (
              <div className={styles.scoreBlock}>
                <span className={styles.scoreNumber} style={{ color: scoreColor }}>
                  {currentScore !== null ? currentScore : '--'}
                </span>
                {toneResult?.toneContours && (
                  <div className={styles.toneTrackWrap}>
                    <ToneTrack
                      target={toneResult.toneContours.expected ?? []}
                      user={toneResult.toneContours.actual ?? []}
                      labels={currentYouLine?.romanization?.split(' ') ?? []}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PostIt cultural fact */}
        {showPostIt && scene?.culturalFact && (
          <div className={styles.postItWrap}>
            <PostIt text={scene.culturalFact} />
          </div>
        )}
      </div>

      {/* Karaoke transcript */}
      <div className={styles.transcript}>
        {allLines.map((line, i) => (
          <KaraokeLine
            key={line.id}
            cjk={line.cjk}
            romanization={line.romanization}
            state={i < currentAllIndex ? 'past' : i === currentAllIndex ? 'now' : 'future'}
          />
        ))}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {phase === 'ready' && (
          <button className={styles.primaryAction} onClick={handleStart}>
            <PlayIcon />
            Listen first
          </button>
        )}

        {phase === 'listen' && (
          <div className={styles.listenControls}>
            <button className={styles.playBtn} onClick={audio.isPlaying ? audio.pause : audio.play}>
              {audio.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className={styles.primaryAction} onClick={handleRecord}>
              <MicIcon />
              Record
            </button>
          </div>
        )}

        {phase === 'record' && (
          <div className={styles.recordControls}>
            <Wave active={isRecording} />
            {micError && <p className={styles.micError}>Mic not detected — check permissions</p>}
            <button className={styles.stopBtn} onClick={handleStopRecording}>
              <StopIcon />
              Done
            </button>
          </div>
        )}

        {phase === 'scored' && !isScoring && (
          <div className={styles.scoredActions}>
            <button
              className={styles.retryBtn}
              onClick={() => { setPhase('listen'); setActiveStep(0); setCurrentScore(null); setToneResult(null); setShowPostIt(false); audio.play(); }}
            >
              Try again
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {currentLineIndex < totalYou - 1 ? 'Next phrase' : 'Finish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ activeStep }) {
  return (
    <div className={styles.steps}>
      {STEPS.map((label, i) => (
        <div key={i} className={`${styles.step} ${i === activeStep ? styles.stepActive : ''} ${i < activeStep ? styles.stepDone : ''}`}>
          {label}
        </div>
      ))}
    </div>
  );
}

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0014 0" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" strokeLinecap="round"/>
  </svg>
);
const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);
