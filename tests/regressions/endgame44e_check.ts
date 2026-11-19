// Endgame verification on the reconstructed report (4) final OPP board:
//  (a) canPlaceAnywhere(F05) must now be TRUE (the sealing 05E0A0 counts);
//  (b) the engine's decidePlacement(F05) must PLACE (desperate fallback), not pass;
//  (c) the placed load must seal the exit → 44d loss (hasReturnPath false).
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const root = process.cwd()
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const engMod: any = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const rules: any = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map((p) => p + '/otgruzka_figures.json').find((p) => existsSync(p))!
const src = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = src.figures.map((f: any) => {
  const dotIdx = f.reference_dots.map(([r, c]: any) => f.cells.findIndex((p: any) => p[0] === r && p[1] === c))
  const dots = dotIdx.length === 2 ? [...dotIdx].sort((a: number, b: number) => f.cells[a][1] - f.cells[b][1]) : dotIdx
  return { id: f.id, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, dots }
})
const ROWS = 11
const LETTERS = 'ABCDEFGHIJK'
const key = (r: number, c: number) => `${r},${c}`
const fig = (id: number) => figures.find(f => f.id === id)!
const oppMoves: [number, string][] = [[21, '21B11A9'], [10, '10A5C7'], [7, '07C4B5'], [23, '23B13A11'], [26, '26A4B1'], [4, '04E2B2'], [16, '16E5'], [25, '25F12D10'], [11, '11I4G6'], [27, '27G4F1']]
const opp = new Set<string>()
for (const [id, n] of oppMoves) {
  const f = fig(id)
  const pts: any = rules.parseNotation(n, ROWS)
  const cells = f.dots.length >= 2 ? rules.computePlacementFromDots(f, pts.points) : rules.computePlacementFromAnchor(f, 0, pts.points[0])
  cells.forEach(([r, c]: any) => opp.add(key(r, c)))
}
const f05 = fig(5)
console.log('canPlaceAnywhere(F05) on final OPP board:', rules.canPlaceAnywhere(f05, opp, ROWS), '(expect true)')
const engine = engMod.createOpponentEngine({ difficulty: 'medium' })
const d = engine.decidePlacement(f05, opp, ROWS, { rows: ROWS, ownFilled: opp, ownAvailable: [], humanFilled: new Set(), humanAvailable: [] })
if (d.kind === 'place') {
  const notn = rules.formatNotation(5, f05.dots.map((i: number) => ({ r: d.cells[i][0], c: d.cells[i][1] })), ROWS)
  const after = new Set(opp); d.cells.forEach(([r, c]: any) => after.add(key(r, c)))
  console.log('engine decides: PLACE', notn, 'sealedExit =', !rules.hasReturnPath(after, ROWS, d.cells), '(expect true)')
} else console.log('engine decides:', d.kind, '(expect place)')
rmSync(tmp, { recursive: true, force: true })
