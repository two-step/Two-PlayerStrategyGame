import { pageCopy } from '../content/page-copy'

const C = { bg: '#1C1F26', panel: '#22262f', cyan: '#1FA7A3', blue: '#1F4F82', text: '#F5F7FA', muted: '#A3A9B5', dim: '#6b7280' }
type Page = 'home' | 'figures' | 'rules' | 'lore' | 'profile'
export function SecondaryPage({ page, setPage }: { page: Exclude<Page, 'home'>; setPage: (p: Page) => void }) {
  const copy = pageCopy[page]
  return <main className="min-h-screen bg-[#1C1F26] px-6 pb-24 pt-28 text-[#F5F7FA]">
    <div className="mx-auto max-w-6xl">
      <p className="mb-4 font-mono text-[11px] tracking-[.16em] text-[#1FA7A3]">{copy.eyebrow}</p>
      <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">{copy.title}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#A3A9B5]">{copy.intro}</p>
      {page === 'figures' && <Figures />}
      {page === 'rules' && <Rules />}
      {page === 'lore' && <Lore />}
      {page === 'profile' && <Profile />}
      <button onClick={() => setPage('home')} className="mt-16 border border-[#1FA7A3]/60 px-5 py-3 text-sm text-[#1FA7A3] hover:bg-[#1FA7A3]/10">Back to landing</button>
    </div>
  </main>
}
function Figures() { return <><div className="mt-14 grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-9">{Array.from({ length: 27 }, (_, i) => <button key={i} className="aspect-square border border-[#1FA7A3]/20 bg-[#22262f] font-mono text-xs text-[#1FA7A3] hover:border-[#1FA7A3]">F{String(i + 1).padStart(2, '0')}</button>)}</div><p className="mt-6 font-mono text-xs text-[#6b7280]">{pageCopy.figures.note}</p></> }
function Rules() { return <div className="mt-14 grid gap-4 md:grid-cols-2">{pageCopy.rules.sections.map(([n, title, body]) => <article key={n} className="border border-[#1FA7A3]/20 bg-[#22262f] p-6"><span className="font-mono text-xs text-[#1FA7A3]">{n}</span><h2 className="my-8 text-2xl font-semibold">{title}</h2><p className="text-[#A3A9B5]">{body}</p></article>)}</div> }
function Lore() { return <div className="mt-14 max-w-2xl border-l-2 border-[#1FA7A3] pl-6"><p className="text-lg leading-relaxed text-[#F5F7FA]">{pageCopy.lore.body}</p><div className="mt-10 border border-[#6b7280]/30 bg-[#22262f] p-5"><p className="font-mono text-xs tracking-[.14em] text-[#6b7280]">{pageCopy.lore.prologueLabel}</p><p className="mt-4 text-[#A3A9B5]">{pageCopy.lore.prologue}</p></div></div> }
function Profile() { return <div className="mt-14 grid max-w-2xl gap-3">{pageCopy.profile.fields.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-[#1FA7A3]/15 py-5"><span className="font-mono text-xs text-[#6b7280]">{label}</span><strong className="text-[#1FA7A3]">{value}</strong></div>)}<p className="mt-6 text-sm leading-relaxed text-[#A3A9B5]">{pageCopy.profile.note}</p></div> }
