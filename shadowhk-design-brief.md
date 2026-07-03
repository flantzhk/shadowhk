# ShadowHK — Full Design Brief & App Specification

> Version 2.3.0 · April 2026  
> For use with Claude Design, Figma, or any design handoff

---

## 1. What ShadowHK Is

ShadowHK is a Cantonese language learning app built for a specific person: someone living in Hong Kong — an expat, a new arrival, or a long-term resident who finally wants to speak. The benchmark is simple: if you complete every scene in this app, you can get around Hong Kong comfortably.

The name comes from "shadowing" — a language learning technique where you listen to a native speaker and repeat immediately, mirroring their speech pattern. Every feature in the app is built around this core mechanic.

### What makes it different
- Built on **real Hong Kong conversations**, not textbook phrases
- Every scene is grounded in how HK actually works in 2026 (Octopus card, not cash; real MTR exits; real cha chaan teng ordering culture)
- **Cultural immersion**, not just vocabulary drilling — users should fall in love with Hong Kong through the app
- Adult and sophisticated — Monocle magazine visual language, Duolingo reward mechanics underneath

### Target user
- Expats living in HK who want to connect with locals
- New arrivals learning to navigate the city
- Long-term residents who have always meant to learn Cantonese
- Heritage learners reconnecting with family language

---

## 2. Brand System

### Identity
**Core concept:** A cultural passport. Learning Cantonese IS learning Hong Kong. The city, its people, its history, its food, its streets — all inseparable from the language.

**Tone of voice:** Informed, warm, culturally curious. A knowledgeable friend who loves HK. Never childlike. Never preachy. Proud of Hong Kong.

---

### Colour Tokens

| Token | Hex | Usage |
|---|---|---|
| `--bg-0` | `#F4F1EC` | Primary background — warm off-white |
| `--bg-1` | `#FAFAF7` | Cards, surfaces, elevated areas |
| `--bg-2` | `#EDE7DF` | Section backgrounds, subtle contrast |
| `--bg-3` | `#E4DDD5` | Deepest background layer |
| `--sage-light` | `#D6E0D4` | Sage tint panels, cultural context cards |
| `--sage-mid` | `#8FAB8A` | Borders, secondary icons |
| `--sage-dark` | `#4A6B46` | Strong sage — headings, checkmarks, mastered state |
| `--fg-0` | `#1A1A1A` | Primary text |
| `--fg-1` | `#3D3D3D` | Secondary text |
| `--fg-2` | `#6B6B6B` | Tertiary text |
| `--fg-3` | `#ABABAB` | Placeholder, muted, disabled |
| `--accent` | `#C8392B` | Vermilion — all CTAs, active states, links, scores |
| `--accent-dark` | `#F2DDD9` | Vermilion tint — backgrounds behind accent elements |
| `--color-white` | `#FFFFFF` | Clean white for photo-card surfaces |

**Rule: No black backgrounds. No dark mode in v1. The entire app is light.**

---

### Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display / hero / scene titles | Playfair Display | 400–600 | Serif. Used for all screen headings, hero text, cultural facts, celebration headlines |
| Body / UI / buttons / labels | Inter | 400–600 | All functional UI text |
| Cantonese characters | Noto Serif HK | 400–500 | Always paired with Jyutping below |
| Jyutping romanisation | Inter | 400, muted | Shown below Chinese characters, slightly smaller and muted |
| Scores / stats / numbers | Inter | 700, tabular | Streak counts, scores, timers |

Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700&family=Noto+Serif+HK:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap
```

---

### Shape Language

- Border radius: `16px` cards, `24px` large sheets / bottom drawers, `999px` pill buttons and tags
- Shadows: Ultra-light, warm: `0 1px 4px rgba(0,0,0,0.07), 0 0 1px rgba(0,0,0,0.04)`
- Spacing: Generous — `24px` default screen padding, `32px` on hero areas
- Cards: Photo-dominant. Minimum `180px` height for scene cards.

---

### Photography

Real Hong Kong editorial photography — wet markets, dim sum, MTR, harbour, street life, temples, cha chaan tengs. Warm-toned, editorial quality. Every scene has one beautiful full-bleed photo.

**NOT:** stock photos, illustrated characters, cartoons, owls, or anything that looks like a children's language app.

---

### Illustration / Iconography

- Minimal line icons for navigation
- Subtle Hong Kong cultural motifs where decorative elements are needed (e.g. passport stamps, HK skyline silhouette in badges)
- No mascots, no characters, no cute animals

---

### Motion & Celebration Design Philosophy

The visual language is sophisticated (Monocle). The reward mechanics are deeply gamified (Duolingo). These are not in conflict — the animations should feel like a premium magazine coming to life, not a children's game.

- Confetti: vermilion `#C8392B` + sage `#4A6B46` + warm gold — never rainbow
- Score pops: scale `0 → 1.2 → 1.0`, `250ms ease`
- Celebrations: full-screen overlays use a semi-transparent warm overlay, not black
- Streak fire: pulse animation, not cartoon bounce
- Correct flash: `150ms` sage green glow, immediate and satisfying
- All celebrations: editorial typography, generous whitespace, never cluttered

---

## 3. Navigation Structure

**4 bottom tabs:**
1. **Home** — daily session + editorial feed
2. **Scenes** — browse all content
3. **Library** — saved phrases organised by scene
4. **Profile** — stats, journey, settings access

