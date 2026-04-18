import styles from './SourceTag.module.css';
import { SOURCE_TAGS } from '../../utils/constants.js';

const ICONS = {
  [SOURCE_TAGS.HEARD_IT]:    '👂',
  [SOURCE_TAGS.FROM_SCHOOL]: '🏫',
  [SOURCE_TAGS.FROM_SHOW]:   '📺',
  [SOURCE_TAGS.MINE]:        '✏️',
  [SOURCE_TAGS.LIBRARY]:     '📖',
};

const LABELS = {
  [SOURCE_TAGS.HEARD_IT]:    'heard it',
  [SOURCE_TAGS.FROM_SCHOOL]: 'from school',
  [SOURCE_TAGS.FROM_SHOW]:   'from a show',
  [SOURCE_TAGS.MINE]:        'mine',
  [SOURCE_TAGS.LIBRARY]:     'library',
};

export function SourceTag({ type, date, context }) {
  const icon = ICONS[type] ?? '📌';
  const label = LABELS[type] ?? type;
  const dateStr = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <span className={styles.tag}>
      <span className={styles.icon}>{icon}</span>
      {label}
      {dateStr && <span className={styles.sep}>·</span>}
      {dateStr && <span>{dateStr}</span>}
      {context && <span className={styles.sep}>·</span>}
      {context && <span className={styles.context}>{context}</span>}
    </span>
  );
}
