import {
  FigureDef, Cells, cellKey, checkPlacement, computePlacementFromDots,
} from '../src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'

const F15: FigureDef = { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] }
const F01: FigureDef = { id: 1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] }

// 1. F4 stood vertically at the entrance column (height 4 -- not directly passable).
const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, 0))
console.log('Wall built: column 0 height 4 (F4 vertical).')

// 2. BEFORE raising the neighbor column: try to place F15 out on the open floor, e.g.
//    targeting columns 5..7 on the floor row -- should be REJECTED (step too tall).
const target: Cells = [[ROWS - 1, 5], [ROWS - 1, 6], [ROWS - 1, 7], [ROWS - 2, 5], [ROWS - 2, 7]]
// (this is F15's own shape translated so its two dots land at floor cells col5 and col7)
let r1 = checkPlacement(target, filled, ROWS)
console.log('BEFORE raising column 1 -- F15 attempt ok=', r1.ok, r1.reason ?? '')

// 3. Player places Mono (F01) at column 1, floor row, to raise that column to height 1
//    (4 - 1 = 3, which IS passable).
const monoCell: Cells = [[ROWS - 1, 1]]
const r2 = checkPlacement(monoCell, filled, ROWS)
console.log('Placing Mono at column 1 -- ok=', r2.ok, r2.reason ?? '')
if (r2.ok) monoCell.forEach(([r, c]) => filled.add(cellKey(r, c)))

// 4. AFTER: retry the same F15 target -- should now be legal.
const r3 = checkPlacement(target, filled, ROWS)
console.log('AFTER raising column 1 -- F15 attempt ok=', r3.ok, r3.reason ?? '')

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}
console.log('--- final board (with F15 placed) ---')
const finalBoard = new Set(filled)
target.forEach(([r, c]) => finalBoard.add(cellKey(r, c)))
printState(finalBoard)
