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

// Step 7 (CLIMBING A TALL STEP) starting position: F4 stood vertically at column 1
// (height 4 -- not directly passable) with a thin, already-stowed floor layer beyond it
// (columns 2..14, height 1) standing in for "cargo already delivered earlier in a real
// game." Verified against the real engine (_to_delete/find_step_puzzle5.ts): with the
// wall alone, F15 has exactly one legal placement and it costs dead cells (a turning-
// pocket wedge right above the wall); after the player raises the entrance (column 0) by
// one cell with the Mono helper, F15 gets 48 legal options, many of them clean (0 new
// dead cells) -- a real demonstration of "shrink the near side of the step," not a
// contrived one.
function stepClimbInitialFilled(rows: number): Set<string> {
  const s = new Set<string>()
  for (let r = rows - 4; r <= rows - 1; r++) s.add(cellKey(r, 1))
  for (let c = 2; c <= 14; c++) s.add(cellKey(rows - 1, c))
  return s
}

function SandboxPage({ setPage: _setPage }: { setPage: (p: Page) => void }) {
  const ROWS = 11
  const TOTAL_TUT_STEPS = 10 // content steps 0..9; 10 = completion

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
    if (step === 4 || step === 5) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(15); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null); setPendingFairPlay(null)
    } else if (step === 6) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(SHIPMENT_FIGS[0]); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null)
      setShipmentIdx(0); setShipmentDeadTotal(0); setPendingFairPlay(null)
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
    if (tutStep === 1) {
      setSelectedFigId(1); setClickPoints([]); setNotation(''); setMessage(null)
    } else if (tutStep === 4 || tutStep === 5 || tutStep === 6 || tutStep === 7) {
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
    if (!selectedFig) { setMessage('Pick a figure from the bank first.'); return }
    if (clickPoints.length < pointsNeeded) setClickPoints(p => [...p, { r, c }])
  }

  // `explicitPoints`, when given, is used instead of `clickPoints` -- needed by
  // placeByNotation() below, since setClickPoints() wouldn't be visible yet within the
  // same call (React state updates are async).
  function place(explicitPoints?: { r: number; c: number }[]) {
    if (!selectedFig) return
    const clicked = (explicitPoints ?? clickPoints).slice(0, pointsNeeded)
    if (clicked.length < pointsNeeded) { setMessage('Click the container to mark the reference point(s) first.'); return }
    const cells = pointsNeeded === 2
      ? computePlacementFromDots(selectedFig, clicked)
      : computePlacementFromAnchor(selectedFig, rotIdx, clicked[0])
    const cellsKey = cells ? [...cells].map(([r, c]) => cellKey(r, c)).sort().join('|') : null
    const result = checkPlacement(cells, filled, ROWS, cellsKey != null && pendingFairPlay?.key === cellsKey)
    if (!result.ok) {
      if (result.needsFairPlay && cellsKey != null) {
        setPendingFairPlay({ key: cellsKey })
        setMessage(`${result.reason}. In a real match this needs the opponent's fair-play OK -- click Place again to confirm you'd still place it here.`)
        return
      }
      setPendingFairPlay(null)
      setMessage(`Invalid: ${result.reason}`)
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
      setNotationInputError(`That notation is for figure ${String(parsed.figureId).padStart(2, '0')}, not ${selectedFig.label}.`)
      return
    }
    if (parsed.points.length !== pointsNeeded) {
      setNotationInputError(`${selectedFig.label} needs ${pointsNeeded} reference point${pointsNeeded > 1 ? 's' : ''} -- got ${parsed.points.length}.`)
      return
    }
    setNotationInputError(null)
    place(parsed.points)
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
      {
        title: 'SUPPORT', headline: 'Every piece needs something to rest on',
        body: "Nothing in the container may float — every figure must touch the floor, or an already-placed piece, somewhere. Watch what happens when we try to drop a piece straight into empty air:",
        note: "Hard rule — unlike overhang below, there's no fair-play exception for it.",
        demo: support,
      },
      {
        title: 'STEPS', headline: "Cargo can't cross a step taller than 3 cells",
        body: 'Here the entrance column is stacked 5 cells high. Trying to place a figure past it — straight across that drop — gets rejected, even though the target cell itself is empty and on the floor:',
        note: 'A step of 2 or 3 cells is passable; taller than that blocks delivery through it until another placement lowers the gap — the same going up as going down.',
        demo: step4Demo,
      },
      {
        title: 'OVERHANG & FAIR PLAY', headline: 'Most of a piece can hang over empty space — up to a point',
        body: 'A figure doesn’t need every cell supported, only enough of it does. Here, one corner of this figure rests on a small ledge; the rest hangs over open air:',
        note: 'Over 50% unsupported needs the opponent’s explicit fair-play OK — you’ll walk through exactly how that works, both ways, later in this tutorial.',
        demo: overhang,
      },
      {
        title: 'RETURN PATH', headline: "The very last move can't seal the container shut",
        body: 'A placement is refused if it would leave nowhere left to deliver cargo, anywhere in the whole container — here every cell but the entrance is already full:',
        note: 'This only guards the literal last reachable cell. Walling off a smaller pocket earlier is legal — those cells simply become permanently dead space.',
        demo: returnPath,
      },
    ]
  }, [step4Demo])

  // Step 8: same >50%-overhang scenario as the Step 3 overview panel, but interactive --
  // walked through BOTH outcomes (confirm / decline), which the real free-mode double-
  // click flow can't show on its own since Sandbox has no live second player.
  const fairPlayDemo = useMemo(() => {
    const f = new Set<string>([cellKey(ROWS - 1, 5)])
    const attempt: Cells = [[ROWS - 2, 5], [ROWS - 2, 6], [ROWS - 2, 7], [ROWS - 2, 8]]
    return { filled: f, attempt, ghost: new Set(attempt.map(([r, c]) => cellKey(r, c))) }
  }, [])
  const fairPlayCheck = checkPlacement(fairPlayDemo.attempt, fairPlayDemo.filled, ROWS, fairPlayDemoPhase === 'confirmed')

  const stepClimbHelperPlaced = pieces.some(p => p.id === 1)
  const stepClimbTargetPlaced = pieces.some(p => p.id === 15)

  return (
    <div style={{ background: C.graphite, minHeight: '100vh', paddingTop: '3.5rem' }}>
      <div style={{ background: C.graphite2, borderBottom: `1px solid ${C.steelDim}30` }} className="px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <span style={{ color: C.steel, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>SANDBOX</span>
          <span style={{ background: `${C.steelDim}30`, color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>
            UNRATED · FREE PLACEMENT · 15×{ROWS}
          </span>
          {mode === 'tutorial' && (
            <span style={{ background: `${C.cyan}20`, color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '3px 10px' }}>
              TUTORIAL · STEP {Math.min(tutStep + 1, TOTAL_TUT_STEPS)} OF {TOTAL_TUT_STEPS}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {mode === 'free' && (
            <button onClick={restartTutorial} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">Restart tutorial</button>
          )}
          {mode === 'tutorial' && tutStep < TOTAL_TUT_STEPS && (
            <button onClick={startFreeMode} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">Skip to free sandbox</button>
          )}
          <button onClick={clearContainer} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
            className="hover:text-deck transition-colors">Clear container</button>
        </div>
      </div>

      {mode === 'tutorial' && tutStep === 0 && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12 }}>STEP 1 OF 10 — THE GOAL</p>
          <h2 style={{ color: C.deck, fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Stow cargo, close rows and columns</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            In a real match your opponent chooses which cargo figure you receive next, and you place
            it in your container. Fill every cell of a row or a column and it closes — closing 5 rows
            and/or columns first wins the game. This sandbox skips the opponent: pick any figure,
            any time, and see how placement really works before you play for real.
          </p>
          <button onClick={() => setTutStep(1)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Start →</button>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 1 && selectedFig && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={30}
                pieces={pieces} onCellClick={handleCellClick}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 2 OF 10 — ENTRANCE &amp; FIRST PLACEMENT</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              The cyan cell is <b style={{ color: C.cyan }}>A0</b> — the entrance. Every piece of cargo
              must be reachable from here. You've been handed figure <b style={{ color: C.deck }}>{selectedFig.label} — {selectedFig.name}</b>,
              a single cell — the simplest placement there is.
            </p>
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 12 }}>Click any cell on the bottom row to place it.</p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={selectedFig.cells} cardSize={60} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
            </div>
            <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
              style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>
              Place
            </button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 2 && lastPlacement && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12 }}>STEP 3 OF 10 — NOTATION</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>You just recorded your first move</h2>
          <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 8 }}>{lastPlacement.figLabel}</p>
          <div style={{ background: C.graphite2, border: `1px solid ${C.cyan}30`, padding: '18px 24px', marginBottom: 20 }}>
            <code style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700 }}>{lastPlacement.notation}</code>
          </div>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            That's the figure's number followed by the cell(s) its reference dots landed on —
            the same notation you'll report to your opponent (or the server records) in a real match.
            Every figure has 1 or 2 reference dots; a wider figure needs two cells to pin down its
            rotation, a single-cell figure like this one needs just one.
          </p>
          <button onClick={() => setTutStep(3)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Next →</button>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 3 && (() => {
        const panel = ruleOverviewDemos[rulesPanelIdx]
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
              STEP 4 OF 10 — CORE RULES ({rulesPanelIdx + 1}/4 — {panel.title})
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
                <button onClick={() => setRulesPanelIdx(i => i - 1)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 18px' }}>← Prev rule</button>
              )}
              {rulesPanelIdx < ruleOverviewDemos.length - 1 ? (
                <button onClick={() => setRulesPanelIdx(i => i + 1)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Next rule →</button>
              ) : (
                <button onClick={() => { setRulesPanelIdx(0); setTutStep(4) }} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Next step →</button>
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
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>This placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''} — they can never receive cargo now. Try Reset for a cleaner spot.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean placement — no cells were walled off.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 5 OF 10 — MEET F15: PLACE BY POINTS</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              <b style={{ color: C.deck }}>{selectedFig.label} — {selectedFig.name}</b> needs <b style={{ color: C.cyan }}>two</b> reference
              points, not one — a single point can't pin down both where and which way an asymmetric shape sits.
              The first click and the second aren't interchangeable: swap their order and you get a different orientation.
            </p>
            <div style={{ background: C.graphite, border: `1px solid ${C.cyan}22`, padding: 14 }} className="flex items-center justify-center mb-4">
              <FigurePreview cells={selectedFig.cells} cardSize={70} color={C.cyan} cellPx={14} dots={selectedFig.dots} number={selectedFig.id} />
            </div>
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 8 }}>
              Click two cells in the container, in order. Try to place it without walling off any cell — you'll find out right after whether you did.
            </p>
            {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 12 }}>{notation}</code>}
            <div className="flex gap-2 mb-3">
              <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 16px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>Place</button>
              <button onClick={() => initStep(4)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px' }}>Reset</button>
            </div>
            {deadCellAdvisory != null && (
              <button onClick={() => setTutStep(5)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 13, padding: '10px 18px', border: 'none', width: '100%', cursor: 'pointer' }}>Next →</button>
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
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>This placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''} — they can never receive cargo now. Try Reset for a cleaner spot.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean placement — no cells were walled off.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 6 OF 10 — PLACE BY NOTATION</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Same figure, same two reference dots — this time write where they land instead of clicking them.
              Format: figure id, then each point as a row letter and column number, e.g. <code style={{ color: C.cyan }}>15D4B3</code>.
            </p>
            <input value={notationInput} onChange={e => setNotationInput(e.target.value)}
              placeholder={`15${rowToLetter(ROWS - 1, ROWS)}5${rowToLetter(ROWS - 2, ROWS)}7`}
              style={{ width: '100%', background: C.graphite, border: `1px solid ${C.cyan}40`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, padding: '10px 12px', marginBottom: 8 }} />
            {notationInputError && <p style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{notationInputError}</p>}
            <div className="flex gap-2 mb-3">
              <button onClick={placeByNotation} disabled={!notationInput}
                style={{ background: notationInput ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 16px', border: 'none', flex: 1, cursor: notationInput ? 'pointer' : 'default' }}>Place</button>
              <button onClick={() => initStep(5)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px' }}>Reset</button>
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
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That one walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean — no cells walled off.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>
              STEP 7 OF 10 — {shipmentIdx < SHIPMENT_CORE_COUNT ? `SHIPMENT ${shipmentIdx + 1} OF ${SHIPMENT_CORE_COUNT}` : shipmentIdx < SHIPMENT_FIGS.length ? `BONUS ${shipmentIdx - SHIPMENT_CORE_COUNT + 1} OF ${SHIPMENT_FIGS.length - SHIPMENT_CORE_COUNT}` : 'ALL SHIPMENTS DONE'}
            </p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              Five figures, fed one at a time — just like a real opponent handing you cargo. Place each one, by
              clicking or by notation, and try to finish all five with <b style={{ color: C.deck }}>zero</b> dead cells.
              Two harder bonus figures follow if you want more practice.
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
                    style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>Place (click points)</button>
                </div>
                <input value={notationInput} onChange={e => setNotationInput(e.target.value)}
                  placeholder="or type notation, e.g. 08C0B0A0A1"
                  style={{ width: '100%', background: C.graphite, border: `1px solid ${C.cyan}40`, color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '8px 10px', marginBottom: 8 }} />
                {notationInputError && <p style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{notationInputError}</p>}
                <button onClick={placeByNotation} disabled={!notationInput}
                  style={{ background: notationInput ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 14px', border: 'none', width: '100%', cursor: notationInput ? 'pointer' : 'default', marginBottom: 12 }}>Place (from notation)</button>
              </>
            )}
            <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 12 }}>Dead cells so far: <b style={{ color: shipmentDeadTotal > 0 ? '#ffaa00' : C.green }}>{shipmentDeadTotal}</b></p>
            <div className="flex gap-2">
              <button onClick={() => initStep(6)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1 }}>Reset</button>
              {shipmentIdx >= SHIPMENT_CORE_COUNT && (
                <button onClick={() => setTutStep(7)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
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
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbTargetPlaced && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}. Reset and try another spot for a clean one.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean — you got F15 past the wall with 0 dead cells.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 8 OF 10 — CLIMBING A TALL STEP</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              F4 is standing on end just past the entrance — a step 4 cells tall, too tall to cross directly.
              But the entrance side is still open: raise it by just one cell and the gap to the wall's top shrinks
              to 3 — passable. Do that first, then bring F15 in past the wall.
            </p>
            {!stepClimbHelperPlaced ? (
              <button onClick={() => selectFigure(FIGURES.find(f => f.id === 1)!)}
                style={{ background: selectedFigId === 1 ? C.cyan : 'transparent', color: selectedFigId === 1 ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 13, padding: '10px 16px', width: '100%', marginBottom: 10, cursor: 'pointer' }}>
                1. Pick Mono (F01) — raise the entrance
              </button>
            ) : (
              <button onClick={() => selectFigure(FIGURES.find(f => f.id === 15)!)} disabled={stepClimbTargetPlaced}
                style={{ background: selectedFigId === 15 ? C.cyan : stepClimbTargetPlaced ? C.graphite : 'transparent', color: selectedFigId === 15 ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 13, padding: '10px 16px', width: '100%', marginBottom: 10, cursor: stepClimbTargetPlaced ? 'default' : 'pointer', opacity: stepClimbTargetPlaced ? 0.5 : 1 }}>
                2. Pick F15 — bring it past the wall
              </button>
            )}
            {selectedFig && (
              <>
                {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 10 }}>{notation}</code>}
                <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                  style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '10px 14px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default', marginBottom: 10 }}>Place</button>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1 }}>Reset</button>
              {stepClimbTargetPlaced && (
                <button onClick={() => setTutStep(8)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 8 && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>STEP 9 OF 10 — FAIR PLAY, BOTH WAYS</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Your opponent can say yes — or no</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>
            The same overhang scenario from the rules overview — but this time you see both of your opponent's
            possible answers, not just the happy path.
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
                <button onClick={() => setFairPlayDemoPhase('confirmed')} style={{ background: C.green, color: C.graphite, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', cursor: 'pointer' }}>✓ Opponent confirms</button>
                <button onClick={() => setFairPlayDemoPhase('declined')} style={{ background: C.red, color: C.deck, fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', cursor: 'pointer' }}>✗ Opponent declines</button>
              </div>
            </>
          )}
          {fairPlayDemoPhase === 'confirmed' && (
            <>
              <div style={{ background: `${C.green}12`, border: `1px solid ${C.green}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
                <code style={{ color: C.green, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>Placed — both players confirmed it.</code>
              </div>
              <p style={{ color: C.steel, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                In a real match, your opponent explicitly agrees to this exact placement before it's allowed —
                never automatic, never one-sided.
              </p>
              <div className="flex justify-center"><button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px' }}>See the decline instead →</button></div>
            </>
          )}
          {fairPlayDemoPhase === 'declined' && (
            <>
              <div style={{ background: `${C.steelDim}12`, border: `1px solid ${C.steelDim}40`, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
                <code style={{ color: C.steelDim, fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>Declined — nothing was placed.</code>
              </div>
              <p style={{ color: C.steel, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                Your opponent can also say no. Nothing is placed — you keep the figure and try somewhere else.
              </p>
              <div className="flex justify-center"><button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px' }}>See the confirm instead →</button></div>
            </>
          )}
          <div className="flex justify-center mt-6">
            <button onClick={() => setTutStep(9)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Next →</button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 9 && (
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, textAlign: 'center' }}>STEP 10 OF 10 — HOW TO ACTUALLY WIN</p>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>A few things worth watching for</h2>
          <div style={{ color: C.steel, fontSize: 15, lineHeight: 1.9 }}>
            <p>— Keep rows in play as long as possible — avoid creating dead cells.</p>
            <p>— Hand your opponent the more awkward figure when you get to choose.</p>
            <p>— Avoid building tall steps that cost you extra moves to fix later.</p>
            <p>— Keep an eye on passability across the whole container.</p>
            <p>— Don't leave narrow bottlenecks.</p>
          </div>
          <div className="flex justify-center mt-8">
            <button onClick={() => setTutStep(10)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Finish tutorial →</button>
          </div>
        </div>
      )}

      {mode === 'tutorial' && tutStep === 10 && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${C.cyan}20`, border: `2px solid ${C.cyan}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>🏅</div>
          <h2 style={{ color: C.deck, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Your adventure at PuzzleStow has begun</h2>
          <p style={{ color: C.steel, fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
            A long but exciting and interesting road ahead. But the nearest goal is already in sight.
            Don't stop and go forward. Win ten times first, successfully pass the exam, and advance to
            the Lodar 15X10 level. Good luck in your promotion on the Lodar staircase!
          </p>
          <p style={{ color: C.steelDim, fontSize: 12, marginBottom: 28 }}>
            (The "Новичок" badge itself isn't wired to your profile yet — this screen is a stand-in until that's built.)
          </p>
          <button onClick={startFreeMode} style={{ background: C.cyan, color: C.graphite, fontWeight: 700, fontSize: 14, padding: '12px 28px', border: 'none', cursor: 'pointer' }}>Continue to free sandbox →</button>
        </div>
      )}

      {mode === 'free' && (
        <>
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
                  <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 12 }}>SELECTED — {selectedFig.label}</p>
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
                    Click {pointsNeeded === 2 ? 'two cells (its reference dots, in order)' : 'a cell'} on the container.
                  </p>
                  {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 12 }}>{notation}</code>}
                  <div className="flex gap-2">
                    <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                      style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '8px 16px', border: 'none', flex: 1, cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default' }}>Place</button>
                    <button onClick={() => selectFigure(selectedFig)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px' }}>Reset points</button>
                  </div>
                </div>
              ) : (
                <div style={{ border: `1px solid ${C.steelDim}30`, background: C.graphite2 }} className="p-5">
                  <p style={{ color: C.steelDim, fontSize: 13 }}>Pick a figure below to start placing.</p>
                </div>
              )}
              <FigureBankPanel title="ALL 27 FIGURES — FREE PLACEMENT" panelColor={C.steel} itemColor={C.cyan}
                onSelect={selectFigure} getStatus={() => ({ used: false, actionable: true, hint: '' })} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
