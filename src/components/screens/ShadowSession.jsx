import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../contexts/AudioContext.jsx';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { saveSession, addToQueue } from '../../services/storage.js';
import { scorePronunciation } from '../../services/api.js';
import { isAuthenticated } from '../../services/auth.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { blobToBase64 } from '../../services/offlineManager.js';
import { getSceneById, getYouLines } from '../../services/sceneLoader.js';
import { buildPhraseQueueFromScene, buildLesson } from '../../services/lessonBuilder.js';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { SCORE_THRESHOLDS } from '../../utils/constants.js';
import styles from './ShadowSession.module.css';

const SPEEDS = [
  { label: '🐢 Slow', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: '🐇 Fast', value: 1.25 },
];

export default function ShadowSession({ sceneId, onBack, onComplete }) {
  const { settings } = useAppContext();
  const audio = useAudio();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();

  const [scene, setScene] = useState(null);
  const [youLines, setYouLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [knowDone, setKnowDone] = useState(false);

  // phase: ready | listen | record | scoring | scored
  const [phase, setPhase] = useState('ready');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [currentScore, setCurrentScore] = useState(null);
  const [toneResult, setToneResult] = useState(null);
  const [sessionStart] = useState(Date.now());

  const language = settings?.currentLanguage ?? 'cantonese';

  useEffect(() => {
    if (!sceneId) {
      buildLesson(10, language).then(phrases => {
        const virtualLines = phrases.map(e => ({
          id: e.phraseId,
          speaker: 'you',
          cjk: e.cjk,
          romanization: e.romanization,
          english: e.english,
          audioFile: e.audioFile,
        }));
        setScene({ id: 'free-practice', title: 'Free practice', lines: virtualLines });
        setYouLines(virtualLines);
      }).catch(() => {}).finally(() => setLoading(false));
      return;
    }
    getSceneById(sceneId)
      .then(s => {
        setScene(s);
        setYouLines(getYouLines(s));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sceneId, language]);

  const currentYouLine = youLines[currentLineIndex] ?? null;
  const totalYou = youLines.length;

  // Reset "know" state when moving to a new phrase
  useEffect(() => { setKnowDone(false); }, [currentLineIndex]);

  const handlePlayPause = useCallback(async () => {
    if (phase === 'ready' || phase === 'scored') {
      setPhase('listen');
      audio.prime();
      try {
        await audio.loadQueue([currentYouLine], language, speed === 1 ? 'natural' : speed < 1 ? 'slow' : 'fast');
        await audio.play();
      } catch (_) {}
      return;
    }
    if (audio.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [phase, audio, currentYouLine, language, speed]);

  const handleReplay = useCallback(async () => {
    audio.prime();
    try {
      await audio.loadQueue([currentYouLine], language, speed === 1 ? 'natural' : speed < 1 ? 'slow' : 'fast');
      await audio.play();
      if (phase !== 'listen') setPhase('listen');
    } catch (_) {}
  }, [audio, currentYouLine, language, speed, phase]);

  const handleRecord = useCallback(async () => {
    audio.pause();
    setPhase('record');
    await startRecording();
  }, [audio, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob || !currentYouLine) return;

    setPhase('scoring');
    setCurrentScore(null);
    setToneResult(null);

    if (isOnline && isAuthenticated()) {
      try {
        const result = await scorePronunciation(blob, currentYouLine.cjk, language);
        setCurrentScore(result.score);
        setToneResult(result);
        await updateAfterPractice(currentYouLine.id, result.score);
        setResults(prev => [...prev, { phraseId: currentYouLine.id, score: result.score, romanization: currentYouLine.romanization, english: currentYouLine.english }]);
      } catch (_) {
        setCurrentScore(null);
        setResults(prev => [...prev, { phraseId: currentYouLine.id, score: null, romanization: currentYouLine.romanization, english: currentYouLine.english }]);
      }
    } else {
      if (blob) {
        try {
          const b64 = await blobToBase64(blob);
          await addToQueue('score-pronunciation', { audioBase64: b64, expectedText: currentYouLine.cjk, language, phraseId: currentYouLine.id });
        } catch (_) {}
      }
      setResults(prev => [...prev, { phraseId: currentYouLine.id, score: null, romanization: currentYouLine.romanization, english: currentYouLine.english }]);
    }
    setPhase('scored');
  }, [stopRecording, currentYouLine, language, isOnline]);

  const handleNext = useCallback(async () => {
    const nextIndex = currentLineIndex + 1;
    if (nextIndex < totalYou) {
      setCurrentLineIndex(nextIndex);
      setCompletedCount(nextIndex);
      setCurrentScore(null);
      setToneResult(null);
      setPhase('ready');
    } else {
      await finishSession();
    }
  }, [currentLineIndex, totalYou]);

  const handleKnowIt = useCallback(async () => {
    if (!currentYouLine || knowDone) return;
    setKnowDone(true);
    await markAsMastered(currentYouLine.id).catch(() => {});
  }, [currentYouLine, knowDone]);

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
      onComplete?.({ sceneId, phrasesAttempted: results.length, phraseResults: results, durationSeconds: dur, averageScore: avg, streakCount: streakResult?.count ?? 0 });
    } catch (_) {
      onComplete?.({ sceneId, phrasesAttempted: results.length, phraseResults: results, durationSeconds: 0, averageScore: null, streakCount: 0 });
    }
  }, [audio, sessionStart, results, sceneId, onComplete]);

  if (loading) {
    return <div className={styles.screen}><div className={styles.loadingPulse} /></div>;
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

  const isSpeakPhase = phase === 'record' || phase === 'scoring' || phase === 'scored';
  const scoreColor = currentScore === null ? '#fff'
    : currentScore >= 80 ? '#C4F000'
    : currentScore >= 60 ? '#9dcc33'
    : currentScore >= 40 ? '#f0a030'
    : '#ff7a5c';

  const progressPct = totalYou > 0 ? (completedCount / totalYou) * 100 : 0;

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack}>✕ Close</button>
        <div className={styles.headerCenter}>
          <span className={styles.phraseCounter}>
            {scene.title ?? 'Practice'} · {currentLineIndex + 1}/{totalYou}
          </span>
        </div>
        <div className={styles.headerSpacer} />
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      {/* Coach banner */}
      <div className={`${styles.coachBanner} ${isSpeakPhase ? styles.coachBannerSpeak : styles.coachBannerListen}`}>
        {isSpeakPhase ? '🗣️ Say it out loud!' : '🎯 Listen, then say it out loud...'}
      </div>

      {/* Phrase body */}
      <div className={styles.phraseBody}>
        {currentYouLine?.tag && (
          <span className={styles.tagLabel}>{currentYouLine.tag}</span>
        )}

        <p className={styles.romanization}>{currentYouLine?.romanization}</p>
        <p className={styles.english}>{currentYouLine?.english}</p>
        <p className={styles.cjk} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>
          {currentYouLine?.cjk}
        </p>

        {/* Cue pill */}
        <div className={`${styles.cuePill} ${isSpeakPhase ? styles.cuePillSpeak : styles.cuePillListen}`}>
          <span className={styles.cuePillEmoji}>{isSpeakPhase ? '🗣️' : '👂'}</span>
          <div className={`${styles.cuePillDot} ${isSpeakPhase ? styles.cuePillDotSpeak : styles.cuePillDotListen}`} />
          <span className={`${styles.cuePillText} ${isSpeakPhase ? styles.cuePillTextSpeak : styles.cuePillTextListen}`}>
            {isSpeakPhase ? 'Say it out loud!' : 'Listen'}
          </span>
        </div>

        {/* Score reveal (inline, after scoring) */}
        {(phase === 'scoring' || phase === 'scored') && (
          <div className={styles.scoreInline}>
            {phase === 'scoring' ? (
              <span className={styles.scoringText}>Scoring your pronunciation…</span>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Transport row — shown when not recording/scoring */}
        {phase !== 'record' && phase !== 'scoring' && (
          <div className={styles.transport}>
            <div className={styles.transportItem}>
              <button className={styles.transportBtnSec} onClick={handleReplay} aria-label="Replay">
                ↻
              </button>
              <span className={styles.transportLbl}>Replay</span>
            </div>

            <div className={styles.transportItem}>
              <button className={styles.transportBtnPri} onClick={handlePlayPause} aria-label={audio.isPlaying ? 'Pause' : 'Play'}>
                {audio.isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span className={styles.transportLbl}>{audio.isPlaying ? 'Pause' : 'Play'}</span>
            </div>

            {totalYou > 1 && (
              <div className={styles.transportItem}>
                <button className={styles.transportBtnSec} onClick={handleNext} aria-label="Skip">
                  ⏭
                </button>
                <span className={styles.transportLbl}>Next</span>
              </div>
            )}
          </div>
        )}

        {/* Pronunciation test button */}
        {phase !== 'scoring' && phase !== 'scored' && (
          <button
            className={`${styles.testBtn} ${phase === 'record' ? styles.testBtnRecording : ''}`}
            onClick={phase === 'record' ? handleStopRecording : handleRecord}
          >
            {phase === 'record' ? '⏹ Stop recording & score' : '🎙 Test your pronunciation'}
          </button>
        )}

        {/* Scoring state */}
        {phase === 'scoring' && (
          <button className={`${styles.testBtn} ${styles.testBtnScoring}`} disabled>
            Scoring your pronunciation…
          </button>
        )}

        {/* Scored: retry + next */}
        {phase === 'scored' && (
          <div className={styles.scoredActions}>
            <button
              className={styles.retryBtn}
              onClick={() => { setPhase('listen'); setCurrentScore(null); setToneResult(null); audio.play(); }}
            >
              🔄 Try again
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {currentLineIndex < totalYou - 1 ? '→ Next phrase' : '👂 Finish'}
            </button>
          </div>
        )}

        {micError && <p className={styles.micError}>Mic not detected — check permissions</p>}

        {/* "I know this now" */}
        {phase !== 'record' && phase !== 'scoring' && (
          <div className={styles.knowRow}>
            <button
              className={`${styles.knowBtn} ${knowDone ? styles.knowBtnDone : ''}`}
              onClick={handleKnowIt}
            >
              💪 I know this now
            </button>
          </div>
        )}

        {/* Speed selector */}
        <div className={styles.speedRow}>
          <span className={styles.speedRowLabel}>Speed</span>
          {SPEEDS.map(s => (
            <button
              key={s.value}
              className={`${styles.speedPill} ${speed === s.value ? styles.speedPillActive : ''}`}
              onClick={() => setSpeed(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const PauseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
