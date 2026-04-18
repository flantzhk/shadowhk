// src/components/shared/LessonLoader.jsx — Pre-lesson loading overlay

import styles from './LessonLoader.module.css';

const MODE_COPY = {
  'shadow-session': { label: 'Shadow Session', tip: 'Listen and repeat to improve pronunciation.' },
  'prompt-drill': { label: 'Prompt Drill', tip: "You'll see English — say it in Cantonese." },
  'speed-run': { label: 'Speed Run', tip: 'Pick the right phrase before the timer runs out.' },
  'tone-gym': { label: 'Tone Gym', tip: 'Train your ear to distinguish Cantonese tones.' },
};

/**
 * Full-screen lesson loading overlay.
 * @param {{ mode?: string, onCancel?: Function }} props
 */
export function LessonLoader({ mode, onCancel }) {
  const info = MODE_COPY[mode] || { label: 'Loading lesson', tip: 'Preparing your phrases...' };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.spinnerWrap}>
          <div className={styles.spinner} />
        </div>

        <h2 className={styles.label}>{info.label}</h2>
        <p className={styles.tip}>{info.tip}</p>

        {onCancel && (
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
