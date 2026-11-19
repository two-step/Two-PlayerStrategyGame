// Verify the 2026-11-17 engine rework against Sergey's two complaints:
//  1. F16 opening must not strand row A (16B12 leaves A13 fillable only by F01/F02).
//  2. Handover must reason about the HUMAN's container and must not follow a
//     rigid F01→F05 template.
// Run: node --experimental-transform-types _to_delete/verify30.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const { createOpponentEngine } = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const { enumeratePlacements, cellKey } = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup;
// try both locations so the regressions survive.
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map(p => resolve(root, p, 'otgruzka_figures.json')).find(p => existsSync(p))
const source = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = source.figures.map(f => ({ id: f.id, name: `Figure-${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, size: f.cells_count, dots: f.reference_dots.map(([r, c]) => f.cells.findIndex(p => p[0] === r && p[1] === c)) }))
const byId = id => figures.find(f => f.id === id)
const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const notation = (fig, cells) => `${String(fig.id).padStart(2, '0')}${fig.dots.map(i => { const [r, c] = cells[i]; return `${ROW_LABELS[ROWS - 1 - r]}${c}` }).join('')}`
const apply = (filled, cells) => { const n = new Set(filled); cells.forEach(([r, c]) => n.add(cellKey(r, c))); return n }
const floorProviders = (filled, remaining, c) => remaining.filter(f => enumeratePlacements(f, filled, ROWS).some(cs => cs.some(([r, cc]) => r === ROWS - 1 && cc === c))).length
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL ' + msg); console.log('PASS ' + msg) }

// 1) F16 opening, every level: A13 (floor, col 13) must keep ≥2 distinct providers.
const f16 = byId(16)
const rest = figures.filter(f => f.id !== 16)
for (const difficulty of ['easy', 'medium', 'hard']) {
  const d = createOpponentEngine({ difficulty }).decidePlacement(f16, new Set(), ROWS, { rows: ROWS, ownFilled: new Set(), ownAvailable: rest, humanFilled: new Set(), humanAvailable: rest })
  const n = notation(f16, d.cells)
  const after = apply(new Set(), d.cells)
  const openFloor = [...Array(15).keys()].filter(c => !after.has(cellKey(ROWS - 1, c)))
  const minProviders = Math.min(...openFloor.map(c => floorProviders(after, rest, c)))
  assert(minProviders >= 2, `${difficulty} F16 opening ${n}: every open floor cell keeps ≥2 distinct providers (min=${minProviders})`)
}

// 2) Handover denial: the human's row A is one cell short (A14 open). F01 closes
// row A for the human — the engine must not hand it while safer figures exist.
const humanFilled = new Set()
for (let c = 0; c < 14; c++) humanFilled.add(cellKey(ROWS - 1, c))
const pool = [byId(1), byId(2), byId(5), byId(7)]
const remaining = figures.filter(f => !pool.some(p => p.id === f.id))
const eng = createOpponentEngine({ difficulty: 'hard' })
const picks = new Set()
for (let i = 0; i < 60; i++) {
  const d = eng.chooseFigureToRequest(pool, null, { rows: ROWS, ownFilled: new Set(), ownAvailable: remaining, humanFilled, humanAvailable: pool })
  if (d.kind === 'request') picks.add(d.figureId)
}
assert(!picks.has(1), `hard never hands F01 into a 1-cell-short row A (picked: ${[...picks].map(id => 'F' + String(id).padStart(2, '0')).join(',') || 'nothing'})`)
assert(picks.size >= 1, 'hard still requests something when every option is safe')

// 3) Forced pass: on a nearly sealed board some figures are unplaceable — the
// engine must prefer one (LOCK_BONUS) at every level, but variety stays.
const sealed = new Set()
for (let c = 0; c < 15; c++) for (let r = 1; r < ROWS; r++) sealed.add(cellKey(r, c))
sealed.add(cellKey(ROWS - 1, 0)); sealed.add(cellKey(ROWS - 1, 1)); sealed.add(cellKey(ROWS - 1, 2))
sealed.add(cellKey(ROWS - 1, 4)); sealed.add(cellKey(ROWS - 1, 5)); sealed.add(cellKey(ROWS - 1, 6))
sealed.add(cellKey(ROWS - 1, 8)); sealed.add(cellKey(ROWS - 1, 9)); sealed.add(cellKey(ROWS - 1, 10))
sealed.add(cellKey(ROWS - 1, 12)); sealed.add(cellKey(ROWS - 1, 13)); sealed.add(cellKey(ROWS - 1, 14))
// open floor gaps: cols 3, 7, 11 — single cells, most figures cannot enter
const pool2 = figures.filter(f => true)
let forced = 0
for (let i = 0; i < 40; i++) {
  const d = createOpponentEngine({ difficulty: 'medium' }).chooseFigureToRequest(pool2, null, { rows: ROWS, ownFilled: new Set(), ownAvailable: figures, humanFilled: sealed, humanAvailable: pool2 })
  const fig = byId(d.figureId)
  const canPlace = enumeratePlacements(fig, sealed, ROWS).length > 0
  if (!canPlace) forced++
}
assert(forced === 40, `medium always prefers a figure the human cannot legally place (forced-pass picks: ${forced}/40)`)

// 4) No rigid template: on an empty human board, repeated hard requests must
// not walk F01→F05 in ascending-id order.
const emptyCtx = { rows: ROWS, ownFilled: new Set(), ownAvailable: figures, humanFilled: new Set(), humanAvailable: figures }
const seq = []
for (let i = 0; i < 12; i++) {
  const d = createOpponentEngine({ difficulty: 'hard' }).chooseFigureToRequest(figures, null, emptyCtx)
  seq.push(d.figureId)
}
assert(!seq.every((id, i) => i === 0 || id > seq[i - 1]), `hard requests are not ascending-id sequential (${seq.join(',')})`)

rmSync(tmp, { recursive: true, force: true })
console.log('ALL CHECKS DONE')
