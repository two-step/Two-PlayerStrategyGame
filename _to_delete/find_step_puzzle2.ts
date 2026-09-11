import {
  FigureDef, Cells, cellKey, checkPlacement,
} from '../src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const F15: FigureDef = { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] }

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

// Wall (F4 vertical) stands in COLUMN 1 (not the entrance column itself) -- height 4.
// Column 0 (the true A0 entrance) is left open at the floor.
const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, 1))
console.log('Wall built: column 1 height 4 (F4 vertical). Column 0 (entrance) left open.')
printState(filled)

// Try F15 out past the wall (columns 3..5) right away -- expect rejection.
const target: Cells = [[ROWS - 1, 3], [ROWS - 1, 4], [ROWS - 1, 5], [ROWS - 2, 3], [ROWS - 2, 5]]
console.log('\nBEFORE any build-up -- F15 attempt:', checkPlacement(target, filled, ROWS))

// Player raises column 0 (the entrance itself) by 1 cell (Mono) -- diff to column1's
// wall (height 4) becomes 4-1=3, passable.
const mono: Cells = [[ROWS - 1, 0]]
const rMono = checkPlacement(mono, filled, ROWS)
console.log('\nPlacing Mono at column 0 (raising the entrance) -- ok=', rMono.ok, rMono.reason ?? '')
if (rMono.ok) mono.forEach(([r, c]) => filled.add(cellKey(r, c)))

console.log('\nAFTER raising column 0 by 1 -- F15 attempt:', checkPlacement(target, filled, ROWS))

// If still blocked, try raising column 0 further (a Domino stacked) and re-test.
if (!checkPlacement(target, filled, ROWS).ok) {
  const domino: Cells = [[ROWS - 2, 0]]
  const rD = checkPlacement(domino, filled, ROWS)
  console.log('\nPlacing a 2nd cell on column 0 (height 2) -- ok=', rD.ok, rD.reason ?? '')
  if (rD.ok) domino.forEach(([r, c]) => filled.add(cellKey(r, c)))
  console.log('AFTER raising column 0 to height 2 -- F15 attempt:', checkPlacement(target, filled, ROWS))
}

console.log('\n--- board state now ---')
printState(filled)
