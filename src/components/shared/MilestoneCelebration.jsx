// src/components/shared/MilestoneCelebration.jsx — Items 28, 41 (milestone + topic mastered)

import { useEffect } from 'react';
import styles from './MilestoneCelebration.module.css';

/**
 * Full-screen celebration overlay (milestone unlocked, topic mastered)
 * @param {{ title: string, subtitle: string, body: string, onDone: Function, emoji?: string }} props
 */
export function MilestoneCelebration({ title, subtitle, body, onDone, emoji = '🏆' }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.emojiWrap}>{emoji}</div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
        {body && <p className={styles.body}>{body}</p>}
        <button className={styles.doneBtn} onClick={onDone}>Continue</button>
      </div>
    </div>
  );
}

/**
 * Streak at risk warning banner/overlay
 */
export function StreakAtRisk({ streakCount, onDismiss, onPractice }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.flameWrap}>
          <span className={styles.flameBig}>🔥</span>
        </div>
        <h2 className={styles.title}>Streak at risk!</h2>
        <p className={styles.subtitle}>Practice today to keep your {streakCount}-day streak alive.</p>
        <button className={styles.practiceBtn} onClick={onPractice}>Practice now</button>
        <button className={styles.dismissLink} onClick={onDismiss}>Remind me later</button>
      </div>
    </div>
  );
}

/**
 * Level Up toast overlay (Prompt Mode)
 */
export function LevelUpToast({ newLevel, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.levelToast} onClick={onDone}>
      <div className={styles.levelBadge}>⬆</div>
      <div>
        <p className={styles.levelTitle}>Level up!</p>
        <p className={styles.levelSub}>You reached Level {newLevel}</p>
      </div>
    </div>
  );
}
