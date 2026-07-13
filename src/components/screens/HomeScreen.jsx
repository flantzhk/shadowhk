import { useState, useEffect, useRef } from 'react';
import styles from './HomeScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { buildSceneLesson } from '../../services/lessonBuilder.js';
import { getLibraryEntries, getAllSceneProgress, getDueEntries } from '../../services/storage.js';
import { isAuthenticated } from '../../services/auth.js';
import { staticWordAudio } from '../../services/staticAudio.js';
import { getAllScenes } from '../../services/sceneLoader.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { STREAK_MILESTONES } from '../../utils/constants.js';
import { ConfirmModal } from '../shared/ConfirmModal.jsx';
import DownloadAllModal from '../shared/DownloadAllModal';

const OFFLINE_PROMPT_KEY = 'shadowhk_offline_prompt_done';

function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomeScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalPhraseCount, setPersonalPhraseCount] = useState(null);
  const [personalSample, setPersonalSample] = useState(null);
  const [realWorldCount, setRealWorldCount] = useState(0);
  const [allScenes, setAllScenes] = useState([]);
  const [sceneProgress, setSceneProgress] = useState({});
  const [dueCount, setDueCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);
  // One-time offer to cache all audio for offline use. Skipped while offline
  // (the download can't run) so it re-offers on the next online visit.
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(
    () => navigator.onLine && !localStorage.getItem(OFFLINE_PROMPT_KEY)
  );
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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

  const dismissOfflinePrompt = (startDownload) => {
    localStorage.setItem(OFFLINE_PROMPT_KEY, '1');
    setShowOfflinePrompt(false);
    if (startDownload) setShowDownloadModal(true);
  };

  useEffect(() => {
    buildSceneLesson(language).then(setLesson).catch(() => setLesson(null)).finally(() => setLoading(false));
    getLibraryEntries(language).then(entries => {
      const personal = entries.filter(e => e.scene_id === PERSONAL_SCENE_ID);
      setPersonalPhraseCount(personal.length);
      setPersonalSample(personal[0] ?? null);
      setRealWorldCount(entries.filter(e => e.lived_at).length);
    }).catch(() => { setPersonalPhraseCount(0); setRealWorldCount(0); });
    getAllScenes(language).then(setAllScenes).catch(() => {});
    getAllSceneProgress().then(records => {
      const map = {};
      for (const p of records) map[p.sceneId] = p;
      setSceneProgress(map);
    }).catch(() => {});
    getDueEntries().then(entries => setDueCount(entries.length)).catch(() => {});
  }, [language]);

  const hasRecentProgress = allScenes.some(s => sceneProgress[s.id]?.lastSessionAt);
  const untriedScenes = allScenes.filter(s => !sceneProgress[s.id]);
  // Signed-out visitors get a pitch, not an empty dashboard: hear the real
  // voice first, then one strong step into a first scene.
  const isGuest = !isAuthenticated();
  let sectionIndex = 0;
  const nextSectionNum = () => String(++sectionIndex).padStart(2, '0');

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

      {showOfflinePrompt && !showMilestone && (
        <ConfirmModal
          title="Practice anywhere, even offline"
          body="Download every recording so the whole app works with no signal, plane included. About 80 MB, best on Wi-Fi. You can always do this later from Settings."
          confirmLabel="Download now"
          cancelLabel="Not now"
          onConfirm={() => dismissOfflinePrompt(true)}
          onCancel={() => dismissOfflinePrompt(false)}
        />
      )}

      {showDownloadModal && (
        <DownloadAllModal language={language} onClose={() => setShowDownloadModal(false)} />
      )}

      {isGuest ? (
        <GuestHero onNavigate={onNavigate} />
      ) : (
        <TodayPanel
          userName={userName}
          streakCount={streakCount}
          streakAtRisk={streakAtRisk}
          realWorldCount={realWorldCount}
          loading={loading}
          lesson={lesson}
          dueCount={dueCount}
          onNavigate={onNavigate}
        />
      )}

      {!isGuest && personalPhraseCount === 0 && (
        <PersonalSceneSetup onNavigate={onNavigate} language={language} />
      )}

      {hasRecentProgress && (
        <>
          <div className={`${styles.sectionBar} ${sectionIndex === 0 ? styles.sectionBarFlush : ''}`}>
            <span className={styles.sectionNum}>{nextSectionNum()}</span>
            <span className={styles.sectionLabel}>Continue</span>
            <button className={styles.sectionSeeAll} onClick={() => onNavigate('scenes')}>ALL →</button>
          </div>
          <ContinueGrid scenes={allScenes} progress={sceneProgress} onNavigate={onNavigate} />
        </>
      )}

      {(allScenes.length > 0 || personalPhraseCount > 0) && (
        <>
          <div className={`${styles.sectionBar} ${sectionIndex === 0 ? styles.sectionBarFlush : ''}`}>
            <span className={styles.sectionNum}>{nextSectionNum()}</span>
            <span className={styles.sectionLabel}>Try next</span>
          </div>
          <TryNextRail
            scenes={untriedScenes}
            personal={personalPhraseCount > 0 ? {
              phraseCount: personalPhraseCount,
              sample: personalSample,
              name: userName,
              photoURL: settings?.photoURL,
            } : null}
            onNavigate={onNavigate}
          />
        </>
      )}

      <div className={`${styles.sectionBar} ${sectionIndex === 0 ? styles.sectionBarFlush : ''}`}>
        <span className={styles.sectionNum}>{nextSectionNum()}</span>
        <span className={styles.sectionLabel}>Quick practice</span>
      </div>
      <PracticeGrid onNavigate={onNavigate} language={language} />

      {isGuest && personalPhraseCount === 0 && (
        <PersonalSceneSetup onNavigate={onNavigate} language={language} />
      )}

      <div className={styles.bottomPad} />
    </div>
  );
}

