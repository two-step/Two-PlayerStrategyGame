# PuzzleStow Site — Consolidated Fix & Build Request (v2)

Supersedes PuzzleStow_Site_Fix_Request_v1.md. Part A carries forward every item from v1 —
confirm with the person whether those were already applied before pasting; if yes, skip Part A.
Parts B–E are new. Paste this whole document into Figma Make as a single request. Every fix or
addition below cites its source — do not re-derive content from general knowledge.

---

## PART A — Carried forward from v1

1. **Container axis orientation.** Base/floor row is **A**, not K (A0 = bottom-left corner, entry
   point). Fix: Home page container legend ("Row K closed" → "Row A closed"); Rules page Rule 01
   ("container base (row K)" → "row A"). Source: Brandbook v1.1 §5.1.
2. **Overhang threshold — missing 50% figure**, currently vague ("fair threshold") in 3 places:
   Home "Four Rules" Overhang card, Rules page Rule 03, FAQ. State the concrete default: more
   than 50% of the piece's area unsupported is not allowed by default, overridable only by the
   bilateral fair-play exception. Source: PuzzleStow_MVP_Rules.docx.
3. **Figure size range — wrong max**, in 2+ places ("1 to 6 cells" / "hexominoes (6 cells)" /
   "sizes 1–6 cells"). Fix to **1 to 7 cells** — figure #25 is a 7-cell heptomino, the only one.
   Source: otgruzka_figures.json, id 25, cells_count: 7.
4. **Invalid sample move notation on Home hero.** `07B 09D 11` / "orientation 11°" is invalid —
   only 0/90/180/270 rotations exist, and notation is one unbroken string
   [figure id][point1][point2], no spaces, no degree suffix. Replace with e.g. `07B9C10`. Source:
   PuzzleStow_MVP_Rules.docx (example `10A12C14`).
5. **Qualification tier names — two invented, one wrong shorthand.** Canonical ladder: UnderLodar
   (UnderLod) → Lodar → MidLod → Senior Lodar → LeadLod → MasterLod → ProfiLod. Site currently
   shows "JunLod" (→ fix to "Lodar"), "SenLod" (→ "Senior Lodar"), "ExpertLod" (→ "LeadLod").
   Source: PairSec_Спецификация_Final_2026.docx §7.1.6.
6. **MasterLod card wrongly claims Judge eligibility.** Only ProfiLod qualifies for Judge/
   Consultant roles — remove "Judge-eligible" from the MasterLod card (contradicts the site's own
   FAQ and the ProfiLod card). Source: PairSec_Спецификация_Final_2026.docx §6.5, §7.1.7.
7. **Footer copyright year** "2024" → **2026** (project timeline throughout every document is
   2026).
8. **FAQ Tetris answer overstates "no time pressure."** True only at UnderLodar/Lodar tier — from
   MidLod up, timers and request limits apply (T=7/5/3 min, Li=1/2/3). Scope the claim explicitly
   or remove it. Source: PuzzleStow_Official_Rules.docx, qualification table.
9. **Qualification Bridge "UnderLod–JunLod → PairSec observer" — do not change without owner
   confirmation.** May be a deliberate product decision not yet written into the PairSec spec.
   Leave as-is in this batch.

**Do NOT change:** figure naming convention (e.g. "Pentomino-U") — approved, standard polyomino
nomenclature, no Tetris collision. Rule 02/04/05 wording — correct as-is. Rated/Practice/Sandbox
separation and "no AI advisor in rated play" messaging — correct as-is.

---

## PART B — NEW: Container size — 15×10 for competitive play, 15×11 as a permanent Sandbox/hero motif

Two sizes, deliberately different roles — not tier-branching logic, but different modes entirely:

- **Rated Play — always 15×10 (rows A–J).** No branching by qualification tier, including
  tier-mixed matches (league promotion/relegation games, §7.6). Settled.
- **Practice (vs AI) — recommend 15×10, matching Rated.** Practice exists to rehearse the real
  game mechanic (opponent assigns your piece) before playing for real — a different container
  size there would undermine that rehearsal value. Flagged as a recommendation, confirm before
  building.
- **Sandbox — 15×11 (rows A–K), the training container — permanent, not a placeholder.** Row K is
  deliberately extra "breathing room" for players still learning to stack. Draw a **bold
  horizontal separator line between row J and row K** here. This line stays as a running feature,
  not something to remove once digital 15×10 ships — it's a constant visual reminder of the gap
  between training and competitive play.
- **Home hero — keep 15×11**, with the same bold J/K separator line as Sandbox, for visual
  consistency. The line is meant to recur everywhere 15×11 appears (hero, Sandbox, Print & Play)
  as a recognizable motif, not a one-off detail.
- **Print & Play — offer both templates** (15×10 standard, 15×11 beginner with the bold J/K
  line), downloadable side by side.

