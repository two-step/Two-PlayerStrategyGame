// Replay Sergey's 2026-11-18 game (report PuzzleStow_Game_Report_2026-11-18.pdf)
// against the current (reworked) engine, difficulty easy. Verifies every engine
// placement and every handover, then analyzes the criticized moves (F24+).
// Run: node --experimental-transform-types _to_delete/replay18.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tmp = resolve(root, 'tmp_engine')
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'rules.ts'), readFileSync(resolve(root, 'src/engine/rules.ts'), 'utf8'))
writeFileSync(resolve(tmp, 'opponentEngine.ts'), readFileSync(resolve(root, 'src/engine/opponentEngine.ts'), 'utf8').replace(/from '\.\/rules'/g, "from './rules.ts'"))
const { createOpponentEngine } = await import(pathToFileURL(resolve(tmp, 'opponentEngine.ts')).href)
const { enumeratePlacements, checkPlacement, computePlacementFromDots, computePlacementFromAnchor, computeDeadCells, closedRows, closedCols, colHeights, cellKey, formatNotation, ROW_LABELS } = await import(pathToFileURL(resolve(tmp, 'rules.ts')).href)
// otgruzka_figures.json was moved to src/imports_to_delete/ by an external cleanup;
// try both locations so the regressions survive.
const figuresPath = ['tests/fixtures', 'src/imports', 'src/imports_to_delete'].map(p => resolve(root, p, 'otgruzka_figures.json')).find(p => existsSync(p))
const src = JSON.parse(readFileSync(figuresPath, 'utf8'))
// Left-first dot canon (Sergey, 2026-11-18/19): point1 = the LEFT dot of the original
// figure — the same normalization App.tsx applies to otgruzka reference_dots.
// Sergey's logged notations were recorded under this reading (the old UI's net
// behavior), so the replay must parse them forward with dot1 = left dot.
const figures = src.figures.map(f => {
  const dotIdx = f.reference_dots.map(([r, c]) => f.cells.findIndex(p => p[0] === r && p[1] === c))
  const dots = dotIdx.length === 2 ? [...dotIdx].sort((a, b) => f.cells[a][1] - f.cells[b][1]) : dotIdx
  return { id: f.id, name: `Figure-${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells: f.cells, size: f.cells_count, dots }
})
const byId = id => figures.find(f => f.id === id)
const ROWS = 11

const apply = (filled, cells) => { const n = new Set(filled); cells.forEach(([r, c]) => n.add(cellKey(r, c))); return n }
const toNotation = (fig, cells) => formatNotation(fig.id, fig.dots.map(i => { const [r, c] = cells[i]; return { r, c } }), ROWS)
const parse = (fig, notation) => {
  const m = notation.match(/^(\d{2})((?:[A-K]\d{1,2}){1,2})$/)
  const pts = [...m[2].matchAll(/([A-K])(\d{1,2})/g)].map(x => ({ r: ROWS - 1 - ROW_LABELS.indexOf(x[1]), c: parseInt(x[2]) }))
  if (fig.dots.length >= 2 && pts.length >= 2) return computePlacementFromDots(fig, pts)
  if (fig.dots.length === 1 && pts.length >= 1) return computePlacementFromAnchor(fig, 0, pts[0])
  return null
}

// Game from the PDF. you = Sergey's placements (handover targets), opp = engine placements.
const turns = [
  { who: 'you-req', fig: 16, oppNotation: '16B11' },
  { who: 'opp-req', fig: 14, youNotation: '14B13A14' },
  { who: 'you-req', fig: 11, oppNotation: '11C5A7' },
  { who: 'opp-req', fig: 3, youNotation: '03D14B14' },
  { who: 'you-req', fig: 20, oppNotation: '20A4C2' },
  { who: 'opp-req', fig: 6, youNotation: '06B12A11' },
  { who: 'you-req', fig: 24, oppNotation: '24D8E10' },
  { who: 'opp-req', fig: 8, youNotation: '08A8B10' },
  { who: 'you-req', fig: 17, oppNotation: '17D11F13' },
  { who: 'opp-req', fig: 18, youNotation: '18A5C7' },
  { who: 'you-req', fig: 25, oppNotation: '25E1C3' },
  { who: 'opp-req', fig: 12, youNotation: '12A3B5' },
  { who: 'you-req', fig: 15, oppNotation: '15H1F0' },
]

let you = new Set(), opp = new Set()
const usedYou = new Set(), usedOpp = new Set()
const engine = createOpponentEngine({ difficulty: 'easy' })
let lastRequestToOpp = null

for (const t of turns) {
  const fig = byId(t.fig)
  if (t.who === 'you-req') {
    // Sergey requests `fig` for the opponent; engine places it.
    const ctx = {
      rows: ROWS,
      ownFilled: opp,
      ownAvailable: figures.filter(f => !usedOpp.has(f.id)),
      humanFilled: you,
      humanAvailable: figures.filter(f => !usedYou.has(f.id)),
    }
    const d = engine.decidePlacement(fig, opp, ROWS, ctx)
    const expected = parse(fig, t.oppNotation)
    const match = d.kind === 'place' && JSON.stringify([...d.cells].sort()) === JSON.stringify([...expected].sort())
    const legal = checkPlacement(expected, opp, ROWS, true)
    console.log(`[${t.who}] ${fig.label} log=${t.oppNotation} engine=${d.kind === 'place' ? toNotation(fig, d.cells) : d.kind} match=${match} legality=${legal.ok ? 'OK' : 'REJECT: ' + legal.reason} sealsExit=${legal.sealsExit ?? false}`)
    if (d.kind === 'place') {
      const h = colHeights(opp, ROWS).join(',')
      const cands = enumeratePlacements(fig, opp, ROWS)
      const ord = [...cands].sort((a, b) => (Math.max(...b.map(x => x[0])) - Math.max(...a.map(x => x[0]))) || (Math.max(...b.map(x => x[1])) - Math.max(...a.map(x => x[1]))))
      const top = ord.slice(0, 4).map(c => toNotation(fig, c))
      console.log('    heightsBefore=' + h + ' legalCands=' + cands.length + ' humanOrderTop4=' + top.join(' '))
      opp = apply(opp, d.cells)
    }
    usedOpp.add(t.fig)
    lastRequestToOpp = t.fig
  } else {
    // The engine hands a figure to Sergey (Sergey placed it per the log).
    const ctx = {
      rows: ROWS,
      ownFilled: opp,
      ownAvailable: figures.filter(f => !usedOpp.has(f.id)),
      humanFilled: you,
      humanAvailable: figures.filter(f => !usedYou.has(f.id)),
    }
    const hand = engine.chooseFigureToRequest(ctx.humanAvailable, lastRequestToOpp, ctx)
    const handed = hand.kind === 'request' ? byId(hand.figureId).label : hand.kind
    const expected = parse(fig, t.youNotation)
    const legal = checkPlacement(expected, you, ROWS, true)
    console.log(`[${t.who}] engine hands ${handed} (log: Sergey places ${fig.label}) same=${hand.kind === 'request' && hand.figureId === t.fig} | Sergey's placement legality=${legal.ok ? 'OK' : 'REJECT: ' + legal.reason} sealsExit=${legal.sealsExit ?? false}`)
    usedYou.add(t.fig)
    you = apply(you, expected)
  }
}

const heightsYou = colHeights(you, ROWS)
const heightsOpp = colHeights(opp, ROWS)
console.log('\nHeights YOU :', heightsYou.join(','))
console.log('Heights OPP :', heightsOpp.join(','))
const deadYou = computeDeadCells(you, ROWS), deadOpp = computeDeadCells(opp, ROWS)
console.log('Dead cells YOU:', [...deadYou].map(k => { const [r, c] = k.split(',').map(Number); return `${ROW_LABELS[ROWS - 1 - r]}${c}` }).join(' ') || 'none')
console.log('Dead cells OPP:', [...deadOpp].map(k => { const [r, c] = k.split(',').map(Number); return `${ROW_LABELS[ROWS - 1 - r]}${c}` }).join(' ') || 'none')
console.log('Closed YOU:', closedRows(you, ROWS, deadYou).size + closedCols(you, ROWS, deadYou).size, ' OPP:', closedRows(opp, ROWS, deadOpp).size + closedCols(opp, ROWS, deadOpp).size)
rmSync(tmp, { recursive: true, force: true })
console.log('REPLAY DONE')
