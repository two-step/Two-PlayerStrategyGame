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

// ── Placement from reference-dot targets ───────────────────────────────────────
// Tries every distinct orientation and both point-orders (the notation doesn't
// say which target is dots[0] vs dots[1]); returns the first orientation whose
// two dot cells sit at exactly the requested relative offset from each other.
export function computePlacementFromDots(figure: FigureDef, targets: { r: number; c: number }[]): Cells | null {
  if (figure.dots.length < 2 || targets.length < 2) return null
  const orientations = getOrientations(figure.cells)
  const [d0, d1] = figure.dots
  const pairs: [{ r: number; c: number }, { r: number; c: number }][] = [
    [targets[0], targets[1]],
    [targets[1], targets[0]],
  ]
  for (const ori of orientations) {
    const local0 = ori[d0], local1 = ori[d1]
    for (const [t0, t1] of pairs) {
      const dr = t1.r - t0.r, dc = t1.c - t0.c
      const ldr = local1[0] - local0[0], ldc = local1[1] - local0[1]
      if (dr === ldr && dc === ldc) {
        const offR = t0.r - local0[0], offC = t0.c - local0[1]
        return ori.map(([r, c]) => [r + offR, c + offC])
      }
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

// Fraction of the new figure's cells that are NOT supported (not resting on the
// floor row, an existing filled cell, or another cell of the same figure).
// >0.5 needs the fair-play bilateral confirmation (MVP_Rules.docx, "Нависание").
export function overhangRatio(cells: Cells, filled: Set<string>, rows: number): number {
  const own = new Set(cells.map(([r, c]) => cellKey(r, c)))
  let unsupported = 0
  for (const [r, c] of cells) {
    const floor = r === rows - 1
    const below = cellKey(r + 1, c)
    if (!floor && !filled.has(below) && !own.has(below)) unsupported++
  }
  return cells.length ? unsupported / cells.length : 0
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
export function hasDeliveryRoute(filled: Set<string>, rows: number): boolean {
  const h = colHeights(filled, rows)
  const reachable = new Set<number>([0])
  let changed = true
  while (changed) {
    changed = false
    for (let c = 0; c < COLS - 1; c++) {
      if (Math.abs(h[c] - h[c + 1]) > 3) continue
      if (reachable.has(c) && !reachable.has(c + 1)) { reachable.add(c + 1); changed = true }
      if (reachable.has(c + 1) && !reachable.has(c)) { reachable.add(c); changed = true }
    }
  }
  for (const c of reachable) if (h[c] < rows) return true
  return false
}

export function closedRows(filled: Set<string>, rows: number): Set<number> {
  const out = new Set<number>()
  for (let r = 0; r < rows; r++) {
    let full = true
    for (let c = 0; c < COLS; c++) if (!filled.has(cellKey(r, c))) { full = false; break }
    if (full) out.add(r)
  }
  return out
}

export interface MoveResult {
  ok: boolean
  reason?: string
  cells?: Cells
  overhangRatio?: number
  needsFairPlay?: boolean
}

export function checkPlacement(cells: Cells | null, filled: Set<string>, rows: number, fairPlayApproved = false): MoveResult {
  if (!cells) return { ok: false, reason: 'Notation does not match this figure’s reference dots' }
  if (!inBounds(cells, rows)) return { ok: false, reason: 'Placement goes outside the container' }
  if (collides(cells, filled)) return { ok: false, reason: 'Cell already occupied' }
  const oh = overhangRatio(cells, filled, rows)
  if (oh > 0.5 && !fairPlayApproved) {
    return { ok: false, reason: `${Math.round(oh * 100)}% unsupported — needs fair-play confirmation from both players`, overhangRatio: oh, needsFairPlay: true, cells }
  }
  const nextFilled = new Set(filled)
  cells.forEach(([r, c]) => nextFilled.add(cellKey(r, c)))
  if (!hasDeliveryRoute(nextFilled, rows)) {
    return { ok: false, reason: 'This placement seals the container — no further cargo could ever be delivered', overhangRatio: oh, cells }
  }
  return { ok: true, cells, overhangRatio: oh }
}

// Brute-force search used by "no legal placement = loss" and by the opponent
// engine below. Grid is small (≤15×11) so trying every orientation × every
// anchor cell is cheap.
export function enumeratePlacements(figure: FigureDef, filled: Set<string>, rows: number): Cells[] {
  const out: Cells[] = []
  const orientations = getOrientations(figure.cells)
  for (const ori of orientations) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const cells = ori.map(([dr, dc]) => [dr + r, dc + c] as [number, number])
        if (!inBounds(cells, rows) || collides(cells, filled)) continue
        const oh = overhangRatio(cells, filled, rows)
        if (oh > 0.5) continue // engine plays fair-play-clean moves only, by design
        const nextFilled = new Set(filled)
        cells.forEach(([rr, cc]) => nextFilled.add(cellKey(rr, cc)))
        if (!hasDeliveryRoute(nextFilled, rows)) continue
        out.push(cells)
      }
    }
  }
  return out
}

export function canPlaceAnywhere(figure: FigureDef, filled: Set<string>, rows: number): boolean {
  return enumeratePlacements(figure, filled, rows).length > 0
}

// Simple placement-quality heuristic for the opponent engine: prefer placements
// that sit low (close to the floor) and finish/extend rows, since that's what
// wins the game (5 closed rows). Not claimed to be optimal play.
export function scorePlacement(cells: Cells, filled: Set<string>, rows: number): number {
  const nextFilled = new Set(filled)
  cells.forEach(([r, c]) => nextFilled.add(cellKey(r, c)))
  const closedBefore = closedRows(filled, rows).size
  const closedAfter = closedRows(nextFilled, rows).size
  const avgDepth = cells.reduce((s, [r]) => s + (rows - 1 - r), 0) / cells.length // 0 = floor
  return (closedAfter - closedBefore) * 100 - avgDepth
}
