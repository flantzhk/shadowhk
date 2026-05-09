import { useState, useEffect } from 'react';
import styles from './ScenesScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getAllScenes } from '../../services/sceneLoader.js';
import { getAllSceneProgress } from '../../services/storage.js';
import { SCENE_CATEGORIES } from '../../utils/constants.js';

const CATEGORY_LABELS = {
  food:      'Food & Drink',
  transport: 'Getting Around',
  everyday:  'Everyday Life',
  social:    'Social',
  services:  'Services',
  festivals: 'Festivals',
};

export default function ScenesScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scenes, setScenes] = useState([]);
  const [progress, setProgress] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllScenes(language), getAllSceneProgress()])
      .then(([loadedScenes, progressRecords]) => {
        setScenes(loadedScenes);
        const map = {};
        for (const p of progressRecords) map[p.sceneId] = p;
        setProgress(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [language]);

  const categories = SCENE_CATEGORIES[language] ?? [];

  function masteryPct(sceneId) {
    const p = progress[sceneId];
    if (!p) return 0;
    return Math.round((p.masteredCount ?? 0) / Math.max(p.totalCount ?? 1, 1) * 100);
  }

  const isSearching = search.trim().length > 0;

  const searchResults = isSearching
    ? scenes.filter(s => {
        const q = search.toLowerCase();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
        );
      })
    : [];

  function SceneCard({ scene, size = 'row' }) {
    const pct = masteryPct(scene.id);
    const youLines = scene.lines?.filter(l => l.speaker === 'you').length ?? 0;
    const mins = scene.estimatedMinutes;
    return (
      <button
        className={size === 'grid' ? styles.tile : styles.hCard}
        onClick={() => onNavigate('scene', scene.id)}
      >
        <div
          className={size === 'grid' ? styles.tilePhoto : styles.hPhoto}
          style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
        >
          {!scene.imageUrl && (
            <span className={size === 'grid' ? styles.tileEmoji : styles.hEmoji}>
              {scene.emoji}
            </span>
          )}
          <div className={size === 'grid' ? styles.tileGrad : styles.hGrad} />
          <p className={size === 'grid' ? styles.tileTitle : styles.hTitle}>
            {scene.title}
          </p>
          {pct > 0 && (
            <div
              className={size === 'grid' ? styles.tileProgress : styles.hProgress}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </button>
    );
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          Browse <em className={styles.titleAccent}>scenes</em>.
        </h1>
        <span className={styles.subtitle}>
          香港 {language === 'cantonese' ? 'CANTONESE' : 'MANDARIN'} · {scenes.length || ''} SCENES
        </span>
      </div>

      {/* Search bar */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBar}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            placeholder="SEARCH SCENES"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')}>×</button>
          )}
        </div>
      </div>

      {/* Search results — flat grid */}
      {isSearching && (
        <div className={styles.grid}>
          {searchResults.length === 0 && (
            <p className={styles.empty}>No scenes match "{search}"</p>
          )}
          {searchResults.map(scene => (
            <SceneCard key={scene.id} scene={scene} size="grid" />
          ))}
        </div>
      )}

      {/* Default — category rows */}
      {!isSearching && (
        <div className={styles.rows}>
          {/* In-progress row (scenes with any mastery) */}
          {(() => {
            const inProgress = scenes.filter(s => masteryPct(s.id) > 0);
            if (!inProgress.length) return null;
            return (
              <section className={styles.catSection}>
                <div className={styles.catBar}>
                  <span className={styles.catNum}>✦</span>
                  <span className={styles.catLabel}>Continue</span>
                </div>
                <div className={styles.catScroll}>
                  {inProgress.map(scene => (
                    <SceneCard key={scene.id} scene={scene} size="row" />
                  ))}
                </div>
              </section>
            );
          })()}

          {/* One row per category */}
          {categories.map((cat, idx) => {
            const catScenes = scenes.filter(s => s.category === cat);
            return (
              <section key={cat} className={styles.catSection}>
                <div className={styles.catBar}>
                  <span className={styles.catNum}>{String(idx + 1).padStart(2, '0')}</span>
                  <span className={styles.catLabel}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                </div>
                <div className={styles.catScroll}>
                  {loading
                    ? [1, 2, 3].map(i => <div key={i} className={styles.hSkeleton} />)
                    : catScenes.map(scene => (
                        <SceneCard key={scene.id} scene={scene} size="row" />
                      ))
                  }
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className={styles.bottomPad} />
    </div>
  );
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
