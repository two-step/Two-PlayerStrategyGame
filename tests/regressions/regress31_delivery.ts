// Regression: delivery model (envelope transit + own-cells arrival).
// Encodes Sergey's 2026-11-18 rulings: F17@17C14A12 («проход в две ячейки») is ILLEGAL;
// the blessed T 24C11A12 under the lintel stays LEGAL; all replayable moves of the
// 2026-11-18 games stay legal. Run:
//   node --experimental-transform-types _to_delete/regress31_delivery.ts
// Run: node --experimental-transform-types _to_delete/regress31_delivery.ts
import { existsSync, readFileSync } from 'node:fs'

const ROWS = 11
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup;
// try both locations so the regressions survive.
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete']
  .map((p) => `${p}/otgruzka_figures.json`)
  .find((p) => existsSync(p))!
const src = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = src.figures.map((f: any) => ({
  id: f.id, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells,
  dots: f.reference_dots.map(([r, c]: any) => f.cells.findIndex((p: any) => p[0] === r && p[1] === c)),
}))
const byId = (id: number) => figures.find((f) => f.id === id)!
const rules: any = await import(new URL('../../src/engine/rules.ts', import.meta.url).href)
const cellName = (r: number, c: number) => `${'ABCDEFGHIJK'[10 - r]}${c}`

function parsePts(notation: string) {
  const m = notation.match(/^(\d{2})((?:[A-K]\d{1,2}){1,2})$/)!
  const pts: { r: number; c: number }[] = []
  for (const x of m[2].matchAll(/([A-K])(\d{1,2})/g)) {
    pts.push({ r: ROWS - 1 - 'ABCDEFGHIJK'.indexOf(x[1]), c: parseInt(x[2]) })
  }
  return { figId: parseInt(m[1], 10), pts }
}
function allSolutions(figId: number, pts: { r: number; c: number }[]) {
  const fig = byId(figId)
  const [d0, d1] = fig.dots
  const out: [number, number][][] = []
  if (fig.dots.length < 2) {
    for (let i = 0; i < 4; i++) out.push(rules.computePlacementFromAnchor(fig, i, pts[0]))
    return out
  }
  // Canon priority: the forward pairing (point1 → dot1) is tried against ALL orientations
  // before the reversed pairing — same rule as computePlacementFromDots.
  for (const [p0, p1] of [[pts[0], pts[1]], [pts[1], pts[0]]] as any) {
    rules.getOrientations(fig.cells).forEach((ori: [number, number][]) => {
      const a = ori[d0], b = ori[d1]
      if (p1.r - p0.r === b[0] - a[0] && p1.c - p0.c === b[1] - a[1]) {
        out.push(ori.map(([r, c]: any) => [r + p0.r - a[0], c + p0.c - a[1]]))
      }
    })
  }
  return out
}

let failures = 0
function expect(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

function buildBoard(moves: [number, string][]): Set<string> {
  const out = new Set<string>()
  for (const [id, n] of moves) {
    const { pts } = parsePts(n)
    const cells = allSolutions(id, pts)[0]
    cells.forEach(([r, c]: any) => out.add(`${r},${c}`))
  }
  return out
}
function placeFigure(filled: Set<string>, id: number, n: string): any {
  const { pts } = parsePts(n)
  return allSolutions(id, pts)[0]
}

// --- Case 1: F17 @ 17C14A12 on the (3) board must now be REJECTED ---
const board1 = new Set<string>()
allSolutions(25, parsePts('25C10A8').pts)[0].forEach(([r, c]) => board1.add(`${r},${c}`))
const f16 = byId(16)
for (let i = 0; i < 4; i++) {
  const c = rules.computePlacementFromAnchor(f16, i, { r: 9, c: 11 })
  if (rules.checkPlacement(c, board1, ROWS).ok) { c.forEach(([r, c]: any) => board1.add(`${r},${c}`)); break }
}
const sols17 = allSolutions(17, parsePts('17C14A12').pts)
const placed17 = sols17.find((s) => rules.checkPlacement(s, board1, ROWS).ok)
expect('F17@17C14A12 now REJECTED by checkPlacement', !placed17)
if (placed17) console.log('   still-legal cells:', placed17.map(([r, c]) => cellName(r, c)).join(' '))

// --- Case 2: blessed T 24C11A12 stays LEGAL ---
const board2 = new Set<string>()
const f20cells = allSolutions(20, parsePts('20A14C12').pts).find((c) => rules.inBounds(c, ROWS) && rules.checkPlacement(c, new Set(), ROWS).ok)!
f20cells.forEach(([r, c]) => board2.add(`${r},${c}`))
const t = allSolutions(24, parsePts('24C11A12').pts).find((s) => rules.checkPlacement(s, board2, ROWS).ok)
expect('blessed T 24C11A12 stays LEGAL', !!t)
if (t) console.log('   T cells:', [...t].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([r, c]) => cellName(r, c)).join(' '))

