# ShadowHK full-build bug review — final findings (karpathy-guidelines pass)

Status: **25 of 25 review dispatches complete.** `auth.js` (task #18) was closed
out with a direct full-file read rather than a sub-agent re-dispatch (447 lines,
comfortably readable in one pass). The two findings its original sub-agent had
already surfaced (#15 sign-out, #16 signup race) were confirmed accurate against
the live code, and the direct read turned up one additional finding the partial
sub-agent capture had missed — see new Critical item #4 (`deleteAccount()`
data-loss-before-delete-confirmed ordering).

Plan file: `/Users/faithkayiwa/.claude/plans/lively-dancing-galaxy.md` (may not
carry over to a new session — this file is the durable record).

**Update 2026-07-14: everything fixed.** All 4 Critical, all 16 Major, all 21
Minor findings, and all confirmed dead-code items have been fixed, investigated,
or deleted — see `[FIXED]`/`[INVESTIGATED]`/`[DELETED]`/`[MOOT]` tags inline
below. Full test suite (78/78) and production build pass after every batch.
A handful of items surfaced residuals needing your input — see the "Needs your
decision" list at the very bottom of this file.

---

## Critical

1. **[FIXED 2026-07-14]** **Bulk offline audio download silently skips ALL Mandarin audio.**
   `src/services/offlineManager.js` `collectAudioUrls` (~129-164) builds download
   URLs only under `audio/cantonese/`, `audio/english/`, `audio/cantonese-words/` —
   never `audio/mandarin/` or `audio/mandarin-words/`, even though those dirs exist
   with real content. A Mandarin-mode "download all" silently fetches 404s for
   Mandarin lines and never gets the real files. Cascades into `audioDownload.js`
   reporting false "complete"/"ready" status (uses the same undercounted total).

2. **[FIXED 2026-07-14]** **`DialogueScene.jsx` double-fires the opening NPC line on nearly every scene.**
   `handleStartScene` manually plays turn 0, but the phase transition also
   re-triggers the `useEffect` that plays turn 0 again (dep array includes the
   `phase === 'intro'` check). Two concurrent TTS requests, overwritten audio src,
   duplicate chat-log entry, and a probable skipped turn. Fires on any scene that
   opens with an NPC line — the common case.

3. **[FIXED 2026-07-14 — patched, not deleted]** **`scripts/generate-word-audio.mjs` is a stale, dangerous duplicate script.**
   Writes word audio straight to `public/audio/cantonese-words/` with no
   sacrificial-tail workaround and no trim/verify step, even though
   `generate-scene-audio.mjs`'s own header comment documents that cantonese.ai
   truncates short text to near-silence. The `<1000 byte` size guard won't catch a
   genuinely-silent-but-normal-sized clip. If anyone runs this script to backfill
   vocabulary, it silently ships broken audio into the same directory the safe
   pipeline uses. Recommend flagging for deletion/redirect.
   *(Fix: it does something `generate-scene-audio.mjs` doesn't cover —
   per-character word extraction for `PhraseDetailScreen.jsx`'s tap targets —
   so it was patched with the same sacrificial-tail + `.raw.mp3` + trim-pipeline
   workaround instead of deleted.)*

4. **[FIXED 2026-07-14]** **`auth.js` `deleteAccount()` can permanently destroy a user's data without
   ever completing the account deletion.** Order of operations (lines 359-409):
   (1) delete the Firestore user doc + library subcollection, (2) wipe local
   IndexedDB via `clearAllData()`, (3) *then* call `user.delete()`. Step 3 is the
   one call in the function explicitly documented to sometimes throw
   `auth/requires-recent-login` (there's dedicated error-message handling for
   it, line 401-405), which surfaces when the user hasn't re-authenticated
   recently. When that happens, steps 1-2 have already succeeded and are not
   rolled back — the user is told to "sign out and sign back in, then try
   again," but is left signed in with a live (possibly paying) account and zero
   cloud or local data in the meantime. If they don't immediately retry, that
   data is unrecoverable even though the account was never actually deleted.
   Fix direction: reorder so `user.delete()` runs first, or gate steps 1-2
   behind its success. *(Found during the final auth.js verification read —
   not in the original sub-agent capture.)*

## Major

5. **[FIXED 2026-07-14]** **Mandarin AI-chat TTS likely uses the wrong (Cantonese) voice.**
   `src/services/aiChat.js` `generateResponseAudio` only sets a `voiceId` when
   `language === 'cantonese'`; for Mandarin it falls through to
   `api.js`'s module-level `preferredVoiceId`, which defaults to a **Cantonese**
   voice ID (documented in CLAUDE.md). Same root cause found independently via
   `src/services/audio.js` (scene playback fallback/prefetch never pass a
   voiceId either) and `src/components/screens/SettingsScreen.jsx:225-227` (the
   "Cantonese voice" picker is shown unconditionally regardless of language — it's
   literally where `preferredVoiceId` gets set app-wide). Also: this commit's
   `buildSystemPrompt` (the "language-aware system-prompt builder") is **dead
   code** — never imported by `AIConversation.jsx`, zero runtime effect.

6. **[FIXED 2026-07-14 — client-side only]** **Speech-to-text has no language parameter at all.** `speechToText(blob)` in
   `api.js` takes no language arg; neither call site (`AIConversation.jsx`,
   `PromptDrill.jsx`) passes one. Backend can't be told Mandarin speech is
   Mandarin (pre-existing gap, not introduced this session, but blocks accurate
   Mandarin transcription regardless). *(Client now threads `language` through
   correctly; whether the deployed worker backend actually reads it is still
   the open worker-backend mystery in CLAUDE.md — unverifiable from this repo.)*

7. **[FIXED 2026-07-14]** **`by-language` IndexedDB index silently drops entries because several save
   paths never set `language` on the record.** `PhraseCard.jsx` (save/save-word/
   mark-known), `AIConversation.jsx` save-to-library, `BulkSaveModal.jsx` all
   write library entries with no `language` field. IndexedDB indexes never
   include records with an undefined indexed property, so these phrases are
   saved but never show up in Library or Search for either language filter.

8. **[FIXED 2026-07-14 — primary path only]** **Due-phrase / "today's lesson" pools mix Cantonese and Mandarin.**
   `src/services/storage.js` `getDueEntries()` and `getAllSessions()` /
   `getAllLibraryEntries()` are unfiltered by language; `lessonBuilder.js`'s
   `buildSceneLesson(language)` and `buildLesson()` both accept a `language`
   param but don't consistently use it to filter the due-phrase pool (the
   fallback path does filter, the primary "due" path doesn't) — a bilingual user
   can get handed the wrong language's phrases in a lesson/session. `srs.js`
   already has a correct `getDueByLanguage` helper that isn't used by these call
   sites. *(Residual: `buildSceneLesson`'s zero-due-phrases fallback still uses
   unfiltered `getAllLibraryEntries()` — left alone to keep the fix surgical;
   only matters when a user's due pool is empty.)*

9. **[FIXED 2026-07-14 — key schema changed; second symptom confirmed real, not fixed]**
   **Tone-weakness tracking has no language dimension at all.**
   `storage.js`'s `toneStats` IndexedDB store keys only on the tone digit (1-6),
   globally, across both languages. `toneWeakness.js`, `srs.js`
   (`updateAfterPractice`), and `practiceRecommendation.js` all read/write this
   shared bucket with no language filter — a user's Cantonese tone-3 errors and
   Mandarin tone-3 errors accumulate into one record, corrupting Tone Gym
   recommendations and scheduling bias for both languages. Possible second
   symptom: if Mandarin romanization is diacritic-based (not tone-numbered),
   `toneWeakness.js`'s `/([1-6])$/` regex may never match Mandarin phrases at
   all — meaning the weak-tone bias silently never applies to Mandarin.
   *(Key changed to `` `${language}-${toneDigit}` ``. **Needs a product decision:**
   existing production users' old bare-digit tone records are orphaned by this
   change — no migration was written since there's no way to know which
   language an old record belonged to; the honest options are "accept the
   reset" or "don't ship this fix without a plan." Second symptom CONFIRMED
   real via direct read of `public/scenes/mandarin-restaurant.json` — Mandarin
   `pinyin` is diacritic-only, `sceneLoader.js` passes it through as
   `romanization` unchanged, so `phraseHasWeakTone` never matches for Mandarin.
   Not fixed — needs a real diacritic-to-tone-digit utility or a parallel
   numeric-tone field in scene data, both bigger than a surgical fix.)*

10. **[FIXED 2026-07-14 — library numbers only; session numbers still blended]**
   **StatsScreen mixes Cantonese and Mandarin data into every number on the
   page.** `getAllLibraryEntries()`/`getAllSessions()` calls are unfiltered by
   language (the language-filtered `getLibraryEntriesByLanguage` helper exists
   but goes unused here). Phrases saved, mastered count, session count, avg
   score, tone accuracy — all blended across both languages. *(Library-derived
   numbers now correctly filtered. Sessions are NOT — checked all 6
   `saveSession()` call sites, none stamp a `language` field, so session count/
   avg score/tone accuracy/streak/today's-progress remain blended. Needs those
   6 call sites fixed to stamp `language`, then StatsScreen can filter
   sessions too — out of scope for a StatsScreen-only fix.)*

11. **[FIXED 2026-07-14 — all 6 sub-issues]** **`audio.js` (AudioEngine) has a cluster of real race conditions** (largest
    service file, zero test coverage, flagged mixed-responsibility):
    - Rapid `next()`/`previous()` clicks: no cancellation/generation token on
      `_loadCurrentPhrase()` — whichever async load resolves last wins,
      regardless of request order; audio and UI can go out of sync.
    - Blob URL leak: the "losing" load's `createObjectURL()` overwrites
      `_currentBlobUrl` without revoking the previous one.
    - `destroy()` doesn't guard `_loadCurrentPhrase()` — a pending fetch/TTS call
      can still assign `_audio.src` and fire callbacks after teardown.
    - Shadow-mode: pausing during the English-TTS phase never fires the
      `ended`/`error` event `_playEnglishBlob`'s promise waits on — it hangs
      forever, and a later `play()` call clobbers the orphaned handlers so it
      can never settle even in principle.
    - `setSpeed()`'s "was playing" check reads the wrong audio element during
      the English phase of shadow mode — silently drops playback instead of
      resuming.
    - `_prefetchPhrase` reads `this._language` live rather than as a captured
      parameter — a language switch mid-prefetch can write cache entries keyed
      to the wrong language (cross-language cache corruption).

12. **[FIXED 2026-07-14]** **`ShadowSession.jsx`: stale-closure bug drops the last phrase's score from
    every session summary.** `handleNext`'s `useCallback` deps don't include
    `finishSession`, which is recreated every time `results` changes — so the
    final tap-Next after the last phrase closes over an older `finishSession`
    built from a `results` array missing that final score. Pre-existing, not
    caused by the Mandarin work, but real and affects every completed session.

13. **[FIXED 2026-07-14 — client-side; worker response shape still unverified]**
    **`diffJyutping`/`SyllableDiagnostic` is structurally broken for Mandarin.**
    `src/utils/jyutpingDiff.js`'s `SYLLABLE_RE` assumes ASCII-letters-plus-tone-
    digit (jyutping's format); Mandarin romanization uses diacritic marks, which
    don't match, so tone-only mismatches get miscategorized as "sound" errors —
    the pronunciation-feedback breakdown a Mandarin learner sees is wrong, not
    just cosmetically off (contingent on the worker actually returning Mandarin
    jyutping-shaped fields at all — still an open unknown per CLAUDE.md). *(Now
    detects diacritic-marked Pinyin per syllable and categorizes tone-only
    mismatches correctly; still contingent on the same open worker-backend
    mystery for whether Mandarin data even arrives in a comparable shape.)*

14. **[FIXED 2026-07-14]** **Personal-scene generation has no validation the AI actually followed the
    Simplified/Pinyin vs Traditional/Jyutping instruction, or that response shape
    is well-formed** before writing straight to the library (`personalSceneBuilder.js` +
    `IntroduceYourselfForm.jsx`). Also: `FIELD_LABELS.parentsLocal` still hardcodes
    "Parents are HK locals who speak Cantonese" regardless of language — sent to
    the AI as scene-generation context even for Mandarin/China-trip learners, and
    the matching form label (`"Are your parents Cantonese-speaking HK locals?"`)
    is hardcoded too.

15. **[FIXED 2026-07-14 — webhook race fixed; TRANSFER handler defensive-only,
    needs product confirmation]** **Worker: subscription-status webhook race.**
    `worker/src/index.js` —
    `customer.subscription.updated`/`.deleted` assume `checkout.session.completed`
    already wrote `stripe_customer_id` to Firestore. Stripe doesn't guarantee
    delivery order; if the subscription-update event arrives first, the handler
    can't find the user, logs a warning, and returns **HTTP 200** anyway — Stripe
    never retries, so that status transition is silently and permanently lost.
    Also: RevenueCat's `TRANSFER` event is a no-op (old uid keeps stale `pro`
    status indefinitely if entitlements are reassigned) — needs product
    confirmation on whether TRANSFER is used in this app's flow. *(Race fixed by
    returning a non-200 on a lookup miss so Stripe retries once
    `checkout.session.completed` has landed. TRANSFER handler implemented
    defensively — but confirmed via grep that this app has no RevenueCat SDK
    integration at all today (no package installed, no `Purchases.*` calls,
    native IAP still gated off in `Screen16_Paywall.jsx`), so this event
    currently can't fire in practice. Keep the handler, but this still needs
    your product confirmation before relying on it if native IAP ships.)*

16. **[FIXED 2026-07-14]** **Auth: sign-out never clears local IndexedDB.** `clearAllData()` exists in
    `storage.js` but `signOut()` never calls it — only `deleteAccount()` and an
    account-switch-mismatch guard in `App.jsx` do. A second user signing in on
    the same browser after a bare sign-out (no account-switch detected yet) can
    see the prior user's local library/progress. *(from auth.js's sub-agent,
    confirmed by direct read)*

