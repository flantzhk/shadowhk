import { useState, useEffect, useContext } from 'react';
import styles from './PracticeScreen.module.css';
import { AppContext } from '../../contexts/AppContext.jsx';
import { getDueByLanguage as getDueEntries } from '../../services/srs.js';
import { getLibraryEntries } from '../../services/storage.js';

const TIME_OPTIONS = [5, 10, 20];
const FOCUS_OPTIONS = [
  { id: 'tones', label: 'Tones' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'recall', label: 'Recall' },
  { id: 'everything', label: 'Everything' },
];

export default function PracticeScreen({ onNavigate }) {
  const { settings } = useContext(AppContext);
  const language = settings?.currentLanguage ?? 'cantonese';

  const [time, setTime] = useState(10);
  const [focus, setFocus] = useState('everything');
  const [recommendation, setRecommendation] = useState(null);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const library = await getLibraryEntries(language);
        const due = await getDueEntries(language);
        setDueCount(due.length);
        if (due.length > 0) {
          setRecommendation({
            type: 'shadow',
            label: `${due.length} phrase${due.length !== 1 ? 's' : ''} need review`,
            detail: 'Shadow a scene to catch up.',
            action: () => onNavigate('home'),
          });
        } else if (library.length > 0) {
          setRecommendation({
            type: 'tone',
            label: 'Work on your tones',
            detail: 'Tone Gym targets your real library.',
            action: () => onNavigate('drill/tone'),
          });
        }
      } catch (_) {}
    })();
  }, [language]);

  function start() {
    switch (focus) {
      case 'tones': return onNavigate('drill/tone');
      case 'speaking': return onNavigate('shadow', null);
      case 'recall': return onNavigate('prompt');
      default: return onNavigate('shadow', null);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <h1 className={styles.title}>Practice</h1>

        {recommendation && (
          <button className={styles.recommendCard} onClick={recommendation.action}>
            <div className={styles.recommendIcon}>
              {recommendation.type === 'tone' ? '🎯' : '📅'}
            </div>
            <div className={styles.recommendText}>
              <p className={styles.recommendLabel}>{recommendation.label}</p>
              <p className={styles.recommendDetail}>{recommendation.detail}</p>
            </div>
            <ChevronRight />
          </button>
        )}

        <div className={styles.question}>
          <p className={styles.questionText}>How much time?</p>
          <div className={styles.chips}>
            {TIME_OPTIONS.map(t => (
              <button
                key={t}
                className={`${styles.chip} ${time === t ? styles.chipActive : ''}`}
                onClick={() => setTime(t)}
              >
                {t} min
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <p className={styles.questionText}>What do you want to work on?</p>
          <div className={styles.chips}>
            {FOCUS_OPTIONS.map(f => (
              <button
                key={f.id}
                className={`${styles.chip} ${focus === f.id ? styles.chipActive : ''}`}
                onClick={() => setFocus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button className={styles.startBtn} onClick={start}>
          Start {time} min session
        </button>

        <div className={styles.modeList}>
          <p className={styles.modeListTitle}>Other modes</p>

          <ModeRow
            emoji="🗣"
            label="Shadow a scene"
            desc="Listen, then say it back"
            onClick={() => onNavigate('scenes')}
          />
          <ModeRow
            emoji="💬"
            label="Free chat"
            desc="Open conversation with AI"
            onClick={() => onNavigate('ai')}
          />
          <ModeRow
            emoji="⚡"
            label="Speed run"
            desc="60 seconds, as many phrases as possible"
            onClick={() => onNavigate('speedrun')}
          />
          <ModeRow
            emoji="🎯"
            label="Tone Gym"
            desc="10 reps on your hardest tones"
            onClick={() => onNavigate('drill/tone')}
          />
          <ModeRow
            emoji="🧠"
            label="Prompt drill"
            desc="Hear English, produce Cantonese"
            onClick={() => onNavigate('prompt')}
          />
        </div>
      </div>
    </div>
  );
}

function ModeRow({ emoji, label, desc, onClick }) {
  return (
    <button className={styles.modeRow} onClick={onClick}>
      <span className={styles.modeEmoji}>{emoji}</span>
      <div className={styles.modeText}>
        <p className={styles.modeLabel}>{label}</p>
        <p className={styles.modeDesc}>{desc}</p>
      </div>
      <ChevronRight />
    </button>
  );
}

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
