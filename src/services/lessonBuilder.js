// src/services/lessonBuilder.js — Scene-aware lesson generation

import { getDueForReview } from './srs';
import { getAllLibraryEntries } from './storage';
import { getAllScenes, getYouLines } from './sceneLoader';
import { logger } from '../utils/logger';

/**
 * Build today's lesson as a scene recommendation.
 *
 * Returns the scene where the most SRS-due phrases live, plus the due phrase
 * list and a human-readable reason string for the Home screen hero card.
 *
 * @param {string} language - 'cantonese' | 'mandarin'
 * @returns {Promise<{ scene: Object, fadingPhrases: Object[], reason: string } | null>}
 *   null if the user has no library entries yet (fresh first-run state).
 */
async function buildSceneLesson(language) {
  const [dueEntries, libraryEntries] = await Promise.all([
    getDueForReview(),
    getAllLibraryEntries(),
  ]);

  if (libraryEntries.length === 0) return null;

  // Group due phrases by scene_id
  const dueByScene = {};
  for (const entry of dueEntries) {
    const sid = entry.scene_id;
    if (!sid) continue;
    if (!dueByScene[sid]) dueByScene[sid] = [];
    dueByScene[sid].push(entry);
  }

  // Find the scene with the most due phrases
  let bestSceneId = null;
  let bestCount = 0;
  for (const [sid, entries] of Object.entries(dueByScene)) {
    if (entries.length > bestCount) {
      bestCount = entries.length;
      bestSceneId = sid;
    }
  }

  // If no due phrases, find the scene the user last touched (for new phrases)
  if (!bestSceneId) {
    const sceneActivity = {};
    for (const entry of libraryEntries) {
      const sid = entry.scene_id;
      if (!sid) continue;
      const ts = entry.lastPracticedAt || entry.addedAt || 0;
      if (!sceneActivity[sid] || ts > sceneActivity[sid]) {
        sceneActivity[sid] = ts;
      }
    }
    // Least recently touched scene = most likely to need attention
    let oldestTs = Infinity;
    for (const [sid, ts] of Object.entries(sceneActivity)) {
      if (ts < oldestTs) {
        oldestTs = ts;
        bestSceneId = sid;
      }
    }
  }

  if (!bestSceneId) return null;

  // Load the full scene
  let scene;
  try {
    const { getSceneById } = await import('./sceneLoader');
    scene = await getSceneById(bestSceneId);
  } catch (err) {
    logger.error('lessonBuilder: failed to load scene', bestSceneId, err);
    return null;
  }

  const fadingPhrases = dueByScene[bestSceneId] || [];
  const reason = buildReason(fadingPhrases, libraryEntries, bestSceneId);

  logger.info(`lessonBuilder: scene=${bestSceneId} fading=${fadingPhrases.length}`);
  return { scene, fadingPhrases, reason };
}

/**
 * Build a human-readable reason string for the hero card.
 * Examples:
 *   "3 phrases from this scene are fading. Replay + 2 new lines."
 *   "You haven't practised this scene yet. Start here."
 *   "All phrases are solid. Try the next scene."
 */
function buildReason(fadingPhrases, libraryEntries, sceneId) {
  const sceneEntries = libraryEntries.filter((e) => e.scene_id === sceneId);
  const newCount = sceneEntries.filter((e) => !e.practiceCount || e.practiceCount === 0).length;

  if (fadingPhrases.length === 0 && sceneEntries.length === 0) {
    return 'Start here — these phrases will unlock more scenes.';
  }
  if (fadingPhrases.length === 0 && newCount > 0) {
    return `${newCount} phrase${newCount === 1 ? '' : 's'} waiting to be practised.`;
  }
  if (fadingPhrases.length === 0) {
    return 'All phrases solid. Review to keep them strong.';
  }

  const dayWord = _daysAgo(fadingPhrases);
  const parts = [];
  if (fadingPhrases.length === 1) {
    parts.push(`1 phrase from ${dayWord} is fading.`);
  } else {
    parts.push(`${fadingPhrases.length} phrases from ${dayWord} are fading.`);
  }
  if (newCount > 0) {
    parts.push(`Replay + ${newCount} new line${newCount === 1 ? '' : 's'}.`);
  }
  return parts.join(' ');
}

function _daysAgo(entries) {
  if (!entries.length) return 'earlier';
  const oldest = Math.min(...entries.map((e) => e.lastPracticedAt || Date.now()));
  const days = Math.round((Date.now() - oldest) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return `${days} days ago`;
  return 'a while back';
}

/**
 * Legacy compatibility: build a flat phrase queue from a scene.
 * Used by carry-over drill modes that still expect an array of phrases.
 * @param {Object} scene
 * @returns {Object[]} "you" lines with full phrase data
 */
function buildPhraseQueueFromScene(scene) {
  return getYouLines(scene);
}

// Compat shims for carry-over screens (PromptDrill, SpeedRun)
// normaliseEntry adds `id` as an alias for `phraseId` so v1 code that reads `.id` still works.
function normaliseEntry(e) {
  return e.id ? e : { ...e, id: e.phraseId };
}

async function buildLesson(goalMinutes, language) {
  const { getDueEntries, getAllLibraryEntries } = await import('./storage.js');
  const due = await getDueEntries();
  const all = await getAllLibraryEntries();
  const pool = due.length > 0 ? due : all.filter(e => !e.language || e.language === language);
  const maxPhrases = Math.max(5, Math.floor((goalMinutes || 10) * 1.5));
  return pool.slice(0, maxPhrases).map(normaliseEntry);
}

async function loadAllPhrases(language) {
  const { getAllLibraryEntries } = await import('./storage.js');
  const all = await getAllLibraryEntries();
  return all.filter(e => !e.language || e.language === language).map(normaliseEntry);
}

export { buildSceneLesson, buildPhraseQueueFromScene, buildLesson, loadAllPhrases };
