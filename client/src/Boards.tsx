import { useEffect, useState } from 'react'
import { api } from './api'
import { INP } from './fields'

export default function Boards({ onOpen }: { onOpen: (id: number) => void }) {
  const [boards, setBoards] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const load = () => api('/boards').then(setBoards)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!title.trim()) return
    await api('/boards', 'POST', { title })
    setTitle('')
    load()
  }
  const del = async (id: number) => {
    if (confirm('Hapus board ini beserta semua isinya?')) {
      await api('/boards/' + id, 'DELETE')
      load()
    }
  }
  const toggle = async (b: any) => {
    await api('/boards/' + b.id, 'PATCH', { no_follow: !b.no_follow })
    load()
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="mb-5 font-serif text-2xl font-semibold">Papan kanban</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {boards.map(b => (
          <div key={b.id} className="group relative flex h-28 cursor-pointer flex-col justify-between rounded-xl border border-line bg-panel p-3 hover:border-brass/60" onClick={() => onOpen(b.id)}>
            <span className="font-medium">{b.title}</span>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-mute" onClick={e => e.stopPropagation()}>
              <input type="checkbox" className="accent-brass" checked={!!b.no_follow} onChange={() => toggle(b)} />
              Tanpa auto follow up
            </label>
            <button className="absolute right-2 top-2 hidden text-xs text-mute hover:text-bad group-hover:block" onClick={e => { e.stopPropagation(); del(b.id) }}>Hapus</button>
          </div>
        ))}
        <div className="h-28 space-y-2 rounded-xl border border-dashed border-line p-3">
          <input className={INP} placeholder="Nama board baru" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="rounded-md bg-brass px-3 py-1 text-sm font-semibold text-ink" onClick={add}>Buat board</button>
        </div>
      </div>
    </div>
  )
}
