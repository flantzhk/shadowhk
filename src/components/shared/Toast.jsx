// src/components/shared/Toast.jsx

import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

/**
 * Toast notification component.
 * @param {{ message: string, type: 'success'|'error'|'info', onDismiss: () => void }} props
 */
function Toast({ message, type = 'info', onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${isVisible ? styles.visible : styles.hidden}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.message}>{message}</span>
    </div>
  );
}

/**
 * Hook for managing toast notifications.
 * @returns {{ toast: Object|null, showToast: Function, ToastComponent: Function }}
 */
function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <Toast
      key={toast.key}
      message={toast.message}
      type={toast.type}
      onDismiss={dismissToast}
    />
  ) : null;

  return { showToast, ToastComponent };
}

export { Toast, useToast };
