// src/components/screens/DialogueScene.jsx — Scripted conversation practice

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useRecorder } from '../../hooks/useRecorder';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { textToSpeech, scorePronunciation } from '../../services/api';
import { isAuthenticated } from '../../services/auth';
import { updateAfterPractice } from '../../services/srs';
import { saveSession, saveLibraryEntry } from '../../services/storage';
import { updateStreak, getTodayString } from '../../services/streak';
import { SRS_INITIAL_EASE } from '../../utils/constants';
import { ScoreBadge } from '../cards/ScoreBadge';
import { RecordButton } from '../shared/RecordButton';
import styles from './DialogueScene.module.css';

/**
 * @param {{ sceneData: Object, onBack: Function, onComplete: Function, showToast: Function }} props
 */
export default function DialogueScene({ sceneData, onBack, onComplete, showToast }) {
  const { settings, updateSettings } = useAppContext();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | playing | recording | scored | done
  const [score, setScore] = useState(null);
  const [chatLog, setChatLog] = useState([]);
  const [sessionStart] = useState(Date.now());
  const [phrasesSaved, setPhrasesSaved] = useState(false);
  const [canReplay, setCanReplay] = useState(false); // show replay after other's turn
  const audioRef = useRef(new Audio());
  const lastOtherBlobRef = useRef(null);
  const scrollRef = useRef(null);

  const scene = sceneData;
  const turn = scene?.turns[turnIndex];
  const advanceTurnRef = useRef(null);
  const totalTurns = scene?.turns?.length || 1;
  const userTurns = scene?.turns?.filter(t => t.speaker === 'user') || [];

  // Helper: use jyutping OR romanization field (data is inconsistent)
  const romanOf = (t) => t?.romanization || t?.jyutping || '';

  useEffect(() => { return () => { audioRef.current.pause(); }; }, []);

  const addToLog = useCallback((t, scoreVal) => {
    setChatLog(prev => [...prev, { ...t, score: scoreVal }]);
  }, []);

  const finishScene = useCallback(async () => {
    setPhase('done');
    const dur = Math.round((Date.now() - sessionStart) / 1000);
    const streak = await updateStreak();
    await updateSettings({ streakCount: streak, totalPracticeSeconds: settings.totalPracticeSeconds + dur });
    const rec = {
      id: crypto.randomUUID(), date: getTodayString(),
      startedAt: sessionStart, completedAt: Date.now(), durationSeconds: dur,
      mode: 'dialogue', phrasesAttempted: scene.turns.filter(t => t.speaker === 'user').length,
      phrasesMastered: 0, averageScore: null, phraseResults: [],
    };
    await saveSession(rec);
    onComplete?.({ ...rec, streakCount: streak, chatLog, sceneTitle: scene.title });
  }, [sessionStart, scene, chatLog, updateSettings, settings, onComplete]);

  const advanceTurn = useCallback(() => {
    const next = turnIndex + 1;
    if (next >= scene.turns.length) { finishScene(); return; }
    setTurnIndex(next);
    setScore(null);
    setCanReplay(false);
  }, [turnIndex, scene, finishScene]);

  // Keep ref in sync so playOtherTurn always calls the latest advanceTurn
  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  const playOtherTurn = useCallback(async (t) => {
    setPhase('playing');
    setCanReplay(false);
    addToLog(t, null);
    if (isAuthenticated()) {
      try {
        const blob = await textToSpeech(t.chinese, {
          language: 'cantonese', speed: 0.9, outputExtension: 'mp3',
          voiceId: t.voiceId || undefined,
        });
        // Keep blob URL for replay
        if (lastOtherBlobRef.current) URL.revokeObjectURL(lastOtherBlobRef.current);
        const url = URL.createObjectURL(blob);
        lastOtherBlobRef.current = url;
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => {
          setCanReplay(true);
          setTimeout(() => advanceTurnRef.current(), t.pauseAfterMs || 1500);
        };
      } catch {
        setCanReplay(false);
        setTimeout(() => advanceTurnRef.current(), t.pauseAfterMs || 1500);
      }
    } else {
      setTimeout(() => advanceTurnRef.current(), t.pauseAfterMs || 1500);
    }
  }, [addToLog]);

  const handleReplayOther = useCallback(() => {
    if (!lastOtherBlobRef.current) return;
    audioRef.current.src = lastOtherBlobRef.current;
    audioRef.current.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === 'intro') return;
    if (!turn) return;
    if (turn.speaker === 'other') playOtherTurn(turn);
    else setPhase('playing');
  }, [turnIndex, phase === 'intro']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatLog]);

  const handleStartScene = useCallback(() => {
    setPhase('playing');
    const firstTurn = scene?.turns[0];
    if (firstTurn?.speaker === 'other') {
      playOtherTurn(firstTurn);
    }
  }, [scene, playOtherTurn]);

  const handleRecord = useCallback(async () => {
    audioRef.current.pause();
    await startRecording();
    setPhase('recording');
  }, [startRecording]);

  const handleStopRecord = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob || !turn) return;
    setPhase('scored');

    let scoreVal = null;
    if (isOnline && isAuthenticated()) {
      try {
        const result = await scorePronunciation(blob, turn.chinese, 'cantonese');
        scoreVal = result.score;
        if (turn.phraseId) await updateAfterPractice(turn.phraseId, scoreVal);
      } catch { /* non-fatal */ }
    }
    setScore(scoreVal);
    addToLog(turn, scoreVal);
  }, [stopRecording, turn, isOnline, addToLog]);

  const handleContinue = useCallback(() => { advanceTurn(); }, [advanceTurn]);

  const handleReplay = useCallback(() => {
    setTurnIndex(0); setChatLog([]); setScore(null);
    setPhrasesSaved(false); setCanReplay(false); setPhase('playing');
    const firstTurn = scene?.turns[0];
    if (firstTurn?.speaker === 'other') {
      setTimeout(() => playOtherTurn(firstTurn), 100);
    }
  }, [scene, playOtherTurn]);

  const handleSavePhrases = useCallback(async () => {
    const turns = chatLog.filter(t => t.speaker === 'user' && t.phraseId);
    let saved = 0;
    for (const t of turns) {
      try {
        await saveLibraryEntry({
          phraseId: t.phraseId, type: 'phrase', addedAt: Date.now(),
          source: 'dialogue', customData: null,
          interval: 0, easeFactor: SRS_INITIAL_EASE, nextReviewAt: Date.now(),
          lastPracticedAt: Date.now(), practiceCount: 1, status: 'learning',
          bestScore: t.score, lastScore: t.score, scoreHistory: t.score != null ? [t.score] : [],
        });
        saved++;
      } catch { /* skip duplicates */ }
    }
    setPhrasesSaved(true);
    showToast?.(`${saved} phrase${saved !== 1 ? 's' : ''} saved to library`, 'success');
  }, [chatLog, showToast]);

  if (!scene) return null;

  // ── Intro screen ────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div style={{ width: 44 }} />
          <div style={{ width: 44 }} />
        </div>

        <div className={styles.introContent}>
          <div className={styles.introEmoji}>{scene.emoji || '💬'}</div>
          <h2 className={styles.introTitle}>{scene.title}</h2>
          {scene.description && (
            <p className={styles.introDesc}>{scene.description}</p>
          )}

          {/* Preview of what the user will say */}
          {userTurns.length > 0 && (
            <div className={styles.introPreview}>
              <p className={styles.introPreviewLabel}>
                Your {userTurns.length} {userTurns.length === 1 ? 'line' : 'lines'}
              </p>
              <div className={styles.introLines}>
                {userTurns.map((t, i) => (
                  <div key={i} className={styles.introLine}>
                    <span className={styles.introLineNum}>{i + 1}</span>
                    <div className={styles.introLineText}>
                      <span className={styles.introLineEnglish}>{t.english}</span>
                      <span className={styles.introLineChinese} lang="yue">{t.chinese}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.introActions}>
          <button className={styles.startBtn} onClick={handleStartScene}>
            Start conversation
          </button>
          <button className={styles.cancelBtn} onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Active scene ─────────────────────────────────────────────────────────────
  // Progress: count user turns completed vs total user turns
  const userTurnsDone = chatLog.filter(t => t.speaker === 'user').length;
  const progressPct = userTurns.length > 0
    ? Math.round((userTurnsDone / userTurns.length) * 100)
    : 0;
  const turnLabel = `Line ${userTurnsDone + (turn?.speaker === 'user' ? 1 : 0)} of ${userTurns.length}`;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onBack} aria-label="Exit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className={styles.progress}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <span className={styles.progressLabel}>{turnLabel}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <div className={styles.chatArea} ref={scrollRef}>
        {chatLog.map((entry, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${entry.speaker === 'user' ? styles.userBubble : styles.otherBubble}`}
          >
            <span className={styles.speakerLabel}>{entry.speakerLabel || (entry.speaker === 'user' ? 'You' : 'Them')}</span>
            <p className={styles.bubbleRoman}>{romanOf(entry)}</p>
            <p className={styles.bubbleChinese} lang="yue">{entry.chinese}</p>
            <p className={styles.bubbleEnglish}>{entry.english}</p>
            {entry.score !== null && entry.score !== undefined && (
              <div className={styles.bubbleScore}>
                <ScoreBadge score={entry.score} variant="compact" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.controls}>
        {/* Other's turn: show who is speaking */}
        {phase === 'playing' && turn?.speaker === 'other' && (
          <div className={styles.speakingPrompt}>
            <SpeakerWave />
            <span className={styles.speakingLabel}>
              {turn.speakerLabel || 'Them'} is speaking...
            </span>
            {canReplay && (
              <button className={styles.replayLineBtn} onClick={handleReplayOther} aria-label="Replay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3.12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* User's turn: show the line + record button */}
        {(phase === 'playing' || phase === 'recording') && turn?.speaker === 'user' && (
          <div className={styles.yourLineCard}>
            <span className={styles.yourLineLabel}>YOUR LINE</span>
            <p className={styles.yourLineRoman}>{romanOf(turn)}</p>
            <p className={styles.yourLineChinese} lang="yue">{turn.chinese}</p>
            <p className={styles.yourLineEnglish}>{turn.english}</p>
          </div>
        )}
        {phase === 'playing' && turn?.speaker === 'user' && (
          <RecordButton isRecording={false} onStart={handleRecord} onStop={() => {}} error={micError} />
        )}
        {phase === 'recording' && (
          <RecordButton isRecording={isRecording} onStart={handleRecord} onStop={handleStopRecord} error={micError} />
        )}

        {/* Scored */}
        {phase === 'scored' && (
          <div className={styles.scoredControls}>
            <ScoreBadge score={score} variant="full" />
            <button className={styles.continueBtn} onClick={handleContinue}>Continue</button>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className={styles.doneControls}>
            {!phrasesSaved ? (
              <button className={styles.saveBtn} onClick={handleSavePhrases}>
                Save phrases to library
              </button>
            ) : (
              <span className={styles.savedConfirm}>Saved to library</span>
            )}
            <div className={styles.doneRow}>
              <button className={styles.replayBtn} onClick={handleReplay}>Replay</button>
              <button className={styles.doneBtn} onClick={() => onComplete?.({})}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakerWave() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}
