export const landingCopy = {
  hero: {
    eyebrow: 'TWO-PLAYER STRATEGY / PERFECT INFORMATION',
    title: ['You do not choose', 'your cargo.', 'Your opponent does.'],
    description: 'PuzzleStow is the strategy game where every piece is a problem set by someone else. Place 27 fixed figures inside a 15x10 container, keep the route open, and outthink the next request.',
    primaryCta: 'Play your first rated match', secondaryCta: 'See how it works', tertiaryCta: 'Explore the sandbox',
    proofLabel: 'A SAMPLE MOVE', proofNotation: '07B9C10', proofDescription: 'Figure 7, placed from B9 to C10.',
    visualLabel: 'CONTAINER 15x11 / TRAINING VIEW', visualNote: 'Start with an extra row while you learn. Move to the 15x10 competitive container when the geometry feels familiar.', incomingLabel: 'INCOMING', incomingDescription: 'F14, chosen by your opponent',
  },
  difference: { eyebrow: 'WHAT MAKES IT DIFFERENT', title: 'Strategy. Geometry. Honest play.', description: 'Most games ask what you want to do next. PuzzleStow asks whether you can make the next problem work. Both players see the full position. There is no fog of war, no lucky draw, and no hint engine in rated play.' },
  rules: { eyebrow: 'HOW IT WORKS', title: 'Four rules. Every move matters.', items: [
    { number: '01', title: 'Support', description: 'Nothing floats. Every cell rests on the floor or on cargo already placed.' },
    { number: '02', title: 'Steps', description: 'A rise of up to three cells is passable. Four cells is a wall.' },
    { number: '03', title: 'Overhang', description: 'Unsupported weight has a limit. Any exception requires both players to approve it.' },
    { number: '04', title: 'Return path', description: 'After placement, the route back to exit A0 must still be open.' },
  ] },
  figures: { eyebrow: 'FIGURE CATALOG', title: '27 distinct problems.', description: 'One fixed set. Up to four orientations each. No mirrors disguised as shortcuts.', cta: 'Inspect all 27 figures' },
  qualification: { eyebrow: 'QUALIFICATION', title: 'Earn the level you can defend.', description: 'Seven tiers of verified ability, earned through rated play. No purchases, no shortcuts, no AI assistance.', tiers: [['UL', 'UnderLodar', 'Learn the rules.'], ['Ld', 'Lodar', 'Place with control.'], ['ML', 'MidLod', 'Read the trap.'], ['SLd', 'Senior Lodar', 'Manage the route.'], ['LL', 'LeadLod', 'Close the rows.'], ['Mr', 'MasterLod', 'Shape the match.'], ['PL', 'ProfiLod', 'See the position first.']] },
  integrity: { quote: 'Your qualification should measure your thinking, not your access to a hint.', body: 'There is no AI move advisor in rated play. Not free. Not premium. Not ever. Practice and Sandbox are for training; rated results belong to the player who made the decisions.', audience: 'For people who are done confusing engine access with skill.' },
  modes: { eyebrow: 'GAME MODES', title: 'Start where you are. Play for real when ready.', items: [
    { tag: 'RATED', title: 'Rated Play', badge: 'Affects qualification', description: 'Face another player on the 15x10 field. Every request, placement, and result counts.', size: '15x10', cta: 'Play rated' },
    { tag: 'UNRATED', title: 'Practice', badge: 'No rating effect', description: 'Train against an AI opponent without risking your qualification. Learn the rhythm before the stakes are real.', size: '15x10', cta: 'Practice now' },
    { tag: 'FREE', title: 'Sandbox', badge: 'No rating effect', description: 'Place freely on the 15x11 training field. Test shapes, steps, routes, and bad ideas safely.', size: '15x11', cta: 'Open sandbox' },
  ] },
  pairsec: { eyebrow: 'FROM THE GAME TO REAL WORK', title: 'Think like a loader. Get recognized like a specialist.', description: 'PuzzleStow qualification connects the game to PairSec. From MidLod upward, your verified level can support performer status in the “Грузанём!” service ecosystem.', cta: 'See how PairSec connects' },
  faq: { eyebrow: 'FAQ', title: 'Common questions', items: [
    ['Is PuzzleStow the same as Tetris?', 'No. Your opponent chooses the figure, rows close horizontally and vertically, and the game is built around support, passage, and foresight.'],
    ['Can I use AI hints in rated play?', 'No. Rated play has no move advisor. Practice may include an AI opponent, but it never touches your rating.'],
    ['What is a Lodar qualification?', 'A verified level earned through rated matches, from UnderLodar to ProfiLod.'],
    ['Can I play without the app?', 'Yes. Draw two grids, keep the figure table nearby, and record moves in notation. A sheet of grid paper and a pen are enough.'],
    ['How does the fair-play exception work?', 'Both players must actively approve an overhang exception before the server records it.'],
  ] },
  footer: { description: 'The digital version of Otgruzka, a strategy game for people who think in systems.' },
} as const
