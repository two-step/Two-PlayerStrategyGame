// PuzzleStow rules engine — local, client-side approximation for the dev/test
// harness (TO_DO.docx items 6-7, 2026-09-06). This is NOT the server-authoritative
// engine described in PuzzleStow_MVP_Tech_Spec.docx §4 — that one lives on the
// backend and is the only source of truth for rated play (see the project's
// "no client-side authoritative rules engine" principle, Universal Prompt §5).
// This module exists so the new /devtest page has something real to run against
// while that backend doesn't exist yet. Treat every "approximation" comment below
// as a flag for whoever wires this into the real server later.

export type Cells = [number, number][]

export interface FigureDef {
  id: number
  name: string
  label: string
  cells: Cells
  size: number
  dots: number[]
}

export const ROW_LABELS = 'ABCDEFGHIJK'
export const COLS = 15

// ── Rotation (mirrors App.tsx's copy — kept standalone so this module has no
// import-cycle back into App.tsx; if one changes, change both) ────────────────
export function rotateCW(cells: Cells): Cells {
  if (!cells.length) return cells
  const maxRow = Math.max(...cells.map(([r]) => r))
  const rotated: Cells = cells.map(([r, c]) => [c, maxRow - r])
  const minRow = Math.min(...rotated.map(([r]) => r))
  const minCol = Math.min(...rotated.map(([, c]) => c))
  return rotated.map(([r, c]) => [r - minRow, c - minCol])
}

export function getOrientations(cells: Cells): Cells[] {
  const seen = new Set<string>()
  const results: Cells[] = []
  let cur = cells
  for (let i = 0; i < 4; i++) {
    const key = [...cur].map(([r, c]) => `${r},${c}`).sort().join('|')
    if (!seen.has(key)) { seen.add(key); results.push(cur) }
    cur = rotateCW(cur)
  }
  return results
}

export function cellKey(r: number, c: number) { return `${r},${c}` }

// ── Notation ────────────────────────────────────────────────────────────────────
// Format per PuzzleStow_MVP_Rules.docx / Site_Fix_Request_v2 Part A #4:
// one unbroken string, [figure id (2 digits)][point1][point2], e.g. "07B9C10".
// Each point is a container coordinate: row letter (A.. , A = bottom/entry) then
// column number (0-14), e.g. "B9" = row B, column 9. Two points = the figure's
// two reference dots (see otgruzka_figures.json `dots`), which together fully
// determine position AND orientation (no mirroring exists, so this is unambiguous
// once both target cells are known). A figure with only one reference dot (e.g.
// F16, the fully-symmetric X-pentomino) needs only one point; orientation for
// those must come from the UI's rotation control instead.
const POINT_RE = /([A-K])(\d{1,2})/g

export interface ParsedNotation {
  figureId: number
  points: { r: number; c: number }[]
}

export function letterToRow(letter: string, rows: number): number {
  return rows - 1 - ROW_LABELS.indexOf(letter.toUpperCase())
}

export function rowToLetter(r: number, rows: number): string {
  return ROW_LABELS[rows - 1 - r]
}

export function parseNotation(raw: string, rows: number): ParsedNotation | { error: string } {
  const s = raw.trim().toUpperCase()
  const m = s.match(/^(\d{2})((?:[A-K]\d{1,2}){1,2})$/)
  if (!m) return { error: 'Expected format [2-digit figure id][point][point?], e.g. 07B9C10' }
  const figureId = parseInt(m[1], 10)
  const points: { r: number; c: number }[] = []
  let pm: RegExpExecArray | null
  POINT_RE.lastIndex = 0
  while ((pm = POINT_RE.exec(m[2]))) {
    const r = letterToRow(pm[1], rows)
    const c = parseInt(pm[2], 10)
    if (r < 0 || r >= rows || c < 0 || c >= COLS) return { error: `Point ${pm[1]}${pm[2]} is outside the ${rows}-row container` }
    points.push({ r, c })
  }
  return { figureId, points }
}

export function formatPoint(r: number, c: number, rows: number): string {
  return `${rowToLetter(r, rows)}${c}`
}

export function formatNotation(figureId: number, cells: { r: number; c: number }[], rows: number): string {
  return `${String(figureId).padStart(2, '0')}${cells.map(p => formatPoint(p.r, p.c, rows)).join('')}`
}

// STRICT dot-order canon (Sergey, 2026-11-18/19, кейс F27 27C14B11): point1 =
// dot1 фигуры (ЛЕВАЯ точка исходной фигуры — порядок dots в App FIGURES
// нормализован слева направо), point2 = dot2. Фигура ставится точкой 1 в первый
// клик и вращается ВОКРУГ НЕЁ, пока точка 2 не совпадёт со вторым кликом; если
// ни одна физическая ориентация не даёт такого совпадения — установки НЕТ:
// зеркальное прочтение (point1 → dot2, «другая» фигура) никогда не подставляется.
// СИММЕТРИЯ (2026-11-19, кейс 13A8C9): getOrientations дедуплицирует по
// множеству клеток, и у симметричных фигур (штанги F02–F05, квадрат F07,
// Z/S-тетромино F13 и др.) коллапсируют РАССТАНОВКИ ТОЧЕК — у вертикальной F13
// точка 1 бывает сверху-справа или снизу-слева, а дедупликация оставляет одну;
// часть нотаций («точка 1 снизу») молча отваливалась («Натацыя не супадае…»).
// Физический поворот фигуры сохраняет индексы клеток, поэтому каждый
// представитель разворачивается в полную орбиту из 4 поворотов — клетки у
// коллапсировавших состояний совпадают с уже перечисленными, меняется только
// привязка точек; для несимметричных фигур орбита совпадает с самим списком.
export function computePlacementFromDots(figure: FigureDef, targets: { r: number; c: number }[]): Cells | null {
  if (figure.dots.length < 2 || targets.length < 2) return null
  const t0 = targets[0], t1 = targets[1]
  const dr = t1.r - t0.r, dc = t1.c - t0.c
  const [d0, d1] = figure.dots
  const seen = new Set<string>()
  for (const rep of getOrientations(figure.cells)) {
    let cur = rep
    for (let k = 0; k < 4; k++) {
      const a = cur[d0], b = cur[d1]
      const sig = `${a[0]},${a[1]}>${b[0]},${b[1]}`
      if (!seen.has(sig)) {
        seen.add(sig)
        if (dr === b[0] - a[0] && dc === b[1] - a[1]) {
          return cur.map(([r, c]) => [r + t0.r - a[0], c + t0.c - a[1]])
        }
      }
      cur = rotateCW(cur)
    }
  }
  return null
}

// For single-dot figures (or manual placement): orientation picked explicitly
// (e.g. via a rotation button, like the existing Play page UI), anchored so the
// figure's one reference dot lands on `target`.
export function computePlacementFromAnchor(figure: FigureDef, orientationIdx: number, target: { r: number; c: number }): Cells {
  const orientations = getOrientations(figure.cells)
  const ori = orientations[orientationIdx % orientations.length]
  const dotIdx = figure.dots[0] ?? 0
  const [dr, dc] = ori[dotIdx]
  const offR = target.r - dr, offC = target.c - dc
  return ori.map(([r, c]) => [r + offR, c + offC])
}

// ── Legality ────────────────────────────────────────────────────────────────────
export function inBounds(cells: Cells, rows: number): boolean {
  return cells.every(([r, c]) => r >= 0 && r < rows && c >= 0 && c < COLS)
}

export function collides(cells: Cells, filled: Set<string>): boolean {
  return cells.some(([r, c]) => filled.has(cellKey(r, c)))
}

// Fraction of the new figure's cells that are NOT (transitively) supported: resting
// on the floor row, on an existing filled cell, or on a chain of the SAME figure's own
// cells that itself traces back to the floor or an existing cell. >0.5 needs the
// fair-play bilateral confirmation (MVP_Rules.docx, "Нависание").
//
// BUG FIX (Sergey, 2026-09-07): the previous version only checked ONE level down —
// "is the cell directly below mine part of this same figure" — and counted that as
// support even when THAT cell was itself floating. Concretely, F11 (Pentomino-W)
// placed at C10/A8 (90 deg rotation) put one foot on the floor at col 8, then a
// three-cell staircase climbing away from it at cols 9-10 with nothing under any of
// those cells except each other: the old flat check called col 10's cell "supported"
// because col 10's neighbor-below was an own cell, without checking THAT cell was
// itself grounded — so it reported 40% overhang for a shape that's actually 60%
// unsupported once you follow the chain down and find it never reaches the floor or
// an existing piece. Fixed by making groundedness recursive/transitive through the
// figure's own cells (safe: recursing strictly downward through a finite grid can't
// cycle).
export function overhangRatio(cells: Cells, filled: Set<string>, rows: number): number {
  const own = new Set(cells.map(([r, c]) => cellKey(r, c)))
  const memo = new Map<string, boolean>()
  function isGrounded(key: string): boolean {
    const cached = memo.get(key)
    if (cached != null) return cached
    const [r, c] = key.split(',').map(Number)
    const belowKey = cellKey(r + 1, c)
    const grounded = r === rows - 1 || filled.has(belowKey) || (own.has(belowKey) && isGrounded(belowKey))
    memo.set(key, grounded)
    return grounded
  }
  let unsupported = 0
  for (const [r, c] of cells) if (!isGrounded(cellKey(r, c))) unsupported++
  return cells.length ? unsupported / cells.length : 0
}

// Rule 01 "Support" (site FAQ: "No piece may float. It must rest on the base row A
// or on an already-placed piece.") — literally: does the new figure, AS A WHOLE
// OBJECT, touch the floor or an EXISTING (already-on-the-board) cell anywhere at
// all. This is deliberately independent of overhangRatio below: a rigid multi-cell
// figure can be internally self-supporting (upper cells resting on the figure's own
// lower cells) while the whole assembly still has zero contact with the floor or
// the rest of the board — e.g. an L-shape floating with its foot touching nothing —
// and overhangRatio alone would undercount that as "50%-ish unsupported" instead of
// "not touching the world at all". `filled` is the board BEFORE this placement, so
// it can never include the figure's own cells — no need to exclude them here.
export function hasWorldSupport(cells: Cells, filled: Set<string>, rows: number): boolean {
  return cells.some(([r, c]) => r === rows - 1 || filled.has(cellKey(r + 1, c)))
}

export function colHeights(filled: Set<string>, rows: number): number[] {
  const h = new Array(COLS).fill(0)
  filled.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    h[c] = Math.max(h[c], rows - r)
  })
  return h
}