// --- Case 3: easy-game replayable moves all stay LEGAL ---
const easyTurns: [string, number, string][] = [
  ['opp', 16, '16B11'], ['you', 14, '14B13A14'], ['opp', 11, '11C5A7'], ['you', 3, '03D14B14'],
  ['opp', 20, '20A4C2'], ['you', 6, '06B12A11'], ['opp', 24, '24D8E10'], ['you', 8, '08A8B10'],
  ['you', 18, '18A5C7'], ['you', 12, '12A3B5'],
]
const boards: Record<string, Set<string>> = { opp: new Set(), you: new Set() }
let easyOk = 0, easyTotal = 0
for (const [who, figId, n] of easyTurns) {
  const { pts } = parsePts(n)
  const sols = allSolutions(figId, pts)
  const placed = sols.find((s) => rules.checkPlacement(s, boards[who], ROWS).ok)
  easyTotal++
  if (placed) { easyOk++; placed.forEach(([r, c]) => boards[who].add(`${r},${c}`)) }
  else console.log(`   easy-game move now rejected: ${who} ${n}`)
}
expect(`easy game: all ${easyOk}/${easyTotal} replayable moves stay LEGAL`, easyOk === easyTotal)

// --- Case 4: report (3) other moves stay LEGAL ---
const opp3 = new Set<string>()
let ok3 = 0
for (const [figId, n] of [[25, '25C10A8'], [16, '16B11']] as [number, string][]) {
  const { pts } = parsePts(n)
  const placed = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, opp3, ROWS).ok)
  if (placed) { ok3++; placed.forEach(([r, c]) => opp3.add(`${r},${c}`)) }
  else console.log(`   (3) opp move now rejected: ${n}`)
}
const you3 = new Set<string>()
for (const [figId, n] of [[23, '23B11A9'], [3, '03A11A13']] as [number, string][]) {
  const { pts } = parsePts(n)
  const placed = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, you3, ROWS).ok)
  if (placed) { ok3++; placed.forEach(([r, c]) => you3.add(`${r},${c}`)) }
  else console.log(`   (3) your move now rejected: ${n}`)
}
expect('report (3): the other 4 moves stay LEGAL', ok3 === 4)

