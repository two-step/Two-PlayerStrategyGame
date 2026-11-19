// Regression checks against item 30 using canonical geometry.
// Run: node --experimental-transform-types _to_delete/regress30.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
const engineSrc = readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'")
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), engineSrc)
const { createOpponentEngine } = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const { enumeratePlacements, cellKey } = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup;
// try both locations so the regressions survive.
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map(p => resolve(root, p, 'otgruzka_figures.json')).find(p => existsSync(p))
const source = JSON.parse(readFileSync(figuresPath, 'utf8'))
const figures = source.figures.map(f => ({ id: f.id, name: `Figure-${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, size: f.cells_count, dots: f.reference_dots.map(([r,c]) => f.cells.findIndex(p => p[0] === r && p[1] === c)) }))
const byId = id => figures.find(f => f.id === id)
const rows = 11
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`) }
const asLegal = (fig, filled, cells) => enumeratePlacements(fig, filled, rows).some(move => move.length === cells.length && move.every(([r,c], i) => cells[i][0] === r && cells[i][1] === c))
const canCover = (fig, filled, target) => enumeratePlacements(fig, filled, rows).some(move => move.some(([r,c]) => r === target[0] && c === target[1]))

// Canonical figure 16 opening: keep future shape options available, including
// the A13 edge cell specifically identified by item 30's live-game critique.
{
  const empty = new Set()
  const fig = byId(16)
  const remaining = figures.filter(f => f.id !== fig.id)
  const engine = createOpponentEngine({ difficulty: 'hard' })
  const move = engine.decidePlacement(fig, empty, rows, { rows, ownAvailable: remaining })
  assert(move.kind === 'place' && asLegal(fig, empty, move.cells), 'Hard returns a legal F16 opening from canonical geometry')
  const after = new Set(move.cells.map(([r,c]) => cellKey(r,c)))
  assert(remaining.some(f => canCover(f, after, [rows - 1, 13])), 'Opening preserves a legal way to load A13 with some remaining figure')
}

// All difficulty levels must only emit positions from the rules enumerator.
for (const difficulty of ['easy', 'medium', 'hard']) {
  const fig = byId(27)
  const empty = new Set()
  const decision = createOpponentEngine({ difficulty }).decidePlacement(fig, empty, rows, { rows, ownAvailable: figures.filter(f => f.id !== fig.id) })
  assert(decision.kind === 'place' && asLegal(fig, empty, decision.cells), `${difficulty} placement obeys enumerated legality`)
}

// Right-bottom-first on an empty board: row A is bottom (r=rows-1), columns
// increase left-to-right, entrance A0; first solo cell should be bottom-right.
{
  const move = createOpponentEngine({ difficulty: 'easy' }).decidePlacement(byId(1), new Set(), rows)
  assert(move.kind === 'place' && move.cells[0][0] === rows - 1 && move.cells[0][1] === 14, 'Easy starts at the right-bottom far from entrance A0')
}

rmSync(tmp, { recursive: true, force: true })
