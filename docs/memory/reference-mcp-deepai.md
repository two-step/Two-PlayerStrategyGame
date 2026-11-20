---
name: reference-mcp-deepai
description: "How MCP actually works in DeepAI Code (the first client where it works) — config location, format, PowerShell BOM trap, per-server notes (Supabase/Composio/context7), verification recipe"
metadata:
  node_type: memory
  type: reference
  modified: 2026-11-20T00:00:00.000Z
---

# MCP in DeepAI Code — verified working (2026-11-20)

DeepAI Code Desktop is **the first client where MCP actually works** for this project
(past sessions on Claude Code / Copilot never surfaced MCP tools). It embeds the pi
coding agent via SDK.

## Where the config lives (the key discovery)

The desktop overrides pi's config directory:

```
PI_CODING_AGENT_DIR = C:\Users\two-s\.deepai-code\userdata\deepai\pi\deepai
```

So MCP servers must be configured in **`<PI_CODING_AGENT_DIR>\mcp.json`**.

- `~/.pi/agent/mcp.json` (the default pi location) is **ignored** by the desktop.
- A project-root `.mcp.json` is **also not read** by the desktop; the repo's obsolete
  `.mcp.json` (context7 + placeholders) was deleted by Sergey on 2026-11-20.

## Format (canonical pi `mcp.json`)

```json
{
  "mcpServers": {
    "supabase":  { "url": "https://mcp.supabase.com/mcp", "exposure": "deferred" },
    "composio":  { "url": "https://connect.composio.dev/mcp",
                   "headers": { "x-consumer-api-key": "…your key…" },
                   "exposure": "deferred" },
    "context7":  { "command": "npx", "args": ["-y", "@upstash/context7-mcp"],
                   "env": { "CONTEXT7_API_KEY": "…" }, "exposure": "deferred" }
  }
}
```

Nuances:

- **OAuth servers need no key at all** (Supabase): pi detects the auth requirement and
  offers a sign-in flow; the token is stored in `<PI_CODING_AGENT_DIR>\auth.json` and
  refreshed automatically. Do not add `auth`/`lifecycle`/`transport` fields — they are
  not part of this format (web-era leftovers).
- **`exposure: "deferred"` is recommended** for desktop use: server tools then surface
  through `tool_search` (`mcp__<server>__*`). The default `codemode` exposure does not
  activate in the desktop (codemode tool is not active there), so tools would be
  unreachable.
- Keys may live in `headers`/`env` values — the file is outside any git repo.

## PowerShell BOM trap (cost an hour)

`Set-Content -Encoding utf8` in Windows PowerShell 5.1 writes a **BOM**, and pi's JSON
parser rejects it: `Unexpected token '﻿'`. Fix — write without BOM:

```powershell
$t = [IO.File]::ReadAllText($p).TrimStart([char]0xFEFF)
[IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))
```

## Verification recipe (after config change + app restart)

1. `tool_search` for `mcp__<server>__…` — tools appear only after the restart that
   follows a config change; sessions started earlier never see them.
2. No `mcp.log` in `<PI_CODING_AGENT_DIR>` means pi never attempted connections →
   config is not being read (wrong location) or failed to parse (BOM).
3. A parse failure is reported to the user as an info notification
   («message config error: … is not valid JSON») — easy to miss; watch for it.
4. The `pi` CLI is not on PATH in this desktop setup; `pi mcp list` is unavailable.
   The `/mcp` panel produced no visible output in the desktop either — rely on 1–3.

## Servers configured as of 2026-11-20

| Server | Auth | Notes |
|---|---|---|
| **supabase** | OAuth (sign-in done) | project ref `ioogpxkyckukduzzvjot`; SQL/`apply_migration`/notebooks/logs callable directly from the chat — no more manual SQL Editor for migrations |
| **composio** | `x-consumer-api-key` header | **aggregator**: practically any SaaS connects through its login window; GitHub already connected under Sergey's account `two-step` (internal alias `github_mayey-riving` — cosmetic name only) |
| **context7** | API key in `env` | current library docs (`resolve_library_id`, `query_docs`) |

## Composio usage nuance

Composio acts as a **meta-MCP**: one connection covers many toolkits, and new apps are
added by an OAuth login window rather than config edits. Prefer dedicated tools
(`COMPOSIO_SEARCH_TOOLS` → schemas → execute). For repo code work prefer local git —
Composio-GitHub is for issues/PRs/meta, not for cloning (the repo is local; web/GitHub
fetch of it has failed in past sessions and is prohibited by AGENTS.md).

**Why this file exists:** a full session (2026-11-20) was spent discovering the config
location and the BOM trap. **How to apply:** never assume MCP config edits take effect
without an app restart; verify with `tool_search`; write the JSON without BOM.
