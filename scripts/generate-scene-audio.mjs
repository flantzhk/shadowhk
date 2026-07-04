// Generate scene-line audio via cantonese.ai TTS.
// Usage: CANTONESE_AI_KEY=xxx node scripts/generate-scene-audio.mjs [--force] [--dry-run]
// Writes public/audio/cantonese/{line.id}.mp3 (audio.js resolves by line id).
// Skips files that already exist unless --force.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API_URL = 'https://cantonese.ai/api/tts';

// cantonese.ai truncates output audio to a duration budget derived from the
// input character count (~0.235s/char). Short phrases need more time than
// their budget, so their endings get chopped — one-char words come back as
// pure silence. Workaround: append a sacrificial tail phrase to buy budget,
// save the result as {id}.raw.mp3, then run scripts/trim-tts-tail.py to cut
// the tail back off (whisper-anchored) and produce the final {id}.mp3.
// 蘋果 never appears in the phrase corpus, so the trimmer can't confuse the
// tail with the end of a real phrase (many phrases end in digits).
const SACRIFICIAL_TAIL = '。蘋果蘋果蘋果';
const SCENES_DIR = 'public/scenes';
const OUT_DIR = 'public/audio/cantonese';
const WORDS_DIR = 'public/audio/cantonese-words';
const DELAY_MS = Number(process.env.TTS_DELAY_MS) || 1200;

// Tone Gym single characters (keep in sync with TONE_PAIRS in
// src/components/screens/ToneGym.jsx) — played via staticWordAudio.
const TONE_GYM_CHARS = [...'媽麻好號飛肥詩時分粉買賣大帶知紙花化書樹魚語水睡雞計糖燙九夠'];

const apiKey = process.env.CANTONESE_AI_KEY;
const voiceId = process.env.CANTONESE_AI_VOICE; // optional: pass a specific voice_id
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

if (!apiKey && !dryRun) {
  console.error('Missing CANTONESE_AI_KEY env var.');
  process.exit(1);
}

const sceneLines = readdirSync(SCENES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => {
    const scene = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'));
    return (scene.lines || []).map((l) => ({ id: l.id, text: l.cjk, scene: f }));
  });

// Reference sets / phrase banks: public/*.json, each an array of sets with phrases
const refLines = readdirSync('public')
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const data = JSON.parse(readFileSync(join('public', f), 'utf8'));
    const sets = Array.isArray(data) ? data : [data];
    return sets.flatMap((s) => (s.phrases || []).map((p) => ({ id: p.id, text: p.chinese, scene: f })));
  });

// Word-by-word audio: every breakdown word in scenes + reference sets +
// Tone Gym characters. Filename is the word text itself
// (audio/cantonese-words/{word}.mp3, resolved by staticWordAudio).
const wordTexts = new Set(TONE_GYM_CHARS);
for (const f of readdirSync(SCENES_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const scene = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'));
  for (const l of scene.lines || []) for (const w of l.words || []) if (w.chinese) wordTexts.add(w.chinese);
}
for (const f of readdirSync('public').filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join('public', f), 'utf8'));
  for (const s of Array.isArray(data) ? data : [data]) {
    for (const p of s.phrases || []) for (const w of p.words || []) if (w.chinese) wordTexts.add(w.chinese);
  }
}
const wordLines = [...wordTexts]
  .filter((w) => !w.includes('/') && !w.includes('.')) // unsafe as filenames
  .map((w) => ({ id: w, text: w, outDir: WORDS_DIR }));

const lines = [
  ...[...sceneLines, ...refLines].map((l) => ({ ...l, outDir: OUT_DIR })),
  ...wordLines,
];

const todo = lines.filter((l) =>
  force || !(existsSync(join(l.outDir, `${l.id}.mp3`)) || existsSync(join(l.outDir, `${l.id}.raw.mp3`))));
console.log(`${lines.length} lines/words, ${todo.length} to generate.`);
if (dryRun) {
  todo.forEach((l) => console.log(`  ${l.id}  ${l.text}`));
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(WORDS_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(line, attempt = 1) {
  const payload = {
    api_key: apiKey,
    text: line.text + SACRIFICIAL_TAIL,
    language: 'cantonese',
    speed: 1.0,
    output_extension: 'mp3',
    should_use_turbo_model: false,
  };
  if (voiceId) payload.voice_id = voiceId;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    // 400 = voice/permission problem: retrying cannot help, fail fast
    if (res.status === 400) throw new Error(`${res.status} ${body.slice(0, 200)}`);
    // 429 = rate limited: back off and retry up to 3 times
    if (res.status === 429 && attempt <= 3) {
      await sleep(30000 * attempt);
      return generate(line, attempt + 1);
    }
    if (attempt === 1) {
      await sleep(2000);
      return generate(line, 2);
    }
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`suspiciously small file (${buf.length} bytes)`);
  writeFileSync(join(line.outDir, `${line.id}.raw.mp3`), buf);
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
if (todo.length - failed.length > 0) console.log('Now run: python3.12 scripts/trim-tts-tail.py');
if (failed.length) {
  console.log('Failed ids:', failed.join(', '));
  process.exit(1);
}
