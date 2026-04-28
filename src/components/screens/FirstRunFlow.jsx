import { useState, lazy, Suspense } from 'react';
import styles from './FirstRunFlow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { saveLibraryEntry } from '../../services/storage.js';
import { getAllScenes, getYouLines } from '../../services/sceneLoader.js';
import { logger } from '../../utils/logger.js';
import { SOURCE_TAGS, GROWTH_STATE, ROUTES } from '../../utils/constants.js';

const TOTAL_STEPS = 6;
const HARBOUR_URL = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80';
const DIMSUM_URL = 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80';

const LEVELS = [
  { id: 'zero',       label: 'I know zero Cantonese',  sub: 'Start with the first 10 phrases' },
  { id: 'basics',     label: 'A few basics',            sub: 'Greetings, counting, food names' },
  { id: 'conv',       label: 'Conversational',          sub: 'I can order food and small-talk' },
  { id: 'returning',  label: 'Returning learner',       sub: 'I want to refresh rusty phrases' },
];

const REASONS = [
  { id: 'food',      emoji: '🥟', label: 'Food & dining' },
  { id: 'transport', emoji: '🚕', label: 'Getting around' },
  { id: 'friends',   emoji: '👋', label: 'Making friends' },
  { id: 'work',      emoji: '💼', label: 'Work in HK' },
  { id: 'partner',   emoji: '❤️', label: 'Partner / in-laws' },
  { id: 'longterm',  emoji: '🏙', label: 'Living here long-term' },
];

const GOALS = [
  { id: 2,  label: '2 min · Casual',    dots: 4 },
  { id: 5,  label: '5 min · Regular',   dots: 7 },
  { id: 10, label: '10 min · Serious',  dots: 12 },
  { id: 15, label: '15 min · Committed',dots: 18 },
];

const DAYS = ['M','T','W','T','F','S','S'];

