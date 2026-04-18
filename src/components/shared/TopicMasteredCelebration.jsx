// src/components/shared/TopicMasteredCelebration.jsx — All phrases in a topic mastered

import { useEffect } from 'react';
import styles from './TopicMasteredCelebration.module.css';

/**
 * @param {{ topicName: string, phraseCount: number, onNextTopic?: Function, onAIPractice?: Function, onDone: Function }} props
 */
export function TopicMasteredCelebration({ topicName, phraseCount, onNextTopic, onAIPractice, onDone }) {
  useEffect(() => {
    // Auto-dismiss after 30 seconds if user doesn't act
    const t = setTimeout(onDone, 30000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Star with radial glow */}
        <div className={styles.starWrap}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#E8B865" stroke="var(--color-brand-dark)" strokeWidth="1.5" className={styles.starSvg}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>

        <h1 className={styles.title}>Topic mastered!</h1>
        <p className={styles.topicName}>"{topicName}"</p>
        <p className={styles.body}>
          You've mastered all {phraseCount} phrase{phraseCount !== 1 ? 's' : ''} in this topic. That's how fluency is built.
        </p>

        <div className={styles.callout}>
          <span className={styles.calloutText}>⭐ "{topicName}" now shows a gold star in your Library</span>
        </div>

        <p className={styles.challengeLabel}>Want a challenge?</p>

        <div className={styles.actions}>
          {onNextTopic && (
            <button className={styles.nextTopicBtn} onClick={onNextTopic}>
              Next topic
            </button>
          )}
          {onAIPractice && (
            <button className={styles.aiBtn} onClick={onAIPractice}>
              AI conversation practice
            </button>
          )}
          <button className={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
