import { useState, useEffect } from 'react';
import styles from './ReferenceScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { getLibraryEntry, saveLibraryEntry } from '../../services/storage.js';
import { PhraseRow } from '../ui/PhraseRow.jsx';

export default function ReferenceScreen({ referenceId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [chapters, setChapters] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

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

  // Check which phrases are already saved
  useEffect(() => {
    const allPhraseIds = chapters.flatMap(c => (c.phrases ?? []).map(p => p.id));
    if (!allPhraseIds.length) return;
    Promise.all(allPhraseIds.map(id => getLibraryEntry(id))).then(entries => {
      const saved = new Set();
      entries.forEach(e => { if (e) saved.add(e.id); });
      setSavedIds(saved);
    }).catch(() => {});
  }, [chapters]);

  async function toggleSaved(phrase) {
    if (savedIds.has(phrase.id)) return;
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

  const CHAPTER_COLORS = [
    'linear-gradient(135deg, #1a2a3a 0%, #2d4a6a 100%)',
    'linear-gradient(135deg, #2a1a1a 0%, #5a2a2a 100%)',
    'linear-gradient(135deg, #1a2a1a 0%, #2a5a3a 100%)',
    'linear-gradient(135deg, #2a2a1a 0%, #5a4a2a 100%)',
    'linear-gradient(135deg, #2a1a2a 0%, #4a2a5a 100%)',
  ];

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
          <p className={styles.eyebrow}>{chapters.length} {chapters.length === 1 ? 'CHAPTER' : 'CHAPTERS'} · {totalPhrases} {totalPhrases === 1 ? 'PHRASE' : 'PHRASES'}</p>
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>

      {/* Chapter picker — horizontal scroll cards */}
      <div className={styles.chapterScroll}>
        {chapters.map((chapter, idx) => (
          <button
            key={chapter.id}
            className={`${styles.chapterCard} ${expandedChapter === idx ? styles.chapterCardActive : ''}`}
            onClick={() => setExpandedChapter(expandedChapter === idx ? null : idx)}
          >
            <div className={styles.chapterCardInner} style={{ background: CHAPTER_COLORS[idx % CHAPTER_COLORS.length] }}>
              <span className={styles.chapterCardNum}>{String(idx + 1).padStart(2, '0')}</span>
              <p className={styles.chapterCardName}>{chapter.name}</p>
              <p className={styles.chapterCardCount}>{chapter.phraseCount ?? chapter.phrases?.length ?? 0} phrases</p>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded chapter phrases — same PhraseRow used by scenes and the
          library, so reference sets no longer look like a different app. */}
      {expandedChapter !== null && chapters[expandedChapter] && (
        <div className={styles.phrasePanel}>
          <p className={styles.phrasePanelDesc}>{chapters[expandedChapter].description}</p>
          {(chapters[expandedChapter].phrases ?? []).map(phrase => (
            <div key={phrase.id} className={styles.phraseRowWrap}>
              <PhraseRow
                phraseId={phrase.id}
                chinese={phrase.chinese}
                jyutping={phrase.romanization}
                english={phrase.english}
                words={phrase.words}
                saved={savedIds.has(phrase.id)}
                onHeartToggle={() => toggleSaved(phrase)}
              />
              {phrase.context && <p className={styles.phraseContext}>{phrase.context}</p>}
            </div>
          ))}
        </div>
      )}

      <div className={styles.bottomPad} />
    </div>
  );
}

function formatTitle(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
