---
name: reference-tools-stack
description: "Where things live — stack, hosting, full path inventory, repos, MCP/Composio split and per-session availability, doc-reading quirks, fetch limitations, broken formatter"
metadata:
  node_type: memory
  type: reference
  originSessionId: 62bddeee-7f96-4ba5-8410-e00ca824af19
  modified: 2026-11-17T12:00:00.000Z
---

**Stack:** PuzzleStow site — React/TypeScript/Vite; Supabase (Auth + DB); Telegram bot (planned). PairSec — Next.js + MapLibre, Telegram-first orientation, MapLibre for maps.

**Hosting:** puzzlestow.com (live), pair-sec.com (live; HTTP 403 = active), domain.by shared hosting (MySQL acceptable for `feed_events` only).

**Environments:** dev server `npm run dev` at **http://localhost:8443/** — Sergey also exposes it on the LAN at **http://192.168.100.171:8443/** (openable from other devices/browser; he starts it himself, so launch it in chat only if he hasn't). On the site the **'Test' button opens the working test implementation of the game** (`DevTestPage`). Production: https://puzzlestow.com. Figma version Sergey stopped at: https://slept-daisy-01090878.figma.site

**Paths (current, 2026-11-17):**

| What | Path |
|---|---|
| Site sources | `D:\4work\vc\PuzzleStow\Two-PlayerStrategyGame` |
| Documents, memory, specs | `D:\4work\puzzlestow\artifacts` |
| **Memory (md, for agents)** | `D:\4work\puzzlestow\artifacts\Memory` (indexed by `MEMORY.md`; pointer also in `AGENTS.md`) |
| **Current handoff** | `D:\4work\puzzlestow\artifacts\PUZZLESTOW_STATE_2026-11-17.md` (copy at repo `docs/PUZZLESTOW_STATE_2026-11-17.md`) |
| Mobile design (Claude Design) | `D:\4work\puzzlestow\mobile` (export: `D:\4work\vc\PuzzleStow\Two-PlayerStrategyGame\Claude outputs\mobile-design-export`) |
| «Лодары» universe | `D:\4work\puzzlestow\Universe` |
| YouTube strategy | `D:\4work\puzzlestow\YouTube` |
| Comics | `D:\4work\puzzlestow\КОМИКСЫ` |
| PairSec (being created) | `D:\4work\puzzlestow\PairSec` |

**Repo:** private GitHub `two-step/Two-PlayerStrategyGame`, branch `main` — `https://github.com/two-step/Two-PlayerStrategyGame`. It was **inaccessible via web_fetch or GitHub MCP in past sessions**; git and the sources are local — prefer that.

**Design tools:** **Figma is no longer the main channel for edits** (decision 2026-10-09) — it stays only for surfaces that don't exist yet: mobile screens, Vote page, Leagues/Tournaments. Figma Make free-tier credits are exhausted; Lovable for prototyping; **Claude Design** produced the mobile design pack (`mobile/Claude_Design_pack/`) and `PuzzleStow_PrintPlay_Kit.pdf`.

**MCP connectors (decision 2026-10-09):** **Supabase — direct MCP only** (schema, migrations, RLS). **Everything else — through Composio**: Gmail, YouTube, vidIQ, OpenAI. Supabase MCP requires per-chat approval; GitHub MCP has not surfaced usable tools in past sessions.

**CORRECTION (verified on disk 2026-10-26): `.env.local` DOES exist** in `D:\4work\vc\PuzzleStow\Two-PlayerStrategyGame`, containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It is gitignored (`.gitignore` line `.env*`), and `.env.example` documents both keys with «Copy to .env.local (gitignored) and fill in real values». `src/lib/supabaseClient.ts` reads them via `import.meta.env` and `console.error`s if missing. **So the handoff's §10 answer «таких переменных нет, связь через MCP server» is wrong** — the running app talks to Supabase through these env vars; the MCP server is a separate, additional channel for schema work. Do not "fix" a missing-env problem that doesn't exist, and never print these values.

**`.mcp.json`** exists in the project root (gitignored) and configures the **context7** MCP server (`npx -y @upstash/context7-mcp`). **Security note:** it holds a `CONTEXT7_API_KEY` in **plaintext inside the file** — contrary to the TO_DO 46 principle «все строки – в переменных окружения, не hardcoded». Candidate cleanup when item 46 is done. Never copy that key into memory, docs or commits.

