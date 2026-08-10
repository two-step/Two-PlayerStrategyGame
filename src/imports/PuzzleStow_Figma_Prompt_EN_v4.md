# PuzzleStow (puzzlestow.com) — Full Website Generation Prompt (EN, v4.0)

*Merged from the original design brief and a second draft, corrected against the authoritative rules and figure data (otgruzka_figures.json) and the PairSec/PuzzleStow specifications.*

---

## 0. Context and Goal

Design a complete website for **PuzzleStow** — the digital version of the strategy game "Отгрузка" (Shipload).

The site must be:
- modern, minimalist, geometric, technical
- **no orange in the palette**
- fully autonomous as a standalone product
- integrated with **PairSec** through a single account (Supabase Auth)

Domain: **puzzlestow.com**

The site serves four roles at once: entry point to the game, marketing hub, learning/rules center, and — eventually — the interface for the game's own web client (per the project roadmap, Phase 1 Web MVP).

---

## 1. Product Essence and Positioning

PuzzleStow is a two-player strategy game with perfect information. Its core twist:

**The cargo for your own container is chosen by your opponent, not by you.**

A player receives a piece (one of 27 fixed shapes) and must place it inside a 15×11 container, respecting:
- **support** — no piece may float; it must rest on the base or on already-placed pieces
- **steps** — a passable step height is capped at 3 cells
- **overhang** — a piece cannot hang unsupported past a fair threshold, *except* by a fair-play exception both players explicitly agree to (see Section 12)
- **return path** — after placing a piece, a path back to the exit must remain
- **row closure** — win by closing 5 full rows (horizontal and/or vertical), or by forcing the opponent into a position where they cannot place the required piece without exceeding the container's bounds

The game positions itself as a tool for **intellectual development**, not a casual puzzle. A hard, permanent product decision: **no AI move-advisor exists anywhere in rated play** — not free, not as a premium feature. Qualification and rating must reflect the player's actual thinking, not access to a hint engine. This is a deliberate differentiator, not a missing feature — present it as a value, especially to an audience coming from chess/go who are tired of AI-assisted cheating. See Section 12 for exact scope.

---

## 2. Visual Style — Color Palette (strict)

**Primary**
- Stow Blue — `#1F4F82`
- Lodar Cyan — `#1FA7A3`
- Cargo Graphite — `#1C1F26`

**Secondary**
- Light Deck — `#F5F7FA`
- Steel Grey — `#A3A9B5`
- Green Stow — `#3BB273` (success states, e.g. row closed)
- FairPlay Red — `#D6456F` (fair-play confirmation states, see Section 12)

Rules:
- no orange tones anywhere
- strict geometry, no soft/organic shapes
- container aesthetic: coordinate grid lines, blueprint-style markings
- outline-first figure rendering (not solid blocks) — keeps the visual language distinct from Tetris
- minimalism, restraint — this is a game for people who think, not a casual mobile puzzle
- accent on coordinates A–K / 0–14 as a recurring graphic motif (grid rulers, corner tags)

Do **not** visually clone Tetris — no shared color-per-piece-type convention, no matching block style or font choices that would read as a direct reference.

---

## 3. Typography

- Primary typeface: **Inter**
- Monospace (for coordinates and move notation): **JetBrains Mono**

Hierarchy:
| Level | Size | Weight |
|---|---|---|
| H1 | 40px | Bold |
| H2 | 28px | SemiBold |
| H3 | 22px | SemiBold |
| Body | 16px | Regular |
| Caption | 14px | Regular |
| Mono | 16px | Regular |

Move notation (e.g. `10A12C14`) is part of the brand's visual language — always render it in the monospace face, treated as a recognizable "code" element.

---

## 4. Key Visual Elements (must include)

