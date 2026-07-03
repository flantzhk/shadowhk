# ShadowHK — Design Reference
*App version 2.3.7 · Last updated May 2026*

---

## App Overview

ShadowHK is a Cantonese (and Mandarin) language learning app built around the "shadowing" method — listening to a native speaker and immediately repeating. The content is grounded in real Hong Kong conversations: wet markets, taxis, cha chaan tengs, the MTR. Not phrasebook Cantonese — the Cantonese that actually works in daily life.

The core loop: **pick a scene → listen → shadow (record yourself) → get scored on pronunciation and tone accuracy → review due phrases → build streak**.

Supporting modes include AI conversation practice, Speed Run (flashcard quiz against the clock), Tone Gym (ear training), a personal phrase library with spaced repetition, and a custom "introduce yourself" scene builder.

---

## Navigation Structure

### Mobile (< 900px)
- **TopBar** (fixed, 64px): ShadowHK wordmark left, profile avatar / sign-in button right
- **BottomTabBar** (fixed, 68px): 4 tabs — Today (home), Browse (scenes), Saved (library), You (profile)
- The tab bar shows a badge on "Saved" when phrases are due for review
- Immersive screens (Shadow session, Tone Gym, Speed Run, onboarding, session end) hide both TopBar and BottomTabBar entirely — full-screen, no chrome

### Desktop (≥ 900px)
- **Sidebar** (left rail): replaces BottomTabBar. Same 4 nav items plus a Sign In button at the bottom for unauthenticated users
- TopBar is not shown on desktop

### Route architecture
The app uses hash-based routing (`#route/id`). All routes:

| Route | Screen |
|---|---|
| `home` | Home (Today) |
| `firstrun` | Onboarding flow |
| `scenes` | Browse scenes |
| `scene/:id` | Scene detail |
| `shadow/:id` | Shadow session |
| `session-end` | Session summary |
| `listen/:id` | Listen mode |
| `library` | Saved phrases |
| `practice` | Practice hub |
| `speedrun` | Speed Run game |
| `tonegym` | Tone Gym |
| `tonegym-results` | Tone Gym results |
| `ai` | AI Conversation |
| `ai-scenario` | AI Scenario Picker |
| `introduce-yourself` | Introduce Yourself form |
| `profile` | Profile & Settings |
| `settings` | Settings |
| `stats` | Progress / Stats |
| `paywall` | Upgrade to Pro |
| `checkout-success` | Post-payment confirmation |
| `login` | Sign in |
| `register` | Create account |
| `forgot-password` | Reset password |
| `privacy` | Privacy Policy |
| `terms` | Terms of Service |
| `about`, `faq`, `support`, `contact` | Support pages |

---

## Brand System

### Colors

The palette is called "Sage & Vermilion." Warm off-whites for surfaces, deep vermilion as the single action color, warm greys for text.

**Surfaces (light, warm paper tones)**
| Token | Hex | Use |
|---|---|---|
| `--bg-0` | `#F4F1EC` | Page background (warm cream) |
| `--bg-1` | `#FAFAF7` | Card / elevated surface (near-white) |
| `--bg-2` | `#EDE7DF` | Secondary surface (warm grey) |
| `--bg-3` | `#E4DDD5` | Borders, dividers, progress tracks |

**Text**
| Token | Hex | Use |
|---|---|---|
| `--fg-0` | `#1A1A1A` | Primary text, headlines |
| `--fg-1` | `#3D3D3D` | Secondary text |
| `--fg-2` | `#6B6B6B` | Muted / supporting text, eyebrow labels |
| `--fg-3` | `#ABABAB` | Disabled / placeholder |

**Accent — Vermilion**
| Token | Hex | Use |
|---|---|---|
| `--accent` | `#C8392B` | Primary CTA, active states, scores, streak pill, progress fills |
| `--accent-dark` | `#F2DDD9` | Blush tint for soft backgrounds, paywall cards |
| `--accent-glow` | `rgba(200,57,43,0.20)` | Glow / shadow effects |
| `--accent-muted` | `rgba(200,57,43,0.08)` | Very subtle tint backgrounds |

**Secondary**
| Token | Hex | Use |
|---|---|---|
| `--secondary` | `#8A7B6E` | T3 callout left border, scrollbar thumb |
| `--streak` | `#D97B20` | Streak orange for "Learning" state badges |
| `--gold` | `#C9A24A` | Decorative gold (cinematic photos only) |

**Cinematic (photos & hero overlays only — never used for UI)**
- `--ink: #16242A` (deep blue-black)
- `--oxblood: #3D1417` (deep red-brown)
- `--amber: #A8642A`