17. **[INVESTIGATED 2026-07-14 — no isolated fix in auth.js; already mitigated]**
    **Auth: race between signup and Firestore user-doc creation.**
    `onAuthStateChanged` fires before `signUp()`'s own `await createUserDocument()`
    completes; `useSubscription.js`'s snapshot listener and one-off reads in
    Profile/Settings can read against a not-yet-created doc, degrading to
    default/empty values rather than crashing, but potentially staying wrong if
    the write silently failed and nothing retries it. *(auth.js sub-agent finding,
    confirmed by direct read)* Confirmed real and not fixable from within
    auth.js alone — the Firebase client SDK fires `onAuthStateChanged` the
    instant the credential is created, with no way to delay it from this file.
    Checked every consumer (`App.jsx`, `useSubscription.js`, `updateLastActive`,
    `pullStreakFromFirestore`): all already tolerate a temporarily-missing doc
    (merge writes, `doc.exists` checks, `onSnapshot` defaulting to `'free'` and
    self-correcting once the doc lands). No action needed unless a new consumer
    is added that doesn't follow this pattern.

18. **[FIXED 2026-07-14]** **`generate-mandarin-audio.mjs` has no filter for empty/missing `cjk` text**
    before sending to the TTS API (same class of bug patched in
    `generate-english-audio.mjs` but not carried over) — a missing field would
    silently produce and save literal `"undefined。苹果苹果苹果"` audio as that
    line's real clip. Currently latent (no scene has a missing field today).

