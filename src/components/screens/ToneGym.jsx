// src/components/screens/ToneGym.jsx — Tone training: learn by hearing differences

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { saveSession, getRecentScoredSessions } from '../../services/storage';
import { staticWordAudio } from '../../services/staticAudio';
import { textToSpeech } from '../../services/api';
import { updateStreak, getTodayString } from '../../services/streak';
import { logEvent, isStreakMilestone, calculatePersonalPercentile } from '../../services/analytics';
import { phCapture } from '../../services/posthog';
import { AudioStateIndicator } from '../shared/AudioStateIndicator.jsx';
import styles from './ToneGym.module.css';

const TOTAL_ROUNDS = 10;
const CANTONESE_TONE_PAIRS = [
  { base: '媽', tones: [{ char: '媽', romanization: 'maa1', tone: 1, desc: 'high flat', meaning: 'mother' }, { char: '麻', romanization: 'maa4', tone: 4, desc: 'low falling', meaning: 'sesame / hemp' }] },
  { base: '好', tones: [{ char: '好', romanization: 'hou2', tone: 2, desc: 'high rising', meaning: 'good' }, { char: '號', romanization: 'hou6', tone: 6, desc: 'low level', meaning: 'number / signal' }] },
  { base: '飛', tones: [{ char: '飛', romanization: 'fei1', tone: 1, desc: 'high flat', meaning: 'to fly' }, { char: '肥', romanization: 'fei4', tone: 4, desc: 'low falling', meaning: 'fat / plump' }] },
  { base: '詩', tones: [{ char: '詩', romanization: 'si1', tone: 1, desc: 'high flat', meaning: 'poem' }, { char: '時', romanization: 'si4', tone: 4, desc: 'low falling', meaning: 'time / hour' }] },
  { base: '分', tones: [{ char: '分', romanization: 'fan1', tone: 1, desc: 'high flat', meaning: 'minute / divide' }, { char: '粉', romanization: 'fan2', tone: 2, desc: 'high rising', meaning: 'powder / noodles' }] },
  { base: '買', tones: [{ char: '買', romanization: 'maai5', tone: 5, desc: 'low rising', meaning: 'to buy' }, { char: '賣', romanization: 'maai6', tone: 6, desc: 'low level', meaning: 'to sell' }] },
  { base: '大', tones: [{ char: '大', romanization: 'daai6', tone: 6, desc: 'low level', meaning: 'big / large' }, { char: '帶', romanization: 'daai3', tone: 3, desc: 'mid level', meaning: 'to bring / belt' }] },
  { base: '知', tones: [{ char: '知', romanization: 'zi1', tone: 1, desc: 'high flat', meaning: 'to know' }, { char: '紙', romanization: 'zi2', tone: 2, desc: 'high rising', meaning: 'paper' }] },
  { base: '花', tones: [{ char: '花', romanization: 'faa1', tone: 1, desc: 'high flat', meaning: 'flower' }, { char: '化', romanization: 'faa3', tone: 3, desc: 'mid level', meaning: 'to melt / transform' }] },
  { base: '書', tones: [{ char: '書', romanization: 'syu1', tone: 1, desc: 'high flat', meaning: 'book' }, { char: '樹', romanization: 'syu6', tone: 6, desc: 'low level', meaning: 'tree' }] },
  { base: '魚', tones: [{ char: '魚', romanization: 'jyu4', tone: 4, desc: 'low falling', meaning: 'fish' }, { char: '語', romanization: 'jyu5', tone: 5, desc: 'low rising', meaning: 'language' }] },
  { base: '水', tones: [{ char: '水', romanization: 'seoi2', tone: 2, desc: 'high rising', meaning: 'water' }, { char: '睡', romanization: 'seoi6', tone: 6, desc: 'low level', meaning: 'to sleep' }] },
  { base: '雞', tones: [{ char: '雞', romanization: 'gai1', tone: 1, desc: 'high flat', meaning: 'chicken' }, { char: '計', romanization: 'gai3', tone: 3, desc: 'mid level', meaning: 'to plan / count' }] },
  { base: '糖', tones: [{ char: '糖', romanization: 'tong4', tone: 4, desc: 'low falling', meaning: 'sugar / candy' }, { char: '燙', romanization: 'tong3', tone: 3, desc: 'mid level', meaning: 'scalding hot' }] },
  { base: '九', tones: [{ char: '九', romanization: 'gau2', tone: 2, desc: 'high rising', meaning: 'nine' }, { char: '夠', romanization: 'gau3', tone: 3, desc: 'mid level', meaning: 'enough' }] },
];

