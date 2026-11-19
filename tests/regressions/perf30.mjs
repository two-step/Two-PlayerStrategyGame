import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const { createOpponentEngine } = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const { enumeratePlacements, cellKey, computeDeadCells } = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup
// (nothing in the build imports it); try both locations so the regressions survive.
const figureCandidates = ['tests/fixtures', 'src/imports', 'src/imports_to_delete']
const figuresPath = figureCandidates.map(p => resolve(root, p, 'otgruzka_figures.json')).find(p => existsSync(p))
const source = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = source.figures.map(f => ({ id: f.id, name: `F${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, size: f.cells_count, dots: f.reference_dots.map(([r, c]) => f.cells.findIndex(p => p[0] === r && p[1] === c)) }))
const ROWS = 11
const rest = figures.filter(f => f.id !== 16)
const eng = createOpponentEngine({ difficulty: 'medium' })
const ctx = { rows: ROWS, ownFilled: new Set(), ownAvailable: rest, humanFilled: new Set(), humanAvailable: figures }
const f16 = figures.find(f => f.id === 16)
let t0 = performance.now()
const d = eng.decidePlacement(f16, new Set(), ROWS, ctx)
console.log(`decidePlacement F16 medium: ${(performance.now() - t0).toFixed(0)}ms -> ${d.kind}`)
t0 = performance.now()
const req = eng.chooseFigureToRequest(figures, null, ctx)
console.log(`chooseFigureToRequest (empty human board): ${(performance.now() - t0).toFixed(0)}ms -> ${req.kind}`)
// one full enumeration alone:
t0 = performance.now()
const all = enumeratePlacements(f16, new Set(), ROWS)
console.log(`enumeratePlacements F16 empty board: ${(performance.now() - t0).toFixed(0)}ms, ${all.length} placements`)
// fill row A except col 14, request again (harder geometry):
const humanFilled = new Set()
for (let c = 0; c < 14; c++) humanFilled.add(cellKey(ROWS - 1, c))
t0 = performance.now()
const req2 = eng.chooseFigureToRequest(figures, null, { ...ctx, humanFilled })
console.log(`chooseFigureToRequest (row A nearly full): ${(performance.now() - t0).toFixed(0)}ms -> ${req2.kind}`)
t0 = performance.now()
const dead = computeDeadCells(humanFilled, ROWS)
console.log(`computeDeadCells: ${(performance.now() - t0).toFixed(0)}ms`)
rmSync(tmp, { recursive: true, force: true })
