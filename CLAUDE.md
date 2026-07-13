# ShadowHK — Claude Operating Instructions

ShadowHK is the latest version of the ShadowSpeak app.

## Brand & Design Reference

**The authoritative brand reference is `Branding.html` at the project root** (v2.3, April 2026).
Open it in a browser to see the full visual system: colours, typography, photography direction, components, voice, and motion.

The companion token sheet is `Branding.tokens.css`.

**Do not reference anything in `mockups/`.** Those files are outdated and superseded by `Branding.html`. Ignore them entirely.

## Code Quality

Always apply `/karpathy-guidelines` when writing or reviewing code in this project. Clean, minimal, well-reasoned code — no unnecessary abstractions, no bloat.

## Audio Generation (cantonese.ai)

- Script: `scripts/generate-scene-audio.mjs` — covers scene lines AND reference-set phrases; writes `public/audio/cantonese/{id}.raw.mp3`; skips existing files.
- **Two-step pipeline (Jul 2026):** the API truncates audio to a duration budget of ~0.235s per input character, chopping the endings off short phrases (1-char words come back as pure silence). The generate script therefore appends a sacrificial `。蘋果蘋果蘋果` tail to every request, and `scripts/trim-tts-tail.py` (ffmpeg + faster-whisper on python3.12) cuts the tail back off and verifies each file. Always run both:
  1. `set -a && source .env && set +a && CANTONESE_AI_VOICE=f6786fa7-f21d-4e8c-b696-26bb67fcd2ca TTS_DELAY_MS=3000 node scripts/generate-scene-audio.mjs`
  2. `DYLD_LIBRARY_PATH="$(brew --prefix expat)/lib" python3.12 scripts/trim-tts-tail.py`
- **Voice: `f6786fa7-f21d-4e8c-b696-26bb67fcd2ca`** (Faith's chosen voice, Jul 2026). Requests without an accessible voice fail 400.
- **Go slow.** cantonese.ai rate-limits hard: 3000ms between requests is safe; the script backs off 30s on 429 and aborts after 5 consecutive failures.
- If every request 400s ("Invalid voice or you don't have access"), the account plan/credits have lapsed — fix billing at cantonese.ai first.
- Key lives in `.env` (gitignored) as `CANTONESE_AI_KEY`. The Cloudflare Worker holds its own copy as a secret — rotate both together.

## Audio Generation (Mandarin — ElevenLabs)

- Script: `scripts/generate-mandarin-audio.mjs` — only processes scene files with `"language": "mandarin"`; writes `public/audio/mandarin/{id}.mp3` and `public/audio/mandarin-words/{word}.mp3` directly (no raw/trim step).
- **No truncation bug.** Unlike cantonese.ai, ElevenLabs does not chop short phrases — verified with a 2-character phrase coming back as a complete clip. No sacrificial-tail workaround needed.
- Run: `set -a && source .env && set +a && node scripts/generate-mandarin-audio.mjs`
- **Voice: `bhJUNIXWQQ94l8eI2VUf`** (Faith's chosen native Mandarin voice, Jul 2026), model `eleven_multilingual_v2`. Override with `MANDARIN_VOICE` env var.
- Key lives in `.env` (gitignored) as `ELEVENLABS_KEY`. This key only has `text_to_speech` permission (not `voices_read`/`user_read`) — can't list/browse voices via API, only generate with a known voice_id.
- Pinyin (with diacritic tone marks, not tone numbers) is generated via the `pinyin-pro` npm package — deterministic and local, no API call needed (unlike Cantonese jyutping, which requires cantonese.ai's `/text-to-jyutping` endpoint).

## Open mystery: live worker backend vs. this repo

The deployed Cloudflare Worker at `shadowspeak-api.faith-lantz-ee8.workers.dev` answers
`/score-pronunciation` and `/tts` with `401 Unauthorized` (confirmed via direct probe —
not `404`, so the routes are real). But `worker/src/index.js` in this repo only
implements Stripe/RevenueCat/Firestore webhooks — zero TTS/STT/scoring logic, and no
uncommitted or gitignored worker file exists locally either. **The deployed worker runs
code that isn't in this git history.** Until located, don't assume the live scoring/STT
backend supports Mandarin (or anything else) — check with Faith first.
