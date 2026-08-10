export const pageCopy = {
  figures: { eyebrow: 'FIGURE CATALOG', title: 'All 27 figures', intro: 'The complete fixed set, with reference points and every legal rotation. No mirrored shortcuts.', note: 'Geometry is loaded from otgruzka_figures.json.' },
  rules: { eyebrow: 'RULES', title: 'Make the hard move legal', intro: 'A quick read before your first match. The server confirms every rated placement.', sections: [
    ['01', 'Support', 'Nothing floats. Each cell rests on the floor or on cargo already placed.'],
    ['02', 'Steps', 'A rise of up to three cells is passable. Four cells is a wall.'],
    ['03', 'Overhang', 'Unsupported weight has a limit. Any exception requires both players to approve it.'],
    ['04', 'Return path', 'After placement, the route back to exit A0 must still be open.'],
    ['05', 'Row closure', 'Close five horizontal or vertical rows, or force a placement beyond the container.'],
  ] },
  lore: { eyebrow: 'THE LEGEND OF THE LODARS', title: 'The position remembers', intro: 'The Lodars learned to treat every object as a question of when, where, and how it should be placed.', body: 'Their discipline was simple to describe and difficult to master: accept the piece you are given, preserve the path behind it, and make the next request worse for the opponent.', prologueLabel: 'ПРАЛОГ', prologue: 'Мазгавая тэрапія знаходзіцца недзе побач з працоўнай.' },
  profile: { eyebrow: 'PROFILE', title: 'Your level, in public', intro: 'A PuzzleStow profile records the level you can defend, not the hints you had access to.', fields: [['QUALIFICATION', 'MidLod'], ['RATED MATCHES', '47'], ['NEXT MILESTONE', 'Senior Lodar']], note: 'Use a nickname on PuzzleStow if you want. PairSec service bookings keep verified identity transparent.' },
} as const