**Removed:** Search tab (library too small to warrant it), MiniPlayer (audio stays within its screen)

**Practice modes** are accessed from: Home shortcuts row + inside Scene Detail mode picker. No dedicated Practice tab.

---

## 4. Screen Specifications

---

### Screen 1 — Home

**Purpose:** The daily hub. Equal parts habit tracker and cultural magazine. Opens feeling like a daily newspaper designed by Monocle.

**Layout (top to bottom):**
- Status bar (light)
- Greeting row: "Good morning, Faith" (Inter medium, left) + streak chip "🔥 14" (vermilion pill, right)
- **Hero card** (full-width, `rounded-24`): full-bleed HK photo, fade to white at bottom, "Today's Scene" label (small sage), scene title in Playfair serif (white on photo), difficulty pill
- **Continue card** (if mid-scene): progress bar in vermilion, scene name, "Resume →"
- **Practice shortcuts** (horizontal scroll): 4 rounded chips — Shadow (mic), Tone Gym (music note), Speed Run (lightning), Speak Cantonese Now (waveform) — sage tint `#D6E0D4` background, sage dark text
- **Culture feed preview** heading "From Hong Kong" (Playfair serif small): 2 editorial cards (HK photo + headline + sage tag)
- Bottom tab bar

---

### Screen 2 — Scenes

**Purpose:** Browse all available Hong Kong conversations and cultural content. Condé Nast Traveller meets DoorDash navigation.

**Layout:**
- **Category filter row**: circular icon chips with labels — Market, Restaurant, MTR, Social, Shopping, Medical. Active filter: vermilion border + blush `#F2DDD9` fill
- **Featured scene**: full-width editorial hero card, large HK photo, Playfair serif title, sage cultural subtitle
- **Section headings**: Playfair serif dividers — "Street Life", "Food & Drink", "Getting Around"
- **2-column scene grid**: each card has HK photo top, scene name Inter medium, Jyutping subtitle muted, difficulty pill + duration

---

### Screen 3 — Scene Detail

**Purpose:** Deep dive into one scene. Cultural article first, practice second.

**Layout (scroll):**
- Full-bleed photo header `240px`, fades to `#F4F1EC` at bottom
- Back arrow top-left
- Scene title (Playfair Display `28px`)
- Subtitle: Chinese + Jyutping + English description (sage text)
- **Cultural Context card** (sage tint `#D6E0D4`): "Did you know?" heading, editorial paragraph with HK history/fact, optional small archival photo
- **Mode picker** (2×2 grid of cards): Listen / Shadow / Speak Cantonese Now / Drill — each with icon, mode name, 1-line description
- **Dialogue preview**: scrollable transcript, each line tappable to hear audio. Expanding Chinese characters shows word-by-word breakdown.
- **Saved phrases**: phrases from this scene already in Library surface here

---

### Screen 4 — Shadow Session

**Purpose:** Core learning mode. Listen and repeat, karaoke-style. Meditative, full-screen, focused.

**Layout:**
- Full screen `#F4F1EC`
- Top: scene name (small muted) + progress bar "3/8" (vermilion fill)
- Centre: Jyutping (Inter `22px`, muted) → Chinese characters (Noto Serif HK `52px`, `#1A1A1A`) → English translation (Inter `14px`, muted)
- **Karaoke highlight**: words sweep vermilion left-to-right as audio plays (word-level timing)
- Audio waveform: 5 bars, animated, vermilion
- Toggle row: Jyutping on/off, English on/off
- **Mic button**: `72px` circle, vermilion border, mic icon, "Hold to shadow" label
- Score appears after recording: `%` accuracy + waveform comparison
- Previous/next arrows flanking mic

---

### Screen 5 — Speak Cantonese Now

**Purpose:** Simulate real social pressure. AI plays a HK character (shopkeeper, taxi driver, neighbour) and speaks to you first. You respond. Always-on mic — no tap required.

**Core insight:** The gap between knowing phrases and conversational fluency is the ability to respond on your feet in that high-stakes anxious moment. This mode trains exactly that.

**How it works:**
1. Scene title flashes 2 seconds
2. AI character speaks immediately (in Cantonese, voice synthesis)
3. Mic activates automatically when AI stops (VAD — Voice Activity Detection)
4. User speaks — VAD detects silence (~1.5s) and auto-submits
5. AI responds in character naturally
6. 3–6 exchanges total
7. End: brief reflection screen

**Difficulty levels (controls AI tolerance for mistakes):**
- **Tolerant**: AI understands even broken Cantonese — a patient shopkeeper who works with learners. Never asks you to repeat.
- **Neutral**: AI responds naturally. Unclear Cantonese moves forward, no penalty.
- **Strict**: AI asks you to repeat if unclear. No safety net.

**Layout:**
- Full screen, minimal chrome
- Small pill tag: "茶餐廳 · Sham Shui Po" (scene context, blush background)
- Difficulty selector: 3 pills — Tolerant / Neutral / Strict
- Character avatar: circular illustration, warm editorial style
- AI speaking: animated waveform below avatar (sage green bars), "Speaking Cantonese…" label
- Your turn: large pulsing circle `72px` vermilion + mic icon + "Your turn — speak now"
- No text chat interface. Subtitle toggle (off by default) top-right corner.
- "End session" text link (muted) at bottom

