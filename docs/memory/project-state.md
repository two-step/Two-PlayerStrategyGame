---
name: project-state
description: "PuzzleStow status snapshot 2026-11-17 — items 44 (rules) and 46 (AGENTS.md) committed, item 43 timers committed (may not ship in MVP), opponent engine (item 30) still wrong — active work; git ledger, TO_DO numbering, agreed next steps"
metadata:
  node_type: memory
  type: project
  originSessionId: 62bddeee-7f96-4ba5-8410-e00ca824af19
  modified: 2026-11-17T12:00:00.000Z
---

**Snapshot date: 2026-11-17.** Full handoff: `D:\4work\puzzlestow\artifacts\PUZZLESTOW_STATE_2026-11-17.md` (replaces the 2026-10-09 doc's §5–9; its §1–4 canon still holds). The 2026-10-26 details below remain valid where not superseded.

**What changed since 2026-10-26:**

- **Item 46 DONE:** `AGENTS.md` reworked to TO_DO 46a–f (Проект / Session requirements / Стек / Принципы / Стиль кода / Определения «готово»), commit `088a9ff`. `CLAUDE.md` is still the single line `@AGENTS.md`. It now also points agents to the Memory folder (`D:\4work\puzzlestow\artifacts\Memory`). Keep future AGENTS.md edits **minimal** — no bloat (Sergey's standing instruction).
- **Items 44a–h committed and verified** (commits `2be1414`, `9975148`, `627566c`, plus `2ef2d8d`): dead cells block row/column closure (44f/g), sealed exit = loss declared by UI, not a refusal (44d — return path from the place of installation, not the stack top), fair-play IN/OUT tallies (44c). Claude Code verification: **11 regression scenarios PASS, `tsc --noEmit` clean, `vite build` clean**. Sergey folded the canBridge explanation into TO_DO item 44.
- **`rules.ts` extra fix (F20/F22 canBridge, commit `2ef2d8d`):** a floor-level capped pocket ("pure pocket": bottom = floor, top ≠ 0) no longer bridges via the ≤3 arithmetic into a neighbor column's open-air run — F20 no longer "walks through a wall". `enumeratePlacements` gained a `limit` param (engine perf) and `canPlaceAnywhere` early-exits. No other uncommitted rule-semantic changes exist.
- **Item 43 timers committed (`52bf368`)** — DevTestPage: per-player THIS LOAD window (opens when a load request arrives, closes when that player sends their own request) + TOTAL TIME (sum of closed windows), 1-s tick while any window runs. **Sergey: timers probably will NOT ship in MVP** — the code stays on the test page and in Git.
- **Item 30 (opponent engine) — reworked but STILL WRONG (Sergey 2026-11-17, active work):**
  1. It does not "think" about the human's container — hands the player convenient figures.
  2. Requests follow a rigid pattern F01→F05 (closing row A), then the same sequential pattern again.
  3. Diagnosis (`_to_delete/diag30.mjs`): on an empty board the engine still picks 16B12 (rank 11 of 13) — after it, only F01/F02 can cover A13 (exactly Sergey's «отсекаем ряд А»). Cause: all shortlisted candidates score identically (vacancy=160, alive=26, static equal) and ties fall to the "human order" (farthest column first). The `alive` metric doesn't count HOW MANY DIFFERENT remaining figures can legally cover each still-open floor cell.
  4. Proposed fix direction (awaiting Sergey's ok): add "distinct-figure coverage of open floor cells" to placement scoring; in `chooseFigureToRequest` kill the deterministic by-id pattern (easy is nominally random — verify the F01→F05 pattern's actual source).
  5. The engine's uncommitted rework sits in the working tree **uncommitted on purpose** — do not commit until item 30 is right. Everything else is committed.
- **oxfmt is BROKEN — do not run `npm run format`** until fixed: it eats `;` from type annotations and bloats TSX ~2.4× (Claude Code, 2026-11-17; it restored files from git and re-applied edits manually).
- **Commits since `cfa664f` (all unpushed, main is 11 ahead of origin/main):** `2be1414` 44a–h rules rework; `adec359` engine per TO_DO 30; `9975148` + `627566c` 44d fixes; `088a9ff` AGENTS.md 46a–f; `2ef2d8d` canBridge; `52bf368` timers 43. Sergey's ruling: commit everything except the engine; push when he says.
- **Known index quirk:** the git index holds a truncated (130-byte) `Claude outputs/PuzzleStow_Mobile_App_Requirements_Spec.docx`; the working-tree file is intact (18 879 bytes) — a plain `git add` of that file at the next commit repairs it.
- **Junk/notes:** `_to_delete/diag30.mjs`, `regress30.mjs`, `replay30.mjs` — engine diagnostics, useful until vitest exists (item 45); `.tmp_read/` in the repo root is disposable; `.codex/`, `.vscode/` untracked.

**Still valid from 2026-10-26:** fair play is implemented (do not re-file as missing); pages implemented vs stubs (Leagues/Tournaments/Judge/Community; music and localization are visual placeholders only — no `<audio>`, no i18n, Belarusian absent from the lang switcher); `.env.local` exists (never print values); Supabase 7 migrations; `App.tsx` ~4.7k lines is tech debt with gradual migration; no test runner and no linter yet (vitest/eslint are prerequisites for item 45, ≥80 % coverage).

**BUILD ORDER (Sergey 2026-11-17):** 1) memory task (this file + handoff + AGENTS.md pointer — DONE); 2) **item 30 engine** (see above); 3) then 45 (vitest + golden set — precondition for future rules commits), 27, 29+33, 28, 41+42, 40, 34, 48. Item 31 stays entangled with the game-page work (44/43/30), not a separate step.

**Session practicalities:** TO_DO item numbers are valid only as read from the file (red font `EE0000` = DONE); read `.docx` via unzip + `word/document.xml` (node, not python3); dev server `npm run dev` port 8443 — Sergey starts it himself; `tsc --noEmit` is the compile check (clean as of 2026-11-17).
