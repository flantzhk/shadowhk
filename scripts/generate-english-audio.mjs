// Pre-generate English narration MP3s via the worker's /tts-english (ElevenLabs).
// Usage: GEN_EMAIL=... GEN_PASSWORD=... node scripts/generate-english-audio.mjs [--dry-run]
// Writes public/audio/english/{id}.mp3 for every scene line and phrase-bank entry.
// The worker requires a signed-in Firebase user; this script logs in via the
// Firebase Auth REST API and refreshes the token if it expires mid-run.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const WORKER_URL = 'https://shadowspeak-api.faith-lantz-ee8.workers.dev/tts-english';
const FIREBASE_KEY = 'AIzaSyBl8PRFr84XLNZNxfSg7LpVekjh5lvBWRI';
const ORIGIN = 'https://flantzhk.github.io';
const OUT_DIR = 'public/audio/english';
const DELAY_MS = Number(process.env.TTS_DELAY_MS) || 1500;

const email = process.env.GEN_EMAIL;
const password = process.env.GEN_PASSWORD;
const dryRun = process.argv.includes('--dry-run');

if ((!email || !password) && !dryRun) {
  console.error('Missing GEN_EMAIL / GEN_PASSWORD env vars.');
  process.exit(1);
}

const sceneLines = readdirSync('public/scenes')
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => {
    const scene = JSON.parse(readFileSync(join('public/scenes', f), 'utf8'));
    return (scene.lines || []).map((l) => ({ id: l.id, text: l.english }));
  });

const refLines = readdirSync('public')
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const data = JSON.parse(readFileSync(join('public', f), 'utf8'));
    const sets = Array.isArray(data) ? data : [data];
    return sets.flatMap((s) => (s.phrases || []).map((p) => ({ id: p.id, text: p.english })));
  });

const lines = [...sceneLines, ...refLines].filter((l) => l.text && l.text.trim());
const todo = lines.filter((l) => !existsSync(join(OUT_DIR, `${l.id}.mp3`)));
console.log(`${lines.length} English lines, ${todo.length} to generate.`);
if (dryRun) process.exit(0);

mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let idToken = null;
async function login() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`Firebase login failed: ${JSON.stringify(data.error || data)}`);
  idToken = data.idToken;
}

async function generate(line, attempt = 1) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': ORIGIN,
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ text: line.text }),
  });
  if (res.status === 401 && attempt === 1) {
    await login();
    return generate(line, 2);
  }
  if (!res.ok) {
    const body = await res.text();
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
  writeFileSync(join(OUT_DIR, `${line.id}.mp3`), buf);
}

await login();
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
      console.error('5 consecutive failures. Aborting.');
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
