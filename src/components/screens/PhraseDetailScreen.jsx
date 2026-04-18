import { useState, useEffect } from 'react';
import styles from './PhraseDetailScreen.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { PostIt } from '../ui/PostIt.jsx';
import { GrowthBadge } from '../ui/GrowthBadge.jsx';
import { SourceTag } from '../ui/SourceTag.jsx';
import { getLibraryEntry } from '../../services/storage.js';
import { getSchedule } from '../../services/srs.js';

export default function PhraseDetailScreen({ phraseId, onBack, onNavigate }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [phrase, setPhrase] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  const romanizationLabel = language === 'mandarin' ? 'Pīnyīn' : 'Jyutping';

  useEffect(() => {
    if (!phraseId) return;
    getLibraryEntry(phraseId)
      .then(async entry => {
        setPhrase(entry);
        if (entry) {
          const sched = await getSchedule(phraseId).catch(() => null);
          setSchedule(sched);
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
  const chars = phrase.cjk?.split('') ?? [];

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
        </div>

        {/* Source tag */}
        {phrase.source_tag && (
          <div className={styles.sourceRow}>
            <SourceTag type={phrase.source_tag} date={phrase._createdAt} />
          </div>
        )}

        {/* Word-by-word breakdown */}
        {syllables.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Word by word</h2>
            <div className={styles.breakdown}>
              {syllables.map((syl, i) => (
                <div key={i} className={styles.breakdownCell}>
                  <span className={styles.breakdownChar}>{chars[i] ?? ''}</span>
                  <span className={styles.breakdownSyl}>{syl}</span>
                </div>
              ))}
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

        {/* SRS History */}
        {schedule && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your history</h2>
            <HistoryTimeline schedule={schedule} phrase={phrase} />
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
