// src/components/screens/JyutpingGuide.jsx — reference screen explaining how
// to read romanization: Jyutping's tone numbers for Cantonese, or Pinyin's
// tone marks for Mandarin. No completion tracking — it's meant to be
// revisited anytime, not gated once.

import { useState, useRef, useCallback } from 'react';
import styles from './JyutpingGuide.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { staticWordAudio } from '../../services/staticAudio.js';
import { textToSpeech } from '../../services/api.js';
import { SIX_TONES, FOUR_TONES } from '../../utils/toneData.js';

const CANTONESE_GOTCHAS = [
  { letters: 'z / c',  note: '"z" sounds like "ds", "c" like "ts", not the English z/c.', romanization: 'zi6 gei2', char: '自己', meaning: 'yourself' },
  { letters: 'j',      note: 'Always a "y" sound, never like the English "j".',            romanization: 'jat1',     char: '一',   meaning: 'one' },
  { letters: 'ng-',    note: 'A nasal onset with no English equivalent, hum before the vowel.', romanization: 'ngo5', char: '我',   meaning: 'I / me' },
  { letters: 'eo / oe', note: 'A rounded vowel between "u" and "eu", nothing like it in English.', romanization: 'seoi2', char: '水', meaning: 'water' },
];

const MANDARIN_GOTCHAS = [
  { letters: 'q',       note: 'Sounds like the "ch" in "cheese", not like an English "q".', romanization: 'qǐng', char: '请', meaning: 'please' },
  { letters: 'x',       note: 'A soft "sh" sound, tongue low and forward — softer than English "sh".', romanization: 'xiè', char: '谢', meaning: 'thank' },
  { letters: 'zh/ch/sh', note: 'Retroflex sounds — curl your tongue tip back, unlike any English sound.', romanization: 'zhōngguó', char: '中国', meaning: 'China' },
  { letters: 'ü',       note: 'A rounded "u" (like French "u" or German "ü") — nothing like it in English.', romanization: 'lǜsè', char: '绿色', meaning: 'green' },
];

export default function JyutpingGuide({ onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const isMandarin = language === 'mandarin';
  const TONES = isMandarin ? FOUR_TONES : SIX_TONES;
  const GOTCHAS = isMandarin ? MANDARIN_GOTCHAS : CANTONESE_GOTCHAS;

  const audioElRef = useRef(null);
  const [playingChar, setPlayingChar] = useState(null);

  const speak = useCallback(async (char) => {
    audioElRef.current?.pause();
    setPlayingChar(char);
    try {
      const blob = (await staticWordAudio(char, language)) ?? await textToSpeech(char, { language });
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
  }, [language]);

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
          <h1 className={styles.title}>{isMandarin ? 'How to Read Pinyin' : 'How to Read Jyutping'}</h1>
        </div>
      </div>

      <div className={styles.intro}>
        <p className={styles.introText}>
          {isMandarin
            ? <>Pinyin spells Mandarin sounds with letters you already know, plus a mark over the vowel: that mark is the <strong>tone</strong>. Same letters, different mark, completely different word.</>
            : <>Jyutping spells Cantonese sounds with letters you already know, plus a number at the end of each syllable: that number is the <strong>tone</strong>. Same letters, different number, completely different word.</>}
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isMandarin ? 'The 4 tones' : 'The 6 tones'}</h2>
        <p className={styles.sectionSub}>One syllable, {isMandarin ? 'four' : 'six'} meanings. Tap each to hear it.</p>
        <div className={styles.toneList}>
          {TONES.map(t => (
            <button key={t.tone} className={styles.toneRow} onClick={() => speak(t.char)}>
              <span className={styles.toneNum}>{t.tone}</span>
              <span className={styles.toneJyut}>{t.romanization}</span>
              <span className={styles.toneChar} lang={isMandarin ? 'zh-CN' : 'yue'}>{t.char}</span>
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
                <span className={styles.gotchaJyut}>{g.romanization}</span>
                <span className={styles.gotchaChar} lang={isMandarin ? 'zh-CN' : 'yue'}>{g.char}</span>
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