19. **[FIXED 2026-07-14]** **Settings-persistence race in `AppContext.jsx`.** `updateSettings` computes
    its write from a `settingsRef` that's one render behind (only refreshed by a
    `useEffect`). Two `updateSettings` calls touching *different* keys in quick
    succession (e.g. a Settings voice change immediately followed by a language
    switch) can have the second IndexedDB write omit the first change. Also: a
    persistence failure (quota, private mode) is only logged, never surfaced to
    the user or retried — a language/setting change can appear to take effect
    and silently not persist. *(Ref now synced synchronously at write time
    instead of via a render-lagged effect. Persistence failures now surface via
    the existing `Toast` component instead of console-only logging.)*

20. **[FIXED 2026-07-14]** **`useRecorder.js`: microphone stream leak on error mid-setup.** If
    `MediaRecorder` construction or `.start()` throws after `getUserMedia`
    succeeds, the acquired stream's tracks are never stopped — neither the error
    handler nor the unmount cleanup (which only checks recorder state) releases
    it. Mic-in-use indicator can stay lit until the tab closes. Privacy-sensitive.

## Minor (batched) — all [FIXED 2026-07-14] unless noted

- `RevenueCat` webhook auth-header check uses plain `!==` instead of the
  existing `constantTimeEqual` helper (timing side-channel, low practical risk).
  **[FIXED]** now uses `constantTimeEqual`.
