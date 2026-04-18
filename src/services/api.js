// src/services/api.js — API wrapper with auth token (proxy handles API key)

import { API_BASE_URL, API_ENDPOINTS, MAX_RETRIES, API_TIMEOUT_MS } from '../utils/constants';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getAuthToken, refreshTokenIfNeeded, signOut } from './auth';

/**
 * Fetch with retry logic and timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [maxRetries]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (response.status === 429) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new ApiError(
          `API error: ${response.status}`,
          response.status,
          url
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new ApiError('Request timed out', 408, url);
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch with auth token. Refreshes token if needed, injects Bearer header.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function fetchWithAuth(url, options = {}) {
  const isValid = await refreshTokenIfNeeded();
  if (!isValid) {
    signOut();
    throw new ApiError('Session expired. Please sign in again.', 401, url);
  }

  const token = await getAuthToken();
  if (!token) {
    signOut();
    throw new ApiError('Session expired. Please sign in again.', 401, url);
  }
  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
  };

  return fetchWithRetry(url, { ...options, headers });
}

/**
 * Score user pronunciation against expected text.
 * @param {Blob} audioBlob - Recorded audio
 * @param {string} expectedText - The Chinese text to compare against
 * @param {'cantonese'|'english'|'mandarin'} [language='cantonese']
 * @returns {Promise<Object>}
 */
async function scorePronunciation(audioBlob, expectedText, language = 'cantonese') {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.ogg');
  formData.append('text', expectedText);
  formData.append('language', language);

  const response = await fetchWithAuth(
    `${API_BASE_URL}${API_ENDPOINTS.SCORE_PRONUNCIATION}`,
    { method: 'POST', body: formData }
  );

  return response.json();
}

/**
 * Generate speech audio from text.
 * @param {string} text - Chinese text
 * @param {Object} options
 * @param {string} [options.language='cantonese']
 * @param {number} [options.speed=1.0]
 * @param {string} [options.outputExtension='mp3']
 * @param {string} [options.voiceId]
 * @param {boolean} [options.turbo=false]
 * @returns {Promise<Blob>} Audio blob
 */
async function textToSpeech(text, options = {}) {
  const {
    language = 'cantonese',
    speed = 1.0,
    outputExtension = 'mp3',
    voiceId,
    turbo = false,
  } = options;

  const body = {
    text,
    language,
    speed,
    output_extension: outputExtension,
    should_use_turbo_model: turbo,
  };

  if (voiceId) {
    body.voice_id = voiceId;
  }

  const response = await fetchWithAuth(
    `${API_BASE_URL}${API_ENDPOINTS.TTS}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  return response.blob();
}

/**
 * Transcribe speech to text.
 * @param {Blob} audioBlob
 * @returns {Promise<{text: string, duration: string}>}
 */
async function speechToText(audioBlob) {
  const formData = new FormData();
  formData.append('data', audioBlob, 'recording.ogg');

  const response = await fetchWithAuth(
    `${API_BASE_URL}${API_ENDPOINTS.STT}`,
    { method: 'POST', body: formData }
  );

  return response.json();
}

/**
 * Convert Chinese text to Jyutping romanization.
 * Free endpoint — hits cantonese.ai directly, no auth needed.
 * @param {string} text
 * @param {'text'|'list'} [outputType='list']
 * @returns {Promise<Object>}
 */
async function textToJyutping(text, outputType = 'list') {
  const response = await fetchWithRetry(
    'https://cantonese.ai/api/text-to-jyutping',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, outputType }),
    }
  );

  return response.json();
}

/**
 * Generate English speech via ElevenLabs (proxied through Cloudflare Worker).
 * @param {string} text - English text to speak
 * @returns {Promise<Blob>} MP3 audio blob
 */
async function englishTTS(text) {
  const response = await fetchWithAuth(
    `${API_BASE_URL}${API_ENDPOINTS.TTS_ENGLISH}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  );
  return response.blob();
}

/**
 * Create a Stripe Checkout session for the given plan.
 * Requires the user to be authenticated (Firebase token injected via fetchWithAuth).
 * @param {'monthly'|'annual'|'lifetime'|'family'} planId
 * @returns {Promise<{url: string}>} Stripe Checkout URL to redirect the user to
 */
async function createCheckoutSession(planId) {
  const response = await fetchWithAuth(
    `${API_BASE_URL}${API_ENDPOINTS.STRIPE_CHECKOUT}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    }
  );

  return response.json();
}

async function generatePhrase(text, language) {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/generate-phrase`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    }
  );
  return response.json();
}

function getAudioUrl(audioFile, language) {
  return `/shadowhk/audio/${language}/${audioFile}`;
}

export {
  scorePronunciation,
  textToSpeech,
  englishTTS,
  speechToText,
  textToJyutping,
  fetchWithAuth,
  generatePhrase,
  getAudioUrl,
  createCheckoutSession,
};
