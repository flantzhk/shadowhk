// src/components/screens/PromptDrill.jsx — "Your turn" mode: English → speak → score

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useRecorder } from '../../hooks/useRecorder';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { speechToText, scorePronunciation, textToSpeech } from '../../services/api';
import { isAuthenticated } from '../../services/auth';
import { updateAfterPractice } from '../../services/srs';
import { buildLesson } from '../../services/lessonBuilder';
import { saveSession, getRecentScoredSessions } from '../../services/storage';
import { updateStreak, getTodayString } from '../../services/streak';
import { logEvent, isStreakMilestone, calculatePersonalPercentile } from '../../services/analytics';
import { phCapture } from '../../services/posthog';
import { SCORE_THRESHOLDS } from '../../utils/constants';
import { ScoreBadge } from '../cards/ScoreBadge';
import { RecordButton } from '../shared/RecordButton';
import { LessonLoader } from '../shared/LessonLoader';
import styles from './PromptDrill.module.css';

const LEVEL_LABELS = {
  1: 'LEVEL 1 — With hints',
  2: 'LEVEL 2 — English only',
  3: 'LEVEL 3 — From memory',
};

const STREAK_TO_LEVEL_UP = 5;

/**
 * @param {{ onBack: Function, onComplete: (summary: Object) => void }} props
 */
