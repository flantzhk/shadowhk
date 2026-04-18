// src/components/shared/StorageFullModal.jsx — Library full warning

import { MAX_LIBRARY_SIZE } from '../../utils/constants';
import styles from './StorageFullModal.module.css';

/**
 * @param {{ onClose: Function, onGoToLibrary: Function }} props
 */
export function StorageFullModal({ onClose, onGoToLibrary }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-dark)" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 className={styles.title}>Library is full</h2>
        <p className={styles.body}>
          You've saved {MAX_LIBRARY_SIZE} phrases — the maximum. Master or remove some
          phrases to make room for new ones.
        </p>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={() => { onGoToLibrary?.(); onClose?.(); }}>
            Go to Library
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