**Actual stack (read from `package.json` / `vite.config.ts` / `tsconfig.json` / `.mise.toml`, updated 2026-11-17):** React 19 + ReactDOM 19, Vite 8, TypeScript 5.7 with **`strict: true`** and `noFallthroughCasesInSwitch`, Tailwind CSS v4 via `@tailwindcss/vite` (no tailwind.config / postcss config needed), `@supabase/supabase-js` ^2.116, **`jspdf` ^4.2 + `jspdf-autotable`** (Print&Play and game-report PDF export), alias `@` → `./src`. Node 22 + pnpm 10.34.3 pinned in `.mise.toml`; both `package-lock.json` and `pnpm-lock.yaml` are present. Scripts: `dev` = `vite --host 0.0.0.0` (port `$PORT`, default **8443**, `strictPort: true`), `build`, `preview`, `format`. **No test runner and no linter are configured** — no vitest, no eslint/prettier/biome/oxlint config anywhere, yet TO_DO 45 demands ≥80 % coverage and 46f demands «Lint: нет предупреждений». **Setting both up is a prerequisite for those items, not an afterthought.**

**`oxfmt` (`npm run format`) is BROKEN — do not run (2026-11-17):** it eats `;` from type annotations and bloats TSX ~2.4×. A Claude Code session had to restore files from git and re-apply edits manually. Formatter fix is separate work; `tsc --noEmit` is the compile check in the meantime (clean as of 2026-11-17).

**Figma Make is still wired into the build:** `vite.config.ts` imports `./.figma/make/site.json` and registers four plugins (`figmaSiteConfiguration`, `figmaErrorOverlayReplay`, `figmaReactRefreshBoundaryFallback`, `figmaMakeKitPlugin`); `index.html` is a shell of `<!-- figma:* -->` comment slots the plugin fills; `.figma/make/` holds `dev`, `deploy`, `format`, `install`, `langserver` scripts. **Item 27 («заменить Figma make app») is therefore bigger than a rename** — it spans `package.json` name, `AGENTS.md` (done in commit `088a9ff`), and this config. `.figma/make/site.json` already carries PuzzleStow's real SEO description and `robots.index: false`.

**Codebase shape (2026-11-17):** `src/App.tsx` **4663 lines** (all pages in one file), `src/engine/rules.ts` 1015, `src/engine/opponentEngine.ts` 367 (+ an uncommitted item-30 rework in the working tree — do not commit until the engine plays right), `src/lib/supabaseClient.ts` 92, `src/main.tsx` 10, `src/index.css` 49. Exactly **one `export default`** (`App`, imported by `main.tsx`); **no classes and no enums anywhere** — TO_DO 46e is satisfied by the codebase. 7 SQL migrations in `supabase/migrations/`. **Engine diagnostics** (until vitest exists): `_to_delete/diag30.mjs`, `regress30.mjs`, `replay30.mjs` — run with `node --experimental-transform-types _to_delete/<script>.mjs`; they copy the engine into `tmp_engine/` and load canonical geometry from `src/imports/otgruzka_figures.json`.

**Reading `.docx` reliably:** `unzip` the file and parse `word/document.xml` (node script; **python3 is not available in the DeepAI Code chat on this machine** — the extraction must run inside the project directory). Read `w:color` to detect the red DONE marker (`EE0000`), `w:numId`/`w:ilvl` to reconstruct true multi-level numbering (sub-lists render as 30a–g, 44a–h, 46a–f), and `word/comments.xml` for Word comments. `tools/Check-Todo.ps1` + `TO_DO_report.md` in artifacts are the scheduled checker (item 9); the script still mis-numbered a plain line break as item 11 once — verify numbers against the file.

**Document-reading limitations (2026-10-09):** `design_system_v1_2.pdf` **yields no extractable text** (images only) — tokens were recovered from the `.docx` version, which is enough; a separate `.md` rendering of DS v1.2 is **not needed**.

**Web fetch limitations:** puzzlestow.com and slept-daisy-01090878.figma.site **both block automated fetchers** — screenshots or pasted HTML are the reliable alternative.

**Model selector:** set **globally**, not per-project (Sergey's note, 2026-09).

**Installing skills:** the `npx skills` CLI (`vercel-labs/skills`, ecosystem at skills.sh) installs globally into coding-agent folders on disk (`~/.claude/skills`, `~/.codex/skills`, ~40 more) — those paths are read-only in this app and register nothing here. The app's own global-install path is saving the skill (`save_skill`), which makes it available across all projects. `find-skills` was installed this way (2026-10-02).

**Why:** half of the friction in past sessions came from assuming a connector or fetch would work. **How to apply:** probe connector availability at the start of a session; if a repo read is needed, ask for an upload rather than attempting web/GitHub fetch.
