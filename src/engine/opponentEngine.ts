// PuzzleStow opponent engine — TO_DO.docx item 30 (reworked 2026-11-17).
// «Улучшить, усилить игровой движок соперника на игровой странице».
//
// Level semantics (Sergey, 2026-11-17): difficulty is a TRAINING STAGE, not
// stupidity. Every level knows the rules (44a–h) and the basic goal of the
// game — there are TWO containers, each player closes rows in their own one;
// win by being first to close 5 rows (or more), and the fewer rows the
// opponent closes, the better. So even level 1 already plays the goal:
// it keeps its own board flexible and does NOT hand the human convenient
// figures. What changes with the level is planning depth only:
//   easy   (1st): obeys the rules + the basic goal; no lookahead.
//   medium (2nd): also plans the next move (one-ply flexibility scoring).
//   hard   (3rd): looks two moves ahead (bounded second-ply valuation).
//
// This is deliberately never called "AI" anywhere it is surfaced (see
// Site_Fix_Request_v3 Part B) — a deterministic algorithmic engine.
//
// TO_DO item 30 spec, sub-item by sub-item:
//  - «Начинает установку грузов с правого нижнего угла контейнера.» —
//    orderCandidatesLikeAHuman (far end of the floor row, back toward A0).
//  - «До последнего избегает "мёртвых" ячеек, оставляя ряды "в игре"... может
//    оставлять пустые места справа под будущие ходы.» — the dead-cell filter
//    plus the floor-flexibility metric added 2026-11-17 (see floorFlexibility).
//  - «Не загромождает пространство у входа.» — scorePlacement's entrance
//    preference plus the rules engine's legal return-path check.
//  - «Использует вращение фигур для более компактной установки.» — every
//    candidate comes from enumeratePlacements across distinct orientations.
//  - «Старается оставлять высоту ступеней <4 ячеек.» — scorePlacement's
//    stepPenalty and healthyStepCount; A is bottom, entrance A0 at column 0.
//  - Levels 1/2/3 — see the semantics block above.
//
// What was WRONG before this rework (Sergey's live-game critique, 2026-11-17):
//  1. Requests reasoned about the engine's OWN board (ownFilled) — the
//     requested figure goes into the HUMAN's container, so handover decisions
//     must reason about humanFilled/humanAvailable. That is what made the
//     engine «выкладывать удобные фигуры».
//  2. Ties fell to the available-figures order (ascending id) — the rigid
//     F01→F05 request template. Near-equal choices are now drawn randomly.
//  3. Nothing measured "how many DIFFERENT remaining figures can still close
//     each open floor cell" — after 16B12 the A13 cell could be closed only
//     by F01/F02 («отсекаем ряд А»). floorFlexibility measures exactly that.

import type { FigureDef, Cells } from './rules'
import { enumeratePlacements, enumerateAllLegal, canPlaceAnywhere, canPlaceCovering, scorePlacement, computeDeadCells, closedRows, closedCols, cellKey, colHeights, COLS, hasReturnPath, overhangRatio, reachableCells, reachableCellsForWidth } from './rules'

export type Difficulty = 'easy' | 'medium' | 'hard'

// Rough tier → difficulty mapping (qualification ladder), for callers that
// want to scale the engine to the human's qualification. Adjust freely.
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

// Tuning constants (TO_DO 30 scoring). ROW_CLOSE_SCORE mirrors scorePlacement's
// rowGain of 1000 per closed row/column.
const PLANNING_CANDIDATE_LIMIT = 4
const STRATEGIC_CANDIDATE_LIMIT = 8
const FOLLOWUP_SAMPLE = 3
const REQUEST_TIE_EPSILON = 25 // handover choices within this band count as ties → random draw
const FLEX_BONUS = 150 // flexibility is a 0..1 providers-ratio (1 = every fragile floor cell broadly servable)
const LOCK_BONUS = 10000 // handing the human a figure with no legal placement ends the game in our favor
const ROW_CLOSE_SCORE = 900 // a placement scoring above this effectively closes a row/column

function pick<T>(list: readonly T[]): T { return list[Math.floor(Math.random() * list.length)] }
function say(template: string, figLabel: string) { return template.replace('{fig}', figLabel) }

export interface EngineConfig {
  difficulty: Difficulty
  targetWinRate?: number // override the preset's default
}

