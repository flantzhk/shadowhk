import { useState } from 'react';
import styles from './PhraseTile.module.css';
import { GrowthBadge } from './GrowthBadge';
import { SourceTag } from './SourceTag';

const BAR_CLASS = {
  new: styles.barNew,
  growing: styles.barGrowing,
  strong: styles.barStrong,
  mastered: styles.barMastered,
};

export function PhraseTile({
  phrase,         // { id, cjk, romanization, english }
  growthState = 'new',
  livedAt,
  sourceTag,      // { type, date, context }
  onProveIt,
  onIKnow,
  onNavigate,     // called when tapping the tile body (not an action)
}) {
  const [expanded, setExpanded] = useState(false);

  const handleTileClick = () => {
    if (onProveIt || onIKnow) {
      setExpanded((v) => !v);
    } else {
      onNavigate?.();
    }
  };

  return (
    <div className={styles.tile}>
      <div className={`${styles.bar} ${BAR_CLASS[growthState] ?? styles.barNew}`} />
      <div style={{ flex: 1 }}>
        <div className={styles.content} onClick={handleTileClick} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleTileClick()}>
          <span className={styles.cjk}>{phrase.cjk}</span>
          {phrase.romanization && (
            <span className={styles.romanization}>{phrase.romanization}</span>
          )}
          <span className={styles.english}>{phrase.english}</span>
          <div className={styles.footer}>
            <GrowthBadge state={growthState} />
            {livedAt && <span className={styles.livedBadge}>📍 Lived in HK</span>}
            {sourceTag && <SourceTag {...sourceTag} />}
          </div>
        </div>

        {expanded && (onProveIt || onIKnow) && (
          <div className={styles.actions}>
            {onProveIt && (
              <button className={`${styles.actionBtn} ${styles.proveit}`} onClick={onProveIt}>
                🎤 Prove it
              </button>
            )}
            {onIKnow && (
              <button className={`${styles.actionBtn} ${styles.iknow}`} onClick={onIKnow}>
                ✓ I already know this
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
