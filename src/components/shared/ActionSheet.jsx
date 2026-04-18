// src/components/shared/ActionSheet.jsx — iOS-style action sheet

import styles from './ActionSheet.module.css';

/**
 * @param {{ title?: string, body?: string, actions: Array<{label: string, destructive?: boolean, onClick: Function}>, onCancel: Function }} props
 */
export function ActionSheet({ title, body, actions, onCancel }) {
  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {(title || body) && (
          <div className={styles.titleCard}>
            {title && <p className={styles.title}>{title}</p>}
            {body && <p className={styles.body}>{body}</p>}
          </div>
        )}
        <div className={styles.actionsGroup}>
          {actions.map((action, i) => (
            <button
              key={i}
              className={`${styles.action} ${action.destructive ? styles.destructive : ''}`}
              style={{ borderTop: i > 0 ? '0.5px solid var(--color-border)' : 'none' }}
              onClick={() => { action.onClick(); onCancel(); }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