**Semantic aliases**
- Success / mastered = `--accent` (#C8392B)
- Error = `#B03020`
- Warning = `#C87C20`
- Score: Excellent (80+) = accent, Good (60+) = secondary, Fair (40+) = `#C87C20`, Poor = `#B03020`

---

### Typography

Four font families used systematically:

| Token | Family | Use |
|---|---|---|
| `--font-ui` (`--sans`) | Inter, system-ui | Body text, labels, buttons, UI chrome |
| `--font-serif` | Source Serif 4, Georgia | Headlines, greeting titles, editorial section labels, hero titles, score numbers |
| `--font-mono` | JetBrains Mono | Eyebrow labels, metadata, stats, location tags, pill text — all uppercase with tight letter-spacing |
| `--font-cjk` | Noto Serif HK, Songti SC | Chinese characters displayed in lesson content |

**Type scale**
| Token | Size | px equiv |
|---|---|---|
| `--font-size-xs` | 0.625rem | ~11px |
| `--font-size-sm` | 0.75rem | ~13px |
| `--font-size-base` | 0.875rem | ~15px |
| `--font-size-md` | 1rem | ~17.6px |
| `--font-size-lg` | 1.125rem | ~20px |
| `--font-size-xl` | 1.375rem | ~24px |
| `--font-size-2xl` | 1.5rem | ~26px |
| `--font-size-3xl` | 2rem | ~35px |

*Note: base HTML font-size is 110%, so all rem values compound. 1rem ≈ 17.6px.*

**Line heights:** tight (1.15) for headlines, normal (1.5) for body, relaxed (1.7) for prose.

**Letter spacing:** tight (-0.4px) for display/serif headings, wide (1.2px) for mono eyebrows.

---

### Spacing & Layout

**Spacing scale**
| Token | Value |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-base` | 16px |
| `--space-lg` | 20px |
| `--space-xl` | 24px |
| `--space-2xl` | 32px |
| `--space-3xl` | 40px |

**Content padding:** 16px (`--content-padding`)
**Standard screen padding:** 20px left/right on most screens

**Border radii**
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Small chips |
| `--radius-md` | 12px | Cards, modals |
| `--radius-lg` | 16px | Larger cards |
| `--radius-xl` | 24px | Large panels |
| `--radius-pill` | 999px | Pill buttons, badges |
| `--radius-circle` | 50% | Avatars |

**Note on sharp corners:** Many core UI elements use **0 border-radius** — the editorial design deliberately uses sharp rectangular cards, hero images, and continue-section boxes. This is intentional (newspaper / print aesthetic).

**Layout dimensions**
- App max-width: 428px (mobile-first; sidebar layout kicks in at 900px)
- TopBar height: 64px
- BottomTabBar height: 68px
- Scrollbar: 4px wide, secondary color thumb

**Shadows (warm, not cold)**
- Card: `0 1px 4px rgba(0,0,0,0.07)`
- Raised: `0 4px 16px rgba(0,0,0,0.08)`
- Accent: `0 4px 14px rgba(200,57,43,0.25)`

---

### Animation

**Transitions**
- Fast: 150ms ease
- Normal: 250ms ease
- Slow: 400ms ease

**Global animations (defined in global.css)**

| Name | Effect | Use |
|---|---|---|
| `slideIn` | `translateX(20px) → 0` + opacity | Page entry animation |
| `scorePop` | scale 0 → 1.2 → 1 | Score number reveal |
| `toastIn` / `toastOut` | translateY(20px) + opacity | Toast notifications |
| `savePop` | scale 1 → 1.3 → 1 | Save action confirmation |
| `recordPulse` | opacity 1 → 0.3 | Recording state indicator |
| `slideUp` / `slideDown` | translateY(100%) | Now Playing player |
| `loadingBar` | translateX infinite | Indeterminate loading indicator |
| `spin` | rotate 360° | Spinner |

**Token-specific animations (Branding.tokens.css)**

| Name | Effect | Use |
|---|---|---|
| `logo-heartbeat` | double-pulse scale 1 → 1.16 → 1 → 1.09 → 1 | The 影 logo dot (1.5s, infinite) |
| `fall` | translateY + rotate, opacity 0→1→0 | Confetti pieces |
| `pulse` | scale + box-shadow expand | Recording/active states |
| `scorepop` | scale 0.4 → 1.2 → 1 | Score badge pop-in |
| `sageflash` | background flash (sage green) | Correct answer flash |
| `celebPop` | scale 0.7 → 1 + opacity | Modal/celebration pop-in |

**Reduced motion:** All animations are disabled when `prefers-reduced-motion: reduce` is set.

---

### Key UI Patterns

#### Editorial section bars
Used on Home screen to divide content sections. Sharp horizontal rule (6px solid `--fg-0`) above, with an italic serif counter number in vermilion and a mono uppercase label. Optionally a "See all →" link in accent color on the right.

#### Eyebrow labels (`.eyebrow`)
Small mono uppercase text, 11px, letter-spacing 0.18em, in vermilion, preceded by a small 5px circular dot in vermilion. Used as section labels above headlines. Variant `.eyebrow-bone` renders the dot and text in off-white (for use on dark backgrounds). Variant `.eyebrow-center` centers the content.

#### Eyebrow mono (`.eyebrow-mono`)
Similar but without the dot. 10px mono, 0.2em letter-spacing, uppercase, `--fg-0`.

#### Callout tiers (`.t1` through `.t4`)
Four levels of card/panel emphasis:
- `.t1`: `--bg-1` background, thin `--bg-3` border, 28px/32px padding
- `.t2`: `--bg-2` background, thin `--bg-3` border
- `.t3`: `--bg-1` background, thin border + 4px `--secondary` left accent border
- `.t4`: `--accent` (vermilion) background, all text forced to `--bg-0` (cream)

#### Phrase row hierarchy
The canonical way to display a phrase with all layers:
- `.phrase-jy` — Jyutping romanization: Inter SemiBold 18px
- `.phrase-hk` — Chinese characters: Noto Serif HK 14px, muted
- `.phrase-en` — English translation: Inter 13px

#### Buttons
| Class | Appearance |
|---|---|
| `.btn-primary` / `.btn-vermilion` | Vermilion fill, cream text, 13–15px Inter Medium, pill or square |
| `.btn-secondary` / `.btn-ghost` | Transparent fill, `--fg-0` border + text |
| `.btn-inverse` | Cream fill, vermilion text |
| `.text-link` | No background, vermilion text, 13px |

Most interactive buttons use `--radius-pill` (999px). Sharp-corner buttons are used when adjacent to sharp-corner cards (maintaining the editorial grid feel).

#### Pills
- `.pill-blush`: light vermilion background (`--accent-dark`), vermilion text
- `.pill-cream`: `--bg-2` background, `--fg-1` text

#### Cinematic photo style
Hero images and scene covers use a layered treatment:
1. Image or cinematic gradient background
2. SVG noise grain overlay (0.22 opacity, overlay blend mode)
3. Radial vignette
4. Linear dark gradient (top → bottom)
5. Content sits in z-index 3 on top

Named photo gradients (harbour, market, neon, tram, etc.) approximate specific HK locations.

#### Sticky/scroll-aware headers
SceneDetailScreen uses IntersectionObserver on the hero image to fade in a sticky header when the hero scrolls out of view.

#### Toast notifications
Slide up from bottom, auto-dismiss. Two semantic variants: success and error.

#### Bottom Sheet
Slides up from the bottom as a modal panel. Used for pickers (speed, reminder time) and inline editing. Can include a confirm button.

#### ConfirmModal
Centered modal with blurred backdrop. Used for destructive confirmations (sign out, delete account). Supports `destructive` prop for red CTA button.

---

## Screens

---

### Home (Today)

- **Route:** `home`
- **Purpose:** The main daily dashboard — shows what to practice today, recent scenes, curated playlists, in-progress scenes, and shortcut practice modes
- **Layout:** Full-screen scrollable, `--bg-0` background
- **Key sections:**

**Greeting header**
Spans full width, 20px padding. Left: mono eyebrow showing day + month ("Monday · May"). Below it: a large serif greeting headline ("Good morning, *Faith*") with the name in italic. Right: streak pill — vermilion rounded pill with white flame emoji and mono streak count.

**Streak-at-risk banner** (conditional — appears after 6pm if streak not yet done today)
Full-width vermilion banner. Flame emoji, text "Your N-day streak is at risk" + "3 phrases = streak saved", and a "Save it →" pill button.

**Section 01 — Today's scene (hero)**
Editorial section bar with thick rule. Below it: a full-bleed cinematic card (`min-height: 260px`) with the scene image or cinematic gradient. Layers: grain, vignette, dark gradient. Top-left: "HONG KONG · TODAY" location tag (mono, blurred backdrop). Bottom: category eyebrow + scene title in white serif + pills showing phrase count, duration, and review count.

Below the hero image: a sharp-edged "continue" button row with "START SESSION" or "REVIEW DUE" label and serif scene title. Acts as the primary CTA.

**Quick 3 pill** (conditional — shown if due phrases exist)
Small ghost pill right-aligned: "Short on time? Do 3 phrases →". Starts a 3-phrase micro-session from due items.

**Personal scene card**
If the user has built their personal intro scene: a bordered card with eyebrow "👋 INTRODUCE YOURSELF", their name + phrase count meta, and a vermilion "Shadow →" pill. If not yet built: a dashed-border empty state card prompting "Introduce yourself in Cantonese" with a setup CTA.

**Section 02 — Jump back in**
Horizontal scroll row of small square chips (80px) for recently visited scenes. Each chip has a scene thumbnail or emoji + 2-line title. Tap goes to SceneDetailScreen.

**Section 03 — Made for you**
Horizontal scroll of 4 curated playlist cards (160×108px cover image + serif title overlaid + description below). Playlists: Landing in HK, Foodie circuit, Weekend out, Tone workout.

**Section 04 — Keep going** (conditional — only in-progress scenes)
Horizontal scroll of smaller scene cards (140×88px) with a 2px vermilion progress bar beneath and percentage in mono.

**Section 05 — Practice modes**
List of 3 rows: Tone Gym, Free Chat, Speed Run. Each row has a colored icon square (rounded corners), a title + one-line description, and a chevron.

- **UI elements:** Streak pill, streak risk banner, cinematic hero card, continue CTA bar, quick-3 pill, personal scene card, jump-back scroll chips, playlist scroll cards, keep-going progress cards, practice mode list rows
- **User actions:** Start or continue today's session, do a quick 3-phrase review, start any shortcut practice mode, jump to a recent scene, launch a playlist, navigate to the scenes browser

**Streak milestone modal** (overlay — shown at milestone numbers: 7, 14, 30, 60, 100 days)
Full-screen blurred overlay. White bordered card with a 6px top rule. Flame emoji, huge serif number in vermilion, title (e.g. "On fire!"), italic sub, "Keep going →" vermilion button.

---

### Scenes (Browse)

- **Route:** `scenes`
- **Purpose:** Browse and discover all available scene content
- **Layout:** Full-screen scrollable
- **Key sections:**

**Header**
Large serif heading "Browse scenes" + "香港 Cantonese" subtitle.

**Search bar**
Full-width input with search icon. Shows a clear (×) button when text is entered. Debounced search filters scenes by title, description, or category.

**Category chips**
Horizontal scroll of filter chips: All, 🍜 Food, 🚇 Transport, 👋 Social, 🏥 Services, 🎆 Festivals. Active chip has vermilion background.

**Featured mosaic** (seasonal, hidden when searching/filtering)
Full-width tall card (background image or scene tint). Overlaid: "FEATURED SCENE" eyebrow, scene title, phrase count + minutes. Taps to SceneDetailScreen.

**All scenes grid**
2-column grid of scene tiles. Each tile: scene cover image (or emoji on colored background) + gradient overlay + scene title + phrase count/duration + 2px progress bar. Loading state shows skeleton tiles.

- **UI elements:** Search input, category chip bar, featured card, 2-column scene grid, skeleton loaders
- **User actions:** Search scenes, filter by category, tap featured, tap any scene tile to open detail

---

### Scene Detail

- **Route:** `scene/:id`
- **Purpose:** Full preview of a scene — conversation script, cultural context, mastery progress — before starting practice
- **Layout:** Full-screen scrollable with sticky header and sticky bottom CTA bar

**Sticky header** (fades in on scroll, initially hidden)
Back pill button, scene title, more (⋯) button.

**Hero image**
Full-width tall image with tint gradient overlay + dark bottom gradient. Back arrow + category eyebrow ("FOOD SCENE") + serif scene title + "N phrases · N min" meta.

**Cultural note** (if available)
Editorial divider "—— CULTURAL NOTE ——". Below: card with "DID YOU KNOW?" eyebrow in mono and cultural context text in serif.

**Controls row**
Left cluster: heart toggle (save scene), + button (save all phrases to library), ⋯ more menu (listen mode, share). Right: large circular play button.

**Mastery progress** (if user has practiced)
Thin 2px progress bar (grey → vermilion gradient) + "N% mastered" label.

**Conversation thread**
Message-bubble layout. NPC lines appear left with avatar (small circular photo or initial). User ("you") lines appear right with the user's photo/initial. Each line shows: Jyutping romanization, Chinese characters, English translation, and a heart toggle to save to library. Speaker avatars only show on the first line from each speaker.

**Sticky bottom CTA bar**
Two buttons side by side: "🔊 Listen" (secondary/ghost) and "▶ Shadow this" (primary vermilion).

- **UI elements:** Sticky scroll-aware header, cinematic hero, cultural note card, controls row, mastery bar, chat bubble conversation thread, sticky CTA bar
- **User actions:** Save scene, save all phrases, save individual phrases, play listen mode, start shadowing, go back

---

### Shadow Session

- **Route:** `shadow/:id`
- **Purpose:** The core immersive practice screen — listen to a phrase, repeat it, get pronunciation scored
- **Layout:** Full-screen immersive, hides all navigation chrome
- **Background:** Dark (`--ink` family) — the only screen with a dark background

**Top bar**
× close button left, "SHADOW · [Scene Title]" in mono center, "N / N" line counter right.

**Vermilion progress bar**
2px bar spanning full width below top bar. Fills left to right as phrases are completed.

**Focus area (center)**
The dominant section. Shows:
- "line NN" in small mono above
- Jyutping romanization (large, can be toggled off)
- Chinese characters in large CJK font (first character gets accent color)
- English translation in quotes (can be toggled off)
- Three-bar audio icon button (tap to replay the phrase audio)

**Score reveal** (after recording)
Scoring state: "Scoring…" text. Scored state: large score number in color-coded vermilion/gold/orange/red depending on score. Below the score: a tone contour visualization (ToneTrack) comparing expected vs. actual pitch curves.

**Score celebration overlay** (score ≥ 90)
Full-screen overlay with celebration animation, showing score and phrase, "Keep going →" and "Retry" buttons.

**Bottom controls**

*Eye toggles row:* Two small toggle buttons for JYUTPING and ENGLISH visibility.

*Transport row:* Three controls in a row:
1. Skip-back arrow (disabled on first phrase)
2. Large central MIC button (fills red when recording, shows spinner when scoring)
3. Skip-forward arrow (or finish icon on last phrase)

There are also save and navigate next affordances near the score area.

**NPC context** (adjacent to the current "you" line)
If a prompt line precedes the user line in the full dialogue, it is played first in the audio queue to give conversational context.

- **UI elements:** Mono top bar, progress bar, Jyutping text, CJK characters, English text, audio replay button, score number, ToneTrack visualization, eye toggles, mic button, skip buttons
- **User actions:** Listen to phrase, replay audio, toggle romanization on/off, toggle English on/off, record pronunciation, view score feedback, navigate previous/next phrase, save phrase to library, finish session

---

### Session Summary (Session End)

- **Route:** `session-end`
- **Purpose:** Post-session debrief — score, breakdown, streak update, phrase list review
- **Layout:** Full-screen scrollable, dark background (`--ink` green-toned dark)

**Score hero**
"Session complete" label (mono). Huge serif score number (e.g. "84") with "%" suffix. If personal best: "↑ Personal best — up from N%" line.

**Breakdown section**
Editorial "—— THE BREAKDOWN ——" header. Three labeled horizontal bars: PRONUNCIATION / TONE / SPEED, each with percentage and a filling vermilion bar.

**Streak update** (if streak > 0)
Flame icon + "Streak: N days +1 today" text.

**Keeper phrase**
Highlighted box showing the best-scored phrase from the session. "YOUR LINE TODAY" mono label, Jyutping romanization large, English translation, score number in color.

**Phrase list**
Divider, "PHRASES PRACTICED" section label, list of all phrases with a color-coded dot, romanization, and score. ★ for perfect scores.

**Lived-it prompt** (one-time per scene)
"Did you actually use this in a real HK conversation?" with "Not yet" and "📍 I did it!" buttons. If confirmed: "Marked. That's the real thing."

**Action buttons**
Primary: "Next scene →" / Secondary: "Practise again"

- **UI elements:** Large score hero, breakdown bars, streak row, keeper phrase box, scored phrase list, lived-it prompt, action buttons
- **User actions:** Mark phrase as used in real life, practice again, go home

---

### Library (Saved)

- **Route:** `library`
- **Purpose:** View all saved phrases, organized by scene, plus reference word sets
- **Layout:** Full-screen scrollable

**Header**
Mono eyebrow: "SAVED · N PHRASES · N SCENES". Serif heading "Your *phrasebook*." Editorial divider.

**Reference sets**
"— REFERENCE SETS / TAP TO BROWSE" header. 2-column grid of flat cards: Numbers 1–100, Colours, Drinks & Coffee, Days & Times.

**Scene groups**
One section per scene containing saved phrases. Each section has a clickable header row: scene thumbnail (40×40 image or colored square), scene name, and phrase count. Below, each phrase as a row showing romanization, Chinese, English, and a "✓ MASTERED" pill if applicable. Phrase rows have play and bookmark icon buttons.

Empty state: "Your library is empty." with a "Browse scenes" button.

- **UI elements:** Reference set cards, scene group headers with thumbnails, phrase rows with text layers and action icons, mastered pill, empty state
- **User actions:** Navigate to reference set, navigate to scene, play phrase audio, go to phrase detail, mark phrase (via bookmark)

---

### Profile

- **Route:** `profile`
- **Purpose:** Personal stats, settings, and account management — the combined profile + settings screen
- **Layout:** Full-screen scrollable

**Hero section**
Circular avatar (photo or initial in colored circle). Name with "Edit →" inline link. Meta: "N months studying Cantonese". Vermilion streak pill "🔥 N day streak".

**Stats grid**
3-column grid of stat cards: Phrases (learned), Minutes (shadowed), Tones (accuracy %). Each card shows a large serif number, a category label in mono, and a descriptor label.

**90-day heatmap**
"LAST 90 DAYS" mono label. A 90-cell grid of small squares (≈7px) with 5 intensity levels (0 = empty/faint, 4 = full vermilion). Hover shows date + minutes.

**Grouped settings sections** (each with a mono section label + card):

- LEARNING: Language toggle pills (Cantonese / Mandarin), daily goal pills (5/10/15/20/30 min)
- DISPLAY: Three toggle rows (Show characters, Show English translation, Auto-advance cards), plus a 3-option theme segmented control (Auto / Light / Dark)
- SETTINGS: Row links to Default speed picker, Daily reminder picker, Offline downloads
- APP: Row links to FAQ, Help & Support, Send feedback
- Danger zone: Sign out button, Delete account button, Download my data button

**Version label:** "ShadowSpeak vN.N.N" at the bottom.

**Modals/sheets triggered from this screen:**
- BottomSheet: Edit name (text input + Save)
- BottomSheet: Default speed picker (Slower / Natural radio)
- BottomSheet: Reminder time (time input + Save)
- DownloadAllModal: Offline audio download
- ConfirmModal: Sign out confirmation
- ConfirmModal: Delete account (two-step: warning then final confirmation)

- **UI elements:** Avatar, stats grid, heatmap, language pills, goal pills, toggle rows, theme segmented control, settings row links, danger zone buttons
- **User actions:** Edit name, switch language, change daily goal, toggle display preferences, change theme, set playback speed, set reminder, download offline audio, sign out, delete account, export data

---

### Settings

- **Route:** `settings`
- **Purpose:** Standalone settings screen (subset of Profile, accessible from the app's navigation)
- **Layout:** Full-screen scrollable with back arrow header

Organized into labeled sections:

1. **Language** — Cantonese / Mandarin pill toggle
2. **Profile** — Name text input
3. **Daily Goal** — 5 / 10 / 15 / 20 / 30 min pill options
4. **Display** — Toggle rows: Show characters, Show English, Auto-advance
5. **Playback** — Default speed row (opens bottom sheet), Daily reminder time row (opens bottom sheet)
6. **Notifications** — Push reminders on/off button + test notification link + status text
7. **Offline** — "Download all audio" button (opens DownloadAllModal)
8. **Account** — Name + email display rows, "View full profile" link, Sign out, Delete account, Download my data
9. **App** — About, FAQ, Help & Support, Contact links + version number

- **UI elements:** Back button header, section labels, pill toggles, toggle switches, row links, primary and ghost buttons
- **User actions:** Same as Profile settings sections

---

### Stats (Progress)

- **Route:** `stats`
- **Purpose:** Motivational progress dashboard with streak, weekly view, lifetime stats, XP level, and achievements
- **Layout:** Full-screen scrollable with back arrow header

**Streak hero**
Left: SVG flame icon + large streak number + "day streak" label. Right: motivational headline and sub-text (copy changes based on streak length). Best streak shown if higher than current.

**Today + This week row**
Side-by-side cards:
- Today: SVG ring chart (circular progress), phrase count vs daily goal, time practiced. "Goal met!" on completion.
- This week: 7-day dot grid (M-S). Active days show a checkmark, today highlighted, count shown as "N/7".

**Lifetime stats grid**
4-column grid: Sessions, Phrases saved, Mastered (in accent color), Time practiced.

**Level card**
Level badge (number) + level title and description + XP chip. If not at max level: XP progress bar + "Level N: Title — N XP away". Below: XP earning rules ("+10 completing a session", "+5 per phrase", "+2 per phrase mastered").

**Achievements section**
"N/N earned" count. Earned achievements in a grid of cards (emoji, label, description). Upcoming achievements as a list with progress bars and how-to tips. "See N more to unlock" expand toggle.

- **UI elements:** Streak hero, ring chart, 7-day dot row, stats grid, level card with XP bar, achievement grid, achievement list with progress bars
- **User actions:** View stats, expand achievement list

---

### Shadow Session — Listen Mode

- **Route:** `listen/:id`
- **Purpose:** Passive listening — hear the full scene dialogue without recording, used for immersion or pre-session familiarization
- **Layout:** Full-screen immersive (chrome hidden), dark background

Plays through all lines in the scene sequentially with playback controls. Shows current line text (Jyutping, CJK, English).

---

### AI Conversation

- **Route:** `ai`
- **Purpose:** Free conversation practice with an AI Cantonese tutor (Pro feature)
- **Layout:** Full-screen immersive (chrome hidden)

**Gate state (free users)**
Back button header. Lock icon, "Unlock AI Conversation" heading, subtitle, "Upgrade to Pro" vermilion button, "Maybe later" ghost button.

**Scenario select phase**
Grid of scenario cards with cinematic background images (Unsplash photos with gradient fallback). Each card: scenario title + description. User picks a scenario to start the conversation.

**Chat phase**
Scrollable message thread. AI messages appear as bubbles with Chinese text, Jyutping, and English. Each message has a save-to-library button. User messages appear on the right. "Thinking…" indicator when AI is processing.

**Input bar** (bottom)
Voice/text mode toggle. In voice mode: large central record button. In text mode: text input + send button. "End chat" button when in conversation.

**Review phase**
After ending the chat, shows a summary of the conversation with options to review phrases.

- **UI elements:** Scenario grid, chat bubbles, AI thinking indicator, record button, text input, save-to-library per message, end chat button
- **User actions:** Select scenario, record voice input, type text input, save AI phrases to library, end conversation

---

### Speed Run

- **Route:** `speedrun`
- **Purpose:** Rapid flashcard recall game — 10 rounds, 5 seconds per card, multiple choice
- **Layout:** Full-screen immersive (chrome hidden), dark background

**Loading/empty state:** Requires ≥4 saved library phrases to play.

**Game phases:**

*Intro:* App name, instructions, personal best shown.

*Playing:* Round counter (1/10), 5-second countdown timer (large number, fills/drains). Current phrase displayed in Chinese characters. Four multiple-choice buttons showing English translations.

*Feedback:* Correct/incorrect indicator, correct answer revealed, auto-advance after a moment.

*Done:* Score summary (N/10 correct), personal best update notification, action buttons.

- **UI elements:** Round counter, countdown timer, CJK phrase display, 4-option choice buttons, score, personal best
- **User actions:** Choose answer, view results

---

### Tone Gym

- **Route:** `tonegym`
- **Purpose:** Ear training — learn to distinguish Cantonese tone pairs by listening to near-identical syllables
- **Layout:** Full-screen immersive (chrome hidden), dark background

**Phases:**

*Intro:* Title + description, "Start" button.

*Learn:* Shows a tone pair (e.g. 媽 maa1 "mother" vs. 麻 maa4 "sesame"). Listen buttons for each. "Got it →" advance.

*Listen:* Audio plays one of the pair's tones. User must choose which one they heard.

*Feedback:* Correct (sage green flash) or incorrect (red). Shows the full pair with meanings.

*Results:* After 10 rounds, shows score and hands off to ToneGymResults screen.

- **UI elements:** Tone pair character display, Jyutping + meaning labels, listen buttons, choice buttons, feedback flash
- **User actions:** Listen to tones, choose which tone was played, advance through rounds

---

### Tone Gym Results

- **Route:** `tonegym-results`
- **Purpose:** Summary of a Tone Gym session with score and missed pairs
- **Layout:** Full-screen scrollable

Shows score, breakdown of which tone pairs were missed, encouragement text, and action buttons (Try again, Go home).

---

### Paywall (Upgrade to Pro)

- **Route:** `paywall`
- **Purpose:** Convert free users to paid subscribers
- **Layout:** Full-screen scrollable, warm cream background (`#F7F4EC`)

**Header**
Italic serif "Premium" eyebrow in vermilion. Large serif heading "Unlock all of *Hong Kong*." Italic subtitle.

**Featured review**
Vermilion card with ★★★★★, a quoted user review, and reviewer name.

**Plan selector**
Vertical list of 4 plan cards (Annual, Monthly, Lifetime, Family). Unselected: white card, grey border. Selected: `#1A2A18` (near-black) background, vermilion border, label and checkmark in vermilion.

Badge labels ("Most popular", "Launch offer") float above the card top-right in a vermilion pill.

Plan cards show: plan name, price + period, sub-label (trial info, billing description).

**Feature list** (expandable)
"What you get" or "See what's included" toggle. List of feature lines with vermilion checkmarks.

**CTA button**
Full-width vermilion button. Label changes per plan (e.g. "Start 7-day free trial").

**Error state**
Inline error text if Stripe checkout fails.

**Free continue link**
"Continue for free" text link below button.

- **UI elements:** Review card, plan selector cards with badges, feature list, primary CTA button, error state, free-continue link
- **User actions:** Select plan, proceed to Stripe checkout, continue without upgrading

---

### Checkout Success

- **Route:** `checkout-success`
- **Purpose:** Post-payment confirmation screen after returning from Stripe
- **Layout:** Full-screen centered, dark green background (`#1A2A18`)

Large vermilion circle with ✓ checkmark. ShadowSpeak wordmark (white + vermilion). "You're in." heading. Plan label ("Annual Pro is active on your account."). Plan badge in vermilion-tinted card. Checklist of unlocked features (5 items). "Start learning" vermilion CTA button. Fine print about Stripe confirmation email.

- **User actions:** Proceed to home

---

### Onboarding / First Run Flow

- **Route:** `firstrun`
- **Purpose:** New user setup — 6-step modal flow collecting language context and preferences before launching first lesson
- **Layout:** Full-screen immersive (chrome hidden)

**Chrome:** Back arrow, progress dots (6 total — filled / current / empty states), Skip button.

**Step 0 — Welcome**
Full-bleed Hong Kong harbour photo with dark overlay. 影 logo tile (animated heartbeat) + ShadowHK wordmark. "ISSUE 01 · WELCOME" editorial eyebrow. Large serif headline: "Hong Kong speaks *in tones*. Most people never hear them." Body copy about real-conversation approach. "Get started" CTA.

**Step 1 — Level**
"Where are you starting from?" Four selection cards (radio-style): Zero Cantonese / A few basics / Conversational / Returning learner. Each card has a title + sub-description. Active card has vermilion border.

**Step 2 — Reasons**
"What brought you here?" 6-tile emoji grid (up to 3 selectable): Food & dining, Getting around, Making friends, Work in HK, Partner/in-laws, Living here long-term. Active tiles get vermilion border.

**Step 3 — Daily goal**
"How much time per day?" 4 tall chip options with label + duration dots: 2 min Casual, 5 min Regular, 10 min Serious, 15 min Committed.

**Step 4 — Reminder**
"When should we nudge you?" Time picker input, day-of-week chip row (M T W T F S S, toggleable). "Turn on reminders" CTA, "Skip for now" ghost link.

**Step 5 — First scene launch**
Full-bleed scene image (first scene, usually Dim Sum). Dark overlay. "YOUR FIRST SCENE" eyebrow, scene title, phrase count + time estimate. Pulsing "Start shadowing" button. "Browse other scenes" ghost link.

- **UI elements:** Photo hero, logo, progress dots, selection cards, emoji grid, goal chips, time picker, day chips, scene launch card
- **User actions:** Select level, pick reasons, set goal, set reminder, launch first lesson or browse scenes

---

### Introduce Yourself Form

- **Route:** `introduce-yourself`
- **Purpose:** Collects personal details to generate a custom Cantonese introduction scene tailored to the user's life
- **Layout:** Full-screen scrollable

Accordion-style form with 5 collapsible sections: About you, Family, Daily life, Personality, Learning. Each section has labeled text inputs. Phrase count indicator updates as fields are filled. An AI generation call builds a custom phrase set.

Existing phrases are shown if the user has already built their scene.

- **UI elements:** Accordion sections, labeled text inputs, phrase count, generate button, existing phrase list
- **User actions:** Fill in personal details, generate custom scene, view existing scene phrases

---

### Login

- **Route:** `login`
- **Purpose:** Authenticate an existing user
- **Layout:** Full-screen, dark photo background (Hong Kong street photo from Unsplash)

Layered: ambient photo + dark gradient overlay + content on top.

**Brand block:** 影 tile (animated logo-heartbeat) + "ShadowHK" wordmark.

**Title block:** "Welcome back" mono eyebrow. Serif headline "Welcome back to *Hong Kong*."

**Form:** Email input + Password input (with show/hide eye toggle button). "Forgot?" link right-aligned. Error message with "!" dot when validation fails. Form shakes on failed submission.

**Primary button:** "Sign in" — full width vermilion.

**Divider:** "or continue with" text divider.

**Social buttons:** Apple + Google side by side.

**Footer:** "New here? Create an account" link.

- **UI elements:** Ambient photo, brand tile, form fields with eye toggle, error state, primary button, social buttons, footer link
- **User actions:** Sign in with email/password, sign in with Apple, sign in with Google, go to Register, reset password

---

### Register

- **Route:** `register`
- **Purpose:** Create a new account
- **Layout:** Full-screen, dark photo background (different HK photo)

Same layered photo treatment as Login.

**Back button** in top-left.

**Title block:** "Create account" eyebrow. "Begin your *journey*." headline. Italic subtitle: "Three minutes a day. Twelve weeks until you bargain at the wet market."

**Form:**
- Name input ("What should we call you?")
- Email input
- Password input (show/hide toggle) — includes real-time password strength indicator: 4 pip dots that fill as criteria are met (8+ chars, includes number, 12+ chars, special char). Two rule chips below showing ✓/empty: "8+ characters" and "A number".
- Terms checkbox (custom pill toggle): "I agree to the Terms and Privacy Policy."

Error message when validation fails.

**Primary button:** "Create account" — disabled until all required fields valid.

**Footer:** "Already have one? Sign in" link.

- **UI elements:** Back button, form with name/email/password, strength pips, rule chips, custom checkbox, error state, primary button
- **User actions:** Create account, go back to Login

---

### Forgot Password

- **Route:** `forgot-password`
- **Purpose:** Request a password reset link
- **Layout:** Full-screen, light cream background

**Top bar:** Back arrow left, "Reset password" title center.

**State 1 — Input:**
Circular illustration icon (↺). Serif heading "We'll send a magic link." Body: instruction text. Email input + error. "Send reset link" primary button. "Back to sign in" link.

**State 2 — Sent:**
Green circle ✓. "Check your email" heading. Confirmation with email address shown in bold. "Didn't get it? Resend in Ns" button (disabled during 30-second countdown). "Use a different email" link. "Back to sign in" link.

- **UI elements:** Back button, illustration circle, email input, primary button, confirmation state, resend timer, links
- **User actions:** Submit email, resend reset link, return to sign in

---

### Legal Pages

- **Routes:** `privacy`, `terms`
- **Purpose:** Privacy Policy and Terms of Service
- **Layout:** Full-screen scrollable, light background

Back arrow, serif heading, "Last updated" date, editorial divider. Content in section headings + body paragraphs + lists. Footer with contact email.

---

### About / FAQ / Support / Contact

- **Routes:** `about`, `faq`, `support`, `contact`
- **Purpose:** Help and information pages
- **Layout:** Full-screen scrollable, similar to Legal pages

Simple editorial layout with back navigation, heading, sections of content, and action links (email, external links).

---

## Shared Components

### TopBar
64px fixed header. Left: "ShadowHK" text wordmark. Right: profile avatar icon button (if authenticated) or "Sign in" text button. Present on all non-immersive screens on mobile. Hidden on desktop (Sidebar takes over).

### BottomTabBar
68px fixed bottom navigation bar. 4 tabs: Today (house icon), Browse (search/circle icon), Saved (heart icon — filled when active), You (person icon). Active tab: icon fills + label gets accent color. Library tab shows a badge with due-phrase count when there are items to review and the tab is not active.

### Sidebar
Left navigation rail on desktop (≥900px). ShadowHK wordmark at top (clickable, goes home). Same 4 nav items as BottomTabBar (icon + label). If not authenticated: "Sign in" button at the very bottom.

### BottomSheet
Slides up from screen bottom over a semi-transparent overlay. Has a title, close button, optional confirm button with label. Used for: speed picker, reminder time picker, name editor.

### ConfirmModal
Centered modal with blurred backdrop. Title, body copy, cancel + confirm buttons. Supports `destructive` prop (confirm button becomes red-tinted). Used for: sign out, delete account warnings.

### Toast
Bottom-anchored notification that slides up and auto-dismisses. Two variants: success (standard) and error (red accent). Used across the app for save confirmations, export completions, error feedback.

### RecordButton
The large central microphone button in Shadow Session. Three states: idle (record), recording (pulsing red), scoring (spinner).

### LoadingSpinner
Small spinning circle used inside buttons and full-screen loading states.

### PhraseRow
Reusable component to display a single phrase in its 3-layer hierarchy (Jyutping / Chinese / English). Used in library lists, scene details, session focus areas. Accepts a heart toggle for save state.

### ToneTrack
Visualization component showing expected vs. actual tone pitch contour lines. Appears in Shadow Session after scoring. Two lines (expected grey, actual vermilion) with syllable labels.

### ScoreCelebration
Full-screen overlay triggered when the user scores 90+ on a phrase. Shows score, phrase, and options to keep going or retry.

### LessonLoader / StreakCelebration / MilestoneCelebration
Overlay components for loading states and celebratory milestones (streak day numbers, XP level-ups).

### DownloadAllModal
Modal for initiating bulk offline audio download. Has progress feedback and a "Download in background" option.

### ErrorBoundary
Wraps the app and catches React errors, showing a fallback UI.

---

*End of ShadowHK Design Reference*