// Demo phrases for the guest hero. Jyutping matches the reference-set data;
// each has a pre-recorded word audio file in public/audio/cantonese-words/.
const DEMO_PHRASES = [
  { cjk: '唔該', jyutping: 'm4 goi1', gloss: '"Thanks". The most useful word in Hong Kong.' },
  { cjk: '早晨', jyutping: 'zou2 san4', gloss: '"Good morning". How the city greets before noon.' },
  { cjk: '幾多錢', jyutping: 'gei2 do1 cin2', gloss: '"How much?" For the wet market.' },
];

function GuestHero({ onNavigate }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const phrase = DEMO_PHRASES[idx];

  useEffect(() => () => audioRef.current?.pause(), []);

  const handlePlay = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const blob = await staticWordAudio(phrase.cjk);
      if (!blob) throw new Error('no audio');
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      const url = URL.createObjectURL(blob);
      audio.src = url;
      const finish = () => { URL.revokeObjectURL(url); setPlaying(false); };
      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className={styles.todayPanel}>
      <p className={styles.guestEyebrow}>THIS IS WHAT YOU'LL SOUND LIKE</p>
      <p className={styles.guestCjk} lang="yue">{phrase.cjk}</p>
      <p className={styles.guestJyut}>{phrase.jyutping}</p>
      <p className={styles.guestGloss}>{phrase.gloss}</p>
      <button
        className={`${styles.guestPlay} ${playing ? styles.guestPlaying : ''}`}
        onClick={handlePlay}
        aria-label={`Play ${phrase.cjk}`}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
      </button>
      <p className={styles.guestHint}>Tap play. That's a real Hong Kong voice.</p>
      <div className={styles.guestDots}>
        {DEMO_PHRASES.map((p, i) => (
          <button
            key={p.cjk}
            className={`${styles.guestDot} ${i === idx ? styles.guestDotOn : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Show ${p.cjk}`}
          />
        ))}
      </div>
      <button className={styles.guestCta} onClick={() => onNavigate('shadow', 'basic-greetings')}>
        Start your first scene · 4 min
      </button>
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
      <span className={styles.streakLabel}>day streak</span>
    </span>
  );
}

// Greeting, streak-risk state, and today's lesson share one dark panel so
// there's no seam between separately-styled cards for them to crowd against.
function TodayPanel({ userName, streakCount, streakAtRisk, realWorldCount, loading, lesson, dueCount, onNavigate }) {
  return (
    <div className={styles.todayPanel}>
      {(realWorldCount > 0 || streakCount > 0) && (
        <div className={styles.panelLeadRow}>
          {realWorldCount > 0 && (
            <div className={styles.panelLeadStat}>
              <span className={styles.panelLeadLabel}>Said in person</span>
              <span className={styles.panelLeadNum}>{realWorldCount}</span>
            </div>
          )}
          <StreakPill count={streakCount} />
        </div>
      )}
      <h1 className={styles.panelGreetTitle}>
        Hello{userName && <>, <em>{userName}</em></>}.
      </h1>

      {streakAtRisk && (
        <div className={styles.panelRibbon}>
          <span className={styles.panelRibbonText}>🔥 Streak at risk — 3 phrases saves it</span>
          <button className={styles.panelRibbonBtn} onClick={() => onNavigate('shadow')}>Save it →</button>
        </div>
      )}

      {!loading && lesson?.scene && (
        <PanelLesson lesson={lesson} dueCount={dueCount} onNavigate={onNavigate} />
      )}
      {!loading && !lesson && (
        <PanelEmptyLesson onNavigate={onNavigate} />
      )}
    </div>
  );
}

