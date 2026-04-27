import { useState, useRef } from 'react';
import styles from './PhraseRow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { textToSpeech, fetchWithAuth } from '../../services/api.js';
import { API_BASE_URL, API_ENDPOINTS } from '../../utils/constants.js';

const SIZE_CLASSES = { sm: styles.sm, md: styles.md, lg: styles.lg };
const CJK_RE = /[一-鿿㐀-䶿]/u;

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
  const [playingCharIdx, setPlayingCharIdx] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [charMeanings, setCharMeanings] = useState(null); // null = not fetched, array = loaded
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

  async function handleCharPlay(e, char, idx) {
    e.stopPropagation();
    if (playingCharIdx === idx) {
      audioRef.current?.pause();
      setPlayingCharIdx(null);
      return;
    }
    try {
      setPlayingCharIdx(idx);
      const blob = await textToSpeech(char, { language, turbo: true });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlayingCharIdx(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlayingCharIdx(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setPlayingCharIdx(null);
    }
  }

  async function fetchMeanings() {
    if (!chinese || !jyutping) return;
    try {
      const prompt = `For the Cantonese phrase "${chinese}" (${jyutping}), give a JSON array of short English glosses — one per CJK character in order. Only output the JSON array, nothing else. Example: ["I","want","eat"]`;
      const res = await fetchWithAuth(`${API_BASE_URL}${API_ENDPOINTS.AI_CHAT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      });
      const data = await res.json();
      const text = data.reply ?? data.message ?? '';
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setCharMeanings(parsed);
      } else {
        setCharMeanings([]);
      }
    } catch {
      setCharMeanings([]);
    }
  }

  function handleToggleBreakdown(e) {
    e.stopPropagation();
    const next = !showBreakdown;
    setShowBreakdown(next);
    if (next && charMeanings === null) fetchMeanings();
  }

  const cjkChars = chinese ? chinese.split('').filter(c => CJK_RE.test(c)) : [];
  const syllables = jyutping ? jyutping.trim().split(/\s+/) : [];

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
        <button
          className={`${styles.chinese} ${showBreakdown ? styles.chineseOpen : ''}`}
          onClick={handleToggleBreakdown}
          aria-label="Show character breakdown"
          aria-expanded={showBreakdown}
        >
          {chinese}
          <span className={styles.breakdownChevron}>{showBreakdown ? '▲' : '▼'}</span>
        </button>
      )}
      {showBreakdown && cjkChars.length > 0 && (
        <div className={styles.breakdownPanel}>
          {cjkChars.map((char, i) => (
            <button
              key={i}
              className={`${styles.charCard} ${playingCharIdx === i ? styles.charCardActive : ''}`}
              onClick={e => handleCharPlay(e, char, i)}
              aria-label={`Play ${char}`}
            >
              <span className={styles.charCjk}>{char}</span>
              <span className={styles.charSyl}>{syllables[i] ?? '·'}</span>
              <span className={styles.charMeaning}>
                {charMeanings === null ? '···' : (charMeanings[i] ?? '·')}
              </span>
            </button>
          ))}
        </div>
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
