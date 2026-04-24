import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../contexts/AudioContext.jsx';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { saveSession, addToQueue, getLibraryEntry, saveLibraryEntry } from '../../services/storage.js';
import { scorePronunciation } from '../../services/api.js';
import { isAuthenticated } from '../../services/auth.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { blobToBase64 } from '../../services/offlineManager.js';
import { getSceneById, getYouLines } from '../../services/sceneLoader.js';
import { buildPhraseQueueFromScene, buildLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries } from '../../services/storage.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { SCORE_THRESHOLDS, SOURCE_TAGS, GROWTH_STATE } from '../../utils/constants.js';
import styles from './ShadowSession.module.css';

const SPEEDS = [
  { label: 'Slow', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: 'Fast', value: 1.25 },
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
  const [savedLines, setSavedLines] = useState(new Set());

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
          id: e.phraseId, speaker: 'you',
          cjk: e.cjk, romanization: e.romanization,
          english: e.english, audioFile: e.audioFile,
        }));
        setScene({ id: 'free-practice', title: 'Free practice', lines: virtualLines });
        setYouLines(virtualLines);
      }).catch(() => {}).finally(() => setLoading(false));
      return;
    }
    if (sceneId === PERSONAL_SCENE_ID) {
      getLibraryEntries(language).then(entries => {
        const personal = entries.filter(e => e.scene_id === PERSONAL_SCENE_ID);
        if (personal.length === 0) { setLoading(false); return; }
        const virtualLines = personal.map(e => ({
          id: e.phraseId ?? e.id, speaker: 'you',
          cjk: e.cjk, romanization: e.romanization,
          english: e.english, audioFile: null,
        }));
        const name = settings?.name ?? '';
        setScene({ id: PERSONAL_SCENE_ID, emoji: '👋', title: name ? `${name}'s introduction` : 'Your introduction', lines: virtualLines });
        setYouLines(virtualLines);
      }).catch(() => {}).finally(() => setLoading(false));
      return;
    }
    getSceneById(sceneId).then(s => {
      setScene(s);
      setYouLines(getYouLines(s));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [sceneId, language]);

  const currentYouLine = youLines[currentLineIndex] ?? null;
  const totalYou = youLines.length;

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
    if (audio.isPlaying) audio.pause(); else audio.play();
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

  const handleSaveLine = useCallback(async () => {
    if (!currentYouLine) return;
    const id = currentYouLine.id;
    if (savedLines.has(id)) return;
    await saveLibraryEntry({
      phraseId: id,
      cjk: currentYouLine.cjk,
      romanization: currentYouLine.romanization,
      english: currentYouLine.english,
      language,
      scene_id: sceneId ?? null,
      source_tag: SOURCE_TAGS.LIBRARY,
      growth_state: GROWTH_STATE.NEW,
      interval: 0, easeFactor: 2.5, practiceCount: 0,
      nextReviewAt: Date.now(), lastPracticedAt: null,
      lived_at: null, _createdAt: Date.now(), _updatedAt: Date.now(),
    }).catch(() => {});
    setSavedLines(prev => new Set(prev).add(id));
  }, [currentYouLine, savedLines, language, sceneId]);

  const finishSession = useCallback(async () => {
    audio.setAutoAdvance(true);
    audio.pause();
    try {
      const dur = Math.round((Date.now() - sessionStart) / 1000);
      const streakResult = await updateStreak();
      const scores = results.filter(r => r.score !== null).map(r => r.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      await saveSession({
        id: crypto.randomUUID(), date: getTodayString(),
        startedAt: sessionStart, completedAt: Date.now(),
        durationSeconds: dur, mode: 'shadow',
        sceneId: sceneId ?? null, phrasesAttempted: results.length,
        phrasesMastered: results.filter(r => r.score !== null && r.score >= SCORE_THRESHOLDS.EXCELLENT).length,
        averageScore: avg, phraseResults: results,
      });
      onComplete?.({ sceneId, phrasesAttempted: results.length, phraseResults: results, durationSeconds: dur, averageScore: avg, streakCount: streakResult?.count ?? 0 });
    } catch (_) {
      onComplete?.({ sceneId, phrasesAttempted: results.length, phraseResults: results, durationSeconds: 0, averageScore: null, streakCount: 0 });
    }
  }, [audio, sessionStart, results, sceneId, onComplete]);

  if (loading) return <div className={styles.screen}><div className={styles.loadingPulse} /></div>;

  if (!scene || youLines.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.empty}>
          <p>Scene not found or has no phrases to practice.</p>
          <button className={styles.emptyBack} onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  const isSpeakPhase = phase === 'record' || phase === 'scoring' || phase === 'scored';
  const scoreColor = currentScore === null ? 'rgba(255,255,255,0.85)'
    : currentScore >= 85 ? '#C5E85A'
    : currentScore >= 70 ? '#E8A030'
    : '#E06060';

  const progressPct = totalYou > 0 ? (completedCount / totalYou) * 100 : 0;
  const tint = scene.tint ?? '#C5E85A';
  const lineIsSaved = savedLines.has(currentYouLine?.id);

  return (
    <div className={styles.screen}>
      {/* Spotify ambient blurred background */}
      {scene.imageUrl && (
        <div
          className={styles.ambientBg}
          style={{ backgroundImage: `url(${scene.imageUrl})` }}
        />
      )}
      <div className={styles.tintOverlay} style={{ background: `linear-gradient(180deg, ${tint}66 0%, var(--bg-0) 70%)` }} />
      <div className={styles.darkOverlay} />

      <div className={styles.inner}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.downBtn} onClick={onBack} aria-label="Close">
            <ChevronDown />
          </button>
          <div className={styles.topCenter}>
            <span className={styles.topEyebrow}>SHADOWING</span>
            <span className={styles.topTitle}>{scene.title}</span>
          </div>
          <button className={styles.moreBtn}>⋯</button>
        </div>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.progressMeta}>
          <span>Line {currentLineIndex + 1}/{totalYou}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>

        {/* Cover art */}
        <div className={styles.coverWrap}>
          {scene.imageUrl ? (
            <img
              src={scene.imageUrl}
              alt={scene.title}
              className={styles.coverArt}
              style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.6)` }}
            />
          ) : (
            <div className={styles.coverPlaceholder} style={{ background: `${tint}44` }}>
              <span className={styles.coverEmoji}>{scene.emoji}</span>
            </div>
          )}
          {scene.emoji && scene.imageUrl && (
            <span className={styles.coverEmojiOverlay}>{scene.emoji}</span>
          )}
        </div>

        {/* Lyric block */}
        <div className={styles.lyricBlock}>
          <span className={styles.speakerLabel}>{isSpeakPhase ? 'YOUR TURN' : 'LISTEN'}</span>

          <div className={styles.jyutpingHero}>
            {currentYouLine?.romanization}
          </div>
          <div className={styles.englishLine}>
            "{currentYouLine?.english}"
          </div>
          <div className={styles.chineseLine} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>
            {currentYouLine?.cjk}
          </div>

          {/* Score reveal */}
          {(phase === 'scoring' || phase === 'scored') && (
            <div className={styles.scoreReveal}>
              {phase === 'scoring' ? (
                <span className={styles.scoringText}>Scoring…</span>
              ) : (
                <>
                  <span className={styles.scoreNum} style={{ color: scoreColor }}>
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

        {/* Save row */}
        <div className={styles.saveRow}>
          <button
            className={`${styles.saveRowBtn} ${lineIsSaved ? styles.saveRowBtnSaved : ''}`}
            onClick={handleSaveLine}
          >
            <span className={styles.saveRowIcon}>{lineIsSaved ? '♥' : '♡'}</span>
            <span className={styles.saveRowLabel}>SAVE TO LIBRARY</span>
          </button>
          <button className={styles.saveRowBtn} onClick={() => setSpeed(s => s === 0.5 ? 1 : 0.5)}>
            <span className={styles.saveRowIcon}>🔊</span>
            <span className={styles.saveRowLabel}>{speed <= 0.5 ? 'SLOW 0.5×' : 'SLOW 0.5×'}</span>
          </button>
          <button className={styles.saveRowBtn}>
            <span className={styles.saveRowIcon}>💬</span>
            <span className={styles.saveRowLabel}>TRANSLATE</span>
          </button>
        </div>

        {/* Transport */}
        <div className={styles.transport}>
          {phase !== 'record' && phase !== 'scoring' && (
            <>
              <button className={styles.transportSec} onClick={handleReplay} aria-label="Replay">
                <ReplayIcon />
              </button>
              <button className={styles.transportSec} onClick={() => {}}>
                <PrevIcon />
              </button>
              <button className={styles.playPauseBtn} onClick={handlePlayPause} aria-label={audio.isPlaying ? 'Pause' : 'Play'}>
                {audio.isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className={styles.transportSec} onClick={handleNext} aria-label="Next">
                <NextIcon />
              </button>
            </>
          )}

          {/* Mic button */}
          {phase !== 'scoring' && phase !== 'scored' && (
            <button
              className={`${styles.micBtn} ${phase === 'record' ? styles.micBtnActive : ''}`}
              onClick={phase === 'record' ? handleStopRecording : handleRecord}
              aria-label={phase === 'record' ? 'Stop recording' : 'Record'}
            >
              <MicIcon active={phase === 'record'} />
            </button>
          )}

          {phase === 'scoring' && (
            <div className={styles.scoringSpinner} />
          )}
        </div>

        {/* Waveform when recording */}
        {phase === 'record' && (
          <div className={styles.waveform}>
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className={styles.waveBar}
                style={{ animationDelay: `${(i * 37) % 500}ms` }}
              />
            ))}
          </div>
        )}

        {/* Scored actions */}
        {phase === 'scored' && (
          <div className={styles.scoredActions}>
            <button className={styles.retryBtn}
              onClick={() => { setPhase('listen'); setCurrentScore(null); setToneResult(null); audio.play(); }}>
              🔄 Try again
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {currentLineIndex < totalYou - 1 ? '→ Next' : '✓ Finish'}
            </button>
          </div>
        )}

        {/* Know it */}
        {phase !== 'record' && phase !== 'scoring' && (
          <button
            className={`${styles.knowBtn} ${knowDone ? styles.knowBtnDone : ''}`}
            onClick={handleKnowIt}
          >
            💪 I know this now
          </button>
        )}

        {/* Speed selector */}
        <div className={styles.speedRow}>
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

        {micError && <p className={styles.micError}>Mic not detected — check permissions</p>}

        {/* Footer hint */}
        <p className={styles.footerHint}>TAP MIC TO SHADOW · SWIPE UP FOR FULL DIALOGUE</p>
      </div>
    </div>
  );
}

const ChevronDown = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M6 9l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const PauseIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const ReplayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4"/>
  </svg>
);
const PrevIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="4" x2="5" y2="20" strokeWidth="2" stroke="currentColor"/>
  </svg>
);
const NextIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20" strokeWidth="2" stroke="currentColor"/>
  </svg>
);
const MicIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
