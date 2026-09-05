# PuzzleStow Site — Consolidated Fix & Build Request (v3)

Supersedes v2. Everything in v2 (Parts A–E) was verified live on the current build
(localhost:8443, mirrored at slept-daisy-01090878.figma.site) during this review pass — see
Part A below. Parts B onward are new, found during a full top-to-bottom walkthrough of the
current build together with the owner. Paste this whole document into Figma Make as a single
request unless noted otherwise. Every item cites its source — do not re-derive content from
general knowledge.

---

## PART A — v2 status: CONFIRMED DONE, no action needed

Verified live, item by item:

1. Container axis orientation — Home legend reads "Row A closed", Rules Rule 01 reads "row A". ✅
2. Overhang threshold — 50% stated explicitly on Home, Rules, and FAQ. ✅
3. Figure size range — "1 to 7 cells" everywhere, Figure #25 correctly cited as the only heptomino. ✅
4. Sample move notation — `07B9C10` format, valid. ✅
5. Qualification tier names — UnderLodar/Lodar/MidLod/Senior Lodar/LeadLod/MasterLod/ProfiLod, correct. ✅
6. MasterLod card — no Judge claim; only ProfiLod card mentions Judge/Consultant. ✅
7. Footer copyright — 2026. ✅
8. FAQ Tetris answer — correctly scopes "no time pressure" to UnderLodar/Lodar tier only. ✅
9. Qualification Bridge copy — left as-is, per v2 instruction (still not written into the PairSec
   spec as a confirmed decision — see Part I, open item, for the related domain-doc question).
10. Container sizing (Part B of v2) — Rated/Practice = 15×10, Sandbox = 15×11 with bold J/K line,
    Home hero = 15×11 with the same line and matching tooltip copy. Confirmed on Home, Rules
    (Container Specification widget), and consistent everywhere sizing is mentioned. Owner
    confirmed this is settled, no longer a "recommendation." ✅
11. Registration nickname toggle (Part C of v2) — Display Name / Nickname / "Use nickname"
    checkbox + PairSec scope note, present on Profile page, matches spec almost verbatim. ✅
12. Play screen (Part D of v2) — full structure present: status bar, your container (15×10),
    opponent's read-only container, legend, remaining-cargo panel, incoming-cargo panel with
    drag + text notation input, request panel labeled "opponent's remaining pool", move history
    log. This is a static Figma Make prototype (hardcoded opponent/history) — functional wiring
    (server-authoritative validation, live opponent state) is implementation-phase work, not a
    design gap. ✅
13. Belarusian Lore prologue (Part E of v2) — final text in place, old meta-caption removed. ✅

---

## PART B — PRIORITY: Practice and Sandbox do not exist (P0 — MVP + acquisition blocker)

**Finding:** On the live build, the "Enter →" buttons for both Practice and Sandbox in the Game
Modes section do nothing — clicking either leaves the user on Home. Only "Play Rated" opens a
real screen. Practice and Sandbox are copy-only cards with no screen behind them.

This is the top priority for this round: Practice and Sandbox are the two entry points a new,
unregistered visitor uses to try the mechanic — without them the acquisition funnel has no
working product behind it.

**Practice** — same screen structure as Play Rated (status bar, your container 15×10, cargo
panels, move history), opponent is a **built-in algorithmic engine, not AI** (see terminology
note below), unrated, explicitly labeled as training on every screen it appears (per Universal
Prompt §5, "Play (rated)" section and UC-08 in PuzzleStow_MVP_UseCases.docx).

**Terminology correction — no "AI" anywhere, in this build or in copy:** the Practice/Sandbox
opponent is a standard, medium-skill-level mathematical/algorithmic engine (deterministic —
minimax-style or heuristic, not a model). "AI" should not appear as its description anywhere.
This also fixes wording that's **already live** on Home and needs correcting, not just new
copy for the Practice build: the Game Modes "Practice" card currently reads "Play against an AI
opponent on a 15×10 container..." and the Qualification section currently reads "Practice and
Sandbox modes offer AI opponents for unrated training only..." — both need "AI" replaced with
neutral wording (e.g. "a built-in engine opponent" / "an automated opponent"). This does **not**
touch the separate "no AI move-advisor in rated play" messaging (Home, FAQ, Rules) — that claim
is about hint-giving, not about what runs the Practice opponent, and stays worded as-is.

