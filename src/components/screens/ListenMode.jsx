// src/components/screens/ListenMode.jsx — karaoke-style scene listening.
// Plays the per-line recordings sequentially through one audio element:
// line ends -> short beat -> next line. Highlighting follows the real line,
// not estimated timestamps.

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ListenMode.module.css';
import { getSceneById } from '../../services/sceneLoader';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { phCapture } from '../../services/posthog';
import { logger } from '../../utils/logger';

const SPEEDS = [0.75, 1, 1.25];
const LINE_GAP_MS = 350;

export default function ListenMode({ sceneId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lineFraction, setLineFraction] = useState(0); // 0-1 within current line
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopingIndex, setLoopingIndex] = useState(null);
  const [speed, setSpeed] = useState(1);

  const audioRef = useRef(null);
  const activeLineRef = useRef(null);
  const listenStartedRef = useRef(false);
  const gapTimerRef = useRef(null);
  // Refs mirror state the audio callbacks need, avoiding stale closures
  const indexRef = useRef(0);
  const loopingRef = useRef(null);
  const speedRef = useRef(1);
  const linesRef = useRef([]);

  useEffect(() => {
    if (!sceneId) return;
    getSceneById(sceneId)
      .then(s => {
        setScene(s);
        linesRef.current = s?.lines ?? [];
      })
      .catch(err => logger.error('[ListenMode] scene load failed', err?.message))
      .finally(() => setLoading(false));
  }, [sceneId]);

  useEffect(() => () => clearTimeout(gapTimerRef.current), []);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex, loopingIndex]);

  const lineSrc = useCallback((i) => {
    const line = linesRef.current[i];
    return line ? `/shadowhk/audio/${language}/${line.id}.mp3` : null;
  }, [language]);

  /** Load and play line i. The single audio element's src swaps per line. */
  const playLine = useCallback((i) => {
    const el = audioRef.current;
    const src = lineSrc(i);
    if (!el || !src) return;
    clearTimeout(gapTimerRef.current);
    indexRef.current = i;
    setCurrentLineIndex(i);
    setLineFraction(0);

    const absolute = new URL(src, window.location.origin).href;
    if (el.src !== absolute) el.src = src;
    el.playbackRate = loopingRef.current !== null ? 0.75 : speedRef.current;
    el.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        logger.warn('[ListenMode] play failed', err?.message);
        setIsPlaying(false);
      });
  }, [lineSrc]);

  // Wire the element's lifecycle once
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    function onTimeUpdate() {
      if (el.duration > 0) setLineFraction(el.currentTime / el.duration);
    }
    function onEnded() {
      const i = indexRef.current;
      if (loopingRef.current !== null) {
        // Loop the same line with a beat of silence between repeats
        gapTimerRef.current = setTimeout(() => playLine(loopingRef.current), LINE_GAP_MS);
        return;
      }
      if (i + 1 < linesRef.current.length) {
        gapTimerRef.current = setTimeout(() => playLine(i + 1), LINE_GAP_MS);
      } else {
        setIsPlaying(false);
        setCurrentLineIndex(0);
        setLineFraction(0);
        indexRef.current = 0;
      }
    }
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [playLine]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      clearTimeout(gapTimerRef.current);
      el.pause();
      setIsPlaying(false);
    } else {
      if (!listenStartedRef.current) {
        listenStartedRef.current = true;
        phCapture('listen_started', { scene_id: sceneId });
      }
      // Resume mid-line if possible, otherwise (re)start the current line
      if (el.src && el.currentTime > 0 && !el.ended) {
        el.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        playLine(indexRef.current);
      }
    }
  }

  /** Scrubber is line-based: clicking 60% of the bar jumps to the line 60% in. */
  function seek(e) {
    const total = linesRef.current.length;
    if (!total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 0.999);
    const target = Math.floor(ratio * total);
    setLoopingIndex(null);
    loopingRef.current = null;
    playLine(target);
  }

  function jumpToLine(i) {
    setLoopingIndex(null);
    loopingRef.current = null;
    playLine(i);
  }

  function loopLine(index) {
    setLoopingIndex(index);
    loopingRef.current = index;
    setSpeed(0.75);
    speedRef.current = 0.75;
    playLine(index);
  }

  function stopLoop() {
    setLoopingIndex(null);
    loopingRef.current = null;
    const el = audioRef.current;
    if (el) el.playbackRate = speedRef.current;
  }

  function changeSpeed(s) {
    setSpeed(s);
    speedRef.current = s;
    stopLoop();
    const el = audioRef.current;
    if (el) el.playbackRate = s;
  }

  const lines = scene?.lines ?? [];
  const totalLines = lines.length;
  const progress = totalLines > 0 ? (currentLineIndex + lineFraction) / totalLines : 0;

  return (
    <div className={styles.screen}>
      <audio ref={audioRef} preload="auto" />

      {/* Hero */}
      <div
        className={styles.hero}
        style={scene?.imageUrl ? { backgroundImage: `url(${scene.imageUrl})` } : {}}
      >
        <div className={styles.heroOverlay} />
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.heroMeta}>
          <span className={styles.listenBadge}>
            <span className={styles.listenDot} />
            LISTEN
          </span>
          <h1 className={styles.sceneTitle}>{loading ? ' ' : (scene?.title ?? '')}</h1>
          {scene?.location && <p className={styles.sceneLocation}>{scene.location}</p>}
        </div>
      </div>

      {/* Conversation thread */}
      <div className={styles.conversation}>
        {scene?.context && (
          <div className={styles.contextCard}>
            <span className={styles.contextLabel}>SCENE</span>
            <p className={styles.contextText}>{scene.context}</p>
          </div>
        )}

        {loading && (
          <>
            <div className={`${styles.skeletonRow} ${styles.skeletonLeft}`}><div className={styles.skeletonBubble} /></div>
            <div className={`${styles.skeletonRow} ${styles.skeletonRight}`}><div className={styles.skeletonBubble} /></div>
            <div className={`${styles.skeletonRow} ${styles.skeletonLeft}`}><div className={styles.skeletonBubble} /></div>
          </>
        )}

        {!loading && lines.map((line, i) => {
          const isYou = line.speaker === 'you';
          const isActive = loopingIndex === i || (loopingIndex === null && i === currentLineIndex);
          const isPast = loopingIndex === null && i < currentLineIndex;

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : null}
              className={`${styles.messageRow} ${isYou ? styles.youRow : styles.themRow}`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => jumpToLine(i)}
                onKeyDown={(e) => { if (e.key === 'Enter') jumpToLine(i); }}
                className={[
                  styles.bubble,
                  isYou ? styles.youBubble : styles.themBubble,
                  isActive ? styles.activeBubble : '',
                  isPast ? styles.pastBubble : '',
                ].join(' ')}
              >
                {line.cjk && (
                  <span className={styles.cjkText} lang="yue">{line.cjk}</span>
                )}
                {line.romanization && (
                  <span className={styles.romanText}>{line.romanization}</span>
                )}
                {line.english && (
                  <span className={styles.englishText}>{line.english}</span>
                )}
              </div>
              <button
                className={`${styles.loopBtn} ${loopingIndex === i ? styles.loopActive : ''}`}
                onClick={() => loopingIndex === i ? stopLoop() : loopLine(i)}
                aria-label={loopingIndex === i ? 'Stop loop' : 'Loop this line'}
              >
                <LoopIcon />
              </button>
            </div>
          );
        })}
      </div>

      {/* Player bar */}
      <div className={styles.playerBar}>
        <div className={styles.scrubberTrack} onClick={seek}>
          <div className={styles.scrubberFill} style={{ width: `${progress * 100}%` }} />
          <div className={styles.scrubberThumb} style={{ left: `${progress * 100}%` }} />
        </div>

        <div className={styles.playerRow}>
          <div className={styles.timeDisplay}>
            <span>LINE {totalLines ? currentLineIndex + 1 : 0}</span>
            <span className={styles.timeSep}>/</span>
            <span>{totalLines}</span>
          </div>

          <button className={styles.playBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <div className={styles.speedGroup}>
            {SPEEDS.map(s => (
              <button
                key={s}
                className={`${styles.speedBtn} ${speed === s ? styles.speedOn : ''}`}
                onClick={() => changeSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {loopingIndex !== null && (
          <div className={styles.loopBanner}>
            <span className={styles.loopBannerText}>Looping line {loopingIndex + 1}</span>
            <button className={styles.loopBannerStop} onClick={stopLoop}>Stop</button>
          </div>
        )}

        <button className={styles.shadowCta} onClick={() => onNavigate('shadow', sceneId)}>
          Shadow this scene
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

const LoopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 8a6 6 0 016-6 5.97 5.97 0 014.24 1.76L14 2v4h-4l1.5-1.5A3.97 3.97 0 008 4a4 4 0 100 8 3.97 3.97 0 003.54-2.16l1.73.97A6 6 0 012 8z" fill="currentColor"/>
  </svg>
);
