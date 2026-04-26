import { useState, useEffect, useRef } from 'react';
import styles from './PhraseDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PostIt } from '../ui/PostIt.jsx';
import { GrowthBadge } from '../ui/GrowthBadge.jsx';
import { SourceTag } from '../ui/SourceTag.jsx';
import { getLibraryEntry } from '../../services/storage.js';
import { getSchedule } from '../../services/srs.js';
import { getSceneById } from '../../services/sceneLoader.js';
import { textToSpeech, fetchWithAuth } from '../../services/api.js';
import { API_BASE_URL, API_ENDPOINTS } from '../../utils/constants.js';

const CJK_RE = /[一-鿿㐀-䶿]/u;

async function fetchCharMeanings(cjk, romanization, language) {
  const prompt = `Give a 1–3 word English gloss for each syllable in this ${language === 'mandarin' ? 'Mandarin' : 'Cantonese'} phrase. Return ONLY a JSON array of strings, one meaning per syllable in the same order. No explanation.\n\nPhrase: ${cjk}\nSyllables: ${romanization}`;
  const response = await fetchWithAuth(`${API_BASE_URL}${API_ENDPOINTS.AI_CHAT ?? '/ai-chat'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], language, mode: 'explain' }),
  });
  const data = await response.json();
  const raw = data.content ?? data.message ?? '';
  const match = raw.match(/\[[\s\S]*?\]/);
  return match ? JSON.parse(match[0]) : [];
}

function buildWhyToday(phrase, schedule) {
  if (!phrase.practiceCount || phrase.practiceCount === 0) {
    return 'New phrase. First practice starts the review clock.';
  }
  if (!schedule?.nextReview) return null;
  const now = Date.now();
  const nextReviewAt = new Date(schedule.nextReview).getTime();
  const scoreNote = phrase.lastScore != null ? ` Score last time: ${phrase.lastScore}.` : '';
  const gapNote = schedule.interval ? ` ${schedule.interval}-day review gap.` : '';
  const diff = now - nextReviewAt;
  const dayMs = 86400000;
  if (diff > dayMs) {
    const days = Math.floor(diff / dayMs);
    return `Due ${days} day${days === 1 ? '' : 's'} ago.${scoreNote}${gapNote}`;
  }
  if (diff >= 0) return `Due today.${scoreNote}${gapNote}`;
  const daysUntil = Math.ceil(-diff / dayMs);
  const when = daysUntil === 1 ? 'tomorrow'
    : new Date(nextReviewAt).toLocaleDateString('en-GB', { weekday: 'long' });
  return `Not due until ${when}.${scoreNote}${gapNote}`;
}

export default function PhraseDetailScreen({ phraseId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [phrase, setPhrase] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [sceneLine, setSceneLine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playingCharIdx, setPlayingCharIdx] = useState(null);
  const [charMeanings, setCharMeanings] = useState(null);
  const audioRef = useRef(null);

  const romanizationLabel = language === 'mandarin' ? 'Pīnyīn' : 'Jyutping';

  async function playTTS(text, charIdx = null) {
    try {
      if (charIdx !== null) setPlayingCharIdx(charIdx); else setPlaying(true);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const blob = await textToSpeech(text, { language, turbo: true });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); setPlayingCharIdx(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlaying(false); setPlayingCharIdx(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setPlaying(false);
      setPlayingCharIdx(null);
    }
  }

  useEffect(() => {
    if (!phraseId) return;
    getLibraryEntry(phraseId)
      .then(async entry => {
        setPhrase(entry);
        if (entry) {
          const sched = await getSchedule(phraseId).catch(() => null);
          setSchedule(sched);
          if (entry.scene_id) {
            getSceneById(entry.scene_id).then(scene => {
              const line = (scene?.lines ?? []).find(l => l.id === phraseId);
              if (line?.scenario || line?.replies || line?.usage) setSceneLine(line);
            }).catch(() => {});
          }
          fetchCharMeanings(entry.cjk, entry.romanization, language)
            .then(setCharMeanings)
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phraseId]);

  if (loading) return <div className={styles.screen}><div className={styles.loading} /></div>;
  if (!phrase) return (
    <div className={styles.screen}>
      <div className={styles.error}>
        <p>Phrase not found.</p>
        <button onClick={onBack}>Go back</button>
      </div>
    </div>
  );

  const syllables = phrase.romanization?.split(' ') ?? [];
  // Filter to CJK chars only so they map 1:1 with syllables (punctuation has no syllable)
  const chars = (phrase.cjk ?? '').split('').filter(c => CJK_RE.test(c) || /[a-zA-Z]/.test(c));

  const growthState = phrase.growth_state ?? 'new';

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <GrowthBadge state={growthState} />
      </div>

      <div className={styles.content}>
        {/* Main phrase */}
        <div className={styles.phraseHero}>
          <p className={styles.romanization}>{phrase.romanization}</p>
          <p className={styles.cjk} lang={language === 'mandarin' ? 'zh-CN' : 'yue'}>{phrase.cjk}</p>
          <p className={styles.english}>{phrase.english}</p>
          <button
            className={`${styles.playBtn} ${playing ? styles.playBtnActive : ''}`}
            onClick={() => playTTS(phrase.cjk)}
            aria-label="Play phrase"
          >
            {playing ? '■ Stop' : '▶ Play'}
          </button>
        </div>

        {/* Source tag */}
        {phrase.source_tag && (
          <div className={styles.sourceRow}>
            <SourceTag type={phrase.source_tag} date={phrase._createdAt} />
          </div>
        )}

        {/* D4 — Imagine this (vivid story scenario) */}
        {sceneLine?.scenario && (
          <section className={styles.section}>
            <div className={styles.scenarioBox}>
              <p className={styles.scenarioText}>{sceneLine.scenario}</p>
            </div>
          </section>
        )}

        {/* Word-by-word breakdown */}
        {syllables.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Word by word</h2>
            <div className={styles.breakdown}>
              {syllables.map((syl, i) => {
                const char = chars[i] ?? '';
                const isPlaying = playingCharIdx === i;
                const meaning = charMeanings?.[i];
                return (
                  <button
                    key={i}
                    className={`${styles.breakdownCell} ${isPlaying ? styles.breakdownCellActive : ''}`}
                    onClick={() => char && playTTS(char, i)}
                    aria-label={`Play ${char}`}
                  >
                    <span className={styles.breakdownChar}>{char}</span>
                    <span className={styles.breakdownSyl}>{syl}</span>
                    {charMeanings === null
                      ? <span className={styles.breakdownMeaning}>···</span>
                      : meaning
                        ? <span className={styles.breakdownMeaning}>{meaning}</span>
                        : null
                    }
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Cultural imagination PostIt */}
        {phrase.cultural_note && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>In Hong Kong</h2>
            <PostIt text={phrase.cultural_note} />
          </section>
        )}

        {/* D5 — How to reply */}
        {sceneLine?.replies?.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How to reply</h2>
            {sceneLine.replies.map((r, i) => (
              <div key={i} className={styles.replyRow}>
                <span className={styles.replyCjk}>{r.cjk}</span>
                <span className={styles.replyRoman}>{r.romanization}</span>
                <span className={styles.replyEnglish}>{r.english}</span>
              </div>
            ))}
          </section>
        )}

        {/* D6 — Use it when */}
        {sceneLine?.usage && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Use it when</h2>
            <p className={styles.usageText}>{sceneLine.usage}</p>
          </section>
        )}

        {/* SRS History */}
        {schedule && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your history</h2>
            <HistoryTimeline schedule={schedule} phrase={phrase} />
          </section>
        )}

        {/* D7 — Why today? */}
        {phrase.practiceCount != null && buildWhyToday(phrase, schedule) && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why now?</h2>
            <p className={styles.whyText}>{buildWhyToday(phrase, schedule)}</p>
          </section>
        )}

        {/* Practice CTA */}
        <button
          className={styles.practiceBtn}
          onClick={() => onNavigate('shadow', phrase.scene_id ?? null)}
        >
          Practice this phrase
        </button>
      </div>
    </div>
  );
}

function HistoryTimeline({ schedule, phrase }) {
  const events = [];

  if (phrase._createdAt) {
    events.push({ label: 'Added to library', date: new Date(phrase._createdAt) });
  }
  if (phrase.lastPracticed) {
    events.push({ label: 'Last practiced', date: new Date(phrase.lastPracticed) });
  }
  if (schedule?.nextReview) {
    events.push({ label: 'Next review', date: new Date(schedule.nextReview), upcoming: true });
  }

  if (events.length === 0) return <p className={styles.noHistory}>No history yet.</p>;

  return (
    <div className={styles.timeline}>
      {events.map((e, i) => (
        <div key={i} className={`${styles.timelineItem} ${e.upcoming ? styles.upcoming : ''}`}>
          <div className={styles.timelineDot} />
          <div className={styles.timelineContent}>
            <p className={styles.timelineLabel}>{e.label}</p>
            <p className={styles.timelineDate}>
              {e.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
