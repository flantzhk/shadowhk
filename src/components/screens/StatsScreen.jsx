// src/components/screens/StatsScreen.jsx — Encouraging progress dashboard

import { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getLibraryEntriesByLanguage, getSessionsByLanguage } from '../../services/storage';
import { formatTime } from '../../utils/formatters';
import { getLevel, calcXP } from '../../utils/levels';
import styles from './StatsScreen.module.css';

const ACHIEVEMENTS = [
  { id: 'first-lesson', icon: '⚡', label: 'First Lesson', desc: 'Complete 1 practice session', how: 'Start any practice mode', field: 'sessions', threshold: 1 },
  { id: '5-sessions', icon: '🌱', label: 'Getting Started', desc: 'Complete 5 practice sessions', how: 'Do 5 sessions in any mode', field: 'sessions', threshold: 5 },
  { id: '10-phrases', icon: '📖', label: 'Word Collector', desc: 'Save 10 phrases to library', how: 'Tap + on any phrase', field: 'phrases', threshold: 10 },
  { id: '25-phrases', icon: '🔍', label: 'Phrase Hunter', desc: 'Save 25 phrases to library', how: 'Keep adding phrases you like', field: 'phrases', threshold: 25 },
  { id: '50-phrases', icon: '📚', label: 'Vocabulary Builder', desc: 'Save 50 phrases to library', how: 'Build a solid phrase collection', field: 'phrases', threshold: 50 },
  { id: '3-streak', icon: '🔥', label: '3 Days Straight', desc: 'Practice 3 days in a row', how: 'Do at least 1 session per day', field: 'streak', threshold: 3 },
  { id: '7-streak', icon: '💪', label: '7 Days Straight', desc: 'Practice 7 days in a row', how: 'Keep your daily streak alive', field: 'streak', threshold: 7 },
  { id: '14-streak', icon: '🏆', label: '14 Days Straight', desc: 'Practice 14 days in a row', how: 'Two full weeks of practice', field: 'streak', threshold: 14 },
  { id: '30-streak', icon: '👑', label: '30 Days Straight', desc: 'Practice 30 days in a row', how: 'A full month, no days missed', field: 'streak', threshold: 30 },
  { id: 'first-master', icon: '⭐', label: 'First Mastery', desc: 'Master your first phrase', how: 'Score 90+ on a phrase repeatedly', field: 'mastered', threshold: 1 },
  { id: '25-sessions', icon: '🎯', label: '25 Sessions', desc: 'Complete 25 practice sessions', how: 'Keep showing up to practice', field: 'sessions', threshold: 25 },
  { id: '10-mastered', icon: '🧠', label: 'Sharp Memory', desc: 'Master 10 different phrases', how: 'Review phrases until they stick', field: 'mastered', threshold: 10 },
  { id: 'first-lived', label: 'First one out there', desc: 'Say one phrase in person', how: 'Mark "I did it" after any session', field: 'realWorldUses', threshold: 1 },
  { id: '5-lived', label: 'Five in the wild', desc: 'Mark 5 phrases as used in person', how: 'Keep marking sessions you actually used', field: 'realWorldUses', threshold: 5 },
  { id: '15-lived', label: 'Regular use', desc: 'Mark 15 phrases as used in person', how: 'Practice becomes real conversation', field: 'realWorldUses', threshold: 15 },
  { id: '30-lived', label: 'Out there constantly', desc: 'Mark 30 phrases as used in person', how: 'The city is your classroom now', field: 'realWorldUses', threshold: 30 },
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function streakMessage(streak) {
  if (streak === 0) return { headline: 'Start your streak today', sub: 'Practice once a day to build momentum.' };
  if (streak === 1) return { headline: "Day 1. You've begun.", sub: "Come back tomorrow to keep it going." };
  if (streak < 3) return { headline: `${streak} days and counting`, sub: "Building a habit takes consistency. Keep going." };
  if (streak < 7) return { headline: `${streak} days strong 🔥`, sub: "You're in the habit zone. Don't stop now." };
  if (streak < 14) return { headline: `${streak} days. Impressive.`, sub: "A full week of practice. You're serious about this." };
  if (streak < 30) return { headline: `${streak} days`, sub: "Most people give up long before this. You haven't." };
  return { headline: `${streak} days`, sub: "A month of daily practice. Most people never get here." };
}

// Embedded inline in ProfileScreen's "You" tab — no header/back button of its
// own, since it lives inside Profile's existing screen chrome and tab bar.
export default function StatsScreen() {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';
  const [stats, setStats] = useState(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  useEffect(() => {
    (async () => {
      const entries = await getLibraryEntriesByLanguage(language);
      // Every saveSession() call site now stamps a `language` field, so
      // session-derived numbers (sessions, avg score, tone accuracy, best
      // streak, today's progress) can be scoped to the active language too.
      // Sessions saved before that field existed have no `language` at all —
      // getSessionsByLanguage treats those as Cantonese so old history
      // doesn't just disappear from a user's stats.
      const sessions = await getSessionsByLanguage(language);
      const learningCount = entries.filter(e => e.status === 'learning').length;
      const masteredCount = entries.filter(e => e.status === 'mastered').length;
      const totalPhrasesPracticed = sessions.reduce((sum, s) => sum + (s.phrasesAttempted || 0), 0);
      const scores = sessions.filter(s => s.averageScore != null).map(s => s.averageScore);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const sessionDates = new Set(sessions.map(s => s.date));

      // Tone accuracy: Tone Gym is the one mode that scores tone discrimination
      // specifically (Shadow's score blends pronunciation as a whole).
      const toneScores = sessions.filter(s => s.mode === 'tone-gym' && s.averageScore != null).map(s => s.averageScore);
      const toneAccuracy = toneScores.length > 0
        ? Math.round(toneScores.reduce((a, b) => a + b, 0) / toneScores.length)
        : null;

      const todayStr = new Date().toISOString().slice(0, 10);
      const todaySessions = sessions.filter(s => s.date === todayStr);
      const todayPhrases = todaySessions.reduce((sum, s) => sum + (s.phrasesAttempted || 0), 0);
      const todayTime = todaySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

      // Best streak
      const sortedDates = [...sessionDates].sort();
      let bestStreak = 0, currentRun = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) { currentRun = 1; }
        else {
          const diff = Math.round((new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000);
          currentRun = diff === 1 ? currentRun + 1 : 1;
        }
        bestStreak = Math.max(bestStreak, currentRun);
      }

      const realWorldCount = entries.filter(e => e.lived_at).length;

      setStats({
        totalPhrases: entries.length, learningCount, masteredCount,
        totalSessions: sessions.length, avgScore, sessionDates,
        totalTime: settings.totalPracticeSeconds,
        streak: settings.streakCount,
        bestStreak, totalPhrasesPracticed, toneAccuracy,
        todayPhrases, todayTime, realWorldCount,
      });
    })();
  }, [settings, language]);

  if (!stats) return null;

  const xp = calcXP(stats);
  const level = getLevel(xp);
  const msg = streakMessage(stats.streak);

  // Last 7 days
  const today = new Date();
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayIdx = (d.getDay() + 6) % 7;
    weekDays.push({ date: dateStr, label: DAY_LABELS[dayIdx], active: stats.sessionDates.has(dateStr), isToday: i === 0 });
  }
  const weekActive = weekDays.filter(d => d.active).length;

  // Daily goal — dailyGoalMinutes is a minutes target (set in Settings), so
  // progress toward it has to be measured in minutes too, not phrase count.
  const dailyGoal = Math.max(5, settings.dailyGoalMinutes || 5);
  const todayMinutes = Math.round(stats.todayTime / 60);
  const dailyProgress = Math.min(todayMinutes / dailyGoal, 1);
  const goalMet = dailyProgress >= 1;

  // Onboarding placement-check baseline vs. current average — only shown for
  // users who actually did the check and have scored sessions since.
  const sinceDay1 = (settings.baselineScore != null && stats.avgScore != null)
    ? Math.round(stats.avgScore - settings.baselineScore)
    : null;

  // Achievements
  const getFieldVal = (field) => {
    if (field === 'sessions') return stats.totalSessions;
    if (field === 'phrases') return stats.totalPhrases;
    if (field === 'streak') return Math.max(stats.streak, stats.bestStreak);
    if (field === 'mastered') return stats.masteredCount;
    if (field === 'realWorldUses') return stats.realWorldCount;
    return 0;
  };
  const unlocked = ACHIEVEMENTS.filter(a => getFieldVal(a.field) >= a.threshold);
  const locked = ACHIEVEMENTS.filter(a => getFieldVal(a.field) < a.threshold)
    .sort((a, b) => (getFieldVal(a.field) / a.threshold) - (getFieldVal(b.field) / b.threshold))
    .reverse(); // closest to unlock first
  const nextToUnlock = locked.slice(0, showAllAchievements ? locked.length : 3);

  return (
    <div className={styles.panel}>

      {/* ── Number strip — said in person leads ── */}
      <div className={styles.numberStrip}>
        <div className={styles.stripStat}>
          <span className={styles.stripNum}>{stats.realWorldCount}</span>
          <span className={styles.stripLabel}>Said in person</span>
        </div>
        <div className={styles.stripStat}>
          <span className={styles.stripNum}>{stats.totalPhrases}</span>
          <span className={styles.stripLabel}>Phrases saved</span>
        </div>
        <div className={styles.stripStat}>
          <span className={`${styles.stripNum} ${styles.stripNumGreen}`}>{stats.masteredCount}</span>
          <span className={styles.stripLabel}>Mastered</span>
        </div>
        <div className={styles.stripStat}>
          <span className={styles.stripNum}>{stats.totalSessions}</span>
          <span className={styles.stripLabel}>Sessions</span>
        </div>
        <div className={styles.stripStat}>
          <span className={styles.stripNum}>{stats.totalTime > 0 ? formatTime(stats.totalTime) : '—'}</span>
          <span className={styles.stripLabel}>Time practiced</span>
        </div>
        <div className={styles.stripStat}>
          <span className={styles.stripNum}>{stats.toneAccuracy != null ? `${stats.toneAccuracy}%` : '—'}</span>
          <span className={styles.stripLabel}>Tone accuracy</span>
        </div>
        {sinceDay1 !== null && (
          <div className={styles.stripStat}>
            <span className={`${styles.stripNum} ${sinceDay1 >= 0 ? styles.stripNumGreen : ''}`}>
              {sinceDay1 > 0 ? `+${sinceDay1}` : sinceDay1}
            </span>
            <span className={styles.stripLabel}>Since day 1</span>
          </div>
        )}
      </div>

      {/* ── Streak ── */}
      <section className={styles.textSection}>
        <p className={styles.sectionKicker}>Streak</p>
        <p className={styles.sectionLine}><b>{msg.headline}</b> {msg.sub}</p>
        {stats.bestStreak > stats.streak && stats.bestStreak > 1 && (
          <p className={styles.sectionMeta}>Best: {stats.bestStreak} days</p>
        )}
        <div className={styles.weekTicks}>
          {weekDays.map(d => (
            <div key={d.date} className={styles.weekTick}>
              <span className={`${styles.tickDot} ${d.active ? styles.tickDotActive : ''}`} />
              <span className={`${styles.tickLabel} ${d.isToday ? styles.tickLabelToday : ''}`}>{d.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.sectionMeta}>
          {weekActive}/7 this week · {goalMet ? 'today’s goal met' : `${todayMinutes}/${dailyGoal} min today`}
        </p>
      </section>

      {/* ── Level ── */}
      <section className={styles.textSection}>
        <p className={styles.sectionKicker}>Level</p>
        <p className={styles.sectionLine}><b>Level {level.level}, {level.title}.</b> {level.desc}</p>
        {level.next && (
          <>
            <div className={styles.thinTrack}>
              <div className={styles.thinFill} style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
            <p className={styles.sectionMeta}>{xp} XP · {level.next.xp - xp} XP to Level {level.next.level}, {level.next.title}</p>
          </>
        )}
        <div className={styles.xpRules}>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+10</span>Completing a session</div>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+5</span>Each phrase practiced</div>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+2</span>Each phrase mastered</div>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+20</span>Each phrase used in person</div>
        </div>
      </section>

      {/* ── Achievements ── */}
      <section className={styles.textSection}>
        <div className={styles.sectionHeaderRow}>
          <p className={styles.sectionKicker}>Achievements</p>
          <span className={styles.sectionMeta}>{unlocked.length}/{ACHIEVEMENTS.length} earned</span>
        </div>

        {unlocked.length > 0 && (
          <div className={styles.achieveFlatList}>
            {unlocked.map(a => (
              <div key={a.id} className={styles.achieveFlatRow}>
                <span className={styles.achieveFlatLabel}>{a.label}</span>
                <span className={styles.achieveFlatDone}>Earned</span>
              </div>
            ))}
          </div>
        )}

        {nextToUnlock.length > 0 && (
          <div className={styles.achieveFlatList} style={{ marginTop: unlocked.length > 0 ? 10 : 0 }}>
            {nextToUnlock.map(a => {
              const val = getFieldVal(a.field);
              const progress = Math.min(val / a.threshold, 1);
              return (
                <div key={a.id} className={styles.achieveFlatRow}>
                  <div className={styles.achieveFlatText}>
                    <div className={styles.achieveFlatTop}>
                      <span className={styles.achieveFlatLabel}>{a.label}</span>
                      <span className={styles.achieveFlatCount}>{val}/{a.threshold}</span>
                    </div>
                    <span className={styles.achieveFlatDesc}>{a.desc}</span>
                    <div className={styles.thinTrackSmall}>
                      <div className={styles.thinFillSmall} style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {locked.length > 3 && (
          <button className={styles.showMoreBtn} onClick={() => setShowAllAchievements(v => !v)}>
            {showAllAchievements ? 'Show less' : `See ${locked.length - 3} more to earn`}
          </button>
        )}
      </section>
    </div>
  );
}
