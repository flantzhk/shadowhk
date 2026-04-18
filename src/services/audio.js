// src/services/audio.js — Audio playback engine, recording, caching

import { textToSpeech, englishTTS } from './api';
import { isAuthenticated } from './auth';
import { AUDIO_CACHE_NAME, AUTO_ADVANCE_DELAY_MS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Audio engine with queue management.
 * Handles: play, pause, seek, speed, repeat-one, auto-advance.
 */
// How long to wait after Chinese phrase for the user to repeat (shadow mode)
const SHADOW_REPEAT_DELAY_MS = 4500;
// Gap between English TTS and Chinese audio in shadow mode
const SHADOW_ENGLISH_GAP_MS = 1200;

// Minimal valid silent WAV (44 bytes, 0 samples) for priming audio elements on iOS.
// iOS Safari requires at least one successful .play() call during a user gesture before
// async .play() calls are allowed. Setting this as the initial src makes priming work.
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

class AudioEngine {
  constructor() {
    this._audio = new Audio();
    this._queue = [];
    this._currentIndex = 0;
    this._isRepeatOne = false;
    this._speed = 1.0;
    this._language = 'cantonese';
    this._autoAdvance = true;
    this._advanceTimer = null;
    this._currentBlobUrl = null;
    this._shadowMode = false;        // When true: English → pause → Chinese → long gap
    this._englishUtterance = null;   // Track current SpeechSynthesis utterance
    this._englishAudio = new Audio(); // Separate element for English TTS (primed once)
    this._englishAudio.src = SILENT_AUDIO_URI; // Needs valid src so iOS priming succeeds
    this._englishBlobUrl = null;      // Blob URL for current English clip

    /** @type {((phrase: Object, index: number) => void)|null} */
    this._onPhraseChange = null;
    /** @type {((state: string) => void)|null} */
    this._onStateChange = null;
    /** @type {((time: number, duration: number) => void)|null} */
    this._onTimeUpdate = null;

    this._audio.addEventListener('ended', () => this._handleEnded());
    this._audio.addEventListener('error', (e) => this._handleError(e));
    this._audio.addEventListener('timeupdate', () => {
      this._onTimeUpdate?.(this._audio.currentTime, this._audio.duration);
    });
    this._audio.addEventListener('play', () => {
      this._onStateChange?.('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    this._audio.addEventListener('pause', () => {
      if (!this._audio.ended) this._onStateChange?.('paused');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
  }

  /** Load a lesson (ordered list of phrases) into the queue.
   * @param {Object[]} phrases
   * @param {string} language
   * @param {{ shadowMode?: boolean }} [options]
   */
  async loadQueue(phrases, language, options = {}) {
    this._shadowMode = options.shadowMode === true;
    this._queue = phrases;
    this._language = language;
    this._currentIndex = 0;
    await this._loadCurrentPhrase();
    // If the first phrase failed to load (no auth, no cache, no static file),
    // _audio.src will be empty. Throw so callers (AudioContext, ShadowSession)
    // hit their catch block and set a visible error state instead of hanging.
    if (!this._audio.src) {
      throw new Error('Failed to load audio: no source available for first phrase');
    }
  }

  async _loadCurrentPhrase() {
    const phrase = this._queue[this._currentIndex];
    if (!phrase) return;

    this._revokeBlobUrl();
    this._clearAdvanceTimer();

    try {
      const speedNum = this._speed === 'slower' ? 0.75
        : typeof this._speed === 'number' ? this._speed : 1.0;

      // Try static audio file first (pre-generated)
      const basePath = import.meta.env.BASE_URL || '/';
      const staticUrl = `${basePath}audio/${this._language}/${phrase.id}.mp3`;

      try {
        const resp = await fetch(staticUrl);
        if (resp.ok) {
          let blob = await resp.blob();
          if (blob.size > 500) {
            blob = await padAudioBlob(blob);
            this._currentBlobUrl = URL.createObjectURL(blob);
            this._audio.src = this._currentBlobUrl;
            this._audio.playbackRate = speedNum < 1 ? speedNum : 1.0;
            this._onPhraseChange?.(phrase, this._currentIndex);
            this._updateMediaSession();
            this._prefetchUpcoming(speedNum);
            return;
          }
        }
      } catch (e) {
        // Static file not available, fall through to TTS API
      }

      // Fallback: try browser cache
      const cached = await getCachedAudio(phrase.id, this._language, speedNum);
      if (cached) {
        const paddedCached = await padAudioBlob(cached);
        this._currentBlobUrl = URL.createObjectURL(paddedCached);
        this._audio.src = this._currentBlobUrl;
      } else if (isAuthenticated()) {
        // Fallback: TTS API
        let blob = await textToSpeech(phrase.chinese, {
          language: this._language,
          speed: speedNum,
          outputExtension: 'mp3',
        });
        if (!blob || blob.size === 0) {
          logger.error('TTS returned empty blob for', phrase.id);
          this._onStateChange?.('error');
          this._onPhraseChange?.(phrase, this._currentIndex);
          return;
        }
        cacheAudioBlob(phrase.id, this._language, speedNum, blob).catch(() => {});
        blob = await padAudioBlob(blob);
        this._currentBlobUrl = URL.createObjectURL(blob);
        this._audio.src = this._currentBlobUrl;
      } else {
        logger.error('No audio source available for', phrase.id);
        this._onStateChange?.('error');
        this._onPhraseChange?.(phrase, this._currentIndex);
        return;
      }

      this._audio.playbackRate = speedNum;
      this._onPhraseChange?.(phrase, this._currentIndex);
      this._updateMediaSession();
      // Silently prefetch upcoming phrases into cache so they load instantly
      this._prefetchUpcoming(speedNum);
    } catch (error) {
      logger.error('Failed to load audio for phrase', phrase.id, ':', error?.message || error);
      this._onStateChange?.('error');
      this._onPhraseChange?.(phrase, this._currentIndex);
    }
  }

  /** Silently pre-fetch and cache the next N phrases. Fire-and-forget. */
  _prefetchUpcoming(speed) {
    const AHEAD = 3;
    for (let i = 1; i <= AHEAD; i++) {
      const idx = this._currentIndex + i;
      if (idx >= this._queue.length) break;
      this._prefetchPhrase(this._queue[idx], speed); // no await — silent
    }
  }

  /** Best-effort: check static → cache → TTS. Caches result if fetched. */
  async _prefetchPhrase(phrase, speed) {
    if (!phrase?.id) return;
    try {
      // Skip if already in browser cache
      const cached = await getCachedAudio(phrase.id, this._language, speed);
      if (cached) return;

      // Try static pre-generated file first (no API cost)
      const basePath = import.meta.env.BASE_URL || '/';
      const staticUrl = `${basePath}audio/${this._language}/${phrase.id}.mp3`;
      try {
        const resp = await fetch(staticUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 500) {
            // Cache the static file so future plays skip the network fetch
            await cacheAudioBlob(phrase.id, this._language, speed, blob);
            return;
          }
        }
      } catch (e) { /* static not available */ }

      // Fetch from TTS API and cache
      if (!isAuthenticated()) return;
      const blob = await textToSpeech(phrase.chinese, {
        language: this._language,
        speed,
        outputExtension: 'mp3',
      });
      if (blob && blob.size > 0) {
        await cacheAudioBlob(phrase.id, this._language, speed, blob);
      }
    } catch (e) {
      // Prefetch is best-effort — silent fail
    }
  }

  /**
   * Prime both audio elements during a synchronous user-gesture frame.
   * Must be called before any async operations in the click handler.
   * This marks them as "user-activated" so iOS Safari allows subsequent
   * play() calls after async work (loading, fetching) completes.
   */
  primeForUserGesture() {
    const p1 = this._audio.play();
    this._audio.pause();
    this._audio.currentTime = 0;
    p1.catch(() => {});
    const p2 = this._englishAudio.play();
    this._englishAudio.pause();
    p2.catch(() => {});
  }

  async play() {
    try {
      if (!this._audio.src) {
        this._onStateChange?.('error');
        return;
      }
      if (this._shadowMode) {
        await this._playShadowSequence();
      } else {
        await this._audio.play();
      }
    } catch (error) {
      logger.error('Play failed', error);
      this._onStateChange?.('error');
    }
  }

  /** Shadow mode: announce English → gap → play Chinese. */
  async _playShadowSequence() {
    const phrase = this._queue[this._currentIndex];
    if (!phrase) return;
    if (this._destroyed) return;

    // 1. Speak English translation via Web Speech API
    if (phrase.english) {
      await this._speakEnglish(phrase.english);
      if (this._destroyed) return;
      await this._sleep(SHADOW_ENGLISH_GAP_MS);
    }

    // 2. Play Chinese audio
    if (this._destroyed) return;
    try {
      await this._audio.play();
    } catch (e) {
      logger.error('Shadow Chinese play failed', e);
    }
  }

  /**
   * Speak English text — tries ElevenLabs first, falls back to Web Speech API.
   * @param {string} text
   */
  async _speakEnglish(text) {
    if (!text) return;
    try {
      const blob = await englishTTS(text);
      if (blob && blob.size > 0) {
        await this._playEnglishBlob(blob);
        return;
      }
    } catch (e) {
      logger.warn('ElevenLabs English TTS failed, falling back to Web Speech', e);
    }
    // Fallback: browser Web Speech API
    await this._speakEnglishWebSpeech(text);
  }

  /**
   * Play an English audio blob through the dedicated English audio element.
   * @param {Blob} blob
   */
  _playEnglishBlob(blob) {
    return new Promise((resolve) => {
      if (this._englishBlobUrl) {
        URL.revokeObjectURL(this._englishBlobUrl);
        this._englishBlobUrl = null;
      }
      this._englishBlobUrl = URL.createObjectURL(blob);
      this._englishAudio.src = this._englishBlobUrl;
      const cleanup = () => {
        if (this._englishBlobUrl) {
          URL.revokeObjectURL(this._englishBlobUrl);
          this._englishBlobUrl = null;
        }
      };
      this._englishAudio.onended = () => { cleanup(); resolve(); };
      this._englishAudio.onerror = () => { cleanup(); resolve(); };
      this._englishAudio.play().catch(() => { cleanup(); resolve(); });
    });
  }

  /** Speak text via Web Speech API (fallback). Resolves when done (or on error). */
  _speakEnglishWebSpeech(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !text) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US';
      utt.rate = 0.88;
      utt.pitch = 1.0;
      utt.onend = resolve;
      utt.onerror = resolve;
      this._englishUtterance = utt;
      window.speechSynthesis.speak(utt);
    });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  pause() {
    this._audio.pause();
    this._clearAdvanceTimer();
    // Cancel any in-progress English TTS
    if (this._shadowMode) {
      this._englishAudio.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }

  async next() {
    if (this._currentIndex < this._queue.length - 1) {
      this._currentIndex++;
      await this._loadCurrentPhrase();
    }
  }

  async previous() {
    if (this._currentIndex > 0) {
      this._currentIndex--;
      await this._loadCurrentPhrase();
    }
  }

  async retryCurrentPhrase() {
    await this._loadCurrentPhrase();
    await this.play();
  }

  async setSpeed(speed) {
    this._speed = speed;
    const wasPlaying = !this._audio.paused;
    await this._loadCurrentPhrase();
    if (wasPlaying) await this.play();
  }

  toggleRepeat() {
    this._isRepeatOne = !this._isRepeatOne;
    return this._isRepeatOne;
  }

  setAutoAdvance(value) { this._autoAdvance = value; }

  get currentPhrase() { return this._queue[this._currentIndex] || null; }
  get currentIndex() { return this._currentIndex; }
  get queueLength() { return this._queue.length; }
  get progress() { return { current: this._currentIndex + 1, total: this._queue.length }; }
  get currentTime() { return this._audio.currentTime || 0; }
  get duration() { return this._audio.duration || 0; }
  get isPlaying() { return !this._audio.paused && !this._audio.ended; }
  get isRepeatOne() { return this._isRepeatOne; }
  get speed() { return this._speed; }
  get hasQueue() { return this._queue.length > 0; }

  /** Set event callbacks. */
  on(event, callback) {
    if (event === 'phraseChange') this._onPhraseChange = callback;
    else if (event === 'stateChange') this._onStateChange = callback;
    else if (event === 'timeUpdate') this._onTimeUpdate = callback;
  }

  /** Update Media Session API for lock screen / notification controls. */
  _updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const phrase = this._queue[this._currentIndex];
    if (!phrase) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: phrase.romanization || phrase.chinese || 'ShadowSpeak',
      artist: phrase.english || 'Cantonese',
      album: 'ShadowSpeak',
    });

    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
  }

  _handleEnded() {
    if (this._isRepeatOne) {
      // Add a pause before repeating so short words have breathing room
      this._advanceTimer = setTimeout(() => {
        if (this._destroyed) return;
        this._audio.currentTime = 0;
        if (this._shadowMode) {
          this._playShadowSequence().catch(() => {});
        } else {
          this._audio.play().catch(() => {});
        }
      }, 1200);
    } else if (this._autoAdvance && this._currentIndex < this._queue.length - 1) {
      this._onStateChange?.('advancing');
      // Shadow mode: long gap so the user can repeat the Chinese phrase
      const delay = this._shadowMode ? SHADOW_REPEAT_DELAY_MS : AUTO_ADVANCE_DELAY_MS;
      this._advanceTimer = setTimeout(async () => {
        if (this._destroyed) return;
        this._currentIndex++;
        await this._loadCurrentPhrase();
        if (!this._destroyed) await this.play();
      }, delay);
    } else {
      this._onStateChange?.('ended');
    }
  }

  _handleError(e) {
    logger.error('Audio playback error', e);
    this._onStateChange?.('error');
  }

  _revokeBlobUrl() {
    if (this._currentBlobUrl) {
      URL.revokeObjectURL(this._currentBlobUrl);
      this._currentBlobUrl = null;
    }
  }

  _clearAdvanceTimer() {
    if (this._advanceTimer) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
  }

  /** Stop playback and clear the queue (dismisses MiniPlayer). */
  stop() {
    this._clearAdvanceTimer();
    this._audio.pause();
    this._audio.removeAttribute('src');
    this._revokeBlobUrl();
    this._englishAudio.pause();
    if (this._englishBlobUrl) {
      URL.revokeObjectURL(this._englishBlobUrl);
      this._englishBlobUrl = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this._queue = [];
    this._currentIndex = 0;
    this._onPhraseChange?.(null, 0);
    this._onStateChange?.('idle');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  }

  destroy() {
    this._destroyed = true;
    this._clearAdvanceTimer();
    this._audio.pause();
    this._audio.removeAttribute('src');
    this._revokeBlobUrl();
    this._englishAudio.pause();
    if (this._englishBlobUrl) {
      URL.revokeObjectURL(this._englishBlobUrl);
      this._englishBlobUrl = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this._queue = [];
  }
}

// === Audio Cache ===

/**
 * Cache an audio blob for a phrase at a given speed.
 * @param {string} phraseId
 * @param {string} language
 * @param {number} speed
 * @param {Blob} blob
 */
async function cacheAudioBlob(phraseId, language, speed, blob) {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cacheKey = buildCacheKey(phraseId, language, speed);
    await cache.put(cacheKey, new Response(blob));
  } catch (error) {
    logger.warn(`Failed to cache audio for ${phraseId}`, error);
  }
}