// A decision is data, never an action — the caller (the test page today; a
// server or a Telegram bot handler later) applies it.
export type EngineDecision =
  | { kind: 'request'; figureId: number; message: string }
  | { kind: 'place'; cells: Cells; message: string }
  | { kind: 'pass'; message: string } // no legal placement — engine loses this exchange
  | { kind: 'fair_play_response'; approve: boolean; message: string }

// Board snapshot the caller supplies so the engine can plan (TO_DO 30). Every
// field is optional: what's absent simply disables that piece of planning, so
// wiring more context in is always additive and old callers keep working.
export interface EngineBoardContext {
  // Container geometry in play (UnderLodar 15×11 vs competitive 15×10).
  rows?: number
  // The engine's own board as it stands — placement planning reasons here.
  ownFilled?: Set<string>
  // Figures still available for the ENGINE's own container (its future loads).
  ownAvailable?: FigureDef[]
  // The HUMAN's board — handover decisions reason here at EVERY level.
  humanFilled?: Set<string>
  // Figures still available for the HUMAN (what we are choosing from is a
  // subset of these; hard level also plans the denial two figures ahead).
  humanAvailable?: FigureDef[]
}

export interface OpponentEngine {
  readonly difficulty: Difficulty
  readonly targetWinRate: number
  // Picks the figure to hand the human: they will have to place it in THEIR
  // container, so this is a denial decision, not a self-serving one.
  chooseFigureToRequest(available: FigureDef[], humanLastRequestedId: number | null, context?: EngineBoardContext): EngineDecision
  decidePlacement(figure: FigureDef, filled: Set<string>, rows: number, context?: EngineBoardContext): EngineDecision
  respondToFairPlay(overhangRatioValue: number): EngineDecision
}

// ── Shared placement-planning helpers ────────────────────────────────────────

// Scans legal placements the way a competent human would: start at the far end
// of the floor row (deepest into the container, away from the A0 entrance at
// the bottom-left) and sweep back toward the entrance. Pure ordering over
// placements enumeratePlacements already confirmed legal (TO_DO 30c).
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

// Drops placements that wall off previously-reachable cells (rule 44f cells
// are permanent, so creating them wastes the board). Falls back to the full
// list only when literally every legal placement creates new dead cells.
// EXCEPTION — Sergey, 2026-11-19 (canon ruling on sacrificing a row): «умение
// пожертвовать рядом — радикальное увеличение последующих вариантов... в
// критической ситуации отдаём ряд, создавая своим ходом мёртвую клетку».
// The critical symptoms he named — a pit over 4 cells deep or a step taller
// than 4 (healthyStepCount > 0, TO_DO 30g's own terrain metric) — mean the
// surface must be LEVELLED, and levelling is exactly the kind of move that
// strands cells while cutting the giant step down. So once the board is
// critical, dead-cell-creating candidates stay in the pool and compete on
// score (plannedScore halves the sacrifice penalties and doubles the
// tall-step term in that state).
function filterOutDeadCellCreatingPlacements(candidates: Cells[], filled: Set<string>, rows: number): Cells[] {
  if (healthyStepCount(filled, rows) > 0) return candidates // critical terrain: the sacrifice is sanctioned
  const baseline = computeDeadCells(filled, rows).size
  return candidates.filter(cells => {
    const next = applyCells(filled, cells)
    return computeDeadCells(next, rows).size <= baseline
  })
}

function applyCells(filled: Set<string>, cells: Cells): Set<string> {
  const next = new Set(filled)
  cells.forEach(([r, c]) => next.add(cellKey(r, c)))
  return next
}

// Counts open cells that were loader-reachable before the move and are neither filled
// nor reachable after it — the practical measure of cut-off delivery territory
// (see TERRITORY_LOSS). reachableCells is memoized per board signature in rules.ts,
// so the two floods are cheap on the engine's per-candidate path.
function countStrandedTerritory(before: Set<string>, next: Set<string>, rows: number): number {
  const reachBefore = reachableCells(before, rows)
  const reachAfter = reachableCells(next, rows)
  let stranded = 0
  for (const spot of reachBefore) {
    if (!next.has(spot) && !reachAfter.has(spot)) stranded++
  }
  return stranded
}

