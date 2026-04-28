import { useState, useRef } from 'react';
import styles from './PhraseRow.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { textToSpeech, fetchWithAuth } from '../../services/api.js';
import { API_BASE_URL, API_ENDPOINTS } from '../../utils/constants.js';

const SIZE_CLASSES = { sm: styles.sm, md: styles.md, lg: styles.lg };

function BookmarkIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

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
  const [playingWordIdx, setPlayingWordIdx] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [wordGroups, setWordGroups] = useState(null); // null = not fetched, false = error, array = done
  const audioRef = useRef(null);
  const sizeClass = SIZE_CLASSES[size] ?? styles.md;

  const scorePillClass =
    score >= 85 ? styles.scoreExcellent :
    score >= 70 ? styles.scoreGood :
    styles.scoreFair;

  async function playAudio(text, onDone) {
    try {
      const blob = await textToSpeech(text, { language, turbo: true });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); onDone?.(); };
      audio.onerror = () => { URL.revokeObjectURL(url); onDone?.(); };
      audio.play();
    } catch {
      onDone?.();
    }
  }

  async function handlePlay(e) {
    e.stopPropagation();
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!chinese) return;
    setPlaying(true);
    playAudio(chinese, () => setPlaying(false));
  }

  async function handleWordPlay(e, chars, idx) {
    e.stopPropagation();
    if (playingWordIdx === idx) {
      audioRef.current?.pause();
      setPlayingWordIdx(null);
      return;
    }
    setPlayingWordIdx(idx);
    playAudio(chars, () => setPlayingWordIdx(null));
  }

  async function fetchWordGroups() {
    if (!chinese) return;
    try {
      const prompt = `You are a Cantonese language teacher. For the phrase below, return ONLY a raw JSON array — no markdown, no code block, no explanation. Each element: {"chars":"...","meaning":"..."}. Group multi-character words as one unit (e.g. 銅鑼灣 → {"chars":"銅鑼灣","meaning":"Causeway Bay"}, 唔該 → {"chars":"唔該","meaning":"excuse me"}). Skip punctuation. Cover every meaningful word in order.\n\nPhrase: ${chinese}\nJyutping: ${jyutping ?? ''}`;
      const res = await fetchWithAuth(`${API_BASE_URL}${API_ENDPOINTS.AI_CHAT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          language,
          mode: 'explain',
        }),
      });
      const data = await res.json();
      console.log('[PhraseRow] breakdown response:', JSON.stringify(data).slice(0, 400));
      // strip markdown code fences before parsing
      const raw = (data.content ?? data.message ?? data.reply ?? '')
        .replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      console.log('[PhraseRow] raw text:', raw.slice(0, 200));
      // anchor on [{ ... }] to avoid matching prose square brackets
      const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setWordGroups(parsed.filter(g => g.chars && g.meaning));
      } else {
        setWordGroups(false);
      }
    } catch {
      setWordGroups(false);
    }
  }

  function handleToggleBreakdown(e) {
    e.stopPropagation();
    const next = !showBreakdown;
    setShowBreakdown(next);
    // fetch on first open, or retry after error
    if (next && (wordGroups === null || wordGroups === false)) fetchWordGroups();
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
        <button
          className={`${styles.chineseBtn} ${showBreakdown ? styles.chineseBtnOpen : ''}`}
          onClick={handleToggleBreakdown}
          aria-label="Show word breakdown"
          aria-expanded={showBreakdown}
        >
          <span className={styles.chineseText}>{chinese}</span>
          <span className={styles.chevron} aria-hidden="true">
            {showBreakdown ? '▲' : '▾'}
          </span>
        </button>
      )}
      {showBreakdown && (
        <div className={styles.breakdownPanel}>
          {wordGroups === null ? (
            <span className={styles.loadingText}>Loading…</span>
          ) : wordGroups === false ? (
            <span className={styles.loadingText}>Couldn't load — tap ▾ to retry</span>
          ) : wordGroups.map((group, i) => (
            <button
              key={i}
              className={`${styles.wordCard} ${playingWordIdx === i ? styles.wordCardActive : ''}`}
              onClick={e => handleWordPlay(e, group.chars, i)}
              aria-label={`Play ${group.chars} — ${group.meaning}`}
            >
              <span className={styles.wordCjk}>{group.chars}</span>
              <span className={styles.wordMeaning}>{group.meaning}</span>
              <span className={`${styles.wordPlayBtn} ${playingWordIdx === i ? styles.wordPlayBtnActive : ''}`}>
                {playingWordIdx === i
                  ? <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>
                  : <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,0 10,5 2,10"/></svg>
                }
              </span>
            </button>
          ))}
        </div>
      )}
      <div className={styles.meta}>
        <div className={styles.metaLeft}>
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
        </div>
        {onHeartToggle && (
          <button
            className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
            onClick={e => { e.stopPropagation(); onHeartToggle(e); }}
            aria-label={saved ? 'Remove from library' : 'Save to library'}
          >
            <BookmarkIcon filled={saved} />
            <span className={styles.saveBtnLabel}>{saved ? 'Saved' : 'Save'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
