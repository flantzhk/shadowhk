import { useState, useEffect } from 'react';
import styles from './LibraryScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntries, getAllSceneProgress } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { GROWTH_STATE } from '../../utils/constants.js';
import { getAllScenes } from '../../services/sceneLoader.js';

const REFERENCE_SETS = [
  { id: 'numbers', count: 100, title: 'Numbers 1–100' },
  { id: 'colours', count: 12,  title: 'Colours' },
  { id: 'drinks',  count: 18,  title: 'Drinks & Coffee' },
  { id: 'days',    count: 24,  title: 'Days & Times' },
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
  const [sceneProgress, setSceneProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => { reload(); }, [language]);

  async function reload() {
    setLoading(true);
    try {
      const [entries, loadedScenes, progressRecords] = await Promise.all([
        getLibraryEntries(language),
        getAllScenes(language),
        getAllSceneProgress(),
      ]);
      const enriched = entries.map(e => ({
        ...e,
        growth_state: growthStateFromInterval(e.interval ?? 0, e.reps ?? 0),
      }));
      setLibrary(enriched);
      setScenes(loadedScenes);
      const map = {};
      for (const p of progressRecords) map[p.sceneId] = p;
      setSceneProgress(map);
    } catch (_) {}
    finally { setLoading(false); }
  }

  // Group phrases by scene_id
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
    .sort((a, b) => (b.phrases.length - a.phrases.length));

  const totalPhrases = library.length;
  const totalScenes = groupedScenes.filter(g => g.scene).length;
  const saidInPersonCount = library.filter(p => p.lived_at).length;

  // Apply filter to each group's phrases
  function filterPhrases(phrases) {
    if (activeFilter === 'all') return phrases;
    if (activeFilter === 'said') return phrases.filter(p => p.lived_at);
    if (activeFilter === 'needs-work') return phrases.filter(p => p.growth_state !== GROWTH_STATE.MASTERED && !p.lived_at);
    if (activeFilter === 'mastered') return phrases.filter(p => p.growth_state === GROWTH_STATE.MASTERED);
    return phrases;
  }

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>
        SAVED · {totalPhrases} {totalPhrases === 1 ? 'PHRASE' : 'PHRASES'} · {totalScenes} {totalScenes === 1 ? 'SCENE' : 'SCENES'}
        {saidInPersonCount > 0 && <span className={styles.saidCount}> · {saidInPersonCount} SAID IN PERSON 📍</span>}
      </p>
      <h1 className={styles.title}>Your <span className={styles.titleItalic}>phrasebook</span>.</h1>

      {/* Filter chips */}
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

      <div className={styles.divider} />

      {/* Reference sets — hide when a filter is active */}
      {activeFilter === 'all' && (
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
                <span className={styles.refCount}>{s.count} ITEMS</span>
                <span className={styles.refTitle}>{s.title}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Scene groups */}
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
            className={styles.sceneHeader}
            onClick={() => scene && onNavigate('scene', scene.id)}
          >
            <div
              className={styles.sceneThumb}
              style={{
                backgroundImage: scene?.imageUrl ? `url(${scene.imageUrl})` : undefined,
                backgroundColor: scene?.tint ? scene.tint + '88' : '#3a2a26',
              }}
            />
            <div className={styles.sceneText}>
              <p className={styles.sceneName}>{scene?.title ?? 'Other phrases'}</p>
              <div className={styles.sceneMetaRow}>
                <p className={styles.sceneMeta}>{phrases.length} {phrases.length === 1 ? 'PHRASE' : 'PHRASES'}</p>
                {saidCount > 0 && <span className={styles.saidPill}>{saidCount} SAID IN PERSON 📍</span>}
              </div>
            </div>
          </button>

          {filtered.map(phrase => (
            <div
              key={phrase.id}
              className={styles.phraseRow}
              onClick={() => onNavigate('phrase', phrase.id)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.phraseText}>
                <p className={styles.phraseRoman}>{phrase.romanization}</p>
                <p className={styles.phraseCjk}>{phrase.cjk}</p>
                <p className={styles.phraseEnglish}>{phrase.english}</p>
                <div className={styles.phraseTags}>
                  {phrase.lived_at && <span className={styles.saidTag}>📍 Said in person</span>}
                  {phrase.growth_state === GROWTH_STATE.MASTERED && (
                    <span className={styles.masteredPill}>✓ MASTERED</span>
                  )}
                </div>
              </div>
              <div className={styles.phraseActions}>
                <span className={styles.savedMark} aria-hidden="true"><BookmarkIcon /></span>
                <button
                  className={styles.playBtn}
                  onClick={e => { e.stopPropagation(); onNavigate('phrase', phrase.id); }}
                  aria-label="Play"
                >
                  <PlayIcon />
                </button>
              </div>
            </div>
          ))}
        </section>
        );
      })}
    </div>
  );
}

const PlayIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
    <path d="M2 1l9 6-9 6V1z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 2v16l5-3 5 3V2H5z" />
  </svg>
);

