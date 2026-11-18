import { useEffect, useState } from 'react'
import Login from './Login'
import Boards from './Boards'
import Board from './Board'
import Dashboard from './Dashboard'
import Settings from './Settings'
import { api, subscribe } from './api'
import { chime, setSound, soundOn, unlock } from './sound'

type View = 'dash' | 'kanban' | 'set'

export default function App() {
  const [me, setMe] = useState<any>(undefined)
  const [view, setView] = useState<View>('dash')
  const [boardId, setBoardId] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const [toasts, setToasts] = useState<any[]>([])
  const [sound, setSnd] = useState(soundOn())
  const [menu, setMenu] = useState(false)

  const loadMe = () => api('/me', 'GET', undefined, true).then(setMe).catch(() => setMe(null))
  const toast = (t: any) => {
    const id = Date.now() + Math.random()
    setToasts(x => [...x, { id, ...t }])
    setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 7000)
  }

  useEffect(() => {
    loadMe()
    const u = () => { unlock() }
    const err = (e: any) => toast({ error: true, title: e.detail })
    const out = () => setMe(null)
    window.addEventListener('pointerdown', u)
    window.addEventListener('apierror', err)
    window.addEventListener('unauthorized', out)
    return () => {
      window.removeEventListener('pointerdown', u)
      window.removeEventListener('apierror', err)
      window.removeEventListener('unauthorized', out)
    }
  }, [])

  const authed = !!me
  useEffect(() => {
    if (!authed) return
    return subscribe((b: any) => {
      setTick(t => t + 1)
      const played = soundOn() ? chime() : true
      toast({ title: b.title, board: b.board_id, mute: !played })
    })
  }, [authed])

  if (me === undefined) return <div className="grid h-full place-items-center bg-ink text-mute">Memuat...</div>
  if (!me) return <Login onDone={loadMe} />

  const superadmin = me.role === 'superadmin'
  const go = (v: View, b: number | null = null) => {
    setView(v)
    setBoardId(b)
    setMenu(false)
    api('/me', 'GET', undefined, true).then(setMe).catch((e: any) => { if (e.status === 401) setMe(null) })
  }
  const logout = async () => {
    await api('/auth/logout', 'POST', undefined, true).catch(() => {})
    setMe(null)
    setView('dash')
    setBoardId(null)
  }
  const nav = (on: boolean) => 'w-full rounded-md px-3 py-2 text-left ' + (on ? 'border-l-2 border-brass bg-raise' : 'text-mute hover:text-white')

  return (
    <div className="flex h-full bg-ink font-sans">
      {menu && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMenu(false)} />}
      <aside className={(menu ? 'fixed inset-y-0 left-0 z-40 flex md:static' : 'hidden md:flex') + ' w-56 shrink-0 flex-col border-r border-line bg-panel'}>
        <div className="border-b border-line p-4">
          <div className="font-serif text-xl font-semibold text-brass">Kisah Kekal</div>
          <div className="text-xs text-mute">Photobooth pipeline</div>
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          <button className={nav(view === 'dash')} onClick={() => go('dash')}>Dashboard</button>
          <button className={nav(view === 'kanban')} onClick={() => go('kanban')}>Papan kanban</button>
          {superadmin && <button className={nav(view === 'set')} onClick={() => go('set')}>Pengaturan</button>}
        </nav>
        <div className="m-3 flex items-center gap-2 rounded-lg border border-line p-2 text-xs">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brass/20 font-semibold text-brass">{me.email[0].toUpperCase()}</div>
          <span className="min-w-0 flex-1 truncate">{me.email}<span className="block text-mute">{me.role}</span></span>
          <button className="text-mute hover:text-white" onClick={logout}>Keluar</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 md:hidden">
          <button className="text-sm" onClick={() => setMenu(true)}>Menu</button>
          <span className="font-serif font-semibold text-brass">Kisah Kekal</span>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          {view === 'dash' ? <Dashboard tick={tick} me={me} onOpen={(id: number) => go('kanban', id)} />
            : view === 'set' && superadmin ? <Settings me={me} />
            : boardId ? <Board id={boardId} tick={tick} onBack={() => setBoardId(null)} />
            : <Boards onOpen={setBoardId} />}
        </main>
      </div>
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => t.error ? (
          <div key={t.id} className="w-72 rounded-xl border border-bad/50 bg-panel p-3 text-sm shadow-xl shadow-black/50">{t.title}</div>
        ) : (
          <button key={t.id} className="block w-72 rounded-xl border border-brass/50 bg-panel p-3 text-left shadow-xl shadow-black/50" onClick={() => go('kanban', t.board)}>
            <div className="text-xs text-brass">Booking baru masuk</div>
            <div className="font-medium">{t.title}</div>
            {t.mute && <div className="mt-1 text-xs text-mute">Suara belum aktif, klik halaman sekali</div>}
          </button>
        ))}
      </div>
    </div>
  )
}