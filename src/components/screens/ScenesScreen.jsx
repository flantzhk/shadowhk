import { useState, useEffect } from 'react';
import styles from './ScenesScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getAllScenes } from '../../services/sceneLoader.js';
import { getAllSceneProgress } from '../../services/storage.js';
import { SCENE_CATEGORIES } from '../../utils/constants.js';

const CATEGORY_LABELS = {
  all: 'ALL',
  food: 'FOOD',
  transport: 'TRANSPORT',
  everyday: 'EVERYDAY',
  social: 'SOCIAL',
  services: 'SERVICES',
  festivals: 'FESTIVALS',
};


export default function ScenesScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scenes, setScenes] = useState([]);
  const [progress, setProgress] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

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

  const categories = ['all', ...(SCENE_CATEGORIES[language] ?? [])];

  const filteredScenes = (() => {
    let list = scenes;
    if (activeCategory !== 'all') list = list.filter(s => s.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  function masteryPct(sceneId) {
    const p = progress[sceneId];
    if (!p) return 0;
    return Math.round((p.masteredCount ?? 0) / Math.max(p.totalCount ?? 1, 1) * 100);
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Browse <em className={styles.titleAccent}>scenes</em>.</h1>
        <span className={styles.subtitle}>香港 CANTONESE · {scenes.length || ''} SCENES</span>
      </div>

      {/* Sticky search + chips */}
      <div className={styles.stickyBar}>
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
        <div className={styles.categoryChips}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.chip} ${activeCategory === cat ? styles.chipActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 2-column grid */}
      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredScenes.length === 0 && (
            <p className={styles.empty}>No scenes match "{search}"</p>
          )}
          {filteredScenes.map(scene => {
            const pct = masteryPct(scene.id);
            const youLines = scene.lines?.filter(l => l.speaker === 'you').length ?? 0;
            const mins = scene.estimatedMinutes;
            return (
              <button
                key={scene.id}
                className={styles.tile}
                onClick={() => onNavigate('scene', scene.id)}
              >
                <div
                  className={styles.tilePhoto}
                  style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
                >
                  {!scene.imageUrl && <span className={styles.tileEmoji}>{scene.emoji}</span>}
                  <div className={styles.tileGrad} />
                  {/* Top-right badge */}
                  <div className={styles.tileBadge}>
                    <span className={styles.tileBadgeText}>
                      {youLines}P{mins ? ` · ${mins}M` : ''}
                    </span>
                  </div>
                  {/* Title overlay */}
                  <p className={styles.tileTitle}>{scene.title}</p>
                  {/* Progress bar */}
                  {pct > 0 && <div className={styles.tileProgress} style={{ width: `${pct}%` }} />}
                </div>
              </button>
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