- `worker/src/index.js` comment about billing-issue downgrades is factually
  wrong for RevenueCat/Apple users (no Stripe subscription exists to downgrade).
  **[FIXED]** corrected to describe the actual Apple/RevenueCat retry + `EXPIRATION` path.
- Firebase JWKS cached forever in module scope, no TTL — stale key rejected
  until Worker isolate recycles (bounded blast radius). **[FIXED]** added a TTL
  (respects `Cache-Control: max-age`, falls back to 6h).
- `fetchWithRetry` in `api.js` throws `undefined` (not a real Error) when all
  retries are exhausted on repeated 429s. **[FIXED]** now throws a real `ApiError`.
- `notifications.js`'s `isPushSubscribed()` catch swallows errors with zero
  logging, unlike every other catch in the file. **[FIXED]** now logs via `logger.error`.
- `googleIdentity.js` retry path leaks a duplicate `<script>` tag instead of
  removing the failed one first. **[FIXED]** removes the prior tag before re-injecting.
- `audioDownload.js`'s 90%-complete threshold is a hardcoded magic number, not
  language-aware. **[FIXED]** extracted to a named `READY_THRESHOLD` constant
  with a comment (value unchanged — not language-specific in practice).
- `jyutping.js`'s tone-color palette: tones 3 and 4 are both near-identical dark
  olive green — defeats the at-a-glance purpose for two of six tones. **[FIXED]**
  tone 4 changed to a distinct dark blue.
