import { useState, useEffect } from 'react';
import styles from './HomeScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { buildSceneLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries, getAllSceneProgress } from '../../services/storage.js';
import { getAllScenes } from '../../services/sceneLoader.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';

// Curated playlists of scene IDs
const PLAYLISTS = [
  { id: 'arrival', label: 'Landing in HK', desc: 'First days sorted', sceneIds: ['taxi', 'mtr-station', 'convenience-store', 'building-management'] },
  { id: 'foodie',  label: 'Foodie circuit', desc: 'Eat like a local',  sceneIds: ['cha-chaan-teng', 'dim-sum', 'wet-market', 'bakery'] },
  { id: 'weekend', label: 'Weekend out',    desc: 'Get around the city', sceneIds: ['ferry', 'temple-visit', 'meeting-someone-new', 'hair-salon'] },
  { id: 'tones',   label: 'Tone workout',   desc: 'Ear-training scenes',  sceneIds: ['school-gate', 'neighbour-lift', 'minibus', 'pharmacy'] },
];

function getGreeting(name) {
  const h = new Date().getHours();
  const time = h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : 'EVENING';
  return { time, greeting: "Let's learn some Cantonese together.", label: name ? `GOOD ${time}, ${name.toUpperCase()}` : `GOOD ${time}` };
}

function getReasonLabel(lesson) {
  if (lesson?.reason) return lesson.reason;
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  return `${day}'s pick`;
}

export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalPhraseCount, setPersonalPhraseCount] = useState(null);
  const [allScenes, setAllScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});

  const language = settings?.currentLanguage ?? 'cantonese';
  const userName = settings?.name ?? '';
  const streakCount = settings?.streakCount ?? 0;
  const { time, greeting, label } = getGreeting(userName);

  useEffect(() => {
    buildSceneLesson(language).then(setLesson).catch(() => setLesson(null)).finally(() => setLoading(false));
    getLibraryEntries(language).then(entries => {
      setPersonalPhraseCount(entries.filter(e => e.scene_id === PERSONAL_SCENE_ID).length);
    }).catch(() => setPersonalPhraseCount(0));
    getAllScenes(language).then(setAllScenes).catch(() => {});
    getAllSceneProgress().then(records => {
      const map = {};
      for (const p of records) map[p.sceneId] = p;
      setSceneProgress(map);
    }).catch(() => {});
  }, [language]);

  const inProgressScenes = allScenes.filter(s => {
    const p = sceneProgress[s.id];
    return p && p.masteryPct > 0 && p.masteryPct < 100;
  });

  return (
    <div className={styles.screen}>
      {/* Greeting bar */}
      <header className={styles.greetingBar}>
        <div className={styles.greetingText}>
          <p className={styles.eyebrow}>{label}</p>
          <h1 className={styles.greetingTitle}>{greeting}</h1>
        </div>
        <StreakPill count={streakCount} />
      </header>

      {/* Today's Scene hero — primary action */}
      {!loading && lesson?.scene && (
        <TodaySceneHero lesson={lesson} onNavigate={onNavigate} />
      )}
      {!loading && !lesson && (
        <EmptyHero onNavigate={onNavigate} />
      )}

      {/* Personal intro scene — secondary, below the hero */}
      {personalPhraseCount !== null && (
        <PersonalSceneCard
          phraseCount={personalPhraseCount}
          name={userName}
          onNavigate={onNavigate}
        />
      )}

      {/* Jump back in grid — below the hero */}
      {allScenes.length > 0 && (
        <JumpBackGrid scenes={allScenes} progress={sceneProgress} onNavigate={onNavigate} />
      )}

      {/* Made for you playlist row */}
      <PlaylistRow scenes={allScenes} onNavigate={onNavigate} />

      {/* Keep going row */}
      {inProgressScenes.length > 0 && (
        <KeepGoingRow scenes={inProgressScenes} progress={sceneProgress} onNavigate={onNavigate} />
      )}

      {/* Short sessions */}
      <ShortSessions onNavigate={onNavigate} />

      <div className={styles.bottomPad} />
    </div>
  );
}

function StreakPill({ count }) {
  if (!count) return null;
  return (
    <div className={styles.streakPill}>
      <span className={styles.streakFlame}>🔥</span>
      <span className={styles.streakNum}>{count}</span>
    </div>
  );
}