// APPROXIMATION of "Обратный путь" (MVP_Rules.docx): the docs describe a BFS from
// the placement back to exit A0. Modeled here — same as the existing Sandbox
// overlay (App.tsx stepsHL/returnPathHL) — as column-skyline reachability: two
// adjacent columns are "walkable" between each other if their height difference
// is ≤3 (a ≥4 step is allowed to exist, per the rules, but blocks passage across
// it). A move is illegal only if it seals off *every* column that still has room
// for at least a 1-cell figure — i.e. the game becomes fully undeliverable, not
// merely "harder." Refine this against the real server rule before relying on it
// for anything beyond this test harness.
// Columns reachable from the A0 entrance (column 0) by walking the current skyline:
// two adjacent columns are walkable between each other only while their height
// difference is <=3 cells. A step of 4+ is legal to CREATE (MVP_Rules.docx,
// "Stepenki i prokhodimost'") but it blocks cargo from crossing it -- symmetrically,
// whether that means climbing it or descending it (Sergey, 2026-09-08: the step-height
// rule must hold both going up and going down), which Math.abs already gives for free.
// Shared by hasDeliveryRoute (is the board as a whole still deliverable anywhere) and
// checkPlacement/enumeratePlacements below (is THIS placement's own target column
// actually reachable right now).
// BUG FIX (Sergey, 2026-09-09): this used to compare each column's PEAK height only —
// so a genuinely open pocket sitting BELOW an unrelated tall pile-up higher in the SAME
// column (e.g. a floor-level gap left under a "bridge"-shaped figure, legal per the
// overhang rule) got dragged down as unreachable by whatever was stacked well above it,
// even with dead-flat open floor immediately beside it. Reported live: after one
// placement, 4-6 largely-empty rows/columns "closed themselves" with plenty of room left
// on the board. Root cause confirmed against this exact file: replayed Sergey's reported
// game through checkPlacement/computeDeadCells, reproduced the report's 6:0 byte-for-byte,
// then proved a Mono figure was wrongly refused a target cell with nothing but open floor
// between it and the entrance (checkPlacement itself rejected it, not just the display).
//
// Fix: reachability is now computed per open RUN within a column (a maximal run of empty
// rows, bounded by the floor or a filled cell), not per column peak. Each run is anchored
// at its own "shelf" — the row a piece would actually rest on if delivered there (the
// run's bottom: the floor, or directly on top of whatever's filled below it). A run in
// column c+1 becomes reachable once some already-reachable run's shelf in column c sits
// within 3 rows of it (symmetric — climbing or descending, Sergey 2026-09-08), same as
// before; column 0 (the A0 entrance) seeds every one of its own runs as reachable. Once a
// run's shelf is reachable, every cell in that run is reachable — no further per-figure
// feasibility guessing, matching the existing "door's open, let them try, checkPlacement
// is the only judge" philosophy. A column with a single run (the common case: solid from
// the floor up, open above) degenerates to exactly the old peak-vs-peak comparison, so
// nothing changes for the ordinary case — only a column with a real internal void (more
// than one run) is treated differently now.
function columnRuns(filled: Set<string>, rows: number, c: number): { top: number; bottom: number }[] {
  const runs: { top: number; bottom: number }[] = []
  let start: number | null = null
  for (let r = 0; r < rows; r++) {
    if (!filled.has(cellKey(r, c))) {
      if (start === null) start = r
    } else if (start !== null) {
      runs.push({ top: start, bottom: r - 1 })
      start = null
    }
  }
  if (start !== null) runs.push({ top: start, bottom: rows - 1 })
  return runs
}

// A run "touches open ground" if it reaches the true top of the container (open sky
// above a stack -- ordinary plateau-hopping terrain) or the true floor (bottom ===
// rows-1 -- nothing built below it in this column, a genuine floor landing). Anything
// else is an INTERNAL notch/pocket: sandwiched between filled material above and below
// in the SAME column -- typically the byproduct of a fair-play overhang (Sergey,
// 2026-09-10: "загрузить в выемку можно, а использовать её для подъёма выше нельзя" --
// cargo can be loaded directly into such a pocket, but the pocket can't be used to climb
// further up the same column). Such a run can still be REACHED (it's a legal direct
// delivery target once some neighbor already reaches it within the usual +/-3 step), but
// it must not act as a waypoint that forwards reachability on to ANOTHER neighboring
// column. Confirmed live against Sergey's 2026-09-10 report (move 22, F25 at G12/E12
// /G11/F11/E11/G10/E10 -- a legal 2/7 = 28.6% overhang, well under the 50% fair-play
// threshold): the notch it leaves at F10/D10 in column 10 was, before this fix, the ONLY
// thing connecting the entire column 10-14 cluster back to the entrance -- a step from
// column 9 (height 3) straight to column 10's own peak (height 7) is a raw diff of 4,
// which should be blocked outright.
function isInternalNotch(run: { top: number; bottom: number }, rows: number): boolean {
  return run.top !== 0 && run.bottom !== rows - 1
}

// BUG FIX (Sergey, 2026-09-11, F20 report): a run that touches the true FLOOR but
// is capped above within its OWN column (top !== 0 -- a low pocket trapped under an
// overhang, e.g. one floating cell of a figure with nothing but air below it) has its
// `bottom` pinned at rows-1 no matter how deep the pocket actually is. Comparing that
// pinned value against a totally unrelated NEIGHBOR run's bottom via the usual <=3
// rule produces false matches by pure arithmetic coincidence: a floor-level sliver in
// column c (bottom = rows-1) and a short-wall's open-air run in column c+1 (bottom =
// rows-4, say) are "within 3" of each other numerically, even though the pocket in
// column c is sealed off from that open-air run by solid material directly above it
// IN THE SAME COLUMN -- they don't share a single row and are not physically adjacent.
// Reported live: F22 left a single floating cell in one column (a floor-level pocket
// underneath), and that pocket's floor bottom "bridged" into the wide-open sky above a
// short, unrelated stack one column over -- which then chained backward and opened up
// the sky-runs of every column in between, including the one behind F22's own genuine
// 4-tall wall that was supposed to block exactly this. F20 then walked straight through
// on its next move.
//
// Fix: a floor-touching-but-capped run ("pure pocket": bottom === rows-1 AND top !== 0)
// may only bridge, via the <=3 rule, to a neighbor run that ALSO touches the floor
// (bottom === rows-1) -- i.e. pocket-to-pocket (or pocket-to-fully-open-column) floor-
// level crawling, exactly the case the 2026-09-09 fix intended to keep working (their
// bottoms are always both rows-1, so the <=3 test always trivially holds there; nothing
// about that legitimate case changes). A pocket can no longer use its floor-pinned
// bottom to "reach over" into a neighbor's disconnected open-air run above a short wall.
// Ordinary sky-touching runs (top === 0) and true internal notches (neither extreme --
// e.g. the 2026-09-10 F25 fix's entry-from-the-side case) are untouched: they keep
// comparing via the plain <=3 rule against ANY neighbor type, exactly as before.
function canBridge(a: { top: number; bottom: number }, b: { top: number; bottom: number }, rows: number): boolean {
  const aIsPurePocket = a.bottom === rows - 1 && a.top !== 0
  const bIsPurePocket = b.bottom === rows - 1 && b.top !== 0
  if (aIsPurePocket && b.bottom !== rows - 1) return false
  if (bIsPurePocket && a.bottom !== rows - 1) return false
  return Math.abs(a.bottom - b.bottom) <= 3
}

// Board signature for the module-level reachability memo: placements within one
// turn repeatedly re-flood the SAME board (26 figures × shortlisted candidates),
// so the flood is cached by exact board content. Bounded to keep memory flat —
// caches are pure performance plumbing, never semantics.
const reachabilityCache = new Map<string, { top: number; bottom: number }[][]>()
const REACHABILITY_CACHE_CAP = 200

function reachableRunsByColumn(filled: Set<string>, rows: number): { top: number; bottom: number }[][] {
  const cacheKey = `${rows}|${[...filled].sort().join(';')}`
  const cached = reachabilityCache.get(cacheKey)
  if (cached) return cached
  const perColumn: { top: number; bottom: number }[][] = []
  for (let c = 0; c < COLS; c++) perColumn.push(columnRuns(filled, rows, c))
  const reach: boolean[][] = perColumn.map(runs => runs.map(() => false))
  // The A0 entrance connects to the outside only where the loader can still step
  // out over the entrance stack: a column-0 run qualifies when the stack covering
  // the exit is at most 3 cells tall (stackHeight = rows−1−run.bottom ≤ 3 ⇔
  // run.bottom ≥ rows−4). Sergey's data points: F26 covering A0 (stack 2) was
  // «всё хорошо»; F21 raising the entrance step to 4 sealed the exit — «ступень
  // в 4 ячейки»; and 2026-11-18 report (4), move 10: F25@25C0A2 left a stack of
  // exactly 3 with the loader already AT the entrance and no step >3 anywhere —
  // «в контейнере нету ступеней >3 ячеек» — so 3 is climbable, 4 is not. The
  // earlier rows−3 bound silently sealed the exit at stack 3 (off-by-one).
  // Upper shaft runs above a taller entrance stack do NOT connect outside.
  perColumn[0].forEach((run, i) => { if (run.bottom >= rows - 4) reach[0][i] = true })
  let changed = true
  while (changed) {
    changed = false
    for (let c = 0; c < COLS - 1; c++) {
      for (let i = 0; i < perColumn[c].length; i++) {
        if (!reach[c][i] || isInternalNotch(perColumn[c][i], rows)) continue
        for (let j = 0; j < perColumn[c + 1].length; j++) {
          if (reach[c + 1][j]) continue
          if (canBridge(perColumn[c][i], perColumn[c + 1][j], rows)) { reach[c + 1][j] = true; changed = true }
        }
      }
      for (let j = 0; j < perColumn[c + 1].length; j++) {
        if (!reach[c + 1][j] || isInternalNotch(perColumn[c + 1][j], rows)) continue
        for (let i = 0; i < perColumn[c].length; i++) {
          if (reach[c][i]) continue
          if (canBridge(perColumn[c][i], perColumn[c + 1][j], rows)) { reach[c][i] = true; changed = true }
        }
      }
    }
  }
  const out: { top: number; bottom: number }[][] = []
  for (let c = 0; c < COLS; c++) out.push(perColumn[c].filter((_, i) => reach[c][i]))
  if (reachabilityCache.size >= REACHABILITY_CACHE_CAP) reachabilityCache.clear()
  reachabilityCache.set(cacheKey, out)
  return out
}

