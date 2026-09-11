# PuzzleStow — Native Mobile App Design Prompt (for Claude Design)

**Version:** v1.0 · **Date:** 2026-09-09 · **Companion doc:** `PuzzleStow_Mobile_App_Requirements_Spec.docx`

This prompt is written to be pasted into Claude Design (or a similar AI design tool) to generate the UI/UX design for the **native mobile app** (iOS + Android) of PuzzleStow. It is structurally modeled on the existing `PuzzleStow_Figma_Prompt_EN_v4.md` / `PuzzleStow_Universal_Prompt_EN_v1.md` used for the web product, but re-scoped for a native app: platform navigation patterns, gestures, offline states, push notifications, and app-store conventions replace the responsive-web concerns of the original prompts.

---

## 1. Context & Goal

Design a native mobile app for **PuzzleStow** ("Отгрузка" / Shipload) — a two-player cargo-loading strategy board game played on a 15-column container grid using 27 fixed geometric figures. Players alternate requesting and placing figures under strict spatial rules (support, overhang fair-play, step passability, mandatory return path), racing to close 5 rows or columns.

This app is a **new channel**, not a replacement: PuzzleStow already runs as a Telegram WebView experience for casual/quick play. The native app is for engaged players who want app-store presence, push notifications, an offline-capable rules/figures reference, and a fuller native interaction model (gestures, animation, full-screen play) than a WebView allows. Design accordingly — this should feel like a focused, "serious game" companion app, not a lightweight bot wrapper.

The app talks to the same backend as the web product. **The server is the sole authority on move legality** — nothing in this design should visually imply the app itself "decides" whether a move is legal until the server responds. Design every interactive placement flow with a clear pending/confirmed state distinction.

## 2. Product Essence & Positioning

- A strategy game for people who enjoy spatial-reasoning puzzles (packing/tetromino-adjacent, but explicitly **not** a Tetris clone — see Hard Constraints).
- Tone: intelligent, calm, honest, strategic. Never casual, hype, or sarcastic. Rule violations are explained precisely ("This move breaks the support rule"), never blamed ("You made a mistake").
- Positioning: a premium, focused companion app — think more "chess.com app" in seriousness than "casual mobile puzzler."
- Audience: players already engaged via web/Telegram who want a dedicated app; qualification-ladder progression (7 tiers) is a core motivator and should feel prestigious in the UI.

## 3. Visual Style & Palette

Carry the existing brand system (`PuzzleStow_Brandbook_v1.1`) into mobile without reinvention:

| Role | Color | Hex |
|---|---|---|
| Primary | Stow Blue | `#1F4F82` |
| Accent / A0 marker | Lodar Cyan | `#1FA7A3` |
| Dark / text | Cargo Graphite | `#1C1F26` |
| Background | Light Deck | `#F5F7FA` |
| Neutral / borders | Steel Grey | `#A3A9B5` |
| Success / closed row | Green Stow | `#3BB273` |
| Error / fair-play | FairPlay Red | `#D6456F` |

