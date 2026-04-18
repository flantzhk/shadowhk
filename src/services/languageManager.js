// src/services/languageManager.js — Language pack loading and switching

import { logger } from '../utils/logger';

const languagePacks = import.meta.glob('../data/languages/*.json', { eager: true });
const topicsByLanguage = {
  cantonese: import.meta.glob('../data/topics/cantonese/*.json', { eager: true }),
  mandarin: import.meta.glob('../data/topics/mandarin/*.json', { eager: true }),
};

/**
 * Get a language pack by ID.
 * @param {string} languageId
 * @returns {Object|null}
 */
function getLanguagePack(languageId) {
  for (const mod of Object.values(languagePacks)) {
    const pack = mod.default || mod;
    if (pack.id === languageId) return pack;
  }
  logger.warn(`Language pack not found: ${languageId}`);
  return null;
}

/**
 * Get all available language packs.
 * @returns {Object[]}
 */
function getAllLanguages() {
  return Object.values(languagePacks).map(mod => mod.default || mod);
}

/**
 * Load all topics for a language.
 * @param {string} languageId
 * @returns {Object[]}
 */
function getTopicsForLanguage(languageId) {
  const modules = topicsByLanguage[languageId];
  if (!modules) return [];
  return Object.values(modules).flatMap(mod => mod.default || mod);
}

/**
 * Load all phrases across all topics for a language.
 * @param {string} languageId
 * @returns {Object[]}
 */
function getAllPhrasesForLanguage(languageId) {
  const topics = getTopicsForLanguage(languageId);
  return topics.flatMap(t => t.phrases || []);
}

/**
 * Get the romanization label for a language.
 * @param {string} languageId
 * @returns {string}
 */
function getRomanizationLabel(languageId) {
  const pack = getLanguagePack(languageId);
  return pack?.romanizationLabel || 'ROMANIZATION';
}

/**
 * Get the pronunciation pass threshold for a language.
 * @param {string} languageId
 * @returns {number}
 */
function getPassThreshold(languageId) {
  const pack = getLanguagePack(languageId);
  return pack?.pronunciationPassThreshold || 70;
}

export {
  getLanguagePack,
  getAllLanguages,
  getTopicsForLanguage,
  getAllPhrasesForLanguage,
  getRomanizationLabel,
  getPassThreshold,
};
