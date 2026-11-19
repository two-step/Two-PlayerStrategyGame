import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { parseNotation, formatNotation, computePlacementFromDots, computePlacementFromAnchor, checkPlacement, closedRows, closedCols, computeDeadCells, cellKey, canPlaceAnywhere, rowToLetter, hasReturnPath } from './engine/rules'
import { createOpponentEngine, type Difficulty } from './engine/opponentEngine'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Session } from '@supabase/supabase-js'
import { supabase, type PuzzleStowProfile, resizeAvatarFile, blobToByteaHex, byteaHexToObjectUrl } from './lib/supabaseClient'
import { I18nProvider, useLang, type GeoSuggestion } from './lib/I18nContext'
import { LANGS, RULE_OVERVIEW_PANELS, translate, translateEngineText, type Lang } from './lib/i18n'
import {
  readStoredMusicOn,
  resolveMusicSrc,
  storeMusicOn,
  useSiteMusic,
} from './lib/useSiteMusic'
import { useActiveNews, useMusicOverrides } from './lib/siteContent'

// Supabase's auth emails (confirm signup / password recovery / email change) redirect
// back to this app with a `type` param in the URL hash (implicit flow) or query string
// (PKCE flow) -- read once, synchronously, on first render, before supabase-js's own
// detectSessionInUrl handling processes and strips it.
function getAuthRedirectType(): string | null {
  if (typeof window === 'undefined') return null
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return hashParams.get('type') || searchParams.get('type')
}

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

type Page = 'home' | 'figures' | 'rules' | 'lore' | 'play' | 'practice' | 'sandbox' | 'printplay' | 'auth' | 'profile' | 'devtest' | 'admin'
type Cells = [number, number][]

interface Figure {
  id: number; name: string; label: string; cells: Cells; size: number; dots: number[]
}

// Structured placement record for the /devtest page's log + PDF export (Sergey, 2026-09-08).
interface LogMoveRecord {
  player: 'You' | 'Opponent'
  date: string
  time: string
  spentLabel: string
  figureLabel: string
  notation: string
  closed: string[]
  youScore: number
  oppScore: number
}

// ── 27 Figures (source: otgruzka_figures.json, confirmed) ────────────────────
const FIGURES: Figure[] = [
// Порядок dots — КАНОН Сергея (2026-11-18/19, подтверждён кейсом F27 27C14B11):
// точка 1 = ЛЕВАЯ точка на исходной фигуре, точка 2 = правая («точки обозначены
// слева направо; первый клик = первая точка, вокруг неё фигура вращается, пока
// вторая точка не совпадёт со вторым кликом»). otgruzka_figures.json перечисляет
// reference_dots у 8 фигур (F09/F10/F12/F17/F19/F20/F22/F27) в порядке
// [правая, левая] — здесь порядок нормализован к [левая, правая]; геометрия cells
// при этом не меняется. У F21/F22 (зеркальная пара) следование точек противоположное
// — их пары различимы и при левой нормализации. Обратная запись точек для
// центрально-симметричной пары (F06/F08/F09/F14–F24, F26/F27; F20 — одиночная)
// молча даёт установку, повёрнутую на 180°, — computePlacementFromDots читает
// точку 1 первой и никогда не подставляет зеркальное/обратное прочтение.
  { id:  1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] },
  { id:  2, name: 'Domino', label: 'F02', size: 2, cells: [[0,0],[0,1]], dots: [0, 1] },
  { id:  3, name: 'Tromino-I', label: 'F03', size: 3, cells: [[0,0],[0,1],[0,2]], dots: [0, 2] },
  { id:  4, name: 'Tetromino-I', label: 'F04', size: 4, cells: [[0,0],[0,1],[0,2],[0,3]], dots: [0, 3] },
  { id:  5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] },
  { id:  6, name: 'Tromino-L', label: 'F06', size: 3, cells: [[0,0],[1,0],[1,1]], dots: [0, 2] },
  { id:  7, name: 'Tetromino-O', label: 'F07', size: 4, cells: [[0,0],[0,1],[1,0],[1,1]], dots: [0, 3] },
  { id:  8, name: 'Tetromino-L', label: 'F08', size: 4, cells: [[0,0],[1,0],[2,0],[2,1]], dots: [0, 3] },
  { id:  9, name: 'Tetromino-J', label: 'F09', size: 4, cells: [[0,1],[1,1],[2,0],[2,1]], dots: [2, 0] },
  { id: 10, name: 'Pentomino-F', label: 'F10', size: 5, cells: [[0,1],[0,2],[1,1],[2,0],[2,1]], dots: [3, 1] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], dots: [0, 4] },
  { id: 12, name: 'Tetromino-S', label: 'F12', size: 4, cells: [[0,1],[0,2],[1,0],[1,1]], dots: [2, 1] },
  { id: 13, name: 'Tetromino-Z', label: 'F13', size: 4, cells: [[0,0],[0,1],[1,1],[1,2]], dots: [0, 3] },
  { id: 14, name: 'Tetromino-T', label: 'F14', size: 4, cells: [[0,1],[1,0],[1,1],[1,2]], dots: [0, 3] },
  { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] },
  { id: 16, name: 'Pentomino-X', label: 'F16', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], dots: [2] },
  { id: 17, name: 'Pentomino-V', label: 'F17', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[2,0]], dots: [4, 2] },
  { id: 18, name: 'Hexomino-C', label: 'F18', size: 6, cells: [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 5] },
  { id: 19, name: 'Hexomino-B', label: 'F19', size: 6, cells: [[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [4, 0] },
  { id: 20, name: 'Pentomino-N', label: 'F20', size: 5, cells: [[0,1],[0,2],[1,0],[1,1],[2,0]], dots: [4, 1] },
  { id: 21, name: 'Pentomino-R', label: 'F21', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,2]], dots: [0, 4] },
  { id: 22, name: 'Pentomino-Y', label: 'F22', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,0]], dots: [4, 0] },
  { id: 23, name: 'Hexomino-H', label: 'F23', size: 6, cells: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 5] },
  { id: 24, name: 'Pentomino-T', label: 'F24', size: 5, cells: [[0,1],[1,1],[2,0],[2,1],[2,2]], dots: [0, 4] },
  { id: 25, name: 'Heptomino-H', label: 'F25', size: 7, cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 6] },
  { id: 26, name: 'Hexomino-P', label: 'F26', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,1],[1,3]], dots: [0, 5] },
  { id: 27, name: 'Hexomino-Q', label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]], dots: [4, 3] },
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

// Pick a cell index to carry a figure's number label: prefer a cell that is NOT
// a reference dot, closest to the shape's bounding-box center (so the number
// sits in open space); fall back to the geometric center cell (may coincide
// with a dot/fill) when every cell is a dot. Shared by FigurePreview (isolated
// catalog/preview cards) and ContainerGrid (pieces placed on the board).
function pickLabelCellIdx(cells: Cells, dotIdx: number[]): number {
  const dotSet = new Set(dotIdx)
  const rowsArr = cells.map(([r]) => r), colsArr = cells.map(([, c]) => c)
  const cR = (Math.min(...rowsArr) + Math.max(...rowsArr)) / 2
  const cC = (Math.min(...colsArr) + Math.max(...colsArr)) / 2
  const pool = cells.map((_, i) => i).filter(i => !dotSet.has(i))
  const candidates = pool.length ? pool : cells.map((_, i) => i)
  return candidates.reduce((best, i) => {
    const d = (cells[i][0] - cR) ** 2 + (cells[i][1] - cC) ** 2
    const bd = (cells[best][0] - cR) ** 2 + (cells[best][1] - cC) ** 2
    return d < bd ? i : best
  }, candidates[0])
}

// ── FigurePreview — uniform CELL_PX across all figures ───────────────────────
const CELL_PX = 14

function FigurePreview({ cells, cardSize = 72, color = C.cyan, cellPx = CELL_PX, dots = [], number, showNumber = true, responsive = false }: {
  cells: Cells; cardSize?: number; color?: string; cellPx?: number; dots?: number[]; number?: number | string; showNumber?: boolean; responsive?: boolean
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
  // Part L follow-up: put the number in a cell that isn't a reference dot, as close to
  // the shape's center as possible, instead of pinning it to the card's top-left corner —
  // avoids the number sitting on top of a dot or clipping off a small/odd-shaped figure.
  const labelIdx = canShowNumber ? pickLabelCellIdx(cells, dots) : 0
  const [labelR, labelC] = cells[labelIdx]
  const numX = ox + (labelC - minC) * fitCellPx + fitCellPx / 2
  const numY = oy + (labelR - minR) * fitCellPx + fitCellPx / 2
  return (
    <svg
      {...(responsive
        ? { viewBox: `0 0 ${cardSize} ${cardSize}`, preserveAspectRatio: 'xMidYMid meet', style: { display: 'block', width: '100%', height: '100%' } }
        : { width: cardSize, height: cardSize, style: { display: 'block', flexShrink: 0 } })}
    >
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
        <text x={numX} y={numY} textAnchor="middle" dominantBaseline="central"
          fontFamily="'JetBrains Mono',monospace" fontSize={fontSize} fontWeight={700}
          fill={C.deck} style={{ paintOrder: 'stroke', stroke: C.graphite, strokeWidth: Math.max(1, fontSize * 0.12) }}>
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
  filledCells, closedRows = new Set(), closedCols = new Set(), deadCells = new Set<string>(), cellSize = 22,
  rows = 11, showJKSeparator = false,
  highlightCells = new Map<string, string>(),
  onCellClick,
  onCellHover,
  onCellLeave,
  pieces = [],
  ghostCells,
  ghostValid = true,
  markCells,
}: {
  filledCells: Set<string>; closedRows?: Set<number>; closedCols?: Set<number>; deadCells?: Set<string>; cellSize?: number
  rows?: number; showJKSeparator?: boolean
  highlightCells?: Map<string, string>
  onCellClick?: (r: number, c: number) => void
  // Live hover tracking so the caller can preview where the SECOND click of a two-point
  // placement would land (dynamically outlined, red if that orientation is illegal) before
  // the player commits to the click — "первая точка задаёт относительно чего идёт поворот".
  onCellHover?: (r: number, c: number) => void
  onCellLeave?: () => void
  // Placed pieces to number+dot on the board (TO_DO item 8 follow-up): dotIdx are
  // indices into `cells`, same convention as Figure.dots / FigurePreview's `dots`.
  pieces?: { id: number | string; cells: Cells; dotIdx: number[] }[]
  // Faint dashed outline of where a click-to-place selection would land (item 8 follow-up).
  ghostCells?: Set<string>
  // Whether that outline represents a placement that would actually pass checkPlacement —
  // false renders it in red instead of cyan, so an erroneous click-selection reads as invalid.
  ghostValid?: boolean
  // Small filled dots marking the cell(s) the player has clicked so far, before the
  // second point (or confirmation) completes the placement.
  markCells?: { r: number; c: number }[]
}) {
  const COLS = 15, RL = 26, BH = 20
  const W = COLS * cellSize + RL, H = rows * cellSize + BH
  const labelFor = (r: number) => ROW_LABELS[rows - 1 - r]

  // Reference dots used to sit on every placed piece permanently — Sergey, 2026-09-08:
  // "точки из контейнера убираем, как лишний, ломающий картинку элемент" (remove them,
  // they clutter the board once a few pieces are down). They're still needed to read a
  // piece's orientation, so instead of always-on they now surface only on hover: "при
  // наведении на установленную в контейнере фигуру подсвечивать её расположение с
  // указанием точек" (hovering a placed figure highlights its footprint and reveals its
  // dots). The number label is unaffected — only the dots were the complaint.
  const [hoveredPieceIdx, setHoveredPieceIdx] = useState<number | null>(null)
  const pieceIdxByCell = useMemo(() => {
    const m = new Map<string, number>()
    pieces.forEach((p, pi) => p.cells.forEach(([r, c]) => m.set(`${r},${c}`, pi)))
    return m
  }, [pieces])

  return (
    <svg width={W} height={H}
      style={{ fontFamily: "'JetBrains Mono', monospace", display: 'block', cursor: onCellClick ? 'crosshair' : 'default' }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const key = `${r},${c}`
          const filled = filledCells.has(key)
          const dead = deadCells.has(key)
          // A row OR column that's fully occupied (real cargo, or a dead/X cell — see
          // computeDeadCells) closes. TO_DO.docx fix: columns used to never be checked.
          const closed = closedRows.has(r) || closedCols.has(c)
          const entry = r === rows - 1 && c === 0
          const hColor = highlightCells.get(key)

          // Outline-first: thin stroke, near-transparent fill (Part F fix)
          const fill = closed && (filled || dead) ? `${C.green}22`
            : filled ? `${C.blue}18`
            : dead ? `${C.red}14`
            : entry ? `${C.cyan}18`
            : 'transparent'
          const stroke = closed && (filled || dead) ? C.green
            : filled ? C.blue
            : dead ? `${C.red}90`
            : entry ? C.cyan
            : `${C.cyan}18`
          const sw = filled || dead ? 1.5 : 0.5

          return (
            <g key={key} onClick={onCellClick ? () => onCellClick(r, c) : undefined}
              onMouseEnter={() => { onCellHover?.(r, c); setHoveredPieceIdx(pieceIdxByCell.get(key) ?? null) }}
              onMouseLeave={() => { onCellLeave?.(); setHoveredPieceIdx(null) }}>
              <rect x={c * cellSize + 0.5} y={r * cellSize + 0.5}
                width={cellSize - 1} height={cellSize - 1}
                fill={fill} stroke={stroke} strokeWidth={sw} />
              {hColor && (
                <rect x={c * cellSize + 1} y={r * cellSize + 1}
                  width={cellSize - 2} height={cellSize - 2}
                  fill={hColor} />
              )}
              {dead && (
                <text x={c * cellSize + cellSize / 2} y={r * cellSize + cellSize / 2}
                  textAnchor="middle" dominantBaseline="central" pointerEvents="none"
                  fontFamily="'JetBrains Mono',monospace" fontWeight={700}
                  fontSize={Math.max(7, cellSize * 0.5)} fill={closed ? C.green : C.red}>
                  X
                </text>
              )}
            </g>
          )
        })
      )}
      {pieces.map((p, pi) => {
        if (!p.cells.length) return null
        const hovered = pi === hoveredPieceIdx
        const dotSet = new Set(p.dotIdx)
        const labelIdx = pickLabelCellIdx(p.cells, p.dotIdx)
        const [lr, lc] = p.cells[labelIdx]
        const fontSize = Math.max(8, Math.min(cellSize * 0.5, 12))
        return (
          <g key={`piece-${p.id}-${pi}`} pointerEvents="none">
            {hovered && p.cells.map(([r, c], i) => (
              <rect key={`ph-${i}`} x={c * cellSize + 1} y={r * cellSize + 1}
                width={cellSize - 2} height={cellSize - 2}
                fill={`${C.cyan}30`} stroke={C.cyan} strokeWidth={1.5} />
            ))}
            {hovered && p.cells.map(([r, c], i) => dotSet.has(i) ? (
              <circle key={`pd-${i}`} cx={c * cellSize + cellSize / 2} cy={r * cellSize + cellSize / 2}
                r={Math.max(1.5, cellSize * 0.11)} fill={C.deck} />
            ) : null)}
            <text x={lc * cellSize + cellSize / 2} y={lr * cellSize + cellSize / 2}
              textAnchor="middle" dominantBaseline="central"
              fontFamily="'JetBrains Mono',monospace" fontWeight={700} fontSize={fontSize}
              fill={C.deck} style={{ paintOrder: 'stroke', stroke: C.graphite, strokeWidth: fontSize * 0.32 }}>
              {p.id}
            </text>
          </g>
        )
      })}
      {ghostCells && Array.from(ghostCells).map(key => {
        const [r, c] = key.split(',').map(Number)
        const ghostColor = ghostValid ? C.cyan : C.red
        return (
          <rect key={`ghost-${key}`} x={c * cellSize + 1.5} y={r * cellSize + 1.5}
            width={cellSize - 3} height={cellSize - 3}
            fill="none" stroke={ghostColor} strokeWidth={1.25} strokeDasharray="3 2" opacity={0.6}
            pointerEvents="none" />
        )
      })}
      {markCells?.map((p, i) => (
        <circle key={`mark-${i}`} cx={p.c * cellSize + cellSize / 2} cy={p.r * cellSize + cellSize / 2}
          r={Math.max(2, cellSize * 0.16)} fill={C.cyan} opacity={0.85} pointerEvents="none" />
      ))}
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

// ── Score panel — head-to-head "mine:theirs" closed-lines score, shown to the right of
// the corresponding container (TO_DO.docx, 2026-09-08: "если у одного 1:0 ... то у
// другого счёт 0:1" — each container's panel reads from its own side, so YOUR CONTAINER
// shows you:opponent and OPPONENT CONTAINER shows opponent:you, not two independent
// counters). `breakdown` is this side's own rows-vs-columns split.
function ScorePanel({ myClosed, oppClosed, breakdown, color = C.green }: { myClosed: number; oppClosed: number; breakdown: string; color?: string }) {
  const { t } = useLang()
  return (
    <div style={{ border: `1px solid ${color}35`, background: `${color}10`, minWidth: 60 }}
      className="p-2 flex flex-col items-center justify-center gap-1 shrink-0 self-stretch">
      <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.05em' }}>{t('SCORE')}</span>
      <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{myClosed}:{oppClosed}</span>
      <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>{breakdown}</span>
    </div>
  )
}

// ── Figure bank panel — one shared renderer for both "OPPONENT FIGURES" (view-only) and
// "MY FIGURES" (clickable) in the dev/test page, so the used/dimmed/actionable styling for
// all 27 figures lives in exactly one place instead of two copies that could drift apart.
const FIGURE_BANK_WIDTH_CLASS = 'lg:w-[260px] lg:shrink-0'

function FigureBankPanel({
  title, panelColor, itemColor, onSelect, getStatus,
}: {
  title: string
  panelColor: string
  itemColor: string
  // Present only for a clickable bank (e.g. MY FIGURES); a view-only bank (OPPONENT FIGURES)
  // omits it and every figure renders as a plain, non-interactive swatch.
  onSelect?: (fig: Figure) => void
  getStatus: (fig: Figure) => { used: boolean; actionable: boolean; hint: string }
}) {
  return (
    <div style={{ border: `1px solid ${panelColor}30`, background: C.graphite2 }} className={`p-4 ${FIGURE_BANK_WIDTH_CLASS}`}>
      <p style={{ color: panelColor, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {FIGURES.map(fig => {
          const { used, actionable, hint } = getStatus(fig)
          const color = used ? C.steelDim : actionable ? itemColor : C.steelDim
          const style: CSSProperties = {
            border: `1px solid ${used ? C.steelDim + '30' : actionable ? itemColor + '40' : C.steelDim + '40'}`,
            background: used ? C.graphite : 'transparent',
            opacity: used ? 0.25 : actionable ? 1 : 0.4,
          }
          const preview = <FigurePreview cells={fig.cells} cardSize={32} color={color} cellPx={6} dots={fig.dots} showNumber={false} />
          const title_ = `${fig.label} ${fig.name}${hint ? ' ' + hint : ''}`
          return onSelect ? (
            <button key={fig.id} title={title_} onClick={actionable ? () => onSelect(fig) : undefined}
              disabled={!actionable} style={{ ...style, cursor: actionable ? 'pointer' : 'default' }}>
              {preview}
            </button>
          ) : (
            <div key={fig.id} title={title_} style={style}>{preview}</div>
          )
        })}
      </div>
    </div>
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

// Part 8 (Sergey, 2026-09-08: "Дорисовать страницу Sign In/Sign Out") -- the logged-in
// nav state (Profile / Sign out) was left as bare, mismatched text next to fully-drawn
// controls (EN/RU pill, music icon, TEST pill, Play pill) -- these two give it the same
// visual weight as the logged-out "Sign In" pill it sits beside.
function UserIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5}>
      <circle cx={8} cy={5} r={3} /><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" />
    </svg>
  )
}

function LogoutIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5}>
      <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6" />
      <path d="M10.5 11.5 14 8l-3.5-3.5" /><path d="M14 8H6" />
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

// ── News ticker (TO_DO 29) ─────────────────────────────────────────────────
/** Height of the fixed news bar; AppShell pads the page by this when it shows. */
const TICKER_HEIGHT = 28

/** NewsTicker — fixed bar under the nav, marquee of admin-entered news_items.
 *  Renders nothing when there are no active items (no stubs in MVP).
 *  Precondition: `items` comes from useActiveNews (public SELECT, is_active).
 *  Postcondition: nothing; purely presentational, all failures are upstream.
 *  Invariant: content is duplicated inside the track so the CSS loop is
 *  seamless; text is rendered as React children (never dangerouslySetInnerHTML).
 */
