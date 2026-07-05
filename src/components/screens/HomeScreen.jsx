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


export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalPhraseCount, setPersonalPhraseCount] = useState(null);
  const [personalSample, setPersonalSample] = useState(null);
  const [allScenes, setAllScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});
  const [dueCount, setDueCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);

  const language = settings?.currentLanguage ?? 'cantonese';
  const userName = settings?.name ?? '';
  const streakCount = settings?.streakCount ?? 0;
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
      const personal = entries.filter(e => e.scene_id === PERSONAL_SCENE_ID);
      setPersonalPhraseCount(personal.length);
      setPersonalSample(personal[0] ?? null);
    }).catch(() => setPersonalPhraseCount(0));
    getAllScenes(language).then(setAllScenes).catch(() => {});
    getAllSceneProgress().then(records => {
      const map = {};
      for (const p of records) map[p.sceneId] = p;
      setSceneProgress(map);
    }).catch(() => {});
    getDueEntries().then(entries => setDueCount(entries.length)).catch(() => {});
  }, [language]);

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
        <div className={styles.greetingRow}>
          <StreakPill count={streakCount} />
        </div>
        <h1 className={styles.greetingTitle}>
          Hello{userName && <>, <em>{userName}</em></>}.
        </h1>
      </header>

      {streakAtRisk && <StreakRiskBanner count={streakCount} onNavigate={onNavigate} />}

      {!loading && lesson?.scene && (
        <TodaySceneHero lesson={lesson} dueCount={dueCount} onNavigate={onNavigate} />
      )}
      {!loading && !lesson && (
        <EmptyHero onNavigate={onNavigate} />
      )}

      {personalPhraseCount !== null && (
        <PersonalSceneCard
          phraseCount={personalPhraseCount}
          sample={personalSample}
          name={userName}
          onNavigate={onNavigate}
        />
      )}

      {allScenes.length > 0 && (
        <>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>01</span>
            <span className={styles.sectionLabel}>Continue</span>
            <button className={styles.sectionSeeAll} onClick={() => onNavigate('scenes')}>ALL →</button>
          </div>
          <ContinueGrid scenes={allScenes} progress={sceneProgress} onNavigate={onNavigate} />
        </>
      )}

      <div className={styles.sectionBar}>
        <span className={styles.sectionNum}>02</span>
        <span className={styles.sectionLabel}>Playlists for you</span>
      </div>
      <PlaylistsRail scenes={allScenes} onNavigate={onNavigate} />

      <div className={styles.sectionBar}>
        <span className={styles.sectionNum}>03</span>
        <span className={styles.sectionLabel}>Quick practice</span>
      </div>
      <PracticeGrid onNavigate={onNavigate} />

      <div className={styles.bottomPad} />
    </div>
  );
}

function StreakPill({ count }) {
  if (!count) return null;
  return (
    <span className={styles.streakPill}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c1 3-1 4-1 6.5 0 1.5 1 2.5 2 2.5s2-1 1.5-2.5c2 1.5 3 4 3 6.5a5.5 5.5 0 1 1-11 0c0-2 1-4 2.5-5.5C10.5 8 11 5 12 2z"/>
      </svg>
      <span className={styles.streakNum}>{count}</span>
    </span>
  );
}