---

### Screen 6 — Tone Gym

**Purpose:** Arcade-style tone accuracy training. Fast, competitive, score-focused.

**Layout:**
- Pre-game: "Ready?" screen, today's score, high score, Start button (vermilion)
- **In-game**: thin vermilion border on screen edge (game mode signal)
  - Top: round counter + score + burning timer bar (vermilion, depleting)
  - Centre: large Chinese character (Noto Serif HK `72px`) + Jyutping without tone number
  - 4 answer buttons (2×2): tone options in Inter medium, `#FAFAF7` cards
  - Streak multiplier badge "×3" vermilion top-right
- Correct answer: sage green flash `150ms` + "+10" score pop (vermilion, scale animation)
- Wrong answer: shake animation, correct tone briefly highlighted
- Results: score card, accuracy %, improvement vs last session, tone-by-tone breakdown

---

### Screen 7 — Speed Run

**Purpose:** Fast vocabulary quiz. Tap the correct translation before time runs out.

**Mechanic:** Audio plays + Chinese shown → 4 English options → tap correct → bonus for speed.

**Layout:**
- Background `#EDE7DF` (slightly darker than normal — signals game mode)
- Timer bar top (burning vermilion)
- Score counter bold right
- Chinese characters large + audio waveform small
- 4 translation buttons full-width, rounded-16, `#FAFAF7`
- Streak multiplier "🔥×4" vermilion pill
- Correct answer: sage green fill on button
- Results: score, streak, "phrases to review" list

---

### Screen 8 — Library

**Purpose:** Personal phrasebook. Phrases automatically organised by the scene they came from.

**Layout:**
- "My Library" (Playfair Display) + phrase count (muted) top
- **Scene sections**: scene thumbnail `40px` circle + scene name (Playfair serif heading) + phrase count
- **Phrase rows**: Chinese `20px` + Jyutping `13px` muted + English `13px` muted + play icon right + bookmark icon (filled vermilion = saved)
- **Word breakdown** (expandable): tap Chinese characters in any row → word-by-word panel slides down showing each word's characters, Jyutping, English meaning. Each word: play button + "+" save to Library button.
- **Vocabulary sets** (pre-loaded): Numbers 1–100, Colours, Coffee & drink types, Days & times — shown as collapsible sets in the Library for new users
- **Empty state**: sage tint card — "Save your first phrase — tap the bookmark on any line in a scene"

---

### Screen 9 — Profile

**Purpose:** Your learning identity and progress record.

**Three sections:**

**Section 1 — Habit:**
- Streak: "🔥 14" (Playfair Display `48px`) + "day streak" label
- Daily goal ring: `80px` diameter, vermilion arc, "7/10 min" centre text
- Activity heatmap: 7×13 grid, last 90 days, sage green shades for intensity

**Section 2 — Skills:**
- 3 stat tiles (row): "247 Phrases" / "78% Tone accuracy" / "82% Shadow score"
- Each on `#FAFAF7` card, number large vermilion, label muted Inter