function JumpBackGrid({ scenes, progress, onNavigate }) {
  const recent = scenes
    .filter(s => progress?.[s.id]?.lastSessionAt)
    .sort((a, b) => (progress[b.id]?.lastSessionAt ?? 0) - (progress[a.id]?.lastSessionAt ?? 0))
    .slice(0, 6);

  if (recent.length === 0) return null;

  return (
    <section className={styles.jumpSection}>
      <div className={styles.jumpGrid}>
        {recent.map(s => (
          <button key={s.id} className={styles.jumpChip} onClick={() => onNavigate('scene', s.id)}>
            {s.imageUrl
              ? <img className={styles.jumpImg} src={s.imageUrl} alt="" />
              : <span className={styles.jumpEmoji}>{s.emoji}</span>
            }
            <span className={styles.jumpTitle}>{s.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TodaySceneHero({ lesson, onNavigate }) {
  const { scene, fadingPhrases = [] } = lesson;
  const totalLines = scene.lines?.length ?? 0;
  const duration = scene.estimatedMinutes ?? 5;
  const dueCount = fadingPhrases.length;

  return (
    <section className={styles.heroSection}>
      <div
        className={styles.sceneHero}
        style={{
          backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined,
          '--tint': scene.tint ?? '#C5E85A',
        }}
      >
        <div className={styles.heroTintOverlay} style={{ background: `linear-gradient(160deg, ${scene.tint ?? '#C5E85A'}44 0%, transparent 55%)` }} />
        <div className={styles.heroDarkOverlay} />

        <div className={styles.heroTopLeft}>
          {dueCount > 0
            ? <span className={styles.dueChip}>🔁 {dueCount} {dueCount === 1 ? 'phrase' : 'phrases'} to practise</span>
            : <span className={styles.todayChip}>TODAY'S PRACTICE</span>
          }
        </div>

        <div className={styles.heroBottomLeft}>
          <span className={styles.heroEmoji}>{scene.emoji}</span>
          <h2 className={styles.heroTitle}>{scene.title}</h2>
          <p className={styles.heroMeta}>{totalLines} phrases · {duration} min</p>
          <div className={styles.heroBtns}>
            <button className={styles.practiceNowBtn} onClick={() => onNavigate('shadow', scene.id)}>
              ▶ Practice now
            </button>
            <button className={styles.listenBtn} onClick={() => onNavigate('listen', scene.id)}>
              🔊 Listen first
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyHero({ onNavigate }) {
  return (
    <section className={styles.heroSection}>
      <div className={styles.emptyHero}>
        <p className={styles.emptyText}>Pick your first scenes to get started.</p>
        <button className={styles.shadowBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
      </div>
    </section>
  );
}

function PlaylistRow({ scenes, onNavigate }) {
  return (
    <section className={styles.rowSection}>
      <h2 className={styles.rowLabel}>Made for you</h2>
      <div className={styles.scrollRow}>
        {PLAYLISTS.map(playlist => {
          const first = scenes.find(s => s.id === playlist.sceneIds[0]);
          return (
            <button
              key={playlist.id}
              className={styles.playlistCard}
              onClick={() => onNavigate('scene', playlist.sceneIds[0])}
            >
              <div
                className={styles.playlistCover}
                style={{
                  backgroundImage: first?.imageUrl ? `url(${first.imageUrl})` : undefined,
                  '--ptint': first?.tint ?? '#C5E85A',
                }}
              >
                <div className={styles.playlistCoverGradient} />
                <span className={styles.playlistTitle}>{playlist.label}</span>
              </div>
              <p className={styles.playlistDesc}>{playlist.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function KeepGoingRow({ scenes, progress, onNavigate }) {
  return (
    <section className={styles.rowSection}>
      <h2 className={styles.rowLabel}>Keep going</h2>
      <div className={styles.scrollRow}>
        {scenes.map(s => {
          const pct = progress[s.id]?.masteryPct ?? 0;
          return (
            <button
              key={s.id}
              className={styles.keepCard}
              onClick={() => onNavigate('scene', s.id)}
            >
              <div
                className={styles.keepCover}
                style={{ backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined }}
              >
                <div className={styles.keepCoverOverlay} />
              </div>
              <p className={styles.keepTitle}>{s.title}</p>
              <div className={styles.keepProgressBar}>
                <div className={styles.keepProgressFill} style={{ width: `${pct}%` }} />
              </div>
              <p className={styles.keepPct}>{Math.round(pct)}%</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ShortSessions({ onNavigate }) {
  const sessions = [
    { label: 'Tone Gym',  desc: 'Train your ear',      color: '#8F6AE8', route: 'tonegym',  emoji: '🎵' },
    { label: 'Free Chat', desc: 'AI conversation',      color: '#5AC8E8', route: 'ai-scenario', emoji: '💬' },
    { label: 'Speed Run', desc: 'Beat the clock',       color: '#E8703A', route: 'speedrun', emoji: '⚡' },
  ];
  return (
    <section className={styles.shortSection}>
      <h2 className={styles.rowLabel}>Short sessions</h2>
      {sessions.map(s => (
        <button key={s.route} className={styles.shortRow} onClick={() => onNavigate(s.route)}>
          <div className={styles.shortIcon} style={{ background: s.color + '38' }}>
            <span className={styles.shortEmoji}>{s.emoji}</span>
          </div>
          <div className={styles.shortText}>
            <span className={styles.shortLabel}>{s.label}</span>
            <span className={styles.shortDesc}>{s.desc}</span>
          </div>
          <ChevronRight />
        </button>
      ))}
    </section>
  );
}

function PersonalSceneCard({ phraseCount, name, onNavigate }) {
  if (phraseCount > 0) {
    return (
      <section className={styles.personalSection}>
        <div className={styles.personalFilled}>
          <div className={styles.personalFilledLeft}>
            <span className={styles.personalEyebrow}>👋 INTRODUCE YOURSELF</span>
            <p className={styles.personalTitle}>{name ? `${name}'s personal scene` : 'Your personal scene'}</p>
            <p className={styles.personalMeta}>{phraseCount} {phraseCount === 1 ? 'phrase' : 'phrases'} · shadow how you'd introduce yourself in real life</p>
          </div>
          <button
            className={styles.personalShadowBtn}
            onClick={() => onNavigate('introduce-yourself')}
          >
            Shadow →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.personalSection}>
      <button className={styles.personalEmpty} onClick={() => onNavigate('introduce-yourself')}>
        <span className={styles.personalEmptyEmoji}>👋</span>
        <div className={styles.personalEmptyText}>
          <p className={styles.personalEmptyTitle}>Introduce yourself in Cantonese</p>
          <p className={styles.personalEmptyDesc}>Tell us your name, job, and a bit about your life — we'll build you a custom scene to shadow.</p>
        </div>
        <span className={styles.personalEmptyArrow}>Set it up →</span>
      </button>
    </section>
  );
}

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--fg-2)' }}>
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