function NewsTicker({ items }: { items: { id: string; message: string }[] }) {
  const { t } = useLang()
  if (items.length === 0) return null
  const content = items.map(i => i.message.trim()).filter(Boolean).join('   ◆   ')
  // Speed follows content length so the loop reads at a constant pace.
  const durationSec = Math.max(30, Math.round(content.length * 0.14))
  const style: React.CSSProperties = {
    position: 'fixed', top: 56, left: 0, right: 0, height: TICKER_HEIGHT,
    background: C.graphite2, borderBottom: `1px solid ${C.cyan}22`, zIndex: 40,
    overflow: 'hidden', display: 'flex', alignItems: 'center',
  }
  return (
    <div className="ps-ticker" style={style} aria-label={t('News')}>
      <div className="ps-ticker-track" style={{ '--ps-ticker-duration': `${durationSec}s` } as React.CSSProperties}>
        <span style={tickerTextStyle}>{content}   ◆   </span>
        <span style={tickerTextStyle} aria-hidden="true">{content}   ◆   </span>
      </div>
    </div>
  )
}
const tickerTextStyle: React.CSSProperties = {
  color: C.steel, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  letterSpacing: '0.04em', whiteSpace: 'pre', flexShrink: 0,
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, isLoggedIn, isAdmin, onSignOut, musicOn, onToggleMusic }: {
  page: Page; setPage: (p: Page) => void; isLoggedIn: boolean; isAdmin?: boolean; onSignOut: () => void
  musicOn: boolean; onToggleMusic: () => void
}) {
  const [open, setOpen] = useState(false)
  const { lang, setLang, t } = useLang()

  const links: { label: string; p: Page }[] = [
    { label: t('Figures'), p: 'figures' },
    { label: t('Rules'), p: 'rules' },
    { label: t('Lore'), p: 'lore' },
    { label: t('Print & Play'), p: 'printplay' },
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
            {(Object.keys(LANGS) as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ color: lang === l ? C.graphite : C.steelDim, background: lang === l ? C.cyan : 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '4px 8px', transition: 'all 0.15s' }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={onToggleMusic} title={musicOn ? t('Music on') : t('Music off')}
            style={{ color: musicOn ? C.cyan : C.steelDim, transition: 'color 0.2s' }}
            className={musicOn ? 'animate-pulse' : ''}>
            <MusicIcon />
          </button>
          <button onClick={() => setPage('devtest')} title="Dev/test environment (TO_DO item 6)"
            style={{ color: page === 'devtest' ? C.deck : C.green, background: page === 'devtest' ? C.green : `${C.green}22`, border: `1px solid ${C.green}88`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', padding: '5px 10px' }}>
            ● TEST
          </button>
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <button onClick={() => setPage('admin')}
                  style={{ color: page === 'admin' ? C.cyan : C.steel, border: `1px solid ${page === 'admin' ? C.cyan : C.steelDim}50`, fontSize: 13, padding: '4px 14px' }}
                  className="hover:text-deck hover:border-steel transition-all">Admin</button>
              )}
              <button onClick={() => setPage('profile')}
                style={{ color: page === 'profile' ? C.cyan : C.steel, border: `1px solid ${page === 'profile' ? C.cyan : C.steelDim}50`, fontSize: 13, padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                className="hover:text-deck hover:border-steel transition-all">
                <UserIcon size={13} color={page === 'profile' ? C.cyan : C.steel} />
                {t('Profile')}
              </button>
              <button onClick={onSignOut} title={t('Sign out')} style={{ color: C.steelDim }}
                className="hover:text-deck transition-colors">
                <LogoutIcon size={16} />
              </button>
            </>
          ) : (
            <button onClick={() => setPage('auth')}
              style={{ color: C.steel, border: `1px solid ${C.steelDim}50`, fontSize: 13, padding: '4px 14px' }}
              className="hover:text-deck hover:border-steel transition-all">{t('Sign In')}</button>
          )}
          <button onClick={() => setPage('play')} style={{ background: C.blue, color: C.deck }}
            className="text-sm font-semibold px-4 py-1.5 hover:brightness-110 transition-all">{t('Play')}</button>
        </div>

        {/* Mobile right */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={onToggleMusic} style={{ color: musicOn ? C.cyan : C.steelDim }}
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
          <button onClick={() => { setPage('devtest'); setOpen(false) }}
            style={{ color: page === 'devtest' ? C.deck : C.green, background: page === 'devtest' ? C.green : `${C.green}22`, border: `1px solid ${C.green}88`, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, padding: '6px 10px', width: 'fit-content' }}
            className="text-sm text-left">● Dev/Test</button>
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <button onClick={() => { setPage('admin'); setOpen(false) }} style={{ color: page === 'admin' ? C.cyan : C.steel }} className="text-sm font-medium text-left">{t('Admin')}</button>
              )}
              <button onClick={() => { setPage('profile'); setOpen(false) }} style={{ color: page === 'profile' ? C.cyan : C.steel, display: 'flex', alignItems: 'center', gap: 8 }} className="text-sm font-medium text-left">
                <UserIcon size={14} color={page === 'profile' ? C.cyan : C.steel} />
                {t('Profile')}
              </button>
              <button onClick={() => { onSignOut(); setOpen(false) }} style={{ color: C.steelDim, display: 'flex', alignItems: 'center', gap: 8 }} className="text-sm text-left">
                <LogoutIcon size={14} />
                {t('Sign out')}
              </button>
            </>
          ) : (
            <button onClick={() => { setPage('auth'); setOpen(false) }} style={{ color: C.steel }} className="text-sm font-medium text-left">{t('Sign In / Sign Up')}</button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => { setPage('play'); setOpen(false) }}
              style={{ background: C.blue, color: C.deck }} className="text-sm font-semibold px-4 py-2">{t('Play')}</button>
            <div style={{ border: `1px solid ${C.steelDim}40` }} className="flex">
              {(Object.keys(LANGS) as Lang[]).map(l => (
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

// ── Gated preview — wraps a page for a signed-out visitor: the real page renders
// behind a blur, non-interactive (Sergey, 2026-09-08: "для гостей просто мёртвые
// страницы... чисто как скриншоты" -- dead, screenshot-style pages for guests), with a
// sign-in prompt on top. Logged-in visitors never see this -- see the page === 'sandbox'
// / page === 'practice' render branches in App().
function GatedPreview({ title, blurb, features, setPage, children }: { title: string; blurb: string; features: string[]; setPage: (p: Page) => void; children: React.ReactNode }) {
  const { t } = useLang()
  return (
    <div style={{ position: 'relative' }}>
      {/* Lighter than the old blur(3px)/75%-dim -- the real page underneath should still
          read as "this is what you'll get", not be an opaque mystery (Sergey, 2026-09-08:
          "кот в мешке" -- a cat in a bag). */}
      <div style={{ pointerEvents: 'none', userSelect: 'none', filter: 'blur(1.5px) saturate(0.75) brightness(0.9)' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `${C.graphite}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}40`, padding: '28px 32px', maxWidth: 380, textAlign: 'center', boxShadow: `0 8px 32px ${C.graphite}c0` }}>
          <p style={{ color: C.deck, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</p>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{blurb}</p>
          <ul style={{ listStyle: 'none', textAlign: 'left', margin: '0 0 20px', padding: 0 }}>
            {features.map((f, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: C.deck, fontSize: 12.5, lineHeight: 1.5, marginBottom: 6 }}>
                <span style={{ color: C.cyan, fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => setPage('auth')}
            style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 22px', border: 'none', cursor: 'pointer', width: '100%' }}>
            {t('Sign In / Sign Up')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [hoveredTier, setHoveredTier] = useState<number | null>(null)
  const { t } = useLang()
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
              <span className="break-words">{t('TWO-PLAYER STRATEGY · PERFECT INFORMATION')}</span>
            </div>
            <h1 style={{ color: C.deck, lineHeight: 1.1 }} className="text-3xl md:text-5xl font-bold mb-4">
              {t("You don't choose")}<br />
              <span style={{ color: C.cyan }}>{t('your cargo.')}</span><br />
              {t('Your opponent does.')}
            </h1>
            <p style={{ color: C.steel }} className="text-sm md:text-base leading-relaxed mb-8 max-w-md">
              {t('PuzzleStow is a strategy game of perfect information. 27 fixed figures, sizes 1 to 7 cells. A 15×10 container. Your opponent selects which piece you must place next.')}
            </p>
            {/* Part H: flex-wrap for mobile button row */}
            <div className="flex flex-wrap gap-3 mb-10">
              <button onClick={() => setPage('play')}
                style={{ background: C.cyan, color: C.graphite, fontWeight: 600 }}
                className="px-5 py-3 text-sm hover:brightness-110 transition-all">{t('Play Rated')}</button>
              <button onClick={() => setPage('practice')}
                style={{ border: `1px solid ${C.blue}`, color: C.deck }}
                className="px-5 py-3 text-sm hover:bg-blue-900/20 transition-all">{t('Practice')}</button>
              <button onClick={() => setPage('sandbox')}
                style={{ border: `1px solid ${C.steelDim}`, color: C.steel }}
                className="px-5 py-3 text-sm hover:border-steel hover:text-deck transition-all">{t('Sandbox')}</button>
            </div>
            <div style={{ borderLeft: `2px solid ${C.blue}`, paddingLeft: 14 }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{t('SAMPLE MOVE NOTATION')}</p>
              <code style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }}>07B9C10</code>
              <span style={{ color: C.steelDim, fontSize: 12 }} className="ml-3 hidden sm:inline">{t('figure 7, placed B9→C10')}</span>
            </div>
          </div>

          {/* Right: 15×11 hero container */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div style={{ border: `1px solid ${C.cyan}28`, padding: 12, background: C.graphite2 }} className="relative overflow-hidden">
              <div style={{ position: 'absolute', top: 6, left: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: `${C.cyan}60`, letterSpacing: '0.1em' }}>
                CONTAINER 15×11 — {t('TRAINING VIEW')}
              </div>
              {/* Part H: overflow-x-auto wrapper for mobile */}
              <div style={{ marginTop: 14 }} className="overflow-x-auto">
                <ContainerGrid filledCells={HERO_CELLS} closedRows={HERO_CLOSED} cellSize={19} rows={11} showJKSeparator={true} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="flex items-center gap-1.5" style={{ color: C.green }}>
                <span style={{ background: C.green }} className="inline-block w-3 h-3" />{t('Row A closed')}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: C.steel }}>
                <span style={{ background: `${C.blue}18`, border: `1.5px solid ${C.blue}` }} className="inline-block w-3 h-3" />{t('Placed')}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: C.cyan }}>
                <span style={{ background: C.cyan }} className="inline-block w-2 h-2 rounded-full" />{t('Entry A0')}
              </span>
            </div>
            <div style={{ border: `1px solid ${C.cyan}28`, background: `${C.graphite2}cc`, padding: '8px 12px', maxWidth: 360, fontSize: 12, color: C.steelDim }}>
              <span style={{ color: C.cyan }}>— — —</span>
              {' '}{t("This extra row is yours while you're learning to stack. Once you've got it, you'll play on 15×10 like everyone else — and this line becomes the ceiling.")}
            </div>
            <div style={{ border: `1px solid ${C.blue}55`, padding: '7px 12px', background: `${C.blue}18` }}
              className="flex items-center gap-3 w-full">
              <span style={{ color: C.steelDim, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{t('INCOMING')}</span>
              <FigurePreview cells={FIGURES[13].cells} cardSize={32} color={C.cyan} dots={FIGURES[13].dots} number={FIGURES[13].id} />
              <span style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{t('F14 — chosen by opponent')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Twist */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18`, borderBottom: `1px solid ${C.cyan}18` }} className="py-14">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-4">{t('WHAT MAKES IT DIFFERENT')}</p>
          <h2 style={{ color: C.deck, lineHeight: 1.2 }} className="text-2xl md:text-4xl font-bold mb-5">{t('Strategy. Geometry. Honest play.')}</h2>
          <p style={{ color: C.steel }} className="text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t('Most games let you choose your own moves. PuzzleStow inverts this — your opponent selects the piece that enters your container, and you must place it legally. Perfect information means both players see everything. No fog of war. No luck. Only geometry and foresight.')}
          </p>
        </div>
      </section>

      {/* Four Rules — Part G: 64px icons */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="mb-12">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('HOW IT WORKS')}</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">{t('Four rules govern every move')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { rule: '01', name: t('Support'), color: C.cyan, Icon: SupportIcon,
                desc: t('No piece may float. It must rest on base row A or on an already-placed piece.') },
              { rule: '02', name: t('Steps'), color: C.blue, Icon: StepsIcon,
                desc: t('Height difference between adjacent columns must not exceed 3 cells.') },
              { rule: '03', name: t('Overhang'), color: '#7c9dbf', Icon: OverhangIcon,
                desc: t("More than 50% of a piece's area unsupported is not allowed by default. Exceeding it requires the bilateral fair-play exception.") },
              { rule: '04', name: t('Return Path'), color: C.green, Icon: PathIcon,
                desc: t('After placing a piece, a passable path back to exit A0 must remain open.') },
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
              <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('FIGURE CATALOG')}</p>
              <h2 style={{ color: C.deck }} className="text-2xl font-semibold">{t('27 distinct figures')}</h2>
              <p style={{ color: C.steel }} className="text-sm mt-1">{t('Sizes 1 to 7 cells — each with up to 4 orientations.')}</p>
            </div>
            <button onClick={() => setPage('figures')}
              style={{ color: C.cyan, border: `1px solid ${C.cyan}40`, fontFamily: "'JetBrains Mono',monospace" }}
              className="hidden md:flex px-4 py-2 text-xs hover:bg-cyan-900/10 transition-all">{t('View all 27 →')}</button>
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
            <button onClick={() => setPage('figures')} style={{ color: C.cyan, border: `1px solid ${C.cyan}40` }} className="px-4 py-2 text-xs">{t('View all 27 →')}</button>
          </div>
        </div>
      </section>

      {/* Qualification */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="mb-10">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('QUALIFICATION')}</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">{t('The Lodar Path')}</h2>
            <p style={{ color: C.steel }} className="text-sm mt-2 max-w-xl">{t('Seven tiers of verified ability, earned through rated play alone. No shortcuts, no purchases, no hint engines.')}</p>
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
                <p style={{ color: C.steelDim, fontSize: 11, lineHeight: 1.5 }}>{t(tier.desc)}</p>
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
              &ldquo;{t('Qualification is your real level of thinking —')}<br />
              <span style={{ color: C.cyan }}>{t('not access to a hint.')}&rdquo;</span>
            </blockquote>
            <p style={{ color: C.steel }} className="text-sm md:text-base leading-relaxed mb-4 max-w-2xl">
              {t('There is no AI move-advisor in rated play. Not free. Not premium. Not ever. Practice and Sandbox modes offer a built-in algorithmic engine opponent for unrated training only, and are clearly separated from the rated experience at all times.')}
            </p>
            <p style={{ color: C.steelDim, fontSize: 13 }}>{t('If you come from chess or Go and are tired of engine-assisted ratings, PuzzleStow is built for you.')}</p>
          </div>
        </div>
      </section>

      {/* Game Modes — Part B: "AI" → "built-in engine opponent" */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('GAME MODES')}</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-8">{t('Three ways to play')}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: t('Rated Play'), tag: t('TOURNAMENT'), color: C.cyan, border: C.cyan, badge: t('Affects rating'), badgeColor: C.cyan,
                desc: t('Two players on a 15×10 container (rows A–J). Your opponent picks your piece. Server-confirmed rules. Results affect your Lodar qualification.'),
                containerLabel: '15×10', page: 'play' as Page },
              { name: t('Practice'), tag: t('UNRATED'), color: '#7c9dbf', border: C.blue, badge: t('No rating effect'), badgeColor: C.steelDim,
                desc: t('Play against the built-in engine opponent on a 15×10 container, mirroring the real game mechanic. Unrated — results do not affect qualification.'),
                containerLabel: '15×10', page: 'practice' as Page },
              { name: t('Sandbox'), tag: t('FREE'), color: C.steel, border: C.steelDim, badge: t('No rating effect'), badgeColor: C.steelDim,
                desc: t('Free placement on the 15×11 training container (rows A–K). Toggle rule highlights independently. The bold J/K line marks the competitive ceiling.'),
                containerLabel: t('15×11 + J/K line'), page: 'sandbox' as Page },
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
                    className="text-xs px-4 py-2 hover:bg-white/5 transition-all">{t('Enter →')}</button>
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
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('FROM THE GAME TO REAL WORK')}</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-4">{t('Your loader persona connects to PairSec')}</h2>
            <p style={{ color: C.steel }} className="text-sm leading-relaxed mb-5">
              {t('The in-game “loader / грузчик” identity ties directly to the “Грузанём!” service on PairSec. MidLod qualification and above converts into verified performer status on the platform.')}
            </p>
            <a href="https://pair-sec.com" target="_blank" rel="noopener noreferrer"
              style={{ color: C.cyan, border: `1px solid ${C.cyan}50` }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm hover:bg-cyan-900/10 transition-all">
              {t('What is PairSec → pair-sec.com')}
            </a>
          </div>
          <div style={{ border: `1px solid ${C.blue}50`, background: `${C.graphite}80`, padding: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.steelDim, marginBottom: 14, letterSpacing: '0.1em' }}>{t('QUALIFICATION BRIDGE')}</div>
            {[
              { from: 'UnderLodar – Lodar', to: t('PairSec observer') },
              { from: 'MidLod+', to: t('“Грузанём!” performer listing'), active: true },
              { from: 'LeadLod+', to: t('Verified specialist badge'), active: true },
              { from: 'ProfiLod', to: t('Judge / Consultant bookings'), active: true },
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
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('FAQ')}</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-8">{t('Common questions')}</h2>
          <div style={{ borderTop: `1px solid ${C.cyan}18` }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.cyan}18` }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left gap-4">
                  <span style={{ color: C.deck }} className="text-sm font-medium">{t(item.q)}</span>
                  <span style={{ color: C.cyan, fontSize: 20, lineHeight: 1, flexShrink: 0, transition: 'transform 0.2s', transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {faqOpen === i && <p style={{ color: C.steel }} className="text-sm leading-relaxed pb-5">{t(item.a)}</p>}
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
              <p style={{ color: C.steelDim, fontSize: 13, lineHeight: 1.6 }}>{t('Digital version of “Отгрузка” (Shipload). A strategy game for people who think.')}</p>
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em' }} className="mb-4">{t('NAVIGATE')}</p>
              {([
                { label: t('Play'), p: 'play' }, { label: t('Figures'), p: 'figures' },
                { label: t('Rules'), p: 'rules' }, { label: t('Lore'), p: 'lore' },
                { label: t('Print & Play'), p: 'printplay' },
              ] as { label: string; p: Page }[]).map(l => (
                <button key={l.p} onClick={() => setPage(l.p)}
                  style={{ color: C.steelDim, fontSize: 13, display: 'block', textAlign: 'left' }}
                  className="mb-2 hover:text-deck transition-colors">{l.label}</button>
              ))}
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em' }} className="mb-4">{t('ACCOUNT')}</p>
              {([
                { label: t('Sign In / Sign Up'), p: 'auth' }, { label: t('Profile'), p: 'profile' },
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
  const { t } = useLang()
  const orientations = selected ? getOrientations(selected.cells) : []

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">FIGURE CATALOG</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-3">{t('All 27 Figures')}</h1>
        <p style={{ color: C.steel }} className="text-sm mb-10 max-w-xl">{t('Sizes 1 to 7 cells. Figure #25 is the only 7-cell piece (Heptomino-H). Click any figure to see all valid orientations.')}</p>
        <div className="grid grid-cols-9 gap-2 mb-8">
          {FIGURES.map(fig => (
            <button key={fig.id} onClick={() => { setSelected(fig); setOrientation(0) }}
              style={{ border: `1px solid ${selected?.id === fig.id ? C.cyan : `${C.cyan}22`}`, background: selected?.id === fig.id ? `${C.cyan}18` : C.graphite2, transition: 'all 0.15s' }}
              className="aspect-square flex flex-col items-center justify-center gap-1 p-2 hover:border-cyan-400/60">
              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <FigurePreview cells={fig.cells} cardSize={92} cellPx={19} responsive color={selected?.id === fig.id ? C.cyan : `${C.cyan}90`} dots={fig.dots} number={fig.id} />
              </div>
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
                  <span style={{ color: C.steelDim, fontSize: 13 }}>{selected.size} {selected.size === 1 ? t('cell') : t('cells')}</span>
                </div>
                <div style={{ border: `1px solid ${C.cyan}22`, background: C.graphite, display: 'inline-block', padding: 20 }}>
                  <FigurePreview cells={selected.cells} cardSize={120} color={C.cyan} cellPx={20} dots={selected.dots} number={selected.id} />
                </div>
              </div>
              <div>
                <p style={{ color: C.steel, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', marginBottom: 14 }}>{t('ORIENTATIONS ({n} unique)', { n: orientations.length })}</p>
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
                  <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{t('BOUNDING BOX ({n}°)', { n: orientation * 90 })}</p>
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
  const { t } = useLang()
  const rules = [
    { n: '01', name: t('Support'), color: C.cyan, Icon: SupportIcon,
      summary: t('No piece may float. Every cell must rest on base row A or be supported by a previously placed cell below it.'),
      detail: t('After placement, the server checks each occupied column. Any cell without support — from row A or another piece directly below — is a violation.') },
    { n: '02', name: t('Steps (≤ 3)'), color: C.blue, Icon: StepsIcon,
      summary: t('Height difference between adjacent columns must not exceed 3 cells.'),
      detail: t('Steps ≤ 3 are passable. Steps > 3 form a wall that blocks the return path.') },
    { n: '03', name: t('Overhang'), color: '#7c9dbf', Icon: OverhangIcon,
      summary: t("More than 50% of a piece's area unsupported after placement is not allowed by default."),
      detail: t('When a placement would exceed the 50% unsupported threshold, the game shows a bilateral confirmation modal. Both players must actively accept before the move registers. It is never automatic or one-sided.'),
      extra: (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, padding: '12px 16px', marginTop: 12 }}>
          <p style={{ color: C.red, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{t('FAIR-PLAY EXCEPTION')}</p>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6 }}>{t('Both players must confirm via bilateral modal before the exception is applied. Never automatic. Never one-sided. Move logged in match history.')}</p>
        </div>
      ) },
    { n: '04', name: t('Return Path'), color: C.green, Icon: PathIcon,
      summary: t('After every placement, a passable path must exist back to exit point A0.'),
      detail: t('Evaluated server-side after each move. If all routes to A0 are blocked, the move is illegal.') },
    { n: '05', name: t('Row Closure'), color: C.green, Icon: RowIcon,
      summary: t('Win by closing 5 full rows (horizontal and/or vertical), or forcing the opponent into an impossible placement.'),
      detail: t('A full horizontal row (all 15 columns occupied) or a full vertical column (all rows in a column occupied) counts as one closure.') },
  ]

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">{t('RULES')}</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-4">{t('Complete Rule Set')}</h1>
        <p style={{ color: C.steel }} className="text-sm mb-12 max-w-2xl">{t('All rules are authoritative server-side. The client displays server-confirmed state only — no client-side rules engine. This preserves anti-cheat integrity for all rated play.')}</p>
        <div className="flex flex-col gap-6">
          {rules.map(rule => (
            <div key={rule.n} style={{ border: `1px solid ${rule.color}30`, background: C.graphite2 }} className="p-6 md:p-8">
              <div className="flex items-start gap-5">
                <div className="shrink-0"><rule.Icon size={56} color={rule.color} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <span style={{ color: rule.color, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('RULE {n}', { n: rule.n })}</span>
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
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em', marginBottom: 18 }}>{t('CONTAINER SPECIFICATION')}</p>
          <div className="grid sm:grid-cols-2 gap-5 mb-7">
            {[
              { mode: t('Rated Play / Practice'), size: '15×10', rows: t('A–J (10 rows)'), note: t('Standard competitive container. All rated matches and practice sessions.'), color: C.cyan },
              { mode: t('Sandbox'), size: '15×11', rows: t('A–K (11 rows)'), note: t('Training container with bold J/K separator — permanent feature, not a placeholder.'), color: C.steel },
            ].map(spec => (
              <div key={spec.mode} style={{ border: `1px solid ${spec.color}30`, background: C.graphite, padding: 18 }}>
                <p style={{ color: spec.color, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{spec.mode.toUpperCase()}</p>
                <p style={{ color: C.deck, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3 }}>{spec.size}</p>
                <p style={{ color: C.steel, fontSize: 13, marginBottom: 6 }}>{t('Rows {rows}', { rows: spec.rows })}</p>
                <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5 }}>{spec.note}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: t('Width'), value: t('15 columns'), sub: t('labeled 0–14') },
              { label: t('Entry / Exit'), value: 'A0', sub: t('bottom-left corner') },
              { label: t('Axis'), value: t('A = floor'), sub: t('K = training ceiling') },
              { label: t('Figures'), value: t('27 fixed'), sub: t('sizes 1–7 cells') },
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
  const { t } = useLang()
  return (
    <div style={{ background: '#161820', minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ backgroundImage: `radial-gradient(circle at center,rgba(31,167,163,0.04) 1px,transparent 1.2px)`, backgroundSize: '20px 20px', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-18">
          <p style={{ color: `${C.cyan}80`, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.2em' }} className="mb-8 pt-6">{t('— THE LEGEND OF THE LODARS —')}</p>
          <h1 style={{ color: C.deck, lineHeight: 1.2, fontSize: 34, fontWeight: 700 }} className="mb-10">{t('The Legend')}<br /><span style={{ color: C.cyan }}>{t('of the Lodars')}</span></h1>
          <div style={{ borderLeft: `2px solid ${C.cyan}40`, paddingLeft: 22, marginBottom: 36 }}>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 20 }}>{t('Long before the first shipping container was forged, the Lodars moved cargo across the great plateaus by a discipline that demanded both geometry and foresight. Each Lodar carried a table of 27 figures — memorized, not written — and a container drawn in chalk on stone.')}</p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 20 }}>{t("The opponent's right was the opponent's gift: to choose which shape entered your space. The wisdom of the Lodars was not in avoiding bad pieces — it was in finding the placement that left every path open, every row one step closer to closure.")}</p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9 }}>{t('There were seven ranks among them. An UnderLodar learned the names. A ProfiLod saw the container before the piece was called.')}</p>
          </div>
          <div style={{ borderLeft: `2px solid ${C.steelDim}`, paddingLeft: 22, marginBottom: 36 }}>
            <p style={{ color: C.steelDim, fontSize: 14, lineHeight: 1.8, fontStyle: 'italic' }}>{t('“Qualification is your real level of thinking. Not access to a hint.”')}</p>
            <p style={{ color: C.steelDim, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>{t('— attributed to the first MasterLod')}</p>
          </div>
          <div style={{ border: `1px solid ${C.steelDim}30`, background: `${C.graphite2}80`, padding: 22, marginBottom: 28 }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.12em' }}>{t('ПРАЛОГ')}</p>
              <button onClick={() => setBOpen(!bOpen)} style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                {bOpen ? t('− згарнуць') : t('+ разгарнуць')}
              </button>
            </div>
            {bOpen && (
              <>
                <p style={{ color: `${C.deck}bb`, fontSize: 15, lineHeight: 1.9, marginBottom: 14 }}>{t('Пасланне ад старажытных Лодараў:')}</p>
                <p style={{ color: `${C.deck}bb`, fontSize: 15, lineHeight: 1.9, fontStyle: 'italic' }}>{t('«Мы спадзяемся, што вам хопіць тысячагоддзя, можа быць, два, каб атрымаць першапачатковыя веды, якія ў канчатковым выніку прывядуць вас да ўсіх сакрэтаў складання рэчаў. Гэтыя 27 прадметаў прадстаўлены вам у выглядзе гульні, у якой удзельнічаюць два гульцы: адзін угадвае і кажа, што трэба пакласці, іншы, ламае галаву над тым, як гэта пакласці, і наадварот. Такі падвойны мазгавы штурм дасць вам вынік хутчэй, чым складанне за ўсё ў адну галаву. Не забывайце пра час, які праходзіць паміж ітэрацыямі складання рэчаў. Дзесьці паскорце працэс, дзесьці прытармазіце ці стабілізуйце.»')}</p>
              </>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${C.cyan}18`, paddingTop: 28 }}>
            <p style={{ color: C.steelDim, fontSize: 13 }}>{t("The full Legend of the Lodars is an ongoing narrative developed alongside the game's community. Follow the Telegram channel for new chapters.")}</p>
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
  const { t } = useLang()
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
            {isPractice ? t('TRAINING SESSION') : t('YOUR TURN')}
          </span>
          <span style={{ color: C.deck, fontSize: 13 }}>
            {t('Place')} <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace" }}>F16</span>
          </span>
          {isPractice && (
            <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>{t('UNRATED')}</span>
          )}
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{isPractice ? t('PRACTICE') : t('RATED')}</span>
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{t('Move {n}', { n: 7 })}</span>
          <span style={{ color: C.steel, fontSize: 13 }}>{t('vs')} <span style={{ color: C.deck }}>{isPractice ? t('engine') : 'nikolai_k'}</span></span>
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
                <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('YOUR CONTAINER')}</span>
                <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>15×10</span>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {[
                  { label: t('Placed'), fill: `${C.blue}18`, border: C.blue },
                  { label: t('Row closed'), fill: `${C.green}22`, border: C.green },
                  { label: t('Entry A0'), fill: `${C.cyan}18`, border: C.cyan },
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
                {t('OPPONENT — {name}', { name: isPractice ? t('engine') : 'nikolai_k' })}
              </span>
              <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>15×10 · {t('read-only')}</span>
            </div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={OPP_CELLS} closedRows={OPP_CLOSED} cellSize={15} rows={10} />
            </div>
          </div>

          {/* Remaining cargo */}
          <div style={{ border: `1px solid ${C.blue}35`, background: C.graphite2 }} className="p-4">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>
              {t('YOUR REMAINING CARGO — figures the opponent can still assign you')}
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
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>{t('INCOMING CARGO')}</p>
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
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>{t('Drag onto your container, or type notation:')}</p>
            <div className="flex gap-2">
              <input value={notation} onChange={e => setNotation(e.target.value)} placeholder={t('e.g. B9C10')}
                style={{ background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', flex: 1, outline: 'none' }} />
              <button style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px' }}>OK</button>
            </div>
          </div>

          {/* Request panel */}
          <div style={{ border: `1px solid ${C.blue}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 6 }}>{t("REQUEST — OPPONENT'S REMAINING POOL")}</p>
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 12 }}>{t('Choose a figure to assign to your opponent. Greyed out = repeat-request restricted.')}</p>
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
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('MOVE HISTORY')}</p>
            {SAMPLE_HISTORY.map((m, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderBottom: `1px solid ${C.cyan}0a` }}>
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, minWidth: 16 }}>{m.turn}</span>
                <span style={{ color: m.who === 'You' ? C.cyan : C.steel, fontSize: 11, minWidth: 28 }}>{t(m.who)}</span>
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

function SandboxPreview() {
  const [cells, setCells] = useState(buildSandboxDemo)
  const [selectedFigId, setSelectedFigId] = useState<number | null>(null)
  const [oriIdx, setOriIdx] = useState(0)
  const [ruleToggles, setRuleToggles] = useState({ support: false, steps: false, overhang: false, returnPath: false })
  const { t } = useLang()

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
          <span style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('SANDBOX')}</span>
          <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>{t('UNRATED')} · {t('FREE')} PLACEMENT · 15×11</span>
        </div>
        <button onClick={() => { setCells(buildSandboxDemo()); setSelectedFigId(null) }}
          style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
          className="hover:text-deck transition-colors">{t('Reset demo')}</button>
      </div>

      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}20` }} className="px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
        <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{t('RULE HIGHLIGHTS:')}</span>
        {(Object.entries(ruleToggles) as [keyof typeof ruleToggles, boolean][]).map(([k, on]) => {
          const label = k === 'returnPath' ? t('Return Path') : t(k.charAt(0).toUpperCase() + k.slice(1))
          return (
            <button key={k} onClick={() => toggleRule(k)}
              style={{ border: `1px solid ${on ? RULE_COLORS[k] : C.steelDim + '40'}`, background: on ? `${RULE_COLORS[k]}20` : 'transparent', color: on ? RULE_COLORS[k] : C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", padding: '4px 12px', transition: 'all 0.15s' }}>
              {label} {on ? '●' : '○'}
            </button>
          )
        })}
        <span style={{ color: C.steelDim, fontSize: 11 }}>{t('Click grid to place selected figure.')}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_260px] gap-5">
        <div style={{ border: `1px solid ${C.cyan}25`, background: C.graphite2 }} className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('TRAINING CONTAINER')}</span>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              {(Object.entries(ruleToggles) as [keyof typeof ruleToggles, boolean][]).filter(([, on]) => on).map(([k]) => (
                <span key={k} className="flex items-center gap-1.5" style={{ color: RULE_COLORS[k] }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: RULE_COLORS[k], opacity: 0.5 }} />
                  {k === 'returnPath' ? t('Return Path') : t(k.charAt(0).toUpperCase() + k.slice(1))}
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
            {' '}{t("This extra row is yours while you're learning to stack. Once you've got it, you'll play on 15×10 — and this line becomes the ceiling.")}
          </div>
        </div>

        {/* Figure picker */}
        <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-4">
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>{t('FIGURE PICKER')}</p>
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
            className="hover:text-deck transition-colors">{t('Clear all')}</button>
        </div>
      </div>
    </div>
  )
}


// ── Sandbox Page (logged-in, real) ────────────────────────────────────────────
// Sergey, 2026-09-08: UC-05 (onboarding tutorial) + UC-07 (free sandbox) combined into
// one flow -- a short guided tutorial first, then free placement with the same engine
// DevTestPage uses (rules.ts, client-side only -- Sergey: "клиентский скрипт, не будем
// сервер грузить"). No opponent, no scoring, no 27-figure pool limit: this is meant for
// repeatable experimentation, so every figure stays pickable any number of times.
//
// Sergey, 2026-09-09: tutorial substantially expanded from 4 steps to 10 (+ completion)
// per his own 8-point spec -- see claude/PuzzleStow_Sandbox_Tutorial_Improvement_Scenario_v2.md
// in the project for the full documented scenario and approval trail. Steps 0-2 are the
// original tutorial, unchanged. Steps 3-9 are new: a static 4-rule overview, F15 placed by
// clicked points then by typed notation, a 7-figure "shipments" practice round (5 core +
// 2 bonus, dead-cell tally), a step-climbing exercise, a fair-play walkthrough covering both
// outcomes, and a strategy-tips screen -- before the rewritten completion screen.

// Sequence for Step 6 (SHIPMENTS): core 5 + a 2-figure bonus pack, chosen by Sergey
// (2026-09-09) specifically because they're noticeably harder than a beginner set --
// verified solvable with 0 new dead cells end-to-end via a scratch simulation against
// the real engine (_to_delete/find_seq.ts) before shipping, not hand-waved.
const SHIPMENT_FIGS = [8, 17, 9, 11, 27, 13, 23]
const SHIPMENT_CORE_COUNT = 5

// Step 8 (CLIMBING, AND CAREFULLY DESCENDING, A TALL STEP) starting position, redesigned
// 2026-09-10 per Sergey's playtest feedback: F4 stood vertically in the MIDDLE of the
// container (column 7), floor to height 4 -- a step 4x1 on BOTH sides of the wall, not
// just near the entrance. Verified against the real engine (find_step8_v2.ts): the right
// side (columns 8-14) starts fully unreachable; raising column 6 to height >=1 (any
// figure that touches its floor cell) bridges reachability into the open run directly
// above the wall, from which a Mono placed on top of the wall (0% overhang) or an F05
// resting 1 cell on the wall-top with 4 hanging over open air (80% overhang, needs the
// same fair-play "Place again to confirm" flow used elsewhere) both work, 0 new dead
// cells either way.
const STEP_CLIMB_WALL_COL = 7
function stepClimbInitialFilled(rows: number): Set<string> {
  const s = new Set<string>()
  for (let r = rows - 4; r <= rows - 1; r++) s.add(cellKey(r, STEP_CLIMB_WALL_COL))
  return s
}

function SandboxPage({ setPage: _setPage }: { setPage: (p: Page) => void }) {
  const ROWS = 11
  const TOTAL_TUT_STEPS = 10 // content steps 0..9; 10 = completion
  const { lang, t } = useLang()
  // Rule-overview texts (Step 3) come from the per-language content table; the four
  // engine-driven demos are ordered identically (support, steps, overhang, return path).
  const overviewPanels = RULE_OVERVIEW_PANELS[lang]

  const [mode, setMode] = useState<'tutorial' | 'free'>('tutorial')
  const [tutStep, setTutStep] = useState(0)

  const [filled, setFilled] = useState<Set<string>>(new Set())
  const [pieces, setPieces] = useState<{ id: number; cells: Cells; dotIdx: number[] }[]>([])
  const [selectedFigId, setSelectedFigId] = useState<number | null>(null)
  const [rotIdx, setRotIdx] = useState(0)
  const [clickPoints, setClickPoints] = useState<{ r: number; c: number }[]>([])
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null)
  const [notation, setNotation] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pendingFairPlay, setPendingFairPlay] = useState<{ key: string } | null>(null)
  const [lastPlacement, setLastPlacement] = useState<{ notation: string; figLabel: string } | null>(null)
  const [ruleToggles, setRuleToggles] = useState({ support: false, steps: false, overhang: false, returnPath: false })

  // -- state for the expanded tutorial (steps 3-9, added 2026-09-09) --
  const [rulesPanelIdx, setRulesPanelIdx] = useState(0) // Step 3's 4-panel sub-carousel
  const [deadCellAdvisory, setDeadCellAdvisory] = useState<number | null>(null) // Steps 4/5/6/7
  const [notationInput, setNotationInput] = useState('')
  const [notationInputError, setNotationInputError] = useState<string | null>(null)
  const [shipmentIdx, setShipmentIdx] = useState(0) // 0..7 across the Step 6 sequence
  const [shipmentDeadTotal, setShipmentDeadTotal] = useState(0)
  const [shipmentHistory, setShipmentHistory] = useState<{ figId: number; cells: Cells; newDead: number }[]>([])
  const [fairPlayDemoPhase, setFairPlayDemoPhase] = useState<'pending' | 'confirmed' | 'declined'>('pending')

  const toggleRule = (k: keyof typeof ruleToggles) => setRuleToggles(r => ({ ...r, [k]: !r[k] }))
  const highlights = mergeHighlights(
    ruleToggles.support ? supportHL(filled, ROWS) : new Map(),
    ruleToggles.steps ? stepsHL(filled, ROWS) : new Map(),
    ruleToggles.overhang ? overhangHL(filled, ROWS) : new Map(),
    ruleToggles.returnPath ? returnPathHL(filled, ROWS) : new Map(),
  )
  const RULE_COLORS: Record<string, string> = { support: C.green, steps: C.red, overhang: '#ffaa00', returnPath: C.cyan }

  // Resets/seeds the container for one of the new self-contained exercises (Steps 4-7).
  // Shared by the tutStep-change effect below AND each step's own "Reset" button.
  function initStep(step: number) {
    if (step === 1) {
      setSelectedFigId(1); setClickPoints([]); setNotation(''); setMessage(null)
    } else if (step === 4 || step === 5) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(15); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null); setPendingFairPlay(null)
    } else if (step === 6) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(SHIPMENT_FIGS[0]); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null)
      setShipmentIdx(0); setShipmentDeadTotal(0); setShipmentHistory([]); setPendingFairPlay(null)
    } else if (step === 7) {
      setFilled(stepClimbInitialFilled(ROWS)); setPieces([]); setSelectedFigId(null); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null); setPendingFairPlay(null)
    }
  }

  // Step 2 of the tutorial hands the player figure #1 (Mono, one cell) -- the simplest
  // possible placement -- so the lesson isn't derailed by rotation or two-point notation.
  // Steps 4-7 each seed their own self-contained exercise via initStep above.
  useEffect(() => {
    if (mode !== 'tutorial') return
    if (tutStep === 1 || tutStep === 4 || tutStep === 5 || tutStep === 6 || tutStep === 7) {
      initStep(tutStep)
    } else if (tutStep === 8) {
      setFairPlayDemoPhase('pending')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tutStep])

  const selectedFig = selectedFigId != null ? FIGURES.find(f => f.id === selectedFigId) ?? null : null
  const orientations = selectedFig ? getOrientations(selectedFig.cells) : []
  const pointsNeeded = selectedFig ? (selectedFig.dots.length >= 2 ? 2 : 1) : 0

  function selectFigure(fig: Figure) {
    setSelectedFigId(fig.id); setRotIdx(0); setClickPoints([]); setNotation(''); setMessage(null); setPendingFairPlay(null)
  }

  useEffect(() => {
    if (!selectedFig || clickPoints.length < pointsNeeded) return
    setNotation(formatNotation(selectedFig.id, clickPoints.slice(0, pointsNeeded), ROWS))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickPoints, selectedFig?.id, pointsNeeded])

  const ghostPlacement = useMemo(() => {
    if (!selectedFig || clickPoints.length < pointsNeeded) return null
    const clicked = clickPoints.slice(0, pointsNeeded)
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(selectedFig, clicked)
      : computePlacementFromAnchor(selectedFig, rotIdx, clicked[0])
    if (!cells) return null
    const result = checkPlacement(cells, filled, ROWS)
    if (!result.ok && result.reason === 'Placement goes outside the container') return { set: undefined, valid: false }
    return { set: new Set(cells.map(([r, c]) => cellKey(r, c))), valid: result.ok }
  }, [selectedFig, clickPoints, pointsNeeded, rotIdx, filled])

  const hoverPreview = useMemo(() => {
    if (!selectedFig || !hoverCell || pointsNeeded !== 2 || clickPoints.length !== 1) return null
    const [p1] = clickPoints
    if (p1.r === hoverCell.r && p1.c === hoverCell.c) return null
    // STRICT dot-order canon (Sergey, 2026-11-18): point1 = first click and the figure
    // rotates AROUND it — dot2 of the figure must land on the hovered cell. The mirrored
    // reading (hovered cell = dot1) is NEVER previewed — it was not chosen.
    const cells = computePlacementFromDots(selectedFig, [p1, hoverCell])
    if (!cells) return null
    const result = checkPlacement(cells, filled, ROWS)
    if (!result.ok && result.reason === 'Placement goes outside the container') return null
    return { set: new Set(cells.map(([r, c]) => cellKey(r, c))), valid: result.ok }
  }, [selectedFig, hoverCell, clickPoints, pointsNeeded, filled])

  // Step 5's live ghost, driven by the typed notation field instead of clicks.
  const notationPreview = useMemo(() => {
    if (!selectedFig || tutStep !== 5) return null
    const parsed = parseNotation(notationInput, ROWS)
    if ('error' in parsed) return null
    if (parsed.points.length !== pointsNeeded) return null
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(selectedFig, parsed.points)
      : computePlacementFromAnchor(selectedFig, 0, parsed.points[0])
    if (!cells) return null
    const result = checkPlacement(cells, filled, ROWS)
    return { set: new Set(cells.map(([r, c]) => cellKey(r, c))), valid: result.ok }
  }, [selectedFig, notationInput, pointsNeeded, filled, tutStep])

  const displayGhost = tutStep === 5 ? notationPreview : (ghostPlacement ?? hoverPreview)
  const ghostCells = displayGhost?.set
  const ghostValid = displayGhost?.valid ?? true

  function handleCellClick(r: number, c: number) {
    if (!selectedFig) { setMessage(t('Pick a figure from the bank first.')); return }
    if (clickPoints.length < pointsNeeded) setClickPoints(p => [...p, { r, c }])
  }

  // `explicitPoints`, when given, is used instead of `clickPoints` -- needed by
  // placeByNotation() below, since setClickPoints() wouldn't be visible yet within the
  // same call (React state updates are async).
  function place(explicitPoints?: { r: number; c: number }[]) {
    if (!selectedFig) return
    const clicked = (explicitPoints ?? clickPoints).slice(0, pointsNeeded)
    if (clicked.length < pointsNeeded) { setMessage(t('Click the container to mark the reference point(s) first.')); return }
    // STRICT dot-order canon (Sergey, 2026-11-18): point1 = first click (the figure then
    // rotates around it until dot2 meets the second click). No mirrored reinterpretation.
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(selectedFig, clicked)
      : computePlacementFromAnchor(selectedFig, rotIdx, clicked[0])
    const cellsKey = cells ? [...cells].map(([r, c]) => cellKey(r, c)).sort().join('|') : null
    const result = checkPlacement(cells, filled, ROWS, cellsKey != null && pendingFairPlay?.key === cellsKey)
    if (!result.ok) {
      if (result.needsFairPlay && cellsKey != null) {
        setPendingFairPlay({ key: cellsKey })
        setMessage(t("{reason}. In a real match this needs the opponent's fair-play OK — click Place again to confirm you'd still place it here.", { reason: t(result.reason ?? '') }))
        return
      }
      setPendingFairPlay(null)
      setMessage(t('Invalid: {reason}', { reason: t(result.reason ?? '') }))
      setClickPoints([])
      setNotation('')
      return
    }
    setPendingFairPlay(null)
    const beforeDead = computeDeadCells(filled, ROWS).size
    const next = new Set(filled)
    result.cells!.forEach(([r, c]) => next.add(cellKey(r, c)))
    const afterDead = computeDeadCells(next, ROWS).size
    const newDead = afterDead - beforeDead
    setFilled(next)
    setPieces(prev => [...prev, { id: selectedFig.id, cells: result.cells!, dotIdx: selectedFig.dots }])
    setLastPlacement({ notation: notation || formatNotation(selectedFig.id, clicked, ROWS), figLabel: `${selectedFig.label} — ${selectedFig.name}` })
    setMessage(null)
    setClickPoints([])
    setNotation('')
    setNotationInput(''); setNotationInputError(null)
    if (mode === 'tutorial') {
      if (tutStep === 1) setTutStep(2)
      else if (tutStep === 4 || tutStep === 5 || tutStep === 7) setDeadCellAdvisory(newDead)
      else if (tutStep === 6) {
        setDeadCellAdvisory(newDead)
        setShipmentDeadTotal(t => t + newDead)
        setShipmentHistory(h => [...h, { figId: selectedFig.id, cells: result.cells!, newDead }])
        const nextIdx = shipmentIdx + 1
        setShipmentIdx(nextIdx)
        if (nextIdx < SHIPMENT_FIGS.length) { setSelectedFigId(SHIPMENT_FIGS[nextIdx]); setRotIdx(0) }
        else setSelectedFigId(null)
      }
    }
  }

  // Step 5 (and, as an alternate input, Step 6): parse the typed notation field and
  // place it through the exact same checkPlacement/dead-cell path as a click -- notation
  // is just a different way of specifying the same reference points, never a shortcut
  // around the engine.
  function placeByNotation() {
    if (!selectedFig) return
    const parsed = parseNotation(notationInput, ROWS)
    if ('error' in parsed) { setNotationInputError(parsed.error); return }
    if (parsed.figureId !== selectedFig.id) {
      setNotationInputError(t('That notation is for figure {id}, not {label}.', { id: String(parsed.figureId).padStart(2, '0'), label: selectedFig.label }))
      return
    }
    if (parsed.points.length !== pointsNeeded) {
      setNotationInputError(t('{label} needs {n} reference point(s) — got {m}.', { label: selectedFig.label, n: pointsNeeded, m: parsed.points.length }))
      return
    }
    setNotationInputError(null)
    place(parsed.points)
  }

  function resetLastShipment() {
    if (shipmentHistory.length === 0) return
    const last = shipmentHistory[shipmentHistory.length - 1]
    setFilled(f => {
      const next = new Set(f)
      last.cells.forEach(([r, c]) => next.delete(cellKey(r, c)))
      return next
    })
    setPieces(prev => prev.slice(0, -1))
    setShipmentHistory(h => h.slice(0, -1))
    setShipmentDeadTotal(t => Math.max(0, t - last.newDead))
    setShipmentIdx(i => Math.max(0, i - 1))
    setSelectedFigId(last.figId); setRotIdx(0); setClickPoints([]); setNotation(''); setMessage(null); setDeadCellAdvisory(null)
    setNotationInput(''); setNotationInputError(null)
  }

  function goBack() {
    setTutStep(s => Math.max(0, s - 1))
  }

  function clearContainer() {
    setFilled(new Set()); setPieces([]); setSelectedFigId(null); setClickPoints([])
    setNotation(''); setMessage(null); setPendingFairPlay(null)
  }

  function startFreeMode() {
    clearContainer()
    setMode('free')
  }

  function restartTutorial() {
    clearContainer()
    setMode('tutorial')
    setTutStep(0)
  }

  // Step-height illustration (now folded into Step 3's rule overview, panel 2 of 4):
  // built from the real engine (rules.ts checkPlacement), not a hand-written screenshot,
  // so it can never drift out of sync with the actual rule (item 6, 2026-09-08 TODO --
  // the >3-cell step-height rule).
  const step4Demo = useMemo(() => {
    const demoFilled = new Set<string>()
    for (let r = ROWS - 5; r <= ROWS - 1; r++) demoFilled.add(cellKey(r, 0)) // 5-cell stack at the entrance column
    const attempt: Cells = [[ROWS - 1, 5]]
    const result = checkPlacement(attempt, demoFilled, ROWS)
    return { cells: demoFilled, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))), result }
  }, [])

  // Step 3 (2026-09-09): a static, non-blocking overview of all four hard placement
  // rules -- each panel built from the real engine exactly like step4Demo above, never
  // hand-written copy that could drift from what checkPlacement actually enforces.
  const ruleOverviewDemos = useMemo(() => {
    const support = (() => {
      const f = new Set<string>()
      const attempt: Cells = [[ROWS - 4, 7]]
      return { filled: f, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))), result: checkPlacement(attempt, f, ROWS) }
    })()
    const overhang = (() => {
      const f = new Set<string>([cellKey(ROWS - 1, 5)])
      const attempt: Cells = [[ROWS - 2, 5], [ROWS - 2, 6], [ROWS - 2, 7], [ROWS - 2, 8]]
      return { filled: f, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))), result: checkPlacement(attempt, f, ROWS) }
    })()
    const returnPath = (() => {
      const f = new Set<string>()
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < 15; c++) if (!(r === ROWS - 1 && c === 0)) f.add(cellKey(r, c))
      const attempt: Cells = [[ROWS - 1, 0]]
      return { filled: f, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))), result: checkPlacement(attempt, f, ROWS) }
    })()
    return [
      { ...overviewPanels[0], demo: support },
      { ...overviewPanels[1], demo: { filled: step4Demo.cells, ghost: step4Demo.ghost, result: step4Demo.result } },
      { ...overviewPanels[2], demo: overhang },
      { ...overviewPanels[3], demo: returnPath },
    ]
  }, [step4Demo, overviewPanels])

  // Step 8: same >50%-overhang scenario as the Step 3 overview panel, but interactive --
  // walked through BOTH outcomes (confirm / decline), which the real free-mode double-
  // click flow can't show on its own since Sandbox has no live second player.
  const fairPlayDemo = useMemo(() => {
    const f = new Set<string>([cellKey(ROWS - 1, 5)])
    const attempt: Cells = [[ROWS - 2, 5], [ROWS - 2, 6], [ROWS - 2, 7], [ROWS - 2, 8]]
    return { filled: f, attempt, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))) }
  }, [])
  const fairPlayCheck = checkPlacement(fairPlayDemo.attempt, fairPlayDemo.filled, ROWS, fairPlayDemoPhase === 'confirmed')

  const stepClimbAboveWallRow = ROWS - 5
  const stepClimbBridged = (() => {
    if (tutStep !== 7) return false
    if (filled.has(cellKey(stepClimbAboveWallRow, STEP_CLIMB_WALL_COL))) return true
    return checkPlacement([[stepClimbAboveWallRow, STEP_CLIMB_WALL_COL]], filled, ROWS).ok
  })()
  const stepClimbDone = pieces.some(p => p.cells.some(([r, c]) => r === stepClimbAboveWallRow && c === STEP_CLIMB_WALL_COL))

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}30` }} className="px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <span style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('SANDBOX')}</span>
          <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>
            {t('UNRATED')} · {t('FREE')} PLACEMENT · 15×{ROWS}
          </span>
          {mode === 'tutorial' && (
            <span style={{ background: `${C.cyan}20`, color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>
              {t('TUTORIAL · STEP {step} OF {total}', { step: Math.min(tutStep + 1, TOTAL_TUT_STEPS), total: TOTAL_TUT_STEPS })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {mode === 'free' && (
            <button onClick={restartTutorial} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">{t('Restart tutorial')}</button>
          )}
          {mode === 'tutorial' && tutStep > 0 && tutStep <= TOTAL_TUT_STEPS && (
            <button onClick={goBack} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
              className="hover:text-deck transition-colors">{t('← Back')}</button>
          )}
          {mode === 'tutorial' && tutStep < TOTAL_TUT_STEPS && (
            <button onClick={startFreeMode} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">{t('Skip to free sandbox')}</button>
          )}
          {(mode === 'free' || (mode === 'tutorial' && tutStep === 1)) && (
            <button onClick={() => (mode === 'free' ? clearContainer() : initStep(1))} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">{t('Clear container')}</button>
          )}
        </div>
      </div>

      {mode === 'tutorial' && tutStep === 0 && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12 }}>{t('STEP 1 OF 10 — THE GOAL')}</p>
          <h2 style={{ color: C.deck, fontSize: 26, fontWeight: 700, marginBottom: 16 }}>{t('Stow cargo, close rows and columns')}</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            {t('In a real match your opponent chooses which cargo figure you receive next, and you place it in your container. Fill every cell of a row or a column and it closes — closing 5 rows and/or columns first wins the game. This sandbox skips the opponent: pick any figure, any time, and see how placement really works before you play for real.')}
          </p>
          <button onClick={() => setTutStep(1)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Start →')}</button>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 1 && selectedFig && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={30}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('STEP 2 OF 10 — ENTRANCE & FIRST PLACEMENT')}</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              {t('The cyan cell is')} <b style={{ color: C.cyan }}>A0</b> {t("— the entrance. Every piece of cargo must be reachable from here. You've been handed figure")} <b style={{ color: C.deck }}>{selectedFig.label} — {selectedFig.name}</b>,{' '}
              {t('a single cell — the simplest placement there is.')}
            </p>
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 12 }}>{t('Click any cell on the bottom row to place it.')}</p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={selectedFig.cells} cardSize={60} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
            </div>
            <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
              style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>
              {t('Place')}
            </button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 2 && lastPlacement && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12 }}>{t('STEP 3 OF 10 — NOTATION')}</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{t('You just recorded your first move')}</h2>
          <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 8 }}>{lastPlacement.figLabel}</p>
          <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}30`, padding: '18px 24px', marginBottom: 20 }}>
            <code style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700 }}>{lastPlacement.notation}</code>
          </div>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            {t("That's the figure's number followed by the cell(s) its reference dots landed on — the same notation you'll report to your opponent (or the server records) in a real match. Every figure has 1 or 2 reference dots; a wider figure needs two cells to pin down its rotation, a single-cell figure like this one needs just one.")}
          </p>
          <button onClick={() => setTutStep(3)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Next →')}</button>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 3 && (() => {
        const panel = ruleOverviewDemos[rulesPanelIdx]
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
              {t('STEP 4 OF 10 — CORE RULES ({cur}/4 — {title})', { cur: rulesPanelIdx + 1, title: panel.title })}
            </p>
            <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{panel.headline}</h2>
            <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>{panel.body}</p>
            <div className="flex justify-center mb-4">
              <ContainerGrid filledCells={panel.demo.filled} rows={ROWS} cellSize={22}
                ghostCells={panel.demo.ghost} ghostValid={panel.demo.result.ok} />
            </div>
            <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
              <code style={{ color: C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{panel.demo.result.reason}</code>
            </div>
            <p style={{ color: C.steelDim, fontSize: 13, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>{panel.note}</p>
            <div className="flex justify-center items-center gap-3">
              {rulesPanelIdx > 0 && (
                <button onClick={() => setRulesPanelIdx(i => i - 1)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 18px', cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('← Prev rule')}</button>
              )}
              {rulesPanelIdx < ruleOverviewDemos.length - 1 ? (
                <button onClick={() => setRulesPanelIdx(i => i + 1)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Next rule →')}</button>
              ) : (
                <button onClick={() => { setRulesPanelIdx(0); setTutStep(4) }} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Next step →')}</button>
              )}
            </div>
          </div>
        )
      })()}

      {mode === 'tutorial' && tutStep === 4 && selectedFig && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>{t('This placement walled off {n} cell(s) — they can never receive cargo now. Try Reset for a cleaner spot.', { n: deadCellAdvisory })}</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>{t('Clean placement — no cells were walled off.')}</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('STEP 5 OF 10 — MEET F15: PLACE BY POINTS')}</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              <b style={{ color: C.deck }}>{selectedFig.label} — {selectedFig.name}</b> {t('needs')} <b style={{ color: C.cyan }}>two</b> {t("reference points, not one — a single point can't pin down both where and which way an asymmetric shape sits. The first click and the second aren't interchangeable: swap their order and you get a different orientation.")}
            </p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={selectedFig.cells} cardSize={70} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
            </div>
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 8 }}>
              {t('Click two cells in the container, in order. Try to place it without walling off any cell — you\'ll find out right after whether you did.')}
            </p>
            {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 12 }}>{notation}</code>}
            <div className="flex gap-2 mb-3">
              <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 16px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>{t('Place')}</button>
              <button onClick={() => initStep(4)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px', cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('Reset')}</button>
            </div>
            {deadCellAdvisory != null && (
              <button onClick={() => setTutStep(5)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 18px', border: 'none', width: '100%', cursor: 'pointer' }}>{t('Next →')}</button>
            )}
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 5 && selectedFig && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} ghostCells={ghostCells} ghostValid={ghostValid} />
            </div>
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>{t('This placement walled off {n} cell(s) — they can never receive cargo now. Try Reset for a cleaner spot.', { n: deadCellAdvisory })}</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>{t('Clean placement — no cells were walled off.')}</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('STEP 6 OF 10 — PLACE BY NOTATION')}</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              {t('Same figure, same two reference dots — this time write where they land instead of clicking them. Format: figure id, then each point as a row letter and column number, e.g. {ex}.', { ex: '15D4B3' })}
            </p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={selectedFig.cells} cardSize={70} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
            </div>
            <input value={notationInput} onChange={e => setNotationInput(e.target.value)}
              placeholder={`15${rowToLetter(ROWS - 1, ROWS)}5${rowToLetter(ROWS - 2, ROWS)}7`}
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.cyan}40`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, padding: '10px 12px', marginBottom: 8 }} />
            {notationInputError && <p style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{notationInputError}</p>}
            <div className="flex gap-2 mb-3">
              <button onClick={placeByNotation} disabled={!notationInput}
                style={{ background: notationInput ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 16px', border: 'none', flex: 1, cursor: notationInput ? 'pointer' : 'default' }}>{t('Place')}</button>
              <button onClick={() => initStep(5)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px', cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('Reset')}</button>
            </div>
            {deadCellAdvisory != null && (
              <button onClick={() => setTutStep(6)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 18px', border: 'none', width: '100%', cursor: 'pointer' }}>Next →</button>
            )}
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 6 && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>{t('That one walled off {n} cell(s).', { n: deadCellAdvisory })}</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>{t('Clean — no cells walled off.')}</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>
              {t('STEP 7 OF 10 — {phase}', { phase:
                shipmentIdx < SHIPMENT_CORE_COUNT ? t('SHIPMENT {n} OF {m}', { n: shipmentIdx + 1, m: SHIPMENT_CORE_COUNT })
                : shipmentIdx < SHIPMENT_FIGS.length ? t('BONUS {n} OF {m}', { n: shipmentIdx - SHIPMENT_CORE_COUNT + 1, m: SHIPMENT_FIGS.length - SHIPMENT_CORE_COUNT })
                : t('ALL SHIPMENTS DONE') })}
            </p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              {t('Five figures, fed one at a time — just like a real opponent handing you cargo. Place each one, by clicking or by notation, and try to finish all five with {zero} dead cells. Two harder bonus figures follow if you want more practice.', { zero: t('zero') })}
            </p>
            {selectedFig && shipmentIdx < SHIPMENT_FIGS.length && (
              <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
                <FigurePreview cells={selectedFig.cells} cardSize={70} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
              </div>
            )}
            {selectedFig && shipmentIdx < SHIPMENT_FIGS.length && (
              <>
                {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 10 }}>{notation}</code>}
                <div className="flex gap-2 mb-3">
                  <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                    style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>{t('Place (click points)')}</button>
                </div>
                <input value={notationInput} onChange={e => setNotationInput(e.target.value)}
                  placeholder={t('or type notation, e.g. {ex}', { ex: '08C0B0A0A1' })}
                  style={{ width: '100%', background: C.graphite, border: `1px solid ${C.cyan}40`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', marginBottom: 8 }} />
                {notationInputError && <p style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{notationInputError}</p>}
                <button onClick={placeByNotation} disabled={!notationInput}
                  style={{ background: notationInput ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', border: 'none', width: '100%', cursor: notationInput ? 'pointer' : 'default', marginBottom: 12 }}>{t('Place (from notation)')}</button>
              </>
            )}
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 12 }}>{t('Dead cells so far: {n}', { n: shipmentDeadTotal })}</p>
            <div className="flex gap-2">
              <button onClick={resetLastShipment} disabled={shipmentHistory.length === 0}
                style={{ color: shipmentHistory.length ? C.steelDim : `${C.steelDim}50`, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 10px', flex: 1, cursor: shipmentHistory.length ? 'pointer' : 'default' }}
                className={shipmentHistory.length ? 'hover:text-deck transition-colors' : ''}>{t('Reset last')}</button>
              <button onClick={() => initStep(6)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 10px', flex: 1, cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('Reset all')}</button>
              {shipmentIdx >= SHIPMENT_CORE_COUNT && (
                <button onClick={() => setTutStep(7)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>{t('Next →')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 7 && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbBridged && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>{t('That placement walled off {n} cell(s). Reset and try another spot for a clean one.', { n: deadCellAdvisory })}</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>{t('Clean — 0 new dead cells.')}</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('STEP 8 OF 10 — CLIMBING (AND CAREFULLY DESCENDING) A TALL STEP')}</p>
            {!stepClimbBridged ? (
              <>
                <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  {t('F4 is standing on end in the middle of the container — a wall 4 cells tall, too tall to cross from either side. You can fix the situation by placing a figure to the left of the tall step. You have a repair toolkit — choose the right figure and place it so you can pass further.')}
                </p>
                <div className="flex gap-2 mb-3">
                  {[1, 2, 3].map(id => {
                    const f = FIGURES.find(ff => ff.id === id)!
                    return (
                      <button key={id} onClick={() => selectFigure(f)}
                        style={{ background: selectedFigId === id ? C.cyan : 'transparent', color: selectedFigId === id ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 12, padding: '10px 8px', flex: 1, cursor: 'pointer' }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  {t('The gap is bridged — the space right above the wall is reachable now. Place cargo carefully to the right of the tall step, hanging over open air, to gently set down fragile cargo. Choose the right cargo and reduce the height of the problem:')}
                  {' '}<b style={{ color: C.deck }}>F01 (Mono)</b> {t('rests safely right on top of the wall, no risk.')}{' '}
                  <b style={{ color: C.deck }}>F05</b>{' '}
                  {t('reaches further but hangs mostly over open air — that needs your fair-play OK, same as the overhang rule from Step 4.')}
                </p>
                <div className="flex gap-2 mb-3">
                  {[5, 1].map(id => {
                    const f = FIGURES.find(ff => ff.id === id)!
                    return (
                      <button key={id} onClick={() => selectFigure(f)}
                        style={{ background: selectedFigId === id ? C.cyan : 'transparent', color: selectedFigId === id ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 12, padding: '10px 8px', flex: 1, cursor: 'pointer' }}>
                        {f.label} — {f.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {selectedFig && (
              <>
                {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 10 }}>{notation}</code>}
                <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                  style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '10px 14px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default', marginBottom: 10 }}>{t('Place')}</button>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1, cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('Reset')}</button>
              {stepClimbDone && (
                <button onClick={() => setTutStep(8)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>{t('Next →')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 8 && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{t('STEP 9 OF 10 — FAIR PLAY, BOTH WAYS')}</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{t('Your opponent can say yes — or no')}</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>
            {t("The same overhang scenario from the rules overview — but this time you see both of your opponent's possible answers, not just the happy path.")}
          </p>
          <div className="flex justify-center mb-4">
            <ContainerGrid filledCells={fairPlayDemoPhase === 'confirmed' ? new Set([...fairPlayDemo.filled, ...fairPlayDemo.ghost]) : fairPlayDemo.filled}
              rows={ROWS} cellSize={26}
              ghostCells={fairPlayDemoPhase === 'declined' ? fairPlayDemo.ghost : undefined}
              ghostValid={false} />
          </div>
          {fairPlayDemoPhase === 'pending' && (
            <>
              <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
                <code style={{ color: C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{fairPlayCheck.reason}</code>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => setFairPlayDemoPhase('confirmed')} style={{ background: C.green, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', cursor: 'pointer' }}>{t('✓ Opponent confirms')}</button>
                <button onClick={() => setFairPlayDemoPhase('declined')} style={{ background: C.red, color: C.deck, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', cursor: 'pointer' }}>{t('✗ Opponent declines')}</button>
              </div>
            </>
          )}
          {fairPlayDemoPhase === 'confirmed' && (
            <>
              <div style={{ background: `${C.green}12`, border: `1px solid ${C.green}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
                <code style={{ color: C.green, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t('Placed — both players confirmed it.')}</code>
              </div>
              <p style={{ color: C.steel, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                {t("In a real match, your opponent explicitly agrees to this exact placement before it's allowed — never automatic, never one-sided.")}
              </p>
              <div className="flex justify-center"><button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('See the decline instead →')}</button></div>
            </>
          )}
          {fairPlayDemoPhase === 'declined' && (
            <>
              <div style={{ background: `${C.steelDim}12`, border: `1px solid ${C.steelDim}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
                <code style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t('Declined — nothing was placed.')}</code>
              </div>
              <p style={{ color: C.steel, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                {t('Your opponent can also say no. Nothing is placed — you keep the figure and try somewhere else.')}
              </p>
              <div className="flex justify-center"><button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }} className="hover:text-deck transition-colors">{t('See the confirm instead →')}</button></div>
            </>
          )}
          <div className="flex justify-center mt-6">
            <button onClick={() => setTutStep(9)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Next →')}</button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 9 && (
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{t('STEP 10 OF 10 — HOW TO ACTUALLY WIN')}</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>{t('A few things worth watching for')}</h2>
          <div style={{ color: C.steel, fontSize: 15, lineHeight: 1.9 }}>
            <p>{t('— Keep rows in play as long as possible — avoid creating dead cells.')}</p>
            <p>{t('— Hand your opponent the more awkward figure when you get to choose.')}</p>
            <p>{t('— Avoid building tall steps that cost you extra moves to fix later.')}</p>
            <p>{t('— Keep an eye on passability across the whole container.')}</p>
            <p>{t("— Don't leave narrow bottlenecks.")}</p>
          </div>
          <div className="flex justify-center mt-8">
            <button onClick={() => setTutStep(10)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Finish tutorial →')}</button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 10 && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${C.cyan}20`, border: `2px solid ${C.cyan}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>🏅</div>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{t('Your adventure at PuzzleStow has begun')}</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
            {t("A long but exciting and interesting road ahead. But the nearest goal is already in sight. Don't stop and go forward. Win ten times first, successfully pass the exam, and advance to the Lodar 15X10 level. Good luck in your promotion on the Lodar staircase!")}
          </p>
          <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 28 }}>
            {t("(The “Новичок” badge itself isn't wired to your profile yet — this screen is a stand-in until that's built.)")}
          </p>
          <button onClick={startFreeMode} style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>{t('Continue to free sandbox →')}</button>
        </div>
      )}

      {mode === 'free' && (
        <>
          <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}20` }} className="px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
            <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{t('RULE HIGHLIGHTS:')}</span>
            {(Object.entries(ruleToggles) as [keyof typeof ruleToggles, boolean][]).map(([k, on]) => {
              const label = k === 'returnPath' ? t('Return Path') : t(k.charAt(0).toUpperCase() + k.slice(1))
              return (
                <button key={k} onClick={() => toggleRule(k)}
                  style={{ border: `1px solid ${on ? RULE_COLORS[k] : C.steelDim + '40'}`, background: on ? `${RULE_COLORS[k]}20` : 'transparent', color: on ? RULE_COLORS[k] : C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", padding: '4px 12px', transition: 'all 0.15s' }}>
                  {label} {on ? '●' : '○'}
                </button>
              )
            })}
          </div>

          <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_300px] gap-5">
            <div style={{ border: `1px solid ${C.steelDim}30`, background: C.graphite2 }} className="p-4">
              <div className="overflow-x-auto">
                <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={30}
                  pieces={pieces} highlightCells={highlights}
                  onCellClick={handleCellClick}
                  onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                  ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
              </div>
              {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            </div>

            <div className="flex flex-col gap-4">
              {selectedFig ? (
                <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
                  <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>{t('SELECTED — {label}', { label: selectedFig.label })}</p>
                  <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
                    <FigurePreview cells={orientations[rotIdx % orientations.length]} cardSize={80} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
                  </div>
                  {pointsNeeded === 1 && (
                    <div className="flex gap-2 mb-4">
                      {[0, 1, 2, 3].slice(0, orientations.length).map(i => (
                        <button key={i} onClick={() => setRotIdx(i)}
                          style={{ border: `1px solid ${rotIdx % orientations.length === i ? C.cyan : C.steelDim + '50'}`, background: rotIdx % orientations.length === i ? `${C.cyan}18` : 'transparent', color: rotIdx % orientations.length === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '4px 10px' }}>{i * 90}°</button>
                      ))}
                    </div>
                  )}
                  <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>
                    {t('Click {what} on the container.', { what: pointsNeeded === 2 ? t('two cells (its reference dots, in order)') : t('a cell') })}
                  </p>
                  {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 12 }}>{notation}</code>}
                  <div className="flex gap-2">
                    <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                      style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 16px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>{t('Place')}</button>
                    <button onClick={() => selectFigure(selectedFig)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px' }}>{t('Reset points')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ border: `1px solid ${C.steelDim}30`, background: C.graphite2 }} className="p-5">
                  <p style={{ color: C.steelDim, fontSize: 13 }}>{t('Pick a figure below to start placing.')}</p>
                </div>
              )}
              <FigureBankPanel title={t('ALL 27 FIGURES — FREE PLACEMENT')} panelColor={C.steel} itemColor={C.cyan}
                onSelect={selectFigure} getStatus={() => ({ used: false, actionable: true, hint: '' })} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Auth Page — Light Deck bg, flip card ──────────────────────────────────────
function AuthPage({ onAuth, setPage, recoveryMode }: { onAuth: () => void; setPage: (p: Page) => void; recoveryMode?: boolean }) {
  const { t } = useLang()
  const [isSignUp, setIsSignUp] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', nickname: '', useNickname: false, email: '', password: '', confirm: '', agree: false, sendNews: false })
  const [signIn, setSignIn] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // "Forgot password?" -- request half of the flow (send the reset email).
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  // Recovery mode -- the OTHER half: rendered instead of the normal sign-in/up form when
  // the app was loaded from the password-reset email link (App() detects this via the
  // URL's `type=recovery` and passes recoveryMode=true; Supabase has already exchanged
  // the link for a temporary session by this point, so this just needs a new password).
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryDone, setRecoveryDone] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [recoveryExpired, setRecoveryExpired] = useState(false)

  // Wait for Supabase to actually finish establishing the session from the recovery
  // link before letting the form submit -- checks whatever's already resolved, listens
  // for the PASSWORD_RECOVERY event that fires once parsing completes, and gives up
  // after 10s (expired/already-used link) instead of leaving the form silently broken.
  useEffect(() => {
    if (!recoveryMode) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setRecoveryReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      if (newSession && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setRecoveryReady(true)
    })
    const timeout = window.setTimeout(() => { if (!cancelled) setRecoveryExpired(true) }, 10000)
    return () => { cancelled = true; sub.subscription.unsubscribe(); window.clearTimeout(timeout) }
  }, [recoveryMode])

  const upd = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const updSignIn = (k: 'email' | 'password', v: string) => setSignIn(s => ({ ...s, [k]: v }))

  const handleForgotSubmit = async () => {
    if (forgotSubmitting) return
    if (!forgotEmail.includes('@')) { setForgotError(t('Enter a valid email address')); return }
    setForgotSubmitting(true)
    setForgotError('')
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo: window.location.origin })
    setForgotSubmitting(false)
    if (error) { setForgotError(error.message); return }
    setForgotSent(true)
  }

  const handleRecoverySubmit = async () => {
    if (recoverySubmitting) return
    if (newPassword.length < 8) { setRecoveryError(t('Minimum 8 characters')); return }
    if (newPassword !== newPasswordConfirm) { setRecoveryError(t('Passwords do not match')); return }
    setRecoverySubmitting(true)
    setRecoveryError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setRecoverySubmitting(false)
    if (error) { setRecoveryError(error.message); return }
    setRecoveryDone(true)
  }

  const validateSignUp = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = t('Required')
    if (!form.email.includes('@')) e.email = t('Enter a valid email address')
    if (form.password.length < 8) e.password = t('Minimum 8 characters')
    if (form.password !== form.confirm) e.confirm = t('Passwords do not match')
    if (!form.agree) e.agree = t('You must agree to the rules to continue')
    return e
  }

  const validateSignIn = () => {
    const e: Record<string, string> = {}
    if (!signIn.email.includes('@')) e.signInEmail = t('Enter a valid email address')
    if (!signIn.password) e.signInPassword = t('Required')
    return e
  }

  // Registration flow per PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx §5 --
  // signUp() metadata is read server-side by the public.handle_new_user() trigger
  // (supabase/migrations/20260908101531_create_users_table.sql,
  // 20260908102500_add_nickname_to_users.sql) to create the public.users row.
  const handleSubmit = async () => {
    if (submitting) return
    if (isSignUp) {
      const e = validateSignUp()
      setErrors(e)
      if (Object.keys(e).length > 0) return
      setSubmitting(true)
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          // Without this, Supabase falls back to the Auth project's configured Site URL
          // for the confirmation email's link -- which is currently stuck on an old
          // localhost:3000 dev port (see resetPasswordForEmail below, which already does
          // this correctly). window.location.origin makes it self-correct on whatever
          // host/port actually served this page, dev or production.
          emailRedirectTo: window.location.origin,
          data: {
            name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
            nickname: form.nickname.trim() || null,
            use_nickname: form.useNickname,
            subscribed_to_news: form.sendNews,
            agreed_to_terms_at: new Date().toISOString(),
          },
        },
      })
      setSubmitting(false)
      if (error) {
        setErrors({ email: /already/i.test(error.message) ? t('This email is already used') : error.message })
        return
      }
      setSubmitted(true)
    } else {
      const e = validateSignIn()
      setErrors(e)
      if (Object.keys(e).length > 0) return
      setSubmitting(true)
      const { error } = await supabase.auth.signInWithPassword({ email: signIn.email, password: signIn.password })
      setSubmitting(false)
      if (error) {
        setErrors({ signInPassword: t('Incorrect email or password') })
        return
      }
      onAuth()
      setPage('home')
    }
  }

  if (recoveryMode) {
    if (recoveryDone) {
      return (
        <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
          <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 48, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ background: C.cyan, width: 48, height: 48, margin: '0 auto 20px' }} className="flex items-center justify-center">
              <svg width={24} height={24} fill="none" stroke={C.graphite} strokeWidth={2.5}><polyline points="4,12 10,18 20,6" /></svg>
            </div>
            <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('Password updated')}</h2>
            <p style={{ color: C.steel, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              {t("Your new password is set. You're already signed in with it.")}
            </p>
            <button onClick={() => setPage('home')} style={{ background: C.blue, color: C.deck, fontSize: 14, fontWeight: 600, padding: '12px 24px', border: 'none', cursor: 'pointer' }}>{t('Continue')}</button>
          </div>
        </div>
      )
    }
    if (!recoveryReady) {
      return (
        <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
          <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            {recoveryExpired ? (
              <>
                <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('Link expired')}</h2>
                <p style={{ color: C.steel, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
                  {t('This password reset link has expired or was already used. Request a new one from the sign-in page.')}
                </p>
                <button onClick={() => { window.location.href = window.location.origin }}
                  style={{ background: C.blue, color: C.deck, fontSize: 14, fontWeight: 600, padding: '12px 24px', border: 'none', cursor: 'pointer' }}>{t('Back to sign in')}</button>
              </>
            ) : (
              <>
                <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('Preparing password reset…')}</h2>
                <p style={{ color: C.steel, fontSize: 14, lineHeight: 1.7 }}>{t('Verifying your reset link, one moment…')}</p>
              </>
            )}
          </div>
        </div>
      )
    }
    return (
      <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
        <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 40, maxWidth: 420, width: '100%' }}>
          <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{t('Set a new password')}</h2>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{t('Choose a new password for your account.')}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('New password')}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                style={{ border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 14, padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif', background: C.graphite }} />
            </div>
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('Confirm new password')}</label>
              <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="••••••••"
                style={{ border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 14, padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif', background: C.graphite }} />
            </div>
            {recoveryError && <p style={{ color: C.red, fontSize: 12 }}>{recoveryError}</p>}
            <button onClick={handleRecoverySubmit} disabled={recoverySubmitting}
              style={{ background: C.blue, color: C.deck, fontSize: 14, fontWeight: 600, padding: '12px 0', width: '100%', border: 'none', cursor: recoverySubmitting ? 'default' : 'pointer', opacity: recoverySubmitting ? 0.6 : 1 }}>
              {recoverySubmitting ? t('Saving…') : t('Save new password')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showForgot) {
    if (forgotSent) {
      return (
        <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
          <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 48, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ background: C.cyan, width: 48, height: 48, margin: '0 auto 20px' }} className="flex items-center justify-center">
              <svg width={24} height={24} fill="none" stroke={C.graphite} strokeWidth={2.5}><polyline points="4,12 10,18 20,6" /></svg>
            </div>
            <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('Check your email')}</h2>
            <p style={{ color: C.steel, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              {t('We sent a password reset link to {email}. Follow it to choose a new password.', { email: forgotEmail })}
            </p>
            <button onClick={() => setShowForgot(false)} style={{ color: C.cyan, fontSize: 13 }}>{t('Back to sign in')}</button>
          </div>
        </div>
      )
    }
    return (
      <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
        <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 40, maxWidth: 420, width: '100%' }}>
          <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{t('Reset your password')}</h2>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{t("Enter your email and we'll send you a reset link.")}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('Email')}</label>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com"
                style={{ border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 14, padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif', background: C.graphite }} />
            </div>
            {forgotError && <p style={{ color: C.red, fontSize: 12 }}>{forgotError}</p>}
            <button onClick={handleForgotSubmit} disabled={forgotSubmitting}
              style={{ background: C.blue, color: C.deck, fontSize: 14, fontWeight: 600, padding: '12px 0', width: '100%', border: 'none', cursor: forgotSubmitting ? 'default' : 'pointer', opacity: forgotSubmitting ? 0.6 : 1 }}>
              {forgotSubmitting ? t('Sending…') : t('Send reset link')}
            </button>
            <button onClick={() => setShowForgot(false)} style={{ color: C.steelDim, fontSize: 13 }}>{t('Back to sign in')}</button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ background: C.graphite, minHeight: '100vh' }} className="flex items-center justify-center px-4">
        <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: 48, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ background: C.cyan, width: 48, height: 48, margin: '0 auto 20px' }} className="flex items-center justify-center">
            <svg width={24} height={24} fill="none" stroke={C.graphite} strokeWidth={2.5}><polyline points="4,12 10,18 20,6" /></svg>
          </div>
          <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('Check your email')}</h2>
          <p style={{ color: C.steel, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            {t('We sent a confirmation link to {email}. Follow it to activate your account.', { email: form.email })}
          </p>
          <button style={{ color: C.steelDim, fontSize: 13, textDecoration: 'underline' }}>{t('Resend (available after 60s)')}</button>
        </div>
      </div>
    )
  }

  const inp = (err?: string): React.CSSProperties => ({
    border: `1px solid ${err ? C.red : C.steelDim}`, color: C.deck, fontSize: 14,
    padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif',
    background: C.graphite, transition: 'border-color 0.15s', borderRadius: 0,
  })
  const lbl: React.CSSProperties = { color: C.steel, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }
  const err: React.CSSProperties = { color: C.red, fontSize: 12, marginTop: 4 }
  const primaryBtn: React.CSSProperties = { background: C.blue, color: C.deck, fontSize: 14, fontWeight: 600, padding: '12px 0', width: '100%', border: 'none', cursor: 'pointer' }

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div onClick={onChange} style={{ width: 18, height: 18, border: `1.5px solid ${checked ? C.cyan : C.steelDim}`, background: checked ? C.cyan : C.graphite, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
      {checked && <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={C.graphite} strokeWidth={2.5}><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
    </div>
  )

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex flex-col items-center justify-center px-4 py-12">
      <button onClick={() => setPage('home')} className="flex items-center gap-2 mb-8">
        <div style={{ background: C.cyan }} className="w-8 h-8 flex items-center justify-center">
          <GridIcon size={16} color={C.graphite} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: C.deck, letterSpacing: '0.06em', fontSize: 14, fontWeight: 600 }}>PUZZLESTOW</span>
      </button>

      <div style={{ perspective: '1200px', width: '100%', maxWidth: 440 }}>
        <div style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)', transform: isSignUp ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: 540 }}>

          {/* Sign In — front */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: '36px 36px 32px' }}>
              <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{t('Sign In')}</h2>
              <p style={{ color: C.steel, fontSize: 13, marginBottom: 24 }}>
                {t('New here?')}{' '}
                <button onClick={() => setIsSignUp(true)} style={{ color: C.cyan, fontWeight: 600, textDecoration: 'underline' }}>{t('Create an account')}</button>
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <label style={lbl}>{t('Email')}</label>
                  <input type="email" value={signIn.email} onChange={e => updSignIn('email', e.target.value)} placeholder="you@example.com" style={inp(errors.signInEmail)} />
                  {errors.signInEmail && <p style={err}>{errors.signInEmail}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label style={lbl}>{t('Password')}</label>
                    <button onClick={() => { setForgotEmail(signIn.email); setForgotError(''); setForgotSent(false); setShowForgot(true) }} style={{ color: C.cyan, fontSize: 12 }}>{t('Forgot password?')}</button>
                  </div>
                  <input type="password" value={signIn.password} onChange={e => updSignIn('password', e.target.value)} placeholder="••••••••" style={inp(errors.signInPassword)} />
                  {errors.signInPassword && <p style={err}>{errors.signInPassword}</p>}
                </div>
                <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'default' : 'pointer' }} onMouseOver={e => (e.currentTarget.style.filter = 'brightness(0.9)')} onMouseOut={e => (e.currentTarget.style.filter = '')}>
                  {submitting ? t('Signing in…') : t('Sign in')}
                </button>
                <div style={{ borderTop: `1px solid ${C.steelDim}40`, paddingTop: 16 }}>
                  <button style={{ border: `1px solid ${C.cyan}50`, color: C.cyan, background: `${C.cyan}10`, fontSize: 13, fontWeight: 500, padding: '10px 0', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <TelegramIcon size={16} />
                    {t('Continue with Telegram')}
                    <span style={{ color: C.steelDim, fontSize: 11 }}>{t('(optional)')}</span>
                  </button>
                  <p style={{ color: C.steelDim, fontSize: 11, marginTop: 6, textAlign: 'center' }}>{t('Telegram login links your account for quick access from the WebView. Email login is the primary method.')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Up — back */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', overflowY: 'auto' }}>
            <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}28`, padding: '36px 36px 32px' }}>
              <h2 style={{ color: C.deck, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{t('Create Account')}</h2>
              <p style={{ color: C.steel, fontSize: 13, marginBottom: 24 }}>
                {t('Already registered?')}{' '}
                <button onClick={() => { setIsSignUp(false); setErrors({}) }} style={{ color: C.cyan, fontWeight: 600, textDecoration: 'underline' }}>{t('Sign in')}</button>
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>{t('First Name')}</label>
                    <input value={form.firstName} onChange={e => upd('firstName', e.target.value)} style={inp(errors.firstName)} />
                    {errors.firstName && <p style={err}>{errors.firstName}</p>}
                  </div>
                  <div>
                    <label style={lbl}>{t('Last Name')}</label>
                    <input value={form.lastName} onChange={e => upd('lastName', e.target.value)} style={inp()} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>{t('Nickname')}</label>
                  <input value={form.nickname} onChange={e => upd('nickname', e.target.value)} placeholder={t('Optional')} style={{ ...inp(), fontFamily: "'JetBrains Mono',monospace" }} />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.useNickname} onChange={() => upd('useNickname', !form.useNickname)} />
                  <div>
                    <span style={{ color: C.deck, fontSize: 13, fontWeight: 500 }}>{t('Use nickname on PuzzleStow')}</span>
                    <p style={{ color: C.steelDim, fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>{t('Your nickname replaces your display name on leaderboards, match history, and badges — in PuzzleStow only, not on PairSec service bookings.')}</p>
                  </div>
                </label>
                <div>
                  <label style={lbl}>{t('Email')}</label>
                  <input type="email" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="you@example.com" style={inp(errors.email)} />
                  {errors.email && <p style={err}>{errors.email}</p>}
                </div>
                <div>
                  <label style={lbl}>{t('Password')}</label>
                  <input type="password" value={form.password} onChange={e => upd('password', e.target.value)} placeholder="Minimum 8 characters" style={inp(errors.password)} />
                  {errors.password && <p style={err}>{errors.password}</p>}
                </div>
                <div>
                  <label style={lbl}>{t('Confirm Password')}</label>
                  <input type="password" value={form.confirm} onChange={e => upd('confirm', e.target.value)} style={inp(errors.confirm)} />
                  {errors.confirm && <p style={err}>{errors.confirm}</p>}
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agree} onChange={() => upd('agree', !form.agree)} />
                  <span style={{ color: errors.agree ? C.red : C.steel, fontSize: 13 }}>{t('I have read and agree to the game rules and terms of use')}</span>
                </label>
                {errors.agree && <p style={err}>{errors.agree}</p>}
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.sendNews} onChange={() => upd('sendNews', !form.sendNews)} />
                  <span style={{ color: C.steel, fontSize: 13 }}>{t('Send me news and updates about PuzzleStow')}</span>
                </label>
                <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'default' : 'pointer' }} onMouseOver={e => (e.currentTarget.style.filter = 'brightness(0.9)')} onMouseOut={e => (e.currentTarget.style.filter = '')}>
                  {submitting ? t('Creating account…') : t('Create Account')}
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
// Client-side PDF exports for the three download buttons below (Sergey, 2026-09-10) —
// same jsPDF pattern already proven in exportGameReportPdf() (devtest page). Geometry
// mirrors ContainerGrid/FigurePreview: row 0 = top = last letter of ROW_LABELS, columns
// 0–14 labeled along the bottom, entry/exit always at bottom-left (row `rows-1`, col 0).
const PP_BLUE: [number, number, number] = [31, 79, 130]
const PP_CYAN: [number, number, number] = [31, 167, 163]
const PP_GRAPHITE: [number, number, number] = [28, 31, 38]
const PP_STEEL: [number, number, number] = [120, 128, 143]

const CONTAINER_FIGURE_NOTE = 'Note: after drawing a placed figure in the container, write its figure number inside the shape.'

function drawContainerNote(doc: jsPDF, x: number, y: number, maxWidth: number) {
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...PP_STEEL)
  const lines = doc.splitTextToSize(CONTAINER_FIGURE_NOTE, maxWidth)
  doc.text(lines, x, y)
}

function drawContainerGridPdf(doc: jsPDF, x0: number, y0: number, cellPt: number, rows: number, showJKSeparator: boolean) {
  const COLS = 15
  const gridW = COLS * cellPt
  const gridH = rows * cellPt

  doc.setDrawColor(...PP_GRAPHITE)
  doc.setLineWidth(0.5)
  for (let c = 0; c <= COLS; c++) doc.line(x0 + c * cellPt, y0, x0 + c * cellPt, y0 + gridH)
  for (let r = 0; r <= rows; r++) doc.line(x0, y0 + r * cellPt, x0 + gridW, y0 + r * cellPt)
  doc.setLineWidth(1.1)
  doc.rect(x0, y0, gridW, gridH)

  // Entry/exit A0 — bottom-left cell, cyan per brand.
  const entryR = rows - 1
  doc.setDrawColor(...PP_CYAN)
  doc.setLineWidth(1.1)
  doc.rect(x0, y0 + entryR * cellPt, cellPt, cellPt, 'S')
  doc.setFillColor(...PP_CYAN)
  doc.circle(x0 + cellPt / 2, y0 + entryR * cellPt + cellPt / 2, Math.max(1.2, cellPt * 0.07), 'F')

  // J/K separator — dashed cyan line one cell below the top edge, 15×11 only (matches
  // ContainerGrid's showJKSeparator && rows === 11 line).
  if (showJKSeparator && rows === 11) {
    doc.setDrawColor(...PP_CYAN)
    doc.setLineWidth(1.3)
    doc.setLineDashPattern([3, 2], 0)
    doc.line(x0, y0 + cellPt, x0 + gridW, y0 + cellPt)
    doc.setLineDashPattern([], 0)
  }

  const ROW_LABELS_PP = 'ABCDEFGHIJK'
  doc.setFont('courier', 'bold')
  doc.setFontSize(Math.max(6, cellPt * 0.4))
  doc.setTextColor(...PP_STEEL)
  for (let r = 0; r < rows; r++) {
    doc.text(ROW_LABELS_PP[rows - 1 - r], x0 + gridW + 6, y0 + r * cellPt + cellPt / 2 + 3)
  }
  doc.setFontSize(Math.max(6, cellPt * 0.36))
  for (let c = 0; c < COLS; c++) {
    doc.text(String(c), x0 + c * cellPt + cellPt / 2, y0 + gridH + 12, { align: 'center' })
  }
}

function exportContainerTemplatePdf(rows: 10 | 11, showJKSeparator: boolean, name: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...PP_BLUE)
  doc.text('PUZZLESTOW', margin, 50)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...PP_GRAPHITE)
  doc.text(`Print & Play — Container Template (${name})`, margin, 68)
  doc.setFontSize(9); doc.setTextColor(...PP_STEEL)
  doc.text('Columns 0–14 · rows lettered on the right · entry/exit at A0 (bottom-left, marked).', margin, 82)

  const cellPt = Math.min((pageW - 2 * margin) / 15, 28)
  drawContainerGridPdf(doc, margin, 108, cellPt, rows, showJKSeparator)

  const footerY = 108 + rows * cellPt + 30
  drawContainerNote(doc, margin, footerY - 14, pageW - 2 * margin)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...PP_STEEL)
  doc.text('PuzzleStow — Print & Play · puzzlestow.com', margin, footerY)

  doc.save(`PuzzleStow_Container_15x${rows}_${showJKSeparator ? 'Beginner' : 'Standard'}.pdf`)
}

function drawFigureCardPdf(doc: jsPDF, fig: Figure, x: number, y: number, cardSize: number) {
  const cells = fig.cells
  const rowsArr = cells.map(([r]) => r), colsArr = cells.map(([, c]) => c)
  const minR = Math.min(...rowsArr), maxR = Math.max(...rowsArr)
  const minC = Math.min(...colsArr), maxC = Math.max(...colsArr)
  const numR = maxR - minR + 1, numC = maxC - minC + 1
  const cellPt = Math.min(cardSize / Math.max(numR, numC), 15)
  const figW = numC * cellPt, figH = numR * cellPt
  const ox = x + (cardSize - figW) / 2
  const oy = y + (cardSize - figH) / 2

  doc.setDrawColor(...PP_CYAN)
  doc.setLineWidth(0.6)
  cells.forEach(([r, c]) => {
    doc.rect(ox + (c - minC) * cellPt, oy + (r - minR) * cellPt, cellPt, cellPt, 'S')
  })

  const dotSet = new Set(fig.dots)
  doc.setFillColor(...PP_CYAN)
  fig.dots.forEach(idx => {
    const [r, c] = cells[idx]
    doc.circle(ox + (c - minC) * cellPt + cellPt / 2, oy + (r - minR) * cellPt + cellPt / 2, Math.max(0.8, cellPt * 0.12), 'F')
  })

  let labelIdx = cells.findIndex((_, i) => !dotSet.has(i))
  if (labelIdx < 0) labelIdx = 0
  const [lr, lc] = cells[labelIdx]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(Math.max(5.5, Math.min(cellPt * 0.55, 8)))
  doc.setTextColor(...PP_GRAPHITE)
  doc.text(String(fig.id), ox + (lc - minC) * cellPt + cellPt / 2, oy + (lr - minR) * cellPt + cellPt / 2 + 2, { align: 'center' })

  doc.setFont('courier', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...PP_STEEL)
  doc.text(`${fig.label} — ${fig.name}`, x + cardSize / 2, y + cardSize + 9, { align: 'center', maxWidth: cardSize })
}

function drawFigureReferenceSheet(doc: jsPDF, startY: number) {
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...PP_BLUE)
  doc.text('Figure Reference — All 27 Figures', margin, startY)

  const cols = 6
  const gap = 10
  const cardSize = (pageW - 2 * margin - (cols - 1) * gap) / cols
  const rowH = cardSize + 24
  let x = margin, y = startY + 26, col = 0

  FIGURES.forEach(fig => {
    if (y + cardSize + 20 > pageH - 40) {
      doc.addPage()
      y = 50
      x = margin
      col = 0
    }
    drawFigureCardPdf(doc, fig, x, y, cardSize)
    col++
    if (col >= cols) { col = 0; x = margin; y += rowH } else { x += cardSize + gap }
  })
}

function exportCompletePackPdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...PP_BLUE)
  doc.text('PUZZLESTOW', margin, 55)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...PP_GRAPHITE)
  doc.text('Print & Play — Complete Pack', margin, 75)
  doc.setFont('helvetica', 'italic'); doc.setFontSize(11); doc.setTextColor(...PP_CYAN)
  doc.text('"All you need is a sheet of grid paper and a pen."', margin, 95)

  let y = 125
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...PP_GRAPHITE)
  doc.text('Rules Summary', margin, y)
  y += 20
  const rulesSummary: [string, string][] = [
    ['Support', 'No piece may float — every cell rests on row A or on an already-placed piece.'],
    ['Steps (max 3)', 'Height difference between adjacent columns must not exceed 3 cells.'],
    ['Overhang', 'More than 50% of a piece unsupported is disallowed by default (bilateral fair-play exception aside).'],
    ['Return Path', 'After placing a piece, a passable path back to exit A0 must remain open.'],
    ['Row/Column Closure', 'Win by closing 5 rows/columns combined, or by your opponent having no legal placement.'],
  ]
  doc.setFontSize(9.5)
  const rulesLabelW = 128
  rulesSummary.forEach(([title, text]) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...PP_BLUE)
    doc.text(title + ':', margin, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...PP_GRAPHITE)
    const lines = doc.splitTextToSize(text, pageW - 2 * margin - rulesLabelW)
    doc.text(lines, margin + rulesLabelW, y)
    y += 13 * Math.max(1, lines.length) + 5
  })
  y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PP_GRAPHITE)
  const notationLine = doc.splitTextToSize('Move notation: [2-digit figure number][row1][col1][row2][col2] — e.g. figure F10 to points A1 and C2 -> 10A1C2', pageW - 2 * margin)
  doc.text(notationLine, margin, y)

  doc.addPage()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...PP_GRAPHITE)
  doc.text('Container Template — 15×10 Standard', margin, 50)
  drawContainerGridPdf(doc, margin, 78, Math.min((pageW - 2 * margin) / 15, 28), 10, false)
  drawContainerNote(doc, margin, 78 + 10 * Math.min((pageW - 2 * margin) / 15, 28) + 30, pageW - 2 * margin)

  doc.addPage()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...PP_GRAPHITE)
  doc.text('Container Template — 15×11 Beginner', margin, 50)
  drawContainerGridPdf(doc, margin, 78, Math.min((pageW - 2 * margin) / 15, 28), 11, true)
  drawContainerNote(doc, margin, 78 + 11 * Math.min((pageW - 2 * margin) / 15, 28) + 30, pageW - 2 * margin)

  doc.addPage()
  drawFigureReferenceSheet(doc, 50)

  doc.save('PuzzleStow_PrintPlay_Complete_Pack.pdf')
}

function PrintPlayPage() {
  const { t } = useLang()
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
        <h2 style={{ color: C.deck }} className="text-xl font-semibold mb-6">{t('Container Templates')}</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {[
            { name: t('15×10 Standard'), label: t('COMPETITIVE'), color: C.cyan, desc: t('Used in all rated matches and practice sessions. Rows A–J (10 rows). The official container for qualification play.'), rows: 10 as const, sep: false, badge: t('Rated Play · Practice') },
            { name: t('15×11 Beginner'), label: t('TRAINING'), color: C.steel, desc: t('Includes the extra row K with the bold J/K separator line. Recommended while learning to stack. The line marks the competitive ceiling.'), rows: 11 as const, sep: true, badge: t('Sandbox · Learning') },
          ].map(tpl => (
            <div key={tpl.name} style={{ border: `1px solid ${tpl.color}30`, background: C.graphite2, padding: 20 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span style={{ color: tpl.color, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em' }}>{tpl.label}</span>
                  <h3 style={{ color: C.deck, fontSize: 16, fontWeight: 600, marginTop: 3 }}>{tpl.name}</h3>
                </div>
                <span style={{ background: `${tpl.color}20`, color: tpl.color, fontSize: 10, padding: '3px 10px', fontFamily: "'JetBrains Mono',monospace" }}>{tpl.badge}</span>
              </div>
              <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{tpl.desc}</p>
              <div className="overflow-x-auto mb-4">
                <ContainerGrid filledCells={new Set()} cellSize={15} rows={tpl.rows} showJKSeparator={tpl.sep} />
              </div>
              <button onClick={() => exportContainerTemplatePdf(tpl.rows, tpl.sep, tpl.name)}
                style={{ background: tpl.color, color: tpl.color === C.steel ? C.graphite : C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 2v8M3 7l4 4 4-4M2 11h10v2H2z"/></svg>
                {t('Download PDF — {name}', { name: tpl.name })}
              </button>
            </div>
          ))}
        </div>

        {/* Figures reference */}
        <div style={{ border: `1px solid ${C.cyan}22`, background: C.graphite2, padding: 24 }}>
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em', marginBottom: 5 }}>{t('FIGURE REFERENCE')}</p>
          <h3 style={{ color: C.deck, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('All 27 Figures — Quick Reference Sheet')}</h3>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 mb-5">
            {FIGURES.map(fig => (
              <div key={fig.id} style={{ border: `1px solid ${C.cyan}18`, background: C.graphite, padding: 4 }} className="flex flex-col items-center gap-1">
                <FigurePreview cells={fig.cells} cardSize={44} color={C.cyan} dots={fig.dots} number={fig.id} />
                <span style={{ color: C.steelDim, fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{fig.label}</span>
                <span style={{ color: C.steelDim, fontSize: 7, textAlign: 'center', lineHeight: 1.3 }}>{fig.name}</span>
              </div>
            ))}
          </div>
          <button onClick={exportCompletePackPdf}
            style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 2v8M3 7l4 4 4-4M2 11h10v2H2z"/></svg>
            {t('Download Complete Pack (Rules + Both Templates + Figures)')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Page ──────────────────────────────────────────────────────────────
function ProfilePage({ session, profile, onProfileUpdated, profileLoading, profileError, onRetryProfile }: { session: Session | null; profile: PuzzleStowProfile | null; onProfileUpdated: (p: PuzzleStowProfile) => void; profileLoading?: boolean; profileError?: string | null; onRetryProfile?: () => void }) {
  const { t } = useLang()
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [useNickname, setUseNickname] = useState(false)
  const [subscribedToNews, setSubscribedToNews] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.name)
    setNickname(profile.nickname ?? '')
    setUseNickname(profile.use_nickname)
    setSubscribedToNews(profile.subscribed_to_news)
  }, [profile])

  // Avatar is stored as a bytea hex string (see supabaseClient.ts) -- rebuild a
  // displayable object URL whenever it changes, and revoke the previous one so we
  // don't leak blob: URLs as the user swaps avatars across a session.
  useEffect(() => {
    if (!profile?.avatar) { setAvatarUrl(null); return }
    const url = byteaHexToObjectUrl(profile.avatar, profile.avatar_content_type || 'image/jpeg')
    setAvatarUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [profile?.avatar, profile?.avatar_content_type])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !session) return
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const { blob, contentType } = await resizeAvatarFile(file)
      const hex = await blobToByteaHex(blob)
      const { data, error } = await supabase.from('users')
        .update({ avatar: hex, avatar_content_type: contentType })
        .eq('id', session.user.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      if (data) onProfileUpdated(data as PuzzleStowProfile)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : t('Could not update avatar'))
    } finally {
      setAvatarUploading(false)
    }
  }

  const shownAs = useNickname ? nickname : displayName

  // Real qualification tier from the DB, not the old hardcoded "MidLod" placeholder --
  // falls back to UnderLodar (TIERS[0], also the DB column's own default) while the
  // profile is still loading or has no recognized value.
  const qualTier = TIERS.find(t => t.name === profile?.game_qualification) ?? TIERS[0]

  const handleSave = async () => {
    if (!session || saving) return
    setSaving(true)
    setSaveError(null)
    const { data, error } = await supabase.from('users')
      .update({ name: displayName, nickname: nickname.trim() || null, use_nickname: useNickname, subscribed_to_news: subscribedToNews })
      .eq('id', session.user.id)
      .select()
      .single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    if (data) onProfileUpdated(data as PuzzleStowProfile)
  }

  const handleCancel = () => {
    if (!profile) return
    setDisplayName(profile.name)
    setNickname(profile.nickname ?? '')
    setUseNickname(profile.use_nickname)
    setSubscribedToNews(profile.subscribed_to_news)
    setSaveError(null)
  }

  const inp: React.CSSProperties = { background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 14, padding: '10px 12px', width: '100%', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }

  // Show a real loading / error state instead of silently rendering the form with blank
  // fields while the public.users row is still being fetched (or failed to fetch) --
  // that ambiguity is exactly what previously read as "the Profile page is just empty".
  if (profileLoading) {
    return (
      <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex items-center justify-center">
        <p style={{ color: C.steel, fontSize: 14 }}>{t('Loading your profile…')}</p>
      </div>
    )
  }
  if (profileError) {
    return (
      <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex flex-col items-center justify-center px-4 gap-4">
        <p style={{ color: C.red, fontSize: 14, textAlign: 'center' }}>{t("Couldn't load your profile: {err}", { err: profileError ?? '' })}</p>
        <button onClick={onRetryProfile} style={{ border: `1px solid ${C.cyan}50`, color: C.cyan, background: `${C.cyan}10`, fontSize: 13, fontWeight: 500, padding: '8px 20px', cursor: 'pointer' }}>{t('Retry')}</button>
      </div>
    )
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">PROFILE</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-10">{t('Account Settings')}</h1>
        <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-8 mb-5">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 18 }}>{t('IDENTITY')}</p>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-5">
              <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: C.graphite, border: `1px solid ${C.steelDim}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700 }}>{(shownAs || '?').slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                  style={{ border: `1px solid ${C.cyan}50`, color: C.cyan, background: `${C.cyan}10`, fontSize: 12, fontWeight: 500, padding: '7px 16px', cursor: avatarUploading ? 'default' : 'pointer', opacity: avatarUploading ? 0.6 : 1 }}>
                  {avatarUploading ? t('Uploading…') : t('Change avatar')}
                </button>
                {avatarError && <p style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{avatarError}</p>}
              </div>
            </div>
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", display: 'block', marginBottom: 6 }}>{t('DISPLAY NAME')}</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = C.cyan)} onBlur={e => (e.currentTarget.style.borderColor = C.steelDim)} />
            </div>
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", display: 'block', marginBottom: 6 }}>{t('NICKNAME')}</label>
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
                  <p style={{ color: C.deck, fontSize: 14, fontWeight: 500 }}>{t('Use nickname')}</p>
                  <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>{t('When checked, your nickname replaces your display name on PuzzleStow leaderboards, match history, profile cards, and Lodar Path badges.')}</p>
                </div>
              </label>
            </div>
            <div style={{ background: C.graphite, border: `1px solid ${C.steelDim}30`, padding: '12px 16px' }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{t('SHOWN AS IN PUZZLESTOW')}</p>
              <span style={{ color: C.deck, fontSize: 16, fontWeight: 600, fontFamily: useNickname ? "'JetBrains Mono',monospace" : 'inherit' }}>{shownAs}</span>
            </div>
            <div style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}40`, padding: '12px 16px' }}>
              <p style={{ color: C.blue, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 5, letterSpacing: '0.08em' }}>{t('PAIRSEC SCOPE NOTE')}</p>
              <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.6 }}>{t("This nickname toggle applies to PuzzleStow display only. It does not affect how your identity is shown for PairSec service bookings — PairSec's trust model relies on transparent identity for in-person services.")}</p>
            </div>
            <div style={{ borderTop: `1px solid ${C.steelDim}30`, paddingTop: 18 }}>
              <label className="flex items-start gap-4 cursor-pointer">
                <div onClick={() => setSubscribedToNews(!subscribedToNews)}
                  style={{ width: 18, height: 18, border: `1.5px solid ${subscribedToNews ? C.cyan : C.steelDim}`, background: subscribedToNews ? C.cyan : 'transparent', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {subscribedToNews && <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={C.graphite} strokeWidth={2}><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                </div>
                <div>
                  <p style={{ color: C.deck, fontSize: 14, fontWeight: 500 }}>{t('Send me news and updates')}</p>
                  <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>{t('Same subscription set at Sign Up — toggle it on or off any time, then Save Changes.')}</p>
                </div>
              </label>
            </div>
          </div>
          {saveError && <p style={{ color: C.red, fontSize: 12, marginTop: -6, marginBottom: 12 }}>{saveError}</p>}
          <div className="flex gap-3 mt-8">
            <button onClick={handleSave} disabled={saving} style={{ background: C.cyan, color: C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 24px', opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }} className="hover:brightness-110 transition-all">{saving ? t('Saving…') : t('Save Changes')}</button>
            <button onClick={handleCancel} disabled={saving} style={{ color: C.steel, border: `1px solid ${C.steelDim}`, fontSize: 13, padding: '10px 24px' }} className="hover:text-deck transition-colors">{t('Cancel')}</button>
          </div>
        </div>
        <div style={{ border: `1px solid ${C.cyan}18`, background: C.graphite2 }} className="p-6">
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>{t('QUALIFICATION')}</p>
          <div className="flex items-center gap-5">
            <div style={{ background: qualTier.color, width: 44, height: 44 }} className="flex items-center justify-center">
              <span style={{ color: C.graphite, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700 }}>{qualTier.abbr}</span>
            </div>
            <div>
              <p style={{ color: qualTier.color, fontWeight: 600, fontSize: 16 }}>{qualTier.name}</p>
              <p style={{ color: C.steelDim, fontSize: 13 }}>{t('Tier {n} of {m}', { n: qualTier.id, m: TIERS.length })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Admin Page — flexible/auxiliary site content, Administrator role only ─────
// Env variables, music tracks, and news-line items are admin-entered data and
// all three are consumed live (TO_DO 29): the public player resolves per-page
// tracks from music_tracks, the news ticker renders news_items under the nav.
// Access is enforced twice: this component hides the page from non-Administrators,
// and the app_config/music_tracks/news_items write RLS policies (is_admin())
// refuse writes from anyone else regardless of what the client sends (public
// SELECT was opened by migration 20261119120000 so visitors can read music/news).
function AdminPage({ session, profile }: { session: Session | null; profile: PuzzleStowProfile | null }) {
  const { t } = useLang()
  if (!session || !profile) {
    return (
      <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex items-center justify-center">
        <p style={{ color: C.steel, fontSize: 14 }}>{t('Sign in required.')}</p>
      </div>
    )
  }
  if (profile.role !== 'Administrator') {
    return (
      <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }} className="flex items-center justify-center">
        <p style={{ color: C.red, fontSize: 14 }}>{t('This page is restricted to Administrators.')}</p>
      </div>
    )
  }
  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-14">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.14em' }} className="mb-3">ADMIN</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-10">{t('Site Content')}</h1>
        <AdminEnvSection />
        <AdminConfigSection />
        <AdminMusicSection />
        <AdminNewsSection />
      </div>
    </div>
  )
}

interface ConfigRow { key: string; value: string | null; description: string | null }

function AdminConfigSection() {
  const { t } = useLang()
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    supabase.from('app_config').select('key, value, description').order('key').then(({ data, error }) => {
      setLoading(false)
      if (error) { setError(error.message); return }
      setRows((data as ConfigRow[]) ?? [])
    })
  }, [])

  const updateRow = (key: string, patch: Partial<ConfigRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))

  const save = async (key: string) => {
    const row = rows.find(r => r.key === key)
    if (!row) return
    setSavingKey(key)
    const { error } = await supabase.from('app_config')
      .update({ value: row.value, description: row.description, updated_at: new Date().toISOString() })
      .eq('key', key)
    setSavingKey(null)
    if (error) setError(error.message)
  }

  const remove = async (key: string) => {
    const { error } = await supabase.from('app_config').delete().eq('key', key)
    if (error) { setError(error.message); return }
    setRows(rs => rs.filter(r => r.key !== key))
  }

  const add = async () => {
    if (adding) return
    const k = newKey.trim()
    if (!k) { setAddError(t('Key is required')); return }
    if (rows.some(r => r.key === k)) { setAddError(t('Key already exists')); return }
    setAdding(true)
    setAddError(null)
    const { data, error } = await supabase.from('app_config')
      .insert({ key: k, value: newValue.trim() || null, description: newDesc.trim() || null })
      .select('key, value, description').single()
    setAdding(false)
    if (error) { setAddError(error.message); return }
    setRows(rs => [...rs, data as ConfigRow].sort((a, b) => a.key.localeCompare(b.key)))
    setNewKey(''); setNewValue(''); setNewDesc('')
  }

  const inp: React.CSSProperties = { background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 13, padding: '7px 10px', width: '100%', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-6 mb-6">
      <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 4 }}>{t('CONFIG VARIABLES')}</p>
      <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 16 }}>{t('Free-form key/value pairs for whatever needs parking without a schema change.')}</p>
      {loading ? <p style={{ color: C.steel, fontSize: 13 }}>{t('Loading…')}</p> : (
        <div className="flex flex-col gap-3 mb-4">
          {rows.map(row => (
            <div key={row.key} className="grid grid-cols-12 gap-2 items-start" style={{ borderBottom: `1px solid ${C.steelDim}20`, paddingBottom: 10 }}>
              <div className="col-span-3" style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, paddingTop: 7, wordBreak: 'break-all' }}>{row.key}</div>
              <input className="col-span-4" style={inp} value={row.value ?? ''} onChange={e => updateRow(row.key, { value: e.target.value })} placeholder="value" />
              <input className="col-span-3" style={inp} value={row.description ?? ''} onChange={e => updateRow(row.key, { description: e.target.value })} placeholder="description" />
              <div className="col-span-2 flex gap-2">
                <button onClick={() => save(row.key)} disabled={savingKey === row.key} style={{ color: C.cyan, fontSize: 12, border: `1px solid ${C.cyan}50`, padding: '6px 10px', background: `${C.cyan}10`, cursor: 'pointer' }}>{savingKey === row.key ? '…' : t('Save')}</button>
                <button onClick={() => remove(row.key)} style={{ color: C.red, fontSize: 12, border: `1px solid ${C.red}50`, padding: '6px 10px', background: 'transparent', cursor: 'pointer' }}>{t('Delete')}</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p style={{ color: C.steelDim, fontSize: 13 }}>{t('No config variables yet.')}</p>}
        </div>
      )}
      {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <div className="grid grid-cols-12 gap-2 items-start" style={{ borderTop: `1px solid ${C.steelDim}30`, paddingTop: 14 }}>
        <input className="col-span-3" style={inp} value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={t('key')} />
        <input className="col-span-4" style={inp} value={newValue} onChange={e => setNewValue(e.target.value)} placeholder={t('value')} />
        <input className="col-span-3" style={inp} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('description')} />
        <button onClick={add} disabled={adding} className="col-span-2" style={{ color: C.graphite, background: C.cyan, fontSize: 12, fontWeight: 600, padding: '7px 10px', border: 'none', cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.6 : 1 }}>{adding ? '…' : t('Add')}</button>
      </div>
      {addError && <p style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{addError}</p>}
    </div>
  )
}

// AdminMusicSection — TO_DO item 29: real assignment of music tracks to pages.
//
// Data model (music_tracks table, one row per track):
// - page = null        → the track sits in the library, available for assignment.
// - page = 'X'         → the track is assigned to page 'X' ('default' = the
//                        site-wide fallback theme).
// - is_current = true  → the assignment is active; the public player resolves
//                        exactly one track per page (see resolveMusicSrc).
// Assignment happens in a popup per page; the bundled PuzzleStow.mp3 remains
// the built-in fallback when a page has no assigned track.

interface MusicTrackRow { id: string; title: string; url: string | null; page: string | null; is_current: boolean; sort_order: number }

/** The admin "pages" for music assignment: the site-wide default plus every app page. */
const MUSIC_ASSIGN_PAGES = [
  'default', 'home', 'figures', 'rules', 'lore', 'play', 'practice',
  'sandbox', 'printplay', 'profile', 'devtest',
] as const

/** The bundled fallback track for pages without an assignment. */
const BUNDLED_TRACK_CHOICE = 'bundled'

function AdminMusicSection() {
  const { t } = useLang()
  const [rows, setRows] = useState<MusicTrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingPage, setEditingPage] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    supabase.from('music_tracks').select('id, title, url, page, is_current, sort_order').order('sort_order').then(({ data, error }) => {
      setLoading(false)
      if (error) { setError(error.message); return }
      setRows((data as MusicTrackRow[]) ?? [])
    })
  }, [])

  const assignmentFor = (page: string): MusicTrackRow | undefined =>
    rows.find(r => r.page === page && r.is_current)

  /** Apply the admin's choice for `page`: assign `trackId`, or clear to bundled. */
  const applyAssignment = async (page: string, trackId: string): Promise<string | null> => {
    const cleared = rows.filter(r => r.page === page && r.id !== trackId)
    for (const r of cleared) {
      const { error: e } = await supabase.from('music_tracks')
        .update({ page: null, is_current: false, updated_at: new Date().toISOString() }).eq('id', r.id)
      if (e) return e.message
    }
    if (trackId === BUNDLED_TRACK_CHOICE) return null
    const { error: e } = await supabase.from('music_tracks')
      .update({ page, is_current: true, updated_at: new Date().toISOString() }).eq('id', trackId)
    return e ? e.message : null
  }

  const commitAssignment = async (page: string, trackId: string) => {
    const err = await applyAssignment(page, trackId)
    if (err) { setError(err); return }
    setRows(rs => rs.map(r => {
      if (r.page === page && r.id !== trackId) return { ...r, page: null, is_current: false }
      if (r.id === trackId && trackId !== BUNDLED_TRACK_CHOICE) return { ...r, page, is_current: true }
      return r
    }))
    setEditingPage(null)
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('music_tracks').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setRows(rs => rs.filter(r => r.id !== id))
  }

  const add = async () => {
    if (adding) return
    if (!newTitle.trim()) { setAddError(t('Title is required')); return }
    setAdding(true)
    setAddError(null)
    const { data, error } = await supabase.from('music_tracks')
      .insert({ title: newTitle.trim(), url: newUrl.trim() || null, sort_order: rows.length })
      .select('id, title, url, page, is_current, sort_order').single()
    setAdding(false)
    if (error) { setAddError(error.message); return }
    setRows(rs => [...rs, data as MusicTrackRow])
    setNewTitle(''); setNewUrl('')
  }

  const inp: React.CSSProperties = { background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 13, padding: '7px 10px', width: '100%', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-6 mb-6">
      <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 4 }}>{t('MUSIC TRACKS')}</p>
      <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 16 }}>{t('Click a page to pick its track in a popup. Pages without a choice play the bundled PuzzleStow theme. Read live by the public player.')}</p>
      {loading ? <p style={{ color: C.steel, fontSize: 13 }}>{t('Loading…')}</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {MUSIC_ASSIGN_PAGES.map(p => {
              const cur = assignmentFor(p)
              return (
                <button key={p} onClick={() => setEditingPage(p)}
                  style={{ border: `1px solid ${cur ? C.cyan : C.steelDim}50`, background: cur ? `${C.cyan}10` : 'transparent', textAlign: 'left', padding: '8px 10px' }}>
                  <span style={{ display: 'block', color: cur ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.06em' }}>{p.toUpperCase()}</span>
                  <span style={{ display: 'block', color: C.deck, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cur ? cur.title : t('PuzzleStow (bundled)')}
                  </span>
                </button>
              )
            })}
          </div>
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 10 }}>{t('TRACK LIBRARY')}</p>
          <div className="flex flex-col gap-3 mb-4">
            {rows.map(row => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-center" style={{ borderBottom: `1px solid ${C.steelDim}20`, paddingBottom: 10 }}>
                <div className="col-span-3" style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, wordBreak: 'break-all' }}>
                  {row.title}
                  {row.page && <span style={{ display: 'block', color: C.cyan, fontSize: 10 }}>{t('plays on')} {row.page}</span>}
                </div>
                <div className="col-span-6" style={{ color: C.steelDim, fontSize: 12, wordBreak: 'break-all' }}>{row.url ?? t('no URL — track cannot play')}</div>
                <div className="col-span-3 flex justify-end">
                  <button onClick={() => remove(row.id)} style={{ color: C.red, fontSize: 12, border: `1px solid ${C.red}50`, padding: '6px 10px', background: 'transparent', cursor: 'pointer' }}>{t('Delete')}</button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p style={{ color: C.steelDim, fontSize: 13 }}>{t('No tracks yet — the bundled themes play.')}</p>}
          </div>
        </>
      )}
      {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <div className="grid grid-cols-12 gap-2 items-center" style={{ borderTop: `1px solid ${C.steelDim}30`, paddingTop: 14 }}>
        <input className="col-span-4" style={inp} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('title')} />
        <input className="col-span-5" style={inp} value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder={t('audio URL (https://… or /music/file.mp3 served from /public)')} />
        <button onClick={add} disabled={adding} className="col-span-3" style={{ color: C.graphite, background: C.cyan, fontSize: 12, fontWeight: 600, padding: '7px 10px', border: 'none', cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.6 : 1 }}>{adding ? '…' : t('Add track')}</button>
      </div>
      {addError && <p style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{addError}</p>}
      {editingPage !== null && (
        <MusicAssignPopup
          page={editingPage}
          currentId={assignmentFor(editingPage)?.id ?? BUNDLED_TRACK_CHOICE}
          tracks={rows.filter(r => r.page === null || r.page === editingPage)}
          onPick={commitAssignment}
          onClose={() => setEditingPage(null)}
        />
      )}
    </div>
  )
}

/** Popup for picking the track a page plays: bundled default or a library track. */
function MusicAssignPopup({ page, currentId, tracks, onPick, onClose }: {
  page: string; currentId: string
  tracks: MusicTrackRow[]
  onPick: (page: string, trackId: string) => Promise<void>
  onClose: () => void
}) {
  const { t } = useLang()
  const [choice, setChoice] = useState(currentId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    await onPick(page, choice)
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.graphite2, border: `1px solid ${C.cyan}50`, width: '100%', maxWidth: 420, padding: 20 }}>
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>{t('TRACK FOR')} {page.toUpperCase()}</p>
        <select value={choice} onChange={e => setChoice(e.target.value)}
          style={{ background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 13, padding: '7px 10px', width: '100%', outline: 'none', fontFamily: 'inherit' }}>
          <option value={BUNDLED_TRACK_CHOICE}>{t('PuzzleStow (bundled)')}</option>
          {tracks.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{error}</p>}
        <div className="flex gap-2 justify-end" style={{ marginTop: 16 }}>
          <button onClick={onClose} style={{ color: C.steel, fontSize: 12, border: `1px solid ${C.steelDim}50`, padding: '6px 12px', background: 'transparent' }}>{t('Cancel')}</button>
          <button onClick={save} disabled={saving} style={{ color: C.graphite, background: C.cyan, fontSize: 12, fontWeight: 600, padding: '6px 12px', border: 'none', opacity: saving ? 0.6 : 1 }}>{saving ? '…' : t('Save')}</button>
        </div>
      </div>
    </div>
  )
}

/** VITE_* environment variables the app consumes; values are never rendered. */
const APP_ENV_VARS: { name: string; purpose: 'required' | 'optional' }[] = [
  { name: 'VITE_SUPABASE_URL', purpose: 'required' },
  { name: 'VITE_SUPABASE_PUBLISHABLE_KEY', purpose: 'required' },
  { name: 'VITE_GEO_URL', purpose: 'optional' },
]

/** AdminEnvSection — TO_DO item 29: show which env variables the app uses.
 *  Values live in .env.local (gitignored) and are documented in .env.example;
 *  they are inlined at build time and must NOT move into the database (the DB
 *  cannot keep secrets for a public bundle). Values are never displayed.
 */
function AdminEnvSection() {
  const { t } = useLang()
  const present = new Set(Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')))
  return (
    <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-6 mb-6">
      <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 4 }}>{t('ENV VARIABLES')}</p>
      <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 16 }}>
        {t('Stored in .env.local (gitignored), documented in .env.example, inlined by Vite at build time. Secrets must stay out of the database; admin-tunable runtime values belong to CONFIG VARIABLES above.')}
      </p>
      <div className="flex flex-col gap-2">
        {APP_ENV_VARS.map(v => (
          <div key={v.name} className="grid grid-cols-12 gap-2 items-center" style={{ borderBottom: `1px solid ${C.steelDim}20`, paddingBottom: 8 }}>
            <div className="col-span-6" style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{v.name}</div>
            <div className="col-span-3" style={{ color: C.steelDim, fontSize: 12 }}>{v.purpose === 'required' ? t('required') : t('optional')}</div>
            <div className="col-span-3 text-right" style={{ color: present.has(v.name) ? C.green : C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
              {present.has(v.name) ? t('configured ✓') : t('NOT SET')}
            </div>
          </div>
        ))}
        {[...present].filter(k => !APP_ENV_VARS.some(v => v.name === k)).map(k => (
          <div key={k} className="grid grid-cols-12 gap-2 items-center" style={{ borderBottom: `1px solid ${C.steelDim}20`, paddingBottom: 8 }}>
            <div className="col-span-6" style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{k}</div>
            <div className="col-span-3" style={{ color: C.steelDim, fontSize: 12 }}>{t('custom')}</div>
            <div className="col-span-3 text-right" style={{ color: C.green, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('configured ✓')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface NewsItemRow { id: string; message: string; is_active: boolean; sort_order: number }

function AdminNewsSection() {
  const { t } = useLang()
  const [rows, setRows] = useState<NewsItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    supabase.from('news_items').select('id, message, is_active, sort_order').order('sort_order').then(({ data, error }) => {
      setLoading(false)
      if (error) { setError(error.message); return }
      setRows((data as NewsItemRow[]) ?? [])
    })
  }, [])

  const updateRow = (id: string, patch: Partial<NewsItemRow>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))

  const save = async (id: string) => {
    const row = rows.find(r => r.id === id)
    if (!row) return
    setSavingId(id)
    const { error } = await supabase.from('news_items')
      .update({ message: row.message, is_active: row.is_active, sort_order: row.sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSavingId(null)
    if (error) setError(error.message)
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('news_items').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setRows(rs => rs.filter(r => r.id !== id))
  }

  const add = async () => {
    if (adding) return
    if (!newMessage.trim()) { setAddError(t('Message is required')); return }
    setAdding(true)
    setAddError(null)
    const { data, error } = await supabase.from('news_items')
      .insert({ message: newMessage.trim(), sort_order: rows.length })
      .select('id, message, is_active, sort_order').single()
    setAdding(false)
    if (error) { setAddError(error.message); return }
    setRows(rs => [...rs, data as NewsItemRow])
    setNewMessage('')
  }

  const inp: React.CSSProperties = { background: C.graphite, border: `1px solid ${C.steelDim}`, color: C.deck, fontSize: 13, padding: '7px 10px', width: '100%', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-6">
      <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 4 }}>{t('NEWS LINE')}</p>
      <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 16 }}>{t('Items for the news-line ticker. Shown live in the ticker bar under the nav on every page.')}</p>
      {loading ? <p style={{ color: C.steel, fontSize: 13 }}>{t('Loading…')}</p> : (
        <div className="flex flex-col gap-3 mb-4">
          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-center" style={{ borderBottom: `1px solid ${C.steelDim}20`, paddingBottom: 10 }}>
              <input className="col-span-7" style={inp} value={row.message} onChange={e => updateRow(row.id, { message: e.target.value })} placeholder="message" />
              <input className="col-span-1" type="number" style={inp} value={row.sort_order} onChange={e => updateRow(row.id, { sort_order: Number(e.target.value) })} />
              <div className="col-span-1 flex justify-center">
                <div onClick={() => updateRow(row.id, { is_active: !row.is_active })} style={{ width: 18, height: 18, border: `1.5px solid ${row.is_active ? C.cyan : C.steelDim}`, background: row.is_active ? C.cyan : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {row.is_active && <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={C.graphite} strokeWidth={2}><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                </div>
              </div>
              <div className="col-span-3 flex gap-2 justify-end">
                <button onClick={() => save(row.id)} disabled={savingId === row.id} style={{ color: C.cyan, fontSize: 12, border: `1px solid ${C.cyan}50`, padding: '6px 10px', background: `${C.cyan}10`, cursor: 'pointer' }}>{savingId === row.id ? '…' : t('Save')}</button>
                <button onClick={() => remove(row.id)} style={{ color: C.red, fontSize: 12, border: `1px solid ${C.red}50`, padding: '6px 10px', background: 'transparent', cursor: 'pointer' }}>{t('Delete')}</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p style={{ color: C.steelDim, fontSize: 13 }}>{t('No news items yet.')}</p>}
        </div>
      )}
      {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <div className="flex gap-2" style={{ borderTop: `1px solid ${C.steelDim}30`, paddingTop: 14 }}>
        <input style={{ ...inp, flex: 1 }} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={t('new news item message')} />
        <button onClick={add} disabled={adding} style={{ color: C.graphite, background: C.cyan, fontSize: 12, fontWeight: 600, padding: '7px 16px', border: 'none', cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.6 : 1 }}>{adding ? '…' : t('Add')}</button>
      </div>
      {addError && <p style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{addError}</p>}
    </div>
  )
}

// ── Dev/Test Environment Page — TO_DO.docx items 6-8 (2026-09-06) ─────────────
// Not a public game mode: a harness for exercising the rules/opponent engine
// (src/engine/rules.ts, src/engine/opponentEngine.ts) while a real backend
// doesn't exist yet. See those files for what's approximated and why.

// Log formatting helpers (Sergey, 2026-09-08: log entries should read "[дата] [время
// загрузки] [время потраченное на загрузку] [расположение фигуры в формате PuzzleStow]",
// bookended by a game-start entry carrying just the date/start time and a game-end entry
// carrying the date/end time + final score). Plain functions, no locale dependency, so the
// log format doesn't shift with the browser's regional settings.
function pad2(n: number): string { return n.toString().padStart(2, '0') }
function logDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function logTime(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
function logDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  const totalSec = ms / 1000
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`
  const totalSecInt = Math.round(totalSec)
  return `${Math.floor(totalSecInt / 60)}m ${pad2(totalSecInt % 60)}s`
}

// TO_DO 43 (2026-10-26 numbering): per-player timer panel for the test game page —
// "THIS LOAD" = the currently open load window (request received → own request sent),
// "TOTAL TIME" = the sum of all closed windows. Restarted by resetGame. Preconditions:
// caller passes live `now` (updated by the 1s tick) so running windows advance; the
// panel itself is presentation-only, all window bookkeeping lives in DevTestPage.
function TimerPanel({
  player, color, startedAt, totalMs, now, label,
}: {
  player: string
  color: string
  startedAt: number | null
  totalMs: number
  now: number
  label: string
}) {
  const running = startedAt != null
  const currentMs = startedAt != null ? Math.max(0, now - startedAt) : 0
  const { t } = useLang()
  return (
    <div style={{ border: `1px solid ${color}40`, background: C.graphite2 }} className="p-4 flex-1">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{player}</span>
        <span style={{ color: running ? color : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>
          {running ? label : t('waiting for a load request…')}
        </span>
      </div>
      <div className="flex gap-4 flex-wrap">
        <div style={{ flex: '1 1 120px', minWidth: 120 }}>
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.05em' }}>{t('THIS LOAD')}</p>
          <p style={{ color: running ? color : C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            {running ? logDuration(currentMs) : '—'}
          </p>
        </div>
        <div style={{ flex: '1 1 120px', minWidth: 120 }}>
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.05em' }}>{t('TOTAL TIME')}</p>
          <p style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            {totalMs + currentMs > 0 ? logDuration(totalMs + currentMs) : '0.0s'}
          </p>
        </div>
      </div>
    </div>
  )
}

function DevTestPage() {
  const { lang, t } = useLang()
  // Qualification (TIERS[0] = UnderLodar) drives container size, not a fixed constant
  // (Sergey, 2026-09-09): UnderLodar plays the training 15×11 container (row K exposed);
  // winning 10 rated matches and passing the exam promotes to Lodar, which plays the
  // standard competitive 15×10 used by every tier above UnderLodar.
  const [qualTierId, setQualTierId] = useState<number>(1)
  const DEV_ROWS = qualTierId === 1 ? 11 : 10

  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const engine = useMemo(() => createOpponentEngine({ difficulty }), [difficulty])

  const [filledYou, setFilledYou] = useState<Set<string>>(new Set())
  const [filledOpp, setFilledOpp] = useState<Set<string>>(new Set())
  // Two independent 27-figure pools, one per player (PairSec_Спецификация_Final_2026.docx §7.1:
  // "у каждого контейнер и набор из 27 предметов-грузов" — EACH side has its own full 27, not one
  // pool shared between them). Sergey, 2026-09-08: "исчезают предметы ходов каждого игрока" / "после
  // 13-14 ходов фигур ни у кого не остаётся" — with a single shared usedIds, a figure requested for
  // EITHER side drained the SAME counter, so a match only ever covered 27 total placements between
  // both players (13-14 rounds) instead of 27 EACH (~27 rounds, 54 placements) per MVP_Rules.docx's
  // end condition "Оба игрока разместили все фигуры".
  const [usedForYou, setUsedForYou] = useState<Set<number>>(new Set())  // already requested FOR you (placed into your container)
  const [usedForOpp, setUsedForOpp] = useState<Set<number>>(new Set()) // already requested FOR the opponent (placed into theirs)
  // Placed-piece metadata (id + which cells are the reference dots) so the containers
  // can render numbers/dots on every placed figure, not just a flat filled-cell color.
  const [piecesYou, setPiecesYou] = useState<{ id: number; cells: Cells; dotIdx: number[] }[]>([])
  const [piecesOpp, setPiecesOpp] = useState<{ id: number; cells: Cells; dotIdx: number[] }[]>([])
  // Click-to-fill notation: 1 point for a single-dot figure, 2 for a two-dot figure.
  const [clickPoints, setClickPoints] = useState<{ r: number; c: number }[]>([])
  // Cell currently under the cursor over YOUR CONTAINER — used only to live-preview where
  // the second point of a two-point placement would land before it's actually clicked.
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null)

  const [coinState, setCoinState] = useState<'idle' | 'spinning' | 'done'>('idle')
  const [requester, setRequester] = useState<'you' | 'opp' | null>(null)

  const [incomingFigId, setIncomingFigId] = useState<number | null>(null)
  const [lastRequestToYou, setLastRequestToYou] = useState<number | null>(null)
  const [lastRequestToOpp, setLastRequestToOpp] = useState<number | null>(null)

  const [rotIdx, setRotIdx] = useState(0)
  const [notation, setNotation] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  // Response/gameOver texts are stored already-translated; the default response
  // is rendered per-language via the fallback below, so the initial state is null.
  const responseText = response ?? t('Flip the coin to decide who requests first.')
  const responseIsError = response != null && (
    responseText.startsWith(t('Invalid: {reason}').split('{reason}')[0])
    || responseText.includes(t('opponent declined fair play. Choose a different placement.'))
  )
  const [pendingFairPlay, setPendingFairPlay] = useState<{ key: string } | null>(null)
  const [gameOver, setGameOver] = useState<string | null>(null)
  const [log, setLog] = useState<{ id: number; t: number; text: string }[]>([])
  const [showInternals, setShowInternals] = useState(false)
  // Fair-play tallies, TO_DO 44c: IN = fair-play requests you RECEIVED from the opponent
  // (decisions you made), OUT = requests you SENT (decisions the opponent made). Each
  // counts APPROVED / DECLINED per the game protocol, for later per-player statistics.
  const [fairPlayIn, setFairPlayIn] = useState({ approved: 0, declined: 0 })
  const [fairPlayOut, setFairPlayOut] = useState({ approved: 0, declined: 0 })
  const logIdRef = useRef(0)
  // When the figure currently incoming to YOU was requested — start of the "time spent on
  // load" window the log reports for your placements.
  const requestedAtRef = useRef<number>(Date.now())
  // TO_DO 43 (2026-10-26 numbering): per-player load timers on the test page.
  // "Таймер данной загрузки" opens when a load request ARRIVES for that player
  // (the engine requests a figure for you / you request one for the opponent)
  // and closes when that same player SENDS their own next request — so the
  // window spans the placement AND the choice of what to request next, exactly
  // per the TO_DO wording ("заканчивается после отсылки своего запроса"). The
  // log's "spent" field covers only the placement half of that window; the
  // timer is the wider, TO_DO-defined measure. "Таймер общего времени" = sum of
  // every closed window of that player. The engine decides synchronously, so
  // its windows are near-zero — honest, not a bug.
  const loadStartRef = useRef<{ you: number | null; opp: number | null }>({ you: null, opp: null })
  const [loadTotals, setLoadTotals] = useState<{ you: number; opp: number }>({ you: 0, opp: 0 })
  const [, setTimersTick] = useState(0)

  /** Opens a player's current-load window at the instant a load request reaches them. */
  function startLoadTimer(player: 'you' | 'opp') {
    loadStartRef.current[player] = Date.now()
  }

  /** Closes a player's open window (no-op if none) and banks its elapsed time into their total. */
  function endLoadTimer(player: 'you' | 'opp') {
    const started = loadStartRef.current[player]
    if (started == null) return
    loadStartRef.current[player] = null
    const elapsed = Date.now() - started
    setLoadTotals(t => (player === 'you' ? { ...t, you: t.you + elapsed } : { ...t, opp: t.opp + elapsed }))
  }
  // Structured mirror of the placement log lines, kept separately from the display strings
  // so the PDF export (Sergey, 2026-09-08: "Экспорт лога в PDF, как отчёта по игре в
  // задокументированном формате") builds its table from real fields instead of re-parsing
  // formatted text.
  const [moveRecords, setMoveRecords] = useState<LogMoveRecord[]>([])
  const [gameStartInfo, setGameStartInfo] = useState<{ date: string; time: string } | null>(null)
  const [gameEndInfo, setGameEndInfo] = useState<{ date: string; time: string; message: string; youScore: number; oppScore: number } | null>(null)

  // Each entry needs a stable, collision-free key: two pushLog calls in the same
  // synchronous handler (e.g. "You request X" immediately followed by "Opponent
  // places X") can land in the same millisecond, so entry.t alone was not a safe
  // React key — colliding keys made the list mis-reconcile and duplicate old rows
  // on screen every time a new one was pushed, which is why LOG grew far faster
  // than the real number of events and blew past its own bottom alignment with
  // the containers above it.
  const pushLog = (text: string) => setLog(l => [{ id: ++logIdRef.current, t: Date.now(), text }, ...l].slice(0, 40))
  // Small color-coding for the log — works for EN/RU/BY log lines (pushed already-translated).
  function logColor(text: string): string {
    if (/^opponent wins|^победил соперник|^перамог сапернік/i.test(text)) return C.red
    if (/^you win|^выигр|^вы перамагл/i.test(text)) return C.green
    if (/\blose\b|прайгра|проиграл/i.test(text)) return C.red
    if (/\bdraw\b|ничья|нічыя/i.test(text)) return C.blue
    if (/^You|^Вы\b/.test(text)) return C.cyan
    return C.steel
  }

  // One structured line per placement — player, when, how long it took to decide, the
  // PuzzleStow notation for where it landed, any row/column it just closed, and the running
  // score right after this load (Sergey, 2026-09-08 log-format request).
  function logPlacement(player: 'You' | 'Opponent', fig: Figure, cells: Cells, at: number, spentMs: number, newlyClosed: string[], youScore: number, oppScore: number) {
    const dotPoints = fig.dots.map(idx => ({ r: cells[idx][0], c: cells[idx][1] }))
    const placement = formatNotation(fig.id, dotPoints, DEV_ROWS)
    const closedText = newlyClosed.length ? t(' — {closed}', { closed: newlyClosed.join(', ') }) : ''
    pushLog(t('{player} — {date} {time} — spent {dur} — placed {fig} at {notation}{closed} — Score {y}:{o}', {
      player: t(player), date: logDate(at), time: logTime(at), dur: logDuration(spentMs),
      fig: fig.label, notation: placement, closed: closedText, y: youScore, o: oppScore,
    }))
    setMoveRecords(prev => [...prev, {
      player, date: logDate(at), time: logTime(at), spentLabel: logDuration(spentMs),
      figureLabel: fig.label, notation: placement, closed: newlyClosed, youScore, oppScore,
    }])
  }

  // TO_DO 43: one shared 1s tick that re-renders the timer readouts while any
  // window is running. Stops entirely when no window is open or the game is
  // over, so idle pages don't burn a render per second.
  useEffect(() => {
    const anyRunning = loadStartRef.current.you != null || loadStartRef.current.opp != null
    if (!anyRunning || gameOver) return
    const id = window.setInterval(() => setTimersTick(t => (t + 1) % 1e9), 1000)
    return () => window.clearInterval(id)
  }, [gameOver, requester, incomingFigId])

  // A "pass" event -- a requested figure has nowhere legal to go, or no figure is left
  // that can be requested -- ends the game exactly like a placement does, but wasn't a
  // placement, so it needs its own structured row (no notation, no time-spent) alongside
  // logPlacement's, purely so the exported report shows what actually caused the ending
  // instead of jumping straight from the last placement to the Result line.
  function logPass(player: 'You' | 'Opponent', figureLabel: string, youScore: number, oppScore: number) {
    const at = Date.now()
    setMoveRecords(prev => [...prev, {
      player, date: logDate(at), time: logTime(at), spentLabel: '—',
      figureLabel, notation: '—', closed: [], youScore, oppScore,
    }])
  }

  function logGameEnd(message: string, youScore: number, oppScore: number) {
    const at = Date.now()
    // TO_DO 43: the game is over — any load window still open will never meet
    // its documented end (the player never sent their next request), so close
    // both at the ending instant; totals then reflect every real second spent.
    endLoadTimer('you')
    endLoadTimer('opp')
    pushLog(t('Game ended — {date} {time} — Final score {y}:{o} — {msg}', { date: logDate(at), time: logTime(at), y: youScore, o: oppScore, msg: message }))
    setGameEndInfo({ date: logDate(at), time: logTime(at), message, youScore, oppScore })
  }

  // PDF game report (Sergey, 2026-09-08) — same fields the on-screen log now carries
  // (player, date, load time, time spent, PuzzleStow notation, row/column closed, running
  // score), laid out as a proper document instead of a scrollback dump: brand wordmark,
  // Stow Blue / Cargo Graphite from PuzzleStow_Brandbook_v1.1.docx, monospace for
  // coordinates (Courier — the closest built-in jsPDF font to the brand's JetBrains Mono).
  function exportGameReportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    const STOW_BLUE: [number, number, number] = [31, 79, 130]
    const GRAPHITE: [number, number, number] = [28, 31, 38]
    const STEEL: [number, number, number] = [163, 169, 181]
    const DECK: [number, number, number] = [245, 247, 250]

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...STOW_BLUE)
    doc.text('PUZZLESTOW', margin, 50)
    doc.setFontSize(12)
    doc.setTextColor(...GRAPHITE)
    doc.text('Game Report — Dev/Test Environment', margin, 68)

    let y = 92
    const metaLine = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GRAPHITE)
      doc.text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(value, margin + 100, y)
      y += 16
    }
    metaLine('Difficulty', difficulty)
    if (gameStartInfo) metaLine('Started', `${gameStartInfo.date} ${gameStartInfo.time}`)
    if (gameEndInfo) metaLine('Ended', `${gameEndInfo.date} ${gameEndInfo.time}`)
    metaLine('Final score', gameEndInfo ? `${gameEndInfo.youScore}:${gameEndInfo.oppScore}` : `${closedYouTotal}:${closedOppTotal}`)
    if (gameEndInfo) metaLine('Result', gameEndInfo.message)

    autoTable(doc, {
      startY: y + 8,
      head: [['#', 'Player', 'Date', 'Time', 'Spent', 'Figure', 'Placement', 'Closed', 'Score']],
      body: moveRecords.map((m, i) => [
        String(i + 1), m.player, m.date, m.time, m.spentLabel, m.figureLabel, m.notation,
        m.closed.length ? m.closed.join(', ') : '—', `${m.youScore}:${m.oppScore}`,
      ]),
      styles: { font: 'courier', fontSize: 8, cellPadding: 4, textColor: GRAPHITE },
      headStyles: { fillColor: STOW_BLUE, textColor: DECK, font: 'helvetica', fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: DECK },
      margin: { left: margin, right: margin },
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 8
    doc.setFontSize(9)
    doc.setTextColor(...STEEL)
    const generatedAt = Date.now()
    doc.text(`Generated ${logDate(generatedAt)} ${logTime(generatedAt)} — local engine only, not the server-authoritative record.`, margin, finalY + 22)

    const filenameDate = gameStartInfo?.date ?? logDate(generatedAt)
    doc.save(`PuzzleStow_Game_Report_${filenameDate}.pdf`)
  }

  const availableFigures = FIGURES.filter(f => !usedForYou.has(f.id))
  // TO_DO 30 engine planning context: the opponent engine reasons about which
  // figures it might still receive/placement quality on its own board, and (hard
  // level) about what it hands the human. ownAvailable/humanAvailable already
  // exclude the used figure sets; the anti-repeat rule stays the caller's job
  // (chooseFigureToRequest applies it to `available` itself).
  const engineContext = useMemo(() => ({
    rows: DEV_ROWS,
    ownFilled: filledOpp,
    ownAvailable: FIGURES.filter(f => !usedForOpp.has(f.id)),
    humanFilled: filledYou,
    humanAvailable: availableFigures,
  }), [DEV_ROWS, filledOpp, usedForOpp, filledYou, availableFigures])
  const incomingFig = incomingFigId != null ? FIGURES.find(f => f.id === incomingFigId) ?? null : null
  const orientations = incomingFig ? getOrientations(incomingFig.cells) : []
  // Dead/X cells (TO_DO.docx, 2026-09-08): purely geometric — cells with no path of
  // empty cells up to the open top of the container are walled in, period, independent
  // of which figures remain (see rules.ts computeDeadCells for why that's the model).
  const deadYou = useMemo(() => computeDeadCells(filledYou, DEV_ROWS), [filledYou])
  const deadOpp = useMemo(() => computeDeadCells(filledOpp, DEV_ROWS), [filledOpp])
  const closedYou = closedRows(filledYou, DEV_ROWS, deadYou)
  const closedOpp = closedRows(filledOpp, DEV_ROWS, deadOpp)
  const closedYouCols = closedCols(filledYou, DEV_ROWS, deadYou)
  const closedOppCols = closedCols(filledOpp, DEV_ROWS, deadOpp)
  // "closed" for win/score purposes is rows AND columns combined — a completed column
  // counts exactly like a completed row (TO_DO.docx: check highlighting of vertical AND
  // horizontal rows).
  const closedYouTotal = closedYou.size + closedYouCols.size
  const closedOppTotal = closedOpp.size + closedOppCols.size
  // Once the game has ended, gameEndInfo carries the one authoritative final score (which may be
  // a forced 5, see item 17's follow-up) -- prefer it over the still-live closed counts so the
  // panels/headers agree with the end-of-game banner and log line instead of showing a stale tally.
  const displayYouScore = gameOver && gameEndInfo ? gameEndInfo.youScore : closedYouTotal
  const displayOppScore = gameOver && gameEndInfo ? gameEndInfo.oppScore : closedOppTotal
  // Click-to-fill (item 8 follow-up): two-dot figures need point1+point2, single-dot
  // figures place from one anchor click (using the rotation buttons for orientation).
  const pointsNeeded = incomingFig ? (incomingFig.dots.length >= 2 ? 2 : 1) : 0

  // Keep the notation field in sync with whatever's been clicked on YOUR CONTAINER so far.
  useEffect(() => {
    if (!incomingFig || clickPoints.length < pointsNeeded) return
    // Click order IS notation order: dot1 is whichever point was clicked first, dot2 the
    // second — exactly like typing "10A12C14" by hand means "dot1 at A12, dot2 at C14", not
    // "whichever of these two is physically left". Click-to-fill is a shortcut for typing the
    // field, so it must reproduce the same order, not re-sort by column.
    setNotation(formatNotation(incomingFig.id, clickPoints.slice(0, pointsNeeded), DEV_ROWS))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickPoints, incomingFig?.id, pointsNeeded])

  // Faint outline of where the current click-selection (or its rotation) would land —
  // "слабо видимые контуры фигуры" — purely visual, Submit still does the real check.
  const ghostPlacement = useMemo(() => {
    if (!incomingFig || clickPoints.length < pointsNeeded) return null
    const clicked = clickPoints.slice(0, pointsNeeded)
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(incomingFig, clicked)
      : computePlacementFromAnchor(incomingFig, rotIdx, clicked[0])
    if (!cells) return null
    // Same check submitPlacement will run — lets the ghost outline itself turn red
    // when the current click-selection would actually be rejected.
    const result = checkPlacement(cells, filledYou, DEV_ROWS)
    // A placement that goes outside the container has cell coordinates outside the grid
    // itself — drawing that outline would spill the dashed rect past the container's own
    // border. Don't draw it; say so instead.
    if (!result.ok && result.reason === 'Placement goes outside the container') {
      return { set: undefined, valid: false, outOfBoundsMessage: result.reason }
    }
    return { set: new Set(cells.map(([r, c]) => cellKey(r, c))), valid: result.ok, outOfBoundsMessage: undefined }
  }, [incomingFig, clickPoints, pointsNeeded, rotIdx, filledYou])

  // Live hover preview for the SECOND point of a two-point figure: once point1 is fixed,
  // only up to 4 orientations remain and usually just 1-2 (or none) are legal — rather than
  // making the player click-and-check by trial and error, outline what THIS hovered cell
  // would produce, red when the orientation is geometrically reachable but the game rules
  // reject it (collision, overhang). When NO orientation reaches the hovered cell at all,
  // stay silent instead of flashing a red marker — that's the expected outcome for most
  // candidate cells (only 1-2 of 4 orientations are ever reachable from a fixed point1), and
  // painting something there every time was itself the source of the reported flakiness.
  const hoverPreview = useMemo(() => {
    if (!incomingFig || !hoverCell || pointsNeeded !== 2 || clickPoints.length !== 1) return null
    const [p1] = clickPoints
    if (p1.r === hoverCell.r && p1.c === hoverCell.c) return null
    // STRICT dot-order canon (Sergey, 2026-11-18): point1 = first click and the figure
    // rotates AROUND it until the figure's dot2 meets the hovered cell. The mirrored
    // reading (hovered cell = dot1) is NEVER previewed — it was not chosen.
    const cells = computePlacementFromDots(incomingFig, [p1, hoverCell])
    if (!cells) return null
    const result = checkPlacement(cells, filledYou, DEV_ROWS)
    if (!result.ok && result.reason === 'Placement goes outside the container') return null
    return { set: new Set(cells.map(([r, c]) => cellKey(r, c))), valid: result.ok }
  }, [incomingFig, hoverCell, clickPoints, pointsNeeded, filledYou])

  const displayGhost = ghostPlacement ?? hoverPreview
  const ghostCells = displayGhost?.set
  const ghostValid = displayGhost?.valid ?? true
  const ghostOutOfBoundsMessage = ghostPlacement?.outOfBoundsMessage

  // Sergey, 2026-11-19 (fair-play UX canon): the >50 % overhang verdict must be visible
  // AT FIXATION, before any submit — the red ghost already flags it; here we surface the
  // offer «order fair play» next to SUBMIT. The request to the opponent goes out ONLY
  // when the player orders it (orderFairPlay below); then the regulation runs: approval
  // → submit again to confirm, decline → choose a different placement.
  const [fairPlayOffer, setFairPlayOffer] = useState<{ key: string; pct: number } | null>(null)
  useEffect(() => {
    if (!incomingFig || gameOver || clickPoints.length < pointsNeeded) { setFairPlayOffer(null); return }
    const clicked = clickPoints.slice(0, pointsNeeded)
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(incomingFig, clicked)
      : computePlacementFromAnchor(incomingFig, rotIdx, clicked[0])
    if (!cells) { setFairPlayOffer(null); return }
    const key = [...cells].map(([r, c]) => cellKey(r, c)).sort().join('|')
    const result = checkPlacement(cells, filledYou, DEV_ROWS)
    if (result.ok || !result.needsFairPlay) { setFairPlayOffer(null); return }
    setFairPlayOffer({ key, pct: Math.round((result.overhangRatio ?? 0) * 100) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFig, clickPoints, pointsNeeded, rotIdx, filledYou, gameOver])

  function orderFairPlay() {
    if (!incomingFig || gameOver || !fairPlayOffer) return
    // Same resolution as submitPlacement: click order is the dot order; typed text only
    // when it no longer matches what the clicks would generate.
    const clicked = clickPoints.slice(0, pointsNeeded)
    const clickGenerated = clicked.length >= pointsNeeded && pointsNeeded > 0
      ? formatNotation(incomingFig.id, clicked, DEV_ROWS)
      : null
    const usingClicks = clickGenerated != null && notation === clickGenerated
    let cells: ReturnType<typeof computePlacementFromDots>
    if (usingClicks) {
      cells = pointsNeeded === 2
        ? computePlacementFromDots(incomingFig, clicked)
        : computePlacementFromAnchor(incomingFig, rotIdx, clicked[0])
    } else {
      const parsed = parseNotation(notation, DEV_ROWS)
      if ('error' in parsed) { setResponse(t('Invalid: {reason}', { reason: translateEngineText(lang, parsed.error) })); return }
      cells = parsed.points.length >= 2
        ? computePlacementFromDots(incomingFig, parsed.points)
        : computePlacementFromAnchor(incomingFig, rotIdx, parsed.points[0])
    }
    if (!cells) return
    const cellsKey = [...cells].map(([r, c]) => cellKey(r, c)).sort().join('|')
    if (cellsKey !== fairPlayOffer.key) { setFairPlayOffer(null); return }
    const result = checkPlacement(cells, filledYou, DEV_ROWS)
    if (result.ok || !result.needsFairPlay) { setFairPlayOffer(null); return }
    const fp = engine.respondToFairPlay(result.overhangRatio ?? 0)
    pushLog(t('Fair-play check ({pct}% unsupported): opponent says "{msg}"', { pct: Math.round((result.overhangRatio ?? 0) * 100), msg: translateEngineText(lang, fp.message) }))
    // 44c: one OUTGOING request = one OUT tally entry, guarded by the cells key.
    if (pendingFairPlay?.key !== cellsKey) {
      setFairPlayOut(o => fp.kind === 'fair_play_response' && fp.approve
        ? { ...o, approved: o.approved + 1 }
        : { ...o, declined: o.declined + 1 })
    }
    if (fp.kind === 'fair_play_response' && fp.approve) {
      setPendingFairPlay({ key: cellsKey })
      setFairPlayOffer(null)
      setResponse(`${t(result.reason ?? '')} — ${t('opponent agreed via fair play. Submit again to confirm.')}`)
    } else {
      setResponse(`${t(result.reason ?? '')} — ${t('opponent declined fair play. Choose a different placement.')}`)
    }
  }

  function handleYourContainerClick(r: number, c: number) {
    if (!incomingFig || gameOver) return
    setClickPoints(prev => (prev.length >= pointsNeeded ? [{ r, c }] : [...prev, { r, c }]))
  }

  function requestForOpp(fig: Figure) {
    if (gameOver || requester !== 'you') return
    const requestedAt = Date.now()
    // TO_DO 43: your outgoing request both CLOSES your current-load window (you
    // have just sent your request — that's the window's documented end) and
    // OPENS the opponent's (a load request just arrived for them).
    endLoadTimer('you')
    startLoadTimer('opp')
    setUsedForOpp(prev => new Set(prev).add(fig.id))
    setLastRequestToOpp(fig.id)
    pushLog(t('You request {fig} for the opponent.', { fig: fig.label }))
    const decision = engine.decidePlacement(fig, filledOpp, DEV_ROWS, engineContext)
    if (decision.kind === 'pass') {
      pushLog(t('Opponent: {msg}', { msg: translateEngineText(lang, decision.message) }))
      logPass('Opponent', `${fig.label} — ${t('no legal placement')}`, 5, closedOppTotal)
      logGameEnd(t('You win — the opponent has no legal placement for that figure.'), 5, closedOppTotal)
      setGameOver(t('You win — the opponent has no legal placement for that figure.'))
      return
    }
    if (decision.kind === 'place') {
      const before = filledOpp
      const next = new Set(filledOpp)
      decision.cells.forEach(([r, c]) => next.add(cellKey(r, c)))
      setFilledOpp(next)
      setPiecesOpp(prev => [...prev, { id: fig.id, cells: decision.cells, dotIdx: fig.dots }])
      const deadBefore = computeDeadCells(before, DEV_ROWS)
      const deadAfter = computeDeadCells(next, DEV_ROWS)
      const rowsBefore = closedRows(before, DEV_ROWS, deadBefore)
      const rowsAfter = closedRows(next, DEV_ROWS, deadAfter)
      const colsBefore = closedCols(before, DEV_ROWS, deadBefore)
      const colsAfter = closedCols(next, DEV_ROWS, deadAfter)
      const newlyClosed = [
        ...[...rowsAfter].filter(r => !rowsBefore.has(r)).map(r => t('Row {letter} closed', { letter: rowToLetter(r, DEV_ROWS) })),
        ...[...colsAfter].filter(c => !colsBefore.has(c)).map(c => t('Column {n} closed', { n: c })),
      ]
      const oppClosedAfter = rowsAfter.size + colsAfter.size
      logPlacement('Opponent', fig, decision.cells, Date.now(), Date.now() - requestedAt, newlyClosed, closedYouTotal, oppClosedAfter)
      // TO_DO 44d for the opponent (2026-11-19, report (4)): as a desperate last
      // resort the engine may place a load that seals its own exit — the move is
      // legal (44e), the loss is honest and declared AFTER it lands, exactly like
      // the player's own 44d check above. Score per Official_Rules end-variant:
      // loser keeps the rows closed so far, winner gets 5.
      if (!hasReturnPath(next, DEV_ROWS, decision.cells)) {
        const msg = t('Opponent loses — its last load sealed the way back to the container exit (44d).')
        logGameEnd(msg, 5, oppClosedAfter)
        setGameOver(msg)
        return
      }
      if (oppClosedAfter >= 5) {
        logGameEnd(t('Opponent wins — 5 rows/columns closed.'), closedYouTotal, oppClosedAfter)
        setGameOver(t('Opponent wins — 5 rows/columns closed.'))
        return
      }
    }
    setRequester('opp')
    setResponse(t('Waiting for the opponent to request a figure from you…'))
  }

  // Opponent's turn to request a figure for you, whenever it becomes their turn.
  useEffect(() => {
    if (requester !== 'opp' || incomingFigId != null || gameOver) return
    const decision = engine.chooseFigureToRequest(availableFigures, lastRequestToOpp, engineContext)
    if (decision.kind !== 'request') return
    setUsedForYou(prev => new Set(prev).add(decision.figureId))
    setLastRequestToYou(decision.figureId)
    setIncomingFigId(decision.figureId)
    requestedAtRef.current = Date.now() // starts the "time spent on load" clock for your placement
    // TO_DO 43: this request IS the opponent's outgoing request (closes their
    // window) and it simultaneously arrives TO you (opens yours).
    endLoadTimer('opp')
    startLoadTimer('you')
    setRotIdx(0)
    setClickPoints([])
    setResponse(t('Opponent: {msg}', { msg: translateEngineText(lang, decision.message) }))
    pushLog(t('Opponent requests {fig} from you.', { fig: FIGURES.find(f => f.id === decision.figureId)?.label ?? '' }))
    const fig = FIGURES.find(f => f.id === decision.figureId)!
    if (!canPlaceAnywhere(fig, filledYou, DEV_ROWS)) {
      logPass('You', `${fig.label} — ${t('no legal placement')}`, closedYouTotal, 5)
      logGameEnd(t('Opponent wins — you have no legal placement for the requested figure.'), closedYouTotal, 5)
      setGameOver(t('Opponent wins — you have no legal placement for the requested figure.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requester, incomingFigId, gameOver])

  // Sergey, 2026-09-08 ("После закрытия ряда набор грузов соперника недоступен для выбора -
  // нет возможности продолжать игру" -> confirmed rule: "нет возможности хода ... ты проиграл"):
  // it's your turn to pick a figure from your own 27 to request for the opponent, but every
  // figure is either already requested (usedForOpp) or blocked by the anti-repeat "защита от
  // дурака" rule (fig.id === lastRequestToYou) with nothing else left -- the PICKED BY YOU panel
  // goes fully non-actionable and, before this fix, nothing ever declared the game over, so the
  // player was just stuck with a greyed-out panel and no explanation. Same "no legal move = you
  // lose" rule the opponent-request effect above already applies to your incoming figure, mirrored
  // here for the outgoing-request side of the turn.
  useEffect(() => {
    if (requester !== 'you' || incomingFigId != null || gameOver) return
    const avail = FIGURES.filter(f => !usedForOpp.has(f.id) && f.id !== lastRequestToYou)
    if (avail.length > 0) return
    logPass('You', t('no figure left to request'), closedYouTotal, 5)
    logGameEnd(t('Opponent wins — you have no figure left that you are allowed to request.'), closedYouTotal, 5)
    setGameOver(t('Opponent wins — you have no figure left that you are allowed to request.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requester, incomingFigId, gameOver, usedForOpp, lastRequestToYou])

  function flipCoin() {
    setCoinState('spinning')
    setResponse(t('Flipping…'))
    window.setTimeout(() => {
      const youFirst = Math.random() < 0.5
      setCoinState('done')
      setRequester(youFirst ? 'opp' : 'you') // "opp requests first" means you get the first incoming figure
      setResponse(t(youFirst ? 'Coin: you enter first — the opponent requests your first figure.' : 'Coin: opponent enters first — pick a figure to request for them.'))
      const startedAt = Date.now()
      pushLog(t('Game started — {date} {time}', { date: logDate(startedAt), time: logTime(startedAt) }))
      setGameStartInfo({ date: logDate(startedAt), time: logTime(startedAt) })
      pushLog(t(youFirst ? 'Coin flip: you go first.' : 'Coin flip: opponent goes first.'))
    }, 5000)
  }

  function submitPlacement() {
    if (!incomingFig || gameOver) return
    // Prefer the actual click order over re-parsing the notation text: click order IS
    // the dot order (point1 = first click; the figure rotates around it — Sergey,
    // 2026-11-18). Only fall back
    // to parsing the typed text when the field wasn't produced by clicking — i.e. it no longer
    // matches what the current clicks would generate, meaning the player edited or pasted a
    // notation by hand (typed notation stays strict: point1 = dots[0], canon).
    const clickedPoints = clickPoints.slice(0, pointsNeeded)
    const clickGeneratedNotation = clickedPoints.length >= pointsNeeded && pointsNeeded > 0
      ? formatNotation(incomingFig.id, clickedPoints, DEV_ROWS)
      : null
    const usingClicks = clickGeneratedNotation != null && notation === clickGeneratedNotation

    // STRICT dot-order canon (Sergey, 2026-11-18): point1 = first click — the figure then
    // rotates around it until the figure's dot2 meets the second click; the mirrored
    // reading is never substituted (it was not chosen). Typed notation is the same canon.
    let cells: ReturnType<typeof computePlacementFromDots>
    if (usingClicks) {
      cells = pointsNeeded === 2
        ? computePlacementFromDots(incomingFig, clickedPoints)
        : computePlacementFromAnchor(incomingFig, rotIdx, clickedPoints[0])
    } else {
      const parsed = parseNotation(notation, DEV_ROWS)
      if ('error' in parsed) { setResponse(t('Invalid: {reason}', { reason: translateEngineText(lang, parsed.error) })); return }
      if (parsed.figureId !== incomingFig.id) {
        setResponse(t('Invalid: {reason}', { reason: t('notation is for figure {id}, but {label} was requested', { id: String(parsed.figureId).padStart(2, '0'), label: incomingFig.label }) }))
        return
      }
      cells = parsed.points.length >= 2
        ? computePlacementFromDots(incomingFig, parsed.points)
        : computePlacementFromAnchor(incomingFig, rotIdx, parsed.points[0])
    }
    // Fair-play approval is single-use and tied to this exact set of cells — resubmitting
    // a *different* placement (even right after an approval) must be checked from scratch.
    const cellsKey = cells ? [...cells].map(([r, c]) => cellKey(r, c)).sort().join('|') : null
    const result = checkPlacement(cells, filledYou, DEV_ROWS, cellsKey != null && pendingFairPlay?.key === cellsKey)
    if (!result.ok) {
      if (result.needsFairPlay) {
        // Sergey, 2026-11-19 (fair-play UX canon): submit alone NEVER fires the request —
        // the offer is already visible at fixation; submitting a >50 % placement without
        // having ordered fair play just echoes the verdict and points at the button.
        const key = cellsKey ?? ''
        setFairPlayOffer({ key, pct: Math.round((result.overhangRatio ?? 0) * 100) })
        setPendingFairPlay(null)
        setResponse(`${t(result.reason ?? '')} — ${t('order fair play to ask the opponent.')}`)
        return
      }
      setPendingFairPlay(null)
      setResponse(t('Invalid: {reason}', { reason: t(result.reason ?? '') }))
      return
    }
    setPendingFairPlay(null)
    const before = filledYou
    const next = new Set(filledYou)
    result.cells!.forEach(([r, c]) => next.add(cellKey(r, c)))
    setFilledYou(next)
    setPiecesYou(prev => [...prev, { id: incomingFig.id, cells: result.cells!, dotIdx: incomingFig.dots }])
    setNotation('')
    setClickPoints([])
    setIncomingFigId(null)
    const deadBefore = computeDeadCells(before, DEV_ROWS)
    const deadAfter = computeDeadCells(next, DEV_ROWS)
    const rowsBefore = closedRows(before, DEV_ROWS, deadBefore)
    const rowsAfter = closedRows(next, DEV_ROWS, deadAfter)
    const colsBefore = closedCols(before, DEV_ROWS, deadBefore)
    const colsAfter = closedCols(next, DEV_ROWS, deadAfter)
    const newlyClosed = [
      ...[...rowsAfter].filter(r => !rowsBefore.has(r)).map(r => t('Row {letter} closed', { letter: rowToLetter(r, DEV_ROWS) })),
      ...[...colsAfter].filter(c => !colsBefore.has(c)).map(c => t('Column {n} closed', { n: c })),
    ]
    const nowClosed = rowsAfter.size + colsAfter.size
    const placedAt = Date.now()
    logPlacement('You', incomingFig, result.cells!, placedAt, placedAt - requestedAtRef.current, newlyClosed, nowClosed, closedOppTotal)
    // TO_DO 44d: after placing, the loader must still be able to walk back to the A0 exit
    // under the same ≤3-step rule; if not, the player LOSES — the move itself was legal
    // (44e: the system doesn't second-guess a rules-legal placement), the sealed exit is
    // the player's own doing. Score per Official_Rules end-variant: loser keeps the rows
    // closed so far, winner gets 5.
    if (!hasReturnPath(next, DEV_ROWS, result.cells!)) {
      const msg = t('You lose — this load sealed your way back to the container exit (rule: the loader must be able to return to A0).')
      logGameEnd(msg, closedYouTotal, 5)
      setGameOver(msg)
      return
    }
    if (nowClosed >= 5) { logGameEnd(t('You win — 5 rows/columns closed.'), nowClosed, closedOppTotal); setGameOver(t('You win — 5 rows/columns closed.')); return }
    if (usedForYou.size >= 27 && usedForOpp.size >= 27) {
      const finalMsg = nowClosed === closedOppTotal ? t('Draw — all 27 figures placed, equal rows/columns closed.')
        : nowClosed > closedOppTotal ? t('You win — more rows/columns closed when cargo ran out.') : t('Opponent wins — more rows/columns closed when cargo ran out.')
      logGameEnd(finalMsg, nowClosed, closedOppTotal)
      setGameOver(finalMsg)
      return
    }
    setResponse(t('Placed. Choose a figure to request for the opponent.'))
    setRequester('you')
  }

  function resetGame() {
    setFilledYou(new Set()); setFilledOpp(new Set()); setUsedForYou(new Set()); setUsedForOpp(new Set())
    setPiecesYou([]); setPiecesOpp([]); setClickPoints([])
    setCoinState('idle'); setRequester(null); setIncomingFigId(null)
    setLastRequestToYou(null); setLastRequestToOpp(null); setRotIdx(0); setNotation('')
    setPendingFairPlay(null); setGameOver(null); setLog([])
    setMoveRecords([]); setGameStartInfo(null); setGameEndInfo(null)
    loadStartRef.current = { you: null, opp: null } // TO_DO 43: timers restart from zero
    setLoadTotals({ you: 0, opp: 0 })
    setFairPlayIn({ approved: 0, declined: 0 }); setFairPlayOut({ approved: 0, declined: 0 })
    setResponse(null)
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ background: `${C.red}18`, borderBottom: `1px solid ${C.red}40` }} className="px-4 md:px-6 py-2 text-center">
        <span style={{ color: C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.06em' }}>
          {t('DEV / TEST ENVIRONMENT — local engine only, not the production server (TO_DO.docx items 6-8)')}
        </span>
      </div>

      {/* TO_DO 43: load timers for each participant — current load window + total of
          all closed windows. Rendered above the containers so both players' clocks stay
          visible while placing and while choosing the next request. */}
      <div className="max-w-7xl mx-auto px-4 pt-5 flex gap-5 flex-col md:flex-row">
        <TimerPanel player={t('YOU — LOAD TIMER')} color={C.cyan} startedAt={loadStartRef.current.you} totalMs={loadTotals.you} now={Date.now()} label={t('request received — running until you send yours')} />
        <TimerPanel player={t('OPPONENT — LOAD TIMER')} color={C.steel} startedAt={loadStartRef.current.opp} totalMs={loadTotals.opp} now={Date.now()} label={t('request received — running until they send theirs')} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="flex flex-col gap-5 h-full">
          {gameOver && (
            <div style={{ border: `1px solid ${C.green}60`, background: `${C.green}18`, color: C.deck }} className="p-4 flex items-center justify-between gap-3">
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{gameOver}</span>
              <button onClick={resetGame} style={{ background: C.green, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '6px 12px' }}>{t('New game')}</button>
            </div>
          )}

          {/* Each container sits next to the figure bank that actually loads into it — the
              opponent draws from OPPONENT FIGURES to fill YOUR container, you draw from MY
              FIGURES to fill the OPPONENT's — so "where to pick from" reads left-to-right
              instead of needing a mental map back up the page. */}
          <div className="flex flex-col lg:flex-row gap-5 items-stretch">
            <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-4 flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('YOUR CONTAINER — {rows} rows, {n} closed', { rows: DEV_ROWS, n: displayYouScore })}</span>
                {incomingFig && !gameOver && (
                  <span style={{ color: C.steelDim, fontSize: 11 }}>
                    {t('Click {what} below to fill the request field ({click}/{need})', {
                      what: t(pointsNeeded === 2 ? "point 1, then point 2 — point 1 is the figure's own fixed dot and sets the rotation" : 'a point'),
                      click: clickPoints.length, need: pointsNeeded,
                    })}
                    {clickPoints.length > 0 && (
                      <button onClick={() => setClickPoints([])} style={{ color: C.red, marginLeft: 8, textDecoration: 'underline' }}>{t('clear')}</button>
                    )}
                    {ghostOutOfBoundsMessage && (
                      <span style={{ color: C.red, marginLeft: 8 }}>— {t(ghostOutOfBoundsMessage)}</span>
                    )}
                  </span>
                )}
              </div>
              {DEV_ROWS === 11 && (
                <p style={{ color: C.steel, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>
                  {t('Win ten times first, successfully pass the exam, and advance to the Lodar 15X10 level')}
                </p>
              )}
              <div className="flex gap-3 items-start">
                <div className="overflow-x-auto">
                  <ContainerGrid filledCells={filledYou} closedRows={closedYou} closedCols={closedYouCols} deadCells={deadYou} cellSize={24} rows={DEV_ROWS}
                    onCellHover={incomingFig && !gameOver ? (r, c) => setHoverCell({ r, c }) : undefined}
                    onCellLeave={() => setHoverCell(null)}
                    pieces={piecesYou}
                    onCellClick={incomingFig && !gameOver ? handleYourContainerClick : undefined}
                    ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
                </div>
                <ScorePanel myClosed={displayYouScore} oppClosed={displayOppScore} breakdown={`${closedYou.size}R · ${closedYouCols.size}C`} color={C.cyan} />
              </div>
            </div>

            <FigureBankPanel
              title={t('PICKED BY OPPONENT — view only, your 27')}
              panelColor={C.steelDim} itemColor={C.steel}
              getStatus={fig => ({
                used: usedForYou.has(fig.id), actionable: true,
                hint: usedForYou.has(fig.id) ? t('(already placed in your container)') : t('(still available for the opponent to assign you)'),
              })} />
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-stretch flex-1">
            <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-4 flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('OPPONENT CONTAINER — {n} closed · {diff}', { n: displayOppScore, diff: t(difficulty.charAt(0).toUpperCase() + difficulty.slice(1)) })}</span>
              </div>
              <div className="flex gap-3 items-start">
                <div className="overflow-x-auto">
                  <ContainerGrid filledCells={filledOpp} closedRows={closedOpp} closedCols={closedOppCols} deadCells={deadOpp} cellSize={18} rows={DEV_ROWS} pieces={piecesOpp} />
                </div>
                <ScorePanel myClosed={displayOppScore} oppClosed={displayYouScore} breakdown={`${closedOpp.size}R · ${closedOppCols.size}C`} color={C.steelDim} />
              </div>
            </div>

            <FigureBankPanel
              title={`${t('PICKED BY YOU — your own 27')}${requester === 'you' && !gameOver && !incomingFig ? t(' — click one to choose') : ''}`}
              panelColor={C.blue} itemColor={C.cyan} onSelect={requestForOpp}
              getStatus={fig => {
                const used = usedForOpp.has(fig.id)
                const actionable = requester === 'you' && !gameOver && !incomingFig && !used && fig.id !== lastRequestToYou
                const hint = used ? t('(already requested for the opponent)') : fig.id === lastRequestToYou ? t('(repeat-request blocked)') : !actionable ? t('(not your turn to request)') : ''
                return { used, actionable, hint }
              }} />
          </div>
        </div>

        <div className="flex flex-col gap-4 h-full">
          <div style={{ border: `1px solid ${C.steel}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('QUALIFICATION (TEST)')}</p>
            <select value={qualTierId} onChange={e => { setQualTierId(Number(e.target.value)); resetGame() }}
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.steel}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px' }}>
              {TIERS.map(tier => (
                <option key={tier.id} value={tier.id}>{tier.name} — {tier.id === 1 ? t('15×11 (training)') : t('15×10 (competitive)')}</option>
              ))}
            </select>
            <p style={{ color: C.steelDim, fontSize: 11, marginTop: 8 }}>
              {t('Container size follows qualification: UnderLodar plays 15×11 (row K exposed); Lodar and above play the standard 15×10. Changing this starts a new game.')}
            </p>
          </div>

          <div style={{ border: `1px solid ${C.blue}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('OPPONENT DIFFICULTY')}</p>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px' }}>
              <option value="easy">{t('Easy (~15% target win rate)')}</option>
              <option value="medium">{t('Medium (~30% target win rate)')}</option>
              <option value="hard">{t('Hard (~55% target win rate)')}</option>
            </select>
          </div>

          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>{t('WHO ENTERS FIRST')}</p>
            <button onClick={flipCoin} disabled={coinState === 'spinning' || requester != null}
              style={{ width: '100%', background: coinState === 'spinning' ? C.steelDim : C.cyan, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px', opacity: requester != null ? 0.4 : 1 }}
              className={coinState === 'spinning' ? 'animate-pulse' : ''}>
              {coinState === 'spinning' ? t('Flipping… (5s)') : requester != null ? t('Flipped') : t('Flip the coin')}
            </button>
          </div>

          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 flex-1 flex flex-col">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>{t('INCOMING CARGO')}</p>
            {incomingFig ? (
              <>
                <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
                  <FigurePreview cells={orientations[rotIdx % orientations.length] ?? incomingFig.cells} cardSize={90} color={C.cyan} cellPx={16} dots={incomingFig.dots} showNumber={false} />
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
              <p style={{ color: C.steelDim, fontSize: 12 }}>{t('Nothing requested yet.')}</p>
            )}
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>{t('Request notation, e.g. {ex}:', { ex: '07B9C10' })}</p>
            <div className="flex gap-2 mb-2">
              <input value={notation} onChange={e => setNotation(e.target.value)} disabled={!incomingFig || !!gameOver}
                placeholder={t('figure id + point(s)')}
                style={{ background: C.graphite, border: `1px solid ${C.blue}`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', flex: 1, outline: 'none', opacity: incomingFig ? 1 : 0.4 }} />
              <button onClick={submitPlacement} disabled={!incomingFig || !notation || !!gameOver}
                style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', opacity: incomingFig && notation && !gameOver ? 1 : 0.4 }}>SUBMIT</button>
            </div>
            {fairPlayOffer && (
              <div className="flex items-center gap-3 mb-2">
                <span style={{ color: C.red, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t('{pct}% unsupported', { pct: fairPlayOffer.pct })}</span>
                <button onClick={orderFairPlay} disabled={!!gameOver}
                  style={{ background: C.red, color: '#FFFFFF', fontWeight: 700, fontSize: 12, padding: '8px 14px', opacity: gameOver ? 0.4 : 1 }}>
                  {t('Order fair play')}
                </button>
              </div>
            )}
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 4 }}>{t('Response:')}</p>
            <input value={responseText} disabled readOnly
              style={{ width: '100%', background: C.graphite, border: `1px solid ${responseIsError ? C.red : C.steelDim}40`, color: responseIsError ? C.red : C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px' }} />
          </div>

        </div>
      </div>

      {/* LOG lives below the two-column grid, not inside the right-hand column: it's the
          one box that keeps growing as the game goes on, so it can no longer be the thing
          the OPPONENT CONTAINER row stretches to match (that was INCOMING CARGO, the last
          stable-sized box up there) — it gets a capped height with its own scroll instead,
          so neither it nor the layout above it grows no matter how long the log gets. */}
      <div className="max-w-7xl mx-auto px-4 pb-5">
        <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-5">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{t('LOG')}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <span style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }} title={t('Fair-play requests (TO_DO 44c): IN = received from the opponent, OUT = sent by you — approved/declined per the game protocol')}>
                {t('FAIR PLAY — IN {a}✓/{b}✗ · OUT {c}✓/{d}✗', { a: fairPlayIn.approved, b: fairPlayIn.declined, c: fairPlayOut.approved, d: fairPlayOut.declined })}
              </span>
              <button onClick={exportGameReportPdf} disabled={!moveRecords.length}
                style={{ color: moveRecords.length ? C.cyan : C.steelDim, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", textDecoration: 'underline', opacity: moveRecords.length ? 1 : 0.4, cursor: moveRecords.length ? 'pointer' : 'default' }}>
                {t('Export (PDF)')}
              </button>
              <button onClick={() => setShowInternals(s => !s)} style={{ color: C.steelDim, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", textDecoration: 'underline' }}>
                {showInternals ? t('hide engine internals') : t('show engine internals')}
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto pr-1">
            {log.map(entry => (
              <div key={entry.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ width: 3, alignSelf: 'stretch', background: logColor(entry.text), flexShrink: 0 }} />
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, flexShrink: 0 }}>
                  {new Date(entry.t).toLocaleTimeString([], { hour12: false })}
                </span>
                <span style={{ color: C.steel, fontSize: 11 }}>{entry.text}</span>
              </div>
            ))}
          </div>
          {showInternals && (
            <pre style={{ color: C.steelDim, fontSize: 10, marginTop: 8, whiteSpace: 'pre-wrap', borderTop: `1px solid ${C.steelDim}25`, paddingTop: 8 }}>
{JSON.stringify({ difficulty: engine.difficulty, targetWinRate: engine.targetWinRate, usedForYou: [...usedForYou], usedForOpp: [...usedForOpp], lastRequestToYou, lastRequestToOpp, requester }, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Language gate (TO_DO 28) ────────────────────────────────────────────────
// One-time question, raised by I18nProvider after IP country detection: the modal
// renders in the SUGGESTED language so the visitor reads exactly what they're offered.
const GEO_PROMPT_KEY: Record<Lang, string> = {
  EN: "Detected region: international. Switch viewing language to English?",
  RU: "Detected region: Russia. Switch viewing language to Russian?",
  BY: "Detected region: Belarus. Switch viewing language to Belarusian?",
}

function LanguageGateModal({ suggestion }: { suggestion: GeoSuggestion }) {
  const { acceptGeoSuggestion, dismissGeoSuggestion } = useLang()
  return (
    <div style={{ position: 'fixed', inset: 0, background: `${C.graphite}cc`, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}40`, padding: '28px 32px', maxWidth: 420, textAlign: 'center', boxShadow: `0 8px 32px ${C.graphite}c0` }}>
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.14em', marginBottom: 12 }}>{useLang().t('Language')}</p>
        <p style={{ color: C.deck, fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
          {useLang().t(GEO_PROMPT_KEY[suggestion.suggested])}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={acceptGeoSuggestion}
            style={{ background: C.cyan, color: C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 20px', border: 'none', cursor: 'pointer' }}>
            {useLang().t('Yes, switch')}
          </button>
          <button onClick={dismissGeoSuggestion}
            style={{ color: C.steel, border: `1px solid ${C.steelDim}60`, background: 'transparent', fontSize: 13, padding: '10px 20px', cursor: 'pointer' }}>
            {useLang().t('Keep current language')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  )
}

// AppShell — the former App() body, now under I18nProvider so every page can call
// useLang() (TO_DO 28). Page switching, Supabase session/profile handling unchanged.
function AppShell() {
  const { lang, t, geoSuggestion } = useLang()
  const [page, setPage] = useState<Page>(() => (getAuthRedirectType() === 'recovery' ? 'auth' : 'home'))
  // TO_DO 29 (music + news line): real background music and the public news
  // ticker. Music state is lifted from Nav so it survives page changes; the
  // track follows admin overrides from music_tracks (bundled themes as the
  // fallback) and the choice persists.
  const [musicOn, setMusicOn] = useState<boolean>(readStoredMusicOn)
  const { overrides: musicOverrides } = useMusicOverrides()
  useSiteMusic(resolveMusicSrc(page, musicOverrides), musicOn)
  const toggleMusic = (): void => setMusicOn(v => { storeMusicOn(!v); return !v })
  const { items: newsItems } = useActiveNews()
  // Captured once, like `page` above -- getAuthRedirectType() reads the URL hash live,
  // and Supabase's own client clears that hash once it finishes parsing the recovery
  // tokens from it, so recomputing this on every render would flip it back to false
  // right as the recovery session becomes ready (see AuthPage's recoveryMode usage).
  const [isRecoveryFlow] = useState(() => getAuthRedirectType() === 'recovery')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PuzzleStowProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileRefreshKey, setProfileRefreshKey] = useState(0)
  const isLoggedIn = !!session

  // One-time banner text for landing back here from a Supabase auth email (confirm
  // signup / email change). Password recovery gets its own dedicated AuthPage screen
  // instead (see `page` initializer + `recoveryMode` below), not a banner.
  const [authNotice, setAuthNotice] = useState<string | null>(() => {
    const type = getAuthRedirectType()
    if (type === 'signup') return authNoticeText('signup', lang)
    if (type === 'email_change') return authNoticeText('email_change', lang)
    return null
  })

  // Track the Supabase Auth session directly -- getSession() for whatever's already
  // in local storage on load, onAuthStateChange for every sign-in / sign-out / token
  // refresh after that (including the sign-in AuthPage itself triggers).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => sub.subscription.unsubscribe()
  }, [])

  // public.users is 1:1 with the session's auth user (item 11 migrations) -- load or
  // clear the profile row whenever the session changes. Tracks loading/error separately
  // from "no row yet" so ProfilePage can show a spinner or a retry instead of silently
  // rendering blank fields while the fetch is still in flight or failed.
  //
  // PGRST116 ("Cannot coerce the result to a single JSON object") here means RLS returned
  // zero rows for this exact id -- direct testing against the DB confirms the row and the
  // `auth.uid() = id` policy are both fine, so in practice this has only shown up as a
  // transient client-side desync (e.g. supabase-js hadn't finished attaching the current
  // access token yet, or it rotated in another tab a moment earlier). Re-check the session
  // and retry once before surfacing the raw error to the user.
  useEffect(() => {
    if (!session) { setProfile(null); setProfileError(null); setProfileLoading(false); return }
    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)
    const load = async (alreadyRetried: boolean) => {
      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (cancelled) return
      if (error) {
        if (!alreadyRetried && error.code === 'PGRST116') {
          const { data: fresh } = await supabase.auth.getSession()
          if (!cancelled && fresh.session) { await load(true); return }
        }
        setProfileLoading(false)
        setProfileError(error.message)
        return
      }
      setProfileLoading(false)
      setProfile((data as PuzzleStowProfile) ?? null)
    }
    load(false)
    return () => { cancelled = true }
  }, [session, profileRefreshKey])

  // There's no router — Page is just a state switch — so nothing else resets scroll when
  // it changes. Without this, navigating away from a scrolled-down page (e.g. clicking a
  // nav link partway down the homepage) lands the next page mid-scroll: content and click
  // targets can end up shifted under the fixed header, or off-screen entirely.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  if (page === 'auth') {
    return (
      <AuthPage
        onAuth={() => {}}
        setPage={(p: Page) => setPage(p)}
        recoveryMode={isRecoveryFlow}
      />
    )
  }

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: newsItems.length > 0 ? TICKER_HEIGHT : 0 }}>
      <Nav page={page} setPage={setPage} isLoggedIn={isLoggedIn} isAdmin={profile?.role === 'Administrator'} onSignOut={() => { supabase.auth.signOut(); setPage('home') }} musicOn={musicOn} onToggleMusic={toggleMusic} />
      <NewsTicker items={newsItems} />
      {authNotice && (
        <div style={{ background: `${C.cyan}18`, borderBottom: `1px solid ${C.cyan}40`, color: C.cyan, fontSize: 13, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
          <span>{authNotice}</span>
          <button onClick={() => setAuthNotice(null)} style={{ color: C.cyan, fontSize: 16, lineHeight: 1, position: 'absolute', right: 16 }} aria-label="Dismiss">×</button>
        </div>
      )}
      {page === 'home'      && <HomePage setPage={setPage} />}
      {page === 'figures'   && <FiguresPage />}
      {page === 'rules'     && <RulesPage />}
      {page === 'lore'      && <LorePage />}
      {page === 'play'      && <PlayPage mode="rated" />}
      {page === 'practice'  && (isLoggedIn
        ? <PracticePage />
        : <GatedPreview title={t('Sign in to play Practice')} blurb={t('Practice runs against the built-in algorithmic engine — unrated, for training. Sign in to unlock it.')}
            features={[t('An unrated match against the algorithmic engine, at your chosen difficulty'), t('The same rules and validation as a real match, with nothing at stake'), t('A live log of every move, with PDF export when the match ends')]}
            setPage={setPage}><PracticePage /></GatedPreview>)}
      {page === 'sandbox'   && (isLoggedIn
        ? <SandboxPage setPage={setPage} />
        : <GatedPreview title={t('Sign in to use the Sandbox')} blurb={t('Free placement, rule highlights, and a step-by-step tutorial — sign in to start experimenting.')}
            features={[t('A 4-step guided tutorial: your first placement, notation, and the step-height rule explained live'), t('Free placement of all 27 figures afterward, with no limits or scoring'), t('Toggleable highlights for every placement rule (support, steps, overhang, return path)')]}
            setPage={setPage}><SandboxPreview /></GatedPreview>)}
      {page === 'printplay' && <PrintPlayPage />}
      {page === 'profile'   && <ProfilePage session={session} profile={profile} onProfileUpdated={setProfile} profileLoading={profileLoading} profileError={profileError} onRetryProfile={() => setProfileRefreshKey(k => k + 1)} />}
      {page === 'devtest'   && <DevTestPage />}
      {page === 'admin'     && <AdminPage session={session} profile={profile} />}
      {geoSuggestion && <LanguageGateModal suggestion={geoSuggestion} />}
    </div>
  )
}

/** Localized text for the one-time Supabase email-confirmation banner (AppShell). */
function authNoticeText(kind: 'signup' | 'email_change', lang: Lang): string {
  if (kind === 'signup') return translate(lang, "Email confirmed — you are now signed in.")
  return translate(lang, "Email address confirmed.")
}
