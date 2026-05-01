import { useState, useEffect } from 'react';
import styles from './HomeScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { buildSceneLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries, getAllSceneProgress, getDueEntries } from '../../services/storage.js';
import { getAllScenes } from '../../services/sceneLoader.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { STREAK_MILESTONES } from '../../utils/constants.js';

function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PLAYLISTS = [
  { id: 'arrival', label: 'Landing in HK', desc: 'First days sorted', sceneIds: ['taxi', 'mtr-station', 'convenience-store', 'building-management'] },
  { id: 'foodie',  label: 'Foodie circuit', desc: 'Eat like a local',  sceneIds: ['cha-chaan-teng', 'dim-sum', 'wet-market', 'bakery'] },
  { id: 'weekend', label: 'Weekend out',    desc: 'Get around the city', sceneIds: ['ferry', 'temple-visit', 'meeting-someone-new', 'hair-salon'] },
  { id: 'tones',   label: 'Tone workout',   desc: 'Ear-training scenes',  sceneIds: ['school-gate', 'neighbour-lift', 'minibus', 'pharmacy'] },
];

function getGreeting() {
  const h = new Date().getHours();
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'][new Date().getMonth()];
  return { eyebrow: `${day} · ${month}`, period };
}

export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalPhraseCount, setPersonalPhraseCount] = useState(null);
  const [allScenes, setAllScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});
  const [dueCount, setDueCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);

  const language = settings?.currentLanguage ?? 'cantonese';
  const userName = settings?.name ?? '';
  const streakCount = settings?.streakCount ?? 0;
  const { eyebrow, period } = getGreeting();

  const streakAtRisk = streakCount > 0
    && settings?.streakLastDate !== toDateStr()
    && new Date().getHours() >= 18;

  useEffect(() => {
    if (!streakCount || !STREAK_MILESTONES.includes(streakCount)) return;
    if (!localStorage.getItem(`celebratedStreak_${streakCount}`)) setShowMilestone(true);
  }, [streakCount]);

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
    getDueEntries().then(entries => setDueCount(entries.length)).catch(() => {});
  }, [language]);

  const inProgressScenes = allScenes.filter(s => {
    const p = sceneProgress[s.id];
    return p && p.masteryPct > 0 && p.masteryPct < 100;
  });

  return (
    <div className={styles.screen}>
      {showMilestone && (
        <StreakCelebration
          count={streakCount}
          onDismiss={() => {
            localStorage.setItem(`celebratedStreak_${streakCount}`, '1');
            setShowMilestone(false);
          }}
        />
      )}

      <header className={styles.greetingBar}>
        <div className={styles.greetingText}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.greetingTitle}>
            Good {period}{userName && <>, <span className={styles.greetingItalic}>{userName}</span></>}
          </h1>
        </div>
        <StreakPill count={streakCount} />
      </header>

      {streakAtRisk && <StreakRiskBanner count={streakCount} onNavigate={onNavigate} />}

      <div className={styles.sectionBar}>
        <span className={styles.sectionNum}>01</span>
        <span className={styles.sectionLabel}>Today's scene</span>
      </div>

      {!loading && lesson?.scene && (
        <TodaySceneHero lesson={lesson} dueCount={dueCount} onNavigate={onNavigate} />
      )}
      {!loading && !lesson && (
        <EmptyHero onNavigate={onNavigate} />
      )}

      {dueCount > 0 && !loading && <Quick3Pill onNavigate={onNavigate} />}

      {personalPhraseCount !== null && (
        <PersonalSceneCard
          phraseCount={personalPhraseCount}
          name={userName}
          onNavigate={onNavigate}
        />
      )}

      {allScenes.length > 0 && (
        <>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionLabel}>Jump back in</span>
            <button className={styles.sectionSeeAll} onClick={() => onNavigate('scenes')}>See all →</button>
          </div>
          <JumpBackGrid scenes={allScenes} progress={sceneProgress} onNavigate={onNavigate} />
        </>
      )}

      <div className={styles.sectionBar}>
        <span className={styles.sectionNum}>03</span>
        <span className={styles.sectionLabel}>Made for you</span>
      </div>
      <PlaylistRow scenes={allScenes} onNavigate={onNavigate} />

      {inProgressScenes.length > 0 && (
        <>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>04</span>
            <span className={styles.sectionLabel}>Keep going</span>
          </div>
          <KeepGoingRow scenes={inProgressScenes} progress={sceneProgress} onNavigate={onNavigate} />
        </>
      )}

      <div className={styles.sectionBar}>
        <span className={styles.sectionNum}>05</span>
        <span className={styles.sectionLabel}>Practice modes</span>
      </div>
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

