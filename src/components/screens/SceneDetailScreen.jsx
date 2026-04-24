import { useState, useEffect, useRef } from 'react';
import styles from './SceneDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseRow } from '../ui/PhraseRow.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import { getLibraryEntry, saveLibraryEntry, removeLibraryEntry, getAllSceneProgress } from '../../services/storage.js';
import { SOURCE_TAGS, GROWTH_STATE } from '../../utils/constants.js';

export default function SceneDetailScreen({ sceneId, onNavigate, onBack }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [sceneSaved, setSceneSaved] = useState(false);
  const [masteryPct, setMasteryPct] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    if (!sceneId) return;
    getSceneById(sceneId)
      .then(async s => {
        setScene(s);
        const ids = new Set();
        for (const line of s.lines ?? []) {
          const entry = await getLibraryEntry(line.id).catch(() => null);
          if (entry) ids.add(line.id);
        }
        setSavedIds(ids);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    getAllSceneProgress().then(records => {
      const p = records.find(r => r.sceneId === sceneId);
      if (p) setMasteryPct(p.masteryPct ?? 0);
    }).catch(() => {});
  }, [sceneId]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [scene]);

  async function toggleSaveLine(line) {
    if (savedIds.has(line.id)) {
      await removeLibraryEntry(line.id).catch(() => {});
      setSavedIds(prev => { const next = new Set(prev); next.delete(line.id); return next; });
    } else {
      await saveLibraryEntry({
        phraseId: line.id,
        cjk: line.cjk,
        romanization: line.romanization,
        english: line.english,
        language,
        scene_id: sceneId,
        source_tag: SOURCE_TAGS.LIBRARY,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        practiceCount: 0,
        nextReviewAt: Date.now(),
        lastPracticedAt: null,
        lived_at: null,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      }).catch(() => {});
      setSavedIds(prev => new Set(prev).add(line.id));
    }
  }

  if (loading) {
    return <div className={styles.screen}><div className={styles.loadingBar} /></div>;
  }

  if (!scene) {
    return (
      <div className={styles.screen}>
        <div className={styles.error}>
          <p>Scene not found.</p>
          <button onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  const youLineCount = scene.lines?.filter(l => l.speaker === 'you').length ?? 0;

  return (
    <div className={styles.screen}>
      {/* Sticky header (fades in on scroll) */}
      <div className={`${styles.stickyHeader} ${headerVisible ? styles.stickyHeaderVisible : ''}`}>
        <button className={styles.backPill} onClick={onBack}>
          <BackArrow /> Back
        </button>
        <span className={styles.stickyTitle}>{scene.title}</span>
        <button className={styles.moreBtn}>⋯</button>
      </div>

      {/* Hero */}
      <div
        ref={heroRef}
        className={styles.hero}
        style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
      >
        <div
          className={styles.heroTint}
          style={{ background: `linear-gradient(160deg, ${scene.tint ?? '#C5E85A'}44 0%, transparent 50%)` }}
        />
        <div className={styles.heroDark} />
        <div className={styles.heroContent}>
          <button className={styles.backBtnHero} onClick={onBack}><BackArrow /> Back</button>
          <div className={styles.heroMeta}>
            <span className={styles.heroEyebrow}>{(scene.category ?? 'scene').toUpperCase()} SCENE</span>
            <h1 className={styles.heroTitle}>{scene.title}</h1>
            <p className={styles.heroDesc}>{youLineCount} phrases · {scene.estimatedMinutes ?? 5} min</p>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <button
            className={`${styles.heartBtn} ${sceneSaved ? styles.heartSaved : ''}`}
            onClick={() => setSceneSaved(v => !v)}
            aria-label="Save scene"
          >
            {sceneSaved ? '♥' : '♡'}
          </button>
          <button className={styles.controlBtn}>+</button>
          <button className={styles.controlBtn}>⋯</button>
        </div>
        <button
          className={styles.playBtn}
          onClick={() => onNavigate('shadow', sceneId)}
          aria-label="Start shadowing"
        >
          <PlayIcon />
        </button>
      </div>

      {/* Mastery bar */}
      {masteryPct > 0 && (
        <div className={styles.masterySection}>
          <div className={styles.masteryBar}>
            <div
              className={styles.masteryFill}
              style={{ width: `${masteryPct}%`, background: `linear-gradient(90deg, ${scene.tint ?? '#8BB82B'}, var(--accent))` }}
            />
          </div>
          <span className={styles.masteryLabel}>{Math.round(masteryPct)}% mastered</span>
        </div>
      )}

      {/* Phrase list */}
      <div className={styles.phraseList}>
        {(scene.lines ?? []).map((line, i) => (
          <div
            key={line.id}
            className={styles.phraseRow}
          >
            <span className={styles.lineNum}>{i + 1}</span>
            <div className={styles.phraseContent}>
              <PhraseRow
                jyutping={line.romanization}
                english={line.english}
                chinese={line.cjk}
                role={line.speaker === 'you' ? 'You' : line.speaker}
                size="md"
                saved={savedIds.has(line.id)}
                onHeartToggle={line.speaker === 'you' ? () => toggleSaveLine(line) : undefined}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sticky CTA bar */}
      <div className={styles.ctaBar}>
        <button className={styles.ctaSecondary} onClick={() => onNavigate('listen', sceneId)}>
          🔊 Listen
        </button>
        <button className={styles.ctaPrimary} onClick={() => onNavigate('shadow', sceneId)}>
          ▶ Shadow this
        </button>
      </div>
    </div>
  );
}

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6 3 20 12 6 21 6 3"/>
  </svg>
);
