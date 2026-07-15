// RealLifeCelebration — full-screen cinematic burst when user marks
// "I said this in real life". This is the highest-stakes moment in the app —
// they've taken the language out of practice and into the world.

import { useEffect } from 'react';
import styles from './RealLifeCelebration.module.css';

const PARTICLES = [
  { left: '5%',  size: 7,  bg: '#C8392B', dur: 2.6, delay: 0,    shape: 'rect' },
  { left: '12%', size: 5,  bg: '#C9A24A', dur: 3.0, delay: 0.2,  shape: 'circle' },
  { left: '20%', size: 8,  bg: '#fff',    dur: 2.8, delay: 0.5,  shape: 'rect' },
  { left: '30%', size: 5,  bg: '#C8392B', dur: 3.2, delay: 0.1,  shape: 'circle' },
  { left: '38%', size: 9,  bg: '#C9A24A', dur: 2.5, delay: 0.7,  shape: 'rect' },
  { left: '46%', size: 6,  bg: '#fff',    dur: 3.1, delay: 0.3,  shape: 'circle' },
  { left: '55%', size: 7,  bg: '#C8392B', dur: 2.9, delay: 0.6,  shape: 'rect' },
  { left: '63%', size: 5,  bg: '#C9A24A', dur: 3.3, delay: 0.15, shape: 'circle' },
  { left: '72%', size: 8,  bg: '#fff',    dur: 2.7, delay: 0.4,  shape: 'rect' },
  { left: '80%', size: 6,  bg: '#C8392B', dur: 3.0, delay: 0.55, shape: 'circle' },
  { left: '88%', size: 7,  bg: '#C9A24A', dur: 2.8, delay: 0.8,  shape: 'rect' },
  { left: '95%', size: 5,  bg: '#fff',    dur: 3.1, delay: 0.25, shape: 'circle' },
  // second wave
  { left: '8%',  size: 6,  bg: '#C9A24A', dur: 3.2, delay: 1.1,  shape: 'rect' },
  { left: '25%', size: 8,  bg: '#C8392B', dur: 2.6, delay: 1.3,  shape: 'circle' },
  { left: '42%', size: 5,  bg: '#C9A24A', dur: 3.0, delay: 1.0,  shape: 'rect' },
  { left: '60%', size: 7,  bg: '#fff',    dur: 2.8, delay: 1.4,  shape: 'circle' },
  { left: '77%', size: 6,  bg: '#C8392B', dur: 3.3, delay: 1.2,  shape: 'rect' },
];

/**
 * @param {{ phrase?: { cjk: string, english: string }, language?: string, onDone: Function }} props
 */
export function RealLifeCelebration({ phrase, language = 'cantonese', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={styles.overlay} onClick={onDone}>
      {/* Deep cinematic background glow */}
      <div className={styles.bgGlow} />

      {/* Particle burst */}
      <div className={styles.particles} aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: p.left,
              width: p.size,
              height: p.shape === 'rect' ? p.size * 1.6 : p.size,
              background: p.bg,
              borderRadius: p.shape === 'circle' ? '50%' : 2,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.inner}>
        {/* Pin drop icon */}
        <div className={styles.pinWrap} aria-hidden="true">
          <div className={styles.pinRings}>
            <div className={styles.pinRing} />
            <div className={styles.pinRing} />
          </div>
          <div className={styles.pinCircle}>
            <PinIcon />
          </div>
        </div>

        <p className={styles.eyebrow}>Real world</p>
        <h2 className={styles.headline}>You actually said it.</h2>
        <p className={styles.sub}>In Hong Kong. In the wild. That's the whole point.</p>

        {phrase && (
          <div className={styles.phraseCard}>
            <p className={styles.phraseCjk} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{phrase.cjk}</p>
            {phrase.english && <p className={styles.phraseEn}>{phrase.english}</p>}
          </div>
        )}

        <p className={styles.tapHint}>Tap anywhere to continue</p>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
