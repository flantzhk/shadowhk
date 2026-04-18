// src/services/dialogueLoader.js — Load dialogue scene data

import { logger } from '../utils/logger';

/**
 * Load all dialogue scenes for a given topic.
 * @param {string} topicId
 * @returns {Promise<Object[]>}
 */
async function loadDialoguesForTopic(topicId) {
  // First check inline dialogueScenes on topic data
  const topicModules = import.meta.glob('../data/topics/cantonese/*.json', { eager: true });
  const topic = Object.values(topicModules)
    .flatMap(m => m.default || m)
    .find(t => t.id === topicId);
  if (topic?.dialogueScenes?.length) return topic.dialogueScenes;

  // Fallback to separate dialogue files
  const modules = import.meta.glob('../data/dialogues/cantonese/*.json', { eager: true });
  const scenes = [];
  for (const mod of Object.values(modules)) {
    const data = mod.default || mod;
    const arr = Array.isArray(data) ? data : [data];
    for (const scene of arr) {
      if (scene.topicId === topicId) scenes.push(scene);
    }
  }
  return scenes;
}

/**
 * Load all dialogue scenes across all topics.
 * @returns {Promise<Object[]>}
 */
async function loadAllDialogues() {
  const modules = import.meta.glob('../data/dialogues/cantonese/*.json', { eager: true });
  const scenes = [];
  for (const mod of Object.values(modules)) {
    const data = mod.default || mod;
    const arr = Array.isArray(data) ? data : [data];
    scenes.push(...arr);
  }
  return scenes;
}

export { loadDialoguesForTopic, loadAllDialogues };