function PanelLesson({ lesson, dueCount, onNavigate }) {
  const { scene } = lesson;

  const handleBegin = () => dueCount > 0 ? onNavigate('shadow') : onNavigate('shadow', scene.id);

  return (
    <button className={styles.panelLesson} onClick={handleBegin}>
      <div
        className={styles.panelThumb}
        style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
      >
        {!scene.imageUrl && <div className={styles.heroCinematicBg} />}
      </div>

      <div className={styles.panelLessonBody}>
        <span className={styles.panelEyebrow}>
          TODAY'S LESSON
          {dueCount > 0 && (
            <span className={styles.panelDuePill}>{dueCount} due</span>
          )}
        </span>
        <h2 className={styles.panelLessonTitle}>{scene.title}</h2>
      </div>

      <span className={styles.panelCta}>
        <span className={styles.panelPlay}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>
        </span>
        Start
      </span>
    </button>
  );
}

function PanelEmptyLesson({ onNavigate }) {
  return (
    <div className={styles.panelEmptyLesson}>
      <p className={styles.panelEmptyText}>Pick your first scenes to get started.</p>
      <button className={styles.panelEmptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
    </div>
  );
}

function ContinueGrid({ scenes, progress, onNavigate }) {
  const recent = scenes
    .filter(s => progress?.[s.id]?.lastSessionAt)
    .sort((a, b) => (progress[b.id]?.lastSessionAt ?? 0) - (progress[a.id]?.lastSessionAt ?? 0))
    .slice(0, 6);

  return (
    <section className={styles.continueSection}>
      <div className={styles.continueGrid}>
        {recent.map(s => {
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

function TryNextRail({ scenes, personal, onNavigate }) {
  if (scenes.length === 0 && !personal) {
    return (
      <section className={styles.tryNextSection}>
        <p className={styles.tryNextEmpty}>You've tried every scene. Nice work.</p>
      </section>
    );
  }

  return (
    <section className={styles.tryNextSection}>
      <div className={styles.tryNextScroll}>
        {personal && (
          <button className={styles.sceneCard} onClick={() => onNavigate('introduce-yourself')}>
            <div
              className={styles.sceneCover}
              style={{ backgroundImage: personal.photoURL ? `url(${personal.photoURL})` : undefined }}
            >
              {!personal.photoURL && <div className={styles.heroCinematicBg} />}
              <span className={styles.sceneMadeForYouTag}>Made for you</span>
              <div className={styles.sceneCoverGrad} />
              <p className={styles.sceneCoverTitle}>
                {personal.name ? `${personal.name}'s personal scene` : 'Your personal scene'}
                <span className={styles.sceneCoverCount}>
                  {personal.phraseCount} {personal.phraseCount === 1 ? 'phrase' : 'phrases'}
                </span>
              </p>
            </div>
            {personal.sample && (
              <p className={styles.sceneSub}>"{personal.sample.cjk}": {personal.sample.english}</p>
            )}
          </button>
        )}
        {scenes.slice(0, personal ? 7 : 8).map(s => (
          <button key={s.id} className={styles.sceneCard} onClick={() => onNavigate('scene', s.id)}>
            <div
              className={styles.sceneCover}
              style={{ backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined }}
            >
              {!s.imageUrl && <span className={styles.sceneCoverEmoji}>{s.emoji}</span>}
              <div className={styles.sceneCoverGrad} />
              {s.estimatedMinutes && <span className={styles.sceneChip}>{s.estimatedMinutes} min</span>}
              <p className={styles.sceneCoverTitle}>{s.title}</p>
            </div>
            {s.description && <p className={styles.sceneSub}>{s.description}</p>}
          </button>
        ))}
      </div>
    </section>
  );
}

function PracticeGrid({ onNavigate, language }) {
  const modes = [
    { label: 'TONE GYM',        sub: 'Ear training',        route: 'tonegym',        fill: 'tonegym' },
    { label: 'FREE CHAT',       sub: 'Open conversation',   route: 'ai-scenario',    fill: 'freechat' },
    { label: 'SPEED RUN',       sub: 'Drills',               route: 'speedrun',       fill: 'speedrun' },
    { label: language === 'mandarin' ? 'READ PINYIN' : 'READ JYUTPING', sub: 'Tones & sounds', route: 'jyutping-guide', fill: 'jyutping', star: true },
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

function PersonalSceneSetup({ onNavigate, language }) {
  return (
    <section className={styles.personalSection}>
      <button className={styles.personalEmpty} onClick={() => onNavigate('introduce-yourself')}>
        <span className={styles.personalEmptyEmoji}>👋</span>
        <div className={styles.personalEmptyText}>
          <p className={styles.personalEmptyTitle}>Introduce yourself in {language === 'mandarin' ? 'Mandarin' : 'Cantonese'}</p>
          <p className={styles.personalEmptyDesc}>Tell us your name, job, and a bit about your life, we'll build you a custom scene to shadow.</p>
        </div>
        <span className={styles.personalEmptyArrow}>Set it up →</span>
      </button>
    </section>
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

