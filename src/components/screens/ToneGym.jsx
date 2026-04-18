// src/components/screens/ToneGym.jsx — Tone training: learn by hearing differences

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { saveSession, getRecentScoredSessions } from '../../services/storage';
import { updateStreak, getTodayString } from '../../services/streak';
import { logEvent, isStreakMilestone, calculatePersonalPercentile } from '../../services/analytics';
import { phCapture } from '../../services/posthog';
import styles from './ToneGym.module.css';

const TOTAL_ROUNDS = 10;
const TONE_PAIRS = [
  { base: '媽', tones: [{ char: '媽', jyutping: 'maa1', tone: 1, desc: 'high flat' }, { char: '麻', jyutping: 'maa4', tone: 4, desc: 'low falling' }] },
  { base: '好', tones: [{ char: '好', jyutping: 'hou2', tone: 2, desc: 'high rising' }, { char: '號', jyutping: 'hou6', tone: 6, desc: 'low level' }] },
  { base: '飛', tones: [{ char: '飛', jyutping: 'fei1', tone: 1, desc: 'high flat' }, { char: '肥', jyutping: 'fei4', tone: 4, desc: 'low falling' }] },
  { base: '詩', tones: [{ char: '詩', jyutping: 'si1', tone: 1, desc: 'high flat' }, { char: '時', jyutping: 'si4', tone: 4, desc: 'low falling' }] },
  { base: '分', tones: [{ char: '分', jyutping: 'fan1', tone: 1, desc: 'high flat' }, { char: '粉', jyutping: 'fan2', tone: 2, desc: 'high rising' }] },
  { base: '買', tones: [{ char: '買', jyutping: 'maai5', tone: 5, desc: 'low rising' }, { char: '賣', jyutping: 'maai6', tone: 6, desc: 'low level' }] },
  { base: '大', tones: [{ char: '大', jyutping: 'daai6', tone: 6, desc: 'low level' }, { char: '帶', jyutping: 'daai3', tone: 3, desc: 'mid level' }] },
  { base: '知', tones: [{ char: '知', jyutping: 'zi1', tone: 1, desc: 'high flat' }, { char: '紙', jyutping: 'zi2', tone: 2, desc: 'high rising' }] },
  { base: '花', tones: [{ char: '花', jyutping: 'faa1', tone: 1, desc: 'high flat' }, { char: '化', jyutping: 'faa3', tone: 3, desc: 'mid level' }] },
  { base: '書', tones: [{ char: '書', jyutping: 'syu1', tone: 1, desc: 'high flat' }, { char: '樹', jyutping: 'syu6', tone: 6, desc: 'low level' }] },
  { base: '魚', tones: [{ char: '魚', jyutping: 'jyu4', tone: 4, desc: 'low falling' }, { char: '語', jyutping: 'jyu5', tone: 5, desc: 'low rising' }] },
  { base: '水', tones: [{ char: '水', jyutping: 'seoi2', tone: 2, desc: 'high rising' }, { char: '睡', jyutping: 'seoi6', tone: 6, desc: 'low level' }] },
  { base: '雞', tones: [{ char: '雞', jyutping: 'gai1', tone: 1, desc: 'high flat' }, { char: '計', jyutping: 'gai3', tone: 3, desc: 'mid level' }] },
  { base: '糖', tones: [{ char: '糖', jyutping: 'tong4', tone: 4, desc: 'low falling' }, { char: '燙', jyutping: 'tong3', tone: 3, desc: 'mid level' }] },
  { base: '九', tones: [{ char: '九', jyutping: 'gau2', tone: 2, desc: 'high rising' }, { char: '夠', jyutping: 'gau3', tone: 3, desc: 'mid level' }] },
];

function playChar(char) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(char);
    u.lang = 'zh-HK';
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }
}

/**
 * @param {{ onBack: Function, onComplete: (summary: Object) => void }} props
 */
