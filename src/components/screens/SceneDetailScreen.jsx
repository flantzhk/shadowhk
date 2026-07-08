import { useState, useEffect, useRef } from 'react';
import styles from './SceneDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseRow } from '../ui/PhraseRow.jsx';
import { NpcAvatar, UserAvatar } from '../ui/ConversationAvatars.jsx';
import { getSceneById } from '../../services/sceneLoader.js';
import {
  getLibraryEntry, saveLibraryEntry, removeLibraryEntry, getAllSceneProgress, saveSceneProgress,
  getLibraryEntriesByScene, saveCachedAudio, getCachedAudio,
} from '../../services/storage.js';
import { getCurrentUser } from '../../services/auth.js';
import { phCapture } from '../../services/posthog.js';
import { textToSpeech, generatePhrase } from '../../services/api.js';
import { staticWordAudio, prefetchWordAudio } from '../../services/staticAudio.js';
import { SOURCE_TAGS, GROWTH_STATE } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

const vocabWordId = (sceneId, chinese) => `${sceneId}-vocab-${chinese}`;

// Scene-specific framing for the "add your own phrase" prompt — a generic
// "type anything" invite gets ignored; naming what people actually come to
// this scene wanting to say gets used.
const ADD_PHRASE_PROMPTS = {
  transport: 'Need to say something specific to get around? Type it below.',
  food: 'Want to order or ask for something specific here? Type it below.',
  services: 'Need to explain something specific for this errand? Type it below.',
  social: 'Want to say something specific to someone here? Type it below.',
  festivals: 'Want to say something specific for this occasion? Type it below.',
};
function addPhrasePrompt(category) {
  return ADD_PHRASE_PROMPTS[category] ?? 'Want to learn how to say something specific in this scene? Type it below.';
}

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

  // User-authored phrases added to this scene (see "Add your own phrase"
  // below) — stored as ordinary library entries tagged `is_custom`, merged
  // in here at render time since scenes themselves are static JSON.
  const [customLines, setCustomLines] = useState([]);
  const [showAddPhrase, setShowAddPhrase] = useState(false);
  const [addText, setAddText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [addError, setAddError] = useState(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [retryingAudioId, setRetryingAudioId] = useState(null);

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

    getLibraryEntriesByScene(sceneId).then(async entries => {
      const custom = entries
        .filter(e => e.is_custom)
        .sort((a, b) => (a._createdAt ?? 0) - (b._createdAt ?? 0));
      // Check the actual cache rather than trusting a stored flag — the
      // cache is the source of truth and can be cleared independently of
      // the library entry (e.g. browser storage pressure).
      const withAudioState = await Promise.all(custom.map(async e => ({
        id: e.phraseId,
        cjk: e.cjk,
        romanization: e.romanization,
        english: e.english,
        audioCached: !!(await getCachedAudio(e.phraseId).catch(() => null)),
      })));
      setCustomLines(withAudioState);
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

  async function handleGenerateCustomPhrase() {
    if (!addText.trim()) return;
    setGenerating(true);
    setAddError(null);
    setGenerated(null);
    try {
      const result = await generatePhrase(addText.trim(), language);
      setGenerated(result);
    } catch (_) {
      setAddError('Could not generate that phrase. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveCustomPhrase() {
    if (!generated) return;
    setSavingCustom(true);
    setAddError(null);
    const phraseId = `${sceneId}-custom-${crypto.randomUUID()}`;
    let audioCached = false;
    try {
      // Generate + cache audio up front so it plays offline. Non-fatal if it
      // fails — the phrase still saves, and the row below shows a retry
      // affordance instead of silently needing network again on next play.
      try {
        const blob = await textToSpeech(generated.cjk, { language });
        await saveCachedAudio(phraseId, blob);
        audioCached = true;
      } catch (_) { /* row will show "audio not downloaded" with a retry button */ }

      await saveLibraryEntry({
        phraseId,
        cjk: generated.cjk,
        romanization: generated.romanization,
        english: generated.english,
        language,
        scene_id: sceneId,
        source_tag: SOURCE_TAGS.MINE,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        practiceCount: 0,
        nextReviewAt: Date.now(),
        lastPracticedAt: null,
        lived_at: null,
        cultural_note: generated.culturalNote ?? null,
        is_custom: true,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });

      setCustomLines(prev => [...prev, {
        id: phraseId, cjk: generated.cjk, romanization: generated.romanization, english: generated.english, audioCached,
      }]);
      setAddText('');
      setGenerated(null);
      setShowAddPhrase(false);
    } catch (_) {
      setAddError('Failed to save. Try again.');
    } finally {
      setSavingCustom(false);
    }
  }

  async function removeCustomPhrase(id) {
    await removeLibraryEntry(id).catch(() => {});
    setCustomLines(prev => prev.filter(l => l.id !== id));
  }

  async function retryAudioCache(line) {
    setRetryingAudioId(line.id);
    try {
      const blob = await textToSpeech(line.cjk, { language });
      await saveCachedAudio(line.id, blob);
      setCustomLines(prev => prev.map(l => l.id === line.id ? { ...l, audioCached: true } : l));
    } catch (_) {
      // Leave audioCached false — the retry button stays put for another try.
    } finally {
      setRetryingAudioId(null);
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
            title={sceneSaved ? 'Saved: shows up in your Saved tab' : 'Bookmark this scene in your Saved tab'}
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

      {/* Your own phrases — user-authored additions scoped to this scene */}
      <section className={styles.culturalSection}>
        <div className={styles.culturalDivider}>
          <span className={styles.culturalDividerDash}>—</span>
          <span className={styles.culturalDividerLabel}>YOUR PHRASES</span>
        </div>

        {customLines.length > 0 && (
          <div className={styles.customPhraseList}>
            {customLines.map(line => (
              <div key={line.id} className={styles.customPhraseItem}>
                <PhraseRow
                  phraseId={line.id}
                  jyutping={line.romanization}
                  english={line.english}
                  chinese={line.cjk}
                  size="md"
                  saved={true}
                  onHeartToggle={() => removeCustomPhrase(line.id)}
                />
                {!line.audioCached && (
                  <div className={styles.audioMissingBar}>
                    <span className={styles.audioMissingText}>
                      {retryingAudioId === line.id
                        ? 'Downloading audio…'
                        : '⚠ Audio not downloaded, needs a connection once to work offline'}
                    </span>
                    {retryingAudioId !== line.id && (
                      <button className={styles.audioMissingRetry} onClick={() => retryAudioCache(line)}>
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!showAddPhrase ? (
          <button className={styles.addPhraseTrigger} onClick={() => setShowAddPhrase(true)}>
            <span className={styles.addPhraseIcon}>+</span>
            <span className={styles.addPhraseTriggerText}>
              <span className={styles.addPhraseTitle}>Add your own phrase</span>
              <span className={styles.addPhraseHint}>{addPhrasePrompt(scene.category)}</span>
            </span>
          </button>
        ) : (
          <div className={styles.addPhrasePanel}>
            <input
              className={styles.addPhraseInput}
              placeholder="e.g. Please stop at the bus stop right ahead"
              value={addText}
              onChange={e => { setAddText(e.target.value); setGenerated(null); setAddError(null); }}
              autoFocus
            />

            {addError && <p className={styles.addPhraseError}>{addError}</p>}

            {!generated ? (
              <div className={styles.addPhraseActions}>
                <button
                  className={styles.addPhraseCancel}
                  onClick={() => { setShowAddPhrase(false); setAddText(''); setGenerated(null); setAddError(null); }}
                >
                  Cancel
                </button>
                <button
                  className={styles.addPhraseGenerate}
                  onClick={handleGenerateCustomPhrase}
                  disabled={!addText.trim() || generating}
                >
                  {generating ? 'Translating…' : 'Translate'}
                </button>
              </div>
            ) : (
              <div className={styles.addPhrasePreview}>
                <p className={styles.addPhrasePreviewRoman}>{generated.romanization}</p>
                <p className={styles.addPhrasePreviewCjk}>{generated.cjk}</p>
                <p className={styles.addPhrasePreviewEnglish}>{generated.english}</p>
                {generated.culturalNote && (
                  <p className={styles.addPhrasePreviewNote}>{generated.culturalNote}</p>
                )}
                <div className={styles.addPhraseActions}>
                  <button className={styles.addPhraseCancel} onClick={() => setGenerated(null)}>
                    Try again
                  </button>
                  <button className={styles.addPhraseSave} onClick={handleSaveCustomPhrase} disabled={savingCustom}>
                    {savingCustom ? 'Saving…' : 'Save to this scene'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

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
                          aria-label={`Play ${w.chinese}: ${w.english}`}
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

