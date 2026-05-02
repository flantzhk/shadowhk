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

export default function LibraryScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});
  const [loading, setLoading] = useState(true);

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

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>
        SAVED · {totalPhrases} {totalPhrases === 1 ? 'PHRASE' : 'PHRASES'} · {totalScenes} {totalScenes === 1 ? 'SCENE' : 'SCENES'}
      </p>
      <h1 className={styles.title}>Your <span className={styles.titleItalic}>phrasebook</span>.</h1>

      <div className={styles.divider} />

      {/* Reference sets */}
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

      {/* Scene groups */}
      {loading && <div className={styles.skeleton} />}

      {!loading && totalPhrases === 0 && (
        <div className={styles.empty}>
          <p>Your library is empty.</p>
          <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
        </div>
      )}

      {!loading && groupedScenes.map(({ scene, sceneId, phrases }) => (
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
              <p className={styles.sceneMeta}>{phrases.length} {phrases.length === 1 ? 'PHRASE' : 'PHRASES'}</p>
            </div>
          </button>

          {phrases.map(phrase => (
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
                {phrase.growth_state === GROWTH_STATE.MASTERED && (
                  <span className={styles.masteredPill}>✓ MASTERED</span>
                )}
              </div>
              <div className={styles.phraseActions}>
                <button
                  className={styles.iconBtn}
                  onClick={e => { e.stopPropagation(); onNavigate('phrase', phrase.id); }}
                  aria-label="Play"
                >
                  <PlayIcon />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={e => { e.stopPropagation(); }}
                  aria-label="Bookmark"
                >
                  <BookmarkIcon />
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const BookmarkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
