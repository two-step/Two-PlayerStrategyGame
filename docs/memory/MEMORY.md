# Memory Index

*Last synced 2026-11-17: items 44 (rules, 11 regression scenarios PASS), 46 (AGENTS.md per 46a–f, commit `088a9ff`), 43 (timers, `52bf368`, likely out of MVP) and **27 (Figma Make removed from the build, commit `4c5a971`)** are DONE and committed; **item 30 (opponent engine) is the active work** — engine doesn't reason about the human's container, hands over convenient figures in a rigid F01→F05 pattern (diagnosis in project-state.md). oxfmt is broken — do not run `npm run format`. Handoff: `docs/PUZZLESTOW_STATE_2026-11-17.md` in the repo (this repo copy is the canonical reference; `artifacts` holds the authoring copy). TO_DO has 48 items; item numbering is valid only as read from the file.*

- [Sergey — user profile](user-sergey.md) — creator/lead dev of PuzzleStow & PairSec, Minsk; background, language and communication style
- [Ways of working](feedback-working-style.md) — re-review against the whole picture, never invent rules, Claude/Copilot bridging, doc conventions, when to ask before expanding
- [Projects overview](project-overview.md) — PuzzleStow + PairSec + mobile app: what they are, how they connect, session entry point
- [Canonical PuzzleStow rules](project-rules-canonical.md) — orientation, container sizes, ≤3 climb + symmetric step rule, **TO_DO 44 a–h rule system (steps, carry-through, Fairplay, return path, dead cells, closed rows)**, **opponent-engine canon 30a–g**, qualification, notation, typography, lore prologue
- [Hard constraints](project-constraints.md) — non-negotiables across all deliverables (no AI advisor, server-authoritative, palette, figures, tone, never invent rules) + code-style constraints of TO_DO 46e
- [Project state](project-state.md) — snapshot 2026-11-17: rules 44 committed, AGENTS.md reworked (46), timers 43 committed (MVP TBD), **engine 30 still wrong — active work**, git ledger, build order
- [Story universe & channels](project-universe.md) — Lо́dary universe, comic canon, YouTube channel, mobile app
- [Decisions & horizon](project-horizon.md) — 2026-10-09 decisions (Figma, splash, MCP split, mobile RN+Expo, engine), Day/Night idea, post-MVP goals
- [Tools, stack & file exchange](reference-tools-stack.md) — real stack from package.json/vite/tsconfig, path inventory, `.env.local` exists, `.mcp.json`/context7, **Figma Make removed from the build (27, `4c5a971`)**, **oxfmt broken — don't run**, doc-reading and fetch limitations
- [Notifications & completion sound](reference-notifications-sound.md) — desktop-app notification settings, no custom .wav in-app, Windows OS-level steps