// Both walk-canon territory deltas from ONE pair of memoized floods (the engine's
// per-candidate hot path — four floods per candidate cost ~1 s/move on easy).
function territoryDelta(before: Set<string>, next: Set<string>, rows: number): { stranded: number; gained: number } {
  const reachBefore = reachableCells(before, rows)
  const reachAfter = reachableCells(next, rows)
  let stranded = 0
  let gained = 0
  for (const spot of reachBefore) {
    if (!next.has(spot) && !reachAfter.has(spot)) stranded++
  }
  for (const spot of reachAfter) {
    if (!reachBefore.has(spot)) gained++
  }
  return { stranded, gained }
}

// Counts empty, non-dead cells in rows that still have a chance of closure;
// dead cells are never treated as cargo, per rule 44g. Mono-only cells (1-cell-wide
// access, see monoOnlyCount) are excluded too — keeping them open is not real
// vacancy, per Sergey's report (14) ruling.
function closeableVacancy(filled: Set<string>, rows: number): number {
  const dead = computeDeadCells(filled, rows)
  const monoOnly = reachableCellsForWidth(filled, rows, 2)
  const closedR = closedRows(filled, rows, dead)
  let n = 0
  for (let r = 0; r < rows; r++) {
    if (closedR.has(r)) continue
    for (let c = 0; c < COLS; c++) {
      if (!filled.has(cellKey(r, c)) && !dead.has(cellKey(r, c)) && monoOnly.has(cellKey(r, c))) n--
    }
  }
  return n
}

// Counts open, non-dead cells the loader can WALK to but no cargo wider than the Mono
// can reach: reachable for the loader, missed by the width-2 delivery flood. Pure
// query; the flood is memoized per board in rules.ts, so this is cheap on the
// per-candidate path.
function monoOnlyCount(filled: Set<string>, rows: number): number {
  const dead = computeDeadCells(filled, rows)
  const walk = reachableCells(filled, rows)
  const wide = reachableCellsForWidth(filled, rows, 2)
  let n = 0
  for (const spot of walk) {
    if (!filled.has(spot) && !dead.has(spot) && !wide.has(spot)) n++
  }
  return n
}

// Placement discipline (Sergey, report (14)): cells pushed into the top two rows
// (J/K, under the closed ceiling) or into the entrance shaft (column 0) cost
// CEILING_PUSH / ENTRANCE_PUSH each — unless the same placement closes a row or a
// column, in which case the finishing work earns the height.
function placementDiscipline(cells: Cells, filled: Set<string>, rows: number): number {
  const next = applyCells(filled, cells)
  const closedBefore = closedRows(filled, rows, computeDeadCells(filled, rows)).size
    + closedCols(filled, rows, computeDeadCells(filled, rows)).size
  const closedAfter = closedRows(next, rows, computeDeadCells(next, rows)).size
    + closedCols(next, rows, computeDeadCells(next, rows)).size
  if (closedAfter > closedBefore) return 0
  let cost = 0
  for (const [r, c] of cells) {
    if (r <= 1) cost += CEILING_PUSH
    if (c === 0) cost += ENTRANCE_PUSH
  }
  return cost
}

// TO_DO 30g: «старается оставлять высоту ступеней <4 ячеек» — every adjacent
// column pair at or past the 4-cell step limit is terrain no figure can cross.
function healthyStepCount(filled: Set<string>, rows: number): number {
  const heights = colHeights(filled, rows)
  let tallSteps = 0
  for (let c = 0; c + 1 < COLS; c++) if (Math.abs(heights[c] - heights[c + 1]) >= 4) tallSteps++
  return tallSteps
}