// Every EMPTY cell reachable from the A0 entrance, per the run-based model above.
export function reachableCells(filled: Set<string>, rows: number): Set<string> {
  const runsByCol = reachableRunsByColumn(filled, rows)
  const out = new Set<string>()
  for (let c = 0; c < COLS; c++) {
    for (const run of runsByCol[c]) {
      for (let r = run.top; r <= run.bottom; r++) out.add(cellKey(r, c))
    }
  }
  return out
}


// RULE ADD (Sergey, 2026-09-08): "Фигура может быть установлена только если она
// проходит по своим габаритам к месту установки." reachableColumns above models a
// 1-cell-wide skyline path -- fine for width-1 cargo, but it let ANY figure "sneak"
// through a 1-cell gap regardless of its own bulk (Sergey's example: a bent figure
// like F09, whose narrowest achievable cross-section is 2 cells, could still be
// delivered through a 1-wide corridor -- "караван героина"). Two additions:
// reachableColumnsForWidth models the figure as a WxW probe box (W = the figure's
// own narrowest achievable cross-section, see minPassableWidth below) and asks
// whether that box can slide, one cell at a time (up/down/left/right, no rotation
// mid-transit), from an entrance-adjacent position all the way to each column --
// classic obstacle-erosion + BFS: a box anchored at (r,c) is only a valid position
// if EVERY cell it would cover is empty, and two positions are connected only if
// BOTH are valid. This catches pinch points in either direction (a corridor that's
// narrow horizontally OR vertically), which two earlier, simpler attempts both
// missed: comparing column HEIGHTS pairwise turned out to be a no-op for W=2 (two
// columns each individually reachable via the existing <=3-step rule are, by
// construction of that BFS, already within 3 of each other); and a row-wise "open
// run width" check let a long open row outside a wall's actual gap inflate the
// measured width past the true bottleneck. The result is intersected with the
// existing width-1 reachableColumns so a wider figure can never reach further than
// a 1-wide probe could -- only narrower. Width 1 degenerates to reachableColumns
// exactly, so straight/thin figures are completely unaffected.
//
// NOTE on the OTHER half of the rule ("если она ... должна ещё и развернуться,
// то для неё там должно быть наличие пространство для разворота"): a figure's
// bounding-box min(w,h) is the same across all 4 rotations (a 90-degree turn only
// swaps w and h, it can't change which one is smaller), so "this orientation is
// wider than the figure's narrowest form" is never true relative to minPassableWidth
// -- there's no bbox-level signal that distinguishes "arrived already in its final
// orientation" from "needed an in-place turn to get here". An earlier version of
// this file had a hasTurnClearance() check here that looked at bbox dimensions, but
// it was a mathematical no-op (always passed) for exactly that reason, so it was
// removed rather than ship a check that silently does nothing. Genuinely detecting
// "did this specific placement require turning in place" needs to compare the
// figure's actual placed cell-shape against the corridor it traveled through, not
// just bounding-box numbers -- left as a follow-up if it turns out to matter in
// practice.
export function bboxSize(cells: Cells): { w: number; h: number; minR: number; minC: number } {
  const rs = cells.map(([r]) => r)
  const cs = cells.map(([, c]) => c)
  const minR = Math.min(...rs), maxR = Math.max(...rs)
  const minC = Math.min(...cs), maxC = Math.max(...cs)
  return { w: maxC - minC + 1, h: maxR - minR + 1, minR, minC }
}

// The figure's own narrowest achievable cross-section, across all 4 rotations --
// this is the minimum corridor width it can ever be delivered through, no matter
// how it's finally oriented once it arrives. Memoized by normalized shape: this sits
// on the engine's per-candidate hot path (deliveryReachable calls it for every
// candidate anchor), and getOrientations is far too expensive to rerun each time
// (2026-11-18 perf regression: decidePlacement 0.45s → 6.9s before this memo).
const minPassableWidthCache = new Map<string, number>()
const MIN_PASSABLE_WIDTH_CACHE_CAP = 500

export function minPassableWidth(cells: Cells): number {
  // Normalize to the bbox origin BEFORE keying: placements arrive as absolute
  // (translated) copies of the same orientation — keying the raw cells would give a
  // distinct cache key per anchor and the memo would never hit.
  const { minR, minC } = bboxSize(cells)
  const norm = cells.map(([r, c]) => [r - minR, c - minC] as [number, number])
  const key = shapeSignature(norm)
  const cached = minPassableWidthCache.get(key)
  if (cached != null) return cached
  let best = Infinity
  for (const ori of getOrientations(norm)) {
    const { w, h } = bboxSize(ori)
    best = Math.min(best, w, h)
  }
  if (minPassableWidthCache.size >= MIN_PASSABLE_WIDTH_CACHE_CAP) minPassableWidthCache.clear()
  minPassableWidthCache.set(key, best)
  return best
}

// Returns reachable CELLS (not columns) so a caller can check a specific target cell,
// not just "is this cell's column reachable somewhere" — needed since 2026-09-09's fix
// made reachability a per-run (not per-column) property (see reachableCells above).
// Memoized by (board, width): hasTurningPocketNear probes it for every delivery-rejected
// candidate, always with the same board and the figure's minPassableWidth.
const widthReachCache = new Map<string, Set<string>>()
const WIDTH_REACH_CACHE_CAP = 200

/** Loader-walk reach filtered by a `width`x`width` probe box: cells a cargo of the
 * given minimal width can actually be carried to (the engine uses width 2 to find
 * «only-for-Mono» cells — Sergey, report (14) 2026-11-19). Memoized per board.
 * Preconditions: `filled` keys are valid `r,c` inside `rows`×COLS; postcondition:
 * pure query; invariant: no rule mutation — read-only flood. */
export function reachableCellsForWidth(filled: Set<string>, rows: number, width: number): Set<string> {
  const cacheKey = `${rows}|${[...filled].sort().join(';')}|${width}`
  const cached = widthReachCache.get(cacheKey)
  if (cached) return cached
  const base = reachableCells(filled, rows)
  if (width <= 1) return base
  // Is a `width`x`width` probe box, top-left anchored at (r,c), entirely clear?
  function boxOpen(r: number, c: number): boolean {
    if (r < 0 || c < 0 || r + width > rows || c + width > COLS) return false
    for (let rr = r; rr < r + width; rr++) {
      for (let cc = c; cc < c + width; cc++) {
        if (filled.has(cellKey(rr, cc))) return false
      }
    }
    return true
  }
  const visited = new Set<string>()
  const queue: [number, number][] = []
  function tryVisit(r: number, c: number) {
    const key = cellKey(r, c)
    if (visited.has(key) || !boxOpen(r, c)) return
    visited.add(key)
    queue.push([r, c])
  }
  // Entrance: column 0 is always the way in, at whatever height it's currently
  // built up to -- try every valid box position there, not just the bare floor,
  // so an already-partly-filled column 0 doesn't get wrongly treated as sealed.
  for (let r = 0; r <= rows - width; r++) tryVisit(r, 0)
  for (let qi = 0; qi < queue.length; qi++) {
    const [r, c] = queue[qi]
    tryVisit(r - 1, c); tryVisit(r + 1, c); tryVisit(r, c - 1); tryVisit(r, c + 1)
  }
  // BUG FIX (Sergey, 2026-09-10): the old COLUMN-granular version certified a column
  // "wide-reachable" if a valid WxW box touched it ANYWHERE, at any row, even far from
  // the actual target -- so a box that found headroom many rows higher, in completely
  // open air, stamped the ENTIRE column reachable at every height, including a narrow
  // spot lower down the box never actually swept through. Reported live: F21 (needs a
  // 3-wide passage) was let into a spot where the real local opening was only 2 cells
  // wide (a notch-capped column between two low neighbors) -- Sergey's framing: "можно
  // ли в 2-клеточный колодец опустить тело шириной 3 клетки" -- no.
  //
  // First attempt: require the probed cell to be EXACTLY covered by some valid box
  // position. That correctly rejected the F21 well, but broke 10 of 30 real moves from
  // Sergey's own two historical games -- e.g. an S/Z-tetromino settling with two of its
  // cells resting flush against an existing wall (perfectly ordinary contiguous
  // stacking) has no WxW box position covering those flush cells exactly, because the
  // box is a crude SQUARE stand-in for an irregular figure and doesn't need one -- those
  // cells are reached by plain same-column support, not by sliding a box in.
  //
  // Fix: cells that are VERTICALLY GROUNDED (verticallyGroundedCells -- same-column
  // chain down to real material; see checkPlacement, which now checks this BEFORE
  // calling reachableCellsForWidth and skips the width probe entirely for such cells)
  // never reach this function's cell-exact test in the first place. What's left here is
  // the exact-cell tightening itself, for the non-grounded (genuine sideways-reach)
  // cells checkPlacement still routes through it. Re-verified against both of Sergey's
  // full historical games after this change: zero regressions.
  const wideCells = new Set<string>()
  visited.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    for (let rr = r; rr < r + width; rr++) {
      for (let cc = c; cc < c + width; cc++) wideCells.add(cellKey(rr, cc))
    }
  })
  const out = new Set<string>()
  base.forEach(key => {
    if (wideCells.has(key)) out.add(key)
  })
  if (widthReachCache.size >= WIDTH_REACH_CACHE_CAP) widthReachCache.clear()
  widthReachCache.set(cacheKey, out)
  return out
}

