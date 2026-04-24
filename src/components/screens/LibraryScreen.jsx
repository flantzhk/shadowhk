import { useState, useEffect } from 'react';
import styles from './LibraryScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseRow } from '../ui/PhraseRow.jsx';
import { getLibraryEntries, getAllSceneProgress } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { updateAfterPractice, markAsMastered } from '../../services/srs.js';
import { GROWTH_STATE } from '../../utils/constants.js';
import { getAllScenes } from '../../services/sceneLoader.js';

const TABS = ['phrases', 'scenes', 'mastered'];

export default function LibraryScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('phrases');

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

  async function handleProveIt(phraseId, score) {
    await updateAfterPractice(phraseId, score).catch(() => {});
    await reload();
  }

  async function handleMarkMastered(phraseId) {
    await markAsMastered(phraseId).catch(() => {});
    await reload();
  }

  const savedPhrases = library.filter(p => p.growth_state !== GROWTH_STATE.MASTERED);
  const masteredPhrases = library.filter(p => p.growth_state === GROWTH_STATE.MASTERED);
  const savedScenes = scenes.filter(s => sceneProgress[s.id]?.sessionCount > 0 || sceneProgress[s.id]?.bookmarked);

  // Due today: phrases whose nextReviewAt has passed
  const dueToday = library.filter(p => p.nextReviewAt && p.nextReviewAt <= Date.now());

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your library</h1>
        <button className={styles.addBtn}>+</button>
      </div>

      {/* Tab chips */}
      <div className={styles.tabRow}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tabChip} ${activeTab === tab ? styles.tabChipActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* === Phrases tab === */}
        {activeTab === 'phrases' && (
          <>
            <div className={styles.shortcutGrid}>
              <div className={styles.shortcutSaved}>
                <span className={styles.shortcutHeart}>♥</span>
                <div>
                  <p className={styles.shortcutLabel}>Saved phrases</p>
                  <p className={styles.shortcutCount}>{library.length} items</p>
                </div>
              </div>
              <button
                className={styles.shortcutDue}
                onClick={() => onNavigate('practice')}
              >
                <span className={styles.shortcutDueIcon}>⚡</span>
                <div>
                  <p className={styles.shortcutLabel}>Due today</p>
                  <p className={styles.shortcutCount}>{dueToday.length} phrases</p>
                </div>
              </button>
            </div>

            {loading && <div className={styles.skeleton} />}

            {!loading && library.length === 0 && (
              <div className={styles.empty}>
                <p>Your library is empty.</p>
                <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
              </div>
            )}

            {!loading && library.map(phrase => (
              <div key={phrase.id} className={styles.phraseItem}>
                <div className={styles.phraseThumb}>
                  <span className={styles.thumbEmoji}>
                    {scenes.find(s => s.id === phrase.scene_id)?.emoji ?? '💬'}
                  </span>
                </div>
                <div className={styles.phraseContent}>
                  <PhraseRow
                    jyutping={phrase.romanization}
                    english={phrase.english}
                    chinese={phrase.cjk}
                    size="sm"
                  />
                </div>
                <MasteryRing pct={phrase.growth_state === GROWTH_STATE.MASTERED ? 100 : phrase.growth_state === GROWTH_STATE.STRONG ? 70 : phrase.growth_state === GROWTH_STATE.GROWING ? 40 : 10} size={28} />
              </div>
            ))}
          </>
        )}

        {/* === Scenes tab === */}
        {activeTab === 'scenes' && (
          <>
            {loading && <div className={styles.skeleton} />}
            {!loading && savedScenes.length === 0 && (
              <div className={styles.empty}>
                <p>No scenes practised yet.</p>
                <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
              </div>
            )}
            {!loading && savedScenes.map(s => {
              const p = sceneProgress[s.id];
              const pct = p?.masteryPct ?? 0;
              return (
                <button key={s.id} className={styles.sceneRow} onClick={() => onNavigate('scene', s.id)}>
                  <div
                    className={styles.sceneThumb}
                    style={{ backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined, backgroundColor: s.tint ? s.tint + '44' : 'var(--surface-2)' }}
                  />
                  <div className={styles.sceneInfo}>
                    <p className={styles.sceneTitle}>{s.title}</p>
                    <p className={styles.sceneMeta}>Scene · {s.lines?.filter(l => l.speaker === 'you').length ?? 0} phrases · {p?.sessionCount ?? 0} sessions</p>
                  </div>
                  <MasteryRing pct={pct} size={32} />
                </button>
              );
            })}
          </>
        )}

        {/* === Mastered tab === */}
        {activeTab === 'mastered' && (
          <div className={styles.masteredTab}>
            <span className={styles.masteredTrophy}>🏆</span>
            <p className={styles.masteredCount}>{masteredPhrases.length} phrases mastered</p>
            <p className={styles.masteredDesc}>
              {masteredPhrases.length > 0
                ? 'Keep practising to lock them in long-term.'
                : 'Keep going — mastered phrases will appear here.'}
            </p>
            {masteredPhrases.map(phrase => (
              <div key={phrase.id} className={styles.phraseItem} style={{ marginTop: 8 }}>
                <div className={styles.phraseThumb}>
                  <span className={styles.thumbEmoji}>
                    {scenes.find(s => s.id === phrase.scene_id)?.emoji ?? '⭐'}
                  </span>
                </div>
                <div className={styles.phraseContent}>
                  <PhraseRow
                    jyutping={phrase.romanization}
                    english={phrase.english}
                    chinese={phrase.cjk}
                    size="sm"
                  />
                </div>
                <MasteryRing pct={100} size={28} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MasteryRing({ pct, size = 28 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} stroke="var(--surface-2)" strokeWidth="2.5" fill="none"/>
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke={pct >= 80 ? 'var(--accent)' : 'var(--fg-2)'}
        strokeWidth="2.5" fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </svg>
  );
}