export default function FirstRunFlow({ onComplete, onNavigate }) {
  const { settings, updateSettings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [step, setStep] = useState(0);   // 0–5
  const [level, setLevel] = useState('');
  const [reasons, setReasons] = useState(new Set());
  const [goal, setGoal] = useState(5);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [activeDays, setActiveDays] = useState(new Set([0,1,2,3,4,5,6]));
  const [firstScene, setFirstScene] = useState(null);

  const goForward = async () => {
    if (step === 4) {
      // Save goal + load first scene before showing step 5
      await updateSettings({ dailyGoalMinutes: goal, reminderTime }).catch(err => logger.warn('[FirstRunFlow] settings save failed', err?.message));
      const scenes = await getAllScenes(language).catch(() => []);
      setFirstScene(scenes.find(s => s.id === 'dim-sum') ?? scenes[0] ?? null);
    }
    if (step === 5) { finish(); return; }
    setStep(s => s + 1);
  };

  const finish = () => {
    updateSettings({ firstrunCompleted: true }).catch(err => logger.warn('[FirstRunFlow] finish settings failed', err?.message));
    if (firstScene) onNavigate?.('shadow', firstScene.id);
    else onComplete?.();
  };

  const toggleReason = (id) => {
    setReasons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const toggleDay = (i) => {
    setActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const showBack = step > 0;
  const showSkip = step > 0 && step < 5;

  // Step 6 is a full-screen override
  if (step === 5) {
    const scene = firstScene;
    return (
      <div className={styles.finalScreen} style={{ backgroundImage: scene?.imageUrl ? `url(${scene.imageUrl})` : `url(${DIMSUM_URL})` }}>
        <div className={styles.finalOverlay} />
        <div className={styles.finalContent}>
          <p className={styles.finalEyebrow}>YOUR FIRST SCENE</p>
          <h1 className={styles.finalTitle}>{scene?.title ?? 'Ordering dim sum'}</h1>
          <p className={styles.finalMeta}>
            {scene?.lines?.filter(l => l.speaker === 'you').length ?? 12} phrases
            {scene?.estimatedMinutes ? ` · ${scene.estimatedMinutes} min` : ' · 7 min'}. You can finish before your tea cools.
          </p>
          <button className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={finish}>
            Start shadowing
          </button>
          <button className={styles.browseLink} onClick={() => onNavigate?.('scenes')}>
            Browse other scenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      {step === 0 && <div className={styles.ambientBg} style={{ backgroundImage: `url(${HARBOUR_URL})` }} />}
      {step === 0 && <div className={styles.darkOverlay} />}

      {/* Chrome */}
      <div className={styles.chrome}>
        {showBack ? (
          <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        ) : <div className={styles.backBtn} />}

        {/* Progress dots */}
        <div className={styles.progressDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i < step ? styles.dotDone : i === step ? styles.dotCurrent : styles.dotUpcoming}`}
            />
          ))}
        </div>

        {showSkip ? (
          <button className={styles.skipBtn} onClick={finish}>Skip</button>
        ) : <div style={{ width: 32 }} />}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Step 1 — Welcome */}
        {step === 0 && (
          <div className={styles.step1}>
            <div className={styles.brandTile}>影</div>
            <p className={styles.brandName}>ShadowHK</p>
            <h1 className={styles.stepTitle}>Cantonese the way locals speak it</h1>
            <p className={styles.stepBody}>Shadow real HK situations. No lesson plans. No textbook phrases.</p>
          </div>
        )}

        {/* Step 2 — Level */}
        {step === 1 && (
          <div className={styles.step2}>
            <h2 className={styles.stepHeading}>Where are you starting from?</h2>
            <div className={styles.levelCards}>
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  className={`${styles.levelCard} ${level === l.id ? styles.levelCardActive : ''}`}
                  onClick={() => setLevel(l.id)}
                >
                  <p className={styles.levelCardTitle}>
                    <span className={styles.radioIcon}>{level === l.id ? '◉' : '○'}</span>
                    {l.label}
                  </p>
                  <p className={styles.levelCardSub}>{l.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Reasons */}
        {step === 2 && (
          <div className={styles.step3}>
            <h2 className={styles.stepHeading}>What brought you here?</h2>
            <div className={styles.reasonGrid}>
              {REASONS.map(r => (
                <button
                  key={r.id}
                  className={`${styles.reasonTile} ${reasons.has(r.id) ? styles.reasonTileActive : ''}`}
                  onClick={() => toggleReason(r.id)}
                >
                  <span className={styles.reasonEmoji}>{r.emoji}</span>
                  <span className={styles.reasonLabel}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 — Daily goal */}
        {step === 3 && (
          <div className={styles.step4}>
            <h2 className={styles.stepHeading}>How much time per day?</h2>
            <div className={styles.goalChips}>
              {GOALS.map(g => (
                <button
                  key={g.id}
                  className={`${styles.goalChip} ${goal === g.id ? styles.goalChipActive : ''}`}
                  onClick={() => setGoal(g.id)}
                >
                  <span className={styles.goalLabel}>{g.label}</span>
                  <span className={styles.goalDots}>
                    {Array.from({ length: Math.min(g.dots, 18) }).map((_, i) => (
                      <span key={i} className={`${styles.goalDot} ${goal === g.id ? styles.goalDotFilled : ''}`} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
            {goal && <p className={styles.goalActiveSub}>We'll remind you at a time you pick</p>}
          </div>
        )}

        {/* Step 5 — Reminder */}
        {step === 4 && (
          <div className={styles.step5}>
            <h2 className={styles.stepHeading}>When should we nudge you?</h2>
            <p className={styles.reminderSub}>Pick a time that works every day.</p>
            <div className={styles.timePickerWrap}>
              <input
                type="time"
                className={styles.timePicker}
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
              />
            </div>
            <div className={styles.dayChips}>
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  className={`${styles.dayChip} ${activeDays.has(i) ? styles.dayChipOn : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <button
          className={styles.primaryBtn}
          onClick={goForward}
          disabled={step === 1 && !level || step === 2 && reasons.size === 0}
        >
          {step === 0 ? 'Get started' : step === 4 ? 'Turn on reminders' : 'Next'}
        </button>
        {step === 4 && (
          <button className={styles.ghostLink} onClick={goForward}>Skip for now</button>
        )}
      </div>
    </div>
  );
}
