// PuzzleStow opponent engine — TO_DO.docx item 7 (2026-09-06).
//
// Naming note (Site_Fix_Request_v3 Part B, "Terminology correction"): this is
// deliberately never called "AI" anywhere it's surfaced in copy — it's a
// standard, deterministic algorithmic engine. The type/function names below
// follow that rule.
//
// Design goals from TO_DO item 7:
//  - flexible / configurable (difficulty presets, tunable win-rate target)
//  - reusable across surfaces (Practice, Sandbox, this /devtest page, and later
//    a real backend or Telegram bot — see the note at the bottom)
//  - aware of opponent qualification tier (a tier can be mapped to a difficulty)
//  - gives the human player a real chance to win — ~30% engine win rate is the
//    starting target at "medium" difficulty, per the owner's TO_DO note.
//    Placement is deterministic, not a random/best-move coin flip: every
//    difficulty scans legal placements in the same human-like order (from the
//    far end of the floor row toward the A0 entrance, bottom row before moving
//    up) and differs only in how many of those it's willing to compare before
//    committing -- see decidePlacement below. `targetWinRate` is still exposed
//    as a descriptive label, not a proven statistical guarantee -- actual win
//    rates need real playtesting/simulation to calibrate.
//  - includes a legality checker (delegates to rules.ts) and fair-play handling
//  - clean, encapsulated output interface: every decision is a small, named,
//    serializable object (EngineDecision), not a direct UI/DOM call — see the
//    note at the bottom on why that matters for future exposure.

import type { FigureDef, Cells } from './rules'
import { enumeratePlacements, scorePlacement } from './rules'

export type Difficulty = 'easy' | 'medium' | 'hard'

// Rough tier → difficulty mapping (PairSec_Спецификация_Final_2026.docx §7.1.6
// ladder), for callers that want to scale the engine to the human's qualification
// rather than pick a difficulty by hand. Adjust freely — this is a starting point.
export const TIER_DIFFICULTY: Record<string, Difficulty> = {
  UnderLodar: 'easy', Lodar: 'easy',
  MidLod: 'medium', 'Senior Lodar': 'medium',
  LeadLod: 'hard', MasterLod: 'hard', ProfiLod: 'hard',
}

interface Preset { targetWinRate: number; fairPlayThreshold: number }

const PRESETS: Record<Difficulty, Preset> = {
  easy:   { targetWinRate: 0.15, fairPlayThreshold: 0.75 },
  medium: { targetWinRate: 0.30, fairPlayThreshold: 0.65 }, // TO_DO item 7 baseline
  hard:   { targetWinRate: 0.55, fairPlayThreshold: 0.55 },
}

const PHRASES = {
  request: ['Requesting {fig}.', 'Send over {fig} next.', 'Load {fig}.'],
  fairPlayAccept: ['Agreed — leave it as is.', "Fine by me, that's fair play."],
  fairPlayDecline: ['No — replace it under the 50% rule.'],
  noMove: ["I've got nowhere to put that. Your point."],
  moved: ['Placed.'],
} as const

function pick<T>(list: readonly T[]): T { return list[Math.floor(Math.random() * list.length)] }
function say(template: string, figLabel: string) { return template.replace('{fig}', figLabel) }

export interface EngineConfig {
  difficulty: Difficulty
  targetWinRate?: number // override the preset's default
}

// A decision is data, never an action — the caller (the /devtest page today;
// potentially a server or a Telegram bot handler later) applies it. See the
// bottom-of-file note.
export type EngineDecision =
  | { kind: 'request'; figureId: number; message: string }
  | { kind: 'place'; cells: Cells; message: string }
  | { kind: 'pass'; message: string } // no legal placement — engine loses this exchange
  | { kind: 'fair_play_response'; approve: boolean; message: string }

export interface OpponentEngine {
  readonly difficulty: Difficulty
  readonly targetWinRate: number
  chooseFigureToRequest(available: FigureDef[], humanLastRequestedId: number | null): EngineDecision
  decidePlacement(figure: FigureDef, filled: Set<string>, rows: number): EngineDecision
  respondToFairPlay(overhangRatioValue: number): EngineDecision
}

