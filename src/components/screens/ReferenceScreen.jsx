import { useState, useEffect, useRef } from 'react';
import styles from './ReferenceScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntry, saveLibraryEntry } from '../../services/storage.js';
import { textToSpeech } from '../../services/api.js';

export default function ReferenceScreen({ referenceId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [chapters, setChapters] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [livedIds, setLivedIds] = useState(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    if (!referenceId) return;
    const base = import.meta.env.BASE_URL || '/';
    fetch(`${base}${referenceId}.json`)
      .then(r => r.json())
      .then(data => {
        // Normalise: could be array-of-chapters or single chapter object
        const chapterList = Array.isArray(data) ? data : [data];
        setChapters(chapterList);
        setTitle(Array.isArray(data) ? formatTitle(referenceId) : (data.name ?? formatTitle(referenceId)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [referenceId]);

  // Check which phrases are already saved / lived
  useEffect(() => {
    const allPhraseIds = chapters.flatMap(c => (c.phrases ?? []).map(p => p.id));
    if (!allPhraseIds.length) return;
    Promise.all(allPhraseIds.map(id => getLibraryEntry(id))).then(entries => {
      const saved = new Set();
      const lived = new Set();
      entries.forEach(e => {
        if (e) { saved.add(e.id); if (e.lived_at) lived.add(e.id); }
      });
      setSavedIds(saved);
      setLivedIds(lived);
    }).catch(() => {});
  }, [chapters]);

  async function playInline(e, phrase) {
    e.stopPropagation();
    if (playingId === phrase.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    setPlayingId(phrase.id);
    try {
      const base = import.meta.env.BASE_URL || '/';
      let blobUrl = null;
      try {
        const resp = await fetch(`${base}audio/${language}/${phrase.id}.mp3`);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 500) blobUrl = URL.createObjectURL(blob);
        }
      } catch (_) {}
      if (!blobUrl) {
        const blob = await textToSpeech(phrase.chinese, { language });
        if (blob && blob.size > 0) blobUrl = URL.createObjectURL(blob);
      }
      if (!blobUrl) { setPlayingId(null); return; }
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); };
      audio.onerror = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); };
      audio.play();
    } catch (_) { setPlayingId(null); }
  }

  async function toggleSaved(phrase) {
    const entry = {
      id: phrase.id,
      cjk: phrase.chinese,
      romanization: phrase.romanization,
      english: phrase.english,
      scene_id: referenceId,
      language,
      _createdAt: Date.now(),
      reps: 0,
      interval: 0,
    };
    await saveLibraryEntry(entry);
    setSavedIds(prev => new Set([...prev, phrase.id]));
  }

  async function toggleLived(e, phraseId) {
    e.stopPropagation();
    const entry = await getLibraryEntry(phraseId);
    if (!entry) return;
    const updated = { ...entry, lived_at: entry.lived_at ? null : Date.now() };
    await saveLibraryEntry(updated);
    setLivedIds(prev => {
      const next = new Set(prev);
      updated.lived_at ? next.add(phraseId) : next.delete(phraseId);
      return next;
    });
  }

  if (loading) return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>←</button>
      <div className={styles.loading} />
    </div>
  );

  const totalPhrases = chapters.reduce((n, c) => n + (c.phrases?.length ?? 0), 0);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>{chapters.length} CHAPTERS · {totalPhrases} PHRASES</p>
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>

      <div className={styles.chapterList}>
        {chapters.map((chapter, idx) => {
          const isOpen = expandedChapter === idx;
          return (
            <section key={chapter.id ?? idx} className={styles.chapter}>
              <button
                className={`${styles.chapterHeader} ${isOpen ? styles.chapterHeaderOpen : ''}`}
                onClick={() => setExpandedChapter(isOpen ? -1 : idx)}
              >
                <span className={styles.chapterNum}>{String(idx + 1).padStart(2, '0')}</span>
                <div className={styles.chapterMeta}>
                  <span className={styles.chapterName}>{chapter.name}</span>
                  {chapter.description && (
                    <span className={styles.chapterDesc}>{chapter.description}</span>
                  )}
                </div>
                <span className={styles.chapterCount}>{chapter.phrases?.length ?? 0}</span>
                <span className={`${styles.chapterChevron} ${isOpen ? styles.chapterChevronOpen : ''}`}>›</span>
              </button>

              {isOpen && (
                <div className={styles.phraseList}>
                  {(chapter.phrases ?? []).map(phrase => {
                    const isPlaying = playingId === phrase.id;
                    const isSaved = savedIds.has(phrase.id);
                    const isLived = livedIds.has(phrase.id);
                    return (
                      <div key={phrase.id} className={styles.phraseRow}>
                        <div className={styles.phraseMain}>
                          <p className={styles.phraseCjk}>{phrase.chinese}</p>
                          <p className={styles.phraseRoman}>{phrase.romanization}</p>
                          <p className={styles.phraseEnglish}>{phrase.english}</p>
                          {phrase.context && (
                            <p className={styles.phraseContext}>{phrase.context}</p>
                          )}

                          {/* Word-by-word */}
                          {phrase.words?.length > 0 && (
                            <div className={styles.words}>
                              {phrase.words.map((w, wi) => (
                                <span key={wi} className={styles.word}>
                                  <span className={styles.wordCjk}>{w.chinese}</span>
                                  <span className={styles.wordRoman}>{w.jyutping}</span>
                                  <span className={styles.wordEnglish}>{w.english}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={styles.phraseActions}>
                          <button
                            className={`${styles.playBtn} ${isPlaying ? styles.playBtnActive : ''}`}
                            onClick={e => playInline(e, phrase)}
                            aria-label={isPlaying ? 'Stop' : 'Play'}
                          >
                            {isPlaying
                              ? <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8" rx="1"/></svg>
                              : <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M2 1l9 6-9 6V1z"/></svg>
                            }
                          </button>

                          {isSaved ? (
                            <button
                              className={`${styles.livedBtn} ${isLived ? styles.livedBtnActive : ''}`}
                              onClick={e => toggleLived(e, phrase.id)}
                              title={isLived ? 'Unmark said in person' : 'Mark as said in person'}
                            >
                              📍
                            </button>
                          ) : (
                            <button
                              className={styles.saveBtn}
                              onClick={() => toggleSaved(phrase)}
                              title="Save to library"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.bottomPad} />
    </div>
  );
}

function formatTitle(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
