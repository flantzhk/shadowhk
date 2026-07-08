// src/components/screens/LicensesScreen.jsx — Open source licenses

import styles from './LicensesScreen.module.css';

const LICENSES = [
  { name: 'React', version: '18.3', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React DOM', version: '18.3', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Vite', version: '5.4', license: 'MIT', url: 'https://github.com/vitejs/vite' },
  { name: 'Firebase', version: '10.14', license: 'Apache-2.0', url: 'https://github.com/firebase/firebase-js-sdk' },
  { name: 'idb', version: '8.0', license: 'ISC', url: 'https://github.com/nicolo-ribaudo/idb' },
  { name: 'vite-plugin-pwa', version: '0.20', license: 'MIT', url: 'https://github.com/vite-pwa/vite-plugin-pwa' },
  { name: '@vitejs/plugin-react', version: '4.3', license: 'MIT', url: 'https://github.com/vitejs/vite-plugin-react' },
];

export default function LicensesScreen({ onBack }) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Open Source Licenses</h1>
      </div>
      <p className={styles.intro}>ShadowSpeak is built with these open source libraries.</p>

      <div className={styles.list}>
        {LICENSES.map((lib) => (
          <div key={lib.name} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.libName}>{lib.name}</span>
              <span className={styles.libVersion}>v{lib.version}</span>
            </div>
            <span className={styles.libLicense}>{lib.license}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
