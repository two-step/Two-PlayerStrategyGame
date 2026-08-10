import { useState } from 'react'

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  graphite: '#1C1F26',
  graphite2: '#22262f',
  graphite3: '#2a2f3a',
  blue: '#1F4F82',
  blueLight: '#2563a8',
  cyan: '#1FA7A3',
  cyanDim: 'rgba(31,167,163,0.15)',
  deck: '#F5F7FA',
  steel: '#A3A9B5',
  steelDim: '#4b5162',
  green: '#3BB273',
  red: '#D6456F',
} as const

type Page = 'home' | 'figures' | 'rules' | 'lore' | 'play' | 'profile'
type Cells = [number, number][]

interface Figure {
  id: number
  name: string
  label: string
  cells: Cells
  size: number
}

// ── 27 Figures (source: otgruzka_figures.json, confirmed geometry) ────────────
const FIGURES: Figure[] = [
  { id:  1, name: 'Mono',        label: 'F01', size: 1, cells: [[0,0]] },
  { id:  2, name: 'Domino',      label: 'F02', size: 2, cells: [[0,0],[0,1]] },
  { id:  3, name: 'Tromino-I',   label: 'F03', size: 3, cells: [[0,0],[0,1],[0,2]] },
  { id:  4, name: 'Tetromino-I', label: 'F04', size: 4, cells: [[0,0],[0,1],[0,2],[0,3]] },
  { id:  5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { id:  6, name: 'Tromino-L',   label: 'F06', size: 3, cells: [[0,0],[1,0],[1,1]] },
  { id:  7, name: 'Tetromino-O', label: 'F07', size: 4, cells: [[0,0],[0,1],[1,0],[1,1]] },
  { id:  8, name: 'Tetromino-L', label: 'F08', size: 4, cells: [[0,0],[1,0],[2,0],[2,1]] },
  { id:  9, name: 'Tetromino-J', label: 'F09', size: 4, cells: [[0,1],[1,1],[2,0],[2,1]] },
  { id: 10, name: 'Pentomino-F', label: 'F10', size: 5, cells: [[0,1],[0,2],[1,1],[2,0],[2,1]] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]] },
  { id: 12, name: 'Tetromino-S', label: 'F12', size: 4, cells: [[0,1],[0,2],[1,0],[1,1]] },
  { id: 13, name: 'Tetromino-Z', label: 'F13', size: 4, cells: [[0,0],[0,1],[1,1],[1,2]] },
  { id: 14, name: 'Tetromino-T', label: 'F14', size: 4, cells: [[0,1],[1,0],[1,1],[1,2]] },
  { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]] },
  { id: 16, name: 'Pentomino-X', label: 'F16', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { id: 17, name: 'Pentomino-V', label: 'F17', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[2,0]] },
  { id: 18, name: 'Hexomino-C',  label: 'F18', size: 6, cells: [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2]] },
  { id: 19, name: 'Hexomino-B',  label: 'F19', size: 6, cells: [[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]] },
  { id: 20, name: 'Pentomino-N', label: 'F20', size: 5, cells: [[0,1],[0,2],[1,0],[1,1],[2,0]] },
  { id: 21, name: 'Pentomino-R', label: 'F21', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,2]] },
  { id: 22, name: 'Pentomino-Y', label: 'F22', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,0]] },
  { id: 23, name: 'Hexomino-H',  label: 'F23', size: 6, cells: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,2]] },
  { id: 24, name: 'Pentomino-T', label: 'F24', size: 5, cells: [[0,1],[1,1],[2,0],[2,1],[2,2]] },
  { id: 25, name: 'Heptomino-H', label: 'F25', size: 7, cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]] },
  { id: 26, name: 'Hexomino-P',  label: 'F26', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,1],[1,3]] },
  { id: 27, name: 'Hexomino-Q',  label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]] },
]

