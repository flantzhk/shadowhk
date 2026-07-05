// src/components/screens/DialogueSceneLoader.jsx — loads a scene and adapts
// it into the turn-based shape DialogueScene expects, then renders it.

import { useState, useEffect } from 'react';
import { getSceneById, toDialogueTurns } from '../../services/sceneLoader.js';
import { logger } from '../../utils/logger.js';
import DialogueScene from './DialogueScene.jsx';
import styles from './DialogueScene.module.css';

export default function DialogueSceneLoader({ sceneId, onBack, onComplete }) {
  const [sceneData, setSceneData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sceneId) { setLoading(false); return; }
    getSceneById(sceneId)
      .then((scene) => setSceneData(toDialogueTurns(scene)))
      .catch((err) => logger.error('[DialogueSceneLoader] scene load failed', err?.message))
      .finally(() => setLoading(false));
  }, [sceneId]);

  if (loading) return <div className={styles.screen}><div className={styles.loadingPulse} /></div>;

  if (!sceneData || sceneData.turns.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.introContent}>
          <p className={styles.introDesc}>Scene not found or has no dialogue to practice.</p>
          <button className={styles.cancelBtn} onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  return <DialogueScene sceneData={sceneData} onBack={onBack} onComplete={onComplete} />;
}