// BUG FIX (Sergey, 2026-09-10, F19 report): reachableCellsForWidth models the figure as a
// solid WxW SQUARE probe -- a deliberate simplification (comment above), but it breaks down
// for a figure that has a HOLE in its own footprint, like F19 (an arch: a full middle row,
// two feet, with the cell between the feet deliberately empty so the figure can straddle a
// single-column obstruction). Reported live: F19 placed as an arch over the top of an
// existing 3-tall stack (the stack's top cell sits exactly under the arch's hole) was
// rejected, because the square probe insists the hole's cell also be empty -- it has no way
// to know that cell isn't part of the figure at all.
//
// First attempt: BFS the figure's exact cell pattern (only its own real cells need to stay
// empty), dropping the padding square entirely. That correctly accepted F19, but reopened the
// F21 "well" bug from earlier the same day (see reachableCellsForWidth's own history above) --
// Sergey's own confirmed-illegal repro (21B7C9 into a 2-wide gap) came back as legal, because
// full exact-shape BFS also lets a zigzag figure THREAD sideways through a gap narrower than
// its own bounding box, by walking its concave notches around a solid column one step at a
// time. Physically defensible as pure rigid-body kinematics, but not the rule Sergey actually
// wants -- his own framing ("a body of width 3 into a 2-wide well") treats the figure's overall
// bounding footprint as the thing that needs clearance, not just its literal occupied cells.
//
// Fix: keep requiring the figure's full bounding box empty during transit (exactly the old
// square's standard), and punch out ONLY cells that are a genuine ENCLOSED hole -- a bbox cell
// that is not part of the figure but sits strictly BETWEEN two of the figure's own cells in the
// same row, or strictly between two in the same column (an arch's underside, or a bridge's
// underside). F19's gap qualifies (flanked left and right by its two feet, same row). F21's
// zigzag has no such cell anywhere in its bbox (every gap is a corner, open on one side) -- so
// F21 gets the exact same all-cells-required square it always did, zero behavior change there.
// Re-verified against both of Sergey's full historical games plus this new one: zero
// regressions, F21's well bug still rejected, and this fixes F19.
// DELIVERY MODEL (reworked 2026-11-18, refined 2026-11-19 per Sergey's F11 ruling
// «для F11 достаточно 2 ячеек» — case 11C5A7 rejected by the old envelope standard).
// The "vertically grounded = exempt from all delivery checks" rule is GONE (it let a
// fully floor-stacked figure skip the passage check entirely — on the (3)-report board
// the engine delivered the V-pentomino F17 into the pocket right of B12: the only way
// down there is a 2-cell-wide passage, while F17's own cells span 3 columns in every
// orientation («в 2-клеточный колодец нельзя опустить тело шириной 3 клетки», same
// standard as the F21 well). 24C11A12 is genuinely deliverable WITHOUT any exemption:
// the T slides along the open floor and its tall stem never crosses the lintel column.
//
// Final model (matches every ruling to date):
//  • TRANSIT: the figure slides as a rigid body one cell at a time from the A0 entrance;
//    at every INTERMEDIATE position its OWN CELLS — plus every TRULY ENCLOSED gap of its
//    silhouette (an empty bbox pocket not connected to the bbox boundary through empty
//    cells; nothing solid can enter or leave such a pocket while the body slides) — must
//    stay clear of material. OPEN silhouette gaps (edge/corner notches like the
//    W-staircase's or the F19 arch's under-gap) may pass OVER material: a rigid staircase
//    slides through a 2-cell-wide stepped channel (Sergey, 2026-11-19: «для F11 достаточно
//    2 ячейки»), an arch straddles a pillar. A SOLID cross-section still needs its width:
//    F17's V and the F21 well stay rejected. The ≤3-step run model still gates the cells
//    (base intersection).
//  • ARRIVAL: the place of installation needs only the figure's OWN cells empty (arrival
//    is stacking, not traveling) — under this transit model the target anchor is just the
//    last BFS position, so no separate adjacency rule is needed anymore (the old
//    envelope-overlap-at-arrival case 24C11A12 is now plain reachable transit).
//  • Grounded placements no longer bypass anything: a floor stack still has to be
//    DELIVERABLE (this is what rejects F17@17C14A12 while keeping 24C11A12 legal).
// Module-level memo for the shape BFS: within one planning pass the SAME
// (board, orientation) pair is probed repeatedly (alive-figures, option counts,
// flexibility), so the expensive per-shape flood is cached by exact board and
// normalized shape content. Bounded; pure performance plumbing, no semantics.
const shapeReachCache = new Map<string, Set<string>>()
const SHAPE_REACH_CACHE_CAP = 400

function shapeSignature(cells: Cells): string {
  return JSON.stringify([...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
}

// Silhouette-gated transit BFS: returns every ANCHOR (top-left bbox position) the figure
// can slide to from the entrance with only its own cells (+ enclosed silhouette pockets)
// staying clear. Memoized per (board, normalized orientation). Pure helper of deliveryReachable.
function envelopeTransitAnchors(filled: Set<string>, rows: number, cells: Cells): Set<string> {
  const cacheKey = `${rows}|${[...filled].sort().join(';')}|${shapeSignature(cells)}`
  const cached = shapeReachCache.get(cacheKey)
  if (cached) return cached
  const { minR, minC, w, h } = bboxSize(cells)
  const figureSet = new Set(cells.map(([r, c]) => cellKey(r - minR, c - minC)))
  // Which bbox cells must stay clear during transit: every real figure cell, plus every
  // non-figure bbox cell that is NOT connected to the bbox boundary through empty bbox
  // cells (a truly enclosed pocket — nothing solid can enter or leave it while the rigid
  // body slides). Open edge/corner gaps (staircase notches, arch under-gaps) are exempt:
  // they may pass over material (F11 staircase through a 2-wide stepped channel, F19 arch
  // straddling a pillar — Sergey 2026-11-19).
  const required: [number, number][] = [...figureSet].map(k => {
    const [lr, lc] = k.split(',').map(Number)
    return [lr, lc] as [number, number]
  })
  const openGap = new Set<string>()
  const gapQueue: [number, number][] = []
  for (let lr = 0; lr < h; lr++) {
    for (let lc = 0; lc < w; lc++) {
      const k = cellKey(lr, lc)
      if (figureSet.has(k) || openGap.has(k)) continue
      const onBoundary = lr === 0 || lc === 0 || lr === h - 1 || lc === w - 1
      if (onBoundary) { openGap.add(k); gapQueue.push([lr, lc]) }
    }
  }
  for (let qi = 0; qi < gapQueue.length; qi++) {
    const [lr, lc] = gapQueue[qi]
    for (const [nr, nc] of [[lr - 1, lc], [lr + 1, lc], [lr, lc - 1], [lr, lc + 1]] as [number, number][]) {
      const k = cellKey(nr, nc)
      if (nr < 0 || nc < 0 || nr >= h || nc >= w || figureSet.has(k) || openGap.has(k)) continue
      openGap.add(k)
      gapQueue.push([nr, nc])
    }
  }
  for (let lr = 0; lr < h; lr++) {
    for (let lc = 0; lc < w; lc++) {
      if (!figureSet.has(cellKey(lr, lc)) && !openGap.has(cellKey(lr, lc))) required.push([lr, lc])
    }
  }
  function shapeOpen(ar: number, ac: number): boolean {
    for (const [lr, lc] of required) {
      const r = ar + lr, c = ac + lc
      if (r < 0 || r >= rows || c < 0 || c >= COLS) return false
      if (filled.has(cellKey(r, c))) return false
    }
    return true
  }
  const visited = new Set<string>()
  const queue: [number, number][] = []
  function tryVisit(ar: number, ac: number) {
    const key = cellKey(ar, ac)
    if (visited.has(key) || !shapeOpen(ar, ac)) return
    visited.add(key)
    queue.push([ar, ac])
  }
  // Entrance: the shape's own leftmost column anchored at board column 0, at every row --
  // same rationale as the square version (an already-built-up column 0 isn't wrongly sealed).
  for (let ar = 0; ar < rows; ar++) tryVisit(ar, 0)
  for (let qi = 0; qi < queue.length; qi++) {
    const [ar, ac] = queue[qi]
    tryVisit(ar - 1, ac); tryVisit(ar + 1, ac); tryVisit(ar, ac - 1); tryVisit(ar, ac + 1)
  }
  if (shapeReachCache.size >= SHAPE_REACH_CACHE_CAP) shapeReachCache.clear()
  shapeReachCache.set(cacheKey, visited)
  return visited
}

// The delivery question for ONE concrete placement (see the model comment above):
// true iff the figure can be brought from the A0 entrance to exactly this position.
// Preconditions: `cells` inside the container, non-colliding (checked by the caller);
// postconditions: pure query, no board mutation; invariant: never relaxes the ≤3-step
// run model (base intersection) or the envelope transit standard.
// `pre` lets hot callers (the engine's move generator) supply the per-board/per-shape
// artifacts once instead of rebuilding cache keys for every candidate anchor.
function deliveryReachableCore(cells: Cells, rows: number, base: Set<string>, visited: Set<string>): boolean {
  // A figure whose narrowest achievable cross-section is 1 can reach anywhere the run
  // model allows (unchanged legacy behavior: thin cargo never needs a wider corridor).
  if (minPassableWidth(cells) <= 1) return cells.every(([r, c]) => base.has(cellKey(r, c)))
  if (!cells.every(([r, c]) => base.has(cellKey(r, c)))) return false
  const { minR, minC } = bboxSize(cells)
  const anchor = cellKey(minR, minC)
  // Under the silhouette transit model the target anchor is just the last BFS position:
  // its own cells are guaranteed empty (non-colliding precondition), so it is reachable
  // exactly when the transit BFS visited it (entrance column 0 anchors are seeded in).
  return visited.has(anchor)
}

export function deliveryReachable(filled: Set<string>, rows: number, cells: Cells): boolean {
  return deliveryReachableCore(cells, rows, reachableCells(filled, rows), envelopeTransitAnchors(filled, rows, cells))
}

// Sergey, 2026-11-19 (canon «будем учить ходить», live report 14:15 F13@13E12D14): the
// loader WALKS the container with the cargo. Climb and descent rules are SEPARATE and
// never mix:
//   - WALK (the run model): a step up ≤3 is climbed with the cargo; a step down ≤3 is
//     walked; anything deeper/taller on foot is impassable; notches never help climbing
//     a sheer >3 wall. Already enforced by reachableCells/canBridge.
//   - BEND (this channel) is for DESCENT ONLY: standing at the rim of a pit deeper than
//     3, the loader lowers the current cargo by bending down AT MOST 3 cells («перегнувшись
//     вниз на 3 ячейки максимум»), and only if the cargo REACHES A SUPPORT («если достану
//     до опоры — бросать нельзя»): every seat cell's column chain must terminate on
//     pre-existing material or the floor — no dangling seats. Bending UP is not a thing:
//     cargo is never placed above the loader's feet level through this channel (that
//     would need climbing, governed solely by the ≤3 step rule).
//   - The loader's own cell never becomes cargo: he stands beside/below the seat area.
//   - The cargo's path from the loader to the seats goes through OPEN AIR (Sergey,
//     2026-11-19, report (15) F09@09C2E3: the loader stood in the entrance pocket B0
//     while the seats sat behind a 4-tall wall — «через стены ещё не научились
//     проникать»): every seat must be 4-connected to the anchor through pre-empty cells.
// Vertical metric is the SHELF distance (feet level − the seat's lowest contact level
// ≤3), not the raw row distance — the F13 case (seats 4 steps above the floor, diagonal
// Chebyshev 3) is REJECTED; the 11E11C13 precedent (loader in the D11 notch, feet 3,
// contacts at level 2, bend 1) stays LEGAL.
// The «без бросания» controlled-slide hold condition is unchanged.
// Deliberately ADDITIVE like hasTurningPocketNear: it only widens acceptance for the
// specific «lowered from the step edge» case and cannot regress sliding-legal moves.
function loaderLoweringReachable(filled: Set<string>, rows: number, cells: Cells): boolean {
  const stand = reachableCells(filled, rows)
  if (!stand.size) return false
  // The seat's lowest contact level: follow each seat cell's own-column chain down
  // through SEAT cells until pre-existing material or the floor. A chain ending in air
  // means the cargo never reaches a support here — no bend placement is possible.
  const seatSet = new Set(cells.map(([r, c]) => cellKey(r, c)))
  // The cargo as a WHOLE must reach a support («достану до опоры»): at least one
  // seat cell's column chain (own cells down) terminates on pre-existing material or
  // the floor. Individual cells may dangle — the ≤50 % rigidity canon governs them —
  // but the bend metric is the LOWEST contact level (the deepest support the loader
  // must reach down to).
  const seatSetChains = seatSet
  let contactLevel = Infinity
  let anyContact = false
  for (const [r, c] of cells) {
    let rr = r
    while (rr + 1 < rows && seatSetChains.has(cellKey(rr + 1, c))) rr++
    if (rr + 1 >= rows) { contactLevel = Math.min(contactLevel, 0); anyContact = true; continue } // the floor
    if (!filled.has(cellKey(rr + 1, c))) continue // dangling chain — the overhang rule governs it
    contactLevel = Math.min(contactLevel, rows - 1 - rr)
    anyContact = true
  }
  if (!anyContact) return false // the cargo touches no support at all
  // Sergey, 2026-11-19 (report (16), live attempt 06B10A11, «хочется системы: для
  // подъёма три, для спуска три и для свисания 3»): the loader's BODY hangs at most
  // 3 cells below his feet; the figure's own height spans the rest of the way down to
  // the support. In a 5-deep well with a 2-tall figure the hang is exactly 3. So the
  // anchor window is: feet ≥ contact (descent only — never lifting) and
  // (feet − contact) − figureSpan ≤ 3, where figureSpan is the figure's vertical
  // extent in the placed orientation. A shallow set-down (feet − contact < span,
  // e.g. 11E11C13) is untouched — the figure simply does not need the full hang.
  let minR = Infinity, maxR = -Infinity
  for (const [r] of cells) { if (r < minR) minR = r; if (r > maxR) maxR = r }
  const figureSpan = maxR - minR + 1
  // Supported, non-seat standing cells within the hang window — the loader's
  // positions that can serve this seat at all.
  const bendAnchorSet = new Set<string>()
  for (const key of stand) {
    const [sr, sc] = key.split(',').map(Number)
    if (seatSet.has(key)) continue // the loader's body cell never becomes cargo
    if (sr + 1 < rows && !filled.has(cellKey(sr + 1, sc))) continue // mid-air: not standing
    const feet = rows - 1 - sr
    if (feet < contactLevel) continue // descent only — the cargo never goes above the feet
    if (feet - contactLevel - figureSpan > 3) continue // body hang at most 3 (system of threes)
    bendAnchorSet.add(key)
  }
  if (!bendAnchorSet.size) return false
  // «Через стены ещё не научились проникать» (Sergey, 2026-11-19, report (15),
  // engine F09@09C2E3): Chebyshev reach alone let the loader «lay» the cargo BEHIND a
  // 4-tall wall — he stood in the 1-cell entrance pocket B0 while the seats C2..E3 sat
  // past the solid A1–D1 column. And an unrestricted air path is not enough either:
  // the wall's col-1 cells are open ABOVE their top (F1), so the air leaks over the
  // top — but the bend is DESCENT ONLY («перегнувшись», never lifting the cargo over
  // anything). The cargo's path from the loader to every seat must descend or stay
  // level (row never decreases) through pre-empty cells. No such path from ANY
  // covering anchor — the wall cannot be penetrated or surmounted, no bend.
  // airCells = EVERY pre-empty cell (the whole open air, seats included — they are
  // empty before the placement): the cargo's descent path travels through the air,
  // not only through its own future cells.
  const airCells = new Set<string>()
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (!filled.has(cellKey(r, c))) airCells.add(cellKey(r, c))
  const seatsConnected = (anchor: string): boolean => {
    const seen = new Set<string>([anchor])
    const queue = [anchor]
    let hit = 0
    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c] = queue[qi].split(',').map(Number)
      for (const [dr, dc] of [[1, 0], [0, -1], [0, 1]] as [number, number][]) {
        const k = cellKey(r + dr, c + dc)
        if (seen.has(k) || !airCells.has(k)) continue
        seen.add(k)
        queue.push(k)
        if (seatSet.has(k)) hit++
      }
    }
    return hit === seatSet.size
  }
  let servingAnchor = false
  for (const anchor of bendAnchorSet) {
    if (seatsConnected(anchor)) { servingAnchor = true; break }
  }
  if (!servingAnchor) return false
  // Arm's reach gate: horizontal ±3 (the arm system), vertical ±(3 + figureSpan) —
  // the body may hang 3 and the figure spans the rest (Sergey's system of threes,
  // report (16)). Upward offset stays impossible for serving anchors anyway
  // (descent-only), but the gate is symmetric for simplicity of the pre-filter.
  const near = (pts: Cells): boolean =>
    pts.every(([r, c]) => {
      for (let dr = -(3 + figureSpan); dr <= 3 + figureSpan; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          if (bendAnchorSet.has(cellKey(r + dr, c + dc))) return true
        }
      }
      return false
    })
  if (!near(cells)) return false
  // «без бросания»: some rigid one-step shift of the seat (an adjacent holding
  // position) is fully empty, so the final placement is a one-step guided motion.
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  return dirs.some(([dr, dc]) => {
    const hold = cells.map(([r, c]) => [r + dr, c + dc] as [number, number])
    if (hold.some(([r, c]) => r < 0 || r >= rows || c < 0 || c >= COLS)) return false
    if (!hold.every(([r, c]) => !filled.has(cellKey(r, c)))) return false
    return near(hold)
  })
}