**Sandbox** — free figure placement on the 15×11 container with the bold J/K line, toggleable
rule-highlight overlays (steps / overhang / support / return path — on/off independently),
visually distinct treatment from Play so it reads unambiguously as non-rated (Universal Prompt
§5, "Sandbox" section).

Source: PuzzleStow_Universal_Prompt_EN_v1.md / PuzzleStow_Figma_Prompt_EN_v4.md, Section 5;
PuzzleStow_MVP_UseCases.docx UC-08.

---

## PART C — Navigation / menu

1. **Music icon toggle.** Add an icon to the nav (placement: near the Play button or the logo —
   Figma Make's choice, no strong preference from owner) with two visual states: "on"
   (pulsing/vibrating animation) and "off" (static/dimmed). Click toggles between the two states.
   **No real audio wiring yet** — this is a visual control only at this stage. Actual track
   assignment per page will be configured later via an admin page (not part of this request —
   see Backlog).
2. **Sign In / Sign Up replaces "Profile" for a logged-out visitor.** Once authenticated, the nav
   shows "Profile" as it does today. See Part D for the full auth page spec.
3. **EN/RU language switcher moves into the top nav** (currently it only exists in the footer).
   Keep it in the footer too if convenient, but it must also be reachable from the primary nav.
4. **All footer links must be wired to real destinations — or removed if there's nothing to link
   to yet.** Currently every footer item (NAVIGATE: Play, Figures, Rules, Lore, Print & Play;
   COMMUNITY: Leagues, Tournaments, Telegram, YouTube) is inert placeholder text, not a working
   link — including duplicates of pages that already work from the top nav. Owner's decision:
   **remove any footer entry that has nothing to link to** (Leagues, Tournaments — deferred, see
   Part K; Telegram/YouTube — no channel URLs exist yet, remove until they do). Keep and wire:
   Play, Figures, Rules, Lore, Print & Play (once Part E ships).

---

## PART D — Sign In / Sign Up page (build from scratch — no page exists today)

Reconciles PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx with decisions made in this
session, which supersede the addendum where they conflict (noted inline).

**Layout:** one screen, a single card that flip-transitions between Sign In and Sign Up (owner's
new requirement — the addendum only specified a plain toggle, not an animated flip).

**Sign Up fields** (supersedes addendum §3, which had a single "Имя" field):
- First Name, Last Name (feeds "Display Name" on Profile — see v2 Part C)
- Nickname + "Use nickname" checkbox (same two fields as the Profile setting from v2 Part C —
  see "Nickname" note below for why this moved here)
- Email
- Password + confirm password
- Forgot password link (not in the addendum, added now)
- Checkbox: agreement to rules/offer (required) — kept from addendum §3
- Address — explicitly deferred, useful for future statistics, not in this build

**Login methods** (addendum §2, confirmed unchanged): Email + password as primary. **Telegram
OAuth stays as an optional secondary method** (not primary, per addendum's original framing) —
add a short tooltip/footnote explaining what it's for, since not every visitor uses Telegram.
Phone login: still not in MVP scope, per addendum.

**Age gate:** No 18+ checkbox on this form. Age restriction is handled entirely on the PairSec
side of the shared account — resolves the open question in addendum §7 ("Мин. возраст / чекбокс
18+"). Do not duplicate it here.

**Nickname:** resolves the other open question in addendum §7 — the other way round from an
earlier draft of this document. The nickname/"Use nickname" choice moves INTO the signup form
itself, asked at the same time as First/Last Name, rather than being purely a post-signup Profile
setting. Reasoning: if it's Profile-only, there's a window between account creation and the
user's first visit to Profile where their real name is already live on leaderboards, match
history and badges by default — they find out they were exposed after the fact, not before. Ask
it upfront instead, so the account is never in an unconfigured, name-exposed state to begin with.
The same field stays editable later on Profile (v2 Part C) — one setting, available at both
points in the account lifecycle, not two different code paths for "new" vs "existing" users.

**Page states** (keep from addendum §4 as-is): empty/default, validation error (inline, brand
tone — "This email is already in use", never "Error" in caps), "check your email" screen with
resend after 60s, success → redirect to the 4-step onboarding tutorial (not an empty profile),
already-authenticated → redirect straight to Profile.

**After successful signup** (addendum §5, unchanged): creates a user record with
game_qualification = UnderLodar by default, 4-step onboarding tutorial, "Novice" badge + offer to
play a training match vs AI on completion.

**Visual requirements** (addendum §6, unchanged): Light Deck background, card with soft shadow,
no gradients; primary button Stow Blue (hover 10% darker); Telegram button has an icon but does
NOT use Telegram's own brand blue — stays inside the PuzzleStow palette; errors in FairPlay Red
text, no "Error" in caps, no sarcasm; font Inter; email/password fields are NOT monospace
(monospace stays reserved for coordinates/move notation).

Source: PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx (superseded fields/flip noted above).

---

## PART E — Print & Play (build now — deferred pages in Part K, this one is not deferred)

Per owner: needed now, unlike Leagues ("до лиги пока далеко"). This is an offline acquisition
channel — someone can try the mechanic on paper with zero signup.

- PDF download: full rules, all 27 figures, container template.
- **Both container templates side by side, downloadable independently**: 15×10 standard and
  15×11 beginner-with-bold-J/K-line (v2 Part B requirement, not yet built as an actual page).
- 3-step instructions: draw two containers → mark coordinates → keep the figure table on hand.
- Tagline: "All you need is a sheet of grid paper and a pen."

Source: PuzzleStow_Universal_Prompt_EN_v1.md §5 "Print & Play"; PuzzleStow_Site_Fix_Request_v2.md
Part B.

---

## PART F — Container widget: reusable component spec + rendering fix

Document the container grid (used in Home hero, Play, Sandbox, Rules) as one shared component:

- Grid 15×N (N = 10 or 11), axis labels A–J/K and 0–14, entry point A0.
- Legend: Placed / Row closed / Entry A0 / Drop preview.
- 15×11 variant carries the bold J/K separator line (v2 Part B) — same component, one prop/flag.
- **Rendering fix:** figures placed inside the container currently render as solid filled blocks;
  everywhere else on the site (Figure Catalog, remaining-cargo panels) they render outline-first.
  Make the in-container rendering match the outline-first style everywhere — a color/state change
  for "placed" is fine, a fill-style change is not (Universal Prompt §2: "outline-first figure
  rendering (not solid blocks) — keeps the visual language distinct from Tetris").

**Home hero demo:** keep it a plain, unremarkable example — **do not** script it into a
teaching scenario (e.g. an entry deliberately blocked by a step ≥4). Owner's reasoning: a visitor
who reads it as "these guys drew an unsolvable position, the game is broken" is worse for
acquisition than a scenario that teaches nothing in particular. No special engine or seeded logic
needed for this widget — it's decorative.

---

## PART G — Four Rules pictograms need to be bigger and clearer

The four small icons in the "How It Works" cards (Support / Steps / Overhang / Return Path) are
currently ~24px, thin single-color lines on a dark background — illegible at a glance (owner's
read: "looks like ants"). Enlarge them, and make each one actually depict its rule rather than an
abstract shape:
- Support — a figure resting on a visible base line.
- Steps — a small staircase, optionally marked "≤3 ok / ≥4 blocked".
- Overhang — a figure hanging past an edge with a percentage marker.
- Return Path — a dotted line from a placed figure back to exit A0 through the grid.

Keep them within the existing blueprint/coordinate-grid visual language (Universal Prompt §2).

---

## PART H — Mobile (375px reference width — primary channel is Telegram WebView)

1. **Horizontal overflow, confirmed on two separate screenshots:** the hero subtitle
   ("TWO-PLAYER STRATEGY / PERFECT INFORMATION"), the Play Rated/Practice/Sandbox button row, and
   the hero container widget all extend past the right edge of the viewport and get clipped
   instead of wrapping/shrinking. Fix responsive layout for these three elements at minimum —
   re-check the rest of Home and other pages at 375px once fixed.
2. **Hamburger menu (☰) did not open on two consecutive attempts** during this review (mobile
   viewport, 375×812). Inconclusive — could be a connection hiccup rather than a real bug — flag
   for a dedicated re-check rather than assuming it's broken.

Source: Universal Prompt §8, "Mobile-first priority: the primary game channel is the Telegram
WebView."

---

## PART I — Domain correction: pair-sec.com, not pairsec.com

The correct PairSec domain is **pair-sec.com** (with hyphen). `PairSec_Спецификация_Final_2026.docx`
currently states pairsec.com/pairsec.io throughout (§7, §12, §14) — that's now outdated. Fix
every reference on the PuzzleStow site (the "What is PairSec →" CTA and any other mention) to
pair-sec.com.

**Open item:** should `PairSec_Спецификация_Final_2026.docx` itself also be corrected in the
project, or is the domain fix scoped to the site only for now? — owner to confirm.

---

## PART J — Logo: bring into brandbook alignment (separate track, not blocking this prompt)

Owner generated a set of logo drafts (via an AI logo generator — all carry a "logoai.com"
watermark, meaning none are production-ready files yet). Reviewed against the current brand:

- **Icon is solid-filled with a gradient** (two-tone blue 3D cube). Conflicts with the site's
  established "outline-first, not solid blocks" rule (Universal Prompt §2) and the "no gradients"
  rule from the registration addendum's visual requirements (§6).
- **Wordmark typeface** is a rounded, soft geometric sans — not Inter, and softer than the site's
  "strict geometry, no soft/organic shapes" direction.
- **Light background / pastel palette** — the live site is dark (Cargo Graphite background,
  cyan/blue accents throughout); a light-background gradient logo will stand out against the nav
  bar rather than sit in it.
- One variant (logo4.png) has a leftover textured background that needs to be removed/made
  transparent.
- New tagline found in the drafts, **"THIS ISN'T TETRIS"** — not in the current approved tagline
  list (Universal Prompt §13), but it lines up neatly with the Suno anthem the owner already
  produced ("This ain't Tetris — this is PuzzleStow"). Worth adopting as a tagline given that
  existing asset.

Recommendation: keep the composition (cube mark + wordmark + tagline) as a reference, but
redraw the icon in outline style using the existing palette, and set the wordmark in Inter,
before using it live. Not blocking the rest of this prompt — logo is its own track.

---

## PART K — Explicitly deferred this round

Per owner: MVP + acquisition focus only this round. Not building now, and removing their (inert)
footer links until they exist:
- Leagues
- Tournaments
- Judge & Consultant
- Community page / YouTube clip carousel

---

## BACKLOG — noted, not part of this request

- **Admin page** for the owner to configure: which music track plays on which page/section
  (once real audio files exist). Owner mentioned other settings for this page previously
  discussed but not yet re-listed — to be added when recalled.
- **Suno anthem(s):** several tracks exist, including one themed around the Lodars; actual
  exported audio files (mp3/wav) are still needed before the music toggle in Part C can be wired
  to anything real.
- **"Gallery of common mistakes"** — a separate, humor-toned showcase of typical rule violations
  (e.g. an illustrated character who traps themselves by blocking their own return path). Parked
  as its own future feature, not part of the Home hero.
- **Telegram's August 2026 API/feature update** (13th-anniversary release: Welcome Messages,
  ephemeral per-user button interactions in Buttons-in-Messages, Member Tags, third-party login
  integration) — worth a dedicated look at whether the ephemeral-button mechanism is useful for
  the PuzzleStow/PairSec Telegram bot (e.g. targeted per-user prompts inside a shared group chat
  without spamming everyone else).
