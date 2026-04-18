import { useState, lazy, Suspense } from 'react';
import styles from './FirstRunFlow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { FlowMap } from '../ui/FlowMap.jsx';
import { SceneCard } from '../ui/SceneCard.jsx';
import { PhraseTile } from '../ui/PhraseTile.jsx';
import { Wave } from '../ui/Wave.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { scorePronunciation } from '../../services/api.js';
import { saveLibraryEntry } from '../../services/storage.js';
import { getAllScenes, getYouLines } from '../../services/sceneLoader.js';
import { SOURCE_TAGS, GROWTH_STATE, SCORE_THRESHOLDS } from '../../utils/constants.js';

const IntroduceYourselfForm = lazy(() => import('./IntroduceYourselfForm.jsx'));

const STEPS = ['Try it', 'Pick scenes', 'Your library', 'First lesson'];

const STARTER_PHRASE = {
  id: 'onboarding-mgoi',
  cjk: '唔該',
  romanization: 'm4 goi1',
  english: 'excuse me / please / thank you',
  language: 'cantonese',
  audioFile: 'mgoi.mp3',
};

export default function FirstRunFlow({ onComplete, onNavigate }) {
  const { settings, updateSettings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [selectedSceneIds, setSelectedSceneIds] = useState(new Set());
  const [libraryPhrases, setLibraryPhrases] = useState([]);
  const [scenesLoaded, setScenesLoaded] = useState(false);

  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();

  async function handleRecord() {
    await startRecording();
  }

  async function handleStopRecording() {
    const blob = await stopRecording();
    if (!blob) return;
    setIsScoring(true);
    try {
      const result = await scorePronunciation(blob, STARTER_PHRASE.cjk, language);
      setScore(result.score);
    } catch (_) {
      setScore(null);
    } finally {
      setIsScoring(false);
    }
  }

  async function goToPickScenes() {
    if (!scenesLoaded) {
      const loaded = await getAllScenes(language).catch(() => []);
      setScenes(loaded);
      setScenesLoaded(true);
    }
    setStep(1);
  }

  function toggleScene(id) {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function goToLibraryPreview() {
    const selectedScenes = scenes.filter(s => selectedSceneIds.has(s.id));
    const phrases = [];
    for (const s of selectedScenes) {
      for (const line of getYouLines(s)) {
        phrases.push({ ...line, scene_id: s.id, sceneTitle: s.title });
      }
    }
    setLibraryPhrases(phrases);

    // Save all phrases to library
    for (const phrase of phrases) {
      await saveLibraryEntry({
        id: phrase.id,
        cjk: phrase.cjk,
        romanization: phrase.romanization,
        english: phrase.english,
        language,
        scene_id: phrase.scene_id,
        source_tag: SOURCE_TAGS.LIBRARY,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString().slice(0, 10),
        lastPracticed: null,
        lived_at: null,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      }).catch(() => {});
    }

    setStep(2);
  }

  function startFirstLesson() {
    const firstSceneId = [...selectedSceneIds][0];
    if (firstSceneId) {
      updateSettings({ firstrunCompleted: true }).catch(() => {});
      onNavigate('shadow', firstSceneId);
    } else {
      updateSettings({ firstrunCompleted: true }).catch(() => {});
      onComplete?.();
    }
  }

  const scoreColor = score === null ? undefined
    : score >= 80 ? 'var(--color-score-excellent)'
    : score >= 60 ? 'var(--color-brand-green)'
    : score >= 40 ? 'var(--color-warning)'
    : 'var(--color-error)';

  return (
    <div className={styles.screen}>
      <div className={styles.flowmapRow}>
        <FlowMap steps={STEPS} activeIndex={step} />
      </div>

      <div className={styles.content}>
        {step === 0 && (
          <div className={styles.tryStep}>
            <div className={styles.phraseBlock}>
              <p className={styles.romanization}>{STARTER_PHRASE.romanization}</p>
              <p className={styles.cjk}>{STARTER_PHRASE.cjk}</p>
              <p className={styles.english}>{STARTER_PHRASE.english}</p>
            </div>

            <p className={styles.hint}>Say it back. No sign-up needed.</p>

            <div className={styles.micArea}>
              {isScoring ? (
                <div className={styles.scoringSpinner} />
              ) : score !== null ? (
                <div className={styles.scoreResult}>
                  <span className={styles.scoreNum} style={{ color: scoreColor }}>{score}</span>
                  <p className={styles.scoreLabel}>
                    {score >= SCORE_THRESHOLDS.EXCELLENT ? 'That was it.' : score >= 60 ? 'Close.' : 'Try again.'}
                  </p>
                </div>
              ) : (
                <button
                  className={`${styles.micBtn} ${isRecording ? styles.micRecording : ''}`}
                  onMouseDown={handleRecord}
                  onMouseUp={handleStopRecording}
                  onTouchStart={handleRecord}
                  onTouchEnd={handleStopRecording}
                  aria-label="Hold to record"
                >
                  {isRecording ? <Wave active /> : <MicIcon />}
                </button>
              )}
              {micError && <p className={styles.micError}>Mic not detected — check permissions</p>}
            </div>

            <div className={styles.stepActions}>
              {score !== null && (
                <button className={styles.retryMicBtn} onClick={() => setScore(null)}>
                  Try again
                </button>
              )}
              <button className={styles.primaryBtn} onClick={goToPickScenes}>
                {score !== null ? 'Pick your scenes' : 'Skip for now'}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={styles.pickStep}>
            <h2 className={styles.stepTitle}>Pick 3 to 5 scenes</h2>
            <p className={styles.stepDesc}>Your library will be built from these.</p>
            <div className={styles.sceneGrid}>
              {scenes.map(s => (
                <div
                  key={s.id}
                  className={`${styles.scenePickWrap} ${selectedSceneIds.has(s.id) ? styles.sceneSelected : ''}`}
                  onClick={() => toggleScene(s.id)}
                >
                  <SceneCard
                    emoji={s.emoji}
                    title={s.title}
                    phraseCount={getYouLines(s).length}
                    duration={s.estimatedMinutes ?? 5}
                    status="fresh"
                  />
                  {selectedSceneIds.has(s.id) && <div className={styles.selectedCheck}>✓</div>}
                </div>
              ))}
            </div>
            <button
              className={styles.primaryBtn}
              onClick={goToLibraryPreview}
              disabled={selectedSceneIds.size === 0}
            >
              Build my library ({selectedSceneIds.size} selected)
            </button>
          </div>
        )}

        {step === 2 && (
          <div className={styles.libraryStep}>
            <h2 className={styles.stepTitle}>You now know {libraryPhrases.length} phrases</h2>
            <p className={styles.stepDesc}>These are ready to practice.</p>
            <div className={styles.phraseList}>
              {libraryPhrases.slice(0, 10).map(p => (
                <PhraseTile
                  key={p.id}
                  phrase={p}
                  growthState={GROWTH_STATE.NEW}
                  showActions={false}
                />
              ))}
              {libraryPhrases.length > 10 && (
                <p className={styles.moreNote}>+ {libraryPhrases.length - 10} more</p>
              )}
            </div>

            {/* Introduce yourself nudge */}
            <div className={styles.introduceNudge}>
              <span className={styles.nudgeEmoji}>👋</span>
              <div className={styles.nudgeText}>
                <p className={styles.nudgeTitle}>Want to introduce yourself?</p>
                <p className={styles.nudgeDesc}>We'll build you a personal scene from your real life.</p>
              </div>
              <button className={styles.nudgeBtn} onClick={() => setStep('introduce')}>
                Try it
              </button>
            </div>

            <button className={styles.primaryBtn} onClick={() => setStep(3)}>
              Start my first lesson
            </button>
          </div>
        )}

        {step === 'introduce' && (
          <Suspense fallback={<div className={styles.loadingForm} />}>
            <IntroduceYourselfForm
              onBack={() => setStep(2)}
              onComplete={({ scene, phraseCount: pc }) => {
                setStep(3);
              }}
            />
          </Suspense>
        )}

        {step === 3 && (
          <div className={styles.readyStep}>
            <div className={styles.readyEmoji}>
              {scenes.find(s => selectedSceneIds.has(s.id))?.emoji ?? '🎤'}
            </div>
            <h2 className={styles.stepTitle}>
              {scenes.find(s => selectedSceneIds.has(s.id))?.title ?? 'Your first scene'}
            </h2>
            <p className={styles.stepDesc}>Shadow the dialogue. You'll hear it first, then say it yourself.</p>
            <button className={styles.primaryBtn} onClick={startFirstLesson}>
              Shadow this scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MicIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0014 0" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" strokeLinecap="round"/>
  </svg>
);
