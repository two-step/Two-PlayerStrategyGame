// Notation audit per Sergey's canon (2026-11-18):
//   F20 — single instance, NOT mirrored; its dot pair is 180°-symmetric →
//   the notation "20X Y" admits 2 placements (180° apart) unless the writer
//   follows the dots-order convention (point1 = dots[0]).
//   F21/F22 — mirror pair as separate pieces with opposite dot order — each
//   piece's own dots make its notation unique.
// Checks: (1) which two-dot figures have centrally-symmetric dot pairs;
// (2) for EVERY figure/orientation: place → format (dots order) → parse → cells equal.
// Encodes Sergey's 2026-11-18 canon: F20 — single piece, NOT mirrored;
// F21/F22 — mirror pair with opposite dot order. Notation point1 = dots[0] (otgruzka order).
// Run: node --experimental-transform-types _to_delete/regress31_notation.ts
import { existsSync, readFileSync } from 'node:fs'

const ROWS = 11
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map((p) => p + '/otgruzka_figures.json').find((p) => existsSync(p))!
const src = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = src.figures.map((f: any) => ({
  id: f.id, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells,
  dots: f.reference_dots.map(([r, c]: any) => f.cells.findIndex((p: any) => p[0] === r && p[1] === c)),
  refDots: f.reference_dots,
}))
const rules: any = await import(new URL('../../src/engine/rules.ts', import.meta.url).href)

console.log('--- dot-pair symmetry audit (two-dot figures) ---')
for (const f of figures) {
  if (f.dots.length < 2) continue
  const oris = rules.getOrientations(f.cells)
  // ambiguous iff some orientation k has dot offset equal to minus the offset of orientation k+2
  const offsets = oris.map((ori: any) => {
    const a = ori[f.dots[0]], b = ori[f.dots[1]]
    return [b[0] - a[0], b[1] - a[1]] as [number, number]
  })
  const ambiguous = offsets.some((o: any, k: number) =>
    offsets.some((o2: any, j: number) => j !== k && o[0] === -o2[0] && o[1] === -o2[1]))
  // cell-set symmetry under 180° (shape itself symmetric → ambiguity harmless)
  const setKey = (cs: any) => JSON.stringify([...cs].sort((a: any, b: any) => a[0] - b[0] || a[1] - b[1]))
  const shapeSelfSymmetric = oris.length < 4 || setKey(oris[0]) === setKey(oris[2])
  if (ambiguous) {
    console.log(`F${f.id}: dot pair 180°-symmetric, shape self-symmetric under 180°: ${shapeSelfSymmetric}${shapeSelfSymmetric ? ' (harmless)' : ' ← AMBIGUOUS NOTATION'}`)
  }
}
console.log('(figures not listed have unique dot offsets)')

console.log('\n--- round-trip: place → format(dots order) → parse → same cells ---')
let bad = 0
for (const f of figures) {
  const oris = rules.getOrientations(f.cells)
  oris.forEach((ori: any, k: number) => {
    // place at a fixed interior anchor
    const anchor = [3, 4]
    const cells = ori.map(([r, c]: any) => [r + anchor[0], c + anchor[1]] as [number, number])
    if (!rules.inBounds(cells, ROWS)) return
    const notation = rules.formatNotation(f.id, f.dots.map((i: number) => ({ r: cells[i][0], c: cells[i][1] })), ROWS)
    const parsed = rules.parseNotation(notation, ROWS)
    if (parsed.error) { console.log(`MISMATCH F${f.id} ori${k}: parse error`); bad++; return }
    const back = f.dots.length >= 2 && parsed.points.length >= 2
      ? rules.computePlacementFromDots(f, parsed.points)
      : rules.computePlacementFromAnchor(f, 0, parsed.points[0])
    const key = (cs: any) => JSON.stringify([...cs].sort((a: any, b: any) => a[0] - b[0] || a[1] - b[1]))
    if (!back || key(back) !== key(cells)) {
      console.log(`MISMATCH F${f.id} ori${k}: notation ${notation} → parsed ${back ? key(back) : 'null'} ≠ placed ${key(cells)}`)
      bad++
    }
  })
}
console.log(bad === 0 ? 'all round-trips OK' : `${bad} mismatches`)

console.log('\n--- App.tsx FIGURES dots vs canon (dot1 = LEFT dot of the original figure) ---')
// Sergey's canon (2026-11-18/19, F27 27C14B11 case): point1 = the LEFT dot on the
// original drawing; otgruzka reference_dots list them [right,left] for
// F09/F10/F12/F17/F19/F20/F22/F27, so App.tsx normalizes to left-first.
const appSrc = readFileSync('src/App.tsx', 'utf8')
const figStart = appSrc.indexOf('const FIGURES: Figure[] = [')
const figBlock = appSrc.slice(figStart, appSrc.indexOf('\n]', figStart))
let canonBad = 0
for (const f of figures) {
  const m = figBlock.match(new RegExp(`\\{\\s+id:\\s*${f.id},[\\s\\S]*?dots:\\s*\\[([^\\]]*)\\]`))
  if (!m) { console.log(`F${f.id}: not found in App FIGURES`); canonBad++; continue }
  const appDots = m[1].split(',').map((s: string) => parseInt(s.trim(), 10))
  const canonDots = f.dots.length === 2
    ? [...f.dots].sort((a: any, b: any) => f.cells[a][1] - f.cells[b][1])
    : f.dots
  if (JSON.stringify(appDots) !== JSON.stringify(canonDots)) {
    console.log(`F${f.id}: App dots [${appDots}] ≠ left-first canon [${canonDots}]  (otgruzka [${f.dots}], refDots ${JSON.stringify(f.refDots)})`)
    canonBad++
  }
}
console.log(canonBad === 0 ? 'all App dot orders match the left-first canon' : `${canonBad} deviations from the canon`)
