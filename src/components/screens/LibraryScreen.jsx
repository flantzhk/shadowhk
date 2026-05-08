import { useState, useEffect, useRef } from 'react';
import styles from './LibraryScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntries, getLibraryEntry, saveLibraryEntry } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { GROWTH_STATE } from '../../utils/constants.js';
import { getAllScenes } from '../../services/sceneLoader.js';
import { textToSpeech } from '../../services/api.js';

const REFERENCE_SETS = [
  { id: 'numbers',  title: 'Numbers' },
  { id: 'colours',  title: 'Colours' },
  { id: 'calendar', title: 'Calendar' },
  { id: 'time',     title: 'Telling the Time' },
];

const FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'said', label: '📍 SAID IN PERSON' },
  { id: 'needs-work', label: 'NEEDS WORK' },
  { id: 'mastered', label: 'MASTERED' },
];

export default function LibraryScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => { reload(); }, [language]);

  async function toggleLived(e, phrase) {
    e.stopPropagation();
    const entry = await getLibraryEntry(phrase.id).catch(() => null);
    if (!entry) return;
    const updated = { ...entry, lived_at: entry.lived_at ? null : Date.now() };
    await saveLibraryEntry(updated);
    setLibrary(prev => prev.map(p => p.id === phrase.id ? { ...p, lived_at: updated.lived_at } : p));
  }

  async function playInline(e, phrase) {
    e.stopPropagation();

    // toggle off if already playing
    if (playingId === phrase.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    setPlayingId(phrase.id);

    try {
      const basePath = import.meta.env.BASE_URL || '/';
      let blobUrl = null;

      try {
        const resp = await fetch(`${basePath}audio/${language}/${phrase.id}.mp3`);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 500) blobUrl = URL.createObjectURL(blob);
        }
      } catch (_) {}

      if (!blobUrl) {
        const blob = await textToSpeech(phrase.cjk, { language });
        if (blob && blob.size > 0) blobUrl = URL.createObjectURL(blob);
      }

      if (!blobUrl) { setPlayingId(null); return; }

      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); };
      audio.onerror = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); };
      audio.play();
    } catch (_) {
      setPlayingId(null);
    }
  }

  async function reload() {
    setLoading(true);
    try {
      const [entries, loadedScenes] = await Promise.all([
        getLibraryEntries(language),
        getAllScenes(language),
      ]);
      const enriched = entries.map(e => ({
        ...e,
        growth_state: growthStateFromInterval(e.interval ?? 0, e.reps ?? 0),
      }));
      setLibrary(enriched);
      setScenes(loadedScenes);
    } catch (_) {}
    finally { setLoading(false); }
  }

  const groups = new Map();
  for (const phrase of library) {
    const key = phrase.scene_id ?? 'unsorted';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(phrase);
  }
  const groupedScenes = [...groups.entries()]
    .map(([sceneId, phrases]) => ({
      scene: scenes.find(s => s.id === sceneId) ?? null,
      sceneId,
      phrases,
    }))
    .sort((a, b) => b.phrases.length - a.phrases.length);

  const totalPhrases = library.length;
  const totalScenes = groupedScenes.filter(g => g.scene).length;
  const saidInPersonCount = library.filter(p => p.lived_at).length;

  function filterPhrases(phrases) {
    let result = phrases;
    if (activeFilter === 'said') result = result.filter(p => p.lived_at);
    else if (activeFilter === 'needs-work') result = result.filter(p => p.growth_state !== GROWTH_STATE.MASTERED && !p.lived_at);
    else if (activeFilter === 'mastered') result = result.filter(p => p.growth_state === GROWTH_STATE.MASTERED);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.romanization ?? '').toLowerCase().includes(q) ||
        (p.english ?? '').toLowerCase().includes(q) ||
        (p.cjk ?? '').includes(searchQuery)
      );
    }
    return result;
  }

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>
        {totalPhrases} {totalPhrases === 1 ? 'PHRASE' : 'PHRASES'} · {totalScenes} {totalScenes === 1 ? 'SCENE' : 'SCENES'}
        {saidInPersonCount > 0 && <span className={styles.saidCount}> · {saidInPersonCount} SAID IN PERSON 📍</span>}
      </p>
      <h1 className={styles.title}>Your <span className={styles.titleItalic}>phrasebook</span>.</h1>

      {totalPhrases > 0 && (
        <button className={styles.ctaBanner} onClick={() => onNavigate('shadow')}>
          <span className={styles.ctaBannerLeft}>
            <span className={styles.ctaPlay}>▶</span>
            Start today's lesson
          </span>
          <span className={styles.ctaMeta}>12 MIN</span>
        </button>
      )}

      <div className={styles.searchBarWrap}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="SEARCH PHRASES, SCENES…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      <div className={styles.filterChips}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`${styles.filterChip} ${activeFilter === f.id ? styles.filterChipActive : ''}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activeFilter === 'all' && !searchQuery && (
        <>
          <div className={styles.refHeader}>
            <span className={styles.refLabel}>— REFERENCE SETS</span>
            <span className={styles.refTapHint}>TAP TO BROWSE</span>
          </div>
          <div className={styles.refGrid}>
            {REFERENCE_SETS.map(s => (
              <button
                key={s.id}
                className={styles.refCard}
                onClick={() => onNavigate?.('reference', s.id)}
              >
                <span className={styles.refTitle}>{s.title}</span>
                <span className={styles.refArrow}>→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {loading && <div className={styles.skeleton} />}

      {!loading && totalPhrases === 0 && (
        <div className={styles.empty}>
          <p>Your library is empty.</p>
          <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
        </div>
      )}

      {!loading && groupedScenes.map(({ scene, sceneId, phrases }) => {
        const filtered = filterPhrases(phrases);
        if (filtered.length === 0) return null;
        const saidCount = phrases.filter(p => p.lived_at).length;

        return (
          <section key={sceneId} className={styles.sceneGroup}>
            <button
              className={styles.sceneRow}
              onClick={() => scene && onNavigate('scene', scene.id)}
            >
              <div
                className={styles.sceneThumb}
                style={{
                  backgroundImage: scene?.imageUrl ? `url(${scene.imageUrl})` : undefined,
                  backgroundColor: scene?.tint ? scene.tint + '88' : 'var(--bg-3)',
                }}
              />
              <div className={styles.sceneText}>
                <p className={styles.sceneName}>{scene?.title ?? 'Other phrases'}</p>
                <p className={styles.sceneMeta}>
                  {phrases.length} {phrases.length === 1 ? 'PHRASE' : 'PHRASES'}
                  {saidCount > 0 && (
                    <span className={styles.saidInline}> · {saidCount} SAID IN PERSON 📍</span>
                  )}
                </p>
              </div>
              <span className={styles.chevron}>›</span>
            </button>

            <div className={styles.phraseList}>
              {filtered.map(phrase => (
                <div
                  key={phrase.id}
                  className={styles.phraseRow}
                  onClick={() => onNavigate('phrase', phrase.id)}
                  role="button"
                  tabIndex={0}
                >
                  <PhraseDot phrase={phrase} styles={styles} />
                  <div className={styles.phraseText}>
                    <p className={styles.phraseCjk}>{phrase.cjk}</p>
                    <p className={styles.phraseRoman}>{phrase.romanization}</p>
                    <p className={styles.phraseEnglish}>{phrase.english}</p>
                  </div>
                  <div className={styles.phraseActions}>
                    <button
                      className={`${styles.livedToggle} ${phrase.lived_at ? styles.livedToggleActive : ''}`}
                      onClick={e => toggleLived(e, phrase)}
                      aria-label={phrase.lived_at ? 'Unmark said in person' : 'Mark as said in person'}
                      title={phrase.lived_at ? 'Said in person ✓' : 'Mark as said in person'}
                    >
                      📍
                    </button>
                    <button
                      className={`${styles.playBtn} ${playingId === phrase.id ? styles.playBtnActive : ''}`}
                      onClick={e => playInline(e, phrase)}
                      aria-label={playingId === phrase.id ? 'Stop' : 'Play'}
                    >
                      {playingId === phrase.id ? <StopIcon /> : <PlayIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className={styles.bottomPad} />
    </div>
  );
}

function PhraseDot({ phrase, styles }) {
  if (phrase.lived_at) {
    return <span className={styles.dotPin}>📍</span>;
  }
  const gs = phrase.growth_state;
  if (gs === GROWTH_STATE.MASTERED || gs === GROWTH_STATE.STRONG) {
    return <span className={styles.dotFilled} />;
  }
  return <span className={styles.dotEmpty} />;
}

const PlayIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
    <path d="M2 1l9 6-9 6V1z" />
  </svg>
);

const StopIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <rect x="1" y="1" width="8" height="8" rx="1" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
