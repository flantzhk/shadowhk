// src/utils/validators.js — Input validation

const MAX_INPUT_LENGTH = 500;

/**
 * Sanitize user text input to prevent injection.
 * @param {string} text
 * @returns {string}
 */
function sanitizeInput(text) {
  return text
    .trim()
    .slice(0, MAX_INPUT_LENGTH)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

/**
 * Validate an API key format.
 * @param {string} key
 * @returns {boolean}
 */
function isValidApiKey(key) {
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Validate a phrase ID format.
 * @param {string} id
 * @returns {boolean}
 */
function isValidPhraseId(id) {
  return typeof id === 'string' && /^[a-z0-9-]+$/.test(id);
}

export { sanitizeInput, isValidApiKey, isValidPhraseId, MAX_INPUT_LENGTH };
