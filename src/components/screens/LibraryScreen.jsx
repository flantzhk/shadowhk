import { useState, useEffect } from 'react';
import styles from './LibraryScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseTile } from '../ui/PhraseTile.jsx';
import { GrowthBadge } from '../ui/GrowthBadge.jsx';
import { getLibraryEntries } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { GROWTH_STATE } from '../../utils/constants.js';

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
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

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
  const masteredCount = library.filter(p => p.growth_state === GROWTH_STATE.MASTERED).length;
  const strongCount   = library.filter(p => p.growth_state === GROWTH_STATE.STRONG).length;
  const growingCount  = library.filter(p => p.growth_state === GROWTH_STATE.GROWING).length;
  const livedCount    = library.filter(p => p.lived_at).length;

  const FILTER_CHIPS = [
    { id: 'all',      label: `all · ${total}` },
    { id: 'mastered', label: `⭐ mastered · ${masteredCount}` },
    { id: 'strong',   label: `strong · ${strongCount}` },
    { id: 'growing',  label: `growing · ${growingCount}` },
    { id: 'lived',    label: `📍 lived · ${livedCount}` },
  ];

  function grouped() {
    if (activeFilter === 'all') {
      return GROWTH_ORDER.map(state => ({
        key: state,
        label: GROWTH_LABELS[state],
        items: library.filter(p => p.growth_state === state),
      })).filter(g => g.items.length > 0);
    }
    if (activeFilter === 'lived') {
      return [{ key: 'lived', label: '📍 Lived in HK', items: library.filter(p => p.lived_at) }].filter(g => g.items.length > 0);
    }
    const stateMap = {
      mastered: GROWTH_STATE.MASTERED,
      strong: GROWTH_STATE.STRONG,
      growing: GROWTH_STATE.GROWING,
    };
    const state = stateMap[activeFilter];
    if (!state) return [];
    return [{
      key: activeFilter,
      label: GROWTH_LABELS[state],
      items: library.filter(p => p.growth_state === state),
    }].filter(g => g.items.length > 0);
  }

  const groups = grouped();

  return (
    <div className={styles.screen}>
      <div className={styles.banner}>
        <span className={styles.bannerCount}>你識 {total} 句</span>
      </div>

      <div className={styles.jumpChipsRow}>
        <span className={styles.jumpLabel}>JUMP TO</span>
        <div className={styles.jumpChips}>
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.id}
              className={`${styles.jumpChip} ${activeFilter === chip.id ? styles.jumpChipActive : ''}`}
              onClick={() => setActiveFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
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
                  onProveIt={() => handleProveIt(phrase.phraseId ?? phrase.id, null)}
                  onIKnow={() => handleMarkMastered(phrase.phraseId ?? phrase.id)}
                  onNavigate={() => onNavigate('phrase', phrase.phraseId ?? phrase.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
