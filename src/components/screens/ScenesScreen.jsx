import { useState, useEffect, useContext } from 'react';
import styles from './ScenesScreen.module.css';
import { AppContext } from '../../contexts/AppContext.jsx';
import { SceneCard } from '../ui/SceneCard.jsx';
import { getAllScenes, getScenesByCategory } from '../../services/sceneLoader.js';
import { getAllSceneProgress } from '../../services/storage.js';
import { SCENE_CATEGORIES } from '../../utils/constants.js';

const CATEGORY_LABELS = {
  food: 'Food',
  transport: 'Transport',
  social: 'Social',
  services: 'Services',
  festivals: 'Festivals',
};

export default function ScenesScreen({ onNavigate }) {
  const { settings } = useContext(AppContext);
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

  const filteredScenes = search.trim()
    ? scenes.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase()) ||
        s.category?.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  function sceneStatus(scene) {
    const p = progress[scene.id];
    if (!p) return 'fresh';
    if (p.livedAt) return 'lived';
    if (p.sessionCount > 0) return 'practiced';
    return 'fresh';
  }

  return (
    <div className={styles.screen}>
      <div className={styles.searchBar}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          placeholder="Search scenes"
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

      <div className={styles.content}>
        {loading && <div className={styles.skeleton} />}

        {!loading && filteredScenes !== null && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Results</h2>
            {filteredScenes.length === 0 ? (
              <p className={styles.empty}>No scenes match "{search}"</p>
            ) : (
              <div className={styles.grid}>
                {filteredScenes.map(s => (
                  <SceneCard
                    key={s.id}
                    emoji={s.emoji}
                    title={s.title}
                    phraseCount={s.lines?.filter(l => l.speaker === 'you').length ?? 0}
                    duration={s.estimatedMinutes ?? 5}
                    status={sceneStatus(s)}
                    onClick={() => onNavigate('scene', s.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && filteredScenes === null && categories.map(cat => {
          const catScenes = scenes.filter(s => s.category === cat);
          if (catScenes.length === 0) return null;
          return (
            <section key={cat} className={styles.section}>
              <h2 className={styles.sectionTitle}>{CATEGORY_LABELS[cat] ?? cat}</h2>
              <div className={styles.scrollRow}>
                {catScenes.map(s => (
                  <SceneCard
                    key={s.id}
                    emoji={s.emoji}
                    title={s.title}
                    phraseCount={s.lines?.filter(l => l.speaker === 'you').length ?? 0}
                    duration={s.estimatedMinutes ?? 5}
                    status={sceneStatus(s)}
                    onClick={() => onNavigate('scene', s.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
