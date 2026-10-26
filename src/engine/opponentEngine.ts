// PuzzleStow opponent engine — TO_DO.docx item 7 (2026-09-06), reworked for
// TO_DO.docx item 30 (2026-10-09): «Улучшить, усилить игровой энжин соперника
// на игровой странице».
//
// Naming note (Site_Fix_Request_v3 Part B, "Terminology correction"): this is
// deliberately never called "AI" anywhere it's surfaced in copy — it's a
// standard, deterministic algorithmic engine. The type/function names below
// follow that rule.
//
// TO_DO item 30 spec, sub-item by sub-item:
//  - «Это не AI, но и не тупой движок. Он может делать вычисления и
//    планировать дальнейшие ходы.» — the three levels below differ in planning
//    depth, not just in how many static scores they compare.
//  - «Начинает установку грузов с правого нижнего угла контейнера.» —
//    orderCandidatesLikeAHuman (far end of the floor row, back toward A0).
//  - «При установке до последнего избегает возможность создания „мёртвых"
//    ячеек, оставляя ряды „в игре" для последующего закрытия. Для этого может
//    оставлять пустые места справа под будущие ходы, учитывая возможность
//    запроса на различные фигуры.» — filterOutDeadCellCreatingPlacements plus
//    the notches-and-gaps heuristic (scorePlacement's heightVariance/touching
//    and chooseFigureToRequest's shape-aware request logic).
//  - «Не загромождает пространство у входа.» — scorePlacement's
//    entranceHeight term and hasReturnPath filtering in enumeratePlacements.
//  - «Использует вращение фигур для более компактной установки.» —
//    enumeratePlacements already tries every distinct orientation.
//  - «Старается оставлять высоту ступеней <4 ячеек.» — scorePlacement's
//    stepPenalty (TO_DO 30, added 2026-10-09).
//  - «1-ый уровень соблюдает вышеуказанные правила; 2-ой планирует также
//    следующий ход; 3-ий старается смотреть на два хода вперёд.» — see
//    LEVEL_BEHAVIOR below: level 1 places greedily by the rules above, level 2
//    evaluates every legal placement THIS move and keeps the board flexible
//    for one follow-up figure, level 3 additionally simulates a two-move
//    horizon over follow-up figures.
//
// Design goals carried over from TO_DO item 7:
//  - flexible / configurable (difficulty presets, tunable win-rate target)
//  - reusable across surfaces (Practice, Sandbox, this /devtest page, and later
//    a real backend or Telegram bot — see the note at the bottom)
//  - aware of opponent qualification tier (a tier can be mapped to a difficulty)
//  - gives the human player a real chance to win — ~30% engine win rate is the
//    starting target at "medium" difficulty, per the owner's TO_DO note.
//    `targetWinRate` is still exposed as a descriptive label, not a proven
//    statistical guarantee -- actual win rates need real playtesting/simulation
//    to calibrate.
//  - includes a legality checker (delegates to rules.ts) and fair-play handling
//  - clean, encapsulated output interface: every decision is a small, named,
//    serializable object (EngineDecision), not a direct UI/DOM call — see the
//    note at the bottom on why that matters for future exposure.

import type { FigureDef, Cells } from './rules'
import { enumeratePlacements, scorePlacement, computeDeadCells, closedRows, closedCols, cellKey, COLS } from './rules'

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

// Board snapshot the caller supplies so the engine can plan (TO_DO 30). Every
// field is optional: what's absent simply disables that piece of planning, so
// wiring more context in is always additive and old callers keep working.
export interface EngineBoardContext {
  // Container geometry in play (UnderLodar 15×11 vs competitive 15×10) — needed
  // wherever placements are enumerated outside decidePlacement's own `rows`.
  rows?: number
  // The engine's own board as it stands — request planning (medium/hard) picks
  // figures that still fit productively HERE.
  ownFilled?: Set<string>
  // Figures still requestable for the ENGINE's own container, AFTER applying the
  // anti-repeat rule — what the engine could realistically receive next.
  ownAvailable?: FigureDef[]
  // The human's board — hard-level request planning deprioritizes figures that
  // hand them an immediate row closure and boosts ones they can't place at all.
  humanFilled?: Set<string>
  // Figures still requestable for the HUMAN (what the engine might be forced to
  // give next, used by the hard level's "starve their future" reasoning).
  humanAvailable?: FigureDef[]
}