// Size-spread sample of a figure list (smallest / middle / largest) — bounds
// the cost of lookahead scoring without collapsing to a single archetype.
function sampleOf(figures: FigureDef[]): FigureDef[] {
  if (figures.length <= FOLLOWUP_SAMPLE) return figures
  const sorted = [...figures].sort((a, b) => a.size - b.size || a.id - b.id)
  const indexes = [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
  return indexes.map((index) => sorted[index]).filter((figure, index, all) =>
    all.findIndex((candidate) => candidate.id === figure.id) === index)
}

// How many SAMPLED figures still have at least one legal placement on `filled`
// (enumeratePlacements embeds every hard rule: support, overhang, reachability,
// return path) — a bounded planning estimate (TO_DO 30: «может делать
// вычисления» — bounded, not exhaustive; the size-spread sample is the same
// proxy used by the other planning terms). Precondition: `filled` is the board
// AFTER the candidate move; postcondition: pure query.
function aliveFigures(filled: Set<string>, remaining: FigureDef[], rows: number): number {
  let alive = 0
  for (const fig of sampleOf(remaining)) if (canPlaceAnywhere(fig, filled, rows)) alive++
  return alive
}

// ── Floor flexibility (TO_DO 30d, Sergey's 2026-11-17/18 critiques) ─────────
// The engine's SKILL (44e keeps the system from thinking for the PLAYER): a
// placement that leaves an open floor cell only a few of the remaining figures
// can ever cover is «практически мёртвая» space. A floor cell is FRAGILE
// («укрытая» — narrow approaches) when:
//   - the cell directly above is already built (only horizontal approaches),
//   - BOTH horizontal neighbors are built — a 1-cell pocket (Sergey,
//     2026-11-18: after 10C9A7 the A9 gap between filled A8 and A10 could be
//     closed by only 4 of ~20 remaining figures — «оставляем место справа
//     в 1 ячейку — два ряда теряем»),
//   - it is the last column (14), which must stay servable to the very end.
// The score is the WORST providers-ratio over fragile open floor cells:
// providers / remaining count, saturated at half the pool (enough is enough).
// 0 = the move strands a floor cell outright. Full remaining list, not a
// sample. Precondition: `remaining` figures are still available AFTER the
// candidate move; postcondition: pure query.
function floorFlexibility(filled: Set<string>, rows: number, remaining: FigureDef[]): number {
  const dead = computeDeadCells(filled, rows)
  const floorRow = rows - 1
  const enough = Math.ceil(remaining.length / 2)
  let worst = 1
  for (let c = 0; c < COLS; c++) {
    const key = cellKey(floorRow, c)
    if (filled.has(key) || dead.has(key)) continue
    const aboveFilled = floorRow > 0 && filled.has(cellKey(floorRow - 1, c))
    const leftFilled = c > 0 && filled.has(cellKey(floorRow, c - 1))
    const rightFilled = c < COLS - 1 && filled.has(cellKey(floorRow, c + 1))
    const sheltered = aboveFilled || (leftFilled && rightFilled) || c === COLS - 1
    if (!sheltered) continue
    let providers = 0
    for (const fig of remaining) {
      if (canPlaceCovering(fig, filled, rows, { r: floorRow, c }) && ++providers >= enough) break
    }
    if (providers === 0) return 0
    worst = Math.min(worst, providers / remaining.length)
  }
  return worst
}

// ── Pocket stranding (TO_DO 30, Sergey 2026-11-19, report 15:26) ──────────
// The engine's own move F11 11D6B8 narrowed the sky opening of its mid-air pocket
// {B4,B5,B6,C5,C6} to a 1-cell shaft (D6 filled, C4 already filled) — after that only
// the Mono could ever reach B4/B6/C6 («воздушная подушка» с проходом в 1 ячейку —
// «потеря 2 рядов и соответственно колонок»): rows B,C and columns 4,6 became
// permanently uncloseable, even though computeDeadCells (pure geometric enclosure,
// «дверь открыта — пусть пробует зайти») rightly keeps calling those cells alive.
// Engine-side consequence: an empty cell whose SAME-COLUMN sky chain is blocked
// (no vertical delivery) and which the REAL delivery model (canPlaceCovering —
// full rules minus fair-play approval) lets at most ONE remaining figure cover is
// practically dead. Each such cell costs STRAND_PENALTY (row/column-loss scale);
// a cell NO remaining figure can cover costs double. Providers stop counting at
// 2 — the stranded verdict needs nothing more, which keeps the scan cheap.
// Bounded: at most POCKET_SCAN_CAP flagged cells per call, deepest rows first.
// Precondition: `filled` is the board AFTER the candidate move; postcondition:
// pure query. This is engine valuation only — rules and dead-cell canon untouched.
const STRAND_MAX_PROVIDERS = 1 // a cell only ≤1 remaining figure can cover is practically dead
const STRAND_PENALTY = 1200 // per practically-stranded cell — losing a row/column scale
// Half of rules.ts's 1500/dead-cell: in CRITICAL terrain a levelling sacrifice is
// allowed to pay for dead cells, but only at the discounted rate (Sergey, 2026-11-19).
const DEAD_REFUND = 750
// Sergey, 2026-11-19 (report (6) hard game): the engine raised its own cols 1-4 massif
// to 6-7 (move 14, F25@25G4E2) and sealed itself off from cols 5-14 — «движок преодолел
// стену в 7 ячеек... водрузил на самом верху» — after which NO future figure can be
// delivered to the far side and every row over it can never close. A placement that
// makes previously loader-REACHABLE open cells unreachable strands TERRITORY. Rules
// canon untouched (dead cells stay pure geometry per the 2026-11-19 canon; row closure
// sees only dead cells) — this is engine-side practical accounting, like pocketStranding:
// the engine simply refuses to cut its own delivery territory.
const TERRITORY_LOSS = 150 // per open cell the loader could reach before and cannot after
const REACH_GAIN = 40 // per newly reachable open cell (ladder step before a >3 wall, pit filled to ≤3)
// Sergey, 2026-11-19 (report (14), 19:36 medium game): «опять ряды не отдаёт — будет
// упорно оставлять ячейки открытыми хотя бы для моно, хотя они уже гипотетически
// мёртвые». An open cell whose ONLY access from the entrance is a 1-cell-wide passage
// (reachableCellsForWidth(filled, rows, 2) misses it) can only ever be served by the
// Mono — and a lone Mono cell almost never closes a row. Engine-side the engine stops
// treating such cells as real vacancy and pays for keeping them open (rules canon and
// the dead-cell geometry untouched: the door stays open, checkPlacement still judges).
const MONO_ONLY_PENALTY = 250
// Sergey, 2026-11-19 (same report): «прёт вверх в потолок и загружает вход». The
// engine keeps stacking into the top rows (J/K, under the 44f closed ceiling) and into
// the entrance shaft (column 0) when nothing forces it to. Each placement cell in the
// top two rows or in column 0 costs this much unless the SAME placement closes a
// row/column — finishing work pays for height, aimless tower-building does not.
const CEILING_PUSH = 150
const ENTRANCE_PUSH = 150
const POCKET_SCAN_CAP = 16
function pocketStranding(filled: Set<string>, rows: number, remaining: FigureDef[]): number {
  const dead = computeDeadCells(filled, rows)
  let penalty = 0
  let scanned = 0
  for (let r = rows - 1; r >= 0 && scanned < POCKET_SCAN_CAP; r--) {
    for (let c = 0; c < COLS && scanned < POCKET_SCAN_CAP; c++) {
      const key = cellKey(r, c)
      if (filled.has(key) || dead.has(key)) continue
      let serviceBlocked = false
      for (let rr = r - 1; rr >= 0; rr--) if (filled.has(cellKey(rr, c))) { serviceBlocked = true; break }
      if (!serviceBlocked) continue
      scanned++
      let providers = 0
      for (const fig of remaining) {
        if (canPlaceCovering(fig, filled, rows, { r, c }) && ++providers > STRAND_MAX_PROVIDERS) break
      }
      if (providers === 0) penalty += 2 * STRAND_PENALTY
      else if (providers === 1) penalty += STRAND_PENALTY
    }
  }
  return penalty
}

// Placement quality: static heuristics + one-ply planning (TO_DO 30, level 2):
// keeps later legal figure options, closeable vacancies, low steps and — since
// 2026-11-17 — floor flexibility for the figures the engine may still receive.
// Every candidate remains rules-engine legal; this is engine strategy only.
function plannedScore(cells: Cells, filled: Set<string>, rows: number, context: EngineBoardContext, difficulty: Difficulty): number {
  const next = applyCells(filled, cells)
  const staticScore = scorePlacement(cells, filled, rows)
  const ownAvail = context.ownAvailable ?? []
  if (!ownAvail.length) return staticScore + closeableVacancy(next, rows) * 0.5
  const alive = aliveFigures(next, ownAvail, rows)
  const nextOptions = sampleOf(ownAvail).reduce((total, figure) =>
    total + enumeratePlacements(figure, next, rows, 8).length, 0)
  const tallSteps = healthyStepCount(next, rows)
  const flexibility = floorFlexibility(next, rows, ownAvail)
  const stranding = pocketStranding(next, rows, ownAvail)
  // The walk canon's positive side: laddering before a >3 wall or filling a deep pit
  // GAINS reachable territory — valued per cell (doubled in critical terrain, where
  // levelling is the stated priority).
  const { stranded, gained } = territoryDelta(filled, next, rows)
  // Critical terrain (Sergey, 2026-11-19, see filterOutDeadCellCreatingPlacements):
  // when a ≥4 step already exists, levelling dominates — the tall-step term
  // doubles, and the sacrifice penalties (dead cells created by this move,
  // pocket stranding) are halved so a levelling load can actually outscore
  // the passive candidates that keep the giant step intact.
  const critical = healthyStepCount(filled, rows) > 0
  const sacrificeRefund = critical
    ? Math.max(0, computeDeadCells(next, rows).size - computeDeadCells(filled, rows).size) * DEAD_REFUND
    : 0
  // alive ∈ 0..FLEX_CAP (sampled) — ×1000 keeps row-safety dominating the mix.
  const base = staticScore + sacrificeRefund + closeableVacancy(next, rows) * 0.5 + alive * 1000
    + nextOptions * 5 - tallSteps * (critical ? 1000 : 500) + flexibility * FLEX_BONUS
    - (critical ? stranding / 2 : stranding) - stranded * TERRITORY_LOSS
    + gained * (critical ? REACH_GAIN * 2 : REACH_GAIN)
    - monoOnlyCount(next, rows) * MONO_ONLY_PENALTY - placementDiscipline(cells, filled, rows)
  if (difficulty !== 'hard') return base
  return base + hardOnlyBonus(ownAvail, next, rows, context)
}

// Hard level (TO_DO 30, level 3): a bounded second-ply valuation over the
// figures the engine may still receive, minus the share of sampled figures
// that would hand the HUMAN an immediate row closure if they were given out.
function hardOnlyBonus(ownAvail: FigureDef[], next: Set<string>, rows: number, context: EngineBoardContext): number {
  const secondPly = bestTwoPlyScore(ownAvail, next, rows)
  const threatShare = immediateHumanThreatShare(context.humanAvailable ?? [], next, rows)
  return Math.max(0, Math.min(secondPly, 4000)) * 0.1 - threatShare * 400
}

// Best value after two future engine placements (current candidate is ply one).
function bestTwoPlyScore(figures: FigureDef[], filled: Set<string>, rows: number): number {
  let best = -Infinity
  for (const fig of sampleOf(figures)) {
    const firstMoves = enumeratePlacements(fig, filled, rows, PLANNING_CANDIDATE_LIMIT)
    for (const firstMove of firstMoves) {
      const afterFirst = applyCells(filled, firstMove)
      const nextFigures = figures.filter((candidate) => candidate.id !== fig.id)
      const second = aliveFigures(afterFirst, nextFigures, rows)
      best = Math.max(best, scorePlacement(firstMove, filled, rows) + second * 0.25)
    }
  }
  return best
}

// Share of sampled figures that would give the HUMAN a near-row-closing
// placement if handed over on the board `filled` — a static denial caution.
function immediateHumanThreatShare(figures: FigureDef[], filled: Set<string>, rows: number): number {
  const sample = sampleOf(figures)
  const threats = sample.filter((fig) => enumeratePlacements(fig, filled, rows, PLANNING_CANDIDATE_LIMIT)
    .some((cells) => scorePlacement(cells, filled, rows) > ROW_CLOSE_SCORE)).length
  return sample.length ? threats / sample.length : 0
}

// Level dispatch (TO_DO 30g): every level keeps floor flexibility (30d) and
// scans a bounded human-like shortlist; medium/hard additionally weigh each
// candidate with plannedScore (one-ply / two-ply planning). Without figure
// context (old callers) the engine falls back to the human-order first
// candidate — still 30c-compliant on an open board.
function pickByLevel(difficulty: Difficulty, ordered: Cells[], filled: Set<string>, rows: number, context?: EngineBoardContext): Cells {
  const ownAvail = context?.ownAvailable
  if (!ownAvail?.length) return ordered[0]
  // Every level scans like a human: a bounded shortlist from the right-bottom
  // sweep, not every legal placement on the board (TO_DO 30: «может делать
  // вычисления» — bounded, not exhaustive). The EXPENSIVE terms (floor
  // flexibility / full plannedScore) evaluate only the top
  // PLANNING_CANDIDATE_LIMIT of that shortlist — cheap static score orders the
  // shortlist first; this keeps endgame decisions (where coverage checks are
  // mostly failing scans) fast enough for live play.
  const shortlist = ordered.slice(0, STRATEGIC_CANDIDATE_LIMIT)
  if (difficulty === 'easy') {
    // Easy knows the rules and the basic goal — avoiding self-stranding pockets is
    // part of that (Sergey 2026-11-19), so the comparison value includes the
    // pocket-stranding penalty on top of floor flexibility. Critical terrain adds
    // the levelling term (Sergey, 2026-11-19, same ruling as plannedScore): a ≥4
    // step must be cut down, and the sacrifice penalty is halved to let it happen.
    const critical = healthyStepCount(filled, rows) > 0
    const value = (cells: Cells): number => {
      const next = applyCells(filled, cells)
      const stranding = pocketStranding(next, rows, ownAvail)
      const { stranded, gained } = territoryDelta(filled, next, rows)
      return floorFlexibility(next, rows, ownAvail) * FLEX_BONUS
        - (critical ? stranding / 2 : stranding)
        - healthyStepCount(next, rows) * (critical ? 1000 : 0)
        - stranded * TERRITORY_LOSS
        + gained * (critical ? REACH_GAIN * 2 : REACH_GAIN)
        - monoOnlyCount(next, rows) * MONO_ONLY_PENALTY - placementDiscipline(cells, filled, rows)
    }
    let best = shortlist[0]
    let bestValue = value(best)
    for (const cells of shortlist.slice(1, PLANNING_CANDIDATE_LIMIT)) {
      const current = value(cells)
      if (current > bestValue) { best = cells; bestValue = current }
    }
    return best
  }
  const planningContext = { ...context, ownAvailable: ownAvail }
  const ranked = shortlist
    .map(cells => ({ cells, s: scorePlacement(cells, filled, rows) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, PLANNING_CANDIDATE_LIMIT)
    .map(x => x.cells)
  let best = ranked[0]
  let bestScore = plannedScore(best, filled, rows, planningContext, difficulty)
  for (const candidate of ranked.slice(1)) {
    const current = plannedScore(candidate, filled, rows, planningContext, difficulty)
    if (current > bestScore) { best = candidate; bestScore = current }
  }
  return best
}

// ── Handover decisions (what figure to give the HUMAN) ───────────────────────
// The requested figure is placed in the HUMAN's container, so the score reads
// the human's board, not the engine's own (this was the root cause of
// «выкладывает ему удобные фигуры» — the old code scored the engine's board).
//
// handoverValue: handing over a figure the human cannot legally place wins the
// game outright (a forced pass, per the no-legal-move rule) — LOCK_BONUS.
// Otherwise the value is the NEGATION of the human's best placement quality:
// scorePlacement already pays +1000 per row/column closed, so figures that
// close rows for the human sink to the bottom of the pool. This is the basic
// goal («не дать сопернику закрыть ряды») and applies at EVERY level, per the
// level semantics: level 1 is trained, not dumb.
function handoverValue(fig: FigureDef, humanFilled: Set<string>, rows: number): number {
  const placements = enumeratePlacements(fig, humanFilled, rows)
  if (!placements.length) return LOCK_BONUS // human must pass — engine wins
  return -placements.reduce((best, cells) => Math.max(best, scorePlacement(cells, humanFilled, rows)), -Infinity)
}

// Hard level extra: after the human's best placement of `fig`, how many of the
// sampled remaining human figures can still make a near-row-closing placement?
// Fewer future threats = a better denial. Bounded to the sample for cost.
function strandedHumanThreat(fig: FigureDef, humanFilled: Set<string>, rows: number, humanRemaining: FigureDef[]): number {
  const placements = enumeratePlacements(fig, humanFilled, rows)
  if (!placements.length) return 0 // already a forced pass — no future to plan
  const best = placements.reduce((b, cells) =>
    scorePlacement(cells, humanFilled, rows) > scorePlacement(b, humanFilled, rows) ? cells : b, placements[0])
  const after = applyCells(humanFilled, best)
  return sampleOf(humanRemaining).filter((next) =>
    enumeratePlacements(next, after, rows, PLANNING_CANDIDATE_LIMIT)
      .some((cells) => scorePlacement(cells, after, rows) > ROW_CLOSE_SCORE)).length
}

// Draws randomly among near-equal handover choices — the deliberate cure for
// the rigid F01→F05 request template (ties used to fall to ascending figure id).
function chooseHandover(pool: FigureDef[], humanFilled: Set<string>, rows: number, difficulty: Difficulty, humanRemaining: FigureDef[]): FigureDef {
  const scored = pool.map(fig => ({
    fig,
    s: handoverValue(fig, humanFilled, rows)
      - (difficulty === 'hard' ? strandedHumanThreat(fig, humanFilled, rows, humanRemaining) * 300 : 0),
  }))
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0].s
  const tied = scored.filter(x => x.s >= best - REQUEST_TIE_EPSILON).map(x => x.fig)
  return pick(tied)
}

// ── Engine factory ───────────────────────────────────────────────────────────

export function createOpponentEngine(config: EngineConfig): OpponentEngine {
  const preset = PRESETS[config.difficulty]
  const targetWinRate = config.targetWinRate ?? preset.targetWinRate

  return {
    difficulty: config.difficulty,
    targetWinRate,

    chooseFigureToRequest(available, humanLastRequestedId, context) {
      // «Защита от дурака» (TO_DO item 2 / MVP_Rules.docx): never hand the
      // figure the human just requested from the engine — no immediate repeats.
      const pool = available.filter(f => f.id !== humanLastRequestedId)
      const usable = pool.length ? pool : available
      if (usable.length === 0) return { kind: 'pass', message: pick(PHRASES.noMove) }
      const rows = context?.rows ?? 10
      const humanFilled = context?.humanFilled
      if (!humanFilled) {
        const choice = pick(usable) // no human board in context — random fallback
        return { kind: 'request', figureId: choice.id, message: say(pick(PHRASES.request), choice.label) }
      }
      const humanRemaining = context?.humanAvailable ?? usable
      const choice = chooseHandover(usable, humanFilled, rows, config.difficulty, humanRemaining)
      return { kind: 'request', figureId: choice.id, message: say(pick(PHRASES.request), choice.label) }
    },

    decidePlacement(figure, filled, rows, context) {
      // The incoming figure has already been consumed from the request pool for
      // this turn; exclude it from the forward-looking set even when the
      // caller's React snapshot predates its setState.
      const futureContext = context?.ownAvailable
        ? { ...context, ownAvailable: context.ownAvailable.filter((candidate) => candidate.id !== figure.id) }
        : context
      const candidates = enumeratePlacements(figure, filled, rows)
      if (!candidates.length) {
        // 44e desperate fallback (Sergey 2026-11-19, report (4) endgame): with no
        // "competent" move left the engine still PLACES the best honestly-legal
        // load — a fair-play-pending one is NOT eligible here (the fair-play
        // protocol needs the opponent's verdict; unilateral placement would break
        // it), so only exit-sealing loads qualify: the move is legal (44e), the
        // game ends via the honest 44d loss instead of a premature forced pass
        // («больше похожая на сдача»).
        const desperate = enumerateAllLegal(figure, filled, rows)
          .filter((cells) => overhangRatio(cells, filled, rows) <= 0.5)
        if (!desperate.length) return { kind: 'pass', message: pick(PHRASES.noMove) }
        const ranked = desperate
          .map((cells) => ({ cells, sealed: !hasReturnPath(applyCells(filled, cells), rows, cells), s: scorePlacement(cells, filled, rows) }))
          .sort((a, b) => (a.sealed ? 1 : 0) - (b.sealed ? 1 : 0) || b.s - a.s)
        return { kind: 'place', cells: ranked[0].cells, message: pick(PHRASES.moved) }
      }
      // Baseline skill at EVERY level (level 1 is trained, not dumb): never
      // strand a cell that was still reachable unless every placement does.
      const nonDeadCreating = filterOutDeadCellCreatingPlacements(candidates, filled, rows)
      const pool = nonDeadCreating.length ? nonDeadCreating : candidates
      const ordered = orderCandidatesLikeAHuman(pool)
      const chosen = pickByLevel(config.difficulty, ordered, filled, rows, futureContext)
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
