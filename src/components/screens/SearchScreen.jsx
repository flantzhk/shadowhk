import { useState, useEffect, useRef } from 'react';
import styles from './SearchScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PhraseTile } from '../ui/PhraseTile.jsx';
import { GrowthBadge } from '../ui/GrowthBadge.jsx';
import { SourceTag } from '../ui/SourceTag.jsx';
import { searchLibrary, saveLibraryEntry } from '../../services/storage.js';
import { generatePhrase } from '../../services/api.js';
import { GROWTH_STATE, SOURCE_TAGS, SEARCH_DEBOUNCE_MS } from '../../utils/constants.js';

const SOURCE_OPTIONS = [
  { id: SOURCE_TAGS.HEARD_IT, label: '👂 Heard it' },
  { id: SOURCE_TAGS.FROM_SCHOOL, label: '🏫 From school' },
  { id: SOURCE_TAGS.FROM_SHOW, label: '📺 From a show' },
  { id: SOURCE_TAGS.MINE, label: '✏️ Mine' },
];

export default function SearchScreen({ onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState('');
  const [addSource, setAddSource] = useState(SOURCE_TAGS.HEARD_IT);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchLibrary(query, language);
        setResults(found);
      } catch (_) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, language]);

  async function handleGenerate() {
    if (!addText.trim()) return;
    setGenerating(true);
    setGenerated(null);
    setSaveError(null);
    try {
      const result = await generatePhrase(addText.trim(), language);
      setGenerated(result);
    } catch (_) {
      setSaveError('Could not generate phrase. Check your connection.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generated) return;
    setSaveError(null);
    try {
      await saveLibraryEntry({
        phraseId: crypto.randomUUID(),
        cjk: generated.cjk,
        romanization: generated.romanization,
        english: generated.english,
        language,
        scene_id: null,
        source_tag: addSource,
        growth_state: GROWTH_STATE.NEW,
        interval: 0,
        easeFactor: 2.5,
        practiceCount: 0,
        nextReviewAt: Date.now(),
        lastPracticedAt: null,
        lived_at: null,
        cultural_note: generated.culturalNote ?? null,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });
      setSaved(true);
      setAddText('');
      setGenerated(null);
      setTimeout(() => {
        setShowAdd(false);
        setSaved(false);
      }, 1500);
    } catch (_) {
      setSaveError('Failed to save. Try again.');
    }
  }

  const romanizationLabel = language === 'mandarin' ? 'Pīnyīn' : 'Jyutping';

  return (
    <div className={styles.screen}>
      <div className={styles.searchBar}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          placeholder={`Search English, 繁體, ${romanizationLabel}`}
          value={query}
          onChange={e => { setQuery(e.target.value); setShowAdd(false); }}
          autoFocus
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => { setQuery(''); setResults([]); }}>
            <ClearIcon />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {searching && <div className={styles.searchingNote}>Searching...</div>}

        {!searching && query.trim() && results.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your library</h2>
            {results.map(phrase => (
              <PhraseTile
                key={phrase.id}
                phrase={phrase}
                growthState={phrase.growth_state}
                onTap={() => onNavigate('phrase', phrase.id)}
              />
            ))}
          </section>
        )}

        {!searching && query.trim() && results.length === 0 && (
          <div className={styles.noResults}>
            <p>No match in your library.</p>
            <button className={styles.addOwnBtn} onClick={() => { setShowAdd(true); setAddText(query); }}>
              Add "{query}" as your own phrase
            </button>
          </div>
        )}

        {!searching && !query.trim() && !showAdd && (
          <button className={styles.addOwnTrigger} onClick={() => setShowAdd(true)}>
            <span className={styles.addIcon}>+</span>
            Add your own phrase
          </button>
        )}

        {showAdd && (
          <div className={styles.addPanel}>
            <h2 className={styles.sectionTitle}>Add your own</h2>

            <input
              className={styles.addInput}
              placeholder="Type anything — English, characters, or romanisation"
              value={addText}
              onChange={e => { setAddText(e.target.value); setGenerated(null); }}
            />

            <div className={styles.sourceChips}>
              {SOURCE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`${styles.sourceChip} ${addSource === opt.id ? styles.sourceChipActive : ''}`}
                  onClick={() => setAddSource(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {!generated && (
              <button
                className={styles.generateBtn}
                onClick={handleGenerate}
                disabled={!addText.trim() || generating}
              >
                {generating ? 'Generating...' : 'Generate phrase'}
              </button>
            )}

            {saveError && <p className={styles.error}>{saveError}</p>}

            {generated && (
              <div className={styles.preview}>
                <p className={styles.previewRomanization}>{generated.romanization}</p>
                <p className={styles.previewCjk}>{generated.cjk}</p>
                <p className={styles.previewEnglish}>{generated.english}</p>
                {generated.culturalNote && (
                  <p className={styles.previewNote}>{generated.culturalNote}</p>
                )}
                <div className={styles.previewActions}>
                  <button className={styles.cancelBtn} onClick={() => { setGenerated(null); setAddText(''); }}>
                    Cancel
                  </button>
                  <button className={styles.saveBtn} onClick={handleSave}>
                    {saved ? 'Saved!' : 'Save to library'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