// Mandarin has only 4 tones (plus a light neutral), so pairs are drawn from
// well-known minimal pairs across the language rather than one base syllable's
// full 1–4 ladder each round.
const MANDARIN_TONE_PAIRS = [
  { base: '妈', tones: [{ char: '妈', romanization: 'mā', tone: 1, desc: 'high and level', meaning: 'mom' }, { char: '麻', romanization: 'má', tone: 2, desc: 'rising', meaning: 'hemp / numb' }] },
  { base: '马', tones: [{ char: '马', romanization: 'mǎ', tone: 3, desc: 'dipping', meaning: 'horse' }, { char: '骂', romanization: 'mà', tone: 4, desc: 'sharp falling', meaning: 'to scold' }] },
  { base: '买', tones: [{ char: '买', romanization: 'mǎi', tone: 3, desc: 'dipping', meaning: 'to buy' }, { char: '卖', romanization: 'mài', tone: 4, desc: 'sharp falling', meaning: 'to sell' }] },
  { base: '汤', tones: [{ char: '汤', romanization: 'tāng', tone: 1, desc: 'high and level', meaning: 'soup' }, { char: '糖', romanization: 'táng', tone: 2, desc: 'rising', meaning: 'sugar / candy' }] },
  { base: '书', tones: [{ char: '书', romanization: 'shū', tone: 1, desc: 'high and level', meaning: 'book' }, { char: '熟', romanization: 'shú', tone: 2, desc: 'rising', meaning: 'ripe / cooked' }] },
  { base: '花', tones: [{ char: '花', romanization: 'huā', tone: 1, desc: 'high and level', meaning: 'flower' }, { char: '画', romanization: 'huà', tone: 4, desc: 'sharp falling', meaning: 'painting / to draw' }] },
  { base: '写', tones: [{ char: '写', romanization: 'xiě', tone: 3, desc: 'dipping', meaning: 'to write' }, { char: '谢', romanization: 'xiè', tone: 4, desc: 'sharp falling', meaning: 'to thank' }] },
  { base: '问', tones: [{ char: '问', romanization: 'wèn', tone: 4, desc: 'sharp falling', meaning: 'to ask' }, { char: '温', romanization: 'wēn', tone: 1, desc: 'high and level', meaning: 'warm' }] },
  { base: '教', tones: [{ char: '教', romanization: 'jiāo', tone: 1, desc: 'high and level', meaning: 'to teach' }, { char: '叫', romanization: 'jiào', tone: 4, desc: 'sharp falling', meaning: 'to call / shout' }] },
  { base: '锅', tones: [{ char: '锅', romanization: 'guō', tone: 1, desc: 'high and level', meaning: 'pot' }, { char: '过', romanization: 'guò', tone: 4, desc: 'sharp falling', meaning: 'to pass / cross' }] },
  { base: '听', tones: [{ char: '听', romanization: 'tīng', tone: 1, desc: 'high and level', meaning: 'to listen' }, { char: '停', romanization: 'tíng', tone: 2, desc: 'rising', meaning: 'to stop' }] },
  { base: '五', tones: [{ char: '五', romanization: 'wǔ', tone: 3, desc: 'dipping', meaning: 'five' }, { char: '雾', romanization: 'wù', tone: 4, desc: 'sharp falling', meaning: 'fog' }] },
];

/**
 * @param {{ onBack: Function, onComplete: (summary: Object) => void }} props
 */