function TodaySceneHero({ lesson, dueCount, onNavigate }) {
  const { scene, fadingPhrases = [] } = lesson;
  const totalLines = scene.lines?.length ?? 0;
  const duration = scene.estimatedMinutes ?? 5;
  const sceneDue = fadingPhrases.length;

  const handleBtn = () => dueCount > 0 ? onNavigate('shadow') : onNavigate('shadow', scene.id);

  return (
    <>
      <section className={styles.heroSection}>
        <div
          className={styles.sceneHero}
          style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
        >
          {!scene.imageUrl && <div className={styles.heroCinematicBg} />}
          <div className={styles.heroGrain} />
          <div className={styles.heroVignette} />
          <div className={styles.heroDarkGrad} />

          <div className={styles.heroTop}>
            <span className={styles.heroLocationTag}>HONG KONG · TODAY</span>
          </div>

          <div className={styles.heroBottom}>
            <span className={styles.heroCategoryEyebrow}>{scene.category?.toUpperCase() ?? 'SCENE'}</span>
            <h2 className={styles.heroTitle}>{scene.title}</h2>
            <div className={styles.heroPills}>
              <span className={styles.heroPill}>{totalLines} phrases</span>
              <span className={styles.heroPill}>{duration} min</span>
              {sceneDue > 0 && <span className={styles.heroPill}>🔁 {sceneDue} to review</span>}
            </div>
          </div>
        </div>
      </section>
      <button className={styles.continueSection} onClick={handleBtn}>
        <div className={styles.continueEyebrow}>
          <span className={styles.continueLabel}>{dueCount > 0 ? 'REVIEW DUE' : 'START SESSION'}</span>
          <span className={styles.continueArrow}>→</span>
        </div>
        <p className={styles.continueTitle}>
          {dueCount > 0 ? `Review ${dueCount} due phrases` : scene.title}
        </p>
      </button>
    </>
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

function PlaylistRow({ scenes, onNavigate }) {
  return (
    <section className={styles.rowSection}>
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
                style={{ backgroundImage: first?.imageUrl ? `url(${first.imageUrl})` : undefined }}
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
    { label: 'Tone Gym',  desc: 'Train your ear',  bg: '#D6E0D4', route: 'tonegym',  emoji: '🎵' },
    { label: 'Free Chat', desc: 'AI conversation',  bg: '#F2DDD9', route: 'ai-scenario', emoji: '💬' },
    { label: 'Speed Run', desc: 'Beat the clock',   bg: '#F2DDD9', route: 'speedrun', emoji: '⚡' },
  ];
  return (
    <section className={styles.practiceSection}>
      {sessions.map(s => (
        <button key={s.route} className={styles.practiceRow} onClick={() => onNavigate(s.route)}>
          <div className={styles.practiceIcon} style={{ background: s.bg }}>
            <span>{s.emoji}</span>
          </div>
          <div className={styles.practiceText}>
            <span className={styles.practiceLabel}>{s.label}</span>
            <span className={styles.practiceDesc}>{s.desc}</span>
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
          <button className={styles.personalShadowBtn} onClick={() => onNavigate('introduce-yourself')}>
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

function StreakRiskBanner({ count, onNavigate }) {
  return (
    <div className={styles.riskBanner}>
      <span className={styles.riskIcon}>🔥</span>
      <div className={styles.riskText}>
        <span className={styles.riskTitle}>Your {count}-day streak is at risk</span>
        <span className={styles.riskSub}>3 phrases = streak saved</span>
      </div>
      <button className={styles.riskBtn} onClick={() => onNavigate('shadow')}>
        Save it →
      </button>
    </div>
  );
}

function Quick3Pill({ onNavigate }) {
  return (
    <div className={styles.quick3Wrap}>
      <button className={styles.quick3Pill} onClick={() => onNavigate('shadow', '__quick3__')}>
        Short on time? Do 3 phrases →
      </button>
    </div>
  );
}

function StreakCelebration({ count, onDismiss }) {
  return (
    <div className={styles.celebOverlay}>
      <div className={styles.celebModal}>
        <div className={styles.celebEmoji}>🔥</div>
        <div className={styles.celebNum}>{count}</div>
        <p className={styles.celebTitle}>
          {count >= 100 ? 'Legendary streak!' : count >= 60 ? 'Incredible!' : count >= 30 ? 'On fire!' : count >= 14 ? 'Two weeks strong!' : 'One week done!'}
        </p>
        <p className={styles.celebSub}>{count}-day streak. You're building a real habit.</p>
        <button className={styles.celebBtn} onClick={onDismiss}>Keep going →</button>
      </div>
    </div>
  );
}

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--fg-2)' }}>
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
