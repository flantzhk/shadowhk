// src/components/screens/SpeedRun.jsx — Rapid recall game

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getAllLibraryEntries, saveSession, getSettings, saveSettings } from '../../services/storage';
import { loadAllPhrases } from '../../services/lessonBuilder';
import { updateStreak, getTodayString } from '../../services/streak';
import { logEvent, isStreakMilestone } from '../../services/analytics';
import { phCapture } from '../../services/posthog';
import { LessonLoader } from '../shared/LessonLoader';
import styles from './SpeedRun.module.css';

const TIMER_SECONDS = 5;
const TOTAL_ROUNDS = 10;

/**
 * @param {{ onBack: Function, onComplete: (summary: Object) => void }} props
 */
export default function SpeedRun({ onBack, onComplete }) {
  const { settings, updateSettings } = useAppContext();
  const [phrases, setPhrases] = useState([]);
  const [round, setRound] = useState(0);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [phase, setPhase] = useState('loading'); // loading|playing|feedback|done
  const [correct, setCorrect] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [personalBest, setPersonalBest] = useState(0);
  const [options, setOptions] = useState([]);
  const [sessionStart] = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Speed Run only uses phrases the user has saved — no fallback to topic catalogue
      const libraryEntries = await getAllLibraryEntries();
      const allPhrases = await loadAllPhrases(settings.currentLanguage);
      const phraseMap = Object.fromEntries(allPhrases.map(p => [p.id, p]));
      const pool = libraryEntries
        .map(e => phraseMap[e.phraseId])
        .filter(Boolean);

      const stored = await getSettings();
      setPersonalBest(stored?.speedRunBest || 0);

      if (pool.length < 4) { setPhase('empty'); return; }

      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
      setPhrases(shuffled);
      if (shuffled.length > 0) {
        setPhase('playing');
        logEvent('session_started', { mode: 'speed_run' });
        phCapture('session_started', { mode: 'speed_run' });
        startTimer();
        generateOptions(shuffled, 0, pool);
      }
    })();
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = useCallback(() => {
    setTimer(TIMER_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const generateOptions = useCallback((allPhrases, idx, pool) => {
    const correct = allPhrases[idx];
    const others = pool.filter(p => p.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [correct, ...others].sort(() => Math.random() - 0.5);
    setOptions(opts);
  }, []);

  const handleTimeout = useCallback(() => {
    setShowAnswer(true); setWasCorrect(false); setPhase('feedback');
  }, []);

  const handleChoice = useCallback((chosen) => {
    clearInterval(timerRef.current);
    const isRight = chosen.id === phrases[round]?.id;
    setWasCorrect(isRight);
    if (isRight) setCorrect(c => c + 1);
    setShowAnswer(true); setPhase('feedback');
  }, [phrases, round]);

  const handleNextRound = useCallback(async () => {
    setShowAnswer(false);
    const next = round + 1;
    if (next >= phrases.length || next >= TOTAL_ROUNDS) {
      await finish();
      return;
    }
    setRound(next);
    setPhase('playing');
    generateOptions(phrases, next, phrases);
    startTimer();
  }, [round, phrases, startTimer, generateOptions]);

  const finish = useCallback(async () => {
    const dur = Math.round((Date.now() - sessionStart) / 1000);
    const streak = await updateStreak();
    logEvent('session_completed', { mode: 'speed_run', correct_answers: correct });
    phCapture('session_completed', { mode: 'speed_run', correct_answers: correct });
    if (isStreakMilestone(streak)) {
      logEvent('streak_milestone', { streak_count: streak });
    }
    const newBest = Math.max(personalBest, correct);
    await updateSettings({ streakCount: streak, totalPracticeSeconds: settings.totalPracticeSeconds + dur });
    if (newBest > personalBest) {
      const s = await getSettings();
      await saveSettings({ ...s, speedRunBest: newBest });
      setPersonalBest(newBest);
    }
    const rec = {
      id: crypto.randomUUID(), date: getTodayString(),
      startedAt: sessionStart, completedAt: Date.now(), durationSeconds: dur,
      mode: 'speed-run', phrasesAttempted: round + 1, phrasesMastered: 0,
      averageScore: null, phraseResults: [],
    };
    await saveSession(rec);
    onComplete?.({ ...rec, streakCount: streak, correct, personalBest: newBest });
  }, [sessionStart, correct, personalBest, round, updateSettings, settings, onComplete]);

  if (phase === 'loading') return <LessonLoader mode="speed-run" onCancel={onBack} />;

  if (phase === 'empty') {
    return (
      <div className={styles.screen} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No phrases available</p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Save at least 4 phrases to your library first — Speed Run only tests what you've learned.</p>
        <button onClick={onBack} style={{ padding: '12px 28px', borderRadius: '10px', background: 'var(--color-brand-dark)', color: 'white', fontWeight: 600, fontSize: '15px' }}>Go back</button>
      </div>
    );
  }

  const phrase = phrases[round];

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className={styles.score}>{correct} correct</span>
        <span className={styles.roundCount}>{round + 1}/{TOTAL_ROUNDS}</span>
      </div>

      <div className={styles.timerBar}>
        <div className={styles.timerFill} style={{ width: `${(timer / TIMER_SECONDS) * 100}%` }} />
      </div>

      <div className={styles.promptArea}>
        <span className={styles.label}>Which phrase means:</span>
        <p className={styles.english}>{phrase?.english}</p>
      </div>

      {showAnswer && (
        <div className={`${styles.feedback} ${wasCorrect ? styles.correct : styles.wrong}`}>
          <span className={styles.feedbackAnswer}>
            {wasCorrect ? 'Correct!' : `Answer: ${phrase?.romanization}`}
          </span>
          {phrase && !wasCorrect && (
            <span style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }} lang="yue">{phrase.chinese}</span>
          )}
          <button className={styles.nextBtn} onClick={handleNextRound}>
            {round + 1 >= TOTAL_ROUNDS ? 'Finish' : 'Next'}
          </button>
        </div>
      )}

      <div className={styles.optionsGrid}>
        {options.map(opt => (
          <button key={opt.id} className={styles.optionBtn}
            onClick={() => phase === 'playing' && handleChoice(opt)}
            disabled={phase !== 'playing'}
          >
            <span className={styles.optRoman}>{opt.romanization}</span>
            <span className={styles.optChinese} lang="yue">{opt.chinese}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
