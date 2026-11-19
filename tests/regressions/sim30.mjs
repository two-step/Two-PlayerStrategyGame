// End-to-end game simulation: engine vs engine (different difficulties), each
// placing into its own container; requests come from the opponent's handover
// logic. Checks the game terminates (5 rows) and measures decision latency.
// Run: node --experimental-transform-types _to_delete/sim30.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const { createOpponentEngine } = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const { enumeratePlacements, cellKey, closedRows, closedCols, computeDeadCells, colHeights } = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup;
// try both locations so the regressions survive.
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map(p => resolve(root, p, 'otgruzka_figures.json')).find(p => existsSync(p))
const source = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = source.figures.map(f => ({ id: f.id, name: `Figure-${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, size: f.cells_count, dots: f.reference_dots.map(([r, c]) => f.cells.findIndex(p => p[0] === r && p[1] === c)) }))
const ROWS = 11

function simulate(diffA, diffB, seed) {
  // deterministic shuffle
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const shuffled = [...figures].sort(() => rnd() - 0.5)
  const deckA = [...shuffled], deckB = [...figures].sort(() => rnd() - 0.5)
  const boards = { a: new Set(), b: new Set() }
  const used = { a: new Set(), b: new Set() }
  const engines = { a: createOpponentEngine({ difficulty: diffA }), b: createOpponentEngine({ difficulty: diffB }) }
  const closures = { a: 0, b: 0 }
  let turn = rnd() < 0.5 ? 'a' : 'b'
  let ms = 0
  let moves = 0
  for (let step = 0; step < 20; step++) {
    const me = turn, other = me === 'a' ? 'b' : 'a'
    const remaining = figures.filter(f => !used[me].has(f.id))
    if (!remaining.length) break
    const ctx = {
      rows: ROWS,
      ownFilled: boards[me],
      ownAvailable: figures.filter(f => !used[me].has(f.id)),
      humanFilled: boards[other],
      humanAvailable: figures.filter(f => !used[other].has(f.id)),
    }
    const t0 = Date.now()
    const req = engines[me].chooseFigureToRequest(ctx.humanAvailable, null, ctx)
    ms += Date.now() - t0
    if (req.kind !== 'request') return { winner: other, reason: 'no request', moves, ms }
    used[other].add(req.figureId)
    const fig = figures.find(f => f.id === req.figureId)
    const t1 = Date.now()
    const d = engines[other].decidePlacement(fig, boards[other], ROWS, ctx)
    ms += Date.now() - t1
    moves++
    if (d.kind === 'pass') return { winner: me, reason: `forced pass (${fig.label})`, moves, ms }
    boards[other] = (() => { const n = new Set(boards[other]); d.cells.forEach(([r, c]) => n.add(cellKey(r, c))); return n })()
    const dead = computeDeadCells(boards[other], ROWS)
    const closed = closedRows(boards[other], ROWS, dead).size + closedCols(boards[other], ROWS, dead).size
    if (closed > closures[other]) {
      closures[other] = closed
      if (closed >= 5) return { winner: other, reason: '5 rows closed', moves, ms }
    }
    turn = other
  }
  return { winner: 'none', reason: 'step limit', moves, ms, closures }
}

const pairs = [['easy', 'medium'], ['medium', 'hard'], ['hard', 'hard'], ['easy', 'easy']]
for (const [a, b] of pairs) {
  for (let g = 0; g < 3; g++) {
    const r = simulate(a, b, 42 + g * 1000 + a.length * 7 + b.length)
    const maxMs = Math.round(r.ms / Math.max(1, r.moves))
    console.log(`${a} vs ${b} #${g}: ${r.winner} (${r.reason}) moves=${r.moves} avgDecision=${maxMs}ms`)
  }
}
rmSync(tmp, { recursive: true, force: true })
console.log('SIM DONE')
