// Static-first audio lookups. Every pre-generated MP3 lives under
// public/audio/ — phrases by id, single words/characters by text.
// Returning null means "not available statically, use the TTS fallback".

async function fetchAudioBlob(url) {
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.size > 500) return blob;
    }
  } catch (e) { /* offline miss or 404 — caller falls back */ }
  return null;
}

const base = () => import.meta.env.BASE_URL || '/';

/** Pre-recorded phrase/line audio: audio/{language}/{id}.mp3 */
export function staticPhraseAudio(id, language = 'cantonese') {
  if (!id) return Promise.resolve(null);
  return fetchAudioBlob(`${base()}audio/${language}/${id}.mp3`);
}

/** Warm the cache for a set of breakdown words so taps play instantly.
 * Fire-and-forget: the service worker's cache-first route stores each hit. */
export function prefetchWordAudio(words) {
  for (const w of words || []) {
    const text = typeof w === 'string' ? w : w?.chinese;
    if (text) fetch(`${base()}audio/cantonese-words/${encodeURIComponent(text)}.mp3`).catch(() => {});
  }
}

/** Pre-recorded single word/character audio: audio/cantonese-words/{word}.mp3 */
export function staticWordAudio(word) {
  if (!word) return Promise.resolve(null);
  return fetchAudioBlob(`${base()}audio/cantonese-words/${encodeURIComponent(word)}.mp3`);
}
