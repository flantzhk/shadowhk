import { useState, useEffect } from 'react';
import styles from './SceneDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { Bubble } from '../ui/Bubble.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import { getLibraryEntry, saveLibraryEntry, removeLibraryEntry } from '../../services/storage.js';
import { SOURCE_TAGS, GROWTH_STATE } from '../../utils/constants.js';

export default function SceneDetailScreen({ sceneId, onNavigate, onBack }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());

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
  }, [sceneId]);

  async function toggleSave(line) {
    if (savedIds.has(line.id)) {
      await removeLibraryEntry(line.id).catch(() => {});
      setSavedIds(prev => { const next = new Set(prev); next.delete(line.id); return next; });
    } else {
      await saveLibraryEntry({
        id: line.id,
        cjk: line.cjk,
        romanization: line.romanization,
        english: line.english,
        language,
        scene_id: sceneId,
        source_tag: SOURCE_TAGS.LIBRARY,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString().slice(0, 10),
        lastPracticed: null,
        lived_at: null,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      }).catch(() => {});
      setSavedIds(prev => new Set(prev).add(line.id));
    }
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.loadingBar} />
      </div>
    );
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

  return (
    <div className={styles.screen}>
      {/* Hero */}
      <div className={styles.hero}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.heroEmoji}>{scene.emoji}</span>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>{scene.title}</h1>
          {scene.description && <p className={styles.heroDesc}>{scene.description}</p>}
        </div>
      </div>

      {/* Context note */}
      {scene.context && (
        <div className={styles.contextBlock}>
          <p className={styles.contextText}>{scene.context}</p>
        </div>
      )}

      {/* Dialogue bubbles */}
      <div className={styles.dialogue}>
        {(scene.lines ?? []).map((line) => (
          <Bubble
            key={line.id}
            speaker={line.speaker}
            cjk={line.cjk}
            romanization={line.romanization}
            english={line.english}
            saved={savedIds.has(line.id)}
            onSave={() => toggleSave(line)}
          />
        ))}
      </div>

      {/* Sticky CTAs */}
      <div className={styles.ctaBar}>
        <button
          className={styles.ctaSecondary}
          onClick={() => onNavigate('listen', sceneId)}
        >
          Listen
        </button>
        <button
          className={styles.ctaPrimary}
          onClick={() => onNavigate('shadow', sceneId)}
        >
          Shadow this
        </button>
      </div>
    </div>
  );
}
