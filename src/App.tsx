import { useState, useEffect, useMemo } from 'react'
import { parseNotation, computePlacementFromDots, computePlacementFromAnchor, checkPlacement, closedRows, cellKey, canPlaceAnywhere } from './engine/rules'
import { createOpponentEngine, type Difficulty } from './engine/opponentEngine'

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  graphite: '#1C1F26',
  graphite2: '#22262f',
  graphite3: '#2a2f3a',
  blue: '#1F4F82',
  blueLight: '#2563a8',
  cyan: '#1FA7A3',
  deck: '#F5F7FA',
  steel: '#A3A9B5',
  steelDim: '#4b5162',
  green: '#3BB273',
  red: '#D6456F',
} as const

type Page = 'home' | 'figures' | 'rules' | 'lore' | 'play' | 'practice' | 'sandbox' | 'printplay' | 'auth' | 'profile' | 'devtest'
type Cells = [number, number][]

interface Figure {
  id: number; name: string; label: string; cells: Cells; size: number; dots: number[]
}

// ── 27 Figures (source: otgruzka_figures.json, confirmed) ────────────────────
const FIGURES: Figure[] = [
  { id:  1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] },
  { id:  2, name: 'Domino', label: 'F02', size: 2, cells: [[0,0],[0,1]], dots: [0, 1] },
  { id:  3, name: 'Tromino-I', label: 'F03', size: 3, cells: [[0,0],[0,1],[0,2]], dots: [0, 2] },
  { id:  4, name: 'Tetromino-I', label: 'F04', size: 4, cells: [[0,0],[0,1],[0,2],[0,3]], dots: [0, 3] },
  { id:  5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] },
  { id:  6, name: 'Tromino-L', label: 'F06', size: 3, cells: [[0,0],[1,0],[1,1]], dots: [0, 2] },
  { id:  7, name: 'Tetromino-O', label: 'F07', size: 4, cells: [[0,0],[0,1],[1,0],[1,1]], dots: [0, 3] },
  { id:  8, name: 'Tetromino-L', label: 'F08', size: 4, cells: [[0,0],[1,0],[2,0],[2,1]], dots: [0, 3] },
  { id:  9, name: 'Tetromino-J', label: 'F09', size: 4, cells: [[0,1],[1,1],[2,0],[2,1]], dots: [0, 2] },
  { id: 10, name: 'Pentomino-F', label: 'F10', size: 5, cells: [[0,1],[0,2],[1,1],[2,0],[2,1]], dots: [1, 3] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], dots: [0, 4] },
  { id: 12, name: 'Tetromino-S', label: 'F12', size: 4, cells: [[0,1],[0,2],[1,0],[1,1]], dots: [1, 2] },
  { id: 13, name: 'Tetromino-Z', label: 'F13', size: 4, cells: [[0,0],[0,1],[1,1],[1,2]], dots: [0, 3] },
  { id: 14, name: 'Tetromino-T', label: 'F14', size: 4, cells: [[0,1],[1,0],[1,1],[1,2]], dots: [0, 3] },
  { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] },
  { id: 16, name: 'Pentomino-X', label: 'F16', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], dots: [2] },
  { id: 17, name: 'Pentomino-V', label: 'F17', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[2,0]], dots: [2, 4] },
  { id: 18, name: 'Hexomino-C', label: 'F18', size: 6, cells: [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 5] },
  { id: 19, name: 'Hexomino-B', label: 'F19', size: 6, cells: [[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 4] },
  { id: 20, name: 'Pentomino-N', label: 'F20', size: 5, cells: [[0,1],[0,2],[1,0],[1,1],[2,0]], dots: [1, 4] },
  { id: 21, name: 'Pentomino-R', label: 'F21', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,2]], dots: [0, 4] },
  { id: 22, name: 'Pentomino-Y', label: 'F22', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,0]], dots: [0, 4] },
  { id: 23, name: 'Hexomino-H', label: 'F23', size: 6, cells: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 5] },
  { id: 24, name: 'Pentomino-T', label: 'F24', size: 5, cells: [[0,1],[1,1],[2,0],[2,1],[2,2]], dots: [0, 4] },
  { id: 25, name: 'Heptomino-H', label: 'F25', size: 7, cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 6] },
  { id: 26, name: 'Hexomino-P', label: 'F26', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,1],[1,3]], dots: [0, 5] },
  { id: 27, name: 'Hexomino-Q', label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]], dots: [3, 4] },
]

// ── Tiers (PairSec_Спецификация_Final_2026.docx §7.1.6) ───────────────────────
const TIERS = [
  { id: 1, name: 'UnderLodar',   abbr: 'UL',  color: C.steel,   desc: 'Entry level. Learning the rules and all 27 figures.' },
  { id: 2, name: 'Lodar',        abbr: 'Ld',  color: C.blue,    desc: 'Understands basic placement and support rules.' },
  { id: 3, name: 'MidLod',       abbr: 'ML',  color: C.cyan,    desc: 'Applies overhang and step rules. May create leagues.' },
  { id: 4, name: 'Senior Lodar', abbr: 'SLd', color: '#2abfbb', desc: 'Reads opponent strategy. Consistent path management.' },
  { id: 5, name: 'LeadLod',      abbr: 'LL',  color: C.green,   desc: 'Exploits row-closure combinations. Tournament-ready.' },
  { id: 6, name: 'MasterLod',    abbr: 'Mr',  color: '#a3e8c8', desc: 'Top 5% of rated players.' },
  { id: 7, name: 'ProfiLod',     abbr: 'PL',  color: C.deck,    desc: 'Highest tier. Consulting and Judge roles on PairSec.' },
]

const FAQ = [
  {
    q: 'Is PuzzleStow the same as Tetris?',
    a: "No. The only similarity is a rectangular container. PuzzleStow has 27 fixed figures (not 7), rows close in both horizontal and vertical directions, and — most importantly — your opponent chooses which figure you must place. At UnderLodar and Lodar tier there is no time pressure; from MidLod upward, timers and request limits apply (T=7/5/3 min, Li=1/2/3 requests per match).",
  },
  {
    q: 'Can I use AI hints during a rated match?',
    a: "Never. There is no AI move-advisor in rated play — not free, not as a premium feature. Your Lodar qualification reflects your actual thinking, not tool access. Practice and Sandbox modes offer an automated algorithmic engine opponent for unrated training only, and are visually distinct from rated play.",
  },
  {
    q: 'What is a Lodar qualification?',
    a: "Lodar levels (UnderLodar through ProfiLod) are earned through rated matches. They are a verifiable measure of strategic ability — not a reflection of playtime, purchases, or AI assistance. ProfiLod players are eligible for paid Judge and Consulting roles on PairSec.",
  },
  {
    q: 'How do I play without the app?',
    a: "Print two 15×10 container grids (labelled A–J / 0–14), keep the figure reference table nearby, and record moves in notation. The Print & Play page provides both the 15×10 and 15×11 PDF templates. All you need is a sheet of grid paper and a pen.",
  },
  {
    q: 'What is PairSec and how does it connect?',
    a: "PairSec is a platform for skilled workers. Your in-game loader persona ties directly to the \"Грузанём!\" service there. MidLod and above can convert qualification into performer status. Visit pair-sec.com for details.",
  },
  {
    q: 'How does the fair-play overhang exception work?',
    a: "By default, more than 50% of a piece's area may not be unsupported after placement. When a move would exceed this threshold, both players must explicitly confirm via an in-game bilateral modal before the exception is applied. It is never automatic, never one-sided.",
  },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function rotateCW(cells: Cells): Cells {
  if (!cells.length) return cells
  const maxRow = Math.max(...cells.map(([r]) => r))
  const rotated: Cells = cells.map(([r, c]) => [c, maxRow - r])
  const minRow = Math.min(...rotated.map(([r]) => r))
  const minCol = Math.min(...rotated.map(([, c]) => c))
  return rotated.map(([r, c]) => [r - minRow, c - minCol])
}

function getOrientations(cells: Cells): Cells[] {
  const seen = new Set<string>()
  const results: Cells[] = []
  let cur = cells
  for (let i = 0; i < 4; i++) {
    const key = [...cur].map(([r, c]) => `${r},${c}`).sort().join('|')
    if (!seen.has(key)) { seen.add(key); results.push(cur) }
    cur = rotateCW(cur)
  }
  return results
}

// ── FigurePreview — uniform CELL_PX across all figures ───────────────────────
const CELL_PX = 14

function FigurePreview({ cells, cardSize = 72, color = C.cyan, cellPx = CELL_PX, dots = [], number, showNumber = true }: {
  cells: Cells; cardSize?: number; color?: string; cellPx?: number; dots?: number[]; number?: number | string; showNumber?: boolean
}) {
  if (!cells.length) return null
  const rows = cells.map(([r]) => r), cols = cells.map(([, c]) => c)
  const minR = Math.min(...rows), maxR = Math.max(...rows)
  const minC = Math.min(...cols), maxC = Math.max(...cols)
  const numR = maxR - minR + 1, numC = maxC - minC + 1
  // Never let a wide/tall figure overflow its card — shrink to fit, but never enlarge
  // past the caller's requested cellPx (fixes F04/F05/F26/F27 clipping their own number/cells).
  const fitCellPx = Math.min(cellPx, cardSize / Math.max(numR, numC))
  const figW = numC * fitCellPx, figH = numR * fitCellPx
  const ox = (cardSize - figW) / 2, oy = (cardSize - figH) / 2
  const dotSet = new Set(dots)
  const dotR = Math.max(1, fitCellPx * 0.13)
  // Part L — every figure carries its number and reference dot(s) on the shape itself
  // (source: otgruzka_figures.json id + reference_dots), not just as a caption beside it.
  const fontSize = Math.max(6, Math.min(fitCellPx * 0.6, 11))
  const canShowNumber = showNumber && number != null && fitCellPx * Math.min(numR, numC) >= 8
  // Anchor the number to the card's own top-left corner, clamped on-canvas, rather than the
  // shape's bounding box — ox/oy can go negative for shapes that fully span the card.
  const numX = Math.max(1.5, ox + 1.5)
  const numY = Math.max(fontSize + 0.5, oy + fontSize + 0.5)
  return (
    <svg width={cardSize} height={cardSize} style={{ display: 'block', flexShrink: 0 }}>
      {cells.map(([r, c], i) => (
        <rect key={i}
          x={ox + (c - minC) * fitCellPx + 0.75} y={oy + (r - minR) * fitCellPx + 0.75}
          width={fitCellPx - 1.5} height={fitCellPx - 1.5}
          fill={`${color}18`} stroke={color} strokeWidth={1.5} rx={0} />
      ))}
      {cells.map(([r, c], i) => dotSet.has(i) ? (
        <circle key={`dot-${i}`}
          cx={ox + (c - minC) * fitCellPx + fitCellPx / 2}
          cy={oy + (r - minR) * fitCellPx + fitCellPx / 2}
          r={dotR} fill={color} />
      ) : null)}
      {canShowNumber && (
        <text x={numX} y={numY}
          fontFamily="'JetBrains Mono',monospace" fontSize={fontSize} fontWeight={700}
          fill={color} style={{ paintOrder: 'stroke', stroke: C.graphite, strokeWidth: fontSize * 0.22 }}>
          {number}
        </text>
      )}
    </svg>
  )
}

// ── Container Grid — Part F: outline-first placed cells ──────────────────────
// Columns 0–14 labeled bottom; rows A–(J|K) labeled right; A = bottom row.
// highlightCells: "r,c" → CSS color overlay for rule visualizations.
const ROW_LABELS = 'ABCDEFGHIJK'

function ContainerGrid({
  filledCells, closedRows = new Set(), cellSize = 22,
  rows = 11, showJKSeparator = false,
  highlightCells = new Map<string, string>(),
  onCellClick,
}: {
  filledCells: Set<string>; closedRows?: Set<number>; cellSize?: number
  rows?: number; showJKSeparator?: boolean
  highlightCells?: Map<string, string>
  onCellClick?: (r: number, c: number) => void
}) {
  const COLS = 15, RL = 26, BH = 20
  const W = COLS * cellSize + RL, H = rows * cellSize + BH
  const labelFor = (r: number) => ROW_LABELS[rows - 1 - r]

  return (
    <svg width={W} height={H}
      style={{ fontFamily: "'JetBrains Mono', monospace", display: 'block', cursor: onCellClick ? 'crosshair' : 'default' }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const key = `${r},${c}`
          const filled = filledCells.has(key)
          const closed = closedRows.has(r)
          const entry = r === rows - 1 && c === 0
          const hColor = highlightCells.get(key)

          // Outline-first: thin stroke, near-transparent fill (Part F fix)
          const fill = closed && filled ? `${C.green}22`
            : filled ? `${C.blue}18`
            : entry ? `${C.cyan}18`
            : 'transparent'
          const stroke = closed && filled ? C.green
            : filled ? C.blue
            : entry ? C.cyan
            : `${C.cyan}18`
          const sw = filled ? 1.5 : 0.5

          return (
            <g key={key} onClick={onCellClick ? () => onCellClick(r, c) : undefined}>
              <rect x={c * cellSize + 0.5} y={r * cellSize + 0.5}
                width={cellSize - 1} height={cellSize - 1}
                fill={fill} stroke={stroke} strokeWidth={sw} />
              {hColor && (
                <rect x={c * cellSize + 1} y={r * cellSize + 1}
                  width={cellSize - 2} height={cellSize - 2}
                  fill={hColor} />
              )}
            </g>
          )
        })
      )}
      {showJKSeparator && rows === 11 && (
        <line x1={0} y1={cellSize} x2={COLS * cellSize} y2={cellSize}
          stroke={C.cyan} strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
      )}
      <circle cx={cellSize / 2} cy={(rows - 1) * cellSize + cellSize / 2} r={2.5} fill={C.cyan} />
      {Array.from({ length: rows }, (_, r) => (
        <text key={r} x={COLS * cellSize + 5} y={r * cellSize + cellSize / 2 + 3}
          textAnchor="start" fontSize={8} fill={r === rows - 1 ? C.cyan : C.steelDim}>
          {labelFor(r)}
        </text>
      ))}
      {Array.from({ length: COLS }, (_, c) => (
        <text key={c} x={c * cellSize + cellSize / 2} y={rows * cellSize + BH - 5}
          textAnchor="middle" fontSize={8} fill={C.steelDim}>{c}</text>
      ))}
    </svg>
  )
}

