// src/components/screens/JyutpingGuide.jsx — reference screen explaining how
// to read Jyutping: what the tone numbers mean, and the initials/finals that
// trip up English speakers. No completion tracking — it's meant to be
// revisited anytime, not gated once.

import { useState, useRef, useCallback } from 'react';
import styles from './JyutpingGuide.module.css';
import { staticWordAudio } from '../../services/staticAudio.js';
import { textToSpeech } from '../../services/api.js';
import { SIX_TONES } from '../../utils/toneData.js';

const GOTCHAS = [
  { letters: 'z / c',  note: '"z" sounds like "ds", "c" like "ts", not the English z/c.', jyutping: 'zi6 gei2', char: '自己', meaning: 'yourself' },
  { letters: 'j',      note: 'Always a "y" sound, never like the English "j".',            jyutping: 'jat1',     char: '一',   meaning: 'one' },
  { letters: 'ng-',    note: 'A nasal onset with no English equivalent, hum before the vowel.', jyutping: 'ngo5', char: '我',   meaning: 'I / me' },
  { letters: 'eo / oe', note: 'A rounded vowel between "u" and "eu", nothing like it in English.', jyutping: 'seoi2', char: '水', meaning: 'water' },
];

export default function JyutpingGuide({ onBack, onNavigate }) {
  const audioElRef = useRef(null);
  const [playingChar, setPlayingChar] = useState(null);

  const speak = useCallback(async (char) => {
    audioElRef.current?.pause();
    setPlayingChar(char);
    try {
      const blob = (await staticWordAudio(char)) ?? await textToSpeech(char, { language: 'cantonese' });
      if (!blob || blob.size === 0) { setPlayingChar(null); return; }
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      audioElRef.current = el;
      el.onended = () => { setPlayingChar(null); URL.revokeObjectURL(url); };
      el.onerror = () => { setPlayingChar(null); URL.revokeObjectURL(url); };
      await el.play();
    } catch {
      setPlayingChar(null);
    }
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>REFERENCE</p>
          <h1 className={styles.title}>How to Read Jyutping</h1>
        </div>
      </div>

      <div className={styles.intro}>
        <p className={styles.introText}>
          Jyutping spells Cantonese sounds with letters you already know, plus a number at the end of each syllable: that number is the <strong>tone</strong>. Same letters, different number, completely different word.
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The 6 tones</h2>
        <p className={styles.sectionSub}>One syllable, six meanings. Tap each to hear it.</p>
        <div className={styles.toneList}>
          {SIX_TONES.map(t => (
            <button key={t.tone} className={styles.toneRow} onClick={() => speak(t.char)}>
              <span className={styles.toneNum}>{t.tone}</span>
              <span className={styles.toneJyut}>{t.jyutping}</span>
              <span className={styles.toneChar} lang="yue">{t.char}</span>
              <span className={styles.toneDesc}>{t.desc}</span>
              <span className={styles.toneMeaning}>{t.meaning}</span>
              <span className={`${styles.tonePlay} ${playingChar === t.char ? styles.tonePlaying : ''}`}>▶</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Letters that aren't what they look like</h2>
        <p className={styles.sectionSub}>A few spellings that read differently than in English.</p>
        <div className={styles.gotchaList}>
          {GOTCHAS.map(g => (
            <div key={g.letters} className={styles.gotchaRow}>
              <div className={styles.gotchaText}>
                <span className={styles.gotchaLetters}>{g.letters}</span>
                <p className={styles.gotchaNote}>{g.note}</p>
              </div>
              <button className={styles.gotchaExample} onClick={() => speak(g.char)}>
                <span className={styles.gotchaJyut}>{g.jyutping}</span>
                <span className={styles.gotchaChar} lang="yue">{g.char}</span>
                <span className={`${styles.tonePlay} ${playingChar === g.char ? styles.tonePlaying : ''}`}>▶</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.ctaSection}>
        <p className={styles.ctaText}>Ready to train your ear on real tone pairs?</p>
        <button className={styles.ctaBtn} onClick={() => onNavigate('tonegym')}>
          Practice in Tone Gym →
        </button>
      </div>

      <div className={styles.bottomPad} />
    </div>
  );
}