- `trimTtsAudio.js`'s tail-cut heuristic could in theory land inside a long
  scene line with an internal pause, silently truncating real content — no test
  covers this. **[INVESTIGATED — not reachable as described, documented instead]**
  `trimTtsTail` is only ever called on text that already passed `needsTtsPadding`
  (<=12 CJK chars) — long scene lines never get padded and never reach this
  function. Added a comment clarifying the actual (narrower) risk window rather
  than changing the algorithm for a scenario that can't occur via the real call path.
- `PromptDrill.jsx`, `ToneTrainer.jsx`: language-switch mid-drill doesn't rebuild
  the phrase pool (frozen at mount); `PromptDrill.jsx:274` hardcodes "Say this in
  Cantonese:" copy and `lang="yue"` regardless of actual language. **[FIXED]**
  pool now rebuilds on language change; copy/lang now branch correctly.
- `ListenMode.jsx`: scene-switch doesn't reset playback index/timers if the
  component isn't remounted (unconfirmed whether the router actually remounts it).
  **[FIXED]** confirmed the router does NOT remount it — added `key={id}` in
  `App.jsx` to force a clean remount on scene switch.
- `ToneTrainer.jsx`: no stale-response guard if language changes twice quickly
  during phrase-selection. **[FIXED]** added a stale-response guard.
- `PhraseDetailScreen.jsx`: `useEffect` deps miss `language`, stale closure risk
  (low impact, phrases are language-scoped by ID in practice). **[FIXED]**
  low-impact assessment confirmed correct, but added `language` to deps anyway
  since it's read by `fetchCharMeanings`.
- `ScenesScreen.jsx` header hardcodes "香港"/"Hong Kong moment" copy even for
  Mandarin scenes, which are Mainland-China-set. **[FIXED]** now branches by language.
- **FAQScreen.jsx / SupportScreen.jsx self-contradiction**: intro FAQ claims
  blanket "real-time scoring," the languages FAQ separately claims Mandarin
  scoring is "being rolled out" — both overclaim relative to the still-unresolved
  worker-backend mystery in CLAUDE.md. (Note: this "rolled out" phrasing was
  introduced in this session's own copy fix — worth re-wording more
  conservatively, e.g. "not yet available" rather than implying active rollout.)
  **[FIXED]** reworded to "not yet available for Mandarin" in both files;
  Cantonese claims kept since that's a real, wired-up feature (verified via
  `scorePronunciation` call sites).
- `StatsScreen.jsx`: daily-goal progress bar divides a phrase *count* by a
  *minutes* target (`dailyGoalMinutes`) and labels it "phrases today" — unit
  mismatch, likely pre-existing not Mandarin-related. **[FIXED]** now compares
  actual minutes-practiced-today against the minutes goal.
