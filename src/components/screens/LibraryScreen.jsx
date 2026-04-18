import { useState, useEffect, useContext } from 'react';
import styles from './LibraryScreen.module.css';
import { AppContext } from '../../contexts/AppContext.jsx';
import { PhraseTile } from '../ui/PhraseTile.jsx';
import { GrowthBadge } from '../ui/GrowthBadge.jsx';
import { getLibraryEntries } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { GROWTH_STATE } from '../../utils/constants.js';

const VIEWS = [
  { id: 'growth', label: 'By growth' },
  { id: 'badges', label: 'Badges' },
  { id: 'source', label: 'Where it came from' },
  { id: 'scene', label: 'By scene' },
];

const GROWTH_ORDER = [GROWTH_STATE.MASTERED, GROWTH_STATE.STRONG, GROWTH_STATE.GROWING, GROWTH_STATE.NEW];

const GROWTH_LABELS = {
  [GROWTH_STATE.MASTERED]: 'Mastered',
  [GROWTH_STATE.STRONG]: 'Strong',
  [GROWTH_STATE.GROWING]: 'Growing',
  [GROWTH_STATE.NEW]: 'New',
};

const SOURCE_LABELS = {
  library: 'From scenes',
  heard_it: 'Heard it',
  from_school: 'From school',
  from_show: 'From a show',
  mine: 'Mine',
};

export default function LibraryScreen({ onNavigate }) {
  const { settings } = useContext(AppContext);
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('growth');

  useEffect(() => {
    reload();
  }, [language]);

  async function reload() {
    setLoading(true);
    try {
      const entries = await getLibraryEntries(language);
      const enriched = entries.map(e => ({
        ...e,
        growth_state: growthStateFromInterval(e.interval ?? 0, e.reps ?? 0),
      }));
      setLibrary(enriched);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  async function handleProveIt(phraseId, score) {
    await updateAfterPractice(phraseId, score).catch(() => {});
    await reload();
  }

  async function handleMarkMastered(phraseId) {
    await markAsMastered(phraseId).catch(() => {});
    await reload();
  }

  const total = library.length;
  const livedPhrases = library.filter(p => p.lived_at);

  function grouped() {
    switch (activeView) {
      case 'growth': {
        return GROWTH_ORDER.map(state => ({
          key: state,
          label: GROWTH_LABELS[state],
          items: library.filter(p => p.growth_state === state),
        })).filter(g => g.items.length > 0);
      }
      case 'badges': {
        return [{
          key: 'lived',
          label: '📍 Lived in HK',
          items: livedPhrases,
        }].filter(g => g.items.length > 0);
      }
      case 'source': {
        const sources = [...new Set(library.map(p => p.source_tag))];
        return sources.map(src => ({
          key: src,
          label: SOURCE_LABELS[src] ?? src,
          items: library.filter(p => p.source_tag === src),
        })).filter(g => g.items.length > 0);
      }
      case 'scene': {
        const sceneIds = [...new Set(library.map(p => p.scene_id).filter(Boolean))];
        const noScene = library.filter(p => !p.scene_id);
        const groups = sceneIds.map(id => ({
          key: id,
          label: id,
          items: library.filter(p => p.scene_id === id),
        }));
        if (noScene.length > 0) groups.push({ key: 'none', label: 'No scene', items: noScene });
        return groups;
      }
      default: return [];
    }
  }

  const groups = grouped();

  return (
    <div className={styles.screen}>
      <div className={styles.banner}>
        <span className={styles.bannerCount}>你識 {total} 句</span>
      </div>

      <div className={styles.viewTabs}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={`${styles.viewTab} ${activeView === v.id ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {loading && <div className={styles.skeleton} />}

        {!loading && !library.some(p => p.scene_id === 'personal-introduce-yourself') && (
          <button
            className={styles.introduceNudge}
            onClick={() => onNavigate('introduce-yourself')}
          >
            <span className={styles.nudgeEmoji}>👋</span>
            <div className={styles.nudgeContent}>
              <p className={styles.nudgeTitle}>Build your intro scene</p>
              <p className={styles.nudgeDesc}>Personal phrases from your real life.</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {!loading && total === 0 && (
          <div className={styles.empty}>
            <p>Your library is empty.</p>
            <p className={styles.emptyHint}>Pick some scenes to start.</p>
            <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>
              Browse scenes
            </button>
          </div>
        )}

        {!loading && groups.map(group => (
          <section key={group.key} className={styles.group}>
            <div className={styles.groupHeader}>
              <h2 className={styles.groupTitle}>{group.label}</h2>
              <span className={styles.groupCount}>{group.items.length}</span>
            </div>
            <div className={styles.phraseList}>
              {group.items.map(phrase => (
                <PhraseTile
                  key={phrase.id}
                  phrase={phrase}
                  growthState={phrase.growth_state}
                  livedAt={phrase.lived_at}
                  sourceTag={phrase.source_tag}
                  onProveIt={score => handleProveIt(phrase.id, score)}
                  onMarkMastered={() => handleMarkMastered(phrase.id)}
                  onTap={() => onNavigate('phrase', phrase.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