export default function PromptDrill({ onBack, onComplete }) {
  const { settings, updateSettings } = useAppContext();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();
  const [phrases, setPhrases] = useState([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading|prompt|recording|result|empty
  const [transcription, setTranscription] = useState('');
  const [score, setScore] = useState(null);
  const [results, setResults] = useState([]);
  const [sessionStart] = useState(Date.now());
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [levelUpToast, setLevelUpToast] = useState(false);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    (async () => {
      const lesson = await buildLesson(settings.dailyGoalMinutes, settings.currentLanguage);
      setPhrases(lesson);
      if (lesson.length > 0) {
        setPhase('prompt');
        logEvent('session_started', { mode: 'prompt_drill' });
        phCapture('session_started', { mode: 'prompt_drill' });
      } else {
        setPhase('empty');
      }
    })();
    return () => { audioRef.current.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const phrase = phrases[index];

  // Level 3: play audio cue when entering prompt phase
  useEffect(() => {
    if (phase === 'prompt' && level === 3 && phrase && isAuthenticated()) {
      let blobUrl = null;
      let isMounted = true;
      (async () => {
        try {
          const blob = await textToSpeech(phrase.chinese, {
            language: settings.currentLanguage, speed: 0.85, outputExtension: 'mp3',
          });
          if (!isMounted) return;
          blobUrl = URL.createObjectURL(blob);
          audioRef.current.src = blobUrl;
          await audioRef.current.play();
          audioRef.current.onended = () => {
            if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
          };
        } catch (err) {
          if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
        }
      })();
      return () => {
        isMounted = false;
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
      };
    }
  }, [phase, level, phrase, settings.currentLanguage]);

  const handleReady = useCallback(async () => {
    setPhase('recording');
    await startRecording();
  }, [startRecording]);

  const handleDone = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob || !phrase) return;
    setPhase('result');

    if (isOnline && isAuthenticated()) {
      try {
        const [sttResult, scoreResult] = await Promise.all([
          speechToText(blob),
          scorePronunciation(blob, phrase.chinese, settings.currentLanguage),
        ]);
        setTranscription(sttResult.text || '');
        const s = scoreResult.score;
        setScore(s);
        await updateAfterPractice(phrase.id, s);
        setResults(prev => [...prev, { phraseId: phrase.id, romanization: phrase.romanization || '', english: phrase.english || '', score: s }]);

        // Track streak for level progression
        if (s >= SCORE_THRESHOLDS.GOOD) {
          const newStreak = streak + 1;
          setStreak(newStreak);
          if (newStreak >= STREAK_TO_LEVEL_UP && level < 3) {
            setLevel(l => l + 1);
            setStreak(0);
            setLevelUpToast(true);
            setTimeout(() => setLevelUpToast(false), 2500);
          }
        } else {
          setStreak(0);
        }
      } catch (err) {
        setTranscription('Could not transcribe');
        setScore(null);
        setResults(prev => [...prev, { phraseId: phrase.id, romanization: phrase.romanization || '', english: phrase.english || '', score: null }]);
        setStreak(0);
      }
    } else {
      setTranscription('Scoring requires internet');
      setScore(null);
      setResults(prev => [...prev, { phraseId: phrase.id, romanization: phrase.romanization || '', english: phrase.english || '', score: null }]);
    }
  }, [stopRecording, phrase, isOnline, settings.currentLanguage, streak, level]);

  const handleNext = useCallback(async () => {
    setTranscription(''); setScore(null);
    if (index < phrases.length - 1) {
      setIndex(i => i + 1); setPhase('prompt');
    } else {
      await finish();
    }
  }, [index, phrases.length]);

  const finish = useCallback(async () => {
    const dur = Math.round((Date.now() - sessionStart) / 1000);
    const streakCount = await updateStreak();
    const scores = results.filter(r => r.score !== null).map(r => r.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    // Fetch baseline BEFORE saving so the current session isn't in its own percentile
    const pastScores = await getRecentScoredSessions(20);
    logEvent('session_completed', {
      mode: 'prompt_drill',
      phrases_attempted: results.length,
      average_score: avg !== null ? Math.round(avg) : 0,
    });
    phCapture('session_completed', {
      mode: 'prompt_drill',
      phrases_attempted: results.length,
      average_score: avg !== null ? Math.round(avg) : 0,
    });
    if (isStreakMilestone(streakCount)) {
      logEvent('streak_milestone', { streak_count: streakCount });
    }
    await updateSettings({ streakCount, totalPracticeSeconds: settings.totalPracticeSeconds + dur });
    const rec = {
      id: crypto.randomUUID(), date: getTodayString(),
      startedAt: sessionStart, completedAt: Date.now(), durationSeconds: dur,
      mode: 'prompt', phrasesAttempted: results.length, phrasesMastered: 0,
      averageScore: avg,
      phraseResults: results.map(r => ({ phraseId: r.phraseId, romanization: r.romanization, english: r.english, score: r.score, replays: 0, markedKnown: false })),
    };
    await saveSession(rec);
    if (avg !== null) {
      const roundedAvg = Math.round(avg);
      const percentile = calculatePersonalPercentile(roundedAvg, pastScores);
      logEvent('score_achieved', { score: roundedAvg, mode: 'prompt_drill', language: settings.currentLanguage || 'cantonese' });
      phCapture('score_achieved', { score: roundedAvg, mode: 'prompt_drill', language: settings.currentLanguage || 'cantonese', percentile });
    }
    onComplete?.({ ...rec, streakCount });
  }, [sessionStart, results, updateSettings, settings, onComplete]);

  if (phase === 'empty') {
    return (
      <div className={styles.screen} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No phrases available</p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Add phrases to your library first, then come back to practice.</p>
        <button onClick={onBack} style={{ padding: '12px 28px', borderRadius: '10px', background: 'var(--color-brand-dark)', color: 'white', fontWeight: 600, fontSize: '15px' }}>Go back</button>
      </div>
    );
  }

  if (phase === 'loading' || !phrase) {
    return <LessonLoader mode="prompt-drill" onCancel={onBack} />;
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className={styles.counter}>{index + 1}/{phrases.length}</span>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${((index + 1) / phrases.length) * 100}%` }} />
      </div>

      {/* Level up toast */}
      {levelUpToast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-brand-dark)', color: 'var(--color-brand-lime)',
          padding: '10px 24px', borderRadius: '20px', fontSize: '14px', fontWeight: 700,
          zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          Level up!
        </div>
      )}

      <div className={styles.promptArea}>
        <span style={{
          fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
          color: 'var(--color-brand-green)', fontWeight: 700, marginBottom: '8px',
        }}>
          {LEVEL_LABELS[level]}
        </span>

        {level === 3 ? (
          <>
            <p className={styles.english} style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Listen and repeat from memory
            </p>
            <button onClick={() => {
              if (!phrase || !isAuthenticated()) return;
              (async () => {
                try {
                  const blob = await textToSpeech(phrase.chinese, {
                    language: settings.currentLanguage, speed: 0.85, outputExtension: 'mp3',
                  });
                  const url = URL.createObjectURL(blob);
                  audioRef.current.src = url;
                  audioRef.current.onended = () => URL.revokeObjectURL(url);
                  audioRef.current.onerror = () => URL.revokeObjectURL(url);
                  await audioRef.current.play();
                } catch (err) { /* non-fatal */ }
              })();
            }} style={{
              background: 'var(--color-brand-dark)', color: 'white', padding: '10px 20px',
              borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginTop: '8px',
            }}>
              Replay audio
            </button>
          </>
        ) : (
          <>
            <span className={styles.label}>Say this in Cantonese:</span>
            <p className={styles.english}>{phrase.english}</p>
            {level === 1 && phrase.jyutping && (
              <p style={{ fontSize: '14px', color: 'var(--color-jyutping)', marginTop: '4px' }}>
                {phrase.jyutping}
              </p>
            )}
            <p className={styles.context}>{phrase.context}</p>
          </>
        )}
      </div>

      {phase === 'prompt' && (
        <button className={styles.readyBtn} onClick={handleReady}>I&apos;m ready</button>
      )}

      {phase === 'recording' && (
        <RecordButton isRecording={isRecording} onStart={handleReady} onStop={handleDone} error={micError} />
      )}

      {phase === 'result' && (
        <div className={styles.resultArea}>
          <div className={styles.comparison}>
            <div className={styles.expected}>
              <span className={styles.compLabel}>Expected</span>
              <span className={styles.compText} lang="yue">{phrase.chinese}</span>
              <span className={styles.compJyutping}>{phrase.jyutping}</span>
            </div>
            <div className={styles.actual}>
              <span className={styles.compLabel}>You said</span>
              <span className={styles.compText} lang="yue">{transcription || '...'}</span>
            </div>
          </div>
          <ScoreBadge score={score} variant="full" />
          {streak > 0 && streak < STREAK_TO_LEVEL_UP && (
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {streak}/{STREAK_TO_LEVEL_UP} correct in a row
            </p>
          )}
          <button className={styles.nextBtn} onClick={handleNext}>
            {index < phrases.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      )}
    </div>
  );
}
