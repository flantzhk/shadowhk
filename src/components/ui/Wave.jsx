import styles from './Wave.module.css';

const HEIGHTS = [6, 12, 18, 24, 20, 14, 8, 12, 20, 16, 10, 6];

export function Wave({ active = false }) {
  return (
    <div className={`${styles.wave} ${active ? styles.active : ''}`}>
      {HEIGHTS.map((h, i) => (
        <div key={i} className={styles.bar} style={{ height: active ? undefined : h }} />
      ))}
    </div>
  );
}
