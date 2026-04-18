import { useState, useEffect } from 'react';
import styles from './HomeScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { SceneCard } from '../ui/SceneCard.jsx';
import { buildSceneLesson } from '../../services/lessonBuilder.js';

export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  const language = settings?.currentLanguage ?? 'cantonese';

  useEffect(() => {
    buildSceneLesson(language)
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(() => setLoading(false));
  }, [language]);

  const streakCount = settings?.streakCount ?? 0;

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Today</h1>
          <StreakDots count={streakCount} />
        </header>

        {loading && <div className={styles.skeleton} />}

        {!loading && !lesson && (
          <EmptyState onNavigate={onNavigate} />
        )}

        {!loading && lesson && (
          <TodayLesson lesson={lesson} onNavigate={onNavigate} />
        )}

        <QuickActions onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function StreakDots({ count }) {
  const dots = Array.from({ length: 7 });
  return (
    <div className={styles.streakRow} aria-label={`${count} day streak`}>
      {dots.map((_, i) => (
        <div
          key={i}
          className={`${styles.dot} ${i < count % 7 ? styles.dotFilled : ''}`}
        />
      ))}
    </div>
  );
}

function TodayLesson({ lesson, onNavigate }) {
  const { scene, fadingPhrases, reason } = lesson;
  const phraseCount = scene.lines?.filter(l => l.speaker === 'you').length ?? 0;
  const duration = scene.estimatedMinutes ?? Math.ceil(phraseCount * 0.75);

  return (
    <section className={styles.lessonSection}>
      {reason && <p className={styles.reason}>{reason}</p>}
      <SceneCard
        emoji={scene.emoji}
        title={scene.title}
        phraseCount={phraseCount}
        duration={duration}
        status="fresh"
        onClick={() => onNavigate('shadow', scene.id)}
      />
      <button
        className={styles.primaryCta}
        onClick={() => onNavigate('shadow', scene.id)}
      >
        Shadow this scene
      </button>
    </section>
  );
}

function EmptyState({ onNavigate }) {
  return (
    <section className={styles.empty}>
      <p className={styles.emptyText}>Pick your first scenes to get started.</p>
      <button className={styles.primaryCta} onClick={() => onNavigate('scenes')}>
        Browse scenes
      </button>
    </section>
  );
}

function QuickActions({ onNavigate }) {
  return (
    <div className={styles.quickActions}>
      <button className={styles.chip} onClick={() => onNavigate('practice')}>
        Practice hub
      </button>
      <button className={styles.chip} onClick={() => onNavigate('ai')}>
        Free chat
      </button>
      <button className={styles.chip} onClick={() => onNavigate('scenes')}>
        Browse scenes
      </button>
    </div>
  );
}
