import styles from './Bubble.module.css';

export function Bubble({ speaker, cjk, romanization, english, saved, onSave }) {
  const isYou = speaker === 'you';
  return (
    <div className={`${styles.bubble} ${isYou ? styles.bubbleRight : styles.bubbleLeft}`}>
      <span className={styles.speaker}>{isYou ? 'You' : speaker}</span>
      <div className={`${styles.body} ${isYou ? styles.bodyRight : styles.bodyLeft}`}>
        <span className={styles.cjk}>{cjk}</span>
        {romanization && <span className={styles.romanization}>{romanization}</span>}
        <span className={styles.english}>{english}</span>
      </div>
      {onSave && (
        <button className={styles.saveBtn} onClick={onSave} aria-label={saved ? 'Saved' : 'Save phrase'}>
          {saved ? '✓' : '+'}
        </button>
      )}
    </div>
  );
}