No orange anywhere in the palette. Design both a light theme (primary) and confirm whether a dark theme is in scope (recommended for a mobile companion app used in varied lighting — flag as an open decision for Sergey if Claude Design proposes one, don't assume).

## 4. Typography

- **Inter** — primary UI typeface (all body text, labels, navigation).
- **JetBrains Mono** — reserved exclusively for move notation and grid coordinates (e.g. `10A12C14`, cell labels like `A9`). Never use it for general UI text.
- Respect OS-level dynamic type / font-scaling accessibility settings — do not hardcode fixed pixel sizes that break with system font scaling.

## 5. Key Visual Elements

- **Container grid**: 15 columns × (10 or 11 rows, depending on the player's qualification tier for that game — render dynamically, never assume a fixed height). Cell states: empty, filled, notation dot, dead void (marked with `×`), closed row/column (highlighted in Green Stow).
- **Figures**: rendered as **outlines only**, never solid fills — this is a deliberate, non-negotiable choice to avoid reading as a Tetris clone.
- **Qualification badges**: 7 tiers (UnderLodar → Lodar → MidLod → Senior Lodar → LeadLod → MasterLod → ProfiLod), compact (list/profile chip) and full (profile hero) variants.
- **Move notation tag**: monospace, small pill/tag component showing move strings like `07B13A14`.
- **Fair-play confirmation**: a distinct, unmissable modal state — this is a two-party legal-agreement moment in the game, not a casual dialog; treat its visual weight accordingly (see §7).

## 6. App Structure & Navigation

Design native navigation (tab bar + stack navigation, iOS/Android idiomatic patterns), not a ported website sitemap. Screens in scope for MVP v1 (per the requirements spec):

1. **Home** — active games status (whose turn, awaiting opponent, awaiting fair-play confirmation), quick entry to Play/Sandbox, qualification widget.
2. **Play** (rated) — the core game screen: container grid, figure request/selection panel, move notation log, return-path indicator, fair-play modal when triggered.
3. **Sandbox / Practice** (unrated) — same core mechanics, but **visually and structurally distinct** from Play at all times (different accent treatment, persistent "Sandbox" badge/header — never just a color tweak that could be missed). AI opponent lives only here.
4. **Figures catalog** — all 27 figures × 4 orientations, collapsed/expanded card states, available offline.
5. **Rules** — full rules text with interactive illustrations (grid, steps, support), available offline.
6. **Profile & Qualification** — badge, tier progress, match history/stats.
7. **Notifications settings** — per-category push toggles (your turn, figure requested, qualification up, fair-play confirmation needed, game finished).
8. **Settings / Account** — language (RU/EN), sign out, links out to web for out-of-scope features (Leagues, Tournaments, Judge & Consultant, Print & Play).

Out of scope for v1 (do not design full screens for these yet, but leave room for a simple "open in web" link-out pattern): Leagues, Tournaments, Judge & Consultant, Print & Play, full Community embeds, Lore.

## 7. UI Components

- Buttons: primary / secondary / outline, following brand palette.
- Figure card: collapsed and expanded (4-orientation) states.
- Move card / move-log entry.
- Qualification badge: compact and full variants, all 7 tiers.
- Container grid component with all cell states listed in §5.
- Modals — including the **mandatory bilateral fair-play confirmation modal**: must clearly show both players' confirmation status (e.g. "You confirmed · waiting for opponent"), and must never auto-dismiss or resolve without both sides acting.
- Tooltips, toasts.
- Move-notation tag (monospace).
- **Connectivity state banner** — a persistent, unmissable "offline / reconnecting" indicator whenever the app cannot reach the server, since move submission requires connectivity (see Hard Constraints).
- Push-notification permission prompt (native OS pattern, contextual — ask at a moment tied to value, e.g. right after a player's first game starts, not on cold launch).

## 8. Mobile-Specific Interaction Notes

- **Gestures**: drag-and-drop figure placement onto the grid; tap/swipe to rotate a figure in the selection panel before or during placement; pinch-to-zoom and pan on the grid for small screens.
- **Touch targets**: minimum 44×44pt, especially for individual grid cells and rotation controls.
- **Offline states**: Figures catalog and Rules must have a clear "available offline" affordance. Play screens must clearly distinguish "viewing cached state" from "live, connected" — never let a player believe an offline view reflects a submitted move.
- **Pending vs. confirmed moves**: every placement goes through a visible pending state (e.g. subtle animation or dimmed treatment) until the server's `validate-move` response returns — design this transition explicitly, it's a core trust signal for a server-authoritative game.
- **Push notifications**: design the notification content style (calm, specific — "Your opponent placed F14, your turn" rather than generic "New activity") consistent with brand tone of voice.
- **Platform conventions**: respect iOS Human Interface Guidelines and Android Material patterns for navigation chrome, back behavior, and system gestures rather than forcing a single cross-platform look — the brand identity (color, type, iconography, figure-outline style) stays constant across platforms, but chrome (tab bars, headers, transitions) should feel native to each OS.

## 9. Copy & Content Needed

Reuse existing copy sources rather than inventing new voice:

- Rules text: `PuzzleStow_MVP_Rules`.
- Rule-violation messages: brand tone examples already defined (e.g. "Этот ход нарушает правило опоры" instead of "Ты ошибся") — mirror this pattern for any new mobile-specific copy (permission prompts, offline banners, push notification text).
- Qualification tier names: UnderLodar, Lodar, MidLod, Senior Lodar, LeadLod, MasterLod, ProfiLod.

## 10. Animation

- Figure placement: smooth snap-to-grid on drop, with a distinct "pending" micro-animation while awaiting server confirmation, resolving to either a confirm animation (settle + subtle highlight) or a reject animation (shake/return to panel) — never a silent removal.
- Row/column closure: a celebratory but restrained animation (in Green Stow) — the tone stays "calm and strategic," avoid anything cartoonish.
- Qualification tier-up: a distinct, slightly more celebratory moment on the Profile screen — this is a rare, meaningful event and can carry more visual weight than routine gameplay feedback.

## 11. Frontend / Implementation Notes

- Target stack (proposed, pending confirmation — see requirements spec §3): React Native + Expo. Design components in a way that maps cleanly to a component library (avoid designs that only make sense as bespoke native views with no reusable structure).
- Grid rendering must be driven by the actual `games.container_rows` value (10 or 11) returned by the server for that game — never assume a fixed 11-row grid in mockups; provide both variants in the design deliverable.
- All rule-legality visuals (highlighted reachable cells, turning-pocket previews, etc.) are UI hints only — server response is final. Design should make this legible (e.g. a "checking..." micro-state) without being heavy-handed.

## 12. Deliverable Organization

Organize the Claude Design output analogous to the existing Figma file structure (`PuzzleStow_Figma_Prompt_EN_v4` §11), adapted for mobile:

- Foundations (color, type, iconography, spacing/grid system for mobile breakpoints)
- Components (as listed in §7)
- Screens — Home, Play, Sandbox, Figures catalog, Rules, Profile, Notification settings, Settings — each with key states (empty, loading, error/offline, populated)
- Flows — onboarding/registration, first move placement, fair-play confirmation flow, push-permission request flow

## 13. Hard Constraints (non-negotiable — carried from the web product prompts)

1. **No AI move-advisor / hint UI anywhere in rated Play.** An AI opponent may exist only in unrated Sandbox/Practice, and must always be visually and functionally distinct from rated Play.
2. **No client-side authoritative rule validation.** All legality visuals are hints; the server's response is the only accept/reject authority.
3. **No visual Tetris-cloning.** Palette, block/figure rendering (outline-only, never filled), and typography must stay clearly differentiated from Tetris and similar block games.
4. **No stakes/wagering features.** Pending legal review, long-term low priority — do not design betting/wager UI.
5. **Figure geometry only from `otgruzka_figures.json`** — do not invent or approximate figure shapes.
6. **Fair-play overhang exception requires an explicit bilateral confirmation modal** — never automatic, never one-sided.

## 14. Deliverables Checklist

- [ ] Foundations: color tokens, type scale, iconography, spacing system
- [ ] Component library per §7
- [ ] Full screen set per §6, each with key states
- [ ] Onboarding / registration flow
- [ ] Play flow: figure request → placement (pending) → server confirm/reject → fair-play modal (when triggered) → closed row/column celebration
- [ ] Offline / connectivity states across Figures catalog, Rules, and Play
- [ ] Push-notification permission and settings flow
- [ ] Both container-grid variants (10-row and 11-row) shown at least once
- [ ] Light theme (and dark theme, if pursued) applied consistently across the full screen set
