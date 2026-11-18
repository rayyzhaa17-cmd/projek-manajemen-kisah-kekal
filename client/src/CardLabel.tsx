import { useState } from 'react'
import { api } from './api'

export const COLORS: Record<string, string> = { biru: 'bg-blue-500', pink: 'bg-pink-500' }

// tampil di depan kartu: judul berwarna, kalau tanpa judul jadi garis tipis
export function LabelStrip({ labels }: { labels: any[] }) {
  if (!labels || !labels.length) return null
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {labels.map((l: any) => l.title ? (
        <span key={l.id} className={'max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white ' + (COLORS[l.color] || COLORS.biru)}>{l.title}</span>
      ) : (
        <span key={l.id} className={'h-2 w-10 rounded-sm ' + (COLORS[l.color] || COLORS.biru)} />
      ))}
    </div>
  )
}

const EMPTY = { title: '', isi: '', color: 'biru' }

export default function CardLabelEditor({ cardId, labels, onChange }: { cardId: number; labels: any[]; onChange: () => void }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [open, setOpen] = useState(false)
  const field = 'w-full rounded-md border border-line bg-raise px-2 py-1 text-sm outline-none focus:border-brass'

  const start = (l?: any) => {
    setEditId(l ? l.id : null)
    setForm(l ? { title: l.title || '', isi: l.isi || '', color: l.color } : EMPTY)
    setOpen(true)
  }
  const stop = () => { setOpen(false); setEditId(null); setForm(EMPTY) }
  const save = async () => {
    if (!form.title.trim() && !form.isi.trim()) return stop()
    if (editId) await api('/labels/' + editId, 'PATCH', form)
    else await api('/cards/' + cardId + '/labels', 'POST', form)
    stop()
    onChange()
  }
  const del = async (id: number) => {
    if (confirm('Hapus catatan ini?')) {
      await api('/labels/' + id, 'DELETE')
      onChange()
    }
  }

  return (
    <div className="space-y-2">
      {labels.map((l: any) => (
        <div key={l.id} className="flex gap-2 rounded-lg border border-line bg-ink p-2">
          <span className={'mt-0.5 h-5 w-1.5 shrink-0 rounded-full ' + (COLORS[l.color] || COLORS.biru)} />
          <div className="min-w-0 flex-1">
            {l.title && <div className="text-sm font-medium">{l.title}</div>}
            {l.isi && <div className="mt-0.5 whitespace-pre-wrap break-words text-xs text-mute">{l.isi}</div>}
          </div>
          <button className="text-xs text-mute hover:text-white" onClick={() => start(l)}>Ubah</button>
          <button className="text-xs text-mute hover:text-bad" onClick={() => del(l.id)}>Hapus</button>
        </div>
      ))}
      {open ? (
        <div className="space-y-2 rounded-lg border border-line bg-ink p-3">
          <input autoFocus className={field} maxLength={100} placeholder="Judul catatan (tampil di depan kartu)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea rows={3} className={field} maxLength={3000} placeholder="Isi catatan, misalnya brief desain atau brief CS" value={form.isi} onChange={e => setForm({ ...form, isi: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2">
            {['biru', 'pink'].map(c => (
              <button
                key={c}
                className={'h-7 w-16 rounded-md border-2 text-xs font-medium text-white ' + COLORS[c] + (form.color === c ? ' border-white' : ' border-transparent opacity-50')}
                onClick={() => setForm({ ...form, color: c })}
              >
                {c}
              </button>
            ))}
            <button className="ml-auto rounded-md bg-brass px-3 py-1 text-sm font-semibold text-ink" onClick={save}>{editId ? 'Simpan' : 'Tambah'}</button>
            <button className="text-sm text-mute hover:text-white" onClick={stop}>Batal</button>
          </div>
        </div>
      ) : (
        <button className="rounded-md border border-dashed border-line px-2 py-1 text-xs text-mute hover:border-brass hover:text-white" onClick={() => start()}>+ Catatan</button>
      )}
    </div>
  )
}