// Scans legal placements the way a competent human would: start at the far end of
// the floor row (deepest into the container, away from the A0 entrance at the
// bottom-left) and sweep back toward the entrance, only spilling onto the row
// above once the one below is effectively full. This is purely an ORDERING over
// placements `enumeratePlacements` already confirmed legal -- it doesn't judge
// quality, `scorePlacement` still does that where a tier calls for it.
function orderCandidatesLikeAHuman(candidates: Cells[]): Cells[] {
  const key = (cells: Cells): [number, number] => [
    Math.max(...cells.map(([r]) => r)), // higher r = closer to the floor row
    Math.max(...cells.map(([, c]) => c)), // higher c = farther from the A0 entrance
  ]
  return [...candidates].sort((a, b) => {
    const [ar, ac] = key(a)
    const [br, bc] = key(b)
    return br - ar || bc - ac
  })
}

// Every difficulty picks from the SAME scan order above -- what changes is how many
// of those candidates it bothers comparing before committing, per the owner's spec:
// easy takes the first playable spot it finds, medium compares the first two and
// takes whichever is actually better, hard evaluates every legal placement and takes
// the single best -- still a static, one-ply score, never a simulation of future
// moves.
function pickByTier(difficulty: Difficulty, ordered: Cells[], filled: Set<string>, rows: number): Cells {
  if (difficulty === 'easy') return ordered[0]
  if (difficulty === 'medium') {
    const first = ordered[0]
    const second = ordered[1]
    return second && scorePlacement(second, filled, rows) > scorePlacement(first, filled, rows) ? second : first
  }
  return ordered.reduce((best, c) => (scorePlacement(c, filled, rows) > scorePlacement(best, filled, rows) ? c : best))
}

export function createOpponentEngine(config: EngineConfig): OpponentEngine {
  const preset = PRESETS[config.difficulty]
  const targetWinRate = config.targetWinRate ?? preset.targetWinRate

  return {
    difficulty: config.difficulty,
    targetWinRate,

    chooseFigureToRequest(available, humanLastRequestedId) {
      // "Защита от дурака" (TO_DO item 2 / MVP_Rules.docx): never request the
      // same figure the human last requested of the engine.
      const pool = available.filter(f => f.id !== humanLastRequestedId)
      const choice = pick(pool.length ? pool : available)
      return { kind: 'request', figureId: choice.id, message: say(pick(PHRASES.request), choice.label) }
    },

    decidePlacement(figure, filled, rows) {
      const candidates = enumeratePlacements(figure, filled, rows)
      if (!candidates.length) return { kind: 'pass', message: pick(PHRASES.noMove) }
      const ordered = orderCandidatesLikeAHuman(candidates)
      const chosen = pickByTier(config.difficulty, ordered, filled, rows)
      return { kind: 'place', cells: chosen, message: pick(PHRASES.moved) }
    },

    respondToFairPlay(overhangRatioValue) {
      const approve = overhangRatioValue <= preset.fairPlayThreshold
      return { kind: 'fair_play_response', approve, message: pick(approve ? PHRASES.fairPlayAccept : PHRASES.fairPlayDecline) }
    },
  }
}

// ── Forward-looking note (TO_DO item 7: "take into account new Telegram API") ──
// Telegram's Aug 2026 13th-anniversary release added ephemeral, per-user
// Buttons-in-Messages interactions and Member Tags (see backlog note in
// PuzzleStow_Site_Fix_Request_v3.md). Because every engine decision here is a
// plain, serializable object rather than a direct UI call, a Telegram bot
// handler could map `fair_play_response` prompts onto an ephemeral per-user
// button (so a fair-play confirmation doesn't spam the rest of a shared group
// chat) without touching this module at all — it would just consume
// EngineDecision the same way the /devtest page does. That integration itself
// is out of scope here; this is just why the interface is shaped this way.
