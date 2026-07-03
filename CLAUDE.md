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

- Script: `scripts/generate-scene-audio.mjs` — covers scene lines AND reference-set phrases; writes `public/audio/cantonese/{id}.mp3`; skips existing files.
- Run: `set -a && source .env && set +a && CANTONESE_AI_VOICE=f6786fa7-f21d-4e8c-b696-26bb67fcd2ca TTS_DELAY_MS=3000 node scripts/generate-scene-audio.mjs`
- **Voice: `f6786fa7-f21d-4e8c-b696-26bb67fcd2ca`** (Faith's chosen voice, Jul 2026). Requests without an accessible voice fail 400.
- **Go slow.** cantonese.ai rate-limits hard: 3000ms between requests is safe; the script backs off 30s on 429 and aborts after 5 consecutive failures.
- If every request 400s ("Invalid voice or you don't have access"), the account plan/credits have lapsed — fix billing at cantonese.ai first.
- Key lives in `.env` (gitignored) as `CANTONESE_AI_KEY`. The Cloudflare Worker holds its own copy as a secret — rotate both together.
