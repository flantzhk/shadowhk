import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import styles from './FirstRunFlow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { saveLibraryEntry } from '../../services/storage.js';
import { getAllScenes, getYouLines } from '../../services/sceneLoader.js';
import { phCapture } from '../../services/posthog.js';
import { logger } from '../../utils/logger.js';
import { SOURCE_TAGS, GROWTH_STATE, ROUTES } from '../../utils/constants.js';
import { SIX_TONES, FOUR_TONES } from '../../utils/toneData.js';
import { staticWordAudio } from '../../services/staticAudio.js';
import { textToSpeech } from '../../services/api.js';
import { useRecorder } from '../../hooks/useRecorder.js';
import { blobIsAudible } from '../../utils/audioSignal.js';
import { submitPlacementAttempt } from '../../services/placementCheck.js';

const TOTAL_STEPS = 8;
const HARBOUR_URL = '/shadowhk/images/scenes/ferry.jpg';
const DIMSUM_URL = '/shadowhk/images/scenes/firstrun-dimsum.jpg';

// The listen-and-repeat check (step 6) always uses two real-scene lines —
// audio already exists for them, and they preview the scene the user is
// about to start regardless of which free scene ends up chosen.
const CANTONESE_PLACEMENT_PHRASES = [
  { id: 'dim-sum-01', cjk: '唔該，有冇位呀？', jyutping: 'm4 goi1, jau5 mou5 wai2 aa3?', english: 'Excuse me, do you have a table?', audioFile: 'dim-sum-01.mp3' },
  { id: 'dim-sum-03', cjk: '四位，麻煩晒。', jyutping: 'sei3 wai2, maa4 faan4 saai3.', english: 'Four people, thank you.', audioFile: 'dim-sum-03.mp3' },
];
const MANDARIN_PLACEMENT_PHRASES = [
  { id: 'mandarin-restaurant-01', cjk: '你好，两位。', jyutping: 'nǐ hǎo, liǎng wèi.', english: 'Hello, table for two.', audioFile: 'mandarin-restaurant-01.mp3' },
  { id: 'mandarin-restaurant-09', cjk: '服务员，买单，谢谢。', jyutping: 'fú wù yuán, mǎi dān, xiè xiè.', english: 'Waiter, the bill please, thanks.', audioFile: 'mandarin-restaurant-09.mp3' },
];

function getLevels(language) {
  const langName = language === 'mandarin' ? 'Mandarin' : 'Cantonese';
  return [
    { id: 'zero',       label: `I know zero ${langName}`, sub: 'Start with the first 10 phrases' },
    { id: 'basics',     label: 'A few basics',            sub: 'Greetings, counting, food names' },
    { id: 'conv',       label: 'Conversational',          sub: 'I can order food and small-talk' },
    { id: 'returning',  label: 'Returning learner',       sub: 'I want to refresh rusty phrases' },
  ];
}

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


// Picks a first scene using the already-collected "what brought you here"
// answer instead of always defaulting to the same scene.
function pickSceneId(reasons, language) {
  if (language === 'mandarin') {
    if (reasons.has('food')) return 'mandarin-restaurant';
    if (reasons.has('transport')) return 'mandarin-taxi';
    return 'mandarin-greetings-family';
  }
  if (reasons.has('food')) return 'dim-sum';
  if (reasons.has('transport')) return 'taxi';
  return 'wet-market';
}