// ── Qualification tiers (source: PairSec_Спецификация_Final_2026.docx §7.1.6) ─
const TIERS = [
  { id: 1, name: 'UnderLodar',    abbr: 'UL', color: C.steel,    desc: 'Entry level. Learning the rules and all 27 figures.' },
  { id: 2, name: 'Lodar',         abbr: 'Ld', color: C.blue,     desc: 'Understands basic placement and support rules.' },
  { id: 3, name: 'MidLod',        abbr: 'ML', color: C.cyan,     desc: 'Applies overhang and step rules. May create leagues.' },
  { id: 4, name: 'Senior Lodar',  abbr: 'SLd', color: '#2abfbb', desc: 'Reads opponent strategy. Consistent path management.' },
  { id: 5, name: 'LeadLod',       abbr: 'LL', color: C.green,    desc: 'Exploits row-closure combinations. Tournament-ready.' },
  { id: 6, name: 'MasterLod',     abbr: 'Mr', color: '#a3e8c8',  desc: 'Top 5% of rated players.' },
  { id: 7, name: 'ProfiLod',      abbr: 'PL', color: C.deck,     desc: 'Highest tier. Consulting and Judge roles on PairSec.' },
]

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Is PuzzleStow the same as Tetris?',
    a: "No. The only similarity is a rectangular container. PuzzleStow has 27 fixed figures (not 7), rows close in both horizontal and vertical directions, and — most importantly — your opponent chooses which figure you must place. At UnderLodar and Lodar tier there is no time pressure; from MidLod upward, timers and request limits apply (T=7/5/3 min, Li=1/2/3 requests per match).",
  },
  {
    q: 'Can I use AI hints during a rated match?',
    a: "Never. There is no AI move-advisor in rated play — not free, not as a premium feature. Your Lodar qualification reflects your actual thinking, not tool access. Practice and Sandbox modes offer an AI opponent for unrated training only, and are visually distinct from rated play.",
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
    a: "PairSec is a platform for skilled workers. Your in-game loader persona ties directly to the \"Грузанём!\" service there. MidLod and above can convert qualification into performer status. Visit pairsec.com for details.",
  },
  {
    q: 'How does the fair-play overhang exception work?',
    a: "By default, more than 50% of a piece's area may not be unsupported after placement. When a move would exceed this threshold, both players must explicitly confirm via an in-game bilateral modal before the exception is applied. It is never automatic, never one-sided, and the exceptional move is logged in match history.",
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

// ── FigurePreview ─────────────────────────────────────────────────────────────
// All cells render at the same fixed pixel size — uniform across all figures.
const CELL_PX = 14

function FigurePreview({ cells, cardSize = 72, color = C.cyan, cellPx = CELL_PX }: {
  cells: Cells; cardSize?: number; color?: string; cellPx?: number
}) {
  if (!cells.length) return null
  const rows = cells.map(([r]) => r)
  const cols = cells.map(([, c]) => c)
  const minR = Math.min(...rows), maxR = Math.max(...rows)
  const minC = Math.min(...cols), maxC = Math.max(...cols)
  const numR = maxR - minR + 1, numC = maxC - minC + 1
  const figW = numC * cellPx, figH = numR * cellPx
  const ox = (cardSize - figW) / 2
  const oy = (cardSize - figH) / 2
  return (
    <svg width={cardSize} height={cardSize} style={{ display: 'block', flexShrink: 0 }}>
      {cells.map(([r, c], i) => (
        <rect key={i}
          x={ox + (c - minC) * cellPx + 0.75}
          y={oy + (r - minR) * cellPx + 0.75}
          width={cellPx - 1.5} height={cellPx - 1.5}
          fill={`${color}18`} stroke={color} strokeWidth={1.5} rx={0}
        />
      ))}
    </svg>
  )
}

// ── Container Grid SVG ────────────────────────────────────────────────────────
// Layout: column labels 0–14 along the bottom; row labels A–K (or A–J) on the right.
// Row A is the bottom row (base/floor, entry A0). Row labels read bottom → top.
// showJKSeparator: draws a bold line between row J and row K (training boundary).
const ROW_LABELS = 'ABCDEFGHIJK'

function ContainerGrid({
  filledCells,
  closedRows = new Set(),
  cellSize = 22,
  rows = 11,
  showJKSeparator = false,
}: {
  filledCells: Set<string>
  closedRows?: Set<number>
  cellSize?: number
  rows?: number
  showJKSeparator?: boolean
}) {
  const COLS = 15
  const RL = 26  // right label area width
  const BH = 20  // bottom label area height
  const W = COLS * cellSize + RL
  const H = rows * cellSize + BH
  // visual row r → label index: A at bottom (r = rows-1), top row = ROW_LABELS[rows-1]
  const labelFor = (r: number) => ROW_LABELS[rows - 1 - r]
  // J/K separator: between visual row r=0 (top = K) and r=1 (J), at y = cellSize
  const jkSepY = cellSize  // bottom edge of the K row

  return (
    <svg width={W} height={H} style={{ fontFamily: "'JetBrains Mono', monospace", display: 'block' }}>
      {/* cells */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const key = `${r},${c}`
          const filled = filledCells.has(key)
          const closed = closedRows.has(r)
          const entry = r === rows - 1 && c === 0
          const fill = closed && filled ? `${C.green}28` : filled ? `${C.blue}40` : entry ? `${C.cyan}20` : 'transparent'
          const stroke = closed && filled ? C.green : filled ? `${C.blue}cc` : entry ? C.cyan : `${C.cyan}1a`
          const sw = filled ? 1.5 : 0.5
          return (
            <rect key={key}
              x={c * cellSize + 0.5} y={r * cellSize + 0.5}
              width={cellSize - 1} height={cellSize - 1}
              fill={fill} stroke={stroke} strokeWidth={sw}
            />
          )
        })
      )}
      {/* J/K training boundary separator */}
      {showJKSeparator && rows === 11 && (
        <line
          x1={0} y1={jkSepY} x2={COLS * cellSize} y2={jkSepY}
          stroke={C.cyan} strokeWidth={2} strokeDasharray="4 3" opacity={0.7}
        />
      )}
      {/* entry point dot — A0 is bottom-left */}
      <circle cx={cellSize / 2} cy={(rows - 1) * cellSize + cellSize / 2} r={2.5} fill={C.cyan} />
      {/* row labels A–(J or K) on the RIGHT — A at bottom */}
      {Array.from({ length: rows }, (_, r) => (
        <text key={r}
          x={COLS * cellSize + 5} y={r * cellSize + cellSize / 2 + 3}
          textAnchor="start" fontSize={8}
          fill={r === rows - 1 ? C.cyan : C.steelDim}>{labelFor(r)}</text>
      ))}
      {/* column labels 0–14 along the BOTTOM */}
      {Array.from({ length: COLS }, (_, c) => (
        <text key={c}
          x={c * cellSize + cellSize / 2} y={rows * cellSize + BH - 5}
          textAnchor="middle" fontSize={8} fill={C.steelDim}>{c}</text>
      ))}
    </svg>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [open, setOpen] = useState(false)
  const links: { label: string; p: Page }[] = [
    { label: 'Figures', p: 'figures' },
    { label: 'Rules', p: 'rules' },
    { label: 'Lore', p: 'lore' },
  ]
  return (
    <nav style={{ background: `${C.graphite}f0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.cyan}22` }}
      className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <button onClick={() => setPage('home')} className="flex items-center gap-3">
          <div style={{ background: C.cyan }} className="w-7 h-7 flex items-center justify-center">
            <GridIcon size={14} color={C.graphite} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.deck, letterSpacing: '0.06em' }}
            className="text-sm font-medium">PUZZLESTOW</span>
        </button>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <button key={l.p} onClick={() => setPage(l.p)}
              style={{ color: page === l.p ? C.cyan : C.steel }}
              className="text-sm font-medium transition-colors hover:text-white">{l.label}</button>
          ))}
          <button onClick={() => setPage('profile')}
            style={{ color: page === 'profile' ? C.cyan : C.steel }}
            className="text-sm font-medium transition-colors hover:text-white">Profile</button>
          <button onClick={() => setPage('play')}
            style={{ background: C.blue, color: C.deck }}
            className="text-sm font-semibold px-4 py-1.5 hover:brightness-110 transition-all">
            Play
          </button>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} style={{ color: C.steel }}>
          <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5}>
            {open
              ? <><line x1={4} y1={4} x2={16} y2={16}/><line x1={16} y1={4} x2={4} y2={16}/></>
              : <><line x1={3} y1={6} x2={17} y2={6}/><line x1={3} y1={10} x2={17} y2={10}/><line x1={3} y1={14} x2={17} y2={14}/></>
            }
          </svg>
        </button>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${C.cyan}22`, background: C.graphite2 }}
          className="md:hidden px-6 py-4 flex flex-col gap-4">
          {links.map(l => (
            <button key={l.p} onClick={() => { setPage(l.p); setOpen(false) }}
              style={{ color: page === l.p ? C.cyan : C.steel }}
              className="text-sm font-medium text-left">{l.label}</button>
          ))}
          <button onClick={() => { setPage('profile'); setOpen(false) }}
            style={{ color: page === 'profile' ? C.cyan : C.steel }}
            className="text-sm font-medium text-left">Profile</button>
          <button onClick={() => { setPage('play'); setOpen(false) }}
            style={{ background: C.blue, color: C.deck }}
            className="text-sm font-semibold px-4 py-2 self-start">Play</button>
        </div>
      )}
    </nav>
  )
}

// ── Small icons ───────────────────────────────────────────────────────────────
function GridIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5}>
      <rect x={1} y={1} width={6} height={6} /><rect x={9} y={1} width={6} height={6} />
      <rect x={1} y={9} width={6} height={6} /><rect x={9} y={9} width={6} height={6} />
    </svg>
  )
}

// ── Hero game state (15×11, rows A–K) ─────────────────────────────────────────
function buildHeroCells() {
  const s = new Set<string>()
  // visual row 10 = A (bottom), row 9 = B, row 0 = K (top)
  for (let c = 0; c < 15; c++) s.add(`10,${c}`)        // row A — full, closed
  for (let c = 0; c <= 4; c++) s.add(`9,${c}`)          // row B — left
  for (let c = 7; c <= 14; c++) s.add(`9,${c}`)         // row B — right
  for (let c = 0; c <= 3; c++) s.add(`8,${c}`)          // row C — left
  for (let c = 11; c <= 14; c++) s.add(`8,${c}`)        // row C — right
  s.add('7,0'); s.add('7,1'); s.add('7,13'); s.add('7,14')
  return s
}
const HERO_CELLS = buildHeroCells()
const HERO_CLOSED = new Set([10])  // visual row 10 = A

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [hoveredTier, setHoveredTier] = useState<number | null>(null)

  const blueprintBg = {
    backgroundImage: `
      linear-gradient(rgba(31,167,163,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(31,167,163,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '24px 24px',
  }

  return (
    <div style={{ background: C.graphite }}>
      {/* ── Hero ── */}
      <section style={{ ...blueprintBg, minHeight: '100vh', paddingTop: '3.5rem' }}
        className="relative flex items-center overflow-hidden">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: `${C.cyan}50`, fontSize: 10 }}
          className="absolute top-20 left-6 hidden md:block">A0</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: `${C.cyan}50`, fontSize: 10 }}
          className="absolute top-20 right-6 hidden md:block">A14</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: `${C.cyan}50`, fontSize: 10 }}
          className="absolute bottom-6 left-6 hidden md:block">K0</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: `${C.cyan}50`, fontSize: 10 }}
          className="absolute bottom-6 right-6 hidden md:block">K14</span>

        <div className="max-w-7xl mx-auto px-6 py-20 w-full grid md:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
              className="mb-6 flex items-center gap-3">
              <span style={{ background: C.cyan }} className="inline-block w-6 h-px" />
              TWO-PLAYER STRATEGY / PERFECT INFORMATION
            </div>
            <h1 style={{ color: C.deck, lineHeight: 1.1 }} className="text-4xl md:text-5xl font-bold mb-4">
              You don't choose<br />
              <span style={{ color: C.cyan }}>your cargo.</span><br />
              Your opponent does.
            </h1>
            <p style={{ color: C.steel }} className="text-base leading-relaxed mb-8 max-w-md">
              PuzzleStow is a strategy game of perfect information. 27 fixed figures, sizes 1 to 7 cells.
              A 15×10 container. Your opponent selects which piece you must place next —
              and you must make it work.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <button onClick={() => setPage('play')}
                style={{ background: C.cyan, color: C.graphite, fontWeight: 600 }}
                className="px-6 py-3 text-sm hover:brightness-110 transition-all">
                Play Rated
              </button>
              <button style={{ background: 'transparent', color: C.deck, border: `1px solid ${C.blue}` }}
                className="px-6 py-3 text-sm hover:bg-blue-900/20 transition-all">
                Practice
              </button>
              <button style={{ color: C.steel, border: `1px solid ${C.steelDim}` }}
                className="px-6 py-3 text-sm hover:border-steel hover:text-deck transition-all">
                Sandbox
              </button>
            </div>
            <div style={{ borderLeft: `2px solid ${C.blue}`, paddingLeft: 16 }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                SAMPLE MOVE NOTATION
              </p>
              <code style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>
                07B9C10
              </code>
              <span style={{ color: C.steelDim, fontSize: 12 }} className="ml-3">figure 7, placed B9→C10</span>
            </div>
          </div>

          {/* Right — Container Grid 15×11 with J/K separator */}
          <div className="flex flex-col items-center md:items-end gap-4">
            <div style={{ border: `1px solid ${C.cyan}28`, padding: 16, background: C.graphite2 }}
              className="relative overflow-hidden">
              <div style={{ position: 'absolute', top: 8, left: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: `${C.cyan}70`, letterSpacing: '0.12em' }}>
                CONTAINER 15×11 — TRAINING VIEW
              </div>
              <div style={{ marginTop: 16 }}>
                <ContainerGrid
                  filledCells={HERO_CELLS}
                  closedRows={HERO_CLOSED}
                  cellSize={21}
                  rows={11}
                  showJKSeparator={true}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs w-full justify-end">
              <span className="flex items-center gap-2" style={{ color: C.green }}>
                <span style={{ background: C.green }} className="inline-block w-3 h-3" />
                Row A closed
              </span>
              <span className="flex items-center gap-2" style={{ color: C.steel }}>
                <span style={{ background: `${C.blue}cc`, border: `1px solid ${C.blue}` }} className="inline-block w-3 h-3" />
                Placed
              </span>
              <span className="flex items-center gap-2" style={{ color: C.cyan }}>
                <span style={{ background: C.cyan }} className="inline-block w-2 h-2 rounded-full" />
                Entry A0
              </span>
            </div>
            {/* J/K separator tooltip */}
            <div style={{ border: `1px solid ${C.cyan}30`, background: `${C.graphite2}cc`, padding: '8px 14px', fontSize: 12, color: C.steelDim, maxWidth: 380 }}>
              <span style={{ color: C.cyan }}>— — —</span>
              {' '}This extra row is yours while you're learning to stack. Once you've got it, you'll play on 15×10 like everyone else — and this line becomes the ceiling.
            </div>
            <div style={{ border: `1px solid ${C.blue}55`, padding: '8px 14px', background: `${C.blue}18` }}
              className="flex items-center gap-4 w-full">
              <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>INCOMING</span>
              <FigurePreview cells={FIGURES[13].cells} cardSize={36} color={C.cyan} />
              <span style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>F14 — chosen by opponent</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Twist ── */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18`, borderBottom: `1px solid ${C.cyan}18` }}
        className="py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
            className="mb-5">WHAT MAKES IT DIFFERENT</p>
          <h2 style={{ color: C.deck, lineHeight: 1.2 }} className="text-3xl md:text-4xl font-bold mb-6">
            Strategy. Geometry. Honest play.
          </h2>
          <p style={{ color: C.steel }} className="text-base max-w-2xl mx-auto leading-relaxed">
            Most games let you choose your own moves. PuzzleStow inverts this —
            your opponent selects the piece that enters your container, and you must place it legally.
            Perfect information means both players see everything. No fog of war. No luck.
            Only geometry and foresight.
          </p>
        </div>
      </section>

      {/* ── Four Rules ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
              className="mb-3">HOW IT WORKS</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">Four rules govern every move</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                rule: '01', name: 'Support', color: C.cyan, icon: SupportIcon,
                desc: 'No piece may float. It must rest on the base row A or on an already-placed piece.',
              },
              {
                rule: '02', name: 'Steps', color: C.blue, icon: StepsIcon,
                desc: 'A step between adjacent columns must not exceed 3 cells height.',
              },
              {
                rule: '03', name: 'Overhang', color: '#7c9dbf', icon: OverhangIcon,
                desc: 'More than 50% of a piece\'s area may not be unsupported by default. Exceeding this threshold requires the bilateral fair-play exception.',
              },
              {
                rule: '04', name: 'Return Path', color: C.green, icon: PathIcon,
                desc: 'After placing a piece, a passable path back to exit A0 must remain open.',
              },
            ].map(({ rule, name, color, desc, icon: Icon }) => (
              <div key={rule}
                style={{ border: `1px solid ${color}30`, background: C.graphite2 }}
                className="p-6 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em' }}>{rule}</span>
                  <Icon color={color} />
                </div>
                <h3 style={{ color: C.deck }} className="text-lg font-semibold mb-3">{name}</h3>
                <p style={{ color: C.steel }} className="text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Figures Preview ── */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18` }} className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
                className="mb-3">FIGURE CATALOG</p>
              <h2 style={{ color: C.deck }} className="text-2xl font-semibold">27 distinct figures</h2>
              <p style={{ color: C.steel }} className="text-sm mt-2">Sizes 1 to 7 cells — each with up to 4 orientations.</p>
            </div>
            <button onClick={() => setPage('figures')}
              style={{ color: C.cyan, border: `1px solid ${C.cyan}40`, fontFamily: "'JetBrains Mono', monospace" }}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-xs hover:bg-cyan-900/10 transition-all">
              View all 27 →
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
            {FIGURES.slice(0, 18).map(fig => (
              <div key={fig.id}
                style={{ border: `1px solid ${C.cyan}22`, background: C.graphite, cursor: 'pointer' }}
                className="aspect-square flex flex-col items-center justify-center gap-1 hover:border-lodar-cyan/60 transition-all p-1"
                onClick={() => setPage('figures')}>
                <FigurePreview cells={fig.cells} cardSize={52} color={C.cyan} />
                <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }}>{fig.label}</span>
              </div>
            ))}
            <button onClick={() => setPage('figures')}
              style={{ border: `1px dashed ${C.blue}60`, background: `${C.blue}10` }}
              className="aspect-square col-span-3 sm:col-span-1 flex flex-col items-center justify-center gap-2 hover:bg-blue-900/20 transition-all">
              <span style={{ color: C.blue, fontSize: 22, lineHeight: 1 }}>+9</span>
              <span style={{ color: C.steelDim, fontSize: 10 }}>more</span>
            </button>
          </div>
          <div className="mt-6 md:hidden">
            <button onClick={() => setPage('figures')}
              style={{ color: C.cyan, border: `1px solid ${C.cyan}40` }}
              className="px-4 py-2 text-xs">View all 27 figures →</button>
          </div>
        </div>
      </section>

      {/* ── Qualification Path ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
              className="mb-3">QUALIFICATION</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold">The Lodar Path</h2>
            <p style={{ color: C.steel }} className="text-sm mt-2 max-w-xl">
              Seven tiers of verified ability, earned through rated play alone. No shortcuts, no purchases, no AI.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {TIERS.map(tier => (
              <div key={tier.id}
                style={{
                  border: `1px solid ${hoveredTier === tier.id ? tier.color : `${tier.color}30`}`,
                  background: hoveredTier === tier.id ? `${tier.color}12` : C.graphite2,
                  transition: 'all 0.2s',
                }}
                className="p-4"
                onMouseEnter={() => setHoveredTier(tier.id)}
                onMouseLeave={() => setHoveredTier(null)}>
                <div style={{ background: tier.color, width: 28, height: 28, marginBottom: 12 }}
                  className="flex items-center justify-center">
                  <span style={{ color: C.graphite, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {tier.abbr}
                  </span>
                </div>
                <p style={{ color: tier.color, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{tier.name}</p>
                <p style={{ color: C.steelDim, fontSize: 11, lineHeight: 1.5 }}>{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── No AI Section ── */}
      <section style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18`, borderBottom: `1px solid ${C.cyan}18` }}
        className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div style={{ borderLeft: `3px solid ${C.cyan}` }} className="pl-8">
            <blockquote style={{ color: C.deck, lineHeight: 1.3 }}
              className="text-2xl md:text-3xl font-semibold mb-6">
              "Qualification is your real level of thinking —<br />
              <span style={{ color: C.cyan }}>not access to a hint."</span>
            </blockquote>
            <p style={{ color: C.steel }} className="text-base leading-relaxed mb-6 max-w-2xl">
              There is no AI move-advisor anywhere in rated play. Not free. Not premium. Not ever.
              This is a deliberate, permanent product decision — not a missing feature.
              Practice and Sandbox modes offer AI opponents for unrated training only,
              and are clearly separated from the rated experience at all times.
            </p>
            <p style={{ color: C.steelDim, fontSize: 13 }}>
              If you come from chess or Go and are tired of engine-assisted ratings,
              PuzzleStow is built for you.
            </p>
          </div>
        </div>
      </section>

      {/* ── Game Modes ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
            className="mb-3">GAME MODES</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-10">Three ways to play</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Rated Play', tag: 'TOURNAMENT', color: C.cyan, border: C.cyan,
                badge: 'Affects rating', badgeColor: C.cyan,
                desc: 'Two players on a 15×10 container (rows A–J). Your opponent picks your piece. Server-confirmed rules. Results affect your Lodar qualification.',
                containerLabel: '15×10',
              },
              {
                name: 'Practice', tag: 'UNRATED', color: '#7c9dbf', border: C.blue,
                badge: 'No rating effect', badgeColor: C.steelDim,
                desc: 'Play against an AI opponent on a 15×10 container, mirroring the real game mechanic. Unrated — results do not affect qualification.',
                containerLabel: '15×10',
              },
              {
                name: 'Sandbox', tag: 'FREE', color: C.steel, border: C.steelDim,
                badge: 'No rating effect', badgeColor: C.steelDim,
                desc: 'Free placement on the 15×11 training container (rows A–K). Toggle rule highlights on or off. The bold J/K line marks the competitive ceiling.',
                containerLabel: '15×11 + J/K line',
              },
            ].map(mode => (
              <div key={mode.name} style={{ border: `1px solid ${mode.border}35`, background: C.graphite2 }}
                className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: mode.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em' }}>
                    {mode.tag}
                  </span>
                  <span style={{ background: `${mode.badgeColor}20`, color: mode.badgeColor, fontSize: 10, padding: '2px 8px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {mode.badge}
                  </span>
                </div>
                <h3 style={{ color: C.deck }} className="text-xl font-semibold">{mode.name}</h3>
                <p style={{ color: C.steel }} className="text-sm leading-relaxed flex-1">{mode.desc}</p>
                <div className="flex items-center justify-between">
                  <span style={{ color: mode.color, border: `1px solid ${mode.border}40`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '2px 8px' }}>
                    {mode.containerLabel}
                  </span>
                  <button style={{ color: mode.color, border: `1px solid ${mode.border}50` }}
                    className="text-xs px-4 py-2 hover:bg-white/5 transition-all">
                    Enter →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PairSec Bridge ── */}
      <section style={{ background: `${C.blue}22`, borderTop: `1px solid ${C.blue}50`, borderBottom: `1px solid ${C.blue}50` }}
        className="py-16">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
              className="mb-3">FROM THE GAME TO REAL WORK</p>
            <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-4">
              Your loader persona connects to PairSec
            </h2>
            <p style={{ color: C.steel }} className="text-sm leading-relaxed mb-6">
              The in-game "loader / грузчик" identity ties directly to the "Грузанём!" service on PairSec.
              MidLod qualification and above converts into verified performer status on the platform.
            </p>
            <a href="https://pairsec.com" target="_blank" rel="noopener noreferrer"
              style={{ color: C.cyan, border: `1px solid ${C.cyan}50` }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm hover:bg-cyan-900/10 transition-all">
              What is PairSec →
            </a>
          </div>
          <div style={{ border: `1px solid ${C.blue}50`, background: `${C.graphite}80`, padding: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.steelDim, marginBottom: 16, letterSpacing: '0.1em' }}>
              QUALIFICATION BRIDGE
            </div>
            {[
              { from: 'UnderLodar – Lodar', to: 'PairSec observer', active: false },
              { from: 'MidLod+', to: '"Грузанём!" performer listing', active: true },
              { from: 'LeadLod+', to: 'Verified specialist badge', active: true },
              { from: 'ProfiLod', to: 'Judge / Consultant bookings', active: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-4 py-2.5"
                style={{ borderBottom: i < 3 ? `1px solid ${C.cyan}12` : 'none' }}>
                <span style={{ color: row.active ? C.cyan : C.steelDim, fontSize: 12, minWidth: 160, fontFamily: "'JetBrains Mono', monospace" }}>
                  {row.from}
                </span>
                <span style={{ color: C.steelDim, fontSize: 12 }}>→</span>
                <span style={{ color: row.active ? C.deck : C.steelDim, fontSize: 12 }}>{row.to}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
            className="mb-3">FAQ</p>
          <h2 style={{ color: C.deck }} className="text-2xl font-semibold mb-10">Common questions</h2>
          <div style={{ borderTop: `1px solid ${C.cyan}18` }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.cyan}18` }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left gap-6">
                  <span style={{ color: C.deck }} className="text-sm font-medium">{item.q}</span>
                  <span style={{ color: C.cyan, fontSize: 20, lineHeight: 1, flexShrink: 0, transition: 'transform 0.2s',
                    transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {faqOpen === i && (
                  <p style={{ color: C.steel }} className="text-sm leading-relaxed pb-5">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: C.graphite2, borderTop: `1px solid ${C.cyan}18` }} className="py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div style={{ background: C.cyan }} className="w-7 h-7 flex items-center justify-center">
                  <GridIcon size={14} color={C.graphite} />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.deck, letterSpacing: '0.06em' }}
                  className="text-sm font-medium">PUZZLESTOW</span>
              </div>
              <p style={{ color: C.steelDim, fontSize: 13, lineHeight: 1.6, maxWidth: 320 }}>
                Digital version of "Отгрузка" (Shipload). A strategy game for people who think.
              </p>
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}
                className="mb-4">NAVIGATE</p>
              {['Play', 'Figures', 'Rules', 'Lore', 'Print & Play'].map(l => (
                <p key={l} style={{ color: C.steelDim, fontSize: 13 }} className="mb-2 hover:text-deck cursor-pointer transition-colors">{l}</p>
              ))}
            </div>
            <div>
              <p style={{ color: C.steel, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}
                className="mb-4">COMMUNITY</p>
              {['Leagues', 'Tournaments', 'Telegram', 'YouTube'].map(l => (
                <p key={l} style={{ color: C.steelDim, fontSize: 13 }} className="mb-2 hover:text-deck cursor-pointer transition-colors">{l}</p>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.cyan}12` }} className="pt-6 flex flex-wrap items-center justify-between gap-4">
            <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              puzzlestow.com — 2026
            </span>
            <div className="flex gap-6">
              {['EN', 'RU'].map(lang => (
                <button key={lang}
                  style={{ color: lang === 'EN' ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                  className="hover:text-deck transition-colors">{lang}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Rule icons ─────────────────────────────────────────────────────────────────
function SupportIcon({ color = C.cyan }: { color?: string }) {
  return (
    <svg width={28} height={28} fill="none" stroke={color} strokeWidth={1.5}>
      <rect x={4} y={12} width={8} height={8} /><rect x={16} y={18} width={8} height={6} />
      <line x1={4} y1={12} x2={4} y2={24} /><line x1={4} y1={24} x2={24} y2={24} />
      <rect x={8} y={6} width={8} height={6} />
    </svg>
  )
}
function StepsIcon({ color = C.blue }: { color?: string }) {
  return (
    <svg width={28} height={28} fill="none" stroke={color} strokeWidth={1.5}>
      <polyline points="4,22 4,16 10,16 10,10 16,10 16,4 24,4" />
      <line x1={4} y1={22} x2={24} y2={22} strokeDasharray="2 2" opacity={0.4} />
    </svg>
  )
}
function OverhangIcon({ color = '#7c9dbf' }: { color?: string }) {
  return (
    <svg width={28} height={28} fill="none" stroke={color} strokeWidth={1.5}>
      <rect x={4} y={16} width={10} height={8} /><rect x={10} y={8} width={14} height={8} />
      <line x1={14} y1={16} x2={14} y2={24} strokeDasharray="2 2" opacity={0.5} />
      <line x1={24} y1={16} x2={24} y2={22} strokeDasharray="2 2" opacity={0.5} />
    </svg>
  )
}
function PathIcon({ color = C.green }: { color?: string }) {
  return (
    <svg width={28} height={28} fill="none" stroke={color} strokeWidth={1.5}>
      <circle cx={6} cy={6} r={2} fill={color} stroke="none" />
      <path d="M6 8 L6 14 L14 14 L14 20 L20 20 L20 24" strokeDasharray="2 2" />
      <circle cx={20} cy={24} r={2} fill="none" />
    </svg>
  )
}
function RowIcon({ color = C.green }: { color?: string }) {
  return (
    <svg width={28} height={28} fill="none" stroke={color} strokeWidth={1.5}>
      <rect x={3} y={12} width={22} height={4} fill={`${color}25`} stroke={color} />
      <line x1={3} y1={8} x2={25} y2={8} strokeDasharray="3 2" opacity={0.4} />
      <line x1={3} y1={20} x2={25} y2={20} strokeDasharray="3 2" opacity={0.4} />
    </svg>
  )
}

// ── Figures Catalog Page ───────────────────────────────────────────────────────
function FiguresPage() {
  const [selected, setSelected] = useState<Figure | null>(null)
  const [orientation, setOrientation] = useState(0)
  const orientations = selected ? getOrientations(selected.cells) : []

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
            className="mb-3">FIGURE CATALOG</p>
          <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-3">All 27 Figures</h1>
          <p style={{ color: C.steel }} className="text-sm max-w-xl">
            Sizes 1 to 7 cells. Click any figure to see all valid orientations.
            Figure #25 is the only 7-cell piece (Heptomino-H).
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2 mb-10">
          {FIGURES.map(fig => (
            <button key={fig.id}
              onClick={() => { setSelected(fig); setOrientation(0) }}
              style={{
                border: `1px solid ${selected?.id === fig.id ? C.cyan : `${C.cyan}22`}`,
                background: selected?.id === fig.id ? `${C.cyan}18` : C.graphite2,
                transition: 'all 0.15s',
              }}
              className="aspect-square flex flex-col items-center justify-center gap-1 p-2 hover:border-cyan-500/60">
              <FigurePreview cells={fig.cells} cardSize={56} color={selected?.id === fig.id ? C.cyan : `${C.cyan}90`} />
              <span style={{ color: selected?.id === fig.id ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }}>
                {fig.label}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-8">
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span style={{ background: C.cyan, color: C.graphite, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}
                    className="px-3 py-1">{selected.label}</span>
                  <h2 style={{ color: C.deck }} className="text-xl font-semibold">{selected.name}</h2>
                  <span style={{ color: C.steelDim, fontSize: 13 }}>{selected.size} {selected.size === 1 ? 'cell' : 'cells'}</span>
                </div>
                <div style={{ border: `1px solid ${C.cyan}22`, background: C.graphite, display: 'inline-block', padding: 24 }}>
                  <FigurePreview cells={selected.cells} cardSize={120} color={C.cyan} cellPx={20} />
                </div>
              </div>
              <div>
                <p style={{ color: C.steel, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', marginBottom: 16 }}>
                  ORIENTATIONS ({orientations.length} unique)
                </p>
                <div className="flex flex-wrap gap-3">
                  {orientations.map((cells, i) => (
                    <button key={i}
                      onClick={() => setOrientation(i)}
                      style={{
                        border: `1px solid ${orientation === i ? C.cyan : `${C.cyan}25`}`,
                        background: orientation === i ? `${C.cyan}18` : C.graphite,
                        transition: 'all 0.15s',
                      }}
                      className="p-2 flex flex-col items-center gap-1">
                      <FigurePreview cells={cells} cardSize={72} color={orientation === i ? C.cyan : `${C.cyan}80`} cellPx={16} />
                      <span style={{ color: orientation === i ? C.cyan : C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>
                        {i * 90}°
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: '12px 16px', background: `${C.blue}18`, border: `1px solid ${C.blue}40` }}>
                  <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                    BOUNDING BOX ({orientation * 90}° orientation)
                  </p>
                  {(() => {
                    const cells = orientations[orientation] || selected.cells
                    const rows = cells.map(([r]) => r)
                    const cols = cells.map(([, c]) => c)
                    const h = Math.max(...rows) - Math.min(...rows) + 1
                    const w = Math.max(...cols) - Math.min(...cols) + 1
                    return (
                      <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                        {w} × {h}
                      </span>
                    )
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

// ── Rules Page ─────────────────────────────────────────────────────────────────
function RulesPage() {
  const rules = [
    {
      n: '01', name: 'Support', color: C.cyan, icon: SupportIcon,
      summary: 'No piece may float. Every cell of a placed piece must either rest on the base row A or be directly supported by a previously placed cell below it.',
      detail: 'After placement, the game checks each occupied column segment. Any cell without support — either from row A (the floor) or another piece — constitutes a violation.',
    },
    {
      n: '02', name: 'Steps (≤ 3)', color: C.blue, icon: StepsIcon,
      summary: 'The height difference between adjacent columns after placement must not exceed 3 cells. A step of 4 or more is impassable.',
      detail: 'This governs reachability along the stowed surface. Steps ≤ 3 are passable; steps > 3 form a wall that blocks the return path even if no single piece overhangs.',
    },
    {
      n: '03', name: 'Overhang', color: '#7c9dbf', icon: OverhangIcon,
      summary: 'More than 50% of a piece\'s area may not be unsupported after placement. Exceeding this threshold requires the bilateral fair-play exception.',
      detail: 'When a placement would exceed the 50% unsupported threshold, the game presents a bilateral confirmation modal to both players. Both must actively accept before the move is registered. The exception is logged in match history.',
      extra: (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, padding: '12px 16px', marginTop: 12 }}>
          <p style={{ color: C.red, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, letterSpacing: '0.1em' }}>
            FAIR-PLAY EXCEPTION
          </p>
          <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6 }}>
            When triggered, an explicit bilateral modal is shown. Both players must confirm before the overhang move is applied. It is never automatic, never one-sided.
          </p>
        </div>
      ),
    },
    {
      n: '04', name: 'Return Path', color: C.green, icon: PathIcon,
      summary: 'After every placement, a passable path must exist from the current surface back to exit point A0.',
      detail: 'The path is evaluated by the server after each move. If placement blocks all routes to A0 — through the combination of support, steps, and overhang constraints — the move is illegal.',
    },
    {
      n: '05', name: 'Row Closure', color: C.green, icon: RowIcon,
      summary: 'Win by closing 5 full rows (horizontal and/or vertical), or by placing an opponent in a position where they cannot legally place the required piece.',
      detail: 'A full horizontal row (all 15 columns in a given row occupied) or a full vertical column (all rows in a given column occupied) counts as one closure. Five cumulative closures win the match.',
    },
  ]

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
          className="mb-3">RULES</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-4">Complete Rule Set</h1>
        <p style={{ color: C.steel }} className="text-sm mb-14 max-w-2xl">
          All rules are authoritative server-side. The client displays server-confirmed state only —
          no client-side rules engine. This preserves anti-cheat integrity for all rated play.
        </p>
        <div className="flex flex-col gap-8">
          {rules.map(rule => (
            <div key={rule.n} style={{ border: `1px solid ${rule.color}30`, background: C.graphite2 }} className="p-8">
              <div className="flex items-start gap-6">
                <div><rule.icon color={rule.color} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <span style={{ color: rule.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em' }}>
                      RULE {rule.n}
                    </span>
                    <h2 style={{ color: C.deck }} className="text-lg font-semibold">{rule.name}</h2>
                  </div>
                  <p style={{ color: C.deck }} className="text-sm leading-relaxed mb-3 font-medium">{rule.summary}</p>
                  <p style={{ color: C.steel }} className="text-sm leading-relaxed">{rule.detail}</p>
                  {'extra' in rule && rule.extra}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Container Specification */}
        <div style={{ marginTop: 40, border: `1px solid ${C.cyan}28`, background: C.graphite2, padding: 32 }}>
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em', marginBottom: 20 }}>
            CONTAINER SPECIFICATION
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[
              {
                mode: 'Rated Play / Practice', size: '15×10', rows: 'A–J (10 rows)',
                note: 'Standard competitive container. All rated matches and recommended practice sessions.',
                color: C.cyan,
              },
              {
                mode: 'Sandbox', size: '15×11', rows: 'A–K (11 rows)',
                note: 'Training container with a bold J/K separator line — permanent feature, not a placeholder.',
                color: C.steel,
              },
            ].map(spec => (
              <div key={spec.mode} style={{ border: `1px solid ${spec.color}30`, background: C.graphite, padding: 20 }}>
                <p style={{ color: spec.color, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8, letterSpacing: '0.1em' }}>
                  {spec.mode.toUpperCase()}
                </p>
                <p style={{ color: C.deck, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{spec.size}</p>
                <p style={{ color: C.steel, fontSize: 13, marginBottom: 8 }}>Rows {spec.rows}</p>
                <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5 }}>{spec.note}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Width', value: '15 columns', sub: 'labeled 0–14' },
              { label: 'Entry / Exit', value: 'A0', sub: 'bottom-left corner' },
              { label: 'Axis', value: 'A = floor', sub: 'K = training ceiling' },
              { label: 'Figures', value: '27 fixed', sub: 'sizes 1–7 cells' },
            ].map(spec => (
              <div key={spec.label}>
                <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  {spec.label.toUpperCase()}
                </p>
                <p style={{ color: C.deck, fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{spec.value}</p>
                <p style={{ color: C.steelDim, fontSize: 11 }}>{spec.sub}</p>
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
  const [belarusianExpanded, setBelarusianExpanded] = useState(false)

  return (
    <div style={{ background: '#161820', minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{
        backgroundImage: `radial-gradient(circle at center, rgba(31,167,163,0.04) 1px, transparent 1.2px)`,
        backgroundSize: '20px 20px',
        minHeight: '100vh',
      }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <p style={{ color: `${C.cyan}80`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em' }}
            className="mb-8">— THE LEGEND OF THE LODARS —</p>
          <h1 style={{ color: C.deck, lineHeight: 1.2, fontSize: 36, fontWeight: 700 }} className="mb-10">
            The Legend<br />
            <span style={{ color: C.cyan }}>of the Lodars</span>
          </h1>
          <div style={{ borderLeft: `2px solid ${C.cyan}40`, paddingLeft: 24, marginBottom: 40 }}>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 24 }}>
              Long before the first shipping container was forged, the Lodars moved cargo across the great
              plateaus by a discipline that demanded both geometry and foresight. Each Lodar carried a table
              of 27 figures — memorized, not written — and a container drawn in chalk on stone.
            </p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9, marginBottom: 24 }}>
              The opponent's right was the opponent's gift: to choose which shape entered your space.
              The wisdom of the Lodars was not in avoiding bad pieces — it was in finding the placement
              that left every path open, every row one step closer to closure, every opponent's choice
              already absorbed into the plan.
            </p>
            <p style={{ color: `${C.deck}cc`, fontSize: 16, lineHeight: 1.9 }}>
              There were seven ranks among them. An UnderLodar learned the names.
              A ProfiLod saw the container before the piece was called.
            </p>
          </div>
          <div style={{ borderLeft: `2px solid ${C.steelDim}`, paddingLeft: 24, marginBottom: 40 }}>
            <p style={{ color: C.steelDim, fontSize: 14, lineHeight: 1.8, fontStyle: 'italic' }}>
              "Qualification is your real level of thinking. Not access to a hint."
            </p>
            <p style={{ color: C.steelDim, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              — attributed to the first MasterLod
            </p>
          </div>

          {/* Belarusian prologue — owner's text, intentionally terse */}
          <div style={{ border: `1px solid ${C.steelDim}30`, background: `${C.graphite2}80`, padding: 24, marginBottom: 32 }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em' }}>
                ПРАЛОГ
              </p>
              <button onClick={() => setBelarusianExpanded(!belarusianExpanded)}
                style={{ color: C.cyan, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                {belarusianExpanded ? '− згарнуць' : '+ разгарнуць'}
              </button>
            </div>
            {belarusianExpanded && (
              <p style={{ color: `${C.deck}bb`, fontSize: 15, lineHeight: 1.9 }}>
                Мазгавая тэрапія знаходзіцца недзе побач з працоўнай.
              </p>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.cyan}18`, paddingTop: 32 }}>
            <p style={{ color: C.steelDim, fontSize: 13 }}>
              The full Legend of the Lodars is an ongoing narrative developed alongside the game's community.
              Follow the Telegram channel for new chapters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Play Page (Part D) ─────────────────────────────────────────────────────────
// 15×10 container (rows A–J). Server-authoritative display only.
function buildPlayCells() {
  const s = new Set<string>()
  for (let c = 0; c < 15; c++) s.add(`9,${c}`)   // A — full, closed
  for (let c = 0; c <= 5; c++) s.add(`8,${c}`)   // B — left
  for (let c = 8; c <= 14; c++) s.add(`8,${c}`)  // B — right
  for (let c = 0; c <= 2; c++) s.add(`7,${c}`)   // C
  for (let c = 12; c <= 14; c++) s.add(`7,${c}`) // C
  return s
}
const PLAY_CELLS = buildPlayCells()
const PLAY_CLOSED = new Set([9])  // visual row 9 = A (bottom of 10-row grid)

// Opponent's smaller container — sparse fill for display
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

const SAMPLE_HISTORY = [
  { who: 'You',  notation: '03A2B3',  turn: 1 },
  { who: 'Opp',  notation: '07A0B1',  turn: 2 },
  { who: 'You',  notation: '14A5B5',  turn: 3 },
  { who: 'Opp',  notation: '05A10B14', turn: 4 },
  { who: 'You',  notation: '01A7',    turn: 5 },
  { who: 'Opp',  notation: '08B1C2',  turn: 6 },
]

function PlayPage() {
  const [rotIdx, setRotIdx] = useState(0)
  const [notation, setNotation] = useState('')
  const incomingFig = FIGURES[15]  // F16 Pentomino-X
  const requestFig = FIGURES[3]    // F04 for opponent request panel
  const orientations = getOrientations(incomingFig.cells)
  const currentOrientation = orientations[rotIdx % orientations.length]

  // 27 figures split: some already loaded (dimmed), rest pending
  const loadedIds = new Set([1, 2, 3, 6, 7, 8, 12, 13, 14])

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      {/* ── Status bar ── */}
      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.cyan}22` }}
        className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <span style={{ background: `${C.cyan}22`, color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '3px 10px' }}>
            YOUR TURN
          </span>
          <span style={{ color: C.deck, fontSize: 13 }}>
            Place figure <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace" }}>F16</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>RATED</span>
          <span style={{ color: C.steelDim, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>Move 7</span>
          <span style={{ color: C.steel, fontSize: 13 }}>vs. <span style={{ color: C.deck }}>nikolai_k</span></span>
          <div style={{ background: `${C.green}22`, color: C.green, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '3px 10px' }}>
            ⏱ 5:42
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Left: containers ── */}
        <div className="flex flex-col gap-6">
          {/* Your container (15×10) */}
          <div style={{ border: `1px solid ${C.cyan}30`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em' }}>
                  YOUR CONTAINER
                </span>
                <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginLeft: 16 }}>15×10</span>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-5 text-xs flex-wrap">
                {[
                  { label: 'Placed', bg: `${C.blue}40`, border: `${C.blue}cc` },
                  { label: 'Row closed', bg: `${C.green}28`, border: C.green },
                  { label: 'Entry A0', bg: `${C.cyan}20`, border: C.cyan },
                  { label: 'Drop preview', bg: 'transparent', border: C.red },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5" style={{ color: C.steelDim }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: l.bg, border: `1.5px solid ${l.border}` }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={PLAY_CELLS} closedRows={PLAY_CLOSED} cellSize={28} rows={10} />
            </div>
          </div>

          {/* Opponent's container — read-only, smaller */}
          <div style={{ border: `1px solid ${C.steelDim}30`, background: C.graphite2 }} className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em' }}>
                OPPONENT — nikolai_k
              </span>
              <span style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>15×10 · read-only</span>
            </div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={OPP_CELLS} closedRows={OPP_CLOSED} cellSize={16} rows={10} />
            </div>
          </div>

          {/* Remaining cargo strip */}
          <div style={{ border: `1px solid ${C.blue}35`, background: C.graphite2 }} className="p-4">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              YOUR REMAINING CARGO — figures the opponent can still assign you
            </p>
            <div className="flex flex-wrap gap-2">
              {FIGURES.map(fig => (
                <div key={fig.id}
                  style={{
                    border: `1px solid ${loadedIds.has(fig.id) ? C.steelDim + '40' : C.cyan + '40'}`,
                    background: loadedIds.has(fig.id) ? C.graphite : `${C.cyan}10`,
                    opacity: loadedIds.has(fig.id) ? 0.35 : 1,
                    position: 'relative',
                  }}
                  title={fig.name}>
                  <FigurePreview cells={fig.cells} cardSize={36} color={loadedIds.has(fig.id) ? C.steelDim : C.cyan} cellPx={7} />
                  {loadedIds.has(fig.id) && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: C.steelDim, fontSize: 14, lineHeight: 1 }}>×</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: incoming cargo + request + history ── */}
        <div className="flex flex-col gap-4">
          {/* Incoming cargo panel */}
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
              INCOMING CARGO
            </p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 16 }}
              className="flex items-center justify-center mb-4">
              <FigurePreview cells={currentOrientation} cardSize={100} color={C.cyan} cellPx={18} />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: C.deck, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                {incomingFig.label} — {incomingFig.name}
              </span>
            </div>
            {/* Rotate controls */}
            <div className="flex gap-2 mb-5">
              {[0, 1, 2, 3].slice(0, orientations.length).map(i => (
                <button key={i}
                  onClick={() => setRotIdx(i)}
                  style={{
                    border: `1px solid ${rotIdx % orientations.length === i ? C.cyan : C.steelDim + '50'}`,
                    background: rotIdx % orientations.length === i ? `${C.cyan}18` : 'transparent',
                    color: rotIdx % orientations.length === i ? C.cyan : C.steelDim,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11, padding: '4px 10px',
                    transition: 'all 0.15s',
                  }}>
                  {i * 90}°
                </button>
              ))}
            </div>
            {/* Placement inputs */}
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 8 }}>Drag the piece onto your container, or type the move notation:</p>
            <div className="flex gap-2">
              <input
                value={notation}
                onChange={e => setNotation(e.target.value)}
                placeholder="e.g. B9C10"
                style={{
                  background: C.graphite, border: `1px solid ${C.blue}`,
                  color: C.deck, fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                  padding: '8px 10px', flex: 1, outline: 'none',
                }}
              />
              <button
                style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px' }}>
                OK
              </button>
            </div>
          </div>

          {/* Request panel */}
          <div style={{ border: `1px solid ${C.blue}40`, background: C.graphite2 }} className="p-5">
            <p style={{ color: C.blue, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 6 }}>
              REQUEST — OPPONENT'S REMAINING POOL
            </p>
            <p style={{ color: C.steelDim, fontSize: 11, marginBottom: 14 }}>
              Choose a figure to assign to your opponent. Greyed out = already used or repeat-request restricted.
            </p>
            <div className="flex flex-wrap gap-2">
              {FIGURES.filter(f => !loadedIds.has(f.id)).map(fig => (
                <button key={fig.id}
                  style={{
                    border: `1px solid ${fig.id === requestFig.id ? C.blue : C.blue + '35'}`,
                    background: fig.id === requestFig.id ? `${C.blue}30` : 'transparent',
                    opacity: fig.id === 7 ? 0.3 : 1,  // simulate repeat-request restriction
                  }}
                  disabled={fig.id === 7}
                  title={`${fig.label} ${fig.name}`}>
                  <FigurePreview cells={fig.cells} cardSize={32} color={fig.id === requestFig.id ? C.blueLight : C.steelDim} cellPx={6} />
                </button>
              ))}
            </div>
          </div>

          {/* Move history */}
          <div style={{ border: `1px solid ${C.steelDim}25`, background: C.graphite2 }} className="p-5 flex-1">
            <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              MOVE HISTORY
            </p>
            <div className="flex flex-col gap-1">
              {SAMPLE_HISTORY.map((m, i) => (
                <div key={i} className="flex items-center gap-3 py-1"
                  style={{ borderBottom: `1px solid ${C.cyan}0a` }}>
                  <span style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, minWidth: 18 }}>
                    {m.turn}
                  </span>
                  <span style={{ color: m.who === 'You' ? C.cyan : C.steel, fontSize: 11, minWidth: 30 }}>
                    {m.who}
                  </span>
                  <code style={{ color: m.who === 'You' ? C.deck : C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {m.notation}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Profile Page (Part C) ─────────────────────────────────────────────────────
function ProfilePage() {
  const [displayName, setDisplayName] = useState('Aleksei Morozov')
  const [nickname, setNickname] = useState('lodar_ax')
  const [useNickname, setUseNickname] = useState(false)

  const shownAs = useNickname ? nickname : displayName

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em' }}
          className="mb-3">PROFILE</p>
        <h1 style={{ color: C.deck }} className="text-3xl font-bold mb-10">Account Settings</h1>

        {/* Identity section */}
        <div style={{ border: `1px solid ${C.cyan}28`, background: C.graphite2 }} className="p-8 mb-6">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 20 }}>
            IDENTITY
          </p>

          <div className="flex flex-col gap-5">
            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", display: 'block', marginBottom: 6 }}>
                DISPLAY NAME
              </label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{
                  background: C.graphite, border: `1px solid ${C.steelDim}`,
                  color: C.deck, fontSize: 14, padding: '10px 12px',
                  width: '100%', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.cyan)}
                onBlur={e => (e.currentTarget.style.borderColor = C.steelDim)}
              />
            </div>

            <div>
              <label style={{ color: C.steel, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", display: 'block', marginBottom: 6 }}>
                NICKNAME
              </label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={{
                  background: C.graphite, border: `1px solid ${C.steelDim}`,
                  color: C.deck, fontSize: 14, padding: '10px 12px',
                  width: '100%', outline: 'none', fontFamily: "'JetBrains Mono', monospace",
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.cyan)}
                onBlur={e => (e.currentTarget.style.borderColor = C.steelDim)}
              />
            </div>

            {/* Use nickname checkbox */}
            <div style={{ border: `1px solid ${useNickname ? C.cyan + '50' : C.steelDim + '40'}`, background: useNickname ? `${C.cyan}10` : 'transparent', padding: '14px 16px', transition: 'all 0.2s' }}>
              <label className="flex items-start gap-4 cursor-pointer">
                <div
                  onClick={() => setUseNickname(!useNickname)}
                  style={{
                    width: 18, height: 18, border: `1.5px solid ${useNickname ? C.cyan : C.steelDim}`,
                    background: useNickname ? C.cyan : 'transparent',
                    flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {useNickname && (
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={C.graphite} strokeWidth={2}>
                      <polyline points="1.5,5 4,7.5 8.5,2.5" />
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ color: C.deck, fontSize: 14, fontWeight: 500 }}>Use nickname</p>
                  <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
                    When checked, your nickname replaces your display name on PuzzleStow leaderboards,
                    match history, profile cards, and Lodar Path badges.
                  </p>
                </div>
              </label>
            </div>

            {/* Live preview */}
            <div style={{ background: C.graphite, border: `1px solid ${C.steelDim}30`, padding: '12px 16px' }}>
              <p style={{ color: C.steelDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                SHOWN AS IN PUZZLESTOW
              </p>
              <span style={{ color: C.deck, fontSize: 16, fontWeight: 600, fontFamily: useNickname ? "'JetBrains Mono', monospace" : 'inherit' }}>
                {shownAs || <span style={{ color: C.steelDim, fontStyle: 'italic' }}>—</span>}
              </span>
            </div>

            {/* PairSec scope note */}
            <div style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}40`, padding: '12px 16px' }}>
              <p style={{ color: C.blue, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, letterSpacing: '0.08em' }}>
                PAIRSEC SCOPE NOTE
              </p>
              <p style={{ color: C.steelDim, fontSize: 12, lineHeight: 1.6 }}>
                This nickname toggle applies to PuzzleStow display only. It does not affect how your
                identity is shown for PairSec service bookings — PairSec's trust model relies on
                transparent identity for in-person services. Cross-product display of the nickname is
                a separate decision, not a default.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button style={{ background: C.cyan, color: C.graphite, fontWeight: 600, fontSize: 13, padding: '10px 24px' }}
              className="hover:brightness-110 transition-all">
              Save Changes
            </button>
            <button style={{ color: C.steel, border: `1px solid ${C.steelDim}`, fontSize: 13, padding: '10px 24px' }}
              className="hover:text-deck transition-colors">
              Cancel
            </button>
          </div>
        </div>

        {/* Qualification summary */}
        <div style={{ border: `1px solid ${C.cyan}18`, background: C.graphite2 }} className="p-6">
          <p style={{ color: C.steelDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', marginBottom: 16 }}>
            QUALIFICATION
          </p>
          <div className="flex items-center gap-6">
            <div style={{ background: C.blue, width: 44, height: 44 }}
              className="flex items-center justify-center">
              <span style={{ color: C.deck, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 }}>ML</span>
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>('home')
  return (
    <div style={{ background: C.graphite, minHeight: '100vh' }}>
      <Nav page={page} setPage={setPage} />
      {page === 'home'    && <HomePage setPage={setPage} />}
      {page === 'figures' && <FiguresPage />}
      {page === 'rules'   && <RulesPage />}
      {page === 'lore'    && <LorePage />}
      {page === 'play'    && <PlayPage />}
      {page === 'profile' && <ProfilePage />}
    </div>
  )
}