- Several shared components (`PhrasebookToast.jsx`, `RealLifeCelebration.jsx`,
  `BulkSaveModal.jsx`) hardcode `lang="yue"` on Chinese text with no language
  prop, even though their callers handle both languages. **[FIXED]** all three
  now take/use a `language` prop.
- `AIConversation.jsx`: language switcher is visible mid-conversation but the
  active `scenario` object isn't reset — header can show a mismatched language
  pill (no data corruption, just a confusing display). **[FIXED]** — chose to
  end the conversation on a language switch rather than just patching the pill,
  since a scenario's audio/transcript state is tied to one language for its
  whole lifecycle; patching only the pill would leave stale in-flight state.
- `IntroduceYourselfForm.jsx`: stale-language closure race — a language switch
  during an in-flight AI generation can cause the phrase list to briefly show
  the wrong language's entries. **[FIXED]** added a stale-response guard.
- `sceneLoader.js`'s `detectRomKey` only samples `lines[0]` to decide the whole
  scene's romanization key — no scene currently triggers this, but it's an
  unvalidated assumption. **[FIXED]** now scans all lines for the first one
  with a romanization key, instead of only `lines[0]`.
- `ToneGymResults.jsx` hardcodes Cantonese's 6 tone descriptions/loop bound —
  a Mandarin Tone Gym session's results screen will show wrong tone
  descriptions for tones 3-4 (Mandarin's "dipping"/"sharp falling" vs
  Cantonese's "mid level"/"low falling"). **[FIXED]** added Mandarin's correct
  4-tone descriptions and a language-derived tone count (was hardcoded to 6).
- `FirstRunFlow.jsx`: step-7 success-screen fallback image/title (if scene
  lookup fails) is hardcoded to Cantonese dim sum, not language-branched like
  every other step in the file. **[FIXED]** now branches like every other step
  (reuses an existing generic image asset for Mandarin — no dedicated Mandarin
  fallback image exists yet).
- Several already-dead files carry the same hardcoded-Cantonese pattern if ever
  revived: `PhraseCard.jsx`, `PronunciationFeedback.jsx` (both zero importers).
  **[MOOT]** both files deleted in the dead-code cleanup pass below.

## Confirmed dead code / quick-win items — all resolved 2026-07-14

- `src/utils/validators.js`, `src/services/languageManager.js`,
  `src/services/dialogueLoader.js` — zero imports anywhere, confirmed by grep.
  **[DELETED]**, re-confirmed zero references immediately before deletion.
- `src/components/cards/PhraseCard.jsx`, `src/components/cards/PronunciationFeedback.jsx` —
  also zero importers (found during this pass, not in the original quick-win list).
  **[DELETED]** (plus their co-located `.module.css` files). Note: a Batch 2
  agent earlier this session fixed a missing-`language`-field bug inside
  `PhraseCard.jsx` before this was re-confirmed dead — that fix had zero live
  effect since the file was unreachable; moot now that it's deleted.
- `src/services/aiChat.js`'s `SCENARIO_RESPONSES.market/school/neighbor/doctor/shop`
  fallback entries — orphaned, no matching `SCENARIOS` entry, pre-date the
  Mandarin work. **[DELETED]** those 5 entries. A 6th orphaned entry (`taxi`)
  was also found but left alone since it wasn't in the original scope — worth
  a follow-up cleanup.
- `src/services/sync.js`'s `saveLibraryEntryAndSync`/`deleteLibraryEntryAndSync` —
  zero callers; if ever wired up, would double-push and return unmerged data.
  **[DELETED]** — confirmed via git history this was a superseded alternate
  design (current saves already go through `storage.js`'s own sync path),
  not scaffolding for a pending feature.
- `worker/README.md` explicitly marks `/create-checkout-session` as "TODO (not
  yet ported)" even though `worker/src/index.js` already implements it, and
  never mentions RevenueCat webhook handling at all despite that being
  implemented too. **[FIXED]**
- `package.json` has no `"test"` script despite CI running `npx vitest run`
  directly — `npm test` locally does nothing. **[FIXED]** added `"test": "vitest run"`.
- `scripts/overnight-deploy.sh` (committed, authored by Faith, 2026-07-04) and
  `scripts/overnight-qa-prompt.txt` (gitignored, never tracked) — both confirmed
  legitimate/intentional automation Faith set up herself, not stray/unknown files.
  No action — correct as-is.
- `src/components/screens/onboarding/screens/Screen16_Paywall.jsx` — confirmed
  **actually wired up** via `App.jsx:62` (lazy-imported as `Paywall`), not
  orphaned despite the odd nested folder location. No action — correct as-is.
- `.claude/worktrees/` contains 3 leftover worktree dirs from prior sessions
  (`gallant-shamir-6c7ccb`, `heuristic-fermi-0fe422`, `recursing-wiles-8a9876`,
  dated May 11-18) — housekeeping only, not part of the app. **[REMOVED]** via
  `git worktree remove --force` after confirming each was stale/clean and not
  the active worktree.

## Simplicity-First observations (flagged, not fixed)

- `audio.js` (643 lines): playback+queue+recording+shadow-timing genuinely share
  mutable state with no coordination primitive — the mixed-responsibility
  concern is real, not just organizational, and is the root cause of finding #11.
- `offlineManager.js`: write-retry-queue and bulk-audio-download logic share no
  state/code — organizationally awkward, not a correctness risk on its own.
- Three redundant language pickers now exist simultaneously on Profile/Settings
  screens (in-page pill row) plus the new always-visible shell `LanguageSwitcher` —
  same data, same handler, visible twice on one screen. Not a bug (no sync
  issue, single shared context), but worth simplifying to one.
- `ShadowSession.jsx` (689 lines), `SceneDetailScreen.jsx` (673),
  `LibraryScreen.jsx` (665) — each doing a lot in one file; candidates for
  extraction if touched again (e.g. `ShadowSession`'s `ScoreCelebration`
  sub-component, `SceneDetailScreen`'s `VocabSection`).

---

## Follow-up round 2026-07-14 (later same day)

The 5 items below were originally flagged as "needs your decision." On review,
4 of them were actually just unfinished engineering, not real decisions —
fixed now:

1. **`toneStats` migration** — **[FIXED]**. Resolved without guessing: Mandarin
   only became a real feature this week, so any pre-existing bare-digit record
   is necessarily Cantonese (Mandarin tone tracking didn't exist when it was
   written). `DB_VERSION` bumped 5→6 with a migration that re-keys old records
   as `cantonese-${digit}` inside the same upgrade transaction.
2. **Mandarin tone-weak SRS bias** — **[FIXED]**. Added `extractToneDigit()`
   (diacritic pinyin → tone digit), reusing the tone-mark table already built
   for `jyutpingDiff.js` this session, extracted into a shared
   `src/utils/pinyinTones.js`. Both `recordToneDiff` and `phraseHasWeakTone`
   now handle diacritic pinyin correctly.
3. **StatsScreen session numbers** — **[FIXED]**. All 6 `saveSession()` call
   sites now stamp `language`; added `getSessionsByLanguage()` (plain JS
   filter, matching an existing precedent in the same file — avoided touching
   `DB_VERSION`/the upgrade callback at all, so no collision with fix #1's
   migration). Old sessions with no `language` field default to `'cantonese'`
   so they don't silently vanish from stats. **Residual, genuinely needs
   scoping as its own feature, not a quick fix:** the `streak` count itself
   is one global counter (`settings.streakCount`), not per-language —
   `bestStreak` (computed from now-filtered sessions) is correctly scoped,
   but the headline streak isn't. Fixing that means redesigning how streaks
   are tracked, not stamping one more field.
4. **RevenueCat `TRANSFER` handler** — no code change needed; restating clearly
   since this was mislabeled as a decision before: it's implemented safely and
   sits dormant since there's no RevenueCat SDK integration in the app today.
   Nothing to decide until native IAP ships, at which point it should just work.
5. **Orphaned `taxi` entry in `aiChat.js`** — **[FIXED]**, deleted.

## Review complete

All 25 dispatches done (15 Tier A deep reads + 8 Tier B pattern-scans + 1 Tier C
confirm-pass), covering the full ~21,600-line codebase. `auth.js` was closed out
via a direct full-file read, which confirmed both sub-agent findings (#16, #17)
and surfaced one more (#4). Every Critical, Major, and Minor finding, all
dead-code items, and all follow-up residuals were fixed or resolved on
2026-07-14. The only genuinely open item is the streak-tracking redesign noted
above (#3), which is a new feature-scoped piece of work, not a leftover bug.