function TodaySceneHero({ lesson, dueCount, onNavigate }) {
  const { scene } = lesson;

  const handleBegin = () => dueCount > 0 ? onNavigate('shadow') : onNavigate('shadow', scene.id);

  return (
    <div className={styles.todayCard}>
      <div
        className={styles.todayPhoto}
        style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
      >
        {!scene.imageUrl && <div className={styles.heroCinematicBg} />}
        <div className={styles.todayPhotoGrad} />
        <div className={styles.todayBadge}>
          <span className={styles.todayBadgeDot} />
          <span className={styles.todayBadgeText}>TODAY'S LESSON</span>
        </div>
        {dueCount > 0 && <div className={styles.todayDueBadge}>{dueCount} DUE</div>}
        <h2 className={styles.todayPhotoTitle}>{scene.title}</h2>
      </div>

      {dueCount > 0 && (
        <div className={styles.todayNote}>
          Starts with <b>{dueCount} {dueCount === 1 ? 'phrase' : 'phrases'} due for review</b> before today's new scene
        </div>
      )}

      <button className={styles.todayBeginBtn} onClick={handleBegin}>
        <span className={styles.todayBeginLeft}>
          <span className={styles.todayBeginPlay}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>
          </span>
          Start Today's Lesson
        </span>
      </button>
    </div>
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

function ContinueGrid({ scenes, progress, onNavigate }) {
  const recent = scenes
    .filter(s => progress?.[s.id]?.lastSessionAt)
    .sort((a, b) => (progress[b.id]?.lastSessionAt ?? 0) - (progress[a.id]?.lastSessionAt ?? 0))
    .slice(0, 6);

  const cards = recent.length > 0 ? recent : scenes.slice(0, 6);

  return (
    <section className={styles.continueSection}>
      <div className={styles.continueGrid}>
        {cards.map(s => {
          const pct = progress[s.id]?.masteryPct ?? 0;
          return (
            <button key={s.id} className={styles.continueCard} onClick={() => onNavigate('scene', s.id)}>
              <div
                className={styles.continueThumb}
                style={{ backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined }}
              >
                {!s.imageUrl && <span className={styles.continueEmoji}>{s.emoji}</span>}
              </div>
              <div className={styles.continueBody}>
                <p className={styles.continueTitle}>{s.title}</p>
                <div className={styles.continueMeta}>
                  <span className={styles.continueBar}>
                    <span className={styles.continueFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.continuePct}>{Math.round(pct)}% mastered</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PlaylistsRail({ scenes, onNavigate }) {
  return (
    <section className={styles.playlistsSection}>
      <div className={styles.playlistsScroll}>
        {PLAYLISTS.map(playlist => {
          const playlistScenes = playlist.sceneIds
            .map(id => scenes.find(s => s.id === id))
            .filter(Boolean);
          const first = playlistScenes[0];

          return (
            <button
              key={playlist.id}
              className={styles.playlistCard}
              onClick={() => first ? onNavigate('scene', first.id) : onNavigate('scenes')}
            >
              <div
                className={`${styles.playlistCover} ${styles[`playlistFill_${playlist.id}`] ?? ''}`}
                style={{ backgroundImage: first?.imageUrl ? `url(${first.imageUrl})` : undefined }}
              >
                <div className={styles.playlistCoverGrad} />
                <span className={styles.playlistChip}>{playlist.sceneIds.length} scenes</span>
                <p className={styles.playlistCoverTitle}>{playlist.label}</p>
              </div>
              <p className={styles.playlistSub}>{playlist.desc}</p>
              {first && (
                <p className={styles.playlistStarts}>Starts with <b>{first.title}</b></p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PracticeGrid({ onNavigate }) {
  const modes = [
    { label: 'TONE GYM',        sub: 'Ear training',        route: 'tonegym',        fill: 'tonegym' },
    { label: 'FREE CHAT',       sub: 'Open conversation',   route: 'ai-scenario',    fill: 'freechat' },
    { label: 'SPEED RUN',       sub: 'Drills',               route: 'speedrun',       fill: 'speedrun' },
    { label: 'READ JYUTPING',   sub: 'Tones & sounds',       route: 'jyutping-guide', fill: 'jyutping', star: true },
  ];
  return (
    <div className={styles.practiceGrid}>
      {modes.map((m) => (
        <button
          key={m.route}
          className={`${styles.practiceCell} ${styles[`practiceFill_${m.fill}`]}`}
          onClick={() => onNavigate(m.route)}
        >
          <span className={styles.practiceCellBadge}>{m.star ? '★ NEW' : '◆ DRILL'}</span>
          <span className={styles.practiceCellLabel}>{m.label}</span>
          <span className={styles.practiceCellSub}>{m.sub}</span>
        </button>
      ))}
    </div>
  );
}

function PersonalSceneCard({ phraseCount, sample, name, onNavigate }) {
  if (phraseCount > 0) {
    const initial = name ? name.trim().charAt(0).toUpperCase() : 'U';
    return (
      <section className={styles.personalSection}>
        <button className={styles.madeForYou} onClick={() => onNavigate('introduce-yourself')}>
          <span className={styles.madeForYouAvatar}>{initial}</span>
          <div className={styles.madeForYouBody}>
            <span className={styles.madeForYouEyebrow}>Made for you · {phraseCount} {phraseCount === 1 ? 'phrase' : 'phrases'}</span>
            <p className={styles.madeForYouTitle}>{name ? `${name}'s personal scene` : 'Your personal scene'}</p>
            {sample && (
              <p className={styles.madeForYouSample}>"{sample.cjk}" — {sample.english}</p>
            )}
          </div>
          <span className={styles.madeForYouGo}>Shadow →</span>
        </button>
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