- 15×11 container grid, entry point at **A0** (Lodar Cyan accent)
- All **27 figures**, outline style, sourced from the single verified data file `otgruzka_figures.json` — do not invent alternate figure files or geometry; this is the one authoritative source
- Step visualization (passable ≤3 cells, blocked >3 cells)
- Overhang / support visualization, including the fair-play exception state
- Return-path visualization
- Row-closure highlight (Green Stow)
- Lodar qualification badges (7 tiers)
- Move notation in monospace
- "Legend of the Lodars" lore as brand narrative (see Section 5, Lore page)

---

## 5. Site Structure (full page set)

### 🟦 Home
- Hero: logo, tagline (see Section 13 for options), buttons **Play** / **Practice** / **Sandbox**, visual of container + figures
- About: what PuzzleStow is, how it differs from Tetris, why the opponent chooses your piece
- Example move: figure → placement → rule check
- Lodar qualifications: 7 levels with badges
- Game modes: Sandbox, Practice (vs AI, unrated — see Section 12), Tournament
- Advantages: strategic depth, fair rules, unique figures
- Bridge to PairSec: short block — "From the game to real jobs." The in-game "loader/grузчик" persona ties directly to the "Грузанём!" service on PairSec; game qualification converts into performer status there. CTA: "What is PairSec" → pairsec.com
- Footer: links, rules, contact, language switcher (RU/EN)

### 🟩 Play (rated)
- 15×11 container
- Figure panel
- Move history
- Rule-violation highlighting — **must reflect server-confirmed state only** (fetched from the backend); no client-side authoritative rules engine, per the project's server-authoritative design principle
- Closed-row highlighting
- Timer, move status
- Move notation display (monospace)
- Fair-play overhang exception: when triggered, show an explicit **bilateral confirmation modal** — both players must actively approve before the exception is applied; never silent or one-sided

### 🟧 Sandbox (unrated, free placement)
- Free figure placement for learning
- Toggleable rule highlights: steps, overhang, support, return path
- Clearly labeled as **not affecting rating** — distinct visual treatment from the Play page so it's unambiguous this isn't a rated match

### 🟪 Figures catalog
- Grid of all 27 figures
- On click: 4 orientations (0°/90°/180°/270°), reference dots, bounding box, figure number

### 🟫 Rules
Full explanation with examples:
- support, steps, overhang (incl. fair-play exception), return path, row closure, general fair play

### 🟨 Profile
- Qualification, stats, match history, badges

### 🟥 Leagues
- Community-created leagues (yard/district/city/country/global scope)
- Any player at MidLod or above may create a league and invite members
- Promotion path to a broader-scope parent league based on qualification + local rating
- CTA: "Create your league"

### 🟥 Tournaments
- Schedule, leaderboard, tournament rules
- (Separate from Leagues — scheduled events vs. ongoing community groups)

### ⬜ Judge & Consultant
- Short section: paid roles for ProfiLod+ players — judging disputed matches, consulting on rules/tactics outside of play
- CTA linking out to PairSec, where these are booked as services
- Secondary priority — do not feature on the first screen

### 🟫 Print & Play
- PDF download: rules, all 27 figures, container template
- 3-step instructions: draw two containers → mark coordinates → keep the figure table on hand
- Tagline: "All you need is a sheet of grid paper and a pen."

### 🟦 Lore — "Legend of the Lodars"
- Visually distinct from the rest of the site (separate background/texture — reads as "an ancient source," not app UI)
- Teaser (2–3 sentences) + "Read the full legend" expansion/link
- Reserve a dedicated block for a **Belarusian-language prologue text** — this is intentional: it functions both as atmospheric framing and as an implicit filter/signal for early community and team recruitment. Keep it visually separated from the main RU/EN content, with its own toggle/footnote rather than blending it into the bilingual switcher.

### Community
- YouTube channel embed, Telegram channel link
- Horizontal carousel for short-form "best moves" clips

### FAQ
- Rules in a minute, playing without an app, what a "request" and "qualification" are, why there's no AI hint, how to join a league

---

## 6. UI Components

