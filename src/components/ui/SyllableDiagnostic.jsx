import styles from './SyllableDiagnostic.module.css';

/**
 * SyllableDiagnostic — renders a diffJyutping() result as a row of syllable
 * chips, color-coded by what went wrong (tone vs. sound vs. missing/extra).
 * @param {Array<{expected: string|null, actual: string|null, status: string}>} diff
 * @param {'light'|'dark'} [variant='light']
 */
export function SyllableDiagnostic({ diff = [], variant = 'light' }) {
  if (diff.length === 0) return null;

  return (
    <div className={`${styles.row} ${variant === 'dark' ? styles.dark : ''}`}>
      {diff.map((s, i) => (
        <span
          key={i}
          className={`${styles.syllable} ${styles[s.status]}`}
          aria-label={
            s.status === 'correct' ? `${s.expected}, correct`
              : s.status === 'tone' ? `expected ${s.expected}, you said ${s.actual}, wrong tone`
              : s.status === 'sound' ? `expected ${s.expected}, you said ${s.actual}, wrong sound`
              : s.status === 'missing' ? `expected ${s.expected}, not heard`
              : `extra syllable ${s.actual}`
          }
        >
          {s.status === 'extra' ? `+${s.actual}` : s.expected}
        </span>
      ))}
    </div>
  );
}
