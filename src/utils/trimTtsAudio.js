// cantonese.ai truncates TTS audio to a duration budget of ~0.235s per input
// character, chopping the endings off short phrases — one-character words come
// back as pure silence. The static library is generated with a sacrificial
// tail + offline trim (scripts/generate-scene-audio.mjs); this is the runtime
// equivalent for live TTS: pad the request text, then cut the tail back off
// in the browser using the audio envelope.

export const TTS_SACRIFICIAL_TAIL = '。蘋果蘋果蘋果';

// Padding only matters for short texts — the per-character budget catches up
// with natural speech around a dozen syllables.
export function needsTtsPadding(text) {
  const cjkCount = (text?.match(/[一-鿿]/g) || []).length;
  return cjkCount > 0 && cjkCount <= 12;
}

/**
 * Trim the sacrificial tail off a padded TTS response.
 * Decodes the blob, finds the last silence gap that still has speech after it
 * (the tail), and returns a WAV blob cut at that gap. Returns the original
 * blob if anything fails or no boundary is found.
 * @param {Blob} blob - audio response for `text + TTS_SACRIFICIAL_TAIL`
 * @returns {Promise<Blob>}
 */
export async function trimTtsTail(blob) {
  try {
    const ctx = new OfflineAudioContext(1, 1, 24000);
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const rate = buf.sampleRate;

    // 20ms RMS envelope
    const win = Math.floor(rate * 0.02);
    const bars = [];
    for (let i = 0; i < data.length; i += win) {
      let sum = 0;
      const end = Math.min(i + win, data.length);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      bars.push(Math.sqrt(sum / (end - i)));
    }
    const peak = Math.max(...bars);
    if (peak < 0.01) return blob; // silent — nothing to trim
    const th = peak * 0.05;
    const minGap = 5; // 0.1s

    // gaps: runs of >=0.1s below threshold
    const gaps = [];
    let start = null;
    for (let i = 0; i <= bars.length; i++) {
      if (i < bars.length && bars[i] < th) { if (start === null) start = i; continue; }
      if (start !== null && i - start >= minGap) gaps.push([start, i]);
      start = null;
    }
    const speechAfter = (bar) => bars.slice(bar).filter(b => b >= th).length * 0.02;
    const boundary = gaps.filter(([, end]) => speechAfter(end) >= 0.3).pop();
    if (!boundary) return blob;

    const cutBar = boundary[0] + Math.min(5, boundary[1] - boundary[0]);
    const cutSample = cutBar * win;
    if (cutSample / rate < 0.25) return blob;
    return pcmToWavBlob(data.subarray(0, cutSample), rate);
  } catch {
    return blob;
  }
}

function pcmToWavBlob(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);       // PCM
  v.setUint16(22, 1, true);       // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