// 44a, structural form (Sergey, 2026-11-19, report of 10:31, engine move 16
// F25@25H1F3: «движок поставил F25 на ступень в 5 ячеек… согласно правилам:
// “Выемка в сплошной ступени >3-х ячеек не считается опорой для преодоления всей
// ступени”»): a figure whose bottommost cell in some column hangs in the air ABOVE
// that column's step, with the step's NOTCH (an empty cell flanked left+right by
// material) inside the air gap and a solid run of >3 cells beneath the gap, is
// bridging over the WHOLE step on the notch's airspace — the notch is not a
// support, so the bridge is illegal. The notch may instead be FILLED («но её можно
// заложить полученной фигурой»): a figure resting on the step top or seated in the
// notch is untouched (its bottom cell has material below). Discriminators verified:
//   - report (6) 25G11E13 stays LEGAL: its only hover (E11 over col 11) sits above
//     a 1-cell step (A11, run 1 ≤3), and F12 rests ON the col-12 stack top.
//   - report (5) 11E11C13 stays LEGAL: E11 hovers over the D11 notch whose run
//     below is 3 cells — 44a covers only steps taller than 3.
//   - report (11) F25@25H1F3 rejected: G2 hovers over the E2 notch (run A2-D2 = 4).
// Preconditions: cells non-colliding and in-bounds; postcondition: pure query;
// invariant: only tightens — it never accepts anything the other channels rejected.
function hoversOverForbiddenNotch(cells: Cells, filled: Set<string>, rows: number): boolean {
  const byCol = new Map<number, number>() // column -> the figure's bottommost row there
  for (const [r, c] of cells) {
    const cur = byCol.get(c)
    if (cur == null || r > cur) byCol.set(c, r)
  }
  for (const [c, bottom] of byCol) {
    if (bottom + 1 >= rows) continue
    if (filled.has(cellKey(bottom + 1, c))) continue // resting in this column — not hovering
    const gapTop = bottom + 1
    let st = gapTop
    while (st < rows && !filled.has(cellKey(st, c))) st++
    if (st >= rows) continue // the gap runs to the floor — no step is being bridged
    let run = 0
    for (let rr = st; rr < rows && filled.has(cellKey(rr, c)); rr++) run++
    if (run <= 3) continue // 44a covers only steps taller than 3 cells
    for (let rr = gapTop; rr < st; rr++) {
      const left = c > 0 && filled.has(cellKey(rr, c - 1))
      const right = c < COLS - 1 && filled.has(cellKey(rr, c + 1))
      if (left && right) return true // a notch of the tall step inside the bridged gap
    }
  }
  return false
}

// Sergey, 2026-09-09 (item 10 follow-up, same rule as the dead-cell "воздушный мешок"
// discussion, but for REAL-TIME move legality this time): "Смотрим проходит по габаритам
// или нет. Если нужен разворот на месте установки, то мешок должен быть на ячейку больше
// длинной стороны фигуры." — a figure that doesn't fit the corridor in its OWN final
// orientation the whole way can still legally get there if (a) some NARROWER orientation
// of the same figure can reach a real air pocket at/around the target through the existing
// (already-tested) width model above, and (b) that pocket is a fully clear square ONE CELL
// BIGGER than the figure's own longer side — his explicit sizing rule for how much room an
// in-place turn needs (not just enough to contain the figure, one more).
// Deliberately ADDITIVE only: this never rejects anything reachableCellsForWidth already
// accepts, it only widens acceptance for the specific "arrived narrow, turning into a real
// pocket" case — so it can't regress any of Sergey's already-verified real placements
// (F27 included) the way tightening reachableCellsForWidth itself did on 2026-09-08.
function hasTurningPocketNear(cells: Cells, filled: Set<string>, rows: number): boolean {
  const { w, h, minR, minC } = bboxSize(cells)
  const P = Math.max(w, h) + 1
  if (P > rows || P > COLS) return false
  const narrow = reachableCellsForWidth(filled, rows, minPassableWidth(cells))
  function squareOpen(r: number, c: number): boolean {
    if (r < 0 || c < 0 || r + P > rows || c + P > COLS) return false
    for (let rr = r; rr < r + P; rr++) {
      for (let cc = c; cc < c + P; cc++) {
        if (filled.has(cellKey(rr, cc))) return false
      }
    }
    return true
  }
  const prMin = Math.max(0, minR + h - P)
  const prMax = Math.min(minR, rows - P)
  const pcMin = Math.max(0, minC + w - P)
  const pcMax = Math.min(minC, COLS - P)
  // BUG FIX (Sergey, 2026-09-09): the pocket's own physical clearance (squareOpen)
  // says nothing about the >3-step rule -- a square can be entirely unfilled while
  // still spanning BOTH genuinely reachable territory (e.g. column 0, the entrance,
  // always open top-to-bottom) AND territory that's only unreachable because of a
  // real step >3 cells tall (e.g. the open air directly above a freshly-built stack).
  // The old check accepted the pocket if ANY cell anywhere in the whole padded square
  // was in `narrow` -- so a pocket that happened to graze column 0's always-open shaft
  // let a figure "teleport" past an unrelated wall it never actually climbed. Reported
  // live: F27 landed two of its own cells hovering mid-air over an empty column behind
  // a 5-cell wall, with column 0 (three columns further out) having nothing to do with
  // that delivery. Fix: only count a reachable cell as proof of access if it sits in one
  // of the COLUMNS THE FIGURE ITSELF OCCUPIES -- i.e. the target's own footprint is
  // genuinely reachable somewhere along its own columns (matching how a legitimate
  // "arrived via a narrower sub-path, now needs room to turn" case actually works: the
  // destination area is reachable in the width-1 sense, just not through the
  // width-filtered corridor) -- never a same-square coincidence with unrelated columns.
  const targetCols = new Set(cells.map(([, c]) => c))
  for (let pr = prMin; pr <= prMax; pr++) {
    for (let pc = pcMin; pc <= pcMax; pc++) {
      if (pr + P < minR + h || pc + P < minC + w) continue // must fully contain the target
      if (!squareOpen(pr, pc)) continue
      for (let rr = pr; rr < pr + P; rr++) {
        for (let cc = pc; cc < pc + P; cc++) {
          if (!targetCols.has(cc)) continue
          if (narrow.has(cellKey(rr, cc))) return true
        }
      }
    }
  }
  return false
}