// ── Sandbox rule overlay helpers ──────────────────────────────────────────────
function colHeights(filled: Set<string>, rows: number): number[] {
  const h = new Array(15).fill(0)
  filled.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    h[c] = Math.max(h[c], rows - r)
  })
  return h
}

function mergeHighlights(...maps: Map<string, string>[]): Map<string, string> {
  const m = new Map<string, string>()
  maps.forEach(src => src.forEach((v, k) => m.set(k, v)))
  return m
}

function supportHL(filled: Set<string>, rows: number): Map<string, string> {
  const m = new Map<string, string>()
  filled.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    if (r === rows - 1 || filled.has(`${r + 1},${c}`)) m.set(key, 'rgba(59,178,115,0.28)')
    else m.set(key, 'rgba(214,69,111,0.35)')
  })
  return m
}

function stepsHL(filled: Set<string>, rows: number): Map<string, string> {
  const m = new Map<string, string>()
  const h = colHeights(filled, rows)
  for (let c = 0; c < 14; c++) {
    if (Math.abs(h[c] - h[c + 1]) > 3) {
      const sc = h[c] < h[c + 1] ? c : c + 1
      const tr = rows - 1 - h[sc]
      if (tr >= 0) m.set(`${tr},${sc}`, 'rgba(214,69,111,0.45)')
      if (tr + 1 < rows) m.set(`${tr + 1},${sc}`, 'rgba(214,69,111,0.22)')
    }
  }
  return m
}

function overhangHL(filled: Set<string>, rows: number): Map<string, string> {
  const m = new Map<string, string>()
  filled.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    if (r < rows - 1 && !filled.has(`${r + 1},${c}`)) m.set(key, 'rgba(255,160,40,0.42)')
  })
  return m
}

function returnPathHL(filled: Set<string>, rows: number): Map<string, string> {
  const m = new Map<string, string>()
  const h = colHeights(filled, rows)
  for (let c = 0; c < 15; c++) {
    if (h[c] > 0) {
      const tr = rows - 1 - h[c]
      if (tr >= 0) m.set(`${tr},${c}`, 'rgba(31,167,163,0.35)')
    }
  }
  for (let c = 0; c < 14; c++) {
    if (Math.abs(h[c] - h[c + 1]) > 3) {
      const sc = h[c] < h[c + 1] ? c : c + 1
      const tr = rows - 1 - h[sc]
      if (tr >= 0) m.set(`${tr},${sc}`, 'rgba(214,69,111,0.55)')
    }
  }
  return m
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function GridIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5}>
      <rect x={1} y={1} width={6} height={6} /><rect x={9} y={1} width={6} height={6} />
      <rect x={1} y={9} width={6} height={6} /><rect x={9} y={9} width={6} height={6} />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M6 14V5l8-2v9" /><circle cx={4} cy={14} r={2} /><circle cx={12} cy={12} r={2} />
    </svg>
  )
}

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={C.blue}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8c-.12.54-.48.67-.96.42l-2.65-1.95-1.27 1.23c-.14.14-.26.26-.54.26l.19-2.72 4.96-4.48c.22-.19-.05-.3-.33-.11L8.31 15.19l-2.62-.82c-.57-.18-.58-.57.12-.84l10.23-3.94c.47-.18.89.11.6.85z" />
    </svg>
  )
}

// ── Part G: Enlarged rule pictograms (64px, blueprint style) ──────────────────
function SupportIcon({ size = 64, color = C.cyan }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <line x1={4} y1={54} x2={60} y2={54} stroke={color} strokeWidth={2.5} />
      <text x={4} y={62} fill={color} fontSize={7} fontFamily="JetBrains Mono, monospace">A — floor</text>
      <rect x={8} y={36} width={14} height={8} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <rect x={8} y={44} width={14} height={10} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <rect x={26} y={44} width={14} height={10} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <rect x={44} y={28} width={13} height={8} fill={`${C.red}22`} stroke={C.red} strokeWidth={1.5} strokeDasharray="3 2" />
      <line x1={50} y1={36} x2={50} y2={54} stroke={C.red} strokeWidth={1} strokeDasharray="2 2" opacity={0.55} />
      <text x={40} y={25} fill={C.red} fontSize={7} fontFamily="JetBrains Mono, monospace">float!</text>
    </svg>
  )
}

function StepsIcon({ size = 64, color = C.blue }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x={4} y={46} width={10} height={8} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <rect x={14} y={38} width={10} height={16} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <rect x={24} y={30} width={10} height={24} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      <text x={4} y={22} fill={C.green} fontSize={8} fontFamily="JetBrains Mono, monospace">≤3 ✓</text>
      <line x1={4} y1={24} x2={34} y2={24} stroke={C.green} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.5} />
      <rect x={38} y={46} width={10} height={8} fill={`${C.red}18`} stroke={C.red} strokeWidth={1.5} />
      <rect x={48} y={20} width={12} height={34} fill={`${C.red}18`} stroke={C.red} strokeWidth={1.5} />
      <text x={36} y={14} fill={C.red} fontSize={8} fontFamily="JetBrains Mono, monospace">≥4 ✗</text>
      <line x1={36} y1={16} x2={60} y2={16} stroke={C.red} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.5} />
    </svg>
  )
}

function OverhangIcon({ size = 64, color = '#7c9dbf' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x={4} y={20} width={12} height={36} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
      <rect x={4} y={12} width={12} height={8} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
      <rect x={16} y={12} width={12} height={8} fill={`${C.red}22`} stroke={C.red} strokeWidth={1.5} strokeDasharray="3 2" />
      <rect x={28} y={12} width={12} height={8} fill={`${C.red}22`} stroke={C.red} strokeWidth={1.5} strokeDasharray="3 2" />
      <line x1={22} y1={7} x2={22} y2={24} stroke={C.red} strokeWidth={1.5} strokeDasharray="2 2" />
      <text x={18} y={7} fill={C.red} fontSize={7} fontFamily="JetBrains Mono, monospace">50%</text>
      <text x={4} y={62} fill={`${color}cc`} fontSize={7} fontFamily="JetBrains Mono, monospace">ok</text>
      <text x={26} y={62} fill={C.red} fontSize={7} fontFamily="JetBrains Mono, monospace">overhang!</text>
    </svg>
  )
}

function PathIcon({ size = 64, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {[8,16,24,32,40,48,56].map(x => <line key={x} x1={x} y1={4} x2={x} y2={60} stroke={`${C.cyan}15`} strokeWidth={0.5} />)}
      {[12,20,28,36,44,52].map(y => <line key={y} x1={4} y1={y} x2={60} y2={y} stroke={`${C.cyan}15`} strokeWidth={0.5} />)}
      <rect x={4} y={44} width={8} height={8} fill={`${C.blue}30`} stroke={C.blue} strokeWidth={1.5} />
      <rect x={12} y={44} width={8} height={8} fill={`${C.blue}30`} stroke={C.blue} strokeWidth={1.5} />
      <rect x={12} y={36} width={8} height={8} fill={`${C.blue}30`} stroke={C.blue} strokeWidth={1.5} />
      <rect x={24} y={24} width={8} height={8} fill={`${color}25`} stroke={color} strokeWidth={1.5} />
      <path d="M28 32 L28 52 L4 52" stroke={color} strokeWidth={2} strokeDasharray="3 2" fill="none" />
      <circle cx={4} cy={52} r={4} fill={C.cyan} />
      <text x={8} y={62} fill={C.cyan} fontSize={7} fontFamily="JetBrains Mono, monospace">A0</text>
    </svg>
  )
}

function RowIcon({ size = 64, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x={4} y={26} width={56} height={12} fill={`${color}22`} stroke={color} strokeWidth={2} />
      {[4,12,20,28,36,44,52].map(x => (
        <rect key={x} x={x} y={26} width={8} height={12} fill={`${color}28`} stroke={color} strokeWidth={0.8} />
      ))}
      <text x={14} y={20} fill={color} fontSize={9} fontFamily="JetBrains Mono, monospace">ROW CLOSED ✓</text>
    </svg>
  )
}

