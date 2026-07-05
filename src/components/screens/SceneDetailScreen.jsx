import { useState, useEffect, useRef } from 'react';
import styles from './SceneDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseRow } from '../ui/PhraseRow.jsx';
import { NpcAvatar, UserAvatar } from '../ui/ConversationAvatars.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import { getLibraryEntry, saveLibraryEntry, removeLibraryEntry, getAllSceneProgress, saveSceneProgress } from '../../services/storage.js';
import { getCurrentUser } from '../../services/auth.js';
import { phCapture } from '../../services/posthog.js';
import { textToSpeech } from '../../services/api.js';
import { staticWordAudio, prefetchWordAudio } from '../../services/staticAudio.js';
import { SOURCE_TAGS, GROWTH_STATE } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

const vocabWordId = (sceneId, chinese) => `${sceneId}-vocab-${chinese}`;

export default function SceneDetailScreen({ sceneId, onNavigate, onBack }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const authUser = getCurrentUser();
  const userPhoto = authUser?.photoURL ?? null;
  const userName = authUser?.name ?? settings?.name ?? 'You';

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [sceneSaved, setSceneSaved] = useState(false);
  const [masteryPct, setMasteryPct] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [allSaved, setAllSaved] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    if (!sceneId) return;
    phCapture('scene_viewed', { scene_id: sceneId, language });
    getSceneById(sceneId)
      .then(async s => {
        setScene(s);
        const ids = new Set();
        for (const line of s.lines ?? []) {
          const entry = await getLibraryEntry(line.id).catch(() => null);
          if (entry) ids.add(line.id);
        }
        const vocabWords = s.vocabulary?.flatMap(g => g.words ?? []) ?? [];
        for (const w of vocabWords) {
          const entry = await getLibraryEntry(vocabWordId(sceneId, w.chinese)).catch(() => null);
          if (entry) ids.add(vocabWordId(sceneId, w.chinese));
        }
        setSavedIds(ids);
        if (vocabWords.length) prefetchWordAudio(vocabWords);
      })
      .catch(err => logger.error('[SceneDetail] scene load failed', err?.message))
      .finally(() => setLoading(false));

    getAllSceneProgress().then(records => {
      const p = records.find(r => r.sceneId === sceneId);
      if (p) {
        setMasteryPct(p.masteryPct ?? 0);
        setSceneSaved(p.bookmarked ?? false);
      }
    }).catch(() => {});
  }, [sceneId]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [scene]);

  function buildVocabEntry(word) {
    return {
      phraseId: vocabWordId(sceneId, word.chinese),
      cjk: word.chinese,
      romanization: word.jyutping,
      english: word.english,
      language,
      scene_id: sceneId,
      source_tag: SOURCE_TAGS.LIBRARY,
      growth_state: GROWTH_STATE.NEW,
      interval: 0,
      easeFactor: 2.5,
      practiceCount: 0,
      nextReviewAt: Date.now(),
      lastPracticedAt: null,
      lived_at: null,
      _createdAt: Date.now(),
      _updatedAt: Date.now(),
    };
  }

  async function toggleSaveVocabWord(word) {
    const id = vocabWordId(sceneId, word.chinese);
    if (savedIds.has(id)) {
      await removeLibraryEntry(id).catch(() => {});
      setSavedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      await saveLibraryEntry(buildVocabEntry(word)).catch(() => {});
      setSavedIds(prev => new Set(prev).add(id));
    }
  }

  function buildLineEntry(line) {
    return {
      phraseId: line.id,
      cjk: line.cjk,
      romanization: line.romanization,
      english: line.english,
      language,
      scene_id: sceneId,
      source_tag: SOURCE_TAGS.LIBRARY,
      growth_state: GROWTH_STATE.NEW,
      interval: 0,
      easeFactor: 2.5,
      practiceCount: 0,
      nextReviewAt: Date.now(),
      lastPracticedAt: null,
      lived_at: null,
      _createdAt: Date.now(),
      _updatedAt: Date.now(),
    };
  }

  async function saveAllLines() {
    for (const line of (scene.lines ?? [])) {
      if (!savedIds.has(line.id)) {
        await saveLibraryEntry(buildLineEntry(line)).catch(() => {});
      }
    }
    setSavedIds(new Set((scene.lines ?? []).map(l => l.id)));
    setAllSaved(true);
    setTimeout(() => setAllSaved(false), 2000);
  }

  async function toggleSaveLine(line) {
    if (savedIds.has(line.id)) {
      await removeLibraryEntry(line.id).catch(() => {});
      setSavedIds(prev => { const next = new Set(prev); next.delete(line.id); return next; });
    } else {
      await saveLibraryEntry(buildLineEntry(line)).catch(() => {});
      setSavedIds(prev => new Set(prev).add(line.id));
    }
  }

  if (loading) {
    return <div className={styles.screen}><div className={styles.loadingBar} /></div>;
  }

  if (!scene) {
    return (
      <div className={styles.screen}>
        <div className={styles.error}>
          <p>Scene not found.</p>
          <button onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  const youLineCount = scene.lines?.length ?? 0;

  return (
    <div className={styles.screen}>
      {/* Sticky header (fades in on scroll) */}
      <div className={`${styles.stickyHeader} ${headerVisible ? styles.stickyHeaderVisible : ''}`}>
        <button className={styles.backPill} onClick={onBack}>
          <BackArrow /> Back
        </button>
        <span className={styles.stickyTitle}>{scene.title}</span>
      </div>

      {/* Hero */}
      <div
        ref={heroRef}
        className={styles.hero}
        style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : undefined }}
      >
        <div
          className={styles.heroTint}
          style={{ background: `linear-gradient(160deg, rgba(61, 20, 23, 0.35) 0%, transparent 50%)` }}
        />
        <div className={styles.heroDark} />
        <div className={styles.heroContent}>
          <button className={styles.backBtnHero} onClick={onBack}><BackArrow /> Back</button>
          <div className={styles.heroMeta}>
            <span className={styles.heroEyebrow}>{(scene.category ?? 'scene').toUpperCase()} SCENE</span>
            <h1 className={styles.heroTitle}>{scene.title}</h1>
            <p className={styles.heroDesc}>{youLineCount} phrases · {scene.estimatedMinutes ?? 5} min</p>
          </div>
        </div>
      </div>

      {/* Cultural note — sage green editorial card */}
      {(scene.cultural_note || scene.culturalFact || scene.description) && (
        <section className={styles.culturalSection}>
          <div className={styles.culturalDivider}>
            <span className={styles.culturalDividerDash}>—</span>
            <span className={styles.culturalDividerLabel}>CULTURAL NOTE</span>
          </div>
          <div className={styles.culturalCard}>
            <p className={styles.culturalEyebrow}>DID YOU KNOW?</p>
            <p className={styles.culturalText}>{scene.cultural_note ?? scene.culturalFact ?? scene.description}</p>
          </div>
        </section>
      )}

      {/* Vocabulary — key HK-specific terms for this scene */}
      {scene.vocabulary?.length > 0 && (
        <VocabSection
          groups={scene.vocabulary}
          language={language}
          sceneId={sceneId}
          savedIds={savedIds}
          onToggleSave={toggleSaveVocabWord}
        />
      )}

      {/* Controls row — labelled chips so heart vs plus is self-explanatory */}
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <button
            className={`${styles.heartBtn} ${sceneSaved ? styles.heartSaved : ''}`}
            onClick={async () => {
              const next = !sceneSaved;
              setSceneSaved(next);
              const existing = await getAllSceneProgress().then(r => r.find(p => p.sceneId === sceneId)).catch(() => null);
              await saveSceneProgress({ ...(existing ?? { sceneId, language, sessionCount: 0, masteryPct: 0 }), bookmarked: next }).catch(() => {});
            }}
            aria-label={sceneSaved ? 'Remove scene from saved' : 'Save scene'}
            title={sceneSaved ? 'Saved — shows up in your Saved tab' : 'Bookmark this scene in your Saved tab'}
          >
            {sceneSaved ? '♥' : '♡'} <span className={styles.controlLabel}>{sceneSaved ? 'Scene saved' : 'Save scene'}</span>
          </button>
          <button
            className={`${styles.controlBtn} ${allSaved ? styles.controlBtnSaved : ''}`}
            onClick={saveAllLines}
            aria-label="Add all phrases to your phrasebook"
            title="Add every phrase in this scene to your Library for spaced-repetition review"
          >
            {allSaved ? '✓' : '+'} <span className={styles.controlLabel}>{allSaved ? 'Added' : 'Add all phrases'}</span>
          </button>
          {navigator.share && (
            <button
              className={styles.controlBtn}
              onClick={() => navigator.share({
                title: scene.title,
                text: `Practice "${scene.title}" in ShadowHK`,
                url: `${window.location.origin}${import.meta.env.BASE_URL}#scene/${sceneId}`,
              }).catch(() => {})}
              aria-label="Share scene"
              title="Share a link to this scene"
            >
              ↗ <span className={styles.controlLabel}>Share</span>
            </button>
          )}
          <button
            className={styles.controlBtn}
            onClick={() => onNavigate('dialogue', sceneId)}
            title="Practice this scene as a scripted back-and-forth conversation instead of shadowing line by line"
            aria-label="Practice as a scripted conversation"
          >
            💬 <span className={styles.controlLabel}>Dialogue mode</span>
          </button>
        </div>
      </div>

      {/* Mastery bar */}
      {masteryPct > 0 && (
        <div className={styles.masterySection}>
          <div className={styles.masteryBar}>
            <div
              className={styles.masteryFill}
              style={{ width: `${masteryPct}%`, background: `linear-gradient(90deg, var(--fg-1), var(--accent))` }}
            />
          </div>
          <span className={styles.masteryLabel}>{Math.round(masteryPct)}% mastered</span>
        </div>
      )}

      {/* Conversation thread */}
      <div className={styles.chatThread}>
        {(scene.lines ?? []).map((line, i) => {
          const isYou = line.speaker === 'you';
          const prevSpeaker = i > 0 ? scene.lines[i - 1].speaker : null;
          const showAvatar = line.speaker !== prevSpeaker;
          return (
            <div key={line.id} className={isYou ? styles.youRow : styles.npcRow}>
              {!isYou && (
                <div className={styles.avatarSlot}>
                  {showAvatar ? <NpcAvatar scene={scene} /> : <div className={styles.avatarSpacer} />}
                </div>
              )}
              <div className={isYou ? styles.youBubble : styles.npcBubble}>
                <PhraseRow
                  phraseId={line.id}
                  words={line.words}
                  jyutping={line.romanization}
                  english={line.english}
                  chinese={line.cjk}
                  size="md"
                  saved={savedIds.has(line.id)}
                  onHeartToggle={() => toggleSaveLine(line)}
                />
              </div>
              {isYou && (
                <div className={styles.avatarSlot}>
                  {showAvatar ? <UserAvatar photoURL={userPhoto} name={userName} /> : <div className={styles.avatarSpacer} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky CTA bar — sublabels explain the two practice modes */}
      <div className={styles.ctaBar}>
        <button className={styles.ctaSecondary} onClick={() => onNavigate('listen', sceneId)}>
          <span>🔊 Listen</span>
          <span className={styles.ctaSub}>Hands-free, just hear it</span>
        </button>
        <button className={styles.ctaPrimary} onClick={() => onNavigate('shadow', sceneId)}>
          <span>▶ Shadow this</span>
          <span className={styles.ctaSub}>Speak each line, get scored</span>
        </button>
      </div>
    </div>
  );
}

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function VocabSection({ groups, language, sceneId, savedIds, onToggleSave }) {
  const [openCategory, setOpenCategory] = useState(groups.length === 1 ? groups[0].category : null);
  const [playingWord, setPlayingWord] = useState(null);
  const [playingCategory, setPlayingCategory] = useState(null);
  const audioRef = useRef(null);
  const stopRequestedRef = useRef(false);

  // Returns a promise that resolves once the word finishes playing (or errors),
  // so playCategory() can await each word in turn instead of firing overlapping clips.
  function playOne(word) {
    return new Promise(async (resolve) => {
      audioRef.current?.pause();
      setPlayingWord(word.chinese);
      try {
        const blob = (await staticWordAudio(word.chinese)) ?? await textToSpeech(word.chinese, { language, turbo: true });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        const done = () => { setPlayingWord(null); URL.revokeObjectURL(url); resolve(); };
        audio.onended = done;
        audio.onerror = done;
        await audio.play();
      } catch {
        setPlayingWord(null);
        resolve();
      }
    });
  }

  async function play(word) {
    if (playingWord === word.chinese) { audioRef.current?.pause(); setPlayingWord(null); return; }
    await playOne(word);
  }

  async function playCategory(group) {
    if (playingCategory === group.category) {
      // stop mid-playlist
      stopRequestedRef.current = true;
      audioRef.current?.pause();
      setPlayingCategory(null);
      setPlayingWord(null);
      return;
    }
    stopRequestedRef.current = false;
    setPlayingCategory(group.category);
    for (const word of group.words) {
      if (stopRequestedRef.current) break;
      await playOne(word);
      if (stopRequestedRef.current) break;
      await new Promise(r => setTimeout(r, 350)); // brief gap between words
    }
    setPlayingCategory(null);
  }

  return (
    <section className={styles.culturalSection}>
      <div className={styles.culturalDivider}>
        <span className={styles.culturalDividerDash}>—</span>
        <span className={styles.culturalDividerLabel}>VOCABULARY</span>
      </div>
      <div className={styles.vocabCategoryList}>
        {groups.map(group => {
          const isOpen = openCategory === group.category;
          return (
            <div key={group.category} className={styles.vocabCategory}>
              <div className={styles.vocabCategoryHeader}>
                <button
                  className={styles.vocabCategoryToggle}
                  onClick={() => setOpenCategory(isOpen ? null : group.category)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.vocabCategoryName}>{group.category}</span>
                  <span className={styles.vocabCategoryCount}>{group.words.length}</span>
                  <span className={`${styles.vocabChevron} ${isOpen ? styles.vocabChevronOpen : ''}`}>▾</span>
                </button>
                <button
                  className={`${styles.vocabPlayAllBtn} ${playingCategory === group.category ? styles.vocabPlayAllBtnActive : ''}`}
                  onClick={() => playCategory(group)}
                  aria-label={playingCategory === group.category ? `Stop playing ${group.category}` : `Play all ${group.words.length} words in ${group.category}`}
                  title={playingCategory === group.category ? 'Stop' : 'Play through every word in this category'}
                >
                  {playingCategory === group.category
                    ? <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>
                    : <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,0 10,5 2,10"/></svg>
                  }
                </button>
              </div>
              {isOpen && (
                <div className={styles.vocabGrid}>
                  {group.words.map(w => {
                    const saved = savedIds?.has(vocabWordId(sceneId, w.chinese));
                    return (
                      <div key={w.chinese} className={`${styles.vocabChip} ${playingWord === w.chinese ? styles.vocabChipActive : ''}`}>
                        <button
                          className={styles.vocabPlayBtn}
                          onClick={() => play(w)}
                          aria-label={`Play ${w.chinese} — ${w.english}`}
                        >
                          {playingWord === w.chinese
                            ? <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>
                            : <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,0 10,5 2,10"/></svg>
                          }
                        </button>
                        <span className={styles.vocabBody}>
                          <span className={styles.vocabCjk}>{w.chinese}</span>
                          <span className={styles.vocabJyutping}>{w.jyutping}</span>
                          <span className={styles.vocabEnglish}>{w.english}</span>
                        </span>
                        {onToggleSave && (
                          <button
                            className={`${styles.vocabSaveBtn} ${saved ? styles.vocabSaveBtnSaved : ''}`}
                            onClick={() => onToggleSave(w)}
                            aria-label={saved ? `Remove ${w.chinese} from library` : `Save ${w.chinese} to library`}
                            title={saved ? 'Saved to your Library' : 'Add to your Library for spaced-repetition review'}
                          >
                            {saved ? '✓' : '+'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

