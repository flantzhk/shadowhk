// src/components/cards/PronunciationFeedback.jsx — Per-word tone feedback after scoring

import { useState, useCallback } from 'react';
import { textToSpeech } from '../../services/api';
import { padAudioBlob } from '../../services/audio';
import { SCORE_THRESHOLDS } from '../../utils/constants';
import styles from './PronunciationFeedback.module.css';

/**
 * Detailed pronunciation breakdown shown after a session phrase is scored.
 * Uses wordScores from the scoring API + phrase.words for Jyutping mapping.
 *
 * @param {{
 *   phrase: Object,        // phrase object with .chinese, .words[], .romanization
 *   scoreResult: Object,   // full API response: { score, wordScores, transcribedText, ... }
 *   onHearPhrase: Function // callback to play full phrase via AudioEngine
 * }} props
 */
export default function PronunciationFeedback({ phrase, scoreResult, onHearPhrase }) {
  const [playingWord, setPlayingWord] = useState(null); // index of word currently playing

  // Build per-word data by matching API wordScores against phrase.words
  const wordData = buildWordData(phrase, scoreResult?.wordScores);

  // Sort: failed words first (to draw attention), then passed
  const sorted = [...wordData].sort((a, b) => {
    const aFailed = a.score !== null && a.score < SCORE_THRESHOLDS.GOOD;
    const bFailed = b.score !== null && b.score < SCORE_THRESHOLDS.GOOD;
    if (aFailed && !bFailed) return -1;
    if (!aFailed && bFailed) return 1;
    return 0;
  });

  const handlePlayWord = useCallback(async (word, index) => {
    if (playingWord === index) return;
    setPlayingWord(index);
    try {
      let blob = await textToSpeech(word.chinese, {
        language: 'cantonese',
        speed: 0.85,
        outputExtension: 'mp3',
      });
      blob = await padAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingWord(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingWord(null);
      };
      await audio.play();
    } catch {
      // Fallback: browser TTS
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(word.chinese);
        u.lang = 'zh-HK';
        u.rate = 0.8;
        u.onend = () => setPlayingWord(null);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } else {
        setPlayingWord(null);
      }
    }
  }, [playingWord]);

  if (!scoreResult || wordData.length === 0) return null;

  // Use the overall score (not just word scores) to decide if something failed.
  // This prevents "All correct" showing when overall score is low but word-level
  // scores came back null (API didn't return per-word data).
  const overallScore = scoreResult?.score ?? null;
  const hasFailed = (overallScore !== null && overallScore < SCORE_THRESHOLDS.GOOD) ||
    sorted.some(w => w.score !== null && w.score < SCORE_THRESHOLDS.GOOD);

  return (
    <div className={styles.container}>
      {/* Transcription */}
      {scoreResult.transcribedText && (
        <p className={styles.transcription}>
          <span className={styles.transcriptionLabel}>You said:</span>
          {' '}{scoreResult.transcribedText}
        </p>
      )}

      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>
          {hasFailed ? 'Work on these' : 'All correct'}
        </span>
        <button className={styles.hearAllBtn} onClick={onHearPhrase}>
          <PlayMiniIcon /> Hear phrase
        </button>
      </div>

      {/* Word grid */}
      <div className={styles.wordGrid}>
        {sorted.map((word, i) => {
          // null score = API gave no word-level data; treat as neutral (not "passed")
          const isPassed = word.score !== null && word.score >= SCORE_THRESHOLDS.GOOD;
          const isFailed = word.score !== null && word.score < SCORE_THRESHOLDS.GOOD;
          const isNeutral = word.score === null;
          const isPlaying = playingWord === i;
          return (
            <button
              key={i}
              className={`${styles.wordCard} ${isFailed ? styles.wordFailed : isPassed ? styles.wordPassed : styles.wordNeutral}`}
              onClick={() => handlePlayWord(word, i)}
              aria-label={`Hear ${word.chinese}`}
            >
              <span className={styles.wordStatus}>
                {isPassed ? <TickIcon /> : isFailed ? <CrossIcon /> : null}
              </span>
              <span className={styles.wordChinese}>{word.chinese}</span>
              <span className={styles.wordJyutping}>
                {word.jyutping}
                {word.toneNum && (
                  <span className={`${styles.toneNum} ${isPassed ? styles.tonePassed : styles.toneFailed}`}>
                    {' '}tone {word.toneNum}
                  </span>
                )}
              </span>
              {word.score !== null && (
                <span className={`${styles.wordScore} ${isPassed ? styles.scorePassed : styles.scoreFailed}`}>
                  {word.score}%
                </span>
              )}
              <span className={styles.hearHint}>
                {isPlaying ? <LoadingDots /> : 'tap to hear'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Match API wordScores against phrase.words by character content.
 * Returns an array of { chinese, jyutping, toneNum, score } objects.
 */
function buildWordData(phrase, wordScores) {
  if (!phrase?.words?.length) return [];

  // Build a character->score lookup from wordScores
  const charScoreMap = {};
  if (wordScores?.length) {
    for (const ws of wordScores) {
      const chars = [...(ws.word || '')];
      for (const ch of chars) {
        charScoreMap[ch] = ws.score ?? null;
      }
    }
  }

  return phrase.words.map(word => {
    const jyutping = word.jyutping || '';
    // Tone number is the last digit in Jyutping (e.g. "nei5" -> "5")
    const toneMatch = jyutping.match(/(\d)(?:\s|$)/);
    const toneNum = toneMatch ? toneMatch[1] : null;

    // Score: use char score if available, else null (neutral display)
    const firstChar = word.chinese?.[0];
    const score = firstChar && charScoreMap[firstChar] !== undefined
      ? charScoreMap[firstChar]
      : null;

    return {
      chinese: word.chinese,
      jyutping,
      toneNum,
      score,
    };
  });
}

function TickIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlayMiniIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function LoadingDots() {
  return <span className={styles.loadingDots}>...</span>;
}
