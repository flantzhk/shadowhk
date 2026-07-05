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
    }
    // Logged unconditionally (not just on failure) so a borderline pass is
    // visible too — peak sitting just above 0.02 still points at a mic issue.
    console.info('[audioSignal] peak amplitude', peak, 'blob size', blob.size, 'type', blob.type);
    return peak > 0.02;
  } catch (err) {
    console.error('[audioSignal] decode failed, treating as audible', err?.message);
    return true;
  }
}