/**
 * Get cached audio for a phrase. Returns null if not cached.
 * @param {string} phraseId
 * @param {string} language
 * @param {number} speed
 * @returns {Promise<Blob|null>}
 */
async function getCachedAudio(phraseId, language, speed) {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cacheKey = buildCacheKey(phraseId, language, speed);
    const response = await cache.match(cacheKey);
    if (!response) return null;
    return await response.blob();
  } catch (error) {
    return null;
  }
}

/**
 * Cache audio for a phrase at both speeds.
 * @param {Object} phrase
 * @param {string} language
 */
async function cacheAudioForPhrase(phrase, language) {
  if (!isAuthenticated()) return;

  for (const speed of [0.75, 1.0]) {
    const existing = await getCachedAudio(phrase.id, language, speed);
    if (existing) continue;

    try {
      const audioBlob = await textToSpeech(phrase.chinese, {
        language,
        speed,
        outputExtension: 'mp3',
      });
      await cacheAudioBlob(phrase.id, language, speed, audioBlob);
    } catch (error) {
      logger.warn(`Failed to cache audio for ${phrase.id} at speed ${speed}`);
    }
  }
}

/**
 * @param {string} phraseId
 * @param {string} language
 * @param {number} speed
 * @returns {string}
 */
function buildCacheKey(phraseId, language, speed) {
  return `audio/${language}/${phraseId}/${speed}`;
}