export function hasDeliveryRoute(filled: Set<string>, rows: number): boolean {
  return reachableCells(filled, rows).size > 0
}

// TO_DO 44d: «После расположения груза игрок-грузчик должен иметь возможность вернуться
// к выходу контейнера, соблюдая всё то же правило высоты ступеней. Если это невозможно –
// игроку засчитывается поражение.»
//
// Where the loader stands after placing: AT the spot he worked from, per Sergey
// (2026-10-26, live report follow-up: «Обратный путь рассматриваем с места установки
// груза» — the return path is considered from the PLACE OF PLACEMENT, not from atop
// the stack). The loader sets the figure down while standing in the empty cell(s)
// adjacent to it — the same cells the delivery-reachability model already says he
// occupied to deliver it. So: the placement is "sealing" only if EVERY empty cell
// orthogonally adjacent to the just-placed cargo (4-neighborhood, post-placement
// board) is unreachable from the A0 entrance per reachableCells. If any neighbor cell
// is reachable, the loader is standing (or can stand) right there and simply walks
// back out over the same ≤3-step terrain (the step rule is symmetric up/down). The
// classic self-seal (climb a staircase in, place the load that walls off the gap you
// climbed through) kills exactly those adjacent cells' reachability, so it's caught;
// a placement on the open floor always has an adjacent reachable cell.
//
// `cells` = the just-placed cargo. A cargo with NO empty orthogonal neighbor at all
// (fully boxed in by filled cells / walls) contributed no standing spot the loader
// could have used — not sealed by this move.
export function hasReturnPath(filled: Set<string>, rows: number, cells?: Cells): boolean {
  const standing = new Set<string>()
  for (const [r, c] of cells ?? []) {
    // Empty cells orthogonally adjacent to the placed cargo — where the loader stands.
    const neighbors: [number, number][] = [
      [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
    ]
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue
      if (filled.has(cellKey(nr, nc))) continue // not a standing spot — solid cargo
      standing.add(cellKey(nr, nc))
    }
  }
  // No empty adjacent cell at all: the placement never offered the loader a spot at
  // the place of installation, so it can't be the thing that trapped him.
  if (standing.size === 0) return true
  // 44d semantics: the loader must be able to WALK BACK TO THE A0 EXIT under the
  // ≤3-step rule — that is exactly the column-0-seeded run model
  // (reachableCells: runs, ≤3 shelf bridges, notches as non-waypoints). A raw
  // sky-side flood is NOT equivalent (an earlier perf optimization flooded from
  // the open top row, which let the engine bury the entrance with a 4-step and
  // keep "returning" — Sergey, 2026-11-18 medium game: F21 21B1D0 sealed col 0,
  // then F22 was «спокойно перенесён» to the far end). reachableCells is cheap
  // here: the run propagation is memoized per board signature in rules.ts.
  const reachable = reachableCells(filled, rows)
  for (const spot of standing) {
    if (reachable.has(spot)) return true
  }
  return false
}

// RULE FIX (TO_DO 44g, Official_Rules.docx «Ограничения»: «Пустоты в контейнере...
// недоступные для дальнейшего заполнения, делают НЕВОЗМОЖНЫМ закрытие рядов, где они
// находятся (в конечном счёте учитываются только ряды полностью закрытые без пробелов)»,
// and sub-item 44g verbatim: «Ряд... отмечается закрытым, если все ячейки его заполнены
// установленными фигурами БЕЗ присутствия в них «мёртвых» ячеек»): a dead/X cell in a
// row/column makes that row/column UNCLOSEABLE, permanently. The previous version treated
// dead cells as "occupied" so a row whose every live cell was real cargo plus one walled-in
// X still counted as closed — the exact opposite of the canon. Dead cells now BLOCK closure.
export function closedRows(filled: Set<string>, rows: number, deadCells?: Set<string>): Set<number> {
  const out = new Set<number>()
  for (let r = 0; r < rows; r++) {
    let full = true
    for (let c = 0; c < COLS; c++) {
      const key = cellKey(r, c)
      if (!filled.has(key) || deadCells?.has(key)) { full = false; break }
    }
    if (full) out.add(r)
  }
  return out
}

// Vertical counterpart of closedRows, same dead-cell rule (44g covers both orientations).
// TO_DO.docx bug (2026-09-07): only horizontal rows were ever checked, so filling a full
// column never lit up green — the container is meant to close on either orientation
// ("ряд" covers both per Sergey's brief).
export function closedCols(filled: Set<string>, rows: number, deadCells?: Set<string>): Set<number> {
  const out = new Set<number>()
  for (let c = 0; c < COLS; c++) {
    let full = true
    for (let r = 0; r < rows; r++) {
      const key = cellKey(r, c)
      if (!filled.has(key) || deadCells?.has(key)) { full = false; break }
    }
    if (full) out.add(c)
  }
  return out
}

// A cell is "dead" — walled in, unreachable, PERMANENTLY, full stop — when no future
// placement, however the game continues from here, could ever legally deliver cargo
// there. That is a narrower claim than "unreachable right now": per MVP_Site_Spec's own
// "Ступеньки и проходимость" scheme, a >3 step is explicitly described as "разрешена, но
// временно непроходима... путь может открыться позже" (allowed, but TEMPORARILY
// impassable — the path can open later) — a player can always lower a step later by
// building up the shorter side, since heights only ever grow. checkPlacement/
// enumeratePlacements/hasDeliveryRoute correctly enforce that step rule against a real
// placement attempt RIGHT NOW (see reachableCells/reachableCellsForWidth above) — but
// "can't go there yet" is not the same claim as "can never go there," and only the
// second one should ever count a row/column as closed.
//
// REVERTED (Sergey, 2026-09-09, correcting the 2026-09-08 change below): a previous
// session folded the step/reachability rule into THIS function too — "a cell is dead if
// geometric enclosure OR its column is beyond the >3-step reach of A0" — reasoning that a
// column boxed in behind a tall neighbor would never actually get filled. Sergey caught
// this live: after one placement, several largely-empty rows/columns "closed themselves"
// even though there was plenty of room left and no permanent obstruction — his own words,
// "мёртвые клетки наоборот делают ряды незакрываемыми. А здесь те ячейки и не являются
// мёртвыми... эта временная блокировка снимается" (dead cells are supposed to make rows
// UNcloseable, not close them — and these cells aren't dead at all, since the temporary
// blockage lifts once the shorter side gets built up). He's right: conflating "temporarily
// unreachable this instant" with "permanently dead" was the actual mistake, not (only) a
// modeling-precision bug in how reachability was computed. Back to the ORIGINAL
// (2026-09-07) definition below — pure geometric enclosure, nothing else. Sergey's
// earlier confirmation on the geometric half specifically still holds and is unaffected
// by this revert: no reasoning about which figures remain, no exact-cover search, nothing
// that amounts to "well, some shape *might* still fit" — "не пронести никакого груза
// сквозь стены ... никакие оставшиеся в наличии фигуры не спасут, эти ячейки тупо
// ЗАМУРОВАНЫ первой же загрузкой." A cell that has SOME empty-cell path to the open top
// of the container is left alone — no feasibility hint, no step-reachability precomputation
// — "дверь открыта — пусть пробует зайти" (the door's open, let them try): the player
// attempts a real placement and checkPlacement (a real-time check, not a permanence claim)
// is the only judge of whether THIS attempt, right now, succeeds.
export function computeDeadCells(filled: Set<string>, rows: number): Set<string> {
  // 44f («Ячейка считается «мёртвой», если она закрыта со всех сторон») — the container's
  // boundary is CLOSED on every side (walls, floor AND the ceiling — Sergey, 2026-11-19,
  // report of 00:03: after the engine's F04@04K9H9 the ceiling-adjacent pockets left of
  // the col-12 wall were not marked dead: «не отметил «мёртвые» ячейки — сверху закрыто
  // потолком»). The only OPENING is the entrance at the bottom of column 0, so an empty
  // region is fillable exactly when it connects to column 0's air through empty cells;
  // everything else is dead. This also honors the 2026-11-19 canon «пока есть хоть
  // какой-то проход, даже только для mono — ряд не считается мёртвым»: a cave with any
  // empty-cell path from the entrance column stays alive regardless of step heights
  // (pure geometry; practical reachability is the engine's pocketStranding concern).
  // Historical note: the flood used to seed the TOP row (an open-sky fiction) — it both
  // missed ceiling-sealed regions and wrongly killed entrance-connected caves.
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const open = new Set<string>()
  const stack: string[] = []
  for (let r = 0; r < rows; r++) {
    const key = cellKey(r, 0)
    if (!filled.has(key)) { open.add(key); stack.push(key) }
  }
  while (stack.length) {
    const cur = stack.pop()!
    const [cr, cc] = cur.split(',').map(Number)
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue
      const nk = cellKey(nr, nc)
      if (!filled.has(nk) && !open.has(nk)) { open.add(nk); stack.push(nk) }
    }
  }
  const dead = new Set<string>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = cellKey(r, c)
      if (!filled.has(key) && !open.has(key)) dead.add(key)
    }
  }
  return dead
}