// --- Case 4b (Sergey 2026-11-19, report 15:26 medium game): F11 (W-staircase) must be
// deliverable into a 2-cell-wide stepped pocket — 11C5A7 on the reconstructed board
// (after 24C13A14, 26A11B8, 12A3B5, 06C11B12, 25E10C12). The old full-envelope transit
// wrongly rejected it because the envelope's open corner gap passed over the occupied B5.
const board11 = new Set<string>()
for (const [figId, n] of [[24, '24C13A14'], [26, '26A11B8'], [12, '12A3B5'], [6, '06C11B12'], [25, '25E10C12']] as [number, string][]) {
  const placed = allSolutions(figId, parsePts(n).pts).find((s) => rules.checkPlacement(s, board11, ROWS).ok)
  if (placed) placed.forEach(([r, c]) => board11.add(`${r},${c}`))
  else console.log(`   report-15:26 board: move rejected: ${n}`)
}
const placed11 = allSolutions(11, parsePts('11C5A7').pts).find((s) => rules.checkPlacement(s, board11, ROWS).ok)
expect('F11@11C5A7 (2-wide stepped pocket, report 15:26) is LEGAL', !!placed11)
if (placed11) console.log('   F11 cells:', placed11.map(([r, c]: any) => cellName(r, c)).join(' '))

// --- Case 5b (Sergey 2026-11-19, report of 10:31, engine move 16 F25@25H1F3):
// the U-bridge hovers over the E2 notch of the col-2 4-cell step — 44a «выемка в
// сплошной ступени >3-х ячеек не считается опорой для преодоления всей ступени».
// Must be REJECTED; the report-(6) shelf case 25G11E13 stays LEGAL (its only hover
// sits over a 1-cell step and F12 rests on the col-12 stack top).
{
  const r11Moves: [number, string][] = [[21, '21B11A9'], [12, '12A7B9'], [10, '10B6D8'], [16, '16B2'], [20, '20D10B12'], [27, '27F5C6'], [18, '18C3E1']]
  const r11 = buildBoard(r11Moves)
  const u25 = placeFigure(r11, 25, '25H1F3')
  expect('F25@25H1F3 (hover over the E2 notch, run 4) is REJECTED by checkPlacement', !rules.checkPlacement(u25, r11, ROWS).ok)
  const r6Moves: [number, string][] = [[12, '12C13A14'], [7, '07B8A9'], [15, '15A7B5'], [22, '22B6D7'], [14, '14B12A13'], [1, '01A10'], [18, '18E12C14']]
  const r6 = buildBoard(r6Moves)
  const shelf25 = placeFigure(r6, 25, '25G11E13')
  expect('report (6) shelf case 25G11E13 stays LEGAL', rules.checkPlacement(shelf25, r6, ROWS).ok)
}

// --- Case 5: engine never picks F17@17C14A12 anymore on that board ---
import { readFileSync as rf, writeFileSync as wf, mkdirSync as mk, rmSync as rm } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const tmp = resolve('tmp_engine')
mk(tmp, { recursive: true })
wf(resolve(tmp, 'rules.ts'), readFileSync('src/engine/rules.ts', 'utf8'))
wf(resolve(tmp, 'opponentEngine.ts'), readFileSync('src/engine/opponentEngine.ts', 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const engMod: any = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const createOpponentEngine = engMod.createOpponentEngine
const srcAll = figures
const used = new Set([25, 16])
const engine = createOpponentEngine({ difficulty: 'medium' })
const ctx = { rows: ROWS, ownFilled: board1, ownAvailable: srcAll.filter((f) => !used.has(f.id)), humanFilled: new Set(), humanAvailable: srcAll.filter((f) => !used.has(f.id)) }
const d = engine.decidePlacement(byId(17), board1, ROWS, ctx)
if (d.kind === 'place') {
  const notation = rules.formatNotation(17, byId(17).dots.map((i: number) => ({ r: d.cells[i][0], c: d.cells[i][1] })), ROWS)
  console.log(`   engine now places F17 as ${notation} (cells ${d.cells.map(([r, c]: any) => cellName(r, c)).join(' ')})`)
  expect('engine F17 placement is checkPlacement-legal', rules.checkPlacement(d.cells, board1, ROWS).ok)
} else {
  console.log('   engine: F17 —', d.kind, d.message ?? '')
  expect('engine passes or places legally for F17', d.kind === 'pass')
}

console.log(failures === 0 ? '\nALL EXPECTATIONS MET' : `\n${failures} FAILURES`)
rm(tmp, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)