/**
 * Pad a short audio blob with silence before and after.
 * Only applies to audio shorter than 2 seconds.
 * @param {Blob} blob
 * @param {number} [leadMs=400]
 * @param {number} [trailMs=400]
 * @returns {Promise<Blob>}
 */
async function padAudioBlob(blob, leadMs = 400, trailMs = 400) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let decoded;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      audioCtx.close().catch(() => {});
    }

    // Only pad short clips
    if (decoded.duration >= 2.0) return blob;

    const { sampleRate, numberOfChannels: channels, length } = decoded;
    const leadFrames = Math.floor(sampleRate * leadMs / 1000);
    const trailFrames = Math.floor(sampleRate * trailMs / 1000);
    const totalFrames = leadFrames + length + trailFrames;

    const padded = new AudioBuffer({ numberOfChannels: channels, length: totalFrames, sampleRate });
    for (let c = 0; c < channels; c++) {
      padded.getChannelData(c).set(decoded.getChannelData(c), leadFrames);
    }

    return _audioBufferToWav(padded);
  } catch {
    return blob; // silently fall back to original
  }
}

/** Encode an AudioBuffer as a WAV Blob. */
function _audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const dataSize = frames * channels * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

  ws(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true);
  ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, channels, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      v.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export { AudioEngine, getCachedAudio, cacheAudioForPhrase, cacheAudioBlob, padAudioBlob };
