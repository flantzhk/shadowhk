import { useState, useEffect, useRef } from 'react';
import styles from './ListenMode.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import { phCapture } from '../../services/posthog.js';
import { logger } from '../../utils/logger.js';

const SPEEDS = [0.75, 1, 1.25];

export default function ListenMode({ sceneId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loopingIndex, setLoopingIndex] = useState(null);

  const audioRef = useRef(null);
  const lineTimesRef = useRef([]);
  const activeLineRef = useRef(null);
  const listenStartedRef = useRef(false);

  useEffect(() => {
    if (!sceneId) return;
    getSceneById(sceneId)
      .then(s => {
        setScene(s);
        const times = (s.lines ?? []).reduce((acc, _, i) => { acc.push(i * 2); return acc; }, []);
        lineTimesRef.current = times;
      })
      .catch(err => logger.error('[ListenMode] scene load failed', err?.message))
      .finally(() => setLoading(false));
  }, [sceneId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    function onTimeUpdate() {
      const t = el.currentTime;
      setProgress(el.duration > 0 ? t / el.duration : 0);
      const times = lineTimesRef.current;
      let active = 0;
      for (let i = 0; i < times.length; i++) { if (t >= times[i]) active = i; }
      setCurrentLineIndex(active);
    }
    function onLoadedMetadata() { setDuration(el.duration); }
    function onEnded() { setIsPlaying(false); setCurrentLineIndex(0); setProgress(0); }
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else {
      if (!listenStartedRef.current) {
        listenStartedRef.current = true;
        phCapture('listen_started', { scene_id: sceneId });
      }
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }

  function seek(e) {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.currentTime = ratio * el.duration;
  }

  function loopLine(index) {
    const el = audioRef.current;
    if (!el) return;
    setLoopingIndex(index);
    el.currentTime = lineTimesRef.current[index] ?? 0;
    el.playbackRate = 0.75;
    setSpeed(0.75);
    el.play().then(() => setIsPlaying(true)).catch(() => {});
  }

  function stopLoop() {
    setLoopingIndex(null);
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }

  const lines = scene?.lines ?? [];
  const firstLineAudioFile = lines[0]?.audioFile;
  const audioSrc = firstLineAudioFile ? `/shadowhk/audio/${language}/${firstLineAudioFile}` : null;

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.screen}>
      <audio ref={audioRef} src={audioSrc ?? undefined} preload="metadata" />

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
          <h1 className={styles.sceneTitle}>{loading ? ' ' : (scene?.title ?? '')}</h1>
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
            <span>{formatTime(duration * progress)}</span>
            <span className={styles.timeSep}>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          <button className={styles.playBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <div className={styles.speedGroup}>
            {SPEEDS.map(s => (
              <button
                key={s}
                className={`${styles.speedBtn} ${speed === s ? styles.speedOn : ''}`}
                onClick={() => { setSpeed(s); stopLoop(); }}
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
