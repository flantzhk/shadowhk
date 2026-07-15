// src/components/screens/CharacterCheck.jsx — Reading recognition: characters
// only, no Jyutping, no audio. A different skill from every other practice
// mode (all of which are audio-in/speech-out) — can you read it cold?

import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntries, saveSession } from '../../services/storage.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { phCapture } from '../../services/posthog.js';
import styles from './CharacterCheck.module.css';

const TOTAL_ROUNDS = 10;
const MIN_ENTRIES = 4; // need 1 correct + 3 distractors for a meaningful choice

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildRound(target, pool) {
  // Dedupe by english text, not just phraseId — different saved phrases can
  // share an identical gloss, which would otherwise show the same choice twice.
  const seen = new Set([target.english]);
  const distractors = [];
  for (const e of shuffle(pool)) {
    if (distractors.length >= 3) break;
    if (e.phraseId === target.phraseId || seen.has(e.english)) continue;
    seen.add(e.english);
    distractors.push(e.english);
  }
  const choices = shuffle([target.english, ...distractors]);
  return { target, choices, correctIndex: choices.indexOf(target.english) };
}

export default function CharacterCheck({ onBack }) {
  const { settings, updateSettings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);
  const [sessionSet, setSessionSet] = useState([]);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [roundData, setRoundData] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [phase, setPhase] = useState('choose'); // choose | feedback | done
  const [sessionStart] = useState(Date.now());
  const [finishError, setFinishError] = useState(false);

  useEffect(() => {
    getLibraryEntries(language)
      .then(entries => {
        const withText = entries.filter(e => e.cjk && e.english);
        setPool(withText);
        const set = shuffle(withText).slice(0, TOTAL_ROUNDS);
        setSessionSet(set);
        if (set.length > 0) setRoundData(buildRound(set[0], withText));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [language]);

  const handleChoice = useCallback((idx) => {
    if (phase !== 'choose') return;
    setChosen(idx);
    if (idx === roundData.correctIndex) setCorrect(c => c + 1);
    setPhase('feedback');
  }, [phase, roundData]);

  const finish = useCallback(async () => {
    setFinishError(false);
    try {
      const dur = Math.round((Date.now() - sessionStart) / 1000);
      const streakResult = await updateStreak();
      phCapture('session_completed', { mode: 'character-check', correct_answers: correct });
      await updateSettings({
        totalPracticeSeconds: (settings.totalPracticeSeconds || 0) + dur,
        ...(streakResult ? { streakCount: streakResult.count } : {}),
      });
      await saveSession({
        id: crypto.randomUUID(), date: getTodayString(),
        startedAt: sessionStart, completedAt: Date.now(), durationSeconds: dur,
        mode: 'character-check', language, phrasesAttempted: sessionSet.length, phrasesMastered: 0,
        averageScore: Math.round((correct / sessionSet.length) * 100), phraseResults: [],
      });
      setPhase('done');
    } catch (err) {
      setFinishError(true);
    }
  }, [sessionStart, correct, sessionSet, settings, updateSettings, language]);

  const handleNext = useCallback(() => {
    const next = round + 1;
    if (next >= sessionSet.length) { finish(); return; }
    setRound(next);
    setRoundData(buildRound(sessionSet[next], pool));
    setChosen(null);
    setPhase('choose');
  }, [round, sessionSet, pool, finish]);

  if (loading) return null;

  if (pool.length < MIN_ENTRIES) {
    return (
      <div className={styles.screen}>
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Not enough saved phrases yet</p>
          <p className={styles.emptyBody}>
            Save at least {MIN_ENTRIES} phrases to your library while shadowing a scene, then come back to test how well you can read them.
          </p>
          <button className={styles.primaryBtn} onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className={styles.screen}>
        <div className={styles.doneBlock}>
          <p className={styles.doneTitle}>{correct}/{sessionSet.length} correct</p>
          <p className={styles.doneSub}>
            {correct === sessionSet.length
              ? 'You read every one cold.'
              : 'Reading and speaking are different skills. This is what reading alone looks like right now.'}
          </p>
          <button className={styles.primaryBtn} onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className={styles.score}>{correct}/{round + (phase === 'feedback' ? 1 : 0)}</span>
        <span className={styles.roundCount}>{round + 1}/{sessionSet.length}</span>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${((round + (phase === 'feedback' ? 1 : 0)) / sessionSet.length) * 100}%` }} />
      </div>

      <div className={styles.promptArea}>
        <span className={styles.label}>What does this mean?</span>
        <p className={styles.char} lang="yue">{roundData.target.cjk}</p>
      </div>

      <div className={styles.choiceList}>
        {roundData.choices.map((choice, i) => {
          let variant = '';
          if (phase === 'feedback') {
            if (i === roundData.correctIndex) variant = styles.choiceCorrect;
            else if (i === chosen) variant = styles.choiceWrong;
          }
          return (
            <button key={i} className={`${styles.choiceBtn} ${variant}`} onClick={() => handleChoice(i)}>
              {choice}
            </button>
          );
        })}
      </div>

      {phase === 'feedback' && (
        <div className={styles.feedbackArea}>
          {finishError && (
            <p className={styles.finishErrorText}>Something went wrong saving that. Check your connection and try again.</p>
          )}
          <button className={styles.nextBtn} onClick={handleNext}>
            {round + 1 >= sessionSet.length ? (finishError ? 'Retry' : 'See results') : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
