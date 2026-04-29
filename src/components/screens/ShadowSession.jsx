import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../contexts/AudioContext.jsx';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { useRecorder } from '../../hooks/useRecorder.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { logger } from '../../utils/logger.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { saveSession, addToQueue, saveLibraryEntry } from '../../services/storage.js';
import { scorePronunciation } from '../../services/api.js';
import { isAuthenticated, getCurrentUser } from '../../services/auth.js';
import { updateStreak, getTodayString } from '../../services/streak.js';
import { blobToBase64 } from '../../services/offlineManager.js';
import { getSceneById, getYouLines } from '../../services/sceneLoader.js';
import { buildLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries } from '../../services/storage.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { ToneTrack } from '../ui/ToneTrack.jsx';
import { NpcAvatar, UserAvatar } from '../ui/ConversationAvatars.jsx';
import { SCORE_THRESHOLDS } from '../../utils/constants.js';
import styles from './ShadowSession.module.css';

const SPEEDS = [
  { label: '🐢 Slow', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: '🐇 Fast', value: 1.25 },
];

const WAVEFORM_BARS = 28;

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
  const [savedLines, setSavedLines] = useState({});

  const [phase, setPhase] = useState('ready');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [currentScore, setCurrentScore] = useState(null);
  const [toneResult, setToneResult] = useState(null);
  const [sessionStart] = useState(Date.now());
  const [showCelebration, setShowCelebration] = useState(false);

  const language = settings?.currentLanguage ?? 'cantonese';
  const authUser = getCurrentUser();
  const userPhoto = authUser?.photoURL ?? null;
  const userName = authUser?.name ?? settings?.name ?? 'You';

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sceneId, language]);

  const currentYouLine = youLines[currentLineIndex] ?? null;
  const totalYou = youLines.length;
  const progressPct = totalYou > 0 ? (completedCount / totalYou) * 100 : 0;

  const tint = scene?.tint ?? '#00E5A0';

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

  useEffect(() => { setKnowDone(false); }, [currentLineIndex]);

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

  const handleKnowIt = useCallback(async () => {
    if (!currentYouLine || knowDone) return;
    setKnowDone(true);
    await markAsMastered(currentYouLine.id).catch(() => {});
  }, [currentYouLine, knowDone]);

  const handleSaveLine = useCallback(async () => {
    if (!currentYouLine) return;
    const id = currentYouLine.id;
    setSavedLines(prev => ({ ...prev, [id]: true }));
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
  }, [currentYouLine, scene, language]);

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
  const scoreColor = currentScore === null ? '#fff'
    : currentScore >= 80 ? 'var(--accent)'
    : currentScore >= 60 ? '#4DCCA8'
    : currentScore >= 40 ? '#f0a030'
    : '#ff7a5c';

  const isSaved = savedLines[currentYouLine?.id];
  const speaker = (currentYouLine?.speaker ?? 'you').toUpperCase();

  return (
    <div className={styles.screen}>
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

      {/* Ambient background */}
      {scene.imageUrl && (
        <div className={styles.ambientBg} style={{ backgroundImage: `url(${scene.imageUrl})` }} />
      )}
      <div className={styles.tintOverlay} style={{ background: `linear-gradient(180deg, ${tint}55 0%, var(--bg-0) 70%)` }} />
      <div className={styles.darkOverlay} />

      <div className={styles.inner}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.downBtn} onClick={onBack} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div className={styles.topCenter}>
            <span className={styles.topEyebrow}>SHADOWING</span>
            <span className={styles.topTitle}>{scene.title}</span>
          </div>
          <button className={styles.moreBtn} aria-label="More">⋯</button>
        </div>

        {/* Progress */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.progressMeta}>
          <span>Line {currentLineIndex + 1}/{totalYou}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>

        {/* Chat thread */}
        <div className={styles.chatThread}>
          {/* NPC context bubble */}
          {contextNpcLine ? (
            <div className={styles.npcRow}>
              <NpcAvatar scene={scene} />
              <div className={styles.npcBubble}>
                <span className={styles.bubbleSpeaker}>{npcSpeakerLabel}</span>
                {contextNpcLine.cjk && (
                  <p className={styles.bubbleCjk}>{contextNpcLine.cjk}</p>
                )}
                <p className={styles.bubbleRoman}>{contextNpcLine.romanization}</p>
                <p className={styles.bubbleEnglish}>"{contextNpcLine.english}"</p>
              </div>
            </div>
          ) : (
            /* No NPC context — show scene image as a small header instead */
            scene.imageUrl && (
              <div className={styles.sceneBanner}>
                <img className={styles.sceneBannerImg} src={scene.imageUrl} alt={scene.title} />
                <span className={styles.sceneBannerLabel}>{scene.emoji} {scene.title}</span>
              </div>
            )
          )}

          {/* Your active bubble */}
          <div className={styles.youRow}>
            <div className={`${styles.youBubble} ${isSpeakPhase ? styles.youBubbleSpeak : ''}`}>
              <span className={styles.bubbleSpeaker} style={{ textAlign: 'right', display: 'block' }}>
                {isSpeakPhase ? 'YOUR TURN' : 'YOU'}
              </span>
              <p className={styles.bubbleRoman}>{currentYouLine?.romanization ?? '—'}</p>
              <p className={styles.bubbleEnglish}>"{currentYouLine?.english}"</p>
              {currentYouLine?.cjk && (
                <p className={styles.bubbleCjk} style={{ opacity: 0.6, fontSize: 14 }}>{currentYouLine.cjk}</p>
              )}
            </div>
            <UserAvatar photoURL={userPhoto} name={userName} />
          </div>

          {/* Next NPC line (dimmed preview) */}
          {followNpcLine && phase === 'scored' && (
            <div className={`${styles.npcRow} ${styles.dimmed}`}>
              <NpcAvatar scene={scene} />
              <div className={styles.npcBubble}>
                <span className={styles.bubbleSpeaker}>{npcSpeakerLabel}</span>
                {followNpcLine.cjk && <p className={styles.bubbleCjk}>{followNpcLine.cjk}</p>}
                <p className={styles.bubbleRoman}>{followNpcLine.romanization}</p>
              </div>
            </div>
          )}
        </div>

        {/* Score reveal */}
        {(phase === 'scoring' || phase === 'scored') && (
          <div className={styles.scoreReveal}>
            {phase === 'scoring' ? (
              <span className={styles.scoringText}>Scoring your pronunciation…</span>
            ) : (
              <>
                <div className={`${styles.scoreCircle} ${
                  currentScore !== null && currentScore >= 90 ? styles.scoreCircleExcellent :
                  currentScore !== null && currentScore >= 70 ? styles.scoreCircleGood : ''
                }`}>
                  <span className={styles.scoreNum} style={{ color: scoreColor }}>
                    {currentScore !== null ? currentScore : '—'}
                  </span>
                </div>
                {currentScore !== null && (
                  <span className={styles.scoreLabel} style={{ color: scoreColor }}>
                    {currentScore >= 90 ? 'Native Match! 🎯' : currentScore >= 70 ? 'Close! 👍' : 'Try again 🔄'}
                  </span>
                )}
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

        {/* Save row */}
        <div className={styles.saveRow}>
          <button
            className={`${styles.saveRowBtn} ${isSaved ? styles.saveRowBtnSaved : ''}`}
            onClick={handleSaveLine}
          >
            <span className={styles.saveRowIcon}>{isSaved ? '♥' : '♡'}</span>
            <span className={styles.saveRowLabel}>SAVE</span>
          </button>
          <button className={styles.saveRowBtn} onClick={handleReplay}>
            <span className={styles.saveRowIcon}>🔊</span>
            <span className={styles.saveRowLabel}>SLOW 0.5×</span>
          </button>
          <button className={styles.saveRowBtn}>
            <span className={styles.saveRowIcon}>💬</span>
            <span className={styles.saveRowLabel}>TRANSLATE</span>
          </button>
        </div>

        {/* Waveform (recording) */}
        {isRecording && (
          <div className={styles.waveform}>
            {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
              <div
                key={i}
                className={styles.waveBar}
                style={{ animationDelay: `${(i * 0.6 / WAVEFORM_BARS).toFixed(2)}s` }}
              />
            ))}
          </div>
        )}

        {/* Scored actions */}
        {phase === 'scored' && (
          <div className={styles.scoredActions}>
            <button className={styles.retryBtn} onClick={() => { setPhase('listen'); setCurrentScore(null); setToneResult(null); audio.play(); }}>
              🔄 Try again
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {currentLineIndex < totalYou - 1 ? '→ Next' : '✓ Finish'}
            </button>
          </div>
        )}

        {/* Transport */}
        {phase !== 'record' && phase !== 'scoring' && phase !== 'scored' && (
          <div className={styles.transport}>
            <button className={styles.transportSec} onClick={handleReplay} aria-label="Replay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
            </button>
            <button className={styles.transportSec} onClick={handlePrev} aria-label="Previous" disabled={currentLineIndex === 0} style={{ opacity: currentLineIndex === 0 ? 0.3 : 0.7 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button className={styles.playPauseBtn} onClick={handlePlayPause} aria-label={audio.isPlaying ? 'Pause' : 'Play'}>
              {audio.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className={styles.transportSec} onClick={handleNext} aria-label="Next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
            {phase === 'scoring' ? (
              <div className={styles.scoringSpinner} />
            ) : (
              <button
                className={`${styles.micBtn} ${phase === 'record' ? styles.micBtnActive : ''}`}
                onClick={phase === 'record' ? handleStopRecording : handleRecord}
                aria-label="Record"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
            )}
          </div>
        )}

        {/* Know it + speed */}
        {phase !== 'record' && phase !== 'scoring' && (
          <button
            className={`${styles.knowBtn} ${knowDone ? styles.knowBtnDone : ''}`}
            onClick={handleKnowIt}
          >
            💪 I know this now
          </button>
        )}

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

        <p className={styles.footerHint}>TAP MIC TO SHADOW · SWIPE UP FOR FULL DIALOGUE</p>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const PauseIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

// ─── 90+ Score Celebration Overlay ───────────────────────────────────────────
// Dopamine reward: big score pop, confetti, streak badge, XP, social proof.
// Triggers only when pronunciation score ≥ 90.
function ScoreCelebration({ score, line, streakCount, onKeepGoing, onRetry }) {
  const CONFETTI = [
    { left:'7%',  w:6,  h:10, bg:'#00E5A0', dur:2.8, delay:0,    r:2 },
    { left:'14%', w:4,  h:8,  bg:'#00E5A0', dur:3.2, delay:0.3,  r:50 },
    { left:'24%', w:8,  h:6,  bg:'#00c489', dur:2.5, delay:0.7,  r:0 },
    { left:'34%', w:5,  h:9,  bg:'rgba(255,255,255,0.7)', dur:3.0, delay:0.2, r:2 },
    { left:'44%', w:6,  h:6,  bg:'rgba(255,255,255,0.5)', dur:2.7, delay:0.5, r:50 },
    { left:'54%', w:7,  h:7,  bg:'#FF9F43', dur:3.1, delay:0.1,  r:0 },
    { left:'64%', w:4,  h:10, bg:'#FF9F43', dur:2.9, delay:0.6,  r:2 },
    { left:'74%', w:6,  h:8,  bg:'#00E5A0', dur:2.6, delay:0.4,  r:2 },
    { left:'82%', w:5,  h:6,  bg:'#00c489', dur:3.3, delay:0.8,  r:50 },
    { left:'90%', w:8,  h:5,  bg:'rgba(255,255,255,0.6)', dur:2.8, delay:0.35, r:0 },
    { left:'11%', w:5,  h:8,  bg:'#FF9F43', dur:3.4, delay:1.1,  r:2 },
    { left:'29%', w:6,  h:6,  bg:'#00E5A0', dur:2.9, delay:1.3,  r:50 },
    { left:'49%', w:4,  h:10, bg:'rgba(255,255,255,0.5)', dur:3.1, delay:1.0, r:2 },
    { left:'69%', w:7,  h:6,  bg:'#00c489', dur:2.7, delay:1.4,  r:0 },
    { left:'87%', w:5,  h:8,  bg:'#FF9F43', dur:3.0, delay:1.2,  r:2 },
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
