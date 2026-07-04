/**
 * True when the recording contains actual signal. Sampled peak check —
 * silence from a dead input device decodes as near-zero amplitude.
 * Decode failures return true so the server still gets a chance.
 */
export async function blobIsAudible(blob) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const data = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i += 64) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
      if (peak > 0.02) return true;
    }
    return peak > 0.02;
  } catch (_) {
    return true;
  }
}
