// Generate scene-line and word audio via ElevenLabs TTS for Mandarin scenes.
// Usage: ELEVENLABS_KEY=xxx node scripts/generate-mandarin-audio.mjs [--force] [--dry-run]
// Writes public/audio/mandarin/{line.id}.mp3 and public/audio/mandarin-words/{word}.mp3.
// Skips files that already exist unless --force.
//
// Unlike cantonese.ai, ElevenLabs does not truncate short phrases to silence
// (verified: a 2-character phrase comes back as a complete ~0.9s clip), so
// there is no pad-and-trim step here — every file is final on write.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MODEL_ID = 'eleven_multilingual_v2';
const SCENES_DIR = 'public/scenes';
const OUT_DIR = 'public/audio/mandarin';
const WORDS_DIR = 'public/audio/mandarin-words';
const DELAY_MS = Number(process.env.TTS_DELAY_MS) || 800;

const apiKey = process.env.ELEVENLABS_KEY;
// Voice for "you" lines — the learner's own practice audio.
const BASE_VOICE_ID = process.env.MANDARIN_VOICE || 'bhJUNIXWQQ94l8eI2VUf';
// NPC speakers: comma-separated alt voice ids, e.g. MANDARIN_ALT_VOICES=id1,id2.
// Falls back to BASE_VOICE_ID for everyone if none are configured — a known
// v1 simplification (no NPC voice diversity yet for Mandarin).
const ALT_VOICE_IDS = (process.env.MANDARIN_ALT_VOICES || '').split(',').map(s => s.trim()).filter(Boolean);
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

if (!apiKey && !dryRun) {
  console.error('Missing ELEVENLABS_KEY env var.');
  process.exit(1);
}

function hashStr(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Map each distinct non-"you" speaker in a scene to a voice id. Falls back to
// BASE_VOICE_ID for all speakers when no alt voices are configured.
function buildSpeakerVoiceMap(lines, sceneKey) {
  if (ALT_VOICE_IDS.length === 0) return {};
  const speakers = [];
  for (const l of lines) {
    if (l.speaker && l.speaker !== 'you' && !speakers.includes(l.speaker)) speakers.push(l.speaker);
  }
  const map = {};
  const baseIdx = hashStr(sceneKey) % ALT_VOICE_IDS.length;
  speakers.forEach((s, i) => {
    map[s] = ALT_VOICE_IDS[(baseIdx + i) % ALT_VOICE_IDS.length];
  });
  return map;
}

const mandarinSceneFiles = readdirSync(SCENES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .filter((f) => JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8')).language === 'mandarin');

const sceneLines = mandarinSceneFiles.flatMap((f) => {
  const scene = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'));
  const speakerVoice = buildSpeakerVoiceMap(scene.lines || [], f);
  return (scene.lines || []).map((l) => ({
    id: l.id,
    text: l.cjk,
    scene: f,
    voiceId: l.speaker === 'you' ? BASE_VOICE_ID : (speakerVoice[l.speaker] || BASE_VOICE_ID),
  }));
});

// Tone Gym + Pinyin Guide single characters (keep in sync with
// MANDARIN_TONE_PAIRS in src/components/screens/ToneGym.jsx) — played via
// staticWordAudio. The 4-tone "ma" set doubles as the Pinyin Guide's example.
const TONE_GYM_CHARS = [...'妈麻马骂买卖汤糖书熟花画写谢问温教叫锅过听停五雾'];

// Word-by-word audio: every breakdown word in Mandarin scenes, plus the
// Tone Gym/Pinyin Guide character set above.
const wordTexts = new Set(TONE_GYM_CHARS);
for (const f of mandarinSceneFiles) {
  const scene = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'));
  for (const l of scene.lines || []) for (const w of l.words || []) if (w.chinese) wordTexts.add(w.chinese);
  for (const g of scene.vocabulary || []) for (const w of g.words || []) if (w.chinese) wordTexts.add(w.chinese);
}
const wordLines = [...wordTexts]
  .filter((w) => !w.includes('/') && !w.includes('.')) // unsafe as filenames
  .map((w) => ({ id: w, text: w, outDir: WORDS_DIR, voiceId: BASE_VOICE_ID }));

const lines = [
  ...sceneLines.map((l) => ({ ...l, outDir: OUT_DIR })),
  ...wordLines,
].filter((l) => l.text && l.text.trim());

const todo = lines.filter((l) => force || !existsSync(join(l.outDir, `${l.id}.mp3`)));
console.log(`${mandarinSceneFiles.length} Mandarin scenes, ${lines.length} lines/words, ${todo.length} to generate.`);
if (dryRun) {
  todo.forEach((l) => console.log(`  ${l.id}  ${l.text}`));
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(WORDS_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(line, attempt = 1) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${line.voiceId || BASE_VOICE_ID}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: line.text, model_id: MODEL_ID }),
  });
  if (!res.ok) {
    const body = await res.text();
    // 401/422 = key/voice/permission problem: retrying cannot help, fail fast
    if (res.status === 401 || res.status === 422) throw new Error(`${res.status} ${body.slice(0, 200)}`);
    // 429 = rate limited: back off and retry up to 3 times
    if (res.status === 429 && attempt <= 3) {
      await sleep(15000 * attempt);
      return generate(line, attempt + 1);
    }
    if (attempt === 1) {
      await sleep(2000);
      return generate(line, 2);
    }
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error(`suspiciously small file (${buf.length} bytes)`);
  writeFileSync(join(line.outDir, `${line.id}.mp3`), buf);
}

const failed = [];
let consecutiveFails = 0;
for (const [i, line] of todo.entries()) {
  try {
    await generate(line);
    consecutiveFails = 0;
    console.log(`[${i + 1}/${todo.length}] ${line.id} ok`);
  } catch (err) {
    failed.push(line.id);
    consecutiveFails += 1;
    console.error(`[${i + 1}/${todo.length}] ${line.id} FAILED: ${err.message}`);
    if (consecutiveFails >= 5) {
      console.error('5 consecutive failures. Aborting: fix the account/key/voice before rerunning.');
      break;
    }
  }
  await sleep(DELAY_MS);
}

console.log(`\nDone. ${todo.length - failed.length} generated, ${failed.length} failed.`);
if (failed.length) {
  console.log('Failed ids:', failed.join(', '));
  process.exit(1);
}
