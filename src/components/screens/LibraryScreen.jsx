import { useState, useEffect, useRef, Fragment } from 'react';
import styles from './LibraryScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntries, getAllSceneProgress, saveLibraryEntry } from '../../services/storage.js';
import { growthStateFromInterval } from '../../services/sceneLoader.js';
import { getAllScenes } from '../../services/sceneLoader.js';
import { PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { textToSpeech, generatePhrase } from '../../services/api.js';
import { GROWTH_STATE, SOURCE_TAGS } from '../../utils/constants.js';
import { AudioStateIndicator } from '../shared/AudioStateIndicator.jsx';

const GROWTH_METER = {
  new: { filled: 0, color: null, label: 'New' },
  growing: { filled: 1, color: 'var(--amber)', label: 'Growing' },
  strong: { filled: 2, color: 'var(--jade)', label: 'Strong' },
  mastered: { filled: 3, color: 'var(--gold)', label: 'Mastered' },
};

// Every scene has exactly one commissioned photo, shared by every phrase
// saved from it — cycling through a few tasteful grades (not raw random
// hue-rotate, which can clash with the brand's warm palette) keeps repeated
// rows from looking identical without inventing extra imagery. Adjacent
// indices always land on different grades since they differ mod length.
const PHOTO_GRADES = [
  'saturate(1.2) contrast(1.05)',
  'brightness(0.72) contrast(1.3) saturate(1.35) hue-rotate(-15deg)',
  'brightness(1.2) contrast(0.8) saturate(0.55) sepia(0.4)',
  'contrast(1.25) saturate(1.5) hue-rotate(20deg) brightness(0.92)',
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Scene tints are vivid brand accent colours, too bright to read as text —
// darken by a fixed factor so any tint produces legible header text without
// a hardcoded per-scene colour table.
function darkenHex(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

const REFERENCE_SETS = [
  { id: 'survival', title: 'Survival Words', icon: '🆘' },
  { id: 'numbers',  title: 'Numbers', icon: '🔢' },
  { id: 'colours',  title: 'Colours', icon: '🎨' },
  { id: 'calendar', title: 'Calendar', icon: '📅' },
  { id: 'time',     title: 'Telling the Time', icon: '🕐' },
  { id: 'body-parts', title: 'Body Parts', icon: '🧍' },
];

export default function LibraryScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [library, setLibrary] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [savedScenes, setSavedScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  // Which scene groups are expanded — seeded once (Personal + anything with a
  // due phrase open by default) then left alone, so reloads after a quick-add
  // don't silently re-collapse a group the user opened themselves.
  const [openGroups, setOpenGroups] = useState(new Set());
  const groupsSeededRef = useRef(false);
  const [personalAddOpen, setPersonalAddOpen] = useState(false);
  const [personalAddText, setPersonalAddText] = useState('');
  const [personalAddStatus, setPersonalAddStatus] = useState('idle'); // idle | working | error
  // audioState: phraseId -> 'loading' | 'playing' | 'error'. Lets the play
  // button render an AudioStateIndicator that reflects what's actually
  // happening instead of just toggling between play/stop icons.
  const [audioState, setAudioState] = useState({});
  const audioRef = useRef(null);
  const errorTimerRef = useRef(null);

  function setPhraseAudioState(id, state) {
    setAudioState(prev => {
      const next = { ...prev };
      if (state == null) delete next[id];
      else next[id] = state;
      return next;
    });
  }

  function flashError(id) {
    setPhraseAudioState(id, 'error');
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setPhraseAudioState(id, null), 2000);
  }

  function toggleGroup(sceneId) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }

  async function reload() {
    setLoading(true);
    try {
      const [entries, loadedScenes, progress] = await Promise.all([
        getLibraryEntries(language),
        getAllScenes(language),
        getAllSceneProgress().catch(() => []),
      ]);
      // Dedupe by id — a phrase saved from two different screens must appear
      // once, or expand/play state (keyed by id) toggles every copy at once.
      const seen = new Set();
      const enriched = [];
      for (const raw of entries) {
        // Library records are keyed by `phraseId` in IndexedDB, not `id` —
        // alias it here so every `phrase.id` reference below (dedup, play,
        // expand, navigate-to-detail) resolves to the real key instead of
        // `undefined`. Previously every entry after the first was dropped
        // as a "duplicate" of `undefined`, and phrase rows navigated to a
        // dead PhraseDetailScreen with no id.
        const e = { ...raw, id: raw.phraseId };
        if (!e.cjk || seen.has(e.id)) continue; // skip corrupt + duplicate rows
        seen.add(e.id);
        const isDue = (e.practiceCount ?? 0) > 0 && typeof e.nextReviewAt === 'number' && e.nextReviewAt <= Date.now();
        enriched.push({ ...e, growth_state: growthStateFromInterval(e.interval ?? 0, e.reps ?? 0), isDue });
      }
      setLibrary(enriched);
      setScenes(loadedScenes);
      const hearted = progress.filter(p => p.bookmarked).map(p => p.sceneId);
      setSavedScenes(loadedScenes.filter(s => hearted.includes(s.id)));
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function handlePersonalAdd() {
    const text = personalAddText.trim();
    if (!text) return;
    setPersonalAddStatus('working');
    try {
      const generated = await generatePhrase(text, language);
      await saveLibraryEntry({
        phraseId: crypto.randomUUID(),
        cjk: generated.cjk,
        romanization: generated.romanization,
        english: generated.english ?? text,
        language,
        scene_id: PERSONAL_SCENE_ID,
        source_tag: SOURCE_TAGS.MINE,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        practiceCount: 0,
        nextReviewAt: Date.now(),
        lastPracticedAt: null,
        lived_at: null,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });
      setPersonalAddText('');
      setPersonalAddOpen(false);
      setPersonalAddStatus('idle');
      setOpenGroups(prev => new Set(prev).add(PERSONAL_SCENE_ID));
      await reload();
    } catch (_) {
      setPersonalAddStatus('error');
    }
  }

  useEffect(() => { reload(); }, [language]);

  async function playInline(e, phrase) {
    e.stopPropagation();

    // toggle off if already playing
    if (playingId === phrase.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      setPhraseAudioState(phrase.id, null);
      return;
    }

    audioRef.current?.pause();
    setPlayingId(phrase.id);
    setPhraseAudioState(phrase.id, 'loading');

    try {
      const basePath = import.meta.env.BASE_URL || '/';
      let blobUrl = null;

      try {
        const resp = await fetch(`${basePath}audio/${language}/${phrase.id}.mp3`);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 500) blobUrl = URL.createObjectURL(blob);
        }
      } catch (_) {}

      if (!blobUrl) {
        const blob = await textToSpeech(phrase.cjk, { language });
        if (blob && blob.size > 0) blobUrl = URL.createObjectURL(blob);
      }

      if (!blobUrl) { setPlayingId(null); flashError(phrase.id); return; }

      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      // Flip from 'loading' to 'playing' once the browser confirms it can
      // start playback — this is when the indicator switches from spinner
      // to waveform bars.
      audio.oncanplay = () => setPhraseAudioState(phrase.id, 'playing');
      audio.onended = () => { setPlayingId(null); setPhraseAudioState(phrase.id, null); URL.revokeObjectURL(blobUrl); };
      audio.onerror = () => { setPlayingId(null); flashError(phrase.id); URL.revokeObjectURL(blobUrl); };
      audio.play().catch(() => { setPlayingId(null); flashError(phrase.id); });
    } catch (_) {
      setPlayingId(null);
      flashError(phrase.id);
    }
  }

  // Group phrases: personal intro phrases get their own named tag, all
  // scene-less or unknown-scene phrases merge into a single "Other" tag.
  const groups = new Map();
  for (const phrase of library) {
    let key = phrase.scene_id ?? 'unsorted';
    if (key !== PERSONAL_SCENE_ID && key !== 'unsorted' && !scenes.some(s => s.id === key)) key = 'unsorted';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(phrase);
  }
  const groupedScenes = [...groups.entries()]
    .map(([sceneId, phrases]) => ({
      scene: scenes.find(s => s.id === sceneId) ?? null,
      sceneId,
      phrases,
    }))
    .sort((a, b) => {
      // Personal phrases first, then biggest scenes, "Other phrases" last
      if (a.sceneId === PERSONAL_SCENE_ID) return -1;
      if (b.sceneId === PERSONAL_SCENE_ID) return 1;
      if (a.sceneId === 'unsorted') return 1;
      if (b.sceneId === 'unsorted') return -1;
      return b.phrases.length - a.phrases.length;
    });

  const totalPhrases = library.length;
  const totalScenes = groupedScenes.filter(g => g.scene).length;
  const saidInPersonCount = library.filter(p => p.lived_at).length;
  const dueCount = library.filter(p => p.isDue).length;

  useEffect(() => {
    if (groupsSeededRef.current || groupedScenes.length === 0) return;
    const defaults = new Set();
    for (const g of groupedScenes) {
      if (g.sceneId === PERSONAL_SCENE_ID || g.phrases.some(p => p.isDue)) defaults.add(g.sceneId);
    }
    setOpenGroups(defaults);
    groupsSeededRef.current = true;
  }, [groupedScenes]);

  function tagLabel(sceneId, scene) {
    if (sceneId === PERSONAL_SCENE_ID) return 'Personal';
    if (sceneId === 'unsorted' || !scene) return 'Other';
    return scene.title;
  }

  function matchesSearch(phrase) {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (phrase.romanization ?? '').toLowerCase().includes(q) ||
      (phrase.english ?? '').toLowerCase().includes(q) ||
      (phrase.cjk ?? '').includes(searchQuery)
    );
  }

  const totalVisiblePhrases = groupedScenes.reduce((n, g) => n + g.phrases.filter(matchesSearch).length, 0);

  // Count + mastery for a scene, sourced from this user's own library phrases
  // (not the scene's full line count) — a "favourite" scene the user hasn't
  // practiced yet correctly reads as 0%, not blank.
  function sceneStats(sceneId) {
    const phrases = groupedScenes.find(g => g.sceneId === sceneId)?.phrases ?? [];
    if (phrases.length === 0) return null;
    const mastered = phrases.filter(p => p.growth_state === 'mastered').length;
    return { count: phrases.length, pct: Math.round((mastered / phrases.length) * 100) };
  }

  let sectionIndex = 0;
  const nextSectionNum = () => String(++sectionIndex).padStart(2, '0');

  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <span className={styles.heroPill}>
          {totalPhrases} {totalPhrases === 1 ? 'phrase' : 'phrases'} · {totalScenes} {totalScenes === 1 ? 'scene' : 'scenes'}
          {saidInPersonCount > 0 && <span className={styles.heroSaidCount}> · {saidInPersonCount} said in person 📍</span>}
        </span>
        <h1 className={styles.heroTitle}>Your <em>phrasebook</em>.</h1>
        <p className={styles.heroSub}>
          Every phrase you've saved or said out loud, tracked with spaced repetition so you always know what to review next.
        </p>

        {!loading && dueCount > 0 && !searchQuery && (
          <button className={styles.heroLesson} onClick={() => onNavigate('shadow')}>
            <div className={styles.heroLessonBody}>
              <span className={styles.heroEyebrow}>
                TODAY'S REVIEW
                <span className={styles.heroDuePill}>{dueCount} due</span>
              </span>
              <span className={styles.heroLessonTitle}>
                {dueCount} {dueCount === 1 ? 'phrase' : 'phrases'} ready to review
              </span>
            </div>
            <span className={styles.heroCta}>
              <PlayIcon />
              Practice
            </span>
          </button>
        )}
      </div>

      <div className={styles.searchBarWrap}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="SEARCH PHRASES, SCENES…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {!searchQuery && (
        <section className={styles.section}>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>{nextSectionNum()}</span>
            <span className={styles.sectionLabel}>Quick Words</span>
          </div>
          {!lookupOpen ? (
            <button className={styles.lookupTeaser} onClick={() => setLookupOpen(true)}>
              <span className={styles.chev}><ChevronIcon /></span>
              <span className={styles.lookupTexts}>
                <span className={styles.lookupTeaserTitle}>
                  Quick words <span className={styles.lookupBadge}>Good to know</span>
                </span>
                <span className={styles.lookupCaption}>Numbers, colours, dates &amp; more — useful for every learner, not just you</span>
              </span>
              <span className={styles.lookupTeaserLink}>{REFERENCE_SETS.length} sets</span>
            </button>
          ) : (
            <div className={styles.refGrid}>
              {REFERENCE_SETS.map(s => (
                <button
                  key={s.id}
                  className={styles.refCard}
                  onClick={() => onNavigate?.('reference', s.id)}
                >
                  <span className={styles.refIcon}>{s.icon}</span>
                  <span className={styles.refTitle}>{s.title}</span>
                  <span className={styles.refArrow}>→</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {loading && <div className={styles.skeleton} />}

      {!loading && totalPhrases === 0 && !searchQuery && (
        <div className={styles.empty}>
          <p>Your library is empty.</p>
          <button className={styles.emptyBtn} onClick={() => onNavigate('scenes')}>Browse scenes</button>
        </div>
      )}

      {!loading && totalPhrases > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>{nextSectionNum()}</span>
            <span className={styles.sectionLabel}>My Phrasebook</span>
            <span className={styles.sectionMeta}>{totalPhrases} phrases</span>
          </div>
          {totalVisiblePhrases === 0 && (
            <p className={styles.noResults}>No phrases match "{searchQuery}".</p>
          )}

          <div className={styles.phraseList}>
            {groupedScenes.map(({ scene, sceneId, phrases }) => {
              const rows = phrases.filter(matchesSearch);
              if (rows.length === 0) return null;
              const isOpen = openGroups.has(sceneId);
              const isPersonal = sceneId === PERSONAL_SCENE_ID;
              const stats = scene ? sceneStats(sceneId) : null;
              const groupDue = rows.filter(p => p.isDue).length;
              const headerStyle = scene?.tint
                ? { background: scene.tint + '22', color: darkenHex(scene.tint, 0.4) }
                : undefined;
              const countStyle = scene?.tint ? { color: darkenHex(scene.tint, 0.6) } : undefined;
              return (
                <Fragment key={sceneId}>
                  <div className={styles.groupHeaderRow} style={headerStyle}>
                    <button
                      type="button"
                      className={`${styles.groupHeader} ${isOpen ? styles.groupHeaderOpen : ''}`}
                      onClick={() => toggleGroup(sceneId)}
                      aria-expanded={isOpen}
                    >
                      <span className={styles.chev} style={countStyle}><ChevronIcon /></span>
                      <span>{tagLabel(sceneId, scene)}</span>
                      <span className={styles.groupHeaderRight}>
                        {groupDue > 0 && <span className={styles.groupDuePill}>{groupDue} due</span>}
                        {stats && <span className={styles.groupPct} style={countStyle}>{stats.pct}% mastered</span>}
                        <span className={styles.groupCount} style={countStyle}>{rows.length}</span>
                      </span>
                    </button>
                    {isPersonal && (
                      <button
                        type="button"
                        className={`${styles.addPersonalBtn} ${personalAddOpen ? styles.addPersonalBtnOpen : ''}`}
                        onClick={() => {
                          if (personalAddOpen) {
                            setPersonalAddOpen(false);
                            setPersonalAddStatus('idle');
                            return;
                          }
                          if (!isOpen) toggleGroup(sceneId);
                          setPersonalAddOpen(true);
                        }}
                        aria-label={personalAddOpen ? 'Close add phrase' : 'Add a personal phrase'}
                        title={personalAddOpen ? 'Close' : 'Add a personal phrase'}
                      >
                        <PlusIcon />
                      </button>
                    )}
                    {scene && (
                      <button
                        type="button"
                        className={styles.openSceneBtn}
                        onClick={() => onNavigate('scene', sceneId)}
                        aria-label={`Open ${scene.title}`}
                        title={`Open ${scene.title}`}
                      >
                        ›
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className={styles.groupBody}>
                      {isPersonal && personalAddOpen && (
                        <div className={styles.personalAddRow}>
                          <input
                            className={styles.personalAddInput}
                            type="text"
                            placeholder="Type it in English…"
                            value={personalAddText}
                            disabled={personalAddStatus === 'working'}
                            onChange={e => setPersonalAddText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handlePersonalAdd(); }}
                            autoFocus
                          />
                          <button
                            className={styles.personalAddBtn}
                            onClick={handlePersonalAdd}
                            disabled={personalAddStatus === 'working' || !personalAddText.trim()}
                          >
                            {personalAddStatus === 'working' ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      )}
                      {isPersonal && personalAddStatus === 'error' && (
                        <p className={styles.personalAddError}>Could not generate that phrase. Try again.</p>
                      )}

                      {rows.map((phrase, i) => (
                        <div
                          key={phrase.id}
                          className={styles.phraseRow}
                          onClick={() => onNavigate('phrase', phrase.id)}
                          role="button"
                          tabIndex={0}
                          title="Open this phrase for more detail: word by word, culture note, how to reply, review history"
                        >
                          <PhraseThumb scene={scene} sceneId={sceneId} index={i} settings={settings} />
                          <div className={styles.phraseText}>
                            <p className={styles.phraseRoman}>{splitSyllables(phrase.romanization)}</p>
                            <p className={styles.phraseCjk}>{phrase.cjk}</p>
                            {phrase.english && <p className={styles.phraseEnglish}>{phrase.english}</p>}
                          </div>
                          {phrase.isDue && <span className={styles.dueTag} title="Due for review">Due</span>}
                          <GrowthMeter state={phrase.growth_state} />
                          <button
                            className={`${styles.playBtn} ${playingId === phrase.id ? styles.playBtnActive : ''}`}
                            onClick={e => playInline(e, phrase)}
                            aria-label={playingId === phrase.id ? 'Stop' : 'Play'}
                            title={playingId === phrase.id ? 'Stop playback' : 'Play this phrase'}
                          >
                            {audioState[phrase.id] === 'loading' || audioState[phrase.id] === 'error'
                              ? <AudioStateIndicator state={audioState[phrase.id]} />
                              : playingId === phrase.id ? <StopIcon /> : <PlayIcon />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </section>
      )}

      {!searchQuery && savedScenes.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionBar}>
            <span className={styles.sectionNum}>{nextSectionNum()}</span>
            <span className={styles.sectionLabel}>My Favourite Scenes</span>
            <span className={styles.sectionMeta}>{savedScenes.length}</span>
          </div>
          <p className={styles.favHint}><ChevronIcon /> Swipe for more</p>
          <div className={styles.favWrap}>
            <div className={styles.favShelf}>
              {savedScenes.map(s => {
                const stats = sceneStats(s.id);
                return (
                  <button key={s.id} className={styles.favCard} onClick={() => onNavigate('scene', s.id)}>
                    <div
                      className={styles.favCover}
                      style={{
                        backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined,
                        backgroundColor: s.tint ? s.tint + '88' : 'var(--ink)',
                      }}
                    >
                      <div className={styles.favCoverGrad} />
                      <p className={styles.favCoverTitle}>
                        {s.title}
                        {stats && <span className={styles.favCoverCount}>{stats.count} {stats.count === 1 ? 'phrase' : 'phrases'}</span>}
                      </p>
                    </div>
                    <p className={styles.favSub}>{stats ? `${stats.pct}% mastered` : 'Not started'}</p>
                  </button>
                );
              })}
            </div>
            <div className={styles.favFade} aria-hidden="true">
              <span className={styles.favArrow}>›</span>
            </div>
          </div>
        </section>
      )}

      <div className={styles.bottomPad} />
    </div>
  );
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : 'New';
}

// Jyutping syllables are already space-delimited in the data — splitting on
// whitespace (not inventing word groupings) previews that each syllable is
// individually playable, the same way the phrase detail screen breaks it down.
function splitSyllables(romanization) {
  if (!romanization) return null;
  const tokens = romanization.trim().split(/\s+/);
  return tokens.map((tok, i) => (
    <span key={i}>
      {tok}
      {i < tokens.length - 1 && <span className={styles.syllableSep}> · </span>}
    </span>
  ));
}

// Real scene → its own photo, graded per row so repeats in the same group
// don't look identical. Personal → the user's own photo (duotoned to match
// the scene photography) or a monogram plate if they don't have one set.
// Everything else (no matching scene) → a flat neutral swatch.
function PhraseThumb({ scene, sceneId, index, settings }) {
  if (scene?.imageUrl) {
    return (
      <div
        className={styles.phraseThumb}
        style={{
          backgroundImage: `url(${scene.imageUrl})`,
          backgroundColor: scene.tint ? scene.tint + '33' : 'var(--bg-3)',
          filter: PHOTO_GRADES[index % PHOTO_GRADES.length],
        }}
      />
    );
  }

  if (sceneId === PERSONAL_SCENE_ID) {
    const photoURL = settings?.photoURL;
    if (photoURL) {
      return (
        <div
          className={`${styles.phraseThumb} ${styles.phraseThumbDuotone}`}
          style={{ backgroundImage: `url(${photoURL})` }}
        />
      );
    }
    const initial = (settings?.name || 'U')[0].toUpperCase();
    return (
      <div className={`${styles.phraseThumb} ${styles.phraseThumbMonogramPlate}`}>
        <span className={styles.phraseThumbMonogram}>{initial}</span>
      </div>
    );
  }

  return <div className={styles.phraseThumb} style={{ backgroundColor: 'var(--bg-3)' }} />;
}

function GrowthMeter({ state }) {
  const cfg = GROWTH_METER[state] ?? GROWTH_METER.new;
  return (
    <div className={styles.growthMeter}>
      <div className={styles.growthTicks}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={styles.growthTick}
            style={i < cfg.filled ? { background: cfg.color, borderColor: cfg.color } : undefined}
          />
        ))}
      </div>
      <span className={`${styles.growthLabel} ${styles[`growthLabel${capitalize(state)}`]}`}>{cfg.label}</span>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="18" height="21" viewBox="0 0 12 14" fill="currentColor">
    <path d="M2 1l9 6-9 6V1z" />
  </svg>
);

const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 10 10" fill="currentColor">
    <rect x="1" y="1" width="8" height="8" rx="1" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="9" height="10" viewBox="0 0 8 10" fill="currentColor">
    <path d="M0 0l8 5-8 5V0z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 1v10M1 6h10" />
  </svg>
);
