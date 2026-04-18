// src/components/shared/ConfirmModal.jsx — Generic confirmation/info modal

import { useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';

/**
 * @param {{ title: string, body: string, confirmLabel?: string, cancelLabel?: string, destructive?: boolean, onConfirm: Function, onCancel: Function }} props
 */
export function ConfirmModal({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }) {
  const cancelBtnRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    // Focus cancel button (safer default) when modal opens
    cancelBtnRef.current?.focus();
    // Trap focus and handle Escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className={styles.title}>{title}</h2>
        {body && <p className={styles.body}>{body}</p>}
        <div className={styles.actions}>
          <button ref={cancelBtnRef} className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`${styles.confirmBtn} ${destructive ? styles.destructive : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
