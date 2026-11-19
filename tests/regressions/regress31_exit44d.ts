// Regression: 44d exit sealing vs entrance-stack height (Sergey's data points):
// stack 2 (F26) open, stack 3 (F25@25C0A2, report (4) move 10) open, stack 4 (F21@21B1D0) sealed.
// Run: node --experimental-transform-types _to_delete/regress31_exit44d.ts
// Run: node --experimental-transform-types _to_delete/regress31_exit44d.ts
import { existsSync, readFileSync } from 'node:fs'

const ROWS = 11
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map((p) => p + '/otgruzka_figures.json').find((p) => existsSync(p))!
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
  rules.getOrientations(fig.cells).forEach((ori: [number, number][]) => {
    for (const [p0, p1] of [[pts[0], pts[1]], [pts[1], pts[0]]] as any) {
      const a = ori[d0], b = ori[d1]
      if (p1.r - p0.r === b[0] - a[0] && p1.c - p0.c === b[1] - a[1]) {
        out.push(ori.map(([r, c]: any) => [r + p0.r - a[0], c + p0.c - a[1]]))
      }
    }
  })
  return out
}

let failures = 0
function expect(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

// --- Data point 1 (2026-11-18 medium game): F21@21B1D0 — entrance stack 4 must SEAL ---
// Reconstruct: entrance stack of exactly 4 in column 0 (rows 7-10 filled), rest empty.
const stack4: [number, number][] = []
const stack4Set = new Set<string>()
for (let r = 7; r <= 10; r++) { stack4.push([r, 0]); stack4Set.add(`${r},0`) }
expect('F21 case (entrance stack 4) still seals the exit', !rules.hasReturnPath(stack4Set, ROWS, stack4))

// --- Data point 2: F26 covering A0 (stack 2) — must stay open ---
const stack2: [number, number][] = []
const stack2Set = new Set<string>()
for (let r = 9; r <= 10; r++) { stack2.push([r, 0]); stack2Set.add(`${r},0`) }
expect('F26 case (entrance stack 2) stays open', rules.hasReturnPath(stack2Set, ROWS, stack2))

// --- Data point 3 (report (4), move 10): F25@25C0A2 — stack 3, no >3 steps: open ---
const boardYou = new Set<string>()
const movesYou: [number, string][] = [[23, '23B11A9'], [3, '03A11A13'], [6, '06A14B13'], [10, '10A3C5']]
for (const [figId, n] of movesYou) {
  const { pts } = parsePts(n)
  const placed = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, boardYou, ROWS).ok)
  if (!placed) { console.log(`FAIL  replay gap at ${n}`); failures++; continue }
  placed.forEach(([r, c]) => boardYou.add(`${r},${c}`))
}
const { pts: pts10 } = parsePts('25C0A2')
const f25 = allSolutions(25, pts10).find((s) => rules.checkPlacement(s, boardYou, ROWS).ok)
if (!f25) { console.log('FAIL  F25@25C0A2 no longer placeable'); failures++ } else {
  const next = new Set(boardYou)
  f25.forEach(([r, c]) => next.add(`${r},${c}`))
  const res = rules.checkPlacement(f25, boardYou, ROWS)
  console.log(`   F25@25C0A2 cells: ${[...f25].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([r, c]) => cellName(r, c)).join(' ')} sealsExit=${res.sealsExit}`)
  expect('F25@25C0A2 (stack 3) does NOT seal the exit (report (4) loss was false)', res.ok && !res.sealsExit)
  expect('hasReturnPath on the post-F25 board is true', rules.hasReturnPath(next, ROWS, f25))
  // and no step > 3 anywhere, per Sergey's observation
  const heights = rules.colHeights(next, ROWS)
  const maxStep = Math.max(...heights.slice(0, 14).map((h: number, i: number) => Math.abs(h - heights[i + 1])))
  expect(`max step on the board ≤ 3 (got ${maxStep})`, maxStep <= 3)
}

console.log(failures === 0 ? '\nALL EXPECTATIONS MET' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
