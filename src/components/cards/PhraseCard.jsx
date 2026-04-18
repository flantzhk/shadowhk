// src/components/cards/PhraseCard.jsx — Shared phrase card for Library + Topic Detail

import { useState, useCallback, useRef } from 'react';
import { saveLibraryEntry, getLibraryEntry } from '../../services/storage';
import { textToSpeech } from '../../services/api';
import { getCachedAudio, cacheAudioBlob, padAudioBlob } from '../../services/audio';
import { isAuthenticated } from '../../services/auth';
import { useAudio } from '../../contexts/AudioContext';
import { SRS_INITIAL_EASE, SRS_MAX_INTERVAL } from '../../utils/constants';
import { formatReviewStatus } from '../../utils/formatters';
import styles from './PhraseCard.module.css';

/**
 * Play a single phrase via static file → cache → TTS API → speechSynthesis fallback.
 * Returns the Audio element (or null for speechSynthesis path).
 */
async function playPhraseAudio(phraseId, chinese, language = 'cantonese') {
  const speed = 1.0;

  // 1. Static pre-generated MP3
  try {
    const basePath = import.meta.env.BASE_URL || '/';
    const resp = await fetch(`${basePath}audio/${language}/${phraseId}.mp3`);
    if (resp.ok) {
      let blob = await resp.blob();
      if (blob.size > 500) {
        blob = await padAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        return audio;
      }
    }
  } catch {}

  // 2. Browser cache
  try {
    let cached = await getCachedAudio(phraseId, language, speed);
    if (cached) {
      cached = await padAudioBlob(cached);
      const url = URL.createObjectURL(cached);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return audio;
    }
  } catch {}

  // 3. TTS API (cantonese.ai)
  if (isAuthenticated()) {
    try {
      let blob = await textToSpeech(chinese, { language, speed, outputExtension: 'mp3' });
      if (blob && blob.size > 0) {
        cacheAudioBlob(phraseId, language, speed, blob).catch(() => {});
        blob = await padAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        return audio;
      }
    } catch {}
  }

  // 4. Fallback: browser speechSynthesis
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(chinese);
    u.lang = 'zh-HK';
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
  }
  return null;
}

/**
 * @param {{
 *   phrase: Object,
 *   libraryEntry: Object|null,
 *   language: string,
 *   onPlay: (chinese: string) => void,
 *   onSaved: (phraseId: string) => void,
 *   showToast: Function,
 * }} props
 */