export interface OpponentEngine {
  readonly difficulty: Difficulty
  readonly targetWinRate: number
  chooseFigureToRequest(available: FigureDef[], humanLastRequestedId: number | null, context?: EngineBoardContext): EngineDecision
  decidePlacement(figure: FigureDef, filled: Set<string>, rows: number, context?: EngineBoardContext): EngineDecision
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

// Filters out any candidate that grows the dead-cell count beyond what it already
// is -- i.e. drops placements that wall off previously-reachable cells for no
// immediate row/column payoff. Falls back to the full candidate list only when
// literally every legal placement creates new dead cells (unavoidable).
function filterOutDeadCellCreatingPlacements(candidates: Cells[], filled: Set<string>, rows: number): Cells[] {
  const baseline = computeDeadCells(filled, rows).size
  return candidates.filter(cells => {
    const next = new Set(filled)
    cells.forEach(([r, c]) => next.add(cellKey(r, c)))
    return computeDeadCells(next, rows).size <= baseline
  })
}

function applyCells(filled: Set<string>, cells: Cells): Set<string> {
  const next = new Set(filled)
  cells.forEach(([r, c]) => next.add(cellKey(r, c)))
  return next
}

// How "closeable" the board still is: every empty-and-not-dead cell in an
// UNclosed row keeps that row in play; cells stranded in dead-locked rows are
// weightless. Used as the flexibility measure for the planning levels — the
// engine wants moves that leave the maximum amount of row-closable space.
function closeableVacancy(filled: Set<string>, rows: number): number {
  const dead = computeDeadCells(filled, rows)
  const closedR = closedRows(filled, rows, dead)
  const closedC = closedCols(filled, rows, dead)
  let n = 0
  for (let r = 0; r < rows; r++) {
    if (closedR.has(r)) continue
    for (let c = 0; c < COLS; c++) {
      if (!filled.has(cellKey(r, c)) && !dead.has(cellKey(r, c))) n++
    }
  }
  // Columns already closed don't strand row cells by themselves (a closed column
  // means every one of its cells is filled), so only the row loop needs the
  // closedC guard in the sense of counting vacancies per row; column closure is
  // reflected by filled cells already. closedC is read here to keep the signature
  // honest for future use (vertical-closure planning) at zero cost.
  void closedC
  return n
}

// ── Level behavior (TO_DO 30: 1 = rules only, 2 = plan next move, 3 = look two
// moves ahead) ─────────────────────────────────────────────────────────────────
//
// Level semantics, concrete:
//  - easy   (1st): first candidate in human order, subject to the shared
//    never-create-dead-cells baseline. No scoring, no lookahead.
//  - medium (2nd): "plans the next move" — evaluates EVERY legal placement with
//    scorePlacement and, among the top scorers, prefers the one whose resulting
//    board leaves the most flexibility for the figures it could realistically
//    be handed next (ownAvailable): the placement that keeps the most
//    not-yet-closed-row vacancies alive AND can still accept the largest share
//    of its potential next figures.
//  - hard   (3rd): "tries to look two moves ahead" — starts from the same
//    everywhere-scan as medium, but the flexibility measure becomes
//    two-ply: for each candidate it (a) checks the best achievable
//    closeable-vacancy after placing the candidate AND one more figure from the
//    plausible-next set (greedy inner max over a sample of follow-up figures),
//    and (b) if humanAvailable is provided, subtracts a term for follow-up
//    figures that would leave the HUMAN with an immediate row-closure
//    opportunity the engine can't answer. Computationally bounded: the inner
//    follow-up set is capped (FOLLOWUP_SAMPLE) and inner placements come from
//    the same enumeratePlacements the engine already trusts.
const FOLLOWUP_SAMPLE = 5

function canAcceptAnywhere(fig: FigureDef, filled: Set<string>, rows: number): boolean {
  return enumeratePlacements(fig, filled, rows).length > 0
}

// Best single follow-up score reachable on `filled` from the sampled next
// figures — the two-ply core of the hard level. Returns the max over the sample
// of (best static score for that figure, or -Infinity if it has no legal
// placement at all).
function bestFollowUpScore(sample: FigureDef[], filled: Set<string>, rows: number): number {
  let best = -Infinity
  for (const fig of sample) {
    const cands = enumeratePlacements(fig, filled, rows)
    for (const cells of cands) {
      const s = scorePlacement(cells, filled, rows)
      if (s > best) best = s
    }
    if (best === Infinity) break
  }
  return best
}

// Score a candidate placement for the planning levels: static quality now +
// flexibility value of the board it leaves behind.
function plannedScore(cells: Cells, filled: Set<string>, rows: number, context?: EngineBoardContext): number {
  const next = applyCells(filled, cells)
  const staticScore = scorePlacement(cells, filled, rows)
  const vacancy = closeableVacancy(next, rows)

  const ownAvail = context?.ownAvailable
  if (!ownAvail || ownAvail.length === 0) {
    // No planning context: static score + raw flexibility. Still better than the
    // pre-30 medium (which compared only two candidates) because the caller
    // feeds the whole ordered list here.
    return staticScore + vacancy * 0.5
  }

  // Share of plausible next figures still placeable after this move.
  const sample = ownAvail.slice(0, FOLLOWUP_SAMPLE)
  let placeable = 0
  for (const fig of sample) if (canAcceptAnywhere(fig, next, rows)) placeable++
  const placeableShare = sample.length ? placeable / sample.length : 0

  if (context?.humanAvailable && context.humanAvailable.length > 0) {
    // Hard level's second ply: also weigh what this does to the human's options —
    // a strong move leaves them figures that close nothing while keeping the
    // engine's own closure chances intact.
    const humanSample = context.humanAvailable.slice(0, FOLLOWUP_SAMPLE)
    let humanThreats = 0
    for (const fig of humanSample) {
      const cands = enumeratePlacements(fig, next, rows)
      for (const hcells of cands) {
        if (scorePlacement(hcells, next, rows) > 900) { humanThreats++; break } // ~immediate row closure
      }
    }
    const threatShare = humanSample.length ? humanThreats / humanSample.length : 0
    const followUp = bestFollowUpScore(sample, next, rows)
    return staticScore + vacancy * 0.5 + placeableShare * 300 + Math.max(0, Math.min(followUp, 2000)) * 0.1 - threatShare * 400
  }

  return staticScore + vacancy * 0.5 + placeableShare * 300
}

function pickByLevel(difficulty: Difficulty, ordered: Cells[], filled: Set<string>, rows: number, context?: EngineBoardContext): Cells {
  if (difficulty === 'easy') return ordered[0]
  // medium / hard: evaluate every candidate with the planning score. The level
  // difference lives in the CONTEXT the caller passes (hard callers supply
  // humanAvailable too) and in plannedScore's human-branch above — same scan,
  // deeper reasoning.
  return ordered.reduce((best, c) => (plannedScore(c, filled, rows, context) > plannedScore(best, filled, rows, context) ? c : best))
}

// ── Figure requests (TO_DO 30: «учитывая возможность запроса на различные
// фигуры» — requests are tied to what actually still fits, both sides) ─────────
//
// easy: random (the old behavior), only honoring the anti-repeat rule.
// medium: among the available figures, prefer ones the engine can still place
// productively (has legal placements that score decently) — avoids requesting a
// figure it will immediately have to pass on.
// hard: medium's placement-fit filter plus a deny component: figures that give
// the HUMAN an immediate strong placement (row closure) are deprioritized, and
// figures the human CANNOT place anywhere are boosted (a forced pass ends the
// game in the engine's favor per the no-legal-move rule).
function requestScore(fig: FigureDef, filled: Set<string>, rows: number, humanFilled: Set<string> | undefined, difficulty: Difficulty): number {
  const cands = enumeratePlacements(fig, filled, rows)
  const bestOwn = cands.reduce((m, cells) => Math.max(m, scorePlacement(cells, filled, rows)), -Infinity)
  if (bestOwn === -Infinity) return -Infinity // engine cannot place it at all — never ask for it
  let score = bestOwn
  if (difficulty === 'hard' && humanFilled) {
    const humanCands = enumeratePlacements(fig, humanFilled, rows)
    if (!humanCands.length) return score + 5000 // human must pass → engine wins
    const bestHuman = humanCands.reduce((m, cells) => Math.max(m, scorePlacement(cells, humanFilled, rows)), -Infinity)
    if (bestHuman > 900) score -= 3000 // hands them a row closure — avoid
    score -= Math.max(0, Math.min(bestHuman, 2000)) * 0.2
  }
  return score + Math.random() * 400 // tie-break jitter so repeated requests aren't deterministic
}

export function createOpponentEngine(config: EngineConfig): OpponentEngine {
  const preset = PRESETS[config.difficulty]
  const targetWinRate = config.targetWinRate ?? preset.targetWinRate

  return {
    difficulty: config.difficulty,
    targetWinRate,

    chooseFigureToRequest(available, humanLastRequestedId, context) {
      // "Защита от дурака" (TO_DO item 2 / MVP_Rules.docx): never request the
      // same figure the human last requested of the engine.
      const pool = available.filter(f => f.id !== humanLastRequestedId)
      const usable = pool.length ? pool : available
      if (usable.length === 0) return { kind: 'pass', message: pick(PHRASES.noMove) }
      if (config.difficulty === 'easy' || !context?.ownFilled) {
        const choice = pick(usable)
        return { kind: 'request', figureId: choice.id, message: say(pick(PHRASES.request), choice.label) }
      }
      const rows = context.rows ?? 10
      const scored = usable
        .map(f => ({ f, s: requestScore(f, context.ownFilled!, rows, context.humanFilled, config.difficulty) }))
        .filter(x => x.s > -Infinity)
        .sort((a, b) => b.s - a.s)
      const choice = (scored[0] ?? { f: pick(usable) }).f
      return { kind: 'request', figureId: choice.id, message: say(pick(PHRASES.request), choice.label) }
    },

    decidePlacement(figure, filled, rows, context) {
      const candidates = enumeratePlacements(figure, filled, rows)
      if (!candidates.length) return { kind: 'pass', message: pick(PHRASES.noMove) }
      // Baseline "skill" applied to EVERY difficulty, including easy (which otherwise
      // just grabs ordered[0] with no scoring at all): never seal off a cell that was
      // still reachable, unless every legal placement does. Pure geometry via
      // computeDeadCells (no figure-availability reasoning) -- this is what stops the
      // "figure 27 jammed into the corner, walling off two cells for nothing" move the
      // owner flagged, at every skill level, not just medium/hard.
      const nonDeadCreating = filterOutDeadCellCreatingPlacements(candidates, filled, rows)
      const pool = nonDeadCreating.length ? nonDeadCreating : candidates
      const ordered = orderCandidatesLikeAHuman(pool)
      const chosen = pickByLevel(config.difficulty, ordered, filled, rows, context)
      return { kind: 'place', cells: chosen, message: pick(PHRASES.moved) }
    },

    respondToFairPlay(overhangRatioValue) {
      const approve = overhangRatioValue <= preset.fairPlayThreshold
      return { kind: 'fair_play_response', approve, message: pick(approve ? PHRASES.fairPlayAccept : PHRASES.fairPlayDecline) }
    },
  }
}

// (chooseFigureToRequest needs a row count to enumerate placements; callers
// that don't supply `rows` in the context get the competitive 15×10 default —
// see EngineBoardContext.rows.)
