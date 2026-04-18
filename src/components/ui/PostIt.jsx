import styles from './PostIt.module.css';

export function PostIt({ text }) {
  return (
    <div className={styles.postit}>
      <p className={styles.text}>{text}</p>
    </div>
  );
}