Suggested copy for a tooltip/caption on the Sandbox bold line (matches Brandbook v1.1 tone —
intelligent, calm, honest, no pafos): *"This extra row is yours while you're learning to stack.
Once you've got it, you'll play on 15×10 like everyone else — and this line becomes the ceiling."*
Adapt wording freely, but keep the idea: the line marks a temporary privilege for the player, not
a temporary feature of the build.

Source for the underlying two-size system: PuzzleStow_Official_Rules.docx — container diagram
("Дополнительный ряд для начинающих") and the qualification table under "Виды игр" (UnderLodar/
Lodar: 15×11; MidLod and above: 15×10). Assigning 15×11 specifically to Sandbox/hero (rather than
paper-only) and 15×10 to both Rated and Practice is the owner's MVP scoping decision, documented
here for the first time.

**Where this changes existing pages/widgets:**
- Rules page, Container Specification widget: describe both sizes and where each is used
  (Rated/Practice = 15×10, Sandbox = 15×11).
- Sandbox page: render 15×11 with the bold J/K line and the tooltip/caption above.
- Print & Play page: add the 15×11 template with the bold J/K line alongside the existing 15×10
  template.
- Home hero container visual: keep 15×11, add the bold J/K line to match Sandbox.

---

## PART C — NEW: Registration — nickname field

Add to the registration/profile form:
- "Display name" field (real name)
- "Nickname" field
- Checkbox: **"Use nickname"** — when checked, the nickname replaces the real name everywhere in
  PuzzleStow (leaderboards, match history, profile cards, Lodar Path badges).

Scope this toggle to **PuzzleStow display only.** It must not silently affect what's shown for
PairSec service bookings — PairSec's trust/rating model relies on more transparent identity for
real-world, in-person services (PairSec_Спецификация_Final_2026.docx, FAQ §15 on 18+/safety and
trust ratings). Treat cross-product display of the nickname as a separate decision, not a default.

---

## PART D — NEW: Play screen (Rated + Practice) — full structure

Single screen, shared between Rated and Practice modes (Practice = same structure, AI assigns
your incoming cargo instead of a human opponent, results don't affect qualification).

1. **Status bar** — turn indicator ("Your turn — place figure Fxx" / "Waiting for opponent") +
   match context (mode, move number).
2. **Your container** — fixed 15×10 (rows A–J), per Part B — no dynamic row count, no beginner
   variant in-app. Drag-and-drop target for the incoming cargo. Axes rendered per Brandbook v1.1
   (A at bottom, entry A0 bottom-left).
3. **Opponent's container** — smaller, read-only reference view, same 15×10 size and axis
   convention. Not an interactive surface.
4. **Legend** — Placed / Row closed / Entry A0 / Drop preview, matching Brandbook v1.1 colors
   (Stow Blue, Green Stow, Lodar Cyan, FairPlay accent for the drop preview outline).
5. **Your remaining cargo panel** — all 27 figure IDs, visually distinguishing already-loaded
   (dimmed/struck) from still-pending (active) — "what the opponent can still assign you."
   Defensive planning tool.
6. **Incoming cargo panel** — the figure currently assigned to you: shape preview, rotate control
   (0°/90°/180°/270° only — no mirroring), **and two coexisting placement inputs**: (a) primary —
   drag the piece onto your container; (b) secondary/fallback — a text field for typing the move
   notation directly (e.g. `B9C10`), for accessibility and for the paper-notation-literate
   audience. Both paths submit to the same server validation endpoint.
7. **Request panel** — figure picker explicitly drawing from the **opponent's** remaining pool
   (not yours, not a generic list) — label it as such in the UI. Disable/grey out whichever figure
   was the opponent's own last request to you (repeat-request rule).
8. **Move history log** — compact, monospace, list of past notations with who made each move.

**Technical requirement, consistent with the project's existing server-authoritative principle:**
both remaining-pool panels (yours and the opponent's) must display values returned by the server
as explicit fields, **not values computed client-side by replaying the move history.** This
mirrors the already-established rule that violation-highlighting must reflect server-confirmed
state, not a client-side re-implementation (Rules page intro: "no client-side rules engine").

---

## PART E — NEW: Belarusian Lore prologue — final text (replace AI placeholder)

Replace the current auto-generated "ПРАЛОГ / PROLOGUE" block content on the Lore page with the
owner's own text. It is short and deliberately terse — do not pad or expand it to paragraph
length, the brevity is intentional:

> Мазгавая тэрапія знаходзіцца недзе побач з працоўнай.

Keep the existing UI treatment as-is (separate card, own "згарнуць" toggle, visually distinct
from the RU/EN switcher) — that part was already correct, only the text content changes.

**Also remove:** the auto-generated meta-caption currently shown under the block ("Гэты ўрывак —
частка аўтэнтычнага брэнд-нарратыву PuzzleStow. Захоўваецца як асобны блок для ранняй супольнасці
і каманды.") — it states the block's implicit-filter purpose out loud, which defeats the purpose
of it being implicit. Delete it; do not replace it with new copy.
