import { useEffect, useState } from 'react'
import { api } from './api'
import { downloadCsv, ymd } from './export'
import { INP, LABEL, followDays, statusOf } from './fields'

const STROKE: any = { hijau: 'stroke-ok', kuning: 'stroke-warn', merah: 'stroke-bad' }
const BG: any = { hijau: 'bg-ok', kuning: 'bg-warn', merah: 'bg-bad' }
const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const clientKey = (c: any) => String((c.data && (c.data.email || c.data.hp)) || c.title).trim().toLowerCase()

export default function Dashboard({ tick, onOpen, me }: { tick: number; onOpen: (id: number) => void; me: any }) {
  const [boards, setBoards] = useState<any[]>([])
  const [bid, setBid] = useState(0)
  const [board, setBoard] = useState<any>(null)
  const [month, setMonth] = useState(ymd(new Date().toISOString()).slice(0, 7))
  const [basis, setBasis] = useState('masuk')
  const [scope, setScope] = useState('one')

  useEffect(() => { api('/boards').then(b => { setBoards(b); setBid(x => x || (b.length ? b[b.length - 1].id : 0)) }) }, [tick])
  useEffect(() => { if (bid) api('/boards/' + bid).then(setBoard) }, [bid, tick])

  const cards: any[] = board ? board.lists.flatMap((l: any) => l.cards.map((c: any) => ({ ...c, done: !!l.is_done }))) : []
  const now = new Date()
  const born = (c: any) => new Date(c.created_at)
  const total = cards.length
  const items: [string, number][] = [
    ['Total booking', total],
    ['Booking hari ini', cards.filter(c => same(born(c), now)).length],
    ['Booking bulan ini', cards.filter(c => born(c).getMonth() === now.getMonth() && born(c).getFullYear() === now.getFullYear()).length],
    ['Pending', cards.filter(c => !c.done).length],
    ['Selesai', cards.filter(c => c.done).length],
    ['Total client', new Set(cards.map(clientKey)).size],
  ]
  const st: any = { hijau: 0, kuning: 0, merah: 0 }
  cards.forEach(c => { st[statusOf(c.data)]++ })
  const insight = total === 0
    ? 'Belum ada kartu booking di board ini.'
    : st.kuning + st.merah === 0
      ? 'Semua data booking sudah lengkap.'
      : `${st.kuning + st.merah} dari ${total} kartu datanya belum lengkap.`

  // customer yang diam 3 hari atau lebih, kecuali di list selesai atau board tanpa auto follow up
  const due: any[] = board && !board.no_follow
    ? board.lists
        .filter((l: any) => !l.is_done)
        .flatMap((l: any) => l.cards.map((c: any) => ({ id: c.id, title: c.title, list: l.title, days: followDays(c) })))
        .filter((c: any) => c.days > 0)
        .sort((a: any, b: any) => b.days - a.days)
    : []

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d })
  const trend = days.map(d => ({ d, n: cards.filter(c => same(born(c), d)).length }))
  const max = Math.max(1, ...trend.map(t => t.n))

  const R = 52
  const C = 2 * Math.PI * R
  let off = 0
  const segs = (['hijau', 'kuning', 'merah'] as const).map(k => {
    const len = total ? (st[k] / total) * C : 0
    const s = { k, len, off }
    off += len
    return s
  })

  const exportCsv = async () => {
    const ids = scope === 'all' ? boards.map(b => b.id) : [bid]
    const data = await Promise.all(ids.map(i => api('/boards/' + i)))
    const rows = data
      .flatMap((b: any) => b.lists.flatMap((l: any) => l.cards.map((c: any) => ({ b, l, c }))))
      .filter(({ c }: any) => !month || String(basis === 'acara' ? (c.data && c.data.tanggal) || '' : ymd(c.created_at)).startsWith(month))
    if (!rows.length) return alert('Tidak ada booking pada periode ini')
    downloadCsv('rekap-booking-' + (month || 'semua') + '.csv', rows)
    api('/audit/export', 'POST', { count: rows.length, month }, true).catch(() => {})
  }

  const label = 'mb-1 block text-xs text-mute'

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-serif text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-mute">Ringkasan booking dan kelengkapan data</p>
        </div>
        <select className={INP + ' w-auto'} value={bid} onChange={e => setBid(Number(e.target.value))}>
          {boards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <button className="rounded-md bg-brass px-3 py-1.5 text-sm font-semibold text-ink" onClick={() => bid && onOpen(bid)}>Buka papan kanban</button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {items.map(([lb, n]) => (
          <div key={lb} className="bg-panel p-4">
            <div className="text-xs text-mute">{lb}</div>
            <div className="mt-1 font-serif text-3xl font-semibold">{n}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-panel p-5">
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h3 className="font-serif text-lg font-semibold">Perlu follow up</h3>
          <span className={'font-serif text-2xl font-semibold ' + (due.length ? 'text-warn' : '')}>{due.length}</span>
          <span className="text-xs text-mute">customer diam 3 hari atau lebih</span>
        </div>
        {board && board.no_follow ? (
          <p className="text-sm text-mute">Board ini ditandai tanpa auto follow up.</p>
        ) : due.length === 0 ? (
          <p className="text-sm text-mute">Tidak ada customer yang perlu di-follow up.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {due.slice(0, 8).map(c => (
              <li key={c.id} className="flex cursor-pointer items-center gap-3 py-2 hover:text-brass" onClick={() => onOpen(bid)}>
                <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                <span className="text-xs text-mute">{c.list}</span>
                <span className="rounded bg-warn/15 px-1.5 py-0.5 text-xs font-medium text-warn">{c.days} hari</span>
              </li>
            ))}
          </ul>
        )}
        {due.length > 8 && <p className="mt-2 text-xs text-mute">dan {due.length - 8} lainnya, lihat di papan kanban</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-4 font-serif text-lg font-semibold">Kelengkapan data</h3>
          <div className="flex items-center gap-6">
            <div className="relative h-36 w-36 shrink-0">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-raise" />
                {segs.map(s => s.len > 0 && (
                  <circle key={s.k} cx="70" cy="70" r={R} fill="none" strokeWidth="16" className={STROKE[s.k]} strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.off} />
                ))}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="font-serif text-2xl font-semibold">{total}</div>
                  <div className="text-xs text-mute">kartu</div>
                </div>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {(['hijau', 'kuning', 'merah'] as const).map(k => (
                <li key={k} className="flex items-center gap-2">
                  <span className={'h-2.5 w-2.5 rounded-full ' + BG[k]} />
                  <span className="flex-1">{LABEL[k]}</span>
                  <span className="font-medium">{st[k]}</span>
                  <span className="w-10 text-right text-xs text-mute">{total ? Math.round((st[k] / total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-sm text-mute">{insight}</p>
        </section>

        <section className="rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-4 font-serif text-lg font-semibold">Booking masuk 14 hari terakhir</h3>
          <svg viewBox="0 0 560 150" className="w-full">
            {trend.map((t, i) => {
              const h = (t.n / max) * 90
              return (
                <g key={i}>
                  <rect x={i * 40 + 7} y={110 - Math.max(h, 2)} width="26" height={Math.max(h, 2)} rx="3" className={t.n ? 'fill-brass' : 'fill-line'} />
                  {t.n > 0 && <text x={i * 40 + 20} y={104 - h} textAnchor="middle" className="fill-mute text-[11px]">{t.n}</text>}
                  <text x={i * 40 + 20} y="132" textAnchor="middle" className="fill-mute text-[10px]">{t.d.getDate()}</text>
                </g>
              )
            })}
          </svg>
        </section>
      </div>

      {me && me.role === 'superadmin' && (
      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="mb-3 font-serif text-lg font-semibold">Rekap booking</h3>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label>
            <span className={label}>Bulan</span>
            <input type="month" className={INP + ' w-40'} value={month} onChange={e => setMonth(e.target.value)} />
          </label>
          <label>
            <span className={label}>Dihitung dari</span>
            <select className={INP + ' w-auto'} value={basis} onChange={e => setBasis(e.target.value)}>
              <option value="masuk">Tanggal booking masuk</option>
              <option value="acara">Tanggal acara</option>
            </select>
          </label>
          <label>
            <span className={label}>Cakupan</span>
            <select className={INP + ' w-auto'} value={scope} onChange={e => setScope(e.target.value)}>
              <option value="one">Board ini</option>
              <option value="all">Semua board</option>
            </select>
          </label>
          <button className="rounded-md bg-brass px-3 py-1.5 font-semibold text-ink" onClick={exportCsv}>Unduh CSV</button>
        </div>
        <p className="mt-2 text-xs text-mute">Kosongkan bulan untuk mengunduh semua data sebagai backup. File CSV bisa langsung dibuka di Excel.</p>
      </section>
      )}
    </div>
  )
}
