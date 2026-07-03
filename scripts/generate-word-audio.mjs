// Pre-generate single word/character MP3s via cantonese.ai TTS so word taps
// work offline. Collects every words[] entry plus every CJK character used in
// any scene line or phrase (the character-split fallback in word breakdowns).
// Usage: CANTONESE_AI_KEY=... [CANTONESE_AI_VOICE=...] [TTS_DELAY_MS=3000] node scripts/generate-word-audio.mjs [--dry-run]
// Writes public/audio/cantonese-words/{word}.mp3 (raw CJK filename; the app
// fetches encodeURIComponent(word), which the web server decodes back).

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API_URL = 'https://cantonese.ai/api/tts';
const OUT_DIR = 'public/audio/cantonese-words';
const DELAY_MS = Number(process.env.TTS_DELAY_MS) || 3000;
const CJK = /[一-鿿]/;

const apiKey = process.env.CANTONESE_AI_KEY;
const voiceId = process.env.CANTONESE_AI_VOICE;
const dryRun = process.argv.includes('--dry-run');

if (!apiKey && !dryRun) {
  console.error('Missing CANTONESE_AI_KEY env var.');
  process.exit(1);
}

const words = new Set();

for (const f of readdirSync('public/scenes').filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const scene = JSON.parse(readFileSync(join('public/scenes', f), 'utf8'));
  for (const l of scene.lines || []) {
    for (const w of l.words || []) if (w.chinese?.trim()) words.add(w.chinese.trim());
    for (const c of l.cjk || '') if (CJK.test(c)) words.add(c);
  }
}
for (const f of readdirSync('public').filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join('public', f), 'utf8'));
  for (const s of Array.isArray(data) ? data : [data]) {
    for (const p of s.phrases || []) {
      for (const w of p.words || []) if (w.chinese?.trim()) words.add(w.chinese.trim());
      for (const c of p.chinese || '') if (CJK.test(c)) words.add(c);
    }
  }
}

const todo = [...words].filter((w) => !existsSync(join(OUT_DIR, `${w}.mp3`)));
console.log(`${words.size} unique words/characters, ${todo.length} to generate.`);
if (dryRun) process.exit(0);

mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(word, attempt = 1) {
  const payload = {
    api_key: apiKey,
    text: word,
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
    if (res.status === 400) throw new Error(`${res.status} ${body.slice(0, 200)}`);
    if (res.status === 429 && attempt <= 3) {
      await sleep(30000 * attempt);
      return generate(word, attempt + 1);
    }
    if (attempt === 1) {
      await sleep(2000);
      return generate(word, 2);
    }
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`suspiciously small file (${buf.length} bytes)`);
  writeFileSync(join(OUT_DIR, `${word}.mp3`), buf);
}

const failed = [];
let consecutiveFails = 0;
for (const [i, word] of todo.entries()) {
  try {
    await generate(word);
    consecutiveFails = 0;
    console.log(`[${i + 1}/${todo.length}] ${word} ok`);
  } catch (err) {
    failed.push(word);
    consecutiveFails += 1;
    console.error(`[${i + 1}/${todo.length}] ${word} FAILED: ${err.message}`);
    if (consecutiveFails >= 5) {
      console.error('5 consecutive failures. Aborting.');
      break;
    }
  }
  await sleep(DELAY_MS);
}

console.log(`\nDone. ${todo.length - failed.length} generated, ${failed.length} failed.`);
if (failed.length) process.exit(1);
