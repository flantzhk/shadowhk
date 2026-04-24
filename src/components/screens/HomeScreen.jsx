import { useState, useEffect } from 'react';
import styles from './HomeScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { buildSceneLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries } from '../../services/storage.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';

export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalPhraseCount, setPersonalPhraseCount] = useState(null); // null=loading, 0=none, >0=has scene

  const language = settings?.currentLanguage ?? 'cantonese';
  const userName = settings?.name ?? '';

  useEffect(() => {
    buildSceneLesson(language)
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(() => setLoading(false));

    getLibraryEntries(language)
      .then(entries => {
        const count = entries.filter(e => e.scene_id === PERSONAL_SCENE_ID).length;
        setPersonalPhraseCount(count);
      })
      .catch(() => setPersonalPhraseCount(0));
  }, [language]);

  const streakCount = settings?.streakCount ?? 0;

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Today</h1>
          <StreakBadge count={streakCount} />
        </header>

        {loading && <div className={styles.skeleton} />}

        {!loading && !lesson && (
          <EmptyState onNavigate={onNavigate} />
        )}

        {!loading && lesson && (
          <TodayLesson lesson={lesson} onNavigate={onNavigate} />
        )}

        {personalPhraseCount !== null && (
          personalPhraseCount > 0
            ? <PersonalSceneCard count={personalPhraseCount} name={userName} onNavigate={onNavigate} />
            : <IntroNudge onNavigate={onNavigate} />
        )}

        <QuickActions onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function StreakBadge({ count }) {
  const boxes = Array.from({ length: 7 });
  const filled = count % 7 === 0 && count > 0 ? 7 : count % 7;
  return (
    <div className={styles.streakWidget}>
      {count > 0 && (
        <p className={styles.streakLabel}>🔥 {count} day streak</p>
      )}
      <div className={styles.streakDots} aria-label={`${count} day streak`}>
        {boxes.map((_, i) => (
          <div key={i} className={`${styles.dot} ${i < filled ? styles.dotFilled : ''}`} />
        ))}
      </div>
    </div>
  );
}

function TodayLesson({ lesson, onNavigate }) {
  const { scene, reason } = lesson;
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

function PersonalSceneCard({ count, name, onNavigate }) {
  const title = name ? `${name}'s introduction` : 'Your introduction';
  const duration = Math.max(1, Math.ceil(count * 0.75));
  return (
    <section className={styles.lessonSection}>
      <p className={styles.sectionLabel}>YOUR PERSONAL SCENE</p>
      <div className={styles.personalCard}>
        <div className={styles.sceneHeroMeta}>
          <span className={styles.sceneEmoji}>👋</span>
          <div>
            <p className={styles.sceneTitle}>{title}</p>
            <p className={styles.sceneMeta}>{count} phrase{count !== 1 ? 's' : ''} · {duration} min · Made from your real life</p>
          </div>
        </div>
        <div className={styles.sceneHeroBtns}>
          <button
            className={styles.primaryCta}
            onClick={() => onNavigate('shadow', PERSONAL_SCENE_ID)}
          >
            ▶ Shadow
          </button>
          <button
            className={styles.secondaryCta}
            onClick={() => onNavigate('introduce-yourself')}
          >
            ✏️ Update
          </button>
        </div>
      </div>
    </section>
  );
}

function IntroNudge({ onNavigate }) {
  return (
    <button className={styles.introNudge} onClick={() => onNavigate('introduce-yourself')}>
      <div className={styles.introNudgeInner}>
        <span className={styles.introNudgeEmoji}>👋</span>
        <div className={styles.introNudgeText}>
          <p className={styles.introNudgeTitle}>Build your personal intro scene</p>
          <p className={styles.introNudgeDesc}>
            Tell us about yourself — your job, family, and neighbourhood — and we'll build you a set of phrases from your real life. Exactly what people will ask when you meet them.
          </p>
        </div>
      </div>
      <svg className={styles.introNudgeArrow} width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
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
        <span className={styles.actionDesc}>Go through phrases you haven't practised in a while</span>
      </button>
      <button className={styles.actionBox} onClick={() => onNavigate('ai-scenario')}>
        <span className={styles.actionTitle}>💬 Free chat</span>
        <span className={styles.actionDesc}>Have a conversation with an AI tutor in Cantonese</span>
      </button>
      <button className={styles.actionBox} onClick={() => onNavigate('scenes')}>
        <span className={styles.actionTitle}>🎬 Browse scenes</span>
        <span className={styles.actionDesc}>Find a new real-life Hong Kong situation to learn</span>
      </button>
    </div>
  );
}