- Buttons: primary, secondary, outline
- Figure card (collapsed / expanded with 4 orientations)
- Move card
- Qualification badges (7 tiers, compact/full variants)
- Container grid component with cell states: empty / filled / notation dot / dead void (marked with ×)
- Modals — including the mandatory bilateral fair-play confirmation modal
- Tooltips
- Toasts (success / error)
- Move-notation tag (monospace)

---

## 7. Copy / Content to Generate

- Taglines (see Section 13)
- Descriptions for each page
- Instructions and tooltips
- Error and success messages
- Full "Legend of the Lodars" lore text
- 4-step onboarding tutorial

Tone: intelligent, calm, honest, strategic. Never casual-gamer or hype-driven marketing voice.

---

## 8. Mobile Version

- Container grid centers on screen
- Figures scroll horizontally
- Larger touch targets for buttons
- Condensed text throughout
- Mobile-first priority: the primary game channel is the Telegram WebView, so mobile is not an afterthought — design mobile layouts for Home, Play, Sandbox, and Figures catalog first.

---

## 9. Animations

- Figure appearance
- Error highlight
- Row closure
- Screen transitions
- Smooth figure movement on placement

---

## 10. Frontend Structure Reference (for dev handoff)

Target implementation stack: **Next.js 14 (App Router) + TailwindCSS**. Provide, as reference for handoff (not required to be pixel-exact code):
- HTML structure outline
- CSS structure including design tokens (colors, type scale, spacing)
- JS/UI logic structure notes
- Tailwind token mapping
- Component structure for: container, figures, rule-highlight overlays

---

## 11. Figma File Structure

Organize the Figma file into these pages:
- **Foundations** — color tokens, type scale, spacing, grid
- **Components** — all reusable UI components from Section 6
- **Figures** — the full 27-figure library with orientation variants
- **Screens** — all pages from Section 5, desktop + mobile frames
- **Documentation** — usage notes, do/don't examples, handoff notes

---

## 12. Hard Constraints — Do Not Include / Do Not Violate

- **No AI move-advisor or hint UI anywhere in rated play.** "Practice" and "Sandbox" modes may offer an AI opponent for **unrated** training/sparring only — this must be visually and functionally distinct from the "Play" (rated) experience at all times, never blurred into it.
- **No client-side authoritative rule validation.** Any error/violation highlighting shown to the user must reflect state confirmed by the server, not a locally re-implemented rules engine — this preserves the game's server-authoritative, anti-cheat integrity for qualification and rating.
- **No visual cloning of Tetris** — palette, block rendering style, and fonts must stay clearly distinct.
- **No "stakes / wagering" features** (money or shop-order stakes tied to matches) in this build — this is a documented long-term, low-priority idea pending legal review; do not surface it in the MVP site.
- **Use only `otgruzka_figures.json`** as the source of figure geometry. Do not reference or invent any other figures data file.
- **Fair-play overhang exception requires explicit bilateral confirmation** — both players must actively approve via the modal in Section 5 (Play page); it is never automatic or one-sided.

---

## 13. Ready-to-Use Taglines

- "You don't choose your cargo. Your opponent does."
- "All you need is a sheet of grid paper and a pen."
- "Qualification is your real level of thinking — not access to a hint."
- "27 figures. One opponent who knows exactly how to set you up."
- "From UnderLodar to ProfiLod — a path only you can walk."
- Alternative (shorter, more neutral): "Strategy. Geometry. Honest play."

---

## 14. Deliverables Checklist

1. Desktop + mobile frames for Home, Play, Sandbox, Figures catalog (priority set)
2. Component library per Section 6 with states/variants
3. Design tokens (color, type, spacing) as Figma styles
4. Standalone Lore page/frame for the full Legend of the Lodars text, including the reserved Belarusian-prologue block
5. Wireframe-level mobile layouts for the remaining pages (Rules, Profile, Leagues, Tournaments, Judge & Consultant, Print & Play, Community, FAQ) for a second iteration
