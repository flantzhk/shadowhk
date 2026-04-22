import styles from './Bubble.module.css';

export function Bubble({ speaker, cjk, romanization, english, saved, onSave }) {
  const isYou = speaker === 'you';
  return (
    <div className={`${styles.bubble} ${isYou ? styles.bubbleRight : styles.bubbleLeft}`}>
      <span className={styles.speaker}>{isYou ? 'You' : speaker}</span>
      <div className={`${styles.body} ${isYou ? styles.bodyRight : styles.bodyLeft}`}>
        {romanization && <span className={styles.romanization}>{romanization}</span>}
        <span className={styles.english}>{english}</span>
        {cjk && <span className={styles.cjk}>{cjk}</span>}
        {onSave && (
          <button
            className={`${styles.saveChip} ${saved ? styles.saveChipSaved : ''}`}
            onClick={onSave}
            aria-label={saved ? 'Saved to library' : 'Save to library'}
          >
            {saved ? '✓ Saved' : '＋ Save'}
          </button>
        )}
      </div>
    </div>
  );
}