export default function FirstRunFlow({ onComplete, onNavigate }) {
  const { settings, updateSettings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const PLACEMENT_PHRASES = language === 'mandarin' ? MANDARIN_PLACEMENT_PHRASES : CANTONESE_PLACEMENT_PHRASES;
  const TONES = language === 'mandarin' ? FOUR_TONES : SIX_TONES;

  const [step, setStep] = useState(0);   // 0–7
  const [level, setLevel] = useState('');
  const [reasons, setReasons] = useState(new Set());
  const [goal, setGoal] = useState(5);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [firstScene, setFirstScene] = useState(null);
  const audioElRef = useRef(null);
  const [playingChar, setPlayingChar] = useState(null);

  // Step 6 — listen-and-repeat placement check
  const [placementIndex, setPlacementIndex] = useState(0);
  const [placementDone, setPlacementDone] = useState(new Set());
  const [placementScoring, setPlacementScoring] = useState(false);
  const { isRecording: placementRecording, startRecording, stopRecording, error: micError } = useRecorder();

  useEffect(() => {
    phCapture('firstrun_step_viewed', { step: step + 1 });
  }, [step]);

  const speakTone = useCallback(async (char) => {
    audioElRef.current?.pause();
    setPlayingChar(char);
    try {
      const blob = (await staticWordAudio(char, language)) ?? await textToSpeech(char, { language });
      if (!blob || blob.size === 0) { setPlayingChar(null); return; }
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      audioElRef.current = el;
      el.onended = () => { setPlayingChar(null); URL.revokeObjectURL(url); };
      el.onerror = () => { setPlayingChar(null); URL.revokeObjectURL(url); };
      await el.play();
    } catch {
      setPlayingChar(null);
    }
  }, [language]);

  const goForward = async () => {
    if (step === 5) {
      // Save goal before the placement check
      await updateSettings({ dailyGoalMinutes: goal, reminderTime }).catch(err => logger.warn('[FirstRunFlow] settings save failed', err?.message));
    }
    if (step === 6) {
      // Placement check done (or skipped) — pick + load the first scene
      const scenes = await getAllScenes(language).catch(() => []);
      const sceneId = pickSceneId(reasons, language);
      const fallbackId = language === 'mandarin' ? 'mandarin-greetings-family' : 'dim-sum';
      setFirstScene(scenes.find(s => s.id === sceneId) ?? scenes.find(s => s.id === fallbackId) ?? scenes[0] ?? null);
    }
    setStep(s => s + 1);
  };

  const handlePlacementRecord = useCallback(async () => {
    await startRecording();
  }, [startRecording]);

  const handlePlacementStop = useCallback(async () => {
    const blob = await stopRecording();
    const phrase = PLACEMENT_PHRASES[placementIndex];
    if (!blob || !phrase || !(await blobIsAudible(blob))) return;
    setPlacementScoring(true);
    const { settingsUpdate } = await submitPlacementAttempt(phrase.id, phrase.cjk, blob, settings, language);
    if (settingsUpdate) await updateSettings(settingsUpdate).catch(() => {});
    setPlacementDone(prev => new Set(prev).add(phrase.id));
    setPlacementScoring(false);
    if (placementIndex < PLACEMENT_PHRASES.length - 1) setPlacementIndex(i => i + 1);
  }, [stopRecording, placementIndex, settings, updateSettings, language, PLACEMENT_PHRASES]);

  const finish = () => {
    phCapture('firstrun_completed');
    updateSettings({ firstrunCompleted: true }).catch(err => logger.warn('[FirstRunFlow] finish settings failed', err?.message));
    if (firstScene) onNavigate?.('shadow', firstScene.id);
    else onComplete?.();
  };

  const browseScenes = () => {
    phCapture('firstrun_browse_scenes');
    updateSettings({ firstrunCompleted: true }).catch(err => logger.warn('[FirstRunFlow] browseScenes settings failed', err?.message));
    onNavigate?.('scenes');
  };

  const toggleReason = (id) => {
    setReasons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };


  const showBack = step > 0;
  const showSkip = step > 0 && step < 7;
  const placementPhrase = PLACEMENT_PHRASES[placementIndex];
  const placementPhraseDone = placementDone.has(placementPhrase.id);

  // Final step is a full-screen override
  if (step === 7) {
    const scene = firstScene;
    return (
      <div className={styles.finalScreen} style={{ backgroundImage: scene?.imageUrl ? `url(${scene.imageUrl})` : `url(${language === 'mandarin' ? HARBOUR_URL : DIMSUM_URL})` }}>
        <div className={styles.finalOverlay} />
        <div className={styles.finalContent}>
          <p className={styles.finalEyebrow}>YOUR FIRST SCENE</p>
          <h1 className={styles.finalTitle}>{scene?.title ?? (language === 'mandarin' ? 'Greetings and family' : 'Ordering dim sum')}</h1>
          <p className={styles.finalMeta}>
            {scene?.lines?.filter(l => l.speaker === 'you').length ?? 12} phrases
            {scene?.estimatedMinutes ? ` · ${scene.estimatedMinutes} min` : ' · 7 min'}. You can finish before your tea cools.
          </p>
          <button className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={finish}>
            Start shadowing
          </button>
          <button className={styles.browseLink} onClick={browseScenes}>
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
        {/* Per-step page header (eyebrow shows step counter — hidden on cover screen) */}
        {step > 0 && (
          <div className={styles.pageHeader}>
            <span className={styles.pageEyebrow}>
              <span className={styles.pageEyebrowDot} />
              STEP {step + 1} OF {TOTAL_STEPS}
            </span>
          </div>
        )}
        {/* Step 1 — Welcome (PDF Plate 10) */}
        {step === 0 && (
          <div className={styles.step1}>
            <div className={styles.brandRow}>
              <div className={`${styles.brandTile} logo-dot`}>影</div>
              <span className={styles.brandName}>ShadowHK</span>
            </div>
            <p className={styles.welcomeEyebrow}>ISSUE 01 · WELCOME</p>
            {language === 'mandarin' ? (
              <>
                <h1 className={`${styles.stepTitle} ${styles.pageTitle}`}>
                  Mandarin speaks <em>in tones</em>.<br />
                  Most people never hear them.
                </h1>
                <p className={styles.stepBody}>
                  ShadowHK is built on real conversations: the ones overheard at markets, in taxis, at hotel front desks. Not phrasebook-Mandarin. The Mandarin that works.
                </p>
                <p className={styles.stepProof}>
                  Order at a restaurant. Hail a taxi. Check into a hotel. All in the Mandarin people actually speak.
                </p>
              </>
            ) : (
              <>
                <h1 className={`${styles.stepTitle} ${styles.pageTitle}`}>
                  Hong Kong speaks <em>in tones</em>.<br />
                  Most people never hear them.
                </h1>
                <p className={styles.stepBody}>
                  ShadowHK is built on real conversations: the ones overheard at wet markets, in taxis, at cha chaan tengs at four in the morning. Not phrasebook-Cantonese. The Cantonese that works.
                </p>
                <p className={styles.stepProof}>
                  Order dim sum. Hail a taxi. Bargain at the wet market. All in the Cantonese people actually speak.
                </p>
              </>
            )}
          </div>
        )}

        {/* Step 2 — How to read the romanization (tones) */}
        {step === 1 && (
          <div className={styles.step2}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>
              {language === 'mandarin' ? 'Mandarin has 4 tones' : 'Cantonese has 6 tones'}
            </h2>
            <p className={styles.reminderSub}>
              {language === 'mandarin'
                ? 'Pinyin spells each syllable with a mark for its tone: same letters, different mark, different word entirely. Tap to hear it.'
                : 'Jyutping spells each syllable with a number for its tone: same letters, different number, different word entirely. Tap to hear it.'}
            </p>
            <div className={styles.toneList}>
              {TONES.map(t => (
                <button key={t.tone} type="button" className={styles.toneRow} onClick={() => speakTone(t.char)}>
                  <span className={styles.toneNum}>{t.tone}</span>
                  <span className={styles.toneJyut}>{t.romanization}</span>
                  <span className={styles.toneChar} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{t.char}</span>
                  <span className={styles.toneDesc}>{t.desc}</span>
                  <span className={styles.toneMeaning}>{t.meaning}</span>
                  <span className={`${styles.tonePlay} ${playingChar === t.char ? styles.tonePlaying : ''}`}>▶</span>
                </button>
              ))}
            </div>
            <p className={styles.stepFootnote}>
              You can revisit this anytime from Home → {language === 'mandarin' ? 'Read Pinyin' : 'Read Jyutping'}.
            </p>
          </div>
        )}

        {/* Step 3 — Level */}
        {step === 2 && (
          <div className={styles.step2}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>Where are you starting from?</h2>
            <div className={styles.levelCards}>
              {getLevels(language).map(l => (
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

        {/* Step 4 — Reasons */}
        {step === 3 && (
          <div className={styles.step3}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>What brought you here?</h2>
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

        {/* Step 5 — Daily goal */}
        {step === 4 && (
          <div className={styles.step4}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>How much time per day?</h2>
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

        {/* Step 6 — Reminder */}
        {step === 5 && (
          <div className={styles.step5}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>When should we nudge you?</h2>
            <p className={styles.reminderSub}>Pick a time that works every day.</p>
            <div className={styles.timePickerWrap}>
              <input
                type="time"
                className={styles.timePicker}
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 7 — Listen-and-repeat placement check */}
        {step === 6 && (
          <div className={styles.step2}>
            <h2 className={`${styles.stepHeading} ${styles.pageTitle}`}>Say it back</h2>
            <p className={styles.reminderSub}>Two phrases, so we know where you're actually starting from.</p>
            <div className={styles.placementCard}>
              <p className={styles.placementCounter}>{placementIndex + 1} of {PLACEMENT_PHRASES.length}</p>
              <p className={styles.toneJyut}>{placementPhrase.jyutping}</p>
              <p className={styles.placementChar} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{placementPhrase.cjk}</p>
              <p className={styles.stepFootnote}>{placementPhrase.english}</p>
              <div className={styles.placementActions}>
                <button
                  type="button"
                  className={styles.placementPlayBtn}
                  onClick={() => { new Audio(`/shadowhk/audio/${language}/${placementPhrase.audioFile}`).play().catch(() => {}); }}
                >
                  ▶ Listen
                </button>
                <button
                  type="button"
                  className={`${styles.placementRecordBtn} ${placementRecording ? styles.placementRecordBtnActive : ''}`}
                  onClick={placementRecording ? handlePlacementStop : handlePlacementRecord}
                  disabled={placementScoring}
                >
                  {placementRecording ? 'Stop' : placementPhraseDone ? 'Say it again' : 'Say it'}
                </button>
              </div>
              {placementPhraseDone && !placementRecording && !placementScoring && (
                <p className={styles.placementDoneBadge}>Got it</p>
              )}
              {micError && <p className={styles.placementError}>{micError}</p>}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <button
          className={styles.primaryBtn}
          onClick={goForward}
          disabled={step === 2 && !level || step === 3 && reasons.size === 0}
        >
          {step === 0 ? 'Get started' : step === 5 ? 'Turn on reminders' : step === 6 ? 'Continue' : 'Next'}
        </button>
        {step === 5 && (
          <button className={styles.ghostLink} onClick={goForward}>Skip for now</button>
        )}
        {step === 6 && (
          <button className={styles.ghostLink} onClick={goForward}>Skip this check</button>
        )}
      </div>
    </div>
  );
}