export interface MoveResult {
  ok: boolean
  reason?: string
  cells?: Cells
  overhangRatio?: number
  needsFairPlay?: boolean
  // TO_DO 44d: the move itself is legal, but with it in place the loader can no longer
  // walk back to the A0 exit under the ≤3-step rule — the UI declares the loss per 44d.
  sealsExit?: boolean
}

// A placement cell is "vertically grounded" if it rests on the true floor, on
// PRE-EXISTING filled material directly below it in the SAME column, or on another
// cell of THIS SAME placement directly below it (transitively) in the SAME column.
// Horizontal (same-row, different-column) adjacency within the placement does NOT
// count -- see the comment above the new check in checkPlacement for why.
function verticallyGroundedCells(cells: Cells, filled: Set<string>, rows: number): Set<string> {
  const grounded = new Set<string>()
  const sorted = [...cells].sort((a, b) => b[0] - a[0]) // bottom (largest r) first
  for (const [r, c] of sorted) {
    if (r === rows - 1 || filled.has(cellKey(r + 1, c)) || grounded.has(cellKey(r + 1, c))) {
      grounded.add(cellKey(r, c))
    }
  }
  return grounded
}

export function checkPlacement(cells: Cells | null, filled: Set<string>, rows: number, fairPlayApproved = false): MoveResult {
  if (!cells) return { ok: false, reason: 'Notation does not match this figure’s reference dots' }
  if (!inBounds(cells, rows)) return { ok: false, reason: 'Placement goes outside the container' }
  if (collides(cells, filled)) return { ok: false, reason: 'Cell already occupied' }
  // BUG FIX (Sergey, 2026-09-08): "Stepenki i prokhodimost'" (MVP_Rules.docx) -- a step
  // taller than 3 cells "temporarily blocks further progress of cargo through it" --
  // was never actually checked against a SPECIFIC placement's own target column, only
  // against the board as a whole staying non-dead-ended (hasDeliveryRoute below).
  // Reported live: a 5-cell drop sitting mid-container did nothing to stop cargo being
  // placed straight into the far side of it. This is a hard rule, independent of
  // overhang/fair-play (a piece can be fully supported and still be unreachable if
  // getting there requires crossing a >3 step) -- and symmetric: a too-tall climb is
  // blocked exactly like a too-deep descent, per reachableCells above. (2026-09-09: this
  // now checks each target CELL against the per-run reachability model, not just its
  // column — see reachableCells's comment for why the column-level version wrongly
  // sealed off genuinely-open low cells sitting under an unrelated tall stack.)
  // A cell that is VERTICALLY GROUNDED (see verticallyGroundedCells below -- rests on
  // the floor, on pre-existing material directly below it in the SAME column, or on
  // another cell of this same placement directly below it, transitively) still needs a
  // DELIVERY ROUTE: the old blanket exemption («contiguous stacking is never traveling»)
  // let the engine set F17 through a 2-cell passage beside B12 (Sergey, 2026-11-18,
  // report (3): «установлена F17 на 17C14A12 через проход в две ячейки»). The grounding
  // set is kept ONLY for the shelf cap further down (no climbing gear for a sideways
  // reach); the delivery question itself is answered by deliveryReachable — envelope
  // transit + own-cells arrival, see the model comment above it.
  const vGroundedEarly = verticallyGroundedCells(cells, filled, rows)
  const minWidth = minPassableWidth(cells)
  const fitsDirectly = deliveryReachable(filled, rows, cells)
  if (!fitsDirectly && !hasTurningPocketNear(cells, filled, rows) && !loaderLoweringReachable(filled, rows, cells)) {
    const reason = minWidth > 1
      ? `Cargo can’t reach this spot — this figure needs a ${minWidth}-cell-wide passage and none reaches here (or a step taller than 3 cells blocks the path)`
      : 'Cargo can’t reach this spot — a step taller than 3 cells blocks the path from the entrance (build an intermediate step first)'
    return { ok: false, reason, cells }
  }
  // 44a (Sergey, 2026-11-19, report of 10:31, engine F25@25H1F3): the notch of a
  // >3-cell solid step is not a support — a piece may not bridge over the whole step
  // hovering above the notch; it must rest on the step or fill the notch instead.
  if (hoversOverForbiddenNotch(cells, filled, rows)) {
    return {
      ok: false,
      reason: 'Per rule 44a, a notch in a solid step taller than 3 cells is not a support — the piece may not bridge over it without filling the notch',
      cells,
    }
  }
  // BUG FIX (Sergey, 2026-09-10): the run-based model above deliberately treats an
  // ENTIRE open run as reachable once its shelf matches the usual +/-3 rule (2026-09-09
  // fix, for a genuinely open pocket under an unrelated tall pile). But a run spanning a
  // totally virgin (or barely-built) column is "open" all the way to the container's true
  // top -- so that same rule let a piece's own RIGID overhang arm land at ANY height in a
  // neighboring column, as long as some other part of the SAME piece touched a tall
  // pillar elsewhere (that pillar being reachable was enough to mark the WHOLE neighboring
  // run "reachable", top included). Reported live: the opponent capped its own solid
  // 5-tall column with a plus-shaped figure whose two side arms landed on completely bare,
  // floor-height neighbor columns -- no notch, no >50% overhang trigger, just a >3-cell
  // reach with nothing underneath. Fix: any placement cell that is NOT vertically grounded
  // (see verticallyGroundedCells -- same-column chain down to real material) must sit
  // within 3 rows of ITS OWN column's actual current shelf (colHeights, not the run's
  // floor-to-ceiling span). A cell resting on pre-existing material, or stacked straight
  // up within the same column as one that does (an upright vertical figure, say), is
  // untouched by this -- only a SIDEWAYS reach into a different column's air space is
  // capped, which is exactly the "no climbing gear" principle already agreed for notches,
  // applied here to bare/under-built columns instead of internal pockets.
  const heights = colHeights(filled, rows)
  // Shelf-cap exemption (Sergey, 2026-11-19, report (6) case 25G11E13): a RIGID piece
  // resting on real material (world support) with at most the overhang rule's ordinary
  // ≤50 % tolerance is held by its bearings — «фигура имела 2 опоры D13 и E12, на
  // которые приходила большая часть веса» — its unsupported cells dangle by the
  // piece's own rigidity, not by climbing gear. The 2026-09-10 pillar case that
  // created this cap stays blocked: there oh = 4/5 = 0.8 > 0.5. NOTE: the blocker for
  // 25G11E13 was THIS cap, not fair play (oh = 0.429) and not delivery (the lowering
  // channel passes it) — the cap message was simply shared by both rejection sites.
  const ohEarly = overhangRatio(cells, filled, rows)
  const shelfExempt = ohEarly <= 0.5 && hasWorldSupport(cells, filled, rows)
  for (const [r, c] of cells) {
    if (vGroundedEarly.has(cellKey(r, c))) continue
    const shelf = rows - heights[c] - 1
    if (!shelfExempt && shelf - r > 3) {
      // Sergey, 2026-11-19 (report of 12:28, F25@25E8G10): a >50 % dangle over a 3-tall
      // stepped shelf must reach the FAIR-PLAY stage, not die here — rule 03 lets the
      // players confirm any overhang bilaterally; the cap only speaks for the ≤50 %
      // rigid tolerance. An approved fair play skips the cap entirely.
      if (ohEarly > 0.5) {
        if (!hasWorldSupport(cells, filled, rows)) {
          return { ok: false, reason: 'No support — this placement doesn’t rest on the floor or on any existing piece anywhere', overhangRatio: ohEarly, cells }
        }
        if (!fairPlayApproved) {
          return { ok: false, reason: `${Math.round(ohEarly * 100)}% unsupported — needs fair-play confirmation from both players`, overhangRatio: ohEarly, needsFairPlay: true, cells }
        }
        continue
      }
      return {
        ok: false,
        reason: 'Cargo can’t reach this spot — a step taller than 3 cells blocks the path from the entrance (build an intermediate step first)',
        cells,
      }
    }
  }
  const oh = ohEarly
  // Rule 01 "Support" is a HARD rule with no fair-play exception — distinct from Rule 03
  // "Overhang" below (which tolerates up to 50% unsupported outright, up to 100% via
  // bilateral fair-play). Checked via hasWorldSupport, NOT via oh >= 1 — a figure can be
  // internally self-supporting (oh well under 1) while still touching nothing real.
  if (!hasWorldSupport(cells, filled, rows)) {
    return { ok: false, reason: 'No support — this placement doesn’t rest on the floor or on any existing piece anywhere', overhangRatio: oh, cells }
  }
  if (oh > 0.5 && !fairPlayApproved) {
    return { ok: false, reason: `${Math.round(oh * 100)}% unsupported — needs fair-play confirmation from both players`, overhangRatio: oh, needsFairPlay: true, cells }
  }
  // TO_DO 44d/44e (2026-10, "всё как в реале"): the system must NOT rescue the player from
  // sealing off the return path. 44e verbatim: «Игроку разрешается располагать грузы
  // согласно правилам. Дальнейшая возможность его действий на момент отгрузки фигуры-груза
  // системой не рассматривается... Запер себя в контейнере, не можешь пройти к месту
  // установки груза — проиграл.» The old hasDeliveryRoute rejection here removed a legal
  // move that a real referee would allow (and the loss it causes would be the player's own).
  // A move is legal if it is in-bounds, non-colliding, reachable, supported and not an
  // unconfirmed >50% overhang; whether the player can still GET OUT afterwards is checked
  // separately (hasReturnPath below) and reported as `sealsExit` so the UI can declare the
  // 44d loss instead of silently refusing the move.
  const nextFilled = new Set(filled)
  cells.forEach(([r, c]) => nextFilled.add(cellKey(r, c)))
  const returnPath = hasReturnPath(nextFilled, rows, cells)
  return { ok: true, cells, overhangRatio: oh, sealsExit: !returnPath }
}

