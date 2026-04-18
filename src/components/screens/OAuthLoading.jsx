// src/components/screens/OAuthLoading.jsx — Item 22

import styles from './OAuthLoading.module.css';

export default function OAuthLoading({ provider = 'Google', onCancel }) {
  return (
    <div className={styles.screen}>
      <div className={styles.spinner} />
      <h2 className={styles.title}>Signing you in...</h2>
      <p className={styles.subtitle}>Waiting for {provider}</p>
      <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
    </div>
  );
}
