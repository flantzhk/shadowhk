import { useState, useRef } from 'react';
import styles from './PhraseRow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { textToSpeech } from '../../services/api.js';

const SIZE_CLASSES = { sm: styles.sm, md: styles.md, lg: styles.lg };

export function PhraseRow({
  jyutping,
  english,
  chinese,
  role,
  score,
  isActive = false,
  onHeartToggle,
  saved = false,
  size = 'md',
  highlightedJyutping,
}) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const sizeClass = SIZE_CLASSES[size] ?? styles.md;

  const scorePillClass =
    score >= 85 ? styles.scoreExcellent :
    score >= 70 ? styles.scoreGood :
    styles.scoreFair;

  async function handlePlay(e) {
    e.stopPropagation();
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!chinese) return;
    try {
      setPlaying(true);
      const blob = await textToSpeech(chinese, { language, turbo: true });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <div className={`${styles.row} ${sizeClass} ${isActive ? styles.active : ''}`}>
      <div className={styles.jyutping}>
        {highlightedJyutping ?? jyutping}
        {role && <span className={styles.role}> · {role}</span>}
      </div>
      {english && (
        <div className={styles.english}>"{english}"</div>
      )}
      {chinese && (
        <div className={styles.chinese}>{chinese}</div>
      )}
      <div className={styles.meta}>
        {score != null && (
          <span className={`${styles.scorePill} ${scorePillClass}`}>{score}</span>
        )}
        {chinese && (
          <button
            className={`${styles.playBtn} ${playing ? styles.playBtnActive : ''}`}
            onClick={handlePlay}
            aria-label="Play phrase"
          >
            {playing
              ? <svg width="13" height="13" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>
              : <svg width="13" height="13" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,0 10,5 2,10"/></svg>
            }
          </button>
        )}
        {onHeartToggle && (
          <button
            className={`${styles.heart} ${saved ? styles.heartSaved : ''}`}
            onClick={onHeartToggle}
            aria-label={saved ? 'Remove from library' : 'Save to library'}
          >
            {saved ? '♥' : '♡'}
          </button>
        )}
      </div>
    </div>
  );
}
