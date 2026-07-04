import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../contexts/AudioContext.jsx';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { logger } from '../../utils/logger.js';
import { updateAfterPractice } from '../../services/srs.js';
import { saveSession, addToQueue, saveLibraryEntry } from '../../services/storage.js';
import { scorePronunciation } from '../../services/api.js';
import { isAuthenticated } from '../../services/auth.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { blobToBase64 } from '../../services/offlineManager.js';
import { getSceneById, getYouLines } from '../../services/sceneLoader.js';
import { buildLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries } from '../../services/storage.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { phCapture } from '../../services/posthog.js';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { PhrasebookToast } from '../shared/PhrasebookToast.jsx';
import { SCORE_THRESHOLDS } from '../../utils/constants.js';
import styles from './ShadowSession.module.css';

export default function ShadowSession({ sceneId, onBack, onComplete }) {
  const { settings, updateSettings } = useAppContext();
  const audio = useAudio();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();

  const [scene, setScene] = useState(null);
  const [youLines, setYouLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const speed = settings?.playbackSpeed ?? 1;
  const [savedLines, setSavedLines] = useState({});

  const [phase, setPhase] = useState('ready');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [currentScore, setCurrentScore] = useState(null);
  const [toneResult, setToneResult] = useState(null);
  const [sessionStart] = useState(Date.now());
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPhrasebookToast, setShowPhrasebookToast] = useState(false);

  const language = settings?.currentLanguage ?? 'cantonese';

  useEffect(() => {
    phCapture('scene_started', { mode: 'shadow', scene_id: sceneId ?? null });
  }, [sceneId]);

  useEffect(() => {
    if (!sceneId || sceneId === '__quick3__') {
      const limit = sceneId === '__quick3__' ? 3 : 10;
      buildLesson(limit, language).then(phrases => {
        const virtualLines = phrases.map(e => ({
          id: e.phraseId,
          speaker: 'you',
          cjk: e.cjk,
          romanization: e.romanization,
          english: e.english,
          audioFile: e.audioFile,
        }));
        const title = sceneId === '__quick3__' ? 'Quick 3' : 'Free practice';
        const id = sceneId === '__quick3__' ? '__quick3__' : 'free-practice';
        setScene({ id, title, lines: virtualLines });
        setYouLines(virtualLines);
      }).catch(err => logger.error('[ShadowSession] library load failed', err?.message)).finally(() => setLoading(false));
      return;
    }
    if (sceneId === PERSONAL_SCENE_ID) {
      getLibraryEntries(language).then(entries => {
        const personal = entries.filter(e => e.scene_id === PERSONAL_SCENE_ID);
        if (personal.length === 0) { setLoading(false); return; }
        const virtualLines = personal.map(e => ({
          id: e.phraseId ?? e.id,
          speaker: 'you',
          cjk: e.cjk,
          romanization: e.romanization,
          english: e.english,
          audioFile: null,
        }));
        const name = settings?.name ?? '';
        setScene({ id: PERSONAL_SCENE_ID, emoji: '👋', title: name ? `${name}'s intro` : 'Your intro', lines: virtualLines });
        setYouLines(virtualLines);
      }).catch(err => logger.error('[ShadowSession] personal scene load failed', err?.message)).finally(() => setLoading(false));
      return;
    }
    getSceneById(sceneId)
      .then(s => { setScene(s); setYouLines(getYouLines(s)); })
      .catch(err => logger.error('[ShadowSession] scene load failed', err?.message))
      .finally(() => setLoading(false));
  }, [sceneId, language]);

  const currentYouLine = youLines[currentLineIndex] ?? null;
  const totalYou = youLines.length;
  const progressPct = totalYou > 0 ? (completedCount / totalYou) * 100 : 0;

  // Find NPC context lines flanking the current 'you' line
  const allLines = scene?.lines ?? [];
  const currentYouLineInAll = currentYouLine ? allLines.findIndex(l => l.id === currentYouLine.id) : -1;
  const contextNpcLine = currentYouLineInAll > 0 && allLines[currentYouLineInAll - 1]?.speaker !== 'you'
    ? allLines[currentYouLineInAll - 1] : null;
  const followNpcLine = currentYouLineInAll >= 0 && currentYouLineInAll < allLines.length - 1
    && allLines[currentYouLineInAll + 1]?.speaker !== 'you'
    ? allLines[currentYouLineInAll + 1] : null;
  const npcSpeakerLabel = contextNpcLine?.speaker
    ? contextNpcLine.speaker.charAt(0).toUpperCase() + contextNpcLine.speaker.slice(1)
    : 'Them';

  const handlePlayPause = useCallback(async () => {
    if (phase === 'ready' || phase === 'scored') {
      setPhase('listen');
      audio.prime();
      try {
        const queue = [...(contextNpcLine ? [contextNpcLine] : []), currentYouLine].filter(Boolean);
        await audio.loadQueue(queue, language, speed === 1 ? 'natural' : speed < 1 ? 'slow' : 'fast');
        await audio.play();
      } catch (_) {}
      return;
    }
    if (audio.isPlaying) audio.pause();
    else audio.play();
  }, [phase, audio, currentYouLine, contextNpcLine, language, speed]);

  const handleReplay = useCallback(async () => {
    audio.prime();
    try {
      await audio.loadQueue([currentYouLine], language, speed === 1 ? 'natural' : speed < 1 ? 'slow' : 'fast');
      await audio.play();
      if (phase !== 'listen') setPhase('listen');
    } catch (_) {}
  }, [audio, currentYouLine, language, speed, phase]);

  const handlePrev = useCallback(() => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(i => i - 1);
      setCurrentScore(null);
      setToneResult(null);
      setPhase('ready');
    }
  }, [currentLineIndex]);

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
        if (result.score >= 90) setTimeout(() => setShowCelebration(true), 350);
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

  // Safety net: lines are 2-4 seconds, so auto-stop a recording nobody
  // stopped. Without this, a user who doesn't realise the button toggles
  // is stuck on RECORDING forever.
  useEffect(() => {
    if (phase !== 'record') return;
    const t = setTimeout(() => { handleStopRecording(); }, 10000);
    return () => clearTimeout(t);
  }, [phase, handleStopRecording]);


  const handleSaveLine = useCallback(async () => {
    if (!currentYouLine) return;
    const id = currentYouLine.id;
    if (savedLines[id]) return;
    setSavedLines(prev => ({ ...prev, [id]: true }));
    setShowPhrasebookToast(true);
    try {
      await saveLibraryEntry({
        phraseId: id,
        sceneId: scene?.id ?? null,
        romanization: currentYouLine.romanization,
        english: currentYouLine.english,
        cjk: currentYouLine.cjk,
        language,
      });
    } catch (_) {}
  }, [currentYouLine, scene, language, savedLines]);

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
      phCapture('scene_completed', {
        mode: 'shadow',
        scene_id: sceneId ?? null,
        phrases_practiced: results.length,
        average_score: avg,
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
  const scoreColor = currentScore === null ? 'var(--fg-0)'
    : currentScore >= 80 ? 'var(--accent)'
    : currentScore >= 60 ? 'var(--color-score-good)'
    : currentScore >= 40 ? 'var(--color-score-fair)'
    : 'var(--color-score-poor)';

  const isSaved = savedLines[currentYouLine?.id];
  const showJyutping = settings?.showRomanization ?? true;
  const showEnglishToggle = settings?.showEnglish ?? true;
  const cjkChars = (currentYouLine?.cjk ?? '').split('');

  return (
    <div className={styles.screen}>
      {/* Phrasebook save toast */}
      {showPhrasebookToast && currentYouLine && (
        <PhrasebookToast
          phrase={{ cjk: currentYouLine.cjk, english: currentYouLine.english }}
          onDone={() => setShowPhrasebookToast(false)}
        />
      )}

      {/* 90+ celebration overlay */}
      {showCelebration && currentYouLine && (
        <ScoreCelebration
          score={currentScore}
          line={currentYouLine}
          streakCount={settings?.streakCount ?? 0}
          onKeepGoing={() => { setShowCelebration(false); handleNext(); }}
          onRetry={() => { setShowCelebration(false); setPhase('listen'); setCurrentScore(null); setToneResult(null); audio.play(); }}
        />
      )}

      {/* Left vertical progress track */}
      <div className={styles.leftTrack} aria-hidden="true">
        {Array.from({ length: totalYou }).map((_, i) => (
          <div
            key={i}
            className={`${styles.leftTrackTick} ${i === currentLineIndex ? styles.leftTrackTickActive : i < currentLineIndex ? styles.leftTrackTickDone : ''}`}
          />
        ))}
      </div>

      <div className={styles.inner}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Close">‹</button>
          <span className={styles.topCount}>{String(currentLineIndex + 1).padStart(2, '0')} / {String(totalYou).padStart(2, '0')}</span>
          <button
            className={`${styles.saveBtn} ${isSaved ? styles.saveBtnSaved : ''}`}
            onClick={handleSaveLine}
            aria-label={isSaved ? 'Saved to phrasebook' : 'Save to phrasebook'}
          >
            <BookmarkIcon saved={isSaved} />
          </button>
        </div>

        {/* Centered focus content */}
        <div className={styles.focus}>
          {showJyutping && (
            <p className={styles.focusJyutping}>{currentYouLine?.romanization ?? '—'}</p>
          )}

          {currentYouLine?.cjk && (
            <p className={styles.focusCjk}>
              {cjkChars.map((ch, i) => (
                <span key={i} className={i === 0 ? styles.focusCjkAccent : undefined}>{ch}</span>
              ))}
            </p>
          )}

          {showEnglishToggle && (
            <p className={styles.focusEnglish}>"{currentYouLine?.english}"</p>
          )}

          <div className={styles.focusActions}>
            {/* Replay audio */}
            <button className={styles.audioIcon} onClick={handleReplay} aria-label="Play audio">
              <span /><span /><span />
            </button>
            {/* Breakdown */}
            <button className={styles.breakdownBtn} onClick={() => {}} aria-label="Breakdown">
              📖 Breakdown
            </button>
          </div>

          {/* Score reveal */}
          {(phase === 'scoring' || phase === 'scored') && (
            <div className={styles.scoreReveal}>
              {phase === 'scoring' ? (
                <span className={styles.scoringText}>Scoring…</span>
              ) : (
                <>
                  <span className={styles.scoreNum} style={{ color: scoreColor }}>
                    {currentScore !== null ? currentScore : '—'}
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

        {/* Orbital mic */}
        <div className={styles.micOrbit}>
          <button
            className={`${styles.micBtn} ${phase === 'record' ? styles.micBtnActive : ''}`}
            onClick={phase === 'record' ? handleStopRecording : handleRecord}
            aria-label="Record"
          >
            {phase === 'scoring' ? (
              <div className={styles.micSpinner} />
            ) : phase === 'record' ? (
              <StopIcon />
            ) : (
              <MicIcon />
            )}
          </button>
        </div>

        {/* Bottom hint + nav */}
        <div className={styles.bottom}>
          <div className={styles.eyeToggles}>
            <button
              className={`${styles.eyeToggle} ${showJyutping ? styles.eyeToggleOn : ''}`}
              onClick={() => updateSettings({ showRomanization: !showJyutping })}
            >
              <EyeIcon /> JYUTPING
            </button>
            <button
              className={`${styles.eyeToggle} ${showEnglishToggle ? styles.eyeToggleOn : ''}`}
              onClick={() => updateSettings({ showEnglish: !showEnglishToggle })}
            >
              <EyeIcon /> ENGLISH
            </button>
          </div>
          <div className={styles.transport}>
            <button className={styles.skipBtn} onClick={handlePrev} disabled={currentLineIndex === 0} aria-label="Previous">
              <ArrowLeftIcon />
            </button>
            <p className={styles.holdLabel}>
              {phase === 'record' ? 'SPEAK NOW · TAP ⏹ WHEN DONE' : phase === 'scoring' ? 'SCORING…' : phase === 'scored' ? 'TAP → FOR NEXT' : 'TAP TO RECORD · SWIPE → NEXT'}
            </p>
            <button className={styles.skipBtn} onClick={handleNext} aria-label="Next">
              <ArrowRightIcon />
            </button>
          </div>
          {micError && <p className={styles.micError}>Mic not detected. Check permissions</p>}
        </div>
      </div>
    </div>
  );
}

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm6-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);

const StopIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const BookmarkIcon = ({ saved }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── 90+ Score Celebration Overlay ───────────────────────────────────────────
// Dopamine reward: big score pop, confetti, streak badge, XP, social proof.
// Triggers only when pronunciation score ≥ 90.
function ScoreCelebration({ score, line, streakCount, onKeepGoing, onRetry }) {
  const CONFETTI = [
    { left:'7%',  w:6,  h:10, bg:'#C8392B', dur:2.8, delay:0,    r:2 },
    { left:'14%', w:4,  h:8,  bg:'#C8392B', dur:3.2, delay:0.3,  r:50 },
    { left:'24%', w:8,  h:6,  bg:'var(--ink)', dur:2.5, delay:0.7,  r:0 },
    { left:'34%', w:5,  h:9,  bg:'rgba(255,255,255,0.7)', dur:3.0, delay:0.2, r:2 },
    { left:'44%', w:6,  h:6,  bg:'rgba(255,255,255,0.5)', dur:2.7, delay:0.5, r:50 },
    { left:'54%', w:7,  h:7,  bg:'#C9A24A', dur:3.1, delay:0.1,  r:0 },
    { left:'64%', w:4,  h:10, bg:'#C9A24A', dur:2.9, delay:0.6,  r:2 },
    { left:'74%', w:6,  h:8,  bg:'#C8392B', dur:2.6, delay:0.4,  r:2 },
    { left:'82%', w:5,  h:6,  bg:'var(--ink)', dur:3.3, delay:0.8,  r:50 },
    { left:'90%', w:8,  h:5,  bg:'rgba(255,255,255,0.6)', dur:2.8, delay:0.35, r:0 },
    { left:'11%', w:5,  h:8,  bg:'#C9A24A', dur:3.4, delay:1.1,  r:2 },
    { left:'29%', w:6,  h:6,  bg:'#C8392B', dur:2.9, delay:1.3,  r:50 },
    { left:'49%', w:4,  h:10, bg:'rgba(255,255,255,0.5)', dur:3.1, delay:1.0, r:2 },
    { left:'69%', w:7,  h:6,  bg:'var(--ink)', dur:2.7, delay:1.4,  r:0 },
    { left:'87%', w:5,  h:8,  bg:'#C9A24A', dur:3.0, delay:1.2,  r:2 },
  ];

  return (
    <div className={styles.celebOverlay}>
      {/* Deep jade glow */}
      <div className={styles.celebBgGlow} />

      {/* Confetti */}
      <div className={styles.celebConfetti}>
        {CONFETTI.map((c, i) => (
          <div
            key={i}
            className={styles.celebConfettiDot}
            style={{
              left: c.left, width: c.w, height: c.h,
              background: c.bg, borderRadius: c.r,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.celebInner}>
        {/* Score circle */}
        <div className={styles.celebScoreWrap}>
          <div className={styles.celebRings}>
            <div className={styles.celebRing} />
            <div className={styles.celebRing} />
            <div className={styles.celebRing} />
          </div>
          <div className={styles.celebCircle}>
            <span className={styles.celebScoreNum}>{score}</span>
            <span className={styles.celebScoreSub}>/ 100</span>
          </div>
        </div>

        <p className={styles.celebHeadline}>
          {score >= 95 ? 'Native match! 🎯' : score >= 90 ? 'Perfect tones! ✨' : 'Excellent! 🔥'}
        </p>
        <p className={styles.celebSub}>Your pronunciation was flawless.</p>

        {/* Badges */}
        <div className={styles.celebBadges}>
          {streakCount > 0 && (
            <div className={`${styles.celebBadge} ${styles.celebBadgeStreak}`}>
              🔥 {streakCount} day streak
            </div>
          )}
          <div className={`${styles.celebBadge} ${styles.celebBadgeXp}`}>
            ⚡ +50 XP
          </div>
          <div className={styles.celebBadge}>
            🏆 Personal best
          </div>
        </div>

        {/* Social proof */}
        <div className={styles.celebSocial}>
          Better than <span>top 8%</span> of learners this week
        </div>

        {/* Phrase card */}
        <div className={styles.celebPhraseCard}>
          <p className={styles.celebPhraseCjk}>{line.cjk}</p>
          <p className={styles.celebPhraseRoman}>{line.romanization}</p>
          <p className={styles.celebPhraseEn}>{line.english}</p>
        </div>

        {/* CTAs */}
        <div className={styles.celebCtas}>
          <button className={styles.celebPrimary} onClick={onKeepGoing}>
            Keep going →
          </button>
          <div className={styles.celebSecondaryRow}>
            <button className={styles.celebSecondary} onClick={onRetry}>↺ Retry</button>
          </div>
        </div>
      </div>
    </div>
  );
}
