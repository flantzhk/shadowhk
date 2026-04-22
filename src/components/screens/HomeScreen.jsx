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
  const boxes = Array.from({ length: 7 });
  const filled = count % 7 === 0 && count > 0 ? 7 : count % 7;
  return (
    <div className={styles.streakRow} aria-label={`${count} day streak`}>
      {boxes.map((_, i) => (
        <div
          key={i}
          className={`${styles.dot} ${i < filled ? styles.dotFilled : ''}`}
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
      <p className={styles.sectionLabel}>TODAY'S SCENE</p>
      {reason && <p className={styles.reason}>{reason}</p>}
      <div className={styles.sceneHero}>
        <div className={styles.sceneHeroMeta}>
          <span className={styles.sceneEmoji}>{scene.emoji}</span>
          <div>
            <p className={styles.sceneTitle}>{scene.title}</p>
            <p className={styles.sceneMeta}>{phraseCount} phrases · {duration} min</p>
          </div>
        </div>
        <div className={styles.sceneHeroBtns}>
          <button
            className={styles.primaryCta}
            onClick={() => onNavigate('shadow', scene.id)}
          >
            ▶ Shadow
          </button>
          <button
            className={styles.secondaryCta}
            onClick={() => onNavigate('listen', scene.id)}
          >
            🎧 Listen
          </button>
        </div>
      </div>
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
      <p className={styles.orLabel}>OR</p>
      <button className={styles.actionBox} onClick={() => onNavigate('practice')}>
        <span className={styles.actionTitle}>⚡ 3 min review</span>
        <span className={styles.actionDesc}>Quick drill on due phrases</span>
      </button>
      <button className={styles.actionBox} onClick={() => onNavigate('ai-scenario')}>
        <span className={styles.actionTitle}>💬 Free chat</span>
        <span className={styles.actionDesc}>Practice what you know</span>
      </button>
      <button className={styles.actionBox} onClick={() => onNavigate('scenes')}>
        <span className={styles.actionTitle}>🎬 Browse scenes</span>
        <span className={styles.actionDesc}>Add a new HK moment to your library</span>
      </button>
    </div>
  );
}
