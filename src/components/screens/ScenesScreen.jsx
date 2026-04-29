import { useState, useEffect } from 'react';
import styles from './ScenesScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getAllScenes } from '../../services/sceneLoader.js';
import { getAllSceneProgress } from '../../services/storage.js';
import { buildSceneLesson } from '../../services/lessonBuilder.js';
import { SCENE_CATEGORIES } from '../../utils/constants.js';

const CATEGORY_LABELS = {
  all: 'All',
  food: 'Food',
  transport: 'Transport',
  everyday: 'Everyday',
  social: 'Social',
  services: 'Services',
  festivals: 'Festivals',
};

// Pick a seasonally relevant scene for the featured mosaic
function getFeaturedScene(scenes) {
  const month = new Date().getMonth(); // 0-indexed
  // Jan/Feb → CNY, Aug/Sep → Mid-Autumn, otherwise cha-chaan-teng fallback
  if (month === 0 || month === 1) return scenes.find(s => s.id === 'chinese-new-year');
  if (month === 7 || month === 8) return scenes.find(s => s.id === 'mid-autumn');
  return scenes.find(s => s.id === 'cha-chaan-teng') ?? scenes[0];
}

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

  const featured = !search.trim() && activeCategory === 'all' ? getFeaturedScene(scenes) : null;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Browse scenes</h1>
      <p className={styles.subtitle}>香港 Cantonese</p>

      {/* Search */}
      <div className={styles.searchBar}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          placeholder="Scenes, phrases, or tones"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearBtn} onClick={() => setSearch('')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className={styles.categoryChips}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.chip} ${activeCategory === cat ? styles.chipActive : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Featured mosaic */}
      {featured && (
        <button
          className={styles.featured}
          style={{ backgroundImage: featured.imageUrl ? `url(${featured.imageUrl})` : undefined, backgroundColor: featured.tint ?? 'var(--surface-2)' }}
          onClick={() => onNavigate('scene', featured.id)}
        >
          <div className={styles.featuredOverlay} />
          <div className={styles.featuredContent}>
            <span className={styles.featuredEyebrow}>FEATURED SCENE</span>
            <p className={styles.featuredTitle}>{featured.title}</p>
            <p className={styles.featuredMeta}>
              {featured.lines?.filter(l => l.speaker === 'you').length ?? 0} phrases
              {featured.estimatedMinutes ? ` · ${featured.estimatedMinutes} min` : ''}
            </p>
          </div>
        </button>
      )}

      {/* Grid */}
      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeleton} style={{ aspectRatio: 1 }} />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredScenes.length === 0 && (
            <p className={styles.empty}>No scenes match "{search}"</p>
          )}
          {filteredScenes.map(scene => {
            const pct = masteryPct(scene.id);
            return (
              <button
                key={scene.id}
                className={styles.tile}
                onClick={() => onNavigate('scene', scene.id)}
              >
                <div
                  className={styles.cover}
                  style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
                >
                  <div
                    className={styles.coverTint}
                    style={{ background: `linear-gradient(135deg, ${scene.tint ?? '#00E5A0'}44 0%, transparent 60%)` }}
                  />
                  <div className={styles.coverDark} />
                  {scene.emoji && <span className={styles.coverEmoji}>{scene.emoji}</span>}
                  {pct > 0 && (
                    <span className={`${styles.masteryBadge} ${pct >= 80 ? styles.masteryHigh : ''}`}>
                      {pct}%
                    </span>
                  )}
                </div>
                <p className={styles.tileTitle}>{scene.title}</p>
                <p className={styles.tileMeta}>
                  {scene.lines?.filter(l => l.speaker === 'you').length ?? 0} phrases
                  {scene.estimatedMinutes ? ` · ${scene.estimatedMinutes} min` : ''}
                </p>
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