export default function ToneGym({ onBack, onComplete }) {
  const { settings, updateSettings } = useAppContext();
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro|learn|listen|choose|feedback
  const [currentPair, setCurrentPair] = useState(null);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [toneResults, setToneResults] = useState([]);
  const [finishError, setFinishError] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [sessionPairs] = useState(() => {
    const shuffled = [...TONE_PAIRS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, TOTAL_ROUNDS);
  });

  useEffect(() => {
    if (phase === 'learn' || phase === 'listen') {
      // Auto-setup the round data
    }
  }, [phase]);

  const setupRound = useCallback((r) => {
    const pair = sessionPairs[r % sessionPairs.length];
    const idx = Math.random() < 0.5 ? 0 : 1;
    setCurrentPair(pair);
    setCorrectIndex(idx);
    setChosen(null);
  }, [sessionPairs]);

  const startGame = useCallback(() => {
    setupRound(0);
    setPhase('learn');
    logEvent('session_started', { mode: 'tone_gym' });
    phCapture('session_started', { mode: 'tone_gym' });
  }, [setupRound]);

  const handleDoneLearn = useCallback(() => {
    setPhase('choose');
    // Auto-play the target after a short delay
    setTimeout(() => {
      if (sessionPairs[round]) {
        const pair = sessionPairs[round % sessionPairs.length];
        const idx = Math.random() < 0.5 ? 0 : 1;
        setCorrectIndex(idx);
        playChar(pair.tones[idx].char);
      }
    }, 500);
  }, [round, sessionPairs]);

  const handleChoice = useCallback((idx) => {
    const isRight = idx === correctIndex;
    setChosen(idx);
    if (isRight) setCorrect(c => c + 1);
    if (currentPair) {
      setToneResults(prev => [...prev, { tone: currentPair.tones[correctIndex].tone, isCorrect: isRight }]);
    }
    setPhase('feedback');
  }, [correctIndex, currentPair]);

  const handleNext = useCallback(async () => {
    const next = round + 1;
    if (next >= TOTAL_ROUNDS) { await finish(); return; }
    setRound(next);
    setupRound(next);
    setPhase('learn');
  }, [round, setupRound]);

  const finish = useCallback(async () => {
    setFinishError(false);
    try {
      const dur = Math.round((Date.now() - sessionStart) / 1000);
      const streakResult = await updateStreak();
      const streakCount = streakResult.count;
      const avgScore = Math.round((correct / TOTAL_ROUNDS) * 100);
      // Fetch baseline BEFORE saving so the current session isn't in its own percentile
      const pastScores = await getRecentScoredSessions(20);
      logEvent('session_completed', { mode: 'tone_gym', correct_answers: correct });
      phCapture('session_completed', { mode: 'tone_gym', correct_answers: correct });
      if (isStreakMilestone(streakCount)) {
        logEvent('streak_milestone', { streak_count: streakCount });
      }
      await updateSettings({ streakCount, totalPracticeSeconds: settings.totalPracticeSeconds + dur });
      const rec = {
        id: crypto.randomUUID(), date: getTodayString(),
        startedAt: sessionStart, completedAt: Date.now(), durationSeconds: dur,
        mode: 'tone-gym', phrasesAttempted: TOTAL_ROUNDS, phrasesMastered: 0,
        averageScore: avgScore, phraseResults: [],
      };
      await saveSession(rec);
      const percentile = calculatePersonalPercentile(avgScore, pastScores);
      logEvent('score_achieved', { score: avgScore, mode: 'tone_gym', language: settings.currentLanguage || 'cantonese' });
      phCapture('score_achieved', { score: avgScore, mode: 'tone_gym', language: settings.currentLanguage || 'cantonese', percentile });
      onComplete?.({ ...rec, streakCount, freezeUsed: streakResult.freezeUsed, freezeNotAvailable: streakResult.freezeNotAvailable, correct, total: TOTAL_ROUNDS, toneResults });
    } catch (err) {
      setFinishError(true);
    }
  }, [sessionStart, correct, toneResults, updateSettings, settings, onComplete]);

  // === INTRO SCREEN ===
  if (phase === 'intro') {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.introContent}>
          <h1 className={styles.introTitle}>Tone Training</h1>
          <p className={styles.introDesc}>
            Cantonese has 6 tones. The same syllable with a different tone means a completely different word.
          </p>
          <div className={styles.introExample}>
            <button className={styles.introToneBtn} onClick={() => playChar('媽')}>
              <span className={styles.introChar}>媽</span>
              <span className={styles.introJyut}>maa1</span>
              <span className={styles.introMeaning}>mother</span>
              <span className={styles.introToneLabel}>high flat ▶</span>
            </button>
            <span className={styles.introVs}>vs</span>
            <button className={styles.introToneBtn} onClick={() => playChar('麻')}>
              <span className={styles.introChar}>麻</span>
              <span className={styles.introJyut}>maa4</span>
              <span className={styles.introMeaning}>numb</span>
              <span className={styles.introToneLabel}>low falling ▶</span>
            </button>
          </div>
          <p className={styles.introHint}>Tap each one to hear the difference</p>
          <button className={styles.startBtn} onClick={startGame}>
            Start training
          </button>
        </div>
      </div>
    );
  }

  if (!currentPair) return null;

  // === LEARN PHASE: hear both tones ===
  if (phase === 'learn') {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className={styles.score}>{correct}/{round + (phase === 'feedback' ? 1 : 0)}</span>
          <span className={styles.roundCount}>Round {round + 1}/{TOTAL_ROUNDS}</span>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${((round) / TOTAL_ROUNDS) * 100}%` }} />
        </div>

        <div className={styles.learnSection}>
          <p className={styles.learnTitle}>Listen to both — hear the difference</p>

          <div className={styles.learnPair}>
            {currentPair.tones.map((t, i) => (
              <button key={i} className={styles.learnCard} onClick={() => playChar(t.char)}>
                <span className={styles.learnChar} lang="yue">{t.char}</span>
                <span className={styles.learnJyut}>{t.jyutping}</span>
                <span className={styles.learnDesc}>{t.desc}</span>
                <span className={styles.learnMeaning}>{t.char}</span>
                <span className={styles.learnPlay}>▶ Play</span>
              </button>
            ))}
          </div>

          <button className={styles.readyBtn} onClick={handleDoneLearn}>
            I hear the difference — quiz me
          </button>
        </div>
      </div>
    );
  }

  // === CHOOSE + FEEDBACK PHASE ===
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className={styles.score}>{correct}/{round + (phase === 'feedback' ? 1 : 0)}</span>
        <span className={styles.roundCount}>Round {round + 1}/{TOTAL_ROUNDS}</span>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${((round + (phase === 'feedback' ? 1 : 0)) / TOTAL_ROUNDS) * 100}%` }} />
      </div>

      <div className={styles.playArea}>
        <span className={styles.label}>Which character did you hear?</span>
        <button className={styles.listenBtn} onClick={() => playChar(currentPair.tones[correctIndex].char)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Play again
        </button>
      </div>

      <div className={styles.choiceRow}>
        {currentPair.tones.map((t, i) => {
          const isChosen = chosen === i;
          const isCorrectChoice = i === correctIndex;
          let variant = '';
          if (phase === 'feedback') {
            if (isCorrectChoice) variant = styles.choiceCorrect;
            else if (isChosen) variant = styles.choiceWrong;
          }
          return (
            <button key={i} className={`${styles.choiceBtn} ${variant}`}
              onClick={() => {
                if (phase === 'choose') handleChoice(i);
                else playChar(t.char); // In feedback, tap to replay
              }}
              disabled={false}>
              <span className={styles.choiceChar} lang="yue">{t.char}</span>
              <span className={styles.choiceJyutping}>{t.jyutping}</span>
              <span className={styles.choiceDesc}>{t.desc}</span>
              {phase === 'feedback' && (
                <span className={styles.choicePlayHint}>tap to hear</span>
              )}
            </button>
          );
        })}
      </div>

      {phase === 'feedback' && (
        <div className={styles.feedbackArea}>
          <p className={styles.feedbackText}>
            {chosen === correctIndex ? '✓ Correct!' : `✗ It was ${currentPair.tones[correctIndex].char} (${currentPair.tones[correctIndex].jyutping})`}
          </p>
          {finishError && (
            <p style={{ fontSize: '13px', color: 'var(--color-error)', textAlign: 'center', marginBottom: '8px', lineHeight: 1.5 }}>
              Something went wrong. Check your connection and try again.
            </p>
          )}
          <button className={styles.nextBtn} onClick={handleNext}>
            {round + 1 >= TOTAL_ROUNDS ? (finishError ? 'Retry' : 'See results') : 'Next pair'}
          </button>
        </div>
      )}
    </div>
  );
}
