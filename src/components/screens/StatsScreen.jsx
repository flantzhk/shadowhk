// src/components/screens/StatsScreen.jsx — Encouraging progress dashboard

import { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getAllLibraryEntries, getAllSessions } from '../../services/storage';
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

export default function StatsScreen({ onBack, onNavigate }) {
  const { settings } = useAppContext();
  const [stats, setStats] = useState(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  useEffect(() => {
    (async () => {
      const entries = await getAllLibraryEntries();
      const sessions = await getAllSessions();
      const learningCount = entries.filter(e => e.status === 'learning').length;
      const masteredCount = entries.filter(e => e.status === 'mastered').length;
      const totalPhrasesPracticed = sessions.reduce((sum, s) => sum + (s.phrasesAttempted || 0), 0);
      const scores = sessions.filter(s => s.averageScore != null).map(s => s.averageScore);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const sessionDates = new Set(sessions.map(s => s.date));

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

      setStats({
        totalPhrases: entries.length, learningCount, masteredCount,
        totalSessions: sessions.length, avgScore, sessionDates,
        totalTime: settings.totalPracticeSeconds,
        streak: settings.streakCount,
        bestStreak, totalPhrasesPracticed,
        todayPhrases, todayTime,
      });
    })();
  }, [settings]);

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

  // Daily goal
  const dailyGoal = Math.max(5, settings.dailyGoalMinutes || 5);
  const dailyProgress = Math.min(stats.todayPhrases / dailyGoal, 1);
  const goalMet = dailyProgress >= 1;

  // Achievements
  const getFieldVal = (field) => {
    if (field === 'sessions') return stats.totalSessions;
    if (field === 'phrases') return stats.totalPhrases;
    if (field === 'streak') return Math.max(stats.streak, stats.bestStreak);
    if (field === 'mastered') return stats.masteredCount;
    return 0;
  };
  const unlocked = ACHIEVEMENTS.filter(a => getFieldVal(a.field) >= a.threshold);
  const locked = ACHIEVEMENTS.filter(a => getFieldVal(a.field) < a.threshold)
    .sort((a, b) => (getFieldVal(a.field) / a.threshold) - (getFieldVal(b.field) / b.threshold))
    .reverse(); // closest to unlock first
  const nextToUnlock = locked.slice(0, showAllAchievements ? locked.length : 3);

  return (
    <div className={styles.screen}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Your Progress</h1>
      </div>

      {/* ── Streak Hero ── */}
      <div className={styles.streakHero}>
        <div className={styles.streakLeft}>
          <div className={styles.flame}>
            <svg width="36" height="42" viewBox="0 0 40 48" fill="none">
              <path d="M20 0C20 0 30 12 32 22C34 32 28 42 20 46C12 42 6 32 8 22C10 12 20 0 20 0Z" fill="#E8703A" />
              <path d="M20 14C20 14 26 22 27 28C28 34 24 40 20 42C16 40 12 34 13 28C14 22 20 14 20 14Z" fill="#FFCC4D" />
              <path d="M20 26C20 26 23 30 23 33C23 36 22 38 20 39C18 38 17 36 17 33C17 30 20 26 20 26Z" fill="#FFE8A0" />
            </svg>
          </div>
          <div className={styles.streakNums}>
            <span className={styles.streakNum}>{stats.streak}</span>
            <span className={styles.streakUnit}>day streak</span>
          </div>
        </div>
        <div className={styles.streakRight}>
          <span className={styles.streakHeadline}>{msg.headline}</span>
          <span className={styles.streakSub}>{msg.sub}</span>
          {stats.bestStreak > stats.streak && stats.bestStreak > 1 && (
            <span className={styles.bestStreak}>Best: {stats.bestStreak} days</span>
          )}
        </div>
      </div>

      {/* ── Today + Week side by side ── */}
      <div className={styles.todayWeekRow}>
        {/* Today's goal */}
        <div className={styles.todayCard}>
          <span className={styles.cardLabel}>Today</span>
          <div className={styles.ringWrap}>
            <svg viewBox="0 0 60 60" className={styles.ringSvg}>
              <circle cx="30" cy="30" r="24" className={styles.ringTrack} />
              <circle cx="30" cy="30" r="24" className={styles.ringFill}
                style={{ strokeDasharray: `${2 * Math.PI * 24}`, strokeDashoffset: `${2 * Math.PI * 24 * (1 - dailyProgress)}` }}
              />
            </svg>
            <span className={styles.ringInner}>
              {goalMet ? '✓' : stats.todayPhrases}
            </span>
          </div>
          <span className={styles.todayGoalLabel}>
            {goalMet ? 'Goal met!' : `${stats.todayPhrases}/${dailyGoal} phrases`}
          </span>
          {stats.todayTime > 0 && (
            <span className={styles.todayTime}>{formatTime(stats.todayTime)}</span>
          )}
        </div>

        {/* This week */}
        <div className={styles.weekCard}>
          <div className={styles.weekTop}>
            <span className={styles.cardLabel}>This week</span>
            <span className={styles.weekCount}>{weekActive}/7</span>
          </div>
          <div className={styles.weekRow}>
            {weekDays.map(d => (
              <div key={d.date} className={styles.weekDay}>
                <div className={`${styles.weekDot} ${d.active ? styles.weekDotActive : ''} ${d.isToday && !d.active ? styles.weekDotToday : ''}`}>
                  {d.active && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={`${styles.weekLabel} ${d.isToday ? styles.weekLabelToday : ''}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lifetime Stats ── */}
      <div className={styles.statsGrid}>
        <div className={styles.statTile}>
          <span className={styles.statNum}>{stats.totalSessions}</span>
          <span className={styles.statLabel}>Sessions</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statNum}>{stats.totalPhrases}</span>
          <span className={styles.statLabel}>Phrases saved</span>
        </div>
        <div className={styles.statTile}>
          <span className={`${styles.statNum} ${styles.statNumGreen}`}>{stats.masteredCount}</span>
          <span className={styles.statLabel}>Mastered</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statNum}>{stats.totalTime > 0 ? formatTime(stats.totalTime) : '—'}</span>
          <span className={styles.statLabel}>Time practiced</span>
        </div>
      </div>

      {/* ── Level ── */}
      <div className={styles.levelCard}>
        <div className={styles.levelTop}>
          <div className={styles.levelBadgeLarge}>
            <span className={styles.levelBadgeNum}>{level.level}</span>
          </div>
          <div className={styles.levelInfo}>
            <span className={styles.levelTitle}>{level.title}</span>
            <span className={styles.levelDesc}>{level.desc}</span>
          </div>
          <span className={styles.xpChip}>{xp} XP</span>
        </div>

        {level.next && (
          <div className={styles.levelProgress}>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
            <div className={styles.levelProgressRow}>
              <span className={styles.levelProgressLabel}>Level {level.next.level}: {level.next.title}</span>
              <span className={styles.xpRemaining}>{level.next.xp - xp} XP away</span>
            </div>
          </div>
        )}

        <div className={styles.xpRules}>
          <span className={styles.xpRulesTitle}>Earn XP by practising</span>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+10</span>Completing a session</div>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+5</span>Each phrase practiced</div>
          <div className={styles.xpRuleRow}><span className={styles.xpAmount}>+2</span>Each phrase mastered</div>
        </div>
      </div>

      {/* ── Achievements ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Achievements</h2>
          <span className={styles.sectionCount}>{unlocked.length}/{ACHIEVEMENTS.length} earned</span>
        </div>

        {unlocked.length > 0 && (
          <>
            <p className={styles.achieveSub}>Earned</p>
            <div className={styles.achieveGrid}>
              {unlocked.map(a => (
                <div key={a.id} className={`${styles.achieveCard} ${styles.achieveUnlocked}`}>
                  <span className={styles.achieveEmoji}>{a.icon}</span>
                  <span className={styles.achieveLabel}>{a.label}</span>
                  <span className={styles.achieveDesc}>{a.desc}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {nextToUnlock.length > 0 && (
          <>
            <p className={styles.achieveSub} style={{ marginTop: unlocked.length > 0 ? 16 : 0 }}>
              {unlocked.length === 0 ? 'Closest to earning' : 'Up next'}
            </p>
            <div className={styles.achieveList}>
              {nextToUnlock.map(a => {
                const val = getFieldVal(a.field);
                const progress = Math.min(val / a.threshold, 1);
                return (
                  <div key={a.id} className={styles.achieveRow}>
                    <span className={styles.achieveRowEmoji}>{a.icon}</span>
                    <div className={styles.achieveRowText}>
                      <div className={styles.achieveRowTop}>
                        <span className={styles.achieveRowLabel}>{a.label}</span>
                        <span className={styles.achieveRowCount}>{val}/{a.threshold}</span>
                      </div>
                      <span className={styles.achieveRowDesc}>{a.how}</span>
                      <div className={styles.achieveRowBar}>
                        <div className={styles.achieveRowFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {locked.length > 3 && (
          <button className={styles.showMoreBtn} onClick={() => setShowAllAchievements(v => !v)}>
            {showAllAchievements ? 'Show less' : `See ${locked.length - 3} more to unlock`}
          </button>
        )}
      </section>
    </div>
  );
}