export default function ToneGym({ onBack, onComplete }) {
  const { settings, updateSettings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const TONE_PAIRS = language === 'mandarin' ? MANDARIN_TONE_PAIRS : CANTONESE_TONE_PAIRS;
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro|learn|listen|choose|feedback
  const [currentPair, setCurrentPair] = useState(null);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [toneResults, setToneResults] = useState([]);
  const [finishError, setFinishError] = useState(false);
  // Tracks whether the SpeechSynthesis utterance is currently speaking, so we
  // can render a "listening..." indicator below the character. Reset on end /
  // error / cancel.
  const [speaking, setSpeaking] = useState(false);
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

  // Play a single character with the app's real Cantonese voice: static
  // pre-recorded word audio first, live TTS fallback. (Browser
  // speechSynthesis was unreliable — many devices have no zh-HK voice at
  // all, which made the whole game silent.)
  const audioElRef = useRef(null);
  const speak = useCallback(async (char) => {
    audioElRef.current?.pause();
    setSpeaking(true);
    try {
      const blob = (await staticWordAudio(char, language)) ?? await textToSpeech(char, { language });
      if (!blob || blob.size === 0) { setSpeaking(false); return; }
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      audioElRef.current = el;
      el.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      el.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      await el.play();
    } catch {
      setSpeaking(false);
    }
  }, [language]);
  useEffect(() => () => audioElRef.current?.pause(), []);

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
    // Auto-play the target after a short delay. setupRound already chose
    // currentPair + correctIndex when this round started, so we just play
    // back what's already in state — no second re-roll.
    setTimeout(() => {
      if (currentPair) {
        speak(currentPair.tones[correctIndex].char);
      }
    }, 500);
  }, [currentPair, correctIndex, speak]);

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
        mode: 'tone-gym', language, phrasesAttempted: TOTAL_ROUNDS, phrasesMastered: 0,
        averageScore: avgScore, phraseResults: [],
      };
      await saveSession(rec);
      const percentile = calculatePersonalPercentile(avgScore, pastScores);
      logEvent('score_achieved', { score: avgScore, mode: 'tone_gym', language: settings.currentLanguage || 'cantonese' });
      phCapture('score_achieved', { score: avgScore, mode: 'tone_gym', language: settings.currentLanguage || 'cantonese', percentile });
      onComplete?.({ ...rec, language, streakCount, freezeUsed: streakResult.freezeUsed, freezeNotAvailable: streakResult.freezeNotAvailable, correct, total: TOTAL_ROUNDS, toneResults });
    } catch (err) {
      setFinishError(true);
    }
  }, [sessionStart, correct, toneResults, updateSettings, settings, onComplete, language]);

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
            {language === 'mandarin'
              ? 'Mandarin has 4 tones (plus a light neutral tone). The same syllable with a different tone means a completely different word.'
              : 'Cantonese has 6 tones. The same syllable with a different tone means a completely different word.'}
          </p>
          <div className={styles.introExample}>
            {language === 'mandarin' ? (
              <>
                <button className={styles.introToneBtn} onClick={() => speak('妈')}>
                  <span className={styles.introJyut}>mā</span>
                  <span className={styles.introMeaning}>mom</span>
                  <span className={styles.introChar}>妈</span>
                  <span className={styles.introToneLabel}>high and level ▶</span>
                </button>
                <span className={styles.introVs}>vs</span>
                <button className={styles.introToneBtn} onClick={() => speak('骂')}>
                  <span className={styles.introJyut}>mà</span>
                  <span className={styles.introMeaning}>scold</span>
                  <span className={styles.introChar}>骂</span>
                  <span className={styles.introToneLabel}>sharp falling ▶</span>
                </button>
              </>
            ) : (
              <>
                <button className={styles.introToneBtn} onClick={() => speak('媽')}>
                  <span className={styles.introJyut}>maa1</span>
                  <span className={styles.introMeaning}>mother</span>
                  <span className={styles.introChar}>媽</span>
                  <span className={styles.introToneLabel}>high flat ▶</span>
                </button>
                <span className={styles.introVs}>vs</span>
                <button className={styles.introToneBtn} onClick={() => speak('麻')}>
                  <span className={styles.introJyut}>maa4</span>
                  <span className={styles.introMeaning}>numb</span>
                  <span className={styles.introChar}>麻</span>
                  <span className={styles.introToneLabel}>low falling ▶</span>
                </button>
              </>
            )}
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
          <p className={styles.learnTitle}>Listen to both, hear the difference</p>

          <div className={styles.learnPair}>
            {currentPair.tones.map((t, i) => (
              <button key={i} className={styles.learnCard} onClick={() => speak(t.char)}>
                <span className={styles.learnJyut}>{t.romanization}</span>
                <span className={styles.learnDesc}>{t.desc}</span>
                <span className={styles.learnChar} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{t.char}</span>
                <span className={styles.learnMeaning}>{t.meaning}</span>
                <span className={styles.learnPlay}>▶ Play</span>
              </button>
            ))}
          </div>

          <button className={styles.readyBtn} onClick={handleDoneLearn}>
            I hear the difference, quiz me
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
        <button className={styles.listenBtn} onClick={() => speak(currentPair.tones[correctIndex].char)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Play again
        </button>
        {speaking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, opacity: 0.85 }}>
            <AudioStateIndicator state="playing" />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
              listening…
            </span>
          </div>
        )}
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
                else speak(t.char); // In feedback, tap to replay
              }}
              disabled={false}>
              <span className={styles.choiceJyutping}>{t.romanization}</span>
              <span className={styles.choiceDesc}>{t.desc}</span>
              <span className={styles.choiceChar} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{t.char}</span>
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
            {chosen === correctIndex ? '✓ Correct!' : `✗ It was ${currentPair.tones[correctIndex].char} (${currentPair.tones[correctIndex].romanization})`}
          </p>
          {finishError && (
            <p style={{ fontSize: '13px', color: '#E84040', fontFamily: 'var(--font-ui)', textAlign: 'center', marginBottom: '8px', lineHeight: 1.5 }}>
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