// Brute-force search used by "no legal placement = loss" and by the opponent
// engine below. Grid is small (≤15×11) so trying every orientation × every
// anchor cell is cheap.
//
// Shared placement legality for the two enumeration modes (2026-11-19):
//  • 'competent' — the opponent engine's move-generator filter (TO_DO 30 plumbing,
//    2026-11-17): never asks for fair play, never seals its own exit (44d).
//    Changing a rule means changing checkPlacement; this only reuses its semantics.
//  • 'honest44e' — per TO_DO 44e («Игроку разрешается располагать грузы согласно
//    правилам… Запер себя в контейнере — проиграл») a load with >50 % overhang is
//    still placeable (fair-play-confirmable — the verdict may be «yes»), and a
//    load that seals the exit is placeable too: the 44d loss is declared AFTER it
//    lands, not as «нет легальной остановки». Sergey 2026-11-19, report (4)
//    endgame: the engine's F05 had exactly one placement (05E0A0 in column 0,
//    exit-sealing) and the system ended the game as a forced pass — premature.
//    Used ONLY by the forced-pass/loss detection (canPlaceAnywhere) and the
//    engine's desperate last-resort fallback; never by normal move generation.
// Optional precomputed artifacts for one enumerateLegal pass: `base` = reachableCells
// for the CURRENT board (board-constant), `visited` = transit anchors for the
// CURRENT orientation (orientation-constant). Pure performance plumbing.
interface DeliveryPre { base: Set<string>; visited: Set<string> }

function placementLegality(cells: Cells, filled: Set<string>, rows: number, pre: DeliveryPre | undefined, mode: 'competent' | 'honest44e'): boolean {
  if (!inBounds(cells, rows) || collides(cells, filled)) return false
  // Same delivery model as checkPlacement (see deliveryReachable): silhouette transit +
  // own-cells arrival, plus the two additive side channels (turning pocket, loader
  // lowering). The old vertically-grounded exemption is gone — a floor stack must
  // still be DELIVERABLE (Sergey, 2026-11-18: the engine set F17 through a 2-cell
  // passage beside B12; the grounded-stacking case 24C11A12 stays legal via arrival).
  const delivery = pre
    ? deliveryReachableCore(cells, rows, pre.base, pre.visited)
    : deliveryReachable(filled, rows, cells)
  if (!delivery && !hasTurningPocketNear(cells, filled, rows) && !loaderLoweringReachable(filled, rows, cells)) return false
  // 44a structural notch rule (see hoversOverForbiddenNotch): same rejection as
  // checkPlacement so the engine's move generator never emits these bridges.
  if (hoversOverForbiddenNotch(cells, filled, rows)) return false
  if (!hasWorldSupport(cells, filled, rows)) return false // never a legal move, not even via fair play
  const ohRatio = overhangRatio(cells, filled, rows)
  if (mode === 'competent' && ohRatio > 0.5) return false // engine plays fair-play-clean moves only, by design
  // The 2026-09-10 shelf cap from checkPlacement («нет лестничного снаряжения»):
  // a placement cell that is not vertically grounded must sit within 3 rows of
  // its OWN column's current shelf. Without this the move generator could emit
  // placements checkPlacement itself rejects — Sergey, 2026-11-18 live game:
  // the engine's F15 at H1/F0 hovered over an empty column 0 (shelf gap 7).
  // Same rigid-body exemption as checkPlacement (report (6), 25G11E13): world-
  // supported placements within the ≤50 % overhang tolerance dangle by rigidity.
  const shelfExempt = ohRatio <= 0.5 // world support already verified above
  const grounded = verticallyGroundedCells(cells, filled, rows)
  const heights = colHeights(filled, rows)
  for (const [r, c] of cells) {
    if (grounded.has(cellKey(r, c))) continue
    if (!shelfExempt && rows - heights[c] - 1 - r > 3 && ohRatio <= 0.5) return false
    // ohRatio > 0.5: competent mode still rejects below via its own fair-play-clean
    // check; honest44e keeps fair-play-pending loads placeable (44e) — Sergey,
    // 2026-11-19, report of 12:28 (F25@25E8G10 must reach the fair-play stage).
  }
  if (mode === 'honest44e') return true
  const nextFilled = new Set(filled)
  cells.forEach(([rr, cc]) => nextFilled.add(cellKey(rr, cc)))
  return hasReturnPath(nextFilled, rows, cells)
}


// Enumerates the figure's legal placements in orientation order, stopping at
// `limit` results or as soon as `accept` says "this one is enough".
// `mode` (2026-11-19): 'competent' = the engine's normal generator; 'honest44e' =
// every rules-legal placement including fair-play-confirmable and exit-sealing
// ones — see placementLegality for the canon source.
// Preconditions: `rows` matches the active container; postconditions: every
// returned placement passes placementLegality; invariant: never relaxes game rules.
function enumerateLegal(figure: FigureDef, filled: Set<string>, rows: number, accept: ((cells: Cells) => boolean) | null, limit: number, mode: 'competent' | 'honest44e' = 'competent'): Cells[] {
  const out: Cells[] = []
  for (const ori of getOrientations(figure.cells)) {
    const pre: DeliveryPre = { base: reachableCells(filled, rows), visited: envelopeTransitAnchors(filled, rows, ori) }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const cells = ori.map(([dr, dc]) => [dr + r, dc + c] as [number, number])
        if (!placementLegality(cells, filled, rows, pre, mode)) continue
        // Existence mode: `accept` decides, never the fill count — with limit=1
        // the fill-count check alone would return the FIRST legal placement
        // even when it does not satisfy accept (a false positive).
        if (accept != null) {
          if (accept(cells)) return [cells]
          continue
        }
        out.push(cells)
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

export function enumeratePlacements(figure: FigureDef, filled: Set<string>, rows: number, limit = Infinity): Cells[] {
  return enumerateLegal(figure, filled, rows, null, limit)
}

/** Checks whether the figure has any HONESTLY legal placement (44e): includes
 * fair-play-confirmable (>50 % overhang, verdict pending) and exit-sealing loads —
 * the loss they cause is declared by 44d AFTER the load lands, never as a forced
 * pass while a rules-legal move exists. Sergey 2026-11-19, report (4): the
 * engine's last F05 could still be placed at 05E0A0 (column 0, exit-sealing) but
 * the competent filter hid it and the game ended «как сдача».
 * Preconditions: `rows` matches the active container; postcondition: pure query;
 * invariant: never relaxes game rules — only the 44e placement right.
 */
export function canPlaceAnywhere(figure: FigureDef, filled: Set<string>, rows: number): boolean {
  return enumerateLegal(figure, filled, rows, null, 1, 'honest44e').length > 0
}

/** All honestly legal placements in 'competent'-unreachable situations: the
 * engine's desperate last-resort list (fair-play-pending and exit-sealing loads
 * included). Normal move generation keeps using enumeratePlacements.
 * Preconditions: `rows` matches the active container; postcondition: pure query.
 */
export function enumerateAllLegal(figure: FigureDef, filled: Set<string>, rows: number, limit = Infinity): Cells[] {
  return enumerateLegal(figure, filled, rows, null, limit, 'honest44e')
}

/** True iff the figure has at least one legal placement covering `target`.
 * Used by the opponent engine's floor-flexibility metric (TO_DO 30d, 2026-11-17:
 * "держать колонку 14 до последнего — А13 можно закрыть только с помощью F01").
 * Preconditions: `target` inside the container; postconditions: same legality as
 * enumeratePlacements; invariant: pure query, no board mutation.
 */
export function canPlaceCovering(figure: FigureDef, filled: Set<string>, rows: number, target: { r: number; c: number }): boolean {
  return enumerateLegal(figure, filled, rows, (cells) => cells.some(([r, c]) => r === target.r && c === target.c), 1).length > 0
}

// Placement-quality heuristic for the opponent engine. Earlier version only rewarded
// closing rows and staying low, which — since most moves close nothing — collapsed to
// "always pick the lowest spot" and looked aimless rather than the systematic left-to-right
// (or bottom-up) packing a competent human plays. Now also rewards a flat, even skyline
// (no lone tall spikes / no scattered gaps) and packing tight against what's already
// placed, which in practice makes the greedy choice sweep the container methodically.
export function scorePlacement(cells: Cells, filled: Set<string>, rows: number): number {
  const nextFilled = new Set(filled)
  cells.forEach(([r, c]) => nextFilled.add(cellKey(r, c)))

  const deadBefore = computeDeadCells(filled, rows)
  const deadAfter = computeDeadCells(nextFilled, rows)

  const closedBefore = closedRows(filled, rows, deadBefore).size + closedCols(filled, rows, deadBefore).size
  const closedAfter = closedRows(nextFilled, rows, deadAfter).size + closedCols(nextFilled, rows, deadAfter).size
  const rowGain = (closedAfter - closedBefore) * 1000 // closing a row/column dominates every other factor

  const newDeadCells = deadAfter.size - deadBefore.size
  const deadPenalty = newDeadCells > 0 ? newDeadCells * 1500 : 0

  const avgDepth = cells.reduce((s, [r]) => s + (rows - 1 - r), 0) / cells.length // 0 = floor

  const afterHeights = colHeights(nextFilled, rows)
  const meanH = afterHeights.reduce((a, b) => a + b, 0) / afterHeights.length
  const heightVariance = afterHeights.reduce((s, h) => s + (h - meanH) ** 2, 0) / afterHeights.length

  // Reward hugging already-placed cells (orthogonal neighbors) — a human packs tight
  // against the existing stack instead of scattering pieces around the container.
  const own = new Set(cells.map(([r, c]) => cellKey(r, c)))
  let touching = 0
  for (const [r, c] of cells) {
    const neighbors: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    for (const [nr, nc] of neighbors) {
      const k = cellKey(nr, nc)
      if (filled.has(k) && !own.has(k)) touching++
    }
  }

  // Extra nudge away from piling straight up at the entrance column (0,0/A0). avgDepth
  // and heightVariance already discourage tall, uneven stacks in general, but the
  // entrance specifically deserves to stay clear longer than "just don't fully seal
  // it" (hasReturnPath now filters those outright in enumeratePlacements — TO_DO 44d —
  // so this is only a soft preference among already-exit-safe moves, as intended) --
  // a competent human builds outward from the far end of the floor row first, not
  // straight up at the door.
  const entranceHeight = afterHeights[0]

  // TO_DO 30: «Старается оставлять высоту ступеней <4 ячеек» — every adjacent-column
  // pair whose height difference reaches the 4-cell step limit is terrain the opponent
  // (and this engine itself) can no longer cross with a load, even though creating
  // such a step is legal. Each >=4 step formed by THIS placement is penalized; the
  // square (>=8) cases, which wall off a whole column band, are penalized harder
  // because they split the container's floor into disconnected zones.
  let stepCount = 0, wallCount = 0
  for (let c = 0; c + 1 < COLS; c++) {
    const diff = Math.abs(afterHeights[c] - afterHeights[c + 1])
    if (diff >= 8) { wallCount++; stepCount++ }
    else if (diff >= 4) stepCount++
  }
  const stepPenalty = stepCount * 60 + wallCount * 120

  return rowGain - avgDepth * 2 - heightVariance * 3 + touching * 5 - entranceHeight * 1.5 - stepPenalty - deadPenalty
}
