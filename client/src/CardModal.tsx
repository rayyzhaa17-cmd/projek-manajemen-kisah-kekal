import { useEffect, useState } from 'react'
import { api } from './api'
import CardLabelEditor from './CardLabel'
import { DOT, GROUPS, INP, LABEL, missing, parseBooking, statusOf, titleOf } from './fields'

export default function CardModal({ card, onClose, onSaved, onRefresh }: any) {
  const [title, setTitle] = useState(card.title)
  const [d, setD] = useState<any>(card.data || {})
  const [paste, setPaste] = useState('')
  const labels = card.labels || []
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const set = (k: string, v: string) => setD((p: any) => ({ ...p, [k]: v }))

  const fill = (text: string) => {
    setPaste(text)
    const p = parseBooking(text)
    setD((x: any) => ({ ...x, ...p }))
    if (titleOf(p)) setTitle(titleOf(p))
  }
  const save = async () => {
    await api('/cards/' + card.id, 'PATCH', { title: title.trim() || 'Booking baru', data: d })
    onSaved()
  }
  const del = async () => {
    if (confirm('Hapus kartu ini?')) {
      await api('/cards/' + card.id, 'DELETE')
      onSaved()
    }
  }

  const m = missing(d)
  const st = statusOf(d)
  const cls = (k: string) => INP + (m.main.includes(k) ? ' ring-1 ring-bad/60' : m.other.includes(k) ? ' ring-1 ring-warn/50' : '')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="my-6 w-full max-w-2xl rounded-xl border border-line bg-panel">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <span className={'h-3 w-3 shrink-0 rounded-full ' + DOT[st]} />
          <input className="min-w-0 flex-1 bg-transparent font-serif text-xl font-semibold outline-none" value={title} onChange={e => setTitle(e.target.value)} />
          <span className="text-xs text-mute">{LABEL[st]}</span>
        </div>
        <div className="space-y-5 p-4">
          <div>
            <span className="mb-2 block text-xs text-mute">Catatan</span>
            <CardLabelEditor cardId={card.id} labels={labels} onChange={onRefresh} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-mute">Tempel teks form booking, kolom terisi otomatis</span>
            <textarea rows={3} className={INP} value={paste} onChange={e => fill(e.target.value)} />
          </label>
          {GROUPS.map(g => (
            <section key={g.title}>
              <h4 className="mb-2 text-sm font-semibold text-brass">{g.title}</h4>
              <div className="grid grid-cols-2 gap-3">
                {g.fields.map(([k, label]) => (
                  <label key={k} className={['alamat', 'catatan', 'urutan'].includes(k) ? 'col-span-2' : ''}>
                    <span className="mb-1 block text-xs text-mute">{label}</span>
                    {k === 'cetak' ? (
                      <select className={cls(k)} value={d[k] || ''} onChange={e => set(k, e.target.value)}>
                        <option value="">Pilih</option>
                        <option>Ya</option>
                        <option>Tidak</option>
                      </select>
                    ) : k === 'alamat' || k === 'catatan' ? (
                      <textarea rows={2} className={cls(k)} value={d[k] || ''} onChange={e => set(k, e.target.value)} />
                    ) : (
                      <input className={cls(k)} type={k === 'tanggal' ? 'date' : 'text'} list={k === 'paket' ? 'paket' : undefined} value={d[k] || ''} onChange={e => set(k, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-line p-4">
          <button className="text-sm text-mute hover:text-bad" onClick={del}>Hapus kartu</button>
          <button className="ml-auto text-sm text-mute hover:text-white" onClick={onClose}>Batal</button>
          <button className="rounded-md bg-brass px-4 py-1.5 text-sm font-semibold text-ink" onClick={save}>Simpan</button>
        </div>
      </div>
      <datalist id="paket">
        <option value="Bronze" />
        <option value="Silver" />
        <option value="Gold" />
      </datalist>
    </div>
  )
}
