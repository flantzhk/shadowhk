import { useState, useEffect } from 'react';
import styles from './ScenesScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getAllScenes } from '../../services/sceneLoader.js';
import { getAllSceneProgress } from '../../services/storage.js';
import { SCENE_CATEGORIES, GATES, isSceneLocked } from '../../utils/constants.js';
import { isAuthenticated } from '../../services/auth.js';
import { useSubscription } from '../../hooks/useSubscription.js';

// Same composite bypass App.jsx uses for `authed` — while GATES.authWallEnabled
// is off, nothing shows as locked here either.
const authed = () => isAuthenticated() || import.meta.env.DEV || !GATES.authWallEnabled;

const CATEGORY_LABELS = {
  basics:    'First Words',
  food:      'Food & Drink',
  transport: 'Getting Around',
  social:    'Social Life',
  services:  'Shopping & Errands',
  festivals: 'Festivals',
};

export default function ScenesScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const { isPro } = useSubscription();

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
    const locked = isSceneLocked(scene.id, { authed: authed(), isPro });
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
          {locked && (
            <div className={size === 'grid' ? styles.tileBadge : styles.hBadge}>
              <span className={size === 'grid' ? styles.tileBadgeText : styles.hBadgeText}>🔒</span>
            </div>
          )}
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
        {scene.description && (
          <p className={size === 'grid' ? styles.tileSub : styles.hSub}>{scene.description}</p>
        )}
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
          {language === 'cantonese' ? '香港 CANTONESE' : 'MAINLAND CHINA MANDARIN'} · {scenes.length || ''} SCENES
        </span>
        <p className={styles.lede}>
          Each scene drops you into a real {language === 'cantonese' ? 'Hong Kong' : 'Mainland China'} moment: the back-and-forth
          you'd actually hear, the vocabulary locals reach for, and a fact
          worth knowing before you go.
        </p>
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
                  <h2 className={styles.catTitle}>Continue</h2>
                  <span className={styles.catCount}>
                    {inProgress.length} {inProgress.length === 1 ? 'SCENE' : 'SCENES'}
                  </span>
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
          {categories.map(cat => {
            const catScenes = scenes.filter(s => s.category === cat);
            if (!loading && catScenes.length === 0) return null;
            return (
              <section key={cat} className={styles.catSection}>
                <div className={styles.catBar}>
                  <h2 className={styles.catTitle}>{CATEGORY_LABELS[cat] ?? cat}</h2>
                  {!loading && (
                    <span className={styles.catCount}>
                      {catScenes.length} {catScenes.length === 1 ? 'SCENE' : 'SCENES'}
                    </span>
                  )}
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