export default function PhraseCard({ phrase, libraryEntry, language = 'cantonese', onPlay, onSaved, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [saved, setSaved] = useState(!!libraryEntry);
  const [entry, setEntry] = useState(libraryEntry);
  const [celebrated, setCelebrated] = useState(false);
  const repeatRef = useRef(null);      // setTimeout handle for repeat loop
  const repeatAudioRef = useRef(null); // current Audio element in repeat loop
  const repeatUsedQueue = useRef(false); // whether this repeat session used AudioEngine

  const { loadQueue, play, stop, prime, isRepeat, toggleRepeat } = useAudio();

  const chinese = phrase?.chinese || entry?.customData?.chinese;
  const romanization = phrase?.romanization || entry?.customData?.jyutping;
  const english = phrase?.english || entry?.customData?.english;
  const isVocab = entry?.type === 'vocab';

  // ── Play single phrase via proper audio chain ──────────────────────────────
  const handlePlay = useCallback(async (e) => {
    e?.stopPropagation();
    if (!chinese) return;
    if (phrase?.id) {
      await playPhraseAudio(phrase.id, chinese, language);
    } else if (onPlay) {
      // External handler provided (e.g. AI chat screen)
      onPlay(chinese);
    } else {
      // Vocab-only entry — no phraseId and no external handler; fall through to TTS
      await playPhraseAudio(null, chinese, language);
    }
  }, [chinese, phrase?.id, language, onPlay]);

  // ── Repeat loop using proper audio chain ───────────────────────────────────
  const handleRepeat = useCallback((e) => {
    e?.stopPropagation();

    if (repeating) {
      setRepeating(false);
      if (repeatUsedQueue.current) {
        // We used AudioEngine — tear down: disable repeat if we enabled it, stop queue
        if (isRepeat) toggleRepeat();
        stop();
        repeatUsedQueue.current = false;
      } else {
        // Local audio loop — clean up timers + elements
        clearTimeout(repeatRef.current);
        repeatAudioRef.current?.pause();
        repeatAudioRef.current = null;
        window.speechSynthesis?.cancel();
      }
      return;
    }

    setRepeating(true);

    if (phrase?.id) {
      // Phrase with ID — route through AudioEngine so MiniPlayer appears
      repeatUsedQueue.current = true;
      prime();
      if (!isRepeat) toggleRepeat(); // Enable AudioEngine repeat mode
      loadQueue([phrase], language).then(() => play());
    } else {
      // Vocab-only entry — no phraseId, use local audio loop
      repeatUsedQueue.current = false;
      let active = true;

      const playLoop = async () => {
        if (!active) return;
        const audio = await playPhraseAudio(null, chinese, language);
        if (!active) { audio?.pause(); return; }

        if (audio) {
          repeatAudioRef.current = audio;
          audio.onended = () => {
            if (active) repeatRef.current = setTimeout(playLoop, 1500);
          };
        } else {
          // speechSynthesis path — set up repeat via polling
          if ('speechSynthesis' in window) {
            const existing = window.speechSynthesis;
            const checkDone = setInterval(() => {
              if (!existing.speaking) {
                clearInterval(checkDone);
                if (active) repeatRef.current = setTimeout(playLoop, 1500);
              }
            }, 200);
          }
        }
      };

      playLoop();
    }
  }, [chinese, phrase, language, repeating, loadQueue, play, stop, prime, isRepeat, toggleRepeat]);

  // ── Play individual word (expand section) ─────────────────────────────────
  const handlePlayWord = useCallback(async (e, wordChinese) => {
    e?.stopPropagation();
    if (isAuthenticated()) {
      try {
        let blob = await textToSpeech(wordChinese, { language, speed: 1.0, outputExtension: 'mp3' });
        if (blob && blob.size > 0) {
          blob = await padAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play();
          return;
        }
      } catch {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(wordChinese);
      u.lang = 'zh-HK';
      u.rate = 0.7;
      window.speechSynthesis.speak(u);
    }
  }, [language]);

  // ── Save to library ────────────────────────────────────────────────────────
  const handleSaveToLibrary = useCallback(async () => {
    if (saved) return;
    try {
      const newEntry = {
        phraseId: phrase.id, type: 'phrase', addedAt: Date.now(), source: 'browse',
        customData: null, interval: 0, easeFactor: SRS_INITIAL_EASE,
        nextReviewAt: Date.now(), lastPracticedAt: null, practiceCount: 0,
        status: 'learning', bestScore: null, lastScore: null, scoreHistory: [],
      };
      await saveLibraryEntry(newEntry);
      setSaved(true);
      setEntry(newEntry);
      onSaved?.(phrase.id);
      showToast?.('Saved to library', 'success');
    } catch {}
  }, [phrase, saved, onSaved, showToast]);

  const handleSaveWord = useCallback(async (word) => {
    try {
      await saveLibraryEntry({
        phraseId: `word-${word.chinese}`, type: 'vocab', addedAt: Date.now(),
        source: 'word-card',
        customData: { chinese: word.chinese, jyutping: word.jyutping, english: word.english },
        interval: 0, easeFactor: 2.5, nextReviewAt: Date.now(), lastPracticedAt: null,
        practiceCount: 0, status: 'learning', bestScore: null, lastScore: null, scoreHistory: [],
      });
      showToast?.('Added to Library', 'success');
    } catch {}
  }, [showToast]);

  // ── Mark as known (saves if not yet in library) ───────────────────────────
  const handleMarkKnown = useCallback(async () => {
    const now = Date.now();
    let updated;
    if (!entry) {
      if (!phrase?.id) return;
      updated = {
        phraseId: phrase.id, type: 'phrase', addedAt: now, source: 'browse',
        customData: null, interval: SRS_MAX_INTERVAL, easeFactor: SRS_INITIAL_EASE,
        nextReviewAt: now + SRS_MAX_INTERVAL * 24 * 60 * 60 * 1000,
        lastPracticedAt: null, practiceCount: 0, status: 'mastered',
        bestScore: null, lastScore: null, scoreHistory: [],
      };
      setSaved(true);
    } else {
      updated = {
        ...entry, status: 'mastered', interval: SRS_MAX_INTERVAL,
        nextReviewAt: now + SRS_MAX_INTERVAL * 24 * 60 * 60 * 1000,
      };
    }
    await saveLibraryEntry(updated);
    setEntry(updated);
    setCelebrated(true);
    setTimeout(() => setCelebrated(false), 900);
    showToast?.('Marked as known!', 'success');
    onSaved?.(phrase?.id);
  }, [entry, phrase, showToast, onSaved]);

  const isMastered = entry?.status === 'mastered';
  const hasText = romanization || chinese || english;

  return (
    <div className={styles.card}>
      {/* Top row: play | text | expand */}
      <div className={styles.topRow}>
        <button className={styles.playBtn} onClick={handlePlay} aria-label="Play" disabled={!hasText}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-brand-dark)">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>

        <button className={styles.body} onClick={() => setExpanded(!expanded)}>
          <div className={styles.textGroup}>
            {hasText ? (
              <>
                <span className={styles.romanization}>{romanization}</span>
                {chinese && <span className={styles.chinese} lang="yue">{chinese}</span>}
                {english && <span className={styles.english}>{english}</span>}
              </>
            ) : (
              <span className={styles.missingText}>Phrase data unavailable</span>
            )}
          </div>
          <span className={`${styles.expandIcon} ${expanded ? styles.expandIconOpen : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
      </div>

      {/* Status row: "I know this" button or mastered badge + review info */}
      {(phrase || entry) && (
        <div className={styles.statusRow}>
          {isMastered ? (
            <span className={`${styles.badge} ${styles.badgeMastered}`}>✓ Mastered</span>
          ) : phrase ? (
            <button
              className={`${styles.knowBtn} ${celebrated ? styles.knowBtnCelebrate : ''}`}
              onClick={(e) => { e.stopPropagation(); handleMarkKnown(); }}
              aria-label="I know this phrase"
            >
              I know this
            </button>
          ) : null}
          {entry && !isMastered && (
            <span className={`${styles.badge} ${styles.badgeLearning}`}>
              {formatReviewStatus(entry.interval, entry.nextReviewAt, entry.practiceCount)}
            </span>
          )}
          {entry?.bestScore != null && (
            <span className={styles.score}>Best: {entry.bestScore}%</span>
          )}
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className={styles.expandedSection}>
          {phrase?.words && phrase.words.length > 0 && (
            <div className={styles.wordCards}>
              {phrase.words.map((word, i) => (
                <div key={i} className={styles.wordCard}>
                  <div className={styles.wordTap} onClick={(e) => handlePlayWord(e, word.chinese)}>
                    <span className={styles.wordChinese} lang="yue">{word.chinese}</span>
                    <span className={styles.wordJyutping}>{word.jyutping}</span>
                    <span className={styles.wordEnglish}>{word.english}</span>
                    <span className={styles.wordSpeaker}>🔊</span>
                  </div>
                  <button className={styles.wordSave} onClick={(e) => { e.stopPropagation(); handleSaveWord(word); }}>
                    + Library
                  </button>
                </div>
              ))}
            </div>
          )}

          {phrase?.context && (
            <p className={styles.context}>{phrase.context}</p>
          )}

          <div className={styles.actions}>
            <button className={`${styles.actionBtn} ${repeating ? styles.actionActive : ''}`} onClick={handleRepeat}>
              {repeating ? '⏹ Stop' : '🔁 Repeat'}
            </button>
            {!saved && phrase && (
              <button className={styles.actionBtn} onClick={handleSaveToLibrary}>
                + Library
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
