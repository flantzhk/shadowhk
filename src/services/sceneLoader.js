// src/services/sceneLoader.js — Loads scene JSON files, normalises romanisation

/**
 * Scene JSON files use language-specific romanisation keys:
 *   Cantonese: "jyutping"
 *   Mandarin:  "pinyin"
 *
 * This loader normalises all lines to use the key "romanization" so that
 * every UI component is language-agnostic. This is the single point of
 * language abstraction for scene content.
 */

const cache = {};

/**
 * Detect the romanisation key used in the JSON (jyutping | pinyin | romanization).
 * @param {Object[]} lines
 * @returns {string}
 */
function detectRomKey(lines) {
  if (!lines?.length) return 'romanization';
  const first = lines[0];
  if ('jyutping' in first) return 'jyutping';
  if ('pinyin' in first) return 'pinyin';
  return 'romanization';
}

/**
 * Normalise a raw scene object: rename jyutping/pinyin → romanization on every line.
 * @param {Object} raw
 * @returns {Object}
 */
function normalise(raw) {
  const romKey = detectRomKey(raw.lines);
  if (romKey === 'romanization') return raw;
  return {
    ...raw,
    lines: raw.lines.map((line) => {
      const { [romKey]: rom, ...rest } = line;
      return { ...rest, romanization: rom };
    }),
  };
}

/**
 * Load a single scene by ID.
 * Fetches /scenes/{id}.json relative to the app base.
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getSceneById(id) {
  if (cache[id]) return cache[id];
  const base = import.meta.env.BASE_URL || '/';
  const url = `${base}scenes/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scene not found: ${id} (${res.status})`);
  const raw = await res.json();
  const scene = normalise(raw);
  cache[id] = scene;
  return scene;
}

/**
 * Load all scenes for a given language and optional category.
 * Requires /scenes/index.json listing all available scene IDs.
 * @param {string} language - 'cantonese' | 'mandarin'
 * @param {string} [category] - filter by category if provided
 * @returns {Promise<Object[]>}
 */
async function getScenesByCategory(language, category) {
  const all = await getAllScenes(language);
  if (!category) return all;
  return all.filter((s) => s.category === category);
}

/**
 * Load all scenes for a given language.
 * @param {string} language - 'cantonese' | 'mandarin'
 * @returns {Promise<Object[]>}
 */
async function getAllScenes(language) {
  const cacheKey = `all:${language}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const base = import.meta.env.BASE_URL || '/';
  const idxUrl = `${base}scenes/index.json`;
  const idxRes = await fetch(idxUrl);
  if (!idxRes.ok) throw new Error(`Scene index not found (${idxRes.status})`);
  const index = await idxRes.json();

  const ids = index
    .filter((entry) => !entry.language || entry.language === language)
    .map((entry) => (typeof entry === 'string' ? entry : entry.id));

  const scenes = await Promise.all(ids.map((id) => getSceneById(id)));
  const result = scenes.filter((s) => !s.language || s.language === language);
  cache[cacheKey] = result;
  return result;
}

/**
 * Returns the "you" lines from a scene — the lines the user practises.
 * @param {Object} scene
 * @returns {Object[]}
 */
function getYouLines(scene) {
  return (scene.lines || []).filter((l) => l.speaker === 'you');
}

/**
 * Derive the growth state label from an SRS interval (days).
 * Thresholds: new=0, growing>=1, strong>=7, mastered>=21.
 * @param {number} intervalDays
 * @param {number} practiceCount
 * @returns {'new'|'growing'|'strong'|'mastered'}
 */
function growthStateFromInterval(intervalDays, practiceCount) {
  if (!practiceCount || practiceCount === 0) return 'new';
  if (intervalDays >= 21) return 'mastered';
  if (intervalDays >= 7) return 'strong';
  if (intervalDays >= 1) return 'growing';
  return 'new';
}

/** Clear the in-memory cache (useful after language switch). */
function clearSceneCache() {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
}

export {
  getSceneById,
  getAllScenes,
  getScenesByCategory,
  getYouLines,
  growthStateFromInterval,
  clearSceneCache,
};