**Section 3 — Journey:**
- "Scenes Completed" heading (Playfair serif)
- Grid 4-wide: scene photo tiles — completed = full colour, not yet = greyed passport-stamp style
- Badge row: milestone badges in sage/vermilion
- Settings gear icon top-right (small, doesn't dominate)

---

### Screen 10 — Onboarding: Inspire (3 slides)

**Purpose:** Make the user fall in love with Hong Kong before they learn a word.

**Slide 1:** Full-bleed Victoria Harbour aerial photo. Dark gradient overlay top 30%. Logo `40px` vermilion circle (影). Playfair Display white `32px`: "Hong Kong speaks in tones. Most people never hear them." Body white/80%: "ShadowHK is built on real conversations — not textbook phrases." Pagination dots (5), first active vermilion. Vermilion pill "Get started" bottom.

**Slide 2:** Full-bleed wet market photo. "The words that get you in. The culture that keeps you." serif headline. Subhead about cultural immersion.

**Slide 3:** Full-bleed cha chaan teng photo. "Begin." Full-width vermilion CTA.

---

### Screen 11 — Onboarding: Personalise

**Purpose:** 3–4 quick questions to personalise the experience.

**Questions (shown as separate steps):**
1. "Why are you learning Cantonese?" — Heritage / Expat life / Travel / Curious
2. "How much time per day?" — 5 min / 10 min / 20 min
3. "What's your level?" — Complete beginner / Some basics / Conversational

**Layout:** `#F4F1EC` background. Progress dots top. Playfair Display question. Full-width option cards (`#FAFAF7` rounded-16). Selected: vermilion border + blush `#F2DDD9` fill. "Continue" vermilion pill bottom.

---

### Screen 12 — Login

**Layout:** HK photo background top `200px` (blurred, warm, harbour) fading to `#F4F1EC`. Logo + "ShadowHK" Playfair. Headline "Welcome back to Hong Kong." Playfair `26px`. Email + password inputs on `#FAFAF7` rounded-12. "Forgot?" vermilion right-align. Vermilion "Sign in" pill full-width. Divider "OR CONTINUE WITH". Apple / Google / Email link buttons. "New here? Create an account" with vermilion link.

---

### Screen 13 — Register

Same visual language as Login. Headline "Begin your journey." Name + email + password. Vermilion "Create account" pill. "Already have an account? Sign in" muted link.

---

### Screen 14 — Culture Feed

**Purpose:** Editorial layer. Makes users fall in love with HK. Monocle magazine feel.

**Layout:**
- "From Hong Kong" (Playfair Display `24px`) top
- **Hero article card**: full-bleed HK photo `180px`, fade to white, Playfair `20px` headline ("The Secret Language of the Wet Market"), 2-line teaser muted, "Culture · 3 min read" sage pill
- **Phrase of the Day card**: sage tint `#D6E0D4`, "Phrase of the Day" label sage dark small caps, Chinese large Noto Serif HK, Jyutping muted, English, play button vermilion
- 2 smaller article cards side by side
- "Did you know?" horizontal scroll: cream cards, short HK fact + 🇭🇰

---

### Screen 15 — Session Summary

**Purpose:** End-of-session celebration + cultural reward.

**Layout:**
- Large "87%" Playfair Display `72px` vermilion top
- "Personal best ↑ Previous: 74%" sage small
- Accuracy bars: Pronunciation / Tone / Speed — horizontal, vermilion fill, labelled
- "8 phrases practised" list with phrase rows + score pills
- **Cultural note unlock card**: sage tint `#D6E0D4` — "🏮 Cultural note unlocked" + dim sum fact
- Two CTAs: "Next scene →" vermilion full-width + "Practise again" ghost outline

---

### Screen 16 — Settings

**Purpose:** Utility. Clean, functional. Accessed from Profile gear icon.

**Sections:**
- ACCOUNT — Profile / Subscription / Sign out
- DISPLAY — Show Jyutping toggle (vermilion on) / Show English toggle / Text size
- NOTIFICATIONS — Daily reminder toggle + time picker
- ABOUT — Version / Licenses / Legal

---

### Screen 17 — Paywall

**Purpose:** Soft gate. Users explore freely, hit a wall naturally. Paywall is editorial, not aggressive.

**Layout:**
- HK night skyline photo top `200px`, fade to `#F4F1EC`
- "Unlock all of Hong Kong." Playfair Display `28px`
- "Every scene. Every mode. Every conversation." Inter muted
- Feature list: 4 rows with sage `#4A6B46` checkmarks — "All 27 scenes" / "Speak Cantonese Now" / "Tone Gym unlimited" / "Offline audio"
- Pricing: "HK$68 / month" large + "or HK$488 / year — save 40%" muted
- Vermilion "Start 7-day free trial" full-width pill
- "Maybe later" muted ghost link
- Social proof: "Joined by 4,200 Hong Kong learners" small muted

---

## 5. Celebration & Reward Screens

> These are Duolingo-style reward moments inside Monocle-style design. Premium energy, editorial typography, tasteful confetti (vermilion + sage + warm gold only — no rainbow).

---

### Celebration 1 — Streak Milestone: 7 Days

**Trigger:** User maintains a 7-day streak.  
**Type:** Full-screen overlay on blurred app background.

Centre card `#FAFAF7` rounded-24, warm shadow. Confetti burst (vermilion + sage + gold). Large "🔥" emoji `56px`. Playfair Display: "7 days. You're building something real." Body Inter muted: "Most people quit in 3 days. You didn't." Streak counter "7" large vermilion tabular. "Keep going" vermilion pill bottom of card.

---

### Celebration 2 — Streak Milestone: 30 Days

**Trigger:** 30-day streak.  
**Type:** Full-screen overlay, bigger energy than 7-day.

Gold confetti dominant. "🔥 30" Playfair Display `56px` bold vermilion. "One month. You speak Cantonese now." Badge illustration: circular badge in vermilion with HK skyline silhouette. "Share your streak" ghost + "Keep going" vermilion pill.

---

### Celebration 3 — Scene Completed (First Time)

**Trigger:** User completes all lines in a scene for the first time.  
**Type:** Full screen on warm off-white.

Confetti top (vermilion + sage). "✓ Complete" sage green circle `64px`. Playfair Display "Cha Chaan Teng — done." `28px`. Cultural unlock panel: sage tint card, "🏮 Cultural note unlocked" + 2-line fact. Score pills row: "87% score" / "8 phrases" / "Personal best". CTAs: "Next scene →" vermilion + "Practise again" ghost.

---

### Celebration 4 — Perfect Shadow Score (100%)

**Trigger:** User gets 100% on a shadow session.  
**Type:** Full screen, dramatic but tasteful.

Warm `#F4F1EC` background. "100" Playfair Display italic `96px` vermilion. "Perfect shadow." serif below. Thin vermilion decorative line. Chinese character of the scene large + faint watermark behind. "Your pronunciation matched the native speaker." muted `14px`. Sparse confetti — ~20 pieces max, vermilion and sage. Cultural bonus card slides up from bottom (sage tint). "Continue" vermilion pill.

---

### Celebration 5 — Personal Best Score

**Trigger:** User beats their previous high score for any session.  
**Type:** Inline banner (not full screen). Slides in from top, auto-dismisses after 3 seconds.

`#F2DDD9` blush pill banner: "⬆ Personal best! 87% — up from 74%" vermilion text + sage checkmark. Overlays Session Summary screen.

---

### Celebration 6 — Phrase Mastered (Inline)

**Trigger:** A phrase's SRS status reaches "mastered" in the Library.  
**Type:** Inline within Library screen. Does not interrupt flow.

The specific phrase row: background shifts to sage tint `#D6E0D4`. Chinese character pulses vermilion glow briefly. "Mastered ✓" badge appears right of row (sage green pill). Small confetti burst — 8 pieces around the row. Returns to normal after 1.5 seconds.

---

### Celebration 7 — 50 Phrases Milestone

**Trigger:** User saves or masters their 50th phrase.  
**Type:** Full screen.

"50" Playfair Display `80px` vermilion. "phrases learned" Inter below. Passport metaphor: HK passport stamp grid, 50 stamps filled in vermilion and sage. Playfair italic body: "You could now order dim sum, hail a taxi, and bargain at the wet market." Confetti. "Keep collecting" vermilion pill + "See your library" ghost.

---

### Celebration 8 — Tone Gym Correct Answer Flash

**Trigger:** User taps the correct tone in Tone Gym.  
**Type:** In-game instant flash, `500ms`, then advances automatically.

Tapped button: sage `#D6E0D4` background + sage `#4A6B46` border + ✓ icon. "+10" score pop in vermilion above button (scale `0→1.2→1`). Chinese character briefly glows sage green. Score counter increments. Timer bar continues burning.

---

### Celebration 9 — Tone Gym New High Score

**Trigger:** User beats their Tone Gym high score.  
**Type:** Full-screen results.

"🏆" `48px` top. "New High Score!" Playfair Display `32px` vermilion. Score "580" huge Playfair `72px`. "Previous best: 480" muted struck-through. Tone-by-tone accuracy breakdown (3 rows with bars). Confetti (vermilion + sage). "Play again" vermilion + "Back to home" ghost.

---

### Celebration 10 — Daily Goal Complete

**Trigger:** User hits their daily time goal.  
**Type:** Bottom sheet slides up from bottom.

Handle bar top. Goal ring `100%` complete — vermilion full circle, ✓ centre. "Today's goal: done." Playfair `22px`. Streak row "🔥 14 days" vermilion. Cultural fact of the day in sage tint card. "See you tomorrow" Inter muted. "Done" vermilion pill. Tapping outside dismisses.

---

## 6. Content Architecture

### The 27 Scenes (current)

Grouped by category:

**Getting Around:** MTR Station, Taxi, Minibus, Ferry, Asking for Directions  
**Food & Drink:** Cha Chaan Teng, Dim Sum, Wet Market, Bakery, Complimenting Food, Paying the Bill, Booking a Table  
**Shopping:** Shopping (Clothes), Convenience Store  
**Health & Services:** Pharmacy, Doctor / Clinic, Post Office, Bank Counter  
**Home & Community:** Neighbour (Lift), Building Management, School Gate  
**Social:** Meeting Someone New, Weather Talk, Hair Salon  
**Culture & Celebration:** Chinese New Year, Mid-Autumn Festival, Temple Visit  

### Scene Accuracy Standard

Every scene must reflect HK as it is in 2026:
- **Ferry**: Octopus card primary, correct fare pricing
- **Taxi**: Cantonese address format, directions (left = 左 zo2, right = 右 jau6, straight = 直 = jik6)
- **MTR**: Exit numbers, Octopus top-up, turnstile phrases
- **Cha Chaan Teng**: Full drink vocabulary (yuan yang 鴛鴦, milk tea hot/cold/less sweet 少甜, no ice 走冰), breakfast set system

### Scene Depth Standard

Every scene must cover:
1. **Full natural arc** — walk in to goodbye, including variations
2. **Cultural context** — editorial note in Scene Detail
3. **Vocabulary embedded** — numbers, sizes, colours appear naturally
4. **Realistic HK norms** — actual customs, payment methods, etiquette

### Pre-loaded Library Vocabulary Sets

On first run, Library ships with these reference sets:

| Set | Contents |
|---|---|
| Numbers 1–100 | yat1 (1), ji6 (2)... through baak3 (100) |
| Colours | red, blue, green, white, black, yellow, pink, purple |
| Coffee & Drink Types | milk tea, lemon tea, yuan yang, iced/hot, less sweet, no ice |
| Days & Times | Monday–Sunday, times of day, today/tomorrow/yesterday |
| Sizes | S/M/L/XL, too big, too small, just right |
| Common Adjectives | hot/cold, cheap/expensive, near/far, heavy/light, spicy |
| Emergency Phrases | help, I'm lost, call police, I feel sick, where is the hospital |
| Greetings & Farewells | hello, goodbye, thank you, excuse me, sorry, you're welcome |

---

## 7. Key Features

### Word-by-Word Breakdown

**Where:** Available in every dialogue line (Scene Detail transcript + Shadow Session + Library phrase rows)  
**How it works:** Tap the Chinese characters in any line → breakdown panel expands → each word shown with characters, Jyutping, English meaning → tap word to hear it → "+" button to save individual word to Library  
**Status:** Built in PhraseRow.jsx and PhraseCard.jsx. PhraseRow needs "save to Library" button added per word (currently exists in PhraseCard only).

### Always-On VAD Microphone (Speak Cantonese Now)

No tap-to-record button in SCN mode. When the AI finishes speaking, the mic activates automatically. User speaks. Voice Activity Detection (VAD) detects ~1.5s silence and auto-submits. Visual: pulsing vermilion circle shows mic is live. Implementation: `@ricky0123/vad-web` or Web Audio API `AudioWorkletProcessor`.

### Speak Cantonese Now (replaces AI Conversation)

Replaces the old AI Conversation screen entirely. Scenario-grounded, voice-first, character roleplay. Each scene unlocks a corresponding SCN scenario — the AI plays the character from that scene. No free-chat mode. Difficulty controls the AI's tolerance for unclear Cantonese (not speed or hints).

### SRS (Spaced Repetition System)

Phrases in Library are scheduled for review using SRS. The Library shows review status on each phrase row. Profile heatmap reflects SRS activity. The system runs silently — users don't need to understand it.

---

## 8. Removed Features

| Feature | Why removed |
|---|---|
| Search screen | Library too small to need a search function |
| MiniPlayer | Audio stays within its screen; persistent player broken in current build |
| Prompt Drill | Replaced by Speak Cantonese Now (better version of the same idea) |
| DayDetailScreen | Day-level detail wasn't necessary |
| Dark mode | Not in v1; brand is light |
| AI Conversation | Replaced by Speak Cantonese Now |

---

## 9. Screens Not Yet Built

| Screen | Priority |
|---|---|
| Culture Feed | High — editorial layer that makes HK feel alive |
| Speak Cantonese Now | High — core feature, replaces AIConversation |
| Vocabulary Sets in Library | Medium — pre-loaded content for new users |

---

## 10. Claude Design Prompt

> Copy everything below this line and paste directly into Claude Design.

---

```
Design a complete mobile app UI for ShadowHK — a Cantonese language 
learning app for expats and new arrivals in Hong Kong. 26 screens total 
in one presentation. Each slide = one mobile screen at 390×844px in a 
phone frame. Every element, colour, copy, and layout is specified below 
— no guessing required.

BRAND SYSTEM (apply to every slide without exception):
Background: #F4F1EC warm off-white
Cards/surfaces: #FAFAF7
Sage tint panels: #D6E0D4
Sage accent text/icons: #4A6B46
Primary text: #1A1A1A
Secondary text: #6B6B6B
Muted/placeholder: #ABABAB
PRIMARY ACCENT — ALL CTAs, active states, links, scores: #C8392B vermilion red
Accent tint/blush: #F2DDD9
Display/heading font: Playfair Display serif (screen titles, hero text, 
  cultural facts, celebration headlines)
UI/body font: Inter (labels, buttons, body, descriptions)
Chinese characters: Noto Serif HK (always with Inter Jyutping below)
Border radius: 16px cards, 24px sheets, 999px pill buttons
Shadows: 0 1px 4px rgba(0,0,0,0.07)
Photography style: real Hong Kong editorial — markets, MTR, dim sum, 
  harbour, streets. Warm-toned, never stock.
NO dark backgrounds. NO cartoons. NO mascots. Adult, editorial, premium.
Confetti colours (celebrations only): vermilion #C8392B + sage #4A6B46 
  + warm gold. Never rainbow.

--- MAIN APP SCREENS (Slides 1–16) ---

SLIDE 1 — HOME SCREEN
Status bar (light). Greeting row: "Good morning, Faith" Inter medium 
left + streak chip "🔥 14" vermilion pill right. Hero card full-width 
rounded-24: HK dim sum photo full-bleed, fade to white bottom, "Today's 
Scene" small sage label + "Ordering Dim Sum at Yum Cha" Playfair serif 
title white on photo + "Intermediate" difficulty pill. Below: Continue 
card (progress bar vermilion + scene name + "Resume →"). Practice 
shortcuts horizontal scroll: 4 sage-tint rounded chips — Shadow (mic 
icon) / Tone Gym (music note) / Speed Run (lightning bolt) / Speak Now 
(waveform). Section heading "From Hong Kong" Playfair serif small. 2 
editorial culture cards: HK photo left, headline right, sage tag. Bottom 
tab bar: Home (active vermilion dot), Scenes, Library, Profile.

SLIDE 2 — SCENES SCREEN
Category filter row: 6 circular icon chips — Market (vegetable), 
Restaurant (chopsticks), MTR (train), Social (chat bubble), Shopping 
(bag), Medical (cross). Active chip: vermilion border + blush #F2DDD9 
fill. Featured hero scene: full-width card 200px, HK street photo, 
Playfair title "Street Market Bargaining", sage pill "Getting Around", 
vermilion "New" pill. Section divider "Food & Drink" Playfair serif. 
2-column grid of scene cards: HK photo 120px top, scene name Inter 
medium, Jyutping subtitle muted, difficulty pill + duration row. 
Bottom tab: Scenes active.

SLIDE 3 — SCENE DETAIL
Full-bleed HK dim sum photo 240px, fades to #F4F1EC. Back arrow top-left. 
"Ordering Dim Sum" Playfair Display 28px. "點心 dim sam1 · Cantonese for 
the table" sage text subtitle. Cultural Context card: #D6E0D4 sage tint, 
rounded-16, "Did you know?" heading sage dark, body text "Yum cha has 
been the heartbeat of Hong Kong social life since the 1800s. On weekends, 
families queue before 8am for the best har gow." Mode picker 2×2: 
Listen (ear, blush bg) / Shadow (mic, sage bg) / Speak Now (waveform, 
blush bg) / Drill (lightning, sage bg). Each: icon + mode name Inter 
medium + 1-line description muted. Dialogue preview heading + 3 
transcript lines.

SLIDE 4 — SHADOW SESSION
Full screen #F4F1EC. Top: "Ordering Dim Sum" small muted + progress bar 
"3 of 8" vermilion fill. Centre: "nei5 hou3 aa3" Inter 22px muted, 
"你好呀" Noto Serif HK 52px #1A1A1A, "Hello there!" Inter 14px muted. 
Word-level karaoke: "你" highlighted vermilion, "好" "呀" normal. 
Animated waveform 5 bars vermilion. Toggle row: Jyutping on/off + 
English on/off eye icons. Large mic button bottom-centre 72px vermilion 
circle, mic icon, "Hold to shadow" label. Previous/next arrows.

SLIDE 5 — SPEAK CANTONESE NOW
Full screen. Top pill: "茶餐廳 · Sham Shui Po" on blush #F2DDD9. 
Difficulty pills centred: Tolerant | Neutral (vermilion selected fill) | 
Strict. Character avatar circle 80px (illustrated HK auntie/uncle 
shopkeeper). AI speaking state: 5 animated waveform bars sage green 
below avatar, "Speaking Cantonese…" label muted. Your mic state: large 
72px pulsing vermilion circle + mic icon + "Your turn — speak now". 
No text. Subtitle toggle small top-right. "End session" muted text link 
bottom.

SLIDE 6 — TONE GYM IN-GAME
Thin vermilion border on screen edge (game mode signal). Top: "Round 3 
· Score 240" Inter bold + timer bar burning left to right vermilion 60% 
remaining. Centre: "馬" Noto Serif HK 72px. 4 answer buttons 2×2: 
"mā — 1st rising" / "má — 2nd high" / "mǎ — 3rd low-dipping" / 
"mà — 4th falling". Rounded-16 #FAFAF7 cards Inter medium. Streak 
multiplier "×3" vermilion badge top-right. "Best: 480" muted small.

SLIDE 7 — SPEED RUN IN-GAME
Background #EDE7DF slightly darker. Timer bar burning red top. Score 
"320" large bold right. "唔該" large + "m4 goi1" Jyutping. 4 full-width 
translation buttons rounded-16: "Excuse me / Thank you" / "I don't know" 
/ "No problem" / "How much?" — first button shown sage-green selected. 
Streak "🔥×4" vermilion pill.

SLIDE 8 — LIBRARY
"My Library" Playfair Display top + phrase count muted. Scene section: 
"Cha Chaan Teng" serif heading + thumbnail 40px + "6 phrases". Phrase 
rows: Chinese 20px + Jyutping 13px muted + English 13px muted + play 
icon + vermilion filled bookmark (saved). Divider. Next section "Dim 
Sum · 4 phrases". Empty state at bottom: sage tint card with arrow.

SLIDE 9 — PROFILE
Section 1: "🔥 14" Playfair Display 48px + "day streak". Goal ring 80px 
vermilion 70% arc "7/10 min" centre. Activity heatmap 7×13 sage shades. 
Section 2: 3 stat tiles row — "247 Phrases" / "78% Tone accuracy" / 
"82% Shadow score" — number large vermilion, label muted. Section 3: 
"Scenes Completed" serif. 4-wide grid: 6 scene photos full-colour + 
rest greyed stamp-style. Badge row: 3 badges. Settings gear top-right.

SLIDE 10 — ONBOARDING INSPIRE SLIDE 1
Full-bleed Victoria Harbour aerial photo, editorial warm tone. Dark 
gradient overlay top 30%. Logo: 40px vermilion circle with "影". 
Playfair Display white 32px: "Hong Kong speaks in tones. Most people 
never hear them." Body white/80%: "ShadowHK is built on real 
conversations — not textbook phrases." 5 pagination dots, dot 1 active 
vermilion elongated. Large vermilion pill "Get started" bottom.

SLIDE 11 — ONBOARDING PERSONALISE
#F4F1EC background. "3 of 5" progress dots top. Playfair Display: 
"Why are you learning Cantonese?" 4 option cards full-width rounded-16 
#FAFAF7: "Heritage — connecting with family" / "Expat life — living in 
HK" / "Travel — visiting HK soon" / "Curious — I love languages". 
Second option selected: vermilion border + blush #F2DDD9 fill. "Continue" 
vermilion pill bottom. Back link muted top-left.

SLIDE 12 — LOGIN
HK harbour photo top 200px blurred fading to #F4F1EC. Logo 40px circle 
+ "ShadowHK" Playfair. "Welcome back to Hong Kong." Playfair 26px. 
Email + password inputs #FAFAF7 rounded-12. "Forgot?" vermilion 
right-align. Vermilion "Sign in" pill full-width. "OR CONTINUE WITH" 
divider. Apple / Google / Email link buttons #FAFAF7 border. "New here? 
Create an account" vermilion link.

SLIDE 13 — REGISTER
Same as Login. "Begin your journey." Playfair 26px. Name + email + 
password fields. "Create account" vermilion pill. "Already have an 
account? Sign in" muted link.

SLIDE 14 — CULTURE FEED
"From Hong Kong" Playfair Display 24px top. Hero article card: HK photo 
180px, Playfair "The Secret Language of the Wet Market" 20px, teaser 
muted, "Culture · 3 min read" sage pill. Phrase of the Day card: 
#D6E0D4 sage tint, "PHRASE OF THE DAY" sage dark small caps, "早晨" 
Noto Serif HK large, "zou2 san4" Jyutping muted, "Good morning" English, 
vermilion play button. 2 smaller article cards side by side. Horizontal 
scroll "Did you know?" fact cards cream bg.

SLIDE 15 — SESSION SUMMARY
"87%" Playfair Display 72px vermilion top. "Personal best ↑ Previous: 
74%" sage small. Accuracy bars: Pronunciation 91% / Tone 84% / Speed 86% 
horizontal vermilion fill labelled. "8 phrases practised" list with score 
pills. Cultural note unlock card: #D6E0D4 sage tint, "🏮 Cultural note 
unlocked" + dim sum fact text. "Next scene →" vermilion full-width + 
"Practise again" ghost button.

SLIDE 16 — SETTINGS
"Settings" Playfair top. Clean list sections with sage dividers: 
ACCOUNT (Profile / Subscription / Sign out) · DISPLAY (Jyutping toggle 
vermilion-on / English toggle / text size) · NOTIFICATIONS (reminder 
toggle + time) · ABOUT (version 2.3.0 / Licenses / Legal). Chevrons 
for drill-down rows.

--- CELEBRATION & REWARD SCREENS (Slides 17–26) ---

SLIDE 17 — STREAK MILESTONE: 7 DAYS
Full-screen overlay. Semi-transparent warm overlay behind. Centre card 
#FAFAF7 rounded-24 shadow. Confetti burst: vermilion + sage + gold. 
"🔥" 56px. Playfair "7 days. You're building something real." 26px. 
Inter muted: "Most people quit in 3 days. You didn't." "7" large 
vermilion tabular. "Keep going" vermilion pill.

SLIDE 18 — STREAK MILESTONE: 30 DAYS
Full-screen overlay. Gold confetti dominant. "🔥 30" Playfair Display 
56px bold vermilion. "One month. You speak Cantonese now." Circular 
badge illustration: vermilion with HK skyline silhouette. "Share your 
streak" ghost + "Keep going" vermilion pill.

SLIDE 19 — SCENE COMPLETED (FIRST TIME)
Full screen #F4F1EC. Confetti top vermilion + sage. "✓ Complete" in 
sage green circle 64px. Playfair "Cha Chaan Teng — done." 28px. Cultural 
unlock panel: #D6E0D4 sage tint card, "🏮 Cultural note unlocked" + 
dim sum fact 2 lines. Score pills row: "87% score" / "8 phrases" / 
"Personal best". "Next scene →" vermilion full-width + "Practise again" 
ghost.

SLIDE 20 — PERFECT SHADOW SCORE (100%)
Warm #F4F1EC background. "100" Playfair Display italic 96px vermilion. 
"Perfect shadow." serif below. Thin vermilion decorative line. Chinese 
character "你好呀" large faint watermark behind. "Your pronunciation 
matched the native speaker." muted 14px. Sparse confetti ~20 pieces 
vermilion + sage. Cultural bonus card slides up from bottom sage tint. 
"Continue" vermilion pill.

SLIDE 21 — PERSONAL BEST SCORE (INLINE BANNER)
Shown as overlay on Session Summary screen. Pill-shaped banner 
#F2DDD9 blush slides in from top: "⬆ Personal best! 87% — up from 74%" 
vermilion text + sage ✓. Auto-dismisses. Rest of Session Summary visible 
behind.

SLIDE 22 — PHRASE MASTERED (INLINE IN LIBRARY)
Library screen context visible. One phrase row highlighted: #D6E0D4 sage 
tint background. Chinese character shows vermilion glow pulse. "Mastered 
✓" sage green pill appears right of row. 8 small confetti pieces burst 
around row. All other rows normal.

SLIDE 23 — 50 PHRASES MILESTONE
Full screen. "50" Playfair Display 80px vermilion. "phrases learned" 
Inter. Passport stamp grid illustration: 50 stamps filled vermilion/sage, 
rest empty. Playfair italic: "You could now order dim sum, hail a taxi, 
and bargain at the wet market." Confetti. "Keep collecting" vermilion + 
"See your library" ghost.

SLIDE 24 — TONE GYM CORRECT ANSWER FLASH
In-game screen (same as Slide 6) showing post-correct state. Tapped 
button: #D6E0D4 sage fill + #4A6B46 sage border + ✓ icon. "+10" 
vermilion text above button (scale pop animation). Chinese character 
sage green glow. Score counter incremented. Timer bar still burning. 
This is a 500ms state.

SLIDE 25 — TONE GYM NEW HIGH SCORE
Full screen results. "🏆" 48px top. "New High Score!" Playfair 32px 
vermilion. "580" Playfair 72px huge. "Previous best: 480" muted 
struck-through. 3-row tone accuracy breakdown with horizontal bars. 
Confetti vermilion + sage. "Play again" vermilion + "Back to home" ghost.

SLIDE 26 — DAILY GOAL COMPLETE (BOTTOM SHEET)
Bottom sheet slides up from bottom, handle bar top. Goal ring 100% 
vermilion complete circle, ✓ centre. "Today's goal: done." Playfair 22px. 
"🔥 14 days" vermilion streak row. Cultural fact of the day in #D6E0D4 
sage tint card. "See you tomorrow" muted. "Done" vermilion pill.
```
