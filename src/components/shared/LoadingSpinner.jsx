// src/components/shared/LoadingSpinner.jsx

import styles from './LoadingSpinner.module.css';

/**
 * Loading spinner indicator.
 * @param {{ size: number }} props
 */
function LoadingSpinner({ size = 24 }) {
  return (
    <div
      className={styles.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <circle
          cx="12" cy="12" r="10"
          stroke="var(--color-border-strong)"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="var(--color-brand-lime)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export { LoadingSpinner };
