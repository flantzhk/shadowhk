import { useState, useEffect, useRef } from 'react';
import styles from './ListenMode.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { KaraokeLine } from '../ui/KaraokeLine.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import { getAudioUrl } from '../../services/api.js';

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

  useEffect(() => {
    if (!sceneId) return;
    getSceneById(sceneId)
      .then(s => {
        setScene(s);
        // Build rough line timestamps: estimate 2s per line
        const times = (s.lines ?? []).reduce((acc, _, i) => {
          acc.push(i * 2);
          return acc;
        }, []);
        lineTimesRef.current = times;
      })
      .catch(() => {})
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
      for (let i = 0; i < times.length; i++) {
        if (t >= times[i]) active = i;
      }
      setCurrentLineIndex(active);
    }

    function onLoadedMetadata() {
      setDuration(el.duration);
    }

    function onEnded() {
      setIsPlaying(false);
      setCurrentLineIndex(0);
      setProgress(0);
    }

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
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else { el.play().then(() => setIsPlaying(true)).catch(() => {}); }
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
    const times = lineTimesRef.current;
    el.currentTime = times[index] ?? 0;
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
  const audioSrc = firstLineAudioFile
    ? `/shadowhk/audio/${language}/${firstLineAudioFile}`
    : null;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.screen}>
      <audio ref={audioRef} src={audioSrc ?? undefined} preload="metadata" />

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.emoji}>{scene?.emoji}</span>
          <span className={styles.title}>{scene?.title ?? 'Loading...'}</span>
        </div>
        <div className={styles.speedToggle}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
              onClick={() => { setSpeed(s); stopLoop(); }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className={styles.scrubberSection}>
        <div className={styles.scrubber} onClick={seek}>
          <div className={styles.scrubberFill} style={{ width: `${progress * 100}%` }} />
          <div className={styles.scrubberThumb} style={{ left: `${progress * 100}%` }} />
        </div>
        <div className={styles.timeRow}>
          <span>{formatTime(duration * progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Play button */}
      <div className={styles.playRow}>
        <button className={styles.playBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        {loopingIndex !== null && (
          <button className={styles.stopLoopBtn} onClick={stopLoop}>
            Stop loop
          </button>
        )}
      </div>

      {/* Karaoke transcript */}
      <div className={styles.transcript}>
        {loading && <div className={styles.skeleton} />}
        {!loading && lines.map((line, i) => (
          <div key={line.id} className={styles.lineRow}>
            <KaraokeLine
              romanization={line.romanization}
              english={line.english}
              cjk={line.cjk}
              state={
                loopingIndex === i ? 'now'
                : i < currentLineIndex ? 'past'
                : i === currentLineIndex ? 'now'
                : 'future'
              }
            />
            <button
              className={`${styles.loopBtn} ${loopingIndex === i ? styles.loopActive : ''}`}
              onClick={() => loopingIndex === i ? stopLoop() : loopLine(i)}
              aria-label="Loop this line"
            >
              <LoopIcon />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className={styles.ctaBar}>
        <button
          className={styles.shadowCta}
          onClick={() => onNavigate('shadow', sceneId)}
        >
          Shadow this scene
        </button>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const PauseIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const LoopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 8a6 6 0 016-6 5.97 5.97 0 014.24 1.76L14 2v4h-4l1.5-1.5A3.97 3.97 0 008 4a4 4 0 100 8 3.97 3.97 0 003.54-2.16l1.73.97A6 6 0 012 8z" fill="currentColor"/>
  </svg>
);