// ── Hero state ────────────────────────────────────────────────────────────────
function buildHeroCells() {
  // Part F: entry (col 0) must stay low and unremarkable — no teaching scenario at A0.
  const s = new Set<string>()
  for (let c = 0; c < 15; c++) s.add(`10,${c}`)
  for (let c = 6; c <= 13; c++) s.add(`9,${c}`)
  for (let c = 9; c <= 11; c++) s.add(`8,${c}`)
  return s
}
const HERO_CELLS = buildHeroCells()
const HERO_CLOSED = new Set([10])

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, isLoggedIn, onSignOut }: {
  page: Page; setPage: (p: Page) => void; isLoggedIn: boolean; onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  const [lang, setLang] = useState<'EN' | 'RU'>('EN')

  const links: { label: string; p: Page }[] = [
    { label: 'Figures', p: 'figures' },
    { label: 'Rules', p: 'rules' },
    { label: 'Lore', p: 'lore' },
    { label: 'Print & Play', p: 'printplay' },
  ]

  return (
    <nav style={{ background: `${C.graphite}f0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.cyan}22` }}
      className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-2">
        <button onClick={() => setPage('home')} className="flex items-center gap-2 shrink-0">
          <div style={{ background: C.cyan }} className="w-7 h-7 flex items-center justify-center">
            <GridIcon size={14} color={C.graphite} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.deck, letterSpacing: '0.06em' }}
            className="text-sm font-medium hidden sm:block">PUZZLESTOW</span>
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <button key={l.p} onClick={() => setPage(l.p)}
              style={{ color: page === l.p ? C.cyan : C.steel }}
              className="text-sm font-medium hover:text-white transition-colors">{l.label}</button>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <div style={{ border: `1px solid ${C.steelDim}40` }} className="flex">
            {(['EN', 'RU'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ color: lang === l ? C.graphite : C.steelDim, background: lang === l ? C.cyan : 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '4px 8px', transition: 'all 0.15s' }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setMusicOn(!musicOn)} title={musicOn ? 'Music on (visual)' : 'Music off'}
            style={{ color: musicOn ? C.cyan : C.steelDim, transition: 'color 0.2s' }}
            className={musicOn ? 'animate-pulse' : ''}>
            <MusicIcon />
          </button>
          <button onClick={() => setPage('devtest')} title="Dev/test environment (TO_DO item 6)"
            style={{ color: page === 'devtest' ? C.red : C.steelDim, border: `1px solid ${C.steelDim}30`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '4px 8px' }}>
            TEST
          </button>
          {isLoggedIn ? (
            <>
              <button onClick={() => setPage('profile')} style={{ color: page === 'profile' ? C.cyan : C.steel }}
                className="text-sm font-medium hover:text-white transition-colors">Profile</button>
              <button onClick={onSignOut} style={{ color: C.steelDim }}
                className="text-xs hover:text-deck transition-colors">Sign out</button>
            </>
          ) : (
            <button onClick={() => setPage('auth')}
              style={{ color: C.steel, border: `1px solid ${C.steelDim}50`, fontSize: 13, padding: '4px 14px' }}
              className="hover:text-deck hover:border-steel transition-all">Sign In</button>
          )}
          <button onClick={() => setPage('play')} style={{ background: C.blue, color: C.deck }}
            className="text-sm font-semibold px-4 py-1.5 hover:brightness-110 transition-all">Play</button>
        </div>

        {/* Mobile right */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => setMusicOn(!musicOn)} style={{ color: musicOn ? C.cyan : C.steelDim }}
            className={musicOn ? 'animate-pulse' : ''}><MusicIcon /></button>
          <button onClick={() => setOpen(!open)} style={{ color: C.steel }}>
            <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5}>
              {open
                ? <><line x1={5} y1={5} x2={17} y2={17}/><line x1={17} y1={5} x2={5} y2={17}/></>
                : <><line x1={3} y1={7} x2={19} y2={7}/><line x1={3} y1={11} x2={19} y2={11}/><line x1={3} y1={15} x2={19} y2={15}/></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.cyan}22`, background: C.graphite2 }}
          className="md:hidden px-5 py-4 flex flex-col gap-4">
          {links.map(l => (
            <button key={l.p} onClick={() => { setPage(l.p); setOpen(false) }}
              style={{ color: page === l.p ? C.cyan : C.steel }}
              className="text-sm font-medium text-left">{l.label}</button>
          ))}
          <button onClick={() => { setPage('devtest'); setOpen(false) }} style={{ color: page === 'devtest' ? C.red : C.steelDim }}
            className="text-sm font-medium text-left">Dev/Test</button>
          {isLoggedIn ? (
            <>
              <button onClick={() => { setPage('profile'); setOpen(false) }} style={{ color: C.steel }} className="text-sm font-medium text-left">Profile</button>
              <button onClick={() => { onSignOut(); setOpen(false) }} style={{ color: C.steelDim }} className="text-xs text-left">Sign out</button>
            </>
          ) : (
            <button onClick={() => { setPage('auth'); setOpen(false) }} style={{ color: C.steel }} className="text-sm font-medium text-left">Sign In / Sign Up</button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => { setPage('play'); setOpen(false) }}
              style={{ background: C.blue, color: C.deck }} className="text-sm font-semibold px-4 py-2">Play</button>
            <div style={{ border: `1px solid ${C.steelDim}40` }} className="flex">
              {(['EN', 'RU'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  style={{ color: lang === l ? C.graphite : C.steelDim, background: lang === l ? C.cyan : 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '4px 8px' }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [hoveredTier, setHoveredTier] = useState<number | null>(null)
  const bpBg = {
    backgroundImage: `linear-gradient(rgba(31,167,163,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(31,167,163,0.05) 1px,transparent 1px)`,
    backgroundSize: '24px 24px',
  }

  return (
    <div style={{ background: C.graphite }}>
      {/* Hero */}
      <section style={{ ...bpBg, minHeight: '100vh', paddingTop: '3.5rem' }} className="relative flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 w-full grid md:grid-cols-2 gap-10 items-center">
          <div>
            {/* Part H: flex-wrap prevents overflow on mobile */}
            <div style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em' }}
              className="mb-6 flex items-center gap-2 flex-wrap">
              <span style={{ background: C.cyan }} className="inline-block w-5 h-px shrink-0" />
              <span className="break-words">TWO-PLAYER STRATEGY · PERFECT INFORMATION</span>
            </div>
            <h1 style={{ color: C.deck, lineHeight: 1.1 }} className="text-3xl md:text-5xl font-bold mb-4">
              You don&apos;t choose<br />
              <span style={{ color: C.cyan }}>your cargo.</span><br />
              Your opponent does.
            </h1>
            <p style={{ color: C.steel }} className="text-sm md:text-base leading-relaxed mb-8 max-w-md">
              PuzzleStow is a strategy game of perfect information. 27 fixed figures, sizes 1 to 7 cells.
              A 15×10 container. Your opponent selects which piece you must place next.
            </p>
            {/* Part H: flex-wrap for mobile button row */}
            <div className="flex flex-wrap gap-3 mb-10">
              <button onClick={() => setPage('play')}
                style={{ background: C.cyan, color: C.graphite, fontWeight: 600 }}
                className="px-5 py-3 text-sm hover:brightness-110 transition-all">Play Rated</button>
              <button onClick={() => setPage('practice')}
                style={{ border: `1px solid ${C.blue}`, color: C.deck }}
                className="px-5 py-3 text-sm hover:bg-blue-900/20 transition-all">Practice</button>
              <button onClick={() => setPage('sandbox')}
                style={{ border: `1px solid ${C.steelDim}`, color: C.steel }}
                className="px-5 py-3 text-sm hover:border-steel hover:text-deck transition-all">Sandbox</button>
            </div>
            <div style={{ borderLeft: `2px solid ${C.blue}`, paddingLeft: 14 }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>SAMPLE MOVE NOTATION</p>
              <code style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }}>07B9C10</code>
              <span style={{ color: C.steelDim, fontSize: 12 }} className="ml-3 hidden sm:inline">figure 7, placed B9→C10</span>
            </div>
          </div>

          {/* Right: 15×11 hero container */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div style={{ border: `1px solid ${C.cyan}28`, padding: 12, background: C.graphite2 }} className="relative overflow-hidden">
              <div style={{ position: 'absolute', top: 6, left: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: `${C.cyan}60`, letterSpacing: '0.1em' }}>
                CONTAINER 15×11 — TRAINING VIEW
              </div>
              {/* Part H: overflow-x-auto wrapper for mobile */}
              <div style={{ marginTop: 14 }} className="overflow-x-auto">
                <ContainerGrid filledCells={HERO_CELLS} closedRows={HERO_CLOSED} cellSize={19} rows={11} showJKSeparator={true} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="flex items-center gap-1.5" style={{ color: C.green }}>
                <span style={{ background: C.green }} className="inline-block w-3 h-3" />Row A closed
              </span>
              <span className="flex items-center gap-1.5" style={{ color: C.steel }}>
                <span style={{ background: `${C.blue}18`, border: `1.5px solid ${C.blue}` }} className="inline-block w-3 h-3" />Placed
              </span>
              <span className="flex items-center gap-1.5" style={{ color: C.cyan }}>
                <span style={{ background: C.cyan }} className="inline-block w-2 h-2 rounded-full" />Entry A0
              </span>
            </div>
            <div style={{ border: `1px solid ${C.cyan}28`, background: `${C.graphite2}cc`, padding: '8px 12px', maxWidth: 360, fontSize: 12, color: C.steelDim }}>
              <span style={{ color: C.cyan }}>— — —</span>
              {' '}This extra row is yours while you&apos;re learning to stack. Once you&apos;ve got it, you&apos;ll play on 15×10 like everyone else — and this line becomes the ceiling.
            </div>
            <div style={{ border: `1px solid ${C.blue}55`, padding: '7px 12px', background: `${C.blue}18` }}
              className="flex items-center gap-3 w-full">
              <span style={{ color: C.steelDim, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>INCOMING</span>
              <FigurePreview cells={FIGURES[13].cells} cardSize={32} color={C.cyan} dots={FIGURES[13].dots} number={FIGURES[13].id} />
              <span style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>F14 — chosen by opponent</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Twist */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18`, borderBottom: `1px solid ${C.cyan}18` }} className="py-14">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-4">WHAT MAKES IT DIFFERENT</p>
          <h2 style={{ color: C.deck, lineHeight: 1.2 }} className="text-2xl md:text-4xl font-bold mb-5">Strategy. Geometry. Honest play.</h2>
          <p style={{ color: C.steel }} className="text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Most games let you choose your own moves. PuzzleStow inverts this —
            your opponent selects the piece that enters your container, and you must place it legally.
            Perfect information means both players see everything. No fog of war. No luck. Only geometry and foresight.
          </p>
        </div>
      </section>

      {/* Four Rules — Part G: 64px icons */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="mb-12">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">HOW IT WORKS</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">Four rules govern every move</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { rule: '01', name: 'Support', color: C.cyan, Icon: SupportIcon,
                desc: 'No piece may float. It must rest on base row A or on an already-placed piece.' },
              { rule: '02', name: 'Steps', color: C.blue, Icon: StepsIcon,
                desc: 'Height difference between adjacent columns must not exceed 3 cells.' },
              { rule: '03', name: 'Overhang', color: '#7c9dbf', Icon: OverhangIcon,
                desc: 'More than 50% of a piece\'s area unsupported is not allowed by default. Exceeding it requires the bilateral fair-play exception.' },
              { rule: '04', name: 'Return Path', color: C.green, Icon: PathIcon,
                desc: 'After placing a piece, a passable path back to exit A0 must remain open.' },
            ].map(({ rule, name, color, Icon, desc }) => (
              <div key={rule} style={{ border: `1px solid ${color}30`, background: C.graphite2 }} className="p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{rule}</span>
                  <Icon size={64} color={color} />
                </div>
                <h3 style={{ color: C.deck }} className="text-lg font-semibold">{name}</h3>
                <p style={{ color: C.steel }} className="text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Figures Preview */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18` }} className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">FIGURE CATALOG</p>
              <h2 style={{ color: C.deck }} className="text-2xl font-semibold">27 distinct figures</h2>
              <p style={{ color: C.steel }} className="text-sm mt-1">Sizes 1 to 7 cells — each with up to 4 orientations.</p>
            </div>
            <button onClick={() => setPage('figures')}
              style={{ color: C.cyan, border: `1px solid ${C.cyan}40`, fontFamily: "'JetBrains Mono',monospace" }}
              className="hidden md:flex px-4 py-2 text-xs hover:bg-cyan-900/10 transition-all">View all 27 →</button>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2">
            {FIGURES.slice(0, 18).map(fig => (
              <div key={fig.id} onClick={() => setPage('figures')}
                style={{ border: `1px solid ${C.cyan}22`, background: C.graphite, cursor: 'pointer' }}
                className="aspect-square flex flex-col items-center justify-center gap-1 hover:border-cyan-400/50 transition-all p-1">
                <FigurePreview cells={fig.cells} cardSize={48} color={C.cyan} dots={fig.dots} number={fig.id} />
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 8 }}>{fig.label}</span>
              </div>
            ))}
            <button onClick={() => setPage('figures')}
              style={{ border: `1px dashed ${C.blue}60`, background: `${C.blue}10` }}
              className="aspect-square flex flex-col items-center justify-center hover:bg-blue-900/20 transition-all">
              <span style={{ color: C.blue, fontSize: 18 }}>+9</span>
            </button>
          </div>
          <div className="mt-5 md:hidden">
            <button onClick={() => setPage('figures')} style={{ color: C.cyan, border: `1px solid ${C.cyan}40` }} className="px-4 py-2 text-xs">View all 27 →</button>
          </div>
        </div>
      </section>

      {/* Qualification */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="mb-10">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">QUALIFICATION</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">The Lodar Path</h2>
            <p style={{ color: C.steel }} className="text-sm mt-2 max-w-xl">Seven tiers of verified ability, earned through rated play alone. No shortcuts, no purchases, no hint engines.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {TIERS.map(tier => (
              <div key={tier.id} onMouseEnter={() => setHoveredTier(tier.id)} onMouseLeave={() => setHoveredTier(null)}
                style={{ border: `1px solid ${hoveredTier === tier.id ? tier.color : `${tier.color}30`}`, background: hoveredTier === tier.id ? `${tier.color}12` : C.graphite2, transition: 'all 0.2s' }}
                className="p-4">
                <div style={{ background: tier.color, width: 28, height: 28, marginBottom: 10 }} className="flex items-center justify-center">
                  <span style={{ color: C.graphite, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{tier.abbr}</span>
                </div>
                <p style={{ color: tier.color, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{tier.name}</p>
                <p style={{ color: C.steelDim, fontSize: 11, lineHeight: 1.5 }}>{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* No AI move-advisor — exact wording preserved */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18`, borderBottom: `1px solid ${C.cyan}18` }} className="py-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div style={{ borderLeft: `3px solid ${C.cyan}`, paddingLeft: 24 }}>
            <blockquote style={{ color: C.deck, lineHeight: 1.3 }} className="text-xl md:text-3xl font-semibold mb-5">
              &ldquo;Qualification is your real level of thinking —<br />
              <span style={{ color: C.cyan }}>not access to a hint.&rdquo;</span>
            </blockquote>
            <p style={{ color: C.steel }} className="text-sm md:text-base leading-relaxed mb-4 max-w-2xl">
              There is no AI move-advisor in rated play. Not free. Not premium. Not ever.
              Practice and Sandbox modes offer a built-in algorithmic engine opponent for unrated training only,
              and are clearly separated from the rated experience at all times.
            </p>
            <p style={{ color: C.steelDim, fontSize: 13 }}>If you come from chess or Go and are tired of engine-assisted ratings, PuzzleStow is built for you.</p>
          </div>
        </div>
      </section>

      {/* Game Modes — Part B: "AI" → "built-in engine opponent" */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">GAME MODES</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-8">Three ways to play</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: 'Rated Play', tag: 'TOURNAMENT', color: C.cyan, border: C.cyan, badge: 'Affects rating', badgeColor: C.cyan,
                desc: 'Two players on a 15×10 container (rows A–J). Your opponent picks your piece. Server-confirmed rules. Results affect your Lodar qualification.',
                containerLabel: '15×10', page: 'play' as Page },
              { name: 'Practice', tag: 'UNRATED', color: '#7c9dbf', border: C.blue, badge: 'No rating effect', badgeColor: C.steelDim,
                desc: 'Play against the built-in engine opponent on a 15×10 container, mirroring the real game mechanic. Unrated — results do not affect qualification.',
                containerLabel: '15×10', page: 'practice' as Page },
              { name: 'Sandbox', tag: 'FREE', color: C.steel, border: C.steelDim, badge: 'No rating effect', badgeColor: C.steelDim,
                desc: 'Free placement on the 15×11 training container (rows A–K). Toggle rule highlights independently. The bold J/K line marks the competitive ceiling.',
                containerLabel: '15×11 + J/K line', page: 'sandbox' as Page },
            ].map(mode => (
              <div key={mode.name} style={{ border: `1px solid ${mode.border}35`, background: C.graphite2 }} className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: mode.color, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em' }}>{mode.tag}</span>
                  <span style={{ background: `${mode.badgeColor}20`, color: mode.badgeColor, fontSize: 10, padding: '2px 8px', fontFamily: "'JetBrains Mono',monospace" }}>{mode.badge}</span>
                </div>
                <h3 style={{ color: C.deck }} className="text-xl font-semibold">{mode.name}</h3>
                <p style={{ color: C.steel }} className="text-sm leading-relaxed flex-1">{mode.desc}</p>
                <div className="flex items-center justify-between">
                  <span style={{ color: mode.color, border: `1px solid ${mode.border}40`, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '2px 8px' }}>{mode.containerLabel}</span>
                  <button onClick={() => setPage(mode.page)}
                    style={{ color: mode.color, border: `1px solid ${mode.border}50` }}
                    className="text-xs px-4 py-2 hover:bg-white/5 transition-all">Enter →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PairSec Bridge — Part I: pair-sec.com */}
      <section style={{ background: `${C.blue}22`, borderTop: `1px solid ${C.blue}50`, borderBottom: `1px solid ${C.blue}50` }} className="py-14">
        <div className="max-w-5xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">FROM THE GAME TO REAL WORK</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-4">Your loader persona connects to PairSec</h2>
            <p style={{ color: C.steel }} className="text-sm leading-relaxed mb-5">
              The in-game &ldquo;loader / грузчик&rdquo; identity ties directly to the &ldquo;Грузанём!&rdquo; service on PairSec.
              MidLod qualification and above converts into verified performer status on the platform.
            </p>
            <a href="https://pair-sec.com" target="_blank" rel="noopener noreferrer"
              style={{ color: C.cyan, border: `1px solid ${C.cyan}50` }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm hover:bg-cyan-900/10 transition-all">
              What is PairSec → pair-sec.com
            </a>
          </div>
          <div style={{ border: `1px solid ${C.blue}50`, background: `${C.graphite}80`, padding: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.steelDim, marginBottom: 14, letterSpacing: '0.1em' }}>QUALIFICATION BRIDGE</div>
            {[
              { from: 'UnderLodar – Lodar', to: 'PairSec observer' },
              { from: 'MidLod+', to: '"Грузанём!" performer listing', active: true },
              { from: 'LeadLod+', to: 'Verified specialist badge', active: true },
              { from: 'ProfiLod', to: 'Judge / Consultant bookings', active: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: i < 3 ? `1px solid ${C.cyan}12` : 'none' }}>
                <span style={{ color: row.active ? C.cyan : C.steelDim, fontSize: 11, minWidth: 150, fontFamily: "'JetBrains Mono',monospace" }}>{row.from}</span>
                <span style={{ color: C.steelDim }}>→</span>
                <span style={{ color: row.active ? C.deck : C.steelDim, fontSize: 12 }}>{row.to}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">FAQ</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-8">Common questions</h2>
          <div style={{ borderTop: `1px solid ${C.cyan}18` }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.cyan}18` }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left gap-4">
                  <span style={{ color: C.deck }} className="text-sm font-medium">{item.q}</span>
                  <span style={{ color: C.cyan, fontSize: 20, lineHeight: 1, flexShrink: 0, transition: 'transform 0.2s', transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {faqOpen === i && <p style={{ color: C.steel }} className="text-sm leading-relaxed pb-5">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — Part C wired, Part K deferred removed */}
      <footer style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18` }} className="py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div style={{ background: C.cyan }} className="w-7 h-7 flex items-center justify-center">
                  <GridIcon size={14} color={C.graphite} />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: C.deck, letterSpacing: '0.06em' }} className="text-sm font-medium">PUZZLESTOW</span>
              </div>
              <p style={{ color: C.steelDim, fontSize: 13, lineHeight: 1.6 }}>Digital version of &ldquo;Отгрузка&rdquo; (Shipload). A strategy game for people who think.</p>
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em' }} className="mb-4">NAVIGATE</p>
              {([
                { label: 'Play', p: 'play' }, { label: 'Figures', p: 'figures' },
                { label: 'Rules', p: 'rules' }, { label: 'Lore', p: 'lore' },
                { label: 'Print & Play', p: 'printplay' },
              ] as { label: string; p: Page }[]).map(l => (
                <button key={l.p} onClick={() => setPage(l.p)}
                  style={{ color: C.steelDim, fontSize: 13, display: 'block', textAlign: 'left' }}
                  className="mb-2 hover:text-deck transition-colors">{l.label}</button>
              ))}
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em' }} className="mb-4">ACCOUNT</p>
              {([
                { label: 'Sign In / Sign Up', p: 'auth' }, { label: 'Profile', p: 'profile' },
              ] as { label: string; p: Page }[]).map(l => (
                <button key={l.p} onClick={() => setPage(l.p)}
                  style={{ color: C.steelDim, fontSize: 13, display: 'block', textAlign: 'left' }}
                  className="mb-2 hover:text-deck transition-colors">{l.label}</button>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.cyan}12` }} className="pt-5 flex flex-wrap items-center justify-between gap-4">
            <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>puzzlestow.com — 2026</span>
            <a href="https://pair-sec.com" target="_blank" rel="noopener noreferrer"
              style={{ color: C.steelDim, fontSize: 12 }} className="hover:text-deck transition-colors">pair-sec.com</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Figures Page ──────────────────────────────────────────────────────────────
function FiguresPage() {
  const [selected, setSelected] = useState<Figure | null>(null)
  const [orientation, setOrientation] = useState(0)
  const orientations = selected ? getOrientations(selected.cells) : []

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">FIGURE CATALOG</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-3">All 27 Figures</h1>
        <p style={{ color: C.steel }} className="text-sm mb-10 max-w-xl">Sizes 1 to 7 cells. Figure #25 is the only 7-cell piece (Heptomino-H). Click any figure to see all valid orientations.</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 mb-8">
          {FIGURES.map(fig => (
            <button key={fig.id} onClick={() => { setSelected(fig); setOrientation(0) }}
              style={{ border: `1px solid ${selected?.id === fig.id ? C.cyan : `${C.cyan}22`}`, background: selected?.id === fig.id ? `${C.cyan}18` : C.graphite2, transition: 'all 0.15s' }}
              className="aspect-square flex flex-col items-center justify-center gap-1 p-2 hover:border-cyan-400/60">
              <FigurePreview cells={fig.cells} cardSize={52} color={selected?.id === fig.id ? C.cyan : `${C.cyan}90`} dots={fig.dots} number={fig.id} />
              <span style={{ color: selected?.id === fig.id ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 8 }}>{fig.label}</span>
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span style={{ background: C.cyan, color: C.graphite, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 }} className="px-3 py-1">{selected.label}</span>
                  <h2 style={{ color: C.deck }} className="text-xl font-semibold">{selected.name}</h2>
                  <span style={{ color: C.steelDim, fontSize: 13 }}>{selected.size} {selected.size === 1 ? 'cell' : 'cells'}</span>
                </div>
                <div style={{ border: `1px solid ${C.cyan}22`, background: C.graphite, display: 'inline-block', padding: 20 }}>
                  <FigurePreview cells={selected.cells} cardSize={120} color={C.cyan} cellPx={20} dots={selected.dots} number={selected.id} />
                </div>
              </div>
              <div>
                <p style={{ color: C.steel, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', marginBottom: 14 }}>ORIENTATIONS ({orientations.length} unique)</p>
                <div className="flex flex-wrap gap-3">
                  {orientations.map((cells, i) => (
                    <button key={i} onClick={() => setOrientation(i)}
                      style={{ border: `1px solid ${orientation === i ? C.cyan : `${C.cyan}25`}`, background: orientation === i ? `${C.cyan}18` : C.graphite, transition: 'all 0.15s' }}
                      className="p-2 flex flex-col items-center gap-1">
                      <FigurePreview cells={cells} cardSize={72} color={orientation === i ? C.cyan : `${C.cyan}80`} cellPx={16} dots={selected.dots} number={selected.id} />
                      <span style={{ color: orientation === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>{i * 90}°</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 18, padding: '12px 16px', background: `${C.blue}18`, border: `1px solid ${C.blue}40` }}>
                  <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>BOUNDING BOX ({orientation * 90}°)</p>
                  {(() => {
                    const cells = orientations[orientation] || selected.cells
                    const r = cells.map(([row]) => row), c = cells.map(([, col]) => col)
                    return <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>
                      {Math.max(...c) - Math.min(...c) + 1} × {Math.max(...r) - Math.min(...r) + 1}
                    </span>
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Rules Page ────────────────────────────────────────────────────────────────
function RulesPage() {
  const rules = [
    { n: '01', name: 'Support', color: C.cyan, Icon: SupportIcon,
      summary: 'No piece may float. Every cell must rest on base row A or be supported by a previously placed cell below it.',
      detail: 'After placement, the server checks each occupied column. Any cell without support — from row A or another piece directly below — is a violation.' },
    { n: '02', name: 'Steps (≤ 3)', color: C.blue, Icon: StepsIcon,
      summary: 'Height difference between adjacent columns must not exceed 3 cells.',
      detail: 'Steps ≤ 3 are passable. Steps > 3 form a wall that blocks the return path.' },
    { n: '03', name: 'Overhang', color: '#7c9dbf', Icon: OverhangIcon,
      summary: 'More than 50% of a piece\'s area unsupported after placement is not allowed by default.',
      detail: 'When a placement would exceed the 50% unsupported threshold, the game shows a bilateral confirmation modal. Both players must actively accept before the move registers. It is never automatic or one-sided.',
      extra: (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, padding: '12px 16px', marginTop: 12 }}>
          <p style={{ color: C.red, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>FAIR-PLAY EXCEPTION</p>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6 }}>Both players must confirm via bilateral modal before the exception is applied. Never automatic. Never one-sided. Move logged in match history.</p>
        </div>
      ) },
    { n: '04', name: 'Return Path', color: C.green, Icon: PathIcon,
      summary: 'After every placement, a passable path must exist back to exit point A0.',
      detail: 'Evaluated server-side after each move. If all routes to A0 are blocked, the move is illegal.' },
    { n: '05', name: 'Row Closure', color: C.green, Icon: RowIcon,
      summary: 'Win by closing 5 full rows (horizontal and/or vertical), or forcing the opponent into an impossible placement.',
      detail: 'A full horizontal row (all 15 columns occupied) or a full vertical column (all rows in a column occupied) counts as one closure.' },
  ]

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">RULES</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-4">Complete Rule Set</h1>
        <p style={{ color: C.steel }} className="text-sm mb-12 max-w-2xl">All rules are authoritative server-side. The client displays server-confirmed state only — no client-side rules engine. This preserves anti-cheat integrity for all rated play.</p>
        <div className="flex flex-col gap-6">
          {rules.map(rule => (
            <div key={rule.n} style={{ border: `1px solid ${rule.color}30`, background: C.graphite2 }} className="p-6 md:p-8">
              <div className="flex items-start gap-5">
                <div className="shrink-0"><rule.Icon size={56} color={rule.color} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <span style={{ color: rule.color, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>RULE {rule.n}</span>
                    <h2 style={{ color: C.deck }} className="text-lg font-semibold">{rule.name}</h2>
                  </div>
                  <p style={{ color: C.deck }} className="text-sm leading-relaxed mb-2 font-medium">{rule.summary}</p>
                  <p style={{ color: C.steel }} className="text-sm leading-relaxed">{rule.detail}</p>
                  {'extra' in rule && rule.extra}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 36, border: `1px solid ${C.cyan}28`, background: C.graphite2, padding: 28 }}>
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em', marginBottom: 18 }}>CONTAINER SPECIFICATION</p>
          <div className="grid sm:grid-cols-2 gap-5 mb-7">
            {[
              { mode: 'Rated Play / Practice', size: '15×10', rows: 'A–J (10 rows)', note: 'Standard competitive container. All rated matches and practice sessions.', color: C.cyan },
              { mode: 'Sandbox', size: '15×11', rows: 'A–K (11 rows)', note: 'Training container with bold J/K separator — permanent feature, not a placeholder.', color: C.steel },
            ].map(spec => (
              <div key={spec.mode} style={{ border: `1px solid ${spec.color}30`, background: C.graphite, padding: 18 }}>
                <p style={{ color: spec.color, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{spec.mode.toUpperCase()}</p>
                <p style={{ color: C.deck, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3 }}>{spec.size}</p>
                <p style={{ color: C.steel, fontSize: 13, marginBottom: 6 }}>Rows {spec.rows}</p>
                <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5 }}>{spec.note}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Width', value: '15 columns', sub: 'labeled 0–14' },
              { label: 'Entry / Exit', value: 'A0', sub: 'bottom-left corner' },
              { label: 'Axis', value: 'A = floor', sub: 'K = training ceiling' },
              { label: 'Figures', value: '27 fixed', sub: 'sizes 1–7 cells' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{s.label.toUpperCase()}</p>
                <p style={{ color: C.deck, fontSize: 15, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</p>
                <p style={{ color: C.steelDim, fontSize: 11 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lore Page ─────────────────────────────────────────────────────────────────
function LorePage() {
  const [bOpen, setBOpen] = useState(false)
  return (
    <div style={{ background: '#161820', minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ backgroundImage: `radial-gradient(circle at center,rgba(31,167,163,0.04) 1px,transparent 1.2px)`, backgroundSize: '20px 20px', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-18">
          <p style={{ color: `${C.cyan}80`, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.2em' }} className="mb-8 pt-6">— THE LEGEND OF THE LODARS —</p>
          <h1 style={{ color: C.deck, lineHeight: 1.2, fontSize: 34, fontWeight: 700 }} className="mb-10">The Legend<br /><span style={{ color: C.cyan }}>of the Lodars</span></h1>
          <div style={{ borderLeft: `2px solid ${C.cyan}40`, paddingLeft: 22, marginBottom: 36 }}>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 20 }}>Long before the first shipping container was forged, the Lodars moved cargo across the great plateaus by a discipline that demanded both geometry and foresight. Each Lodar carried a table of 27 figures — memorized, not written — and a container drawn in chalk on stone.</p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 20 }}>The opponent&apos;s right was the opponent&apos;s gift: to choose which shape entered your space. The wisdom of the Lodars was not in avoiding bad pieces — it was in finding the placement that left every path open, every row one step closer to closure.</p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9 }}>There were seven ranks among them. An UnderLodar learned the names. A ProfiLod saw the container before the piece was called.</p>
          </div>
          <div style={{ borderLeft: `2px solid ${C.steelDim}`, paddingLeft: 22, marginBottom: 36 }}>
            <p style={{ color: C.steelDim, fontSize: 14, lineHeight: 1.8, fontStyle: 'italic' }}>&ldquo;Qualification is your real level of thinking. Not access to a hint.&rdquo;</p>
            <p style={{ color: C.steelDim, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>— attributed to the first MasterLod</p>
          </div>
          <div style={{ border: `1px solid ${C.steelDim}30`, background: `${C.graphite2}80`, padding: 22, marginBottom: 28 }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.12em' }}>ПРАЛОГ</p>
              <button onClick={() => setBOpen(!bOpen)} style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                {bOpen ? '− згарнуць' : '+ разгарнуць'}
              </button>
            </div>
            {bOpen && <p style={{ color: `${C.deck}bb`, fontSize: 15, lineHeight: 1.9 }}>Мазгавая тэрапія знаходзіцца недзе побач з працоўнай.</p>}
          </div>
          <div style={{ borderTop: `1px solid ${C.cyan}18`, paddingTop: 28 }}>
            <p style={{ color: C.steelDim, fontSize: 13 }}>The full Legend of the Lodars is an ongoing narrative developed alongside the game&apos;s community. Follow the Telegram channel for new chapters.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Play/Practice shared data ─────────────────────────────────────────────────
const LOADED_IDS = new Set([1, 2, 3, 6, 7, 8, 12, 13, 14])
const SAMPLE_HISTORY = [
  { who: 'You', notation: '03A2B3', turn: 1 },
  { who: 'Opp', notation: '07A0B1', turn: 2 },
  { who: 'You', notation: '14A5B5', turn: 3 },
  { who: 'Opp', notation: '05A10B14', turn: 4 },
  { who: 'You', notation: '01A7', turn: 5 },
  { who: 'Opp', notation: '08B1C2', turn: 6 },
]

function buildPlayCells() {
  const s = new Set<string>()
  for (let c = 0; c < 15; c++) s.add(`9,${c}`)
  for (let c = 0; c <= 5; c++) s.add(`8,${c}`)
  for (let c = 8; c <= 14; c++) s.add(`8,${c}`)
  for (let c = 0; c <= 2; c++) s.add(`7,${c}`)
  for (let c = 12; c <= 14; c++) s.add(`7,${c}`)
  return s
}
const PLAY_CELLS = buildPlayCells()
const PLAY_CLOSED = new Set([9])

function buildOppCells() {
  const s = new Set<string>()
  for (let c = 0; c < 15; c++) s.add(`9,${c}`)
  for (let c = 0; c < 15; c++) s.add(`8,${c}`)
  for (let c = 2; c <= 11; c++) s.add(`7,${c}`)
  for (let c = 4; c <= 9; c++) s.add(`6,${c}`)
  return s
}
const OPP_CELLS = buildOppCells()
const OPP_CLOSED = new Set([9, 8])

// ── Play Page (rated | practice) ─────────────────────────────────────────────
function PlayPage({ mode = 'rated' }: { mode?: 'rated' | 'practice' }) {
  const [rotIdx, setRotIdx] = useState(0)
  const [notation, setNotation] = useState('')
  const incomingFig = FIGURES[15]
  const orientations = getOrientations(incomingFig.cells)
  const curOri = orientations[rotIdx % orientations.length]
  const isPractice = mode === 'practice'

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      {/* Status bar */}
      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.cyan}22` }}
        className="px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span style={{ background: `${C.cyan}22`, color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '3px 10px' }}>
            {isPractice ? 'TRAINING SESSION' : 'YOUR TURN'}
          </span>
          <span style={{ color: C.deck, fontSize: 13 }}>
            Place <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace" }}>F16</span>
          </span>
          {isPractice && (
            <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>UNRATED</span>
          )}
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{isPractice ? 'PRACTICE' : 'RATED'}</span>
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Move 7</span>
          <span style={{ color: C.steel, fontSize: 13 }}>vs <span style={{ color: C.deck }}>{isPractice ? 'engine' : 'nikolai_k'}</span></span>
          {!isPractice && (
            <div style={{ background: `${C.green}22`, color: C.green, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '3px 10px' }}>⏱ 5:42</div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="flex flex-col gap-5">
          {/* Your container */}
          <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>YOUR CONTAINER</span>
                <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>15×10</span>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {[
                  { label: 'Placed', fill: `${C.blue}18`, border: C.blue },
                  { label: 'Row closed', fill: `${C.green}22`, border: C.green },
                  { label: 'Entry A0', fill: `${C.cyan}18`, border: C.cyan },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5" style={{ color: C.steelDim }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: l.fill, border: `1.5px solid ${l.border}` }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={PLAY_CELLS} closedRows={PLAY_CLOSED} cellSize={26} rows={10} />
            </div>
          </div>

          {/* Opponent container */}
          <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                OPPONENT — {isPractice ? 'engine' : 'nikolai_k'}
              </span>
              <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>15×10 · read-only</span>
            </div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={OPP_CELLS} closedRows={OPP_CLOSED} cellSize={15} rows={10} />
            </div>
          </div>

          {/* Remaining cargo */}
          <div style={{ border: `1px solid ${C.blue}35`, background: C.graphite2 }} className="p-4">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>
              YOUR REMAINING CARGO — figures the opponent can still assign you
            </p>
            <div className="flex flex-wrap gap-2">
              {FIGURES.map(fig => (
                <div key={fig.id} title={fig.name}
                  style={{ border: `1px solid ${LOADED_IDS.has(fig.id) ? C.steelDim + '40' : C.cyan + '40'}`, background: LOADED_IDS.has(fig.id) ? C.graphite : `${C.cyan}10`, opacity: LOADED_IDS.has(fig.id) ? 0.3 : 1 }}>
                  <FigurePreview cells={fig.cells} cardSize={34} color={LOADED_IDS.has(fig.id) ? C.steelDim : C.cyan} cellPx={6} dots={fig.dots} number={fig.id} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Incoming cargo */}
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>INCOMING CARGO</p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={curOri} cardSize={90} color={C.cyan} cellPx={16} dots={incomingFig.dots} number={incomingFig.id} />
            </div>
            <div className="mb-3">
              <span style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{incomingFig.label} — {incomingFig.name}</span>
            </div>
            <div className="flex gap-2 mb-4">
              {[0, 1, 2, 3].slice(0, orientations.length).map(i => (
                <button key={i} onClick={() => setRotIdx(i)}
                  style={{ border: `1px solid ${rotIdx % orientations.length === i ? C.cyan : C.steelDim + '50'}`, background: rotIdx % orientations.length === i ? `${C.cyan}18` : 'transparent', color: rotIdx % orientations.length === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '4px 10px' }}>{i * 90}°</button>
              ))}
            </div>
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>Drag onto your container, or type notation:</p>
            <div className="flex gap-2">
              <input value={notation} onChange={e => setNotation(e.target.value)} placeholder="e.g. B9C10"
                style={{ background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', flex: 1, outline: 'none' }} />
              <button style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px' }}>OK</button>
            </div>
          </div>

          {/* Request panel */}
          <div style={{ border: `1px solid ${C.blue}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 6 }}>REQUEST — OPPONENT&apos;S REMAINING POOL</p>
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 12 }}>Choose a figure to assign to your opponent. Greyed out = repeat-request restricted.</p>
            <div className="flex flex-wrap gap-2">
              {FIGURES.filter(f => !LOADED_IDS.has(f.id)).map(fig => (
                <button key={fig.id} title={`${fig.label} ${fig.name}`}
                  style={{ border: `1px solid ${C.blue}35`, background: 'transparent', opacity: fig.id === 7 ? 0.3 : 1 }}
                  disabled={fig.id === 7}>
                  <FigurePreview cells={fig.cells} cardSize={30} color={C.steelDim} cellPx={5} dots={fig.dots} number={fig.id} />
                </button>
              ))}
            </div>
          </div>

          {/* Move history */}
          <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-5 flex-1">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>MOVE HISTORY</p>
            {SAMPLE_HISTORY.map((m, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderBottom: `1px solid ${C.cyan}0a` }}>
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, minWidth: 16 }}>{m.turn}</span>
                <span style={{ color: m.who === 'You' ? C.cyan : C.steel, fontSize: 11, minWidth: 28 }}>{m.who}</span>
                <code style={{ color: m.who === 'You' ? C.deck : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{m.notation}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Practice Page ─────────────────────────────────────────────────────────────
function PracticePage() { return <PlayPage mode="practice" /> }

// ── Sandbox Page ──────────────────────────────────────────────────────────────
function buildSandboxDemo() {
  // Part F: entry (col 0) must stay low and unremarkable — no teaching scenario at A0.
  const s = new Set<string>()
  for (let c = 0; c < 15; c++) s.add(`10,${c}`)
  for (let c = 4; c <= 11; c++) s.add(`9,${c}`)
  for (let c = 6; c <= 7; c++) s.add(`8,${c}`)
  for (let c = 12; c <= 14; c++) { for (let r = 5; r <= 10; r++) s.add(`${r},${c}`) }
  return s
}

function SandboxPage() {
  const [cells, setCells] = useState(buildSandboxDemo)
  const [selectedFigId, setSelectedFigId] = useState<number | null>(null)
  const [oriIdx, setOriIdx] = useState(0)
  const [ruleToggles, setRuleToggles] = useState({ support: false, steps: false, overhang: false, returnPath: false })

  const toggleRule = (k: keyof typeof ruleToggles) => setRuleToggles(r => ({ ...r, [k]: !r[k] }))

  const highlights = mergeHighlights(
    ruleToggles.support ? supportHL(cells, 11) : new Map(),
    ruleToggles.steps ? stepsHL(cells, 11) : new Map(),
    ruleToggles.overhang ? overhangHL(cells, 11) : new Map(),
    ruleToggles.returnPath ? returnPathHL(cells, 11) : new Map(),
  )

  const RULE_COLORS: Record<string, string> = {
    support: C.green, steps: C.red, overhang: '#ffaa00', returnPath: C.cyan,
  }

  const handleCellClick = (r: number, c: number) => {
    if (!selectedFigId) return
    const fig = FIGURES.find(f => f.id === selectedFigId)!
    const oris = getOrientations(fig.cells)
    const ori = oris[oriIdx % oris.length]
    const next = new Set(cells)
    ori.forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < 11 && nc >= 0 && nc < 15) next.add(`${nr},${nc}`)
    })
    setCells(next)
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}30` }} className="px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <span style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>SANDBOX</span>
          <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>UNRATED · FREE PLACEMENT · 15×11</span>
        </div>
        <button onClick={() => { setCells(buildSandboxDemo()); setSelectedFigId(null) }}
          style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
          className="hover:text-deck transition-colors">Reset demo</button>
      </div>

      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}20` }} className="px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
        <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>RULE HIGHLIGHTS:</span>
        {(Object.entries(ruleToggles) as [keyof typeof ruleToggles, boolean][]).map(([k, on]) => {
          const label = k === 'returnPath' ? 'Return Path' : k.charAt(0).toUpperCase() + k.slice(1)
          return (
            <button key={k} onClick={() => toggleRule(k)}
              style={{ border: `1px solid ${on ? RULE_COLORS[k] : C.steelDim + '40'}`, background: on ? `${RULE_COLORS[k]}20` : 'transparent', color: on ? RULE_COLORS[k] : C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", padding: '4px 12px', transition: 'all 0.15s' }}>
              {label} {on ? '●' : '○'}
            </button>
          )
        })}
        <span style={{ color: C.steelDim, fontSize: 11 }}>Click grid to place selected figure.</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_260px] gap-5">
        <div style={{ border: `1px solid ${C.cyan}25`, background: C.graphite2 }} className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>TRAINING CONTAINER</span>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              {(Object.entries(ruleToggles) as [keyof typeof ruleToggles, boolean][]).filter(([, on]) => on).map(([k]) => (
                <span key={k} className="flex items-center gap-1.5" style={{ color: RULE_COLORS[k] }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: RULE_COLORS[k], opacity: 0.5 }} />
                  {k === 'returnPath' ? 'Return Path' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <ContainerGrid filledCells={cells} cellSize={26} rows={11}
              showJKSeparator={true} highlightCells={highlights} onCellClick={handleCellClick} />
          </div>
          <div style={{ marginTop: 10, border: `1px solid ${C.cyan}20`, padding: '8px 12px', fontSize: 12, color: C.steelDim }}>
            <span style={{ color: C.cyan }}>— — —</span>
            {' '}This extra row is yours while you&apos;re learning to stack. Once you&apos;ve got it, you&apos;ll play on 15×10 — and this line becomes the ceiling.
          </div>
        </div>

        {/* Figure picker */}
        <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-4">
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>FIGURE PICKER</p>
          {selectedFigId && (() => {
            const fig = FIGURES.find(f => f.id === selectedFigId)!
            const oris = getOrientations(fig.cells)
            const cur = oris[oriIdx % oris.length]
            return (
              <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite, padding: 12, marginBottom: 12 }}>
                <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, display: 'block', marginBottom: 8 }}>{fig.label} — {fig.name}</span>
                <div className="flex items-center justify-center mb-3">
                  <FigurePreview cells={cur} cardSize={72} color={C.cyan} cellPx={14} dots={fig.dots} number={fig.id} />
                </div>
                <div className="flex gap-2 justify-center">
                  {oris.map((_, i) => (
                    <button key={i} onClick={() => setOriIdx(i)}
                      style={{ border: `1px solid ${oriIdx % oris.length === i ? C.cyan : C.steelDim + '50'}`, background: oriIdx % oris.length === i ? `${C.cyan}18` : 'transparent', color: oriIdx % oris.length === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 8px' }}>
                      {i * 90}°
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          <div className="grid grid-cols-5 gap-1.5 max-h-96 overflow-y-auto">
            {FIGURES.map(fig => (
              <button key={fig.id} onClick={() => { setSelectedFigId(fig.id); setOriIdx(0) }} title={fig.name}
                style={{ border: `1px solid ${selectedFigId === fig.id ? C.cyan : C.steelDim + '30'}`, background: selectedFigId === fig.id ? `${C.cyan}18` : 'transparent' }}
                className="p-1 hover:border-cyan-400/50 transition-all">
                <FigurePreview cells={fig.cells} cardSize={36} color={selectedFigId === fig.id ? C.cyan : C.steelDim} cellPx={6} dots={fig.dots} number={fig.id} />
              </button>
            ))}
          </div>
          <button onClick={() => setCells(new Set())}
            style={{ color: C.steelDim, border: `1px solid ${C.steelDim}30`, fontSize: 11, width: '100%', padding: '6px', marginTop: 12 }}
            className="hover:text-deck transition-colors">Clear all</button>
        </div>
      </div>
    </div>
  )
}

// ── Auth Page — Light Deck bg, flip card ──────────────────────────────────────
function AuthPage({ onAuth, setPage }: { onAuth: () => void; setPage: (p: Page) => void }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', nickname: '', useNickname: false, email: '', password: '', confirm: '', agree: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const upd = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const validateSignUp = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.email.includes('@')) e.email = 'Enter a valid email address'
    if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    if (!form.agree) e.agree = 'You must agree to the rules to continue'
    return e
  }

  const handleSubmit = () => {
    if (isSignUp) {
      const e = validateSignUp()
      setErrors(e)
      if (Object.keys(e).length === 0) setSubmitted(true)
    } else {
      onAuth()
      setPage('home')
    }
  }

  if (submitted) {
    return (
      <div style={{ background: C.deck, minHeight: '100vh' }} className="flex items-center justify-center px-4">
        <div style={{ background: '#fff', boxShadow: '0 8px 40px rgba(28,31,38,0.14)', padding: 48, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ background: C.cyan, width: 48, height: 48, margin: '0 auto 20px' }} className="flex items-center justify-center">
            <svg width={24} height={24} fill="none" stroke={C.graphite} strokeWidth={2.5}><polyline points="4,12 10,18 20,6" /></svg>
          </div>
          <h2 style={{ color: C.graphite, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Check your email</h2>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            We sent a confirmation link to <strong>{form.email}</strong>. Follow it to activate your account.
          </p>
          <button style={{ color: '#888', fontSize: 13, textDecoration: 'underline' }}>Resend (available after 60s)</button>
        </div>
      </div>
    )
  }

  const inp = (err?: string): React.CSSProperties => ({
    border: `1px solid ${err ? C.red : '#d0d5de'}`, color: C.graphite, fontSize: 14,
    padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif',
    background: '#fff', transition: 'border-color 0.15s', borderRadius: 0,
  })
  const lbl: React.CSSProperties = { color: '#444', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }
  const err: React.CSSProperties = { color: C.red, fontSize: 12, marginTop: 4 }
  const primaryBtn: React.CSSProperties = { background: C.blue, color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 0', width: '100%', border: 'none', cursor: 'pointer' }

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div onClick={onChange} style={{ width: 18, height: 18, border: `1.5px solid ${checked ? C.blue : '#ccc'}`, background: checked ? C.blue : '#fff', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
      {checked && <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth={2.5}><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
    </div>
  )

  return (
    <div style={{ background: C.deck, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex flex-col items-center justify-center px-4 py-12">
      <button onClick={() => setPage('home')} className="flex items-center gap-2 mb-8">
        <div style={{ background: C.cyan }} className="w-8 h-8 flex items-center justify-center">
          <GridIcon size={16} color={C.graphite} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: C.graphite, letterSpacing: '0.06em', fontSize: 14, fontWeight: 600 }}>PUZZLESTOW</span>
      </button>

      <div style={{ perspective: '1200px', width: '100%', maxWidth: 440 }}>
        <div style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)', transform: isSignUp ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: 540 }}>

          {/* Sign In — front */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <div style={{ background: '#fff', boxShadow: '0 4px 32px rgba(28,31,38,0.10)', padding: '36px 36px 32px' }}>
              <h2 style={{ color: C.graphite, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Sign In</h2>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
                New here?{' '}
                <button onClick={() => setIsSignUp(true)} style={{ color: C.blue, fontWeight: 600, textDecoration: 'underline' }}>Create an account</button>
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" placeholder="you@example.com" style={inp()} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label style={lbl}>Password</label>
                    <button style={{ color: C.blue, fontSize: 12 }}>Forgot password?</button>
                  </div>
                  <input type="password" placeholder="••••••••" style={inp()} />
                </div>
                <button onClick={handleSubmit} style={primaryBtn} onMouseOver={e => (e.currentTarget.style.filter = 'brightness(0.9)')} onMouseOut={e => (e.currentTarget.style.filter = '')}>
                  Sign In
                </button>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                  <button style={{ border: `1px solid ${C.blue}50`, color: C.blue, background: `${C.blue}08`, fontSize: 13, fontWeight: 500, padding: '10px 0', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <TelegramIcon size={16} />
                    Continue with Telegram
                    <span style={{ color: '#999', fontSize: 11 }}>(optional)</span>
                  </button>
                  <p style={{ color: '#999', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Telegram login links your account for quick access from the WebView. Email login is the primary method.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Up — back */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', overflowY: 'auto' }}>
            <div style={{ background: '#fff', boxShadow: '0 4px 32px rgba(28,31,38,0.10)', padding: '36px 36px 32px' }}>
              <h2 style={{ color: C.graphite, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Create Account</h2>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
                Already registered?{' '}
                <button onClick={() => { setIsSignUp(false); setErrors({}) }} style={{ color: C.blue, fontWeight: 600, textDecoration: 'underline' }}>Sign in</button>
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>First Name</label>
                    <input value={form.firstName} onChange={e => upd('firstName', e.target.value)} style={inp(errors.firstName)} />
                    {errors.firstName && <p style={err}>{errors.firstName}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Last Name</label>
                    <input value={form.lastName} onChange={e => upd('lastName', e.target.value)} style={inp()} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Nickname</label>
                  <input value={form.nickname} onChange={e => upd('nickname', e.target.value)} placeholder="Optional" style={{ ...inp(), fontFamily: "'JetBrains Mono',monospace" }} />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.useNickname} onChange={() => upd('useNickname', !form.useNickname)} />
                  <div>
                    <span style={{ color: C.graphite, fontSize: 13, fontWeight: 500 }}>Use nickname on PuzzleStow</span>
                    <p style={{ color: '#888', fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>Your nickname replaces your display name on leaderboards, match history, and badges — in PuzzleStow only, not on PairSec service bookings.</p>
                  </div>
                </label>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="you@example.com" style={inp(errors.email)} />
                  {errors.email && <p style={err}>{errors.email}</p>}
                </div>
                <div>
                  <label style={lbl}>Password</label>
                  <input type="password" value={form.password} onChange={e => upd('password', e.target.value)} placeholder="Minimum 8 characters" style={inp(errors.password)} />
                  {errors.password && <p style={err}>{errors.password}</p>}
                </div>
                <div>
                  <label style={lbl}>Confirm Password</label>
                  <input type="password" value={form.confirm} onChange={e => upd('confirm', e.target.value)} style={inp(errors.confirm)} />
                  {errors.confirm && <p style={err}>{errors.confirm}</p>}
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agree} onChange={() => upd('agree', !form.agree)} />
                  <span style={{ color: errors.agree ? C.red : '#555', fontSize: 13 }}>I have read and agree to the game rules and terms of use</span>
                </label>
                {errors.agree && <p style={err}>{errors.agree}</p>}
                <button onClick={handleSubmit} style={primaryBtn} onMouseOver={e => (e.currentTarget.style.filter = 'brightness(0.9)')} onMouseOut={e => (e.currentTarget.style.filter = '')}>
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Print & Play Page ─────────────────────────────────────────────────────────
function PrintPlayPage() {
  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">PRINT & PLAY</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-3">Play on Paper</h1>
        <p style={{ color: C.cyan, fontSize: 18, fontStyle: 'italic', marginBottom: 20 }}>&ldquo;All you need is a sheet of grid paper and a pen.&rdquo;</p>
        <p style={{ color: C.steel }} className="text-sm leading-relaxed mb-12 max-w-2xl">PuzzleStow can be played entirely without the app. Print two container grids, keep the figure table nearby, and play face-to-face or by correspondence.</p>

        {/* 3-step instructions */}
        <div className="grid sm:grid-cols-3 gap-5 mb-14">
          {[
            { step: '01', title: 'Draw two containers', desc: 'Each player draws their 15×10 grid on squared paper, labeling columns 0–14 along the bottom and rows A–J on the right. Mark A0 (bottom-left) as the entry point.' },
            { step: '02', title: 'Mark coordinates', desc: 'Agree on a move notation format — e.g. [figureId][col1][row1][col2][row2]. Record every move in writing so both players can verify the game state at any time.' },
            { step: '03', title: 'Keep the figure table nearby', desc: 'Print the 27-figure reference sheet (included in the PDF). Your opponent names a figure ID; you find it in the table and place it in your container.' },
          ].map(s => (
            <div key={s.step} style={{ border: `1px solid ${C.cyan}25`, background: C.graphite2, padding: 24 }}>
              <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, display: 'block', marginBottom: 10 }}>{s.step}</span>
              <h3 style={{ color: C.deck, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Both container templates side by side */}
        <h2 style={{ color: C.deck }} className="text-xl font-semibold mb-6">Container Templates</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {[
            { name: '15×10 Standard', label: 'COMPETITIVE', color: C.cyan, desc: 'Used in all rated matches and practice sessions. Rows A–J (10 rows). The official container for qualification play.', rows: 10 as const, sep: false, badge: 'Rated Play · Practice' },
            { name: '15×11 Beginner', label: 'TRAINING', color: C.steel, desc: 'Includes the extra row K with the bold J/K separator line. Recommended while learning to stack. The line marks the competitive ceiling.', rows: 11 as const, sep: true, badge: 'Sandbox · Learning' },
          ].map(t => (
            <div key={t.name} style={{ border: `1px solid ${t.color}30`, background: C.graphite2, padding: 20 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span style={{ color: t.color, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em' }}>{t.label}</span>
                  <h3 style={{ color: C.deck, fontSize: 16, fontWeight: 600, marginTop: 3 }}>{t.name}</h3>
                </div>
                <span style={{ background: `${t.color}20`, color: t.color, fontSize: 10, padding: '3px 10px', fontFamily: "'JetBrains Mono',monospace" }}>{t.badge}</span>
              </div>
              <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{t.desc}</p>
              <div className="overflow-x-auto mb-4">
                <ContainerGrid filledCells={new Set()} cellSize={15} rows={t.rows} showJKSeparator={t.sep} />
              </div>
              <button style={{ background: t.color, color: t.color === C.steel ? C.graphite : C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 2v8M3 7l4 4 4-4M2 11h10v2H2z"/></svg>
                Download PDF — {t.name}
              </button>
            </div>
          ))}
        </div>

        {/* Figures reference */}
        <div style={{ border: `1px solid ${C.cyan}22`, background: C.graphite2, padding: 24 }}>
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em', marginBottom: 5 }}>FIGURE REFERENCE</p>
          <h3 style={{ color: C.deck, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>All 27 Figures — Quick Reference Sheet</h3>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 mb-5">
            {FIGURES.map(fig => (
              <div key={fig.id} style={{ border: `1px solid ${C.cyan}18`, background: C.graphite, padding: 4 }} className="flex flex-col items-center gap-1">
                <FigurePreview cells={fig.cells} cardSize={44} color={C.cyan} dots={fig.dots} number={fig.id} />
                <span style={{ color: C.steelDim, fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{fig.label}</span>
                <span style={{ color: C.steelDim, fontSize: 7, textAlign: 'center', lineHeight: 1.3 }}>{fig.name}</span>
              </div>
            ))}
          </div>
          <button style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 2v8M3 7l4 4 4-4M2 11h10v2H2z"/></svg>
            Download Complete Pack (Rules + Both Templates + Figures)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Page ──────────────────────────────────────────────────────────────
function ProfilePage() {
  const [displayName, setDisplayName] = useState('Aleksei Morozov')
  const [nickname, setNickname] = useState('lodar_ax')
  const [useNickname, setUseNickname] = useState(false)
  const shownAs = useNickname ? nickname : displayName

  const inp: React.CSSProperties = { background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 14, padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">PROFILE</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-10">Account Settings</h1>
        <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-8 mb-5">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 18 }}>IDENTITY</p>
          <div className="flex flex-col gap-5">
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", display: 'block', marginBottom: 6 }}>DISPLAY NAME</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = C.cyan)} onBlur={e => (e.currentTarget.style.borderColor = C.steelDim)} />
            </div>
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", display: 'block', marginBottom: 6 }}>NICKNAME</label>
              <input value={nickname} onChange={e => setNickname(e.target.value)} style={{ ...inp, fontFamily: "'JetBrains Mono',monospace" }}
                onFocus={e => (e.currentTarget.style.borderColor = C.cyan)} onBlur={e => (e.currentTarget.style.borderColor = C.steelDim)} />
            </div>
            <div style={{ border: `1px solid ${useNickname ? C.cyan + '50' : C.steelDim + '40'}`, background: useNickname ? `${C.cyan}10` : 'transparent', padding: '14px 16px', transition: 'all 0.2s' }}>
              <label className="flex items-start gap-4 cursor-pointer">
                <div onClick={() => setUseNickname(!useNickname)}
                  style={{ width: 18, height: 18, border: `1.5px solid ${useNickname ? C.cyan : C.steelDim}`, background: useNickname ? C.cyan : 'transparent', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {useNickname && <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={C.graphite} strokeWidth={2}><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                </div>
                <div>
                  <p style={{ color: C.deck, fontSize: 14, fontWeight: 500 }}>Use nickname</p>
                  <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>When checked, your nickname replaces your display name on PuzzleStow leaderboards, match history, profile cards, and Lodar Path badges.</p>
                </div>
              </label>
            </div>
            <div style={{ background: C.graphite, border: `1px solid ${C.steelDim}30`, padding: '12px 16px' }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>SHOWN AS IN PUZZLESTOW</p>
              <span style={{ color: C.deck, fontSize: 16, fontWeight: 600, fontFamily: useNickname ? "'JetBrains Mono',monospace" : 'inherit' }}>{shownAs}</span>
            </div>
            <div style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}40`, padding: '12px 16px' }}>
              <p style={{ color: C.blue, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 5, letterSpacing: '0.08em' }}>PAIRSEC SCOPE NOTE</p>
              <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.6 }}>This nickname toggle applies to PuzzleStow display only. It does not affect how your identity is shown for PairSec service bookings — PairSec&apos;s trust model relies on transparent identity for in-person services.</p>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button style={{ background: C.cyan, color: C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 24px' }} className="hover:brightness-110 transition-all">Save Changes</button>
            <button style={{ color: C.steel, border: `1px solid ${C.steelDim}`, fontSize: 13, padding: '10px 24px' }} className="hover:text-deck transition-colors">Cancel</button>
          </div>
        </div>
        <div style={{ border: `1px solid ${C.cyan}18`, background: C.graphite2 }} className="p-6">
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>QUALIFICATION</p>
          <div className="flex items-center gap-5">
            <div style={{ background: C.blue, width: 44, height: 44 }} className="flex items-center justify-center">
              <span style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700 }}>ML</span>
            </div>
            <div>
              <p style={{ color: C.cyan, fontWeight: 600, fontSize: 16 }}>MidLod</p>
              <p style={{ color: C.steelDim, fontSize: 13 }}>Tier 3 of 7 · 47 rated matches</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dev/Test Environment Page — TO_DO.docx items 6-8 (2026-09-06) ─────────────
// Not a public game mode: a harness for exercising the rules/opponent engine
// (src/engine/rules.ts, src/engine/opponentEngine.ts) while a real backend
// doesn't exist yet. See those files for what's approximated and why.
function DevTestPage() {
  const DEV_ROWS = 10 // matches Rated/Practice container size (v2 Part B)

  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const engine = useMemo(() => createOpponentEngine({ difficulty }), [difficulty])

  const [filledYou, setFilledYou] = useState<Set<string>>(new Set())
  const [filledOpp, setFilledOpp] = useState<Set<string>>(new Set())
  const [usedIds, setUsedIds] = useState<Set<number>>(new Set())

  const [coinState, setCoinState] = useState<'idle' | 'spinning' | 'done'>('idle')
  const [requester, setRequester] = useState<'you' | 'opp' | null>(null)

  const [incomingFigId, setIncomingFigId] = useState<number | null>(null)
  const [lastRequestToYou, setLastRequestToYou] = useState<number | null>(null)
  const [lastRequestToOpp, setLastRequestToOpp] = useState<number | null>(null)

  const [rotIdx, setRotIdx] = useState(0)
  const [notation, setNotation] = useState('')
  const [response, setResponse] = useState('Flip the coin to decide who requests first.')
  const [pendingFairPlay, setPendingFairPlay] = useState<{ cells: ReturnType<typeof computePlacementFromDots> } | null>(null)
  const [gameOver, setGameOver] = useState<string | null>(null)
  const [log, setLog] = useState<{ t: number; text: string }[]>([])
  const [showInternals, setShowInternals] = useState(false)

  const pushLog = (text: string) => setLog(l => [{ t: Date.now(), text }, ...l].slice(0, 40))

  const availableFigures = FIGURES.filter(f => !usedIds.has(f.id))
  const incomingFig = incomingFigId != null ? FIGURES.find(f => f.id === incomingFigId) ?? null : null
  const orientations = incomingFig ? getOrientations(incomingFig.cells) : []
  const closedYou = closedRows(filledYou, DEV_ROWS)
  const closedOpp = closedRows(filledOpp, DEV_ROWS)

  function requestForOpp(fig: Figure) {
    if (gameOver || requester !== 'you') return
    setUsedIds(prev => new Set(prev).add(fig.id))
    setLastRequestToOpp(fig.id)
    pushLog(`You request ${fig.label} for the opponent.`)
    const decision = engine.decidePlacement(fig, filledOpp, DEV_ROWS)
    if (decision.kind === 'pass') {
      pushLog(`Opponent: ${decision.message}`)
      setGameOver('You win — the opponent has no legal placement for that figure.')
      return
    }
    if (decision.kind === 'place') {
      const next = new Set(filledOpp)
      decision.cells.forEach(([r, c]) => next.add(cellKey(r, c)))
      setFilledOpp(next)
      pushLog(`Opponent places ${fig.label}. ${decision.message}`)
      const nowClosed = closedRows(next, DEV_ROWS)
      if (nowClosed.size >= 5) { setGameOver('Opponent wins — 5 rows closed.'); return }
    }
    setRequester('opp')
    setResponse('Waiting for the opponent to request a figure from you…')
  }

  // Opponent's turn to request a figure for you, whenever it becomes their turn.
  useEffect(() => {
    if (requester !== 'opp' || incomingFigId != null || gameOver) return
    const decision = engine.chooseFigureToRequest(availableFigures, lastRequestToOpp)
    if (decision.kind !== 'request') return
    setUsedIds(prev => new Set(prev).add(decision.figureId))
    setLastRequestToYou(decision.figureId)
    setIncomingFigId(decision.figureId)
    setRotIdx(0)
    setResponse(`Opponent: ${decision.message}`)
    pushLog(`Opponent requests ${FIGURES.find(f => f.id === decision.figureId)?.label} from you.`)
    const fig = FIGURES.find(f => f.id === decision.figureId)!
    if (!canPlaceAnywhere(fig, filledYou, DEV_ROWS)) {
      setGameOver('Opponent wins — you have no legal placement for the requested figure.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requester, incomingFigId, gameOver])

  function flipCoin() {
    setCoinState('spinning')
    setResponse('Flipping…')
    window.setTimeout(() => {
      const youFirst = Math.random() < 0.5
      setCoinState('done')
      setRequester(youFirst ? 'opp' : 'you') // "opp requests first" means you get the first incoming figure
      setResponse(youFirst ? 'Coin: you enter first — the opponent requests your first figure.' : 'Coin: opponent enters first — pick a figure to request for them.')
      pushLog(youFirst ? 'Coin flip: you go first.' : 'Coin flip: opponent goes first.')
    }, 5000)
  }

  function submitPlacement() {
    if (!incomingFig || gameOver) return
    const parsed = parseNotation(notation, DEV_ROWS)
    if ('error' in parsed) { setResponse(`Invalid: ${parsed.error}`); return }
    if (parsed.figureId !== incomingFig.id) {
      setResponse(`Invalid: notation is for figure ${String(parsed.figureId).padStart(2, '0')}, but ${incomingFig.label} was requested`)
      return
    }
    const cells = parsed.points.length >= 2
      ? computePlacementFromDots(incomingFig, parsed.points)
      : computePlacementFromAnchor(incomingFig, rotIdx, parsed.points[0])
    const result = checkPlacement(cells, filledYou, DEV_ROWS, !!pendingFairPlay)
    if (!result.ok) {
      if (result.needsFairPlay) {
        const fp = engine.respondToFairPlay(result.overhangRatio ?? 0)
        pushLog(`Fair-play check (${Math.round((result.overhangRatio ?? 0) * 100)}% unsupported): opponent says "${fp.message}"`)
        if (fp.kind === 'fair_play_response' && fp.approve) {
          setPendingFairPlay({ cells: result.cells ?? null })
          setResponse(`${result.reason} — opponent agreed via fair play. Submit again to confirm.`)
        } else {
          setResponse(`${result.reason} — opponent declined fair play. Choose a different placement.`)
        }
        return
      }
      setResponse(`Invalid: ${result.reason}`)
      return
    }
    setPendingFairPlay(null)
    const next = new Set(filledYou)
    result.cells!.forEach(([r, c]) => next.add(cellKey(r, c)))
    setFilledYou(next)
    setNotation('')
    setIncomingFigId(null)
    pushLog(`You place ${incomingFig.label} at ${notation.toUpperCase()}.`)
    const nowClosed = closedRows(next, DEV_ROWS)
    if (nowClosed.size >= 5) { setGameOver('You win — 5 rows closed.'); return }
    if (usedIds.size >= 27) {
      setGameOver(nowClosed.size === closedOpp.size ? 'Draw — all 27 figures placed, equal rows closed.'
        : nowClosed.size > closedOpp.size ? 'You win — more rows closed when cargo ran out.' : 'Opponent wins — more rows closed when cargo ran out.')
      return
    }
    setResponse('Placed. Choose a figure to request for the opponent.')
    setRequester('you')
  }

  function resetGame() {
    setFilledYou(new Set()); setFilledOpp(new Set()); setUsedIds(new Set())
    setCoinState('idle'); setRequester(null); setIncomingFigId(null)
    setLastRequestToYou(null); setLastRequestToOpp(null); setRotIdx(0); setNotation('')
    setPendingFairPlay(null); setGameOver(null); setLog([])
    setResponse('Flip the coin to decide who requests first.')
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ background: `${C.red}18`, borderBottom: `1px solid ${C.red}40` }} className="px-4 md:px-6 py-2 text-center">
        <span style={{ color: C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.06em' }}>
          DEV / TEST ENVIRONMENT — local engine only, not the production server (TO_DO.docx items 6-8)
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="flex flex-col gap-5">
          {gameOver && (
            <div style={{ border: `1px solid ${C.green}60`, background: `${C.green}18`, color: C.deck }} className="p-4 flex items-center justify-between gap-3">
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{gameOver}</span>
              <button onClick={resetGame} style={{ background: C.green, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '6px 12px' }}>New game</button>
            </div>
          )}

          <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>YOUR CONTAINER — {DEV_ROWS} rows, {closedYou.size} closed</span>
            </div>
            <div className="overflow-x-auto"><ContainerGrid filledCells={filledYou} closedRows={closedYou} cellSize={24} rows={DEV_ROWS} /></div>
          </div>

          <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>OPPONENT CONTAINER — {closedOpp.size} closed · {difficulty}</span>
            </div>
            <div className="overflow-x-auto"><ContainerGrid filledCells={filledOpp} closedRows={closedOpp} cellSize={18} rows={DEV_ROWS} /></div>
          </div>

          <div style={{ border: `1px solid ${C.blue}30`, background: C.graphite2 }} className="p-4">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>
              ALL 27 FIGURES {requester === 'you' && !gameOver && !incomingFig ? '— click one to request it for the opponent' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {FIGURES.map(fig => {
                const used = usedIds.has(fig.id)
                const requestable = requester === 'you' && !gameOver && !incomingFig && !used && fig.id !== lastRequestToYou
                return (
                  <button key={fig.id} title={`${fig.label} ${fig.name}${fig.id === lastRequestToYou ? ' (repeat-request blocked)' : ''}`}
                    onClick={requestable ? () => requestForOpp(fig) : undefined}
                    disabled={!requestable}
                    style={{ border: `1px solid ${used ? C.steelDim + '30' : C.cyan + '40'}`, background: used ? C.graphite : 'transparent', opacity: used ? 0.25 : 1, cursor: requestable ? 'pointer' : 'default' }}>
                    <FigurePreview cells={fig.cells} cardSize={32} color={used ? C.steelDim : C.cyan} cellPx={6} dots={fig.dots} number={fig.id} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div style={{ border: `1px solid ${C.blue}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>OPPONENT DIFFICULTY</p>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px' }}>
              <option value="easy">Easy (~15% target win rate)</option>
              <option value="medium">Medium (~30% target win rate)</option>
              <option value="hard">Hard (~55% target win rate)</option>
            </select>
          </div>

          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>WHO ENTERS FIRST</p>
            <button onClick={flipCoin} disabled={coinState === 'spinning' || requester != null}
              style={{ width: '100%', background: coinState === 'spinning' ? C.steelDim : C.cyan, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px', opacity: requester != null ? 0.4 : 1 }}
              className={coinState === 'spinning' ? 'animate-pulse' : ''}>
              {coinState === 'spinning' ? 'Flipping… (5s)' : requester != null ? 'Flipped' : 'Flip the coin'}
            </button>
          </div>

          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>INCOMING CARGO</p>
            {incomingFig ? (
              <>
                <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
                  <FigurePreview cells={orientations[rotIdx % orientations.length] ?? incomingFig.cells} cardSize={90} color={C.cyan} cellPx={16} dots={incomingFig.dots} number={incomingFig.id} />
                </div>
                <p style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, marginBottom: 10 }}>{incomingFig.label} — {incomingFig.name}</p>
                {incomingFig.dots.length < 2 && (
                  <div className="flex gap-2 mb-3">
                    {orientations.map((_, i) => (
                      <button key={i} onClick={() => setRotIdx(i)}
                        style={{ border: `1px solid ${rotIdx % orientations.length === i ? C.cyan : C.steelDim + '50'}`, background: rotIdx % orientations.length === i ? `${C.cyan}18` : 'transparent', color: rotIdx % orientations.length === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '4px 10px' }}>{i * 90}°</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: C.steelDim, fontSize: 12 }}>Nothing requested yet.</p>
            )}
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>Request notation, e.g. 07B9C10:</p>
            <div className="flex gap-2 mb-2">
              <input value={notation} onChange={e => setNotation(e.target.value)} disabled={!incomingFig || !!gameOver}
                placeholder="figure id + point(s)"
                style={{ background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', flex: 1, outline: 'none', opacity: incomingFig ? 1 : 0.4 }} />
              <button onClick={submitPlacement} disabled={!incomingFig || !notation || !!gameOver}
                style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', opacity: incomingFig && notation && !gameOver ? 1 : 0.4 }}>SUBMIT</button>
            </div>
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 4 }}>Response:</p>
            <input value={response} disabled readOnly
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.steelDim}40`, color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px' }} />
          </div>

          <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>LOG</p>
              <button onClick={() => setShowInternals(s => !s)} style={{ color: C.steelDim, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", textDecoration: 'underline' }}>
                {showInternals ? 'hide' : 'show'} engine internals
              </button>
            </div>
            {log.map(entry => (
              <p key={entry.t} style={{ color: C.steel, fontSize: 11, marginBottom: 4 }}>{entry.text}</p>
            ))}
            {showInternals && (
              <pre style={{ color: C.steelDim, fontSize: 10, marginTop: 8, whiteSpace: 'pre-wrap', borderTop: `1px solid ${C.steelDim}25`, paddingTop: 8 }}>
{JSON.stringify({ difficulty: engine.difficulty, targetWinRate: engine.targetWinRate, usedIds: [...usedIds], lastRequestToYou, lastRequestToOpp, requester }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  if (page === 'auth') {
    return (
      <AuthPage
        onAuth={() => setIsLoggedIn(true)}
        setPage={(p: Page) => setPage(p)}
      />
    )
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh' }}>
      <Nav page={page} setPage={setPage} isLoggedIn={isLoggedIn} onSignOut={() => setIsLoggedIn(false)} />
      {page === 'home'      && <HomePage setPage={setPage} />}
      {page === 'figures'   && <FiguresPage />}
      {page === 'rules'     && <RulesPage />}
      {page === 'lore'      && <LorePage />}
      {page === 'play'      && <PlayPage mode="rated" />}
      {page === 'practice'  && <PracticePage />}
      {page === 'sandbox'   && <SandboxPage />}
      {page === 'printplay' && <PrintPlayPage />}
      {page === 'profile'   && <ProfilePage />}
      {page === 'devtest'   && <DevTestPage />}
    </div>
  )
}
