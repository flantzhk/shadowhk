// src/utils/levels.js — XP leveling system

const LEVELS = [
  { level: 1, xp: 0, title: 'Beginner', desc: 'Getting started. Every phrase counts.' },
  { level: 2, xp: 50, title: 'Explorer', desc: 'You know some basics and are building momentum.' },
  { level: 3, xp: 150, title: 'Speaker', desc: 'You can say simple phrases with confidence.' },
  { level: 4, xp: 350, title: 'Conversant', desc: 'You can hold a basic conversation.' },
  { level: 5, xp: 600, title: 'Confident', desc: 'You speak comfortably in everyday situations.' },
  { level: 6, xp: 1000, title: 'Advanced', desc: 'You express yourself naturally and clearly.' },
  { level: 7, xp: 1500, title: 'Master', desc: 'You have deep command of the language.' },
  { level: 8, xp: 2500, title: 'Expert', desc: 'You have reached the highest level of mastery.' },
];

export function getLevel(totalXP) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXP >= l.xp) current = l;
    else break;
  }
  const next = LEVELS.find(l => l.xp > totalXP) || null;
  const progress = next
    ? (totalXP - current.xp) / (next.xp - current.xp)
    : 1;
  return { ...current, next, progress, totalXP };
}

/** XP: 10 per session + 5 per phrase practiced + 2 per mastered phrase */
export function calcXP({ totalSessions, totalPhrasesPracticed, masteredCount }) {
  return (totalSessions * 10) + (totalPhrasesPracticed * 5) + (masteredCount * 2);
}

export { LEVELS };
