import { useEffect, useRef, useState } from 'react'
import { DndContext, DragMoveEvent, DragOverlay, PointerSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core'
import { api } from './api'
import CardModal from './CardModal'
import { DOT, INP, MONTHS, fmtDate, followDays, parseBooking, statusOf, titleOf } from './fields'
import { LabelStrip } from './CardLabel'

const qsa = (sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(sel))

function CardFace({ card, skip }: any) {
  const d = card.data || {}
  const st = statusOf(d)
  const fu = followDays(card, skip)
  return (
    <>
      <div className="flex items-start gap-2">
        <span className={'mt-1.5 h-2 w-2 shrink-0 rounded-full ' + DOT[st]} />
        <span className="font-medium leading-snug">{card.title}</span>
      </div>
      {(d.tanggal || d.paket || fu > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-mute">
          {d.tanggal && <span>{fmtDate(d.tanggal)}</span>}
          {d.paket && <span>{d.paket}</span>}
          {fu > 0 && <span className={'rounded px-1.5 py-0.5 font-medium ' + (st === 'merah' ? 'bg-bad/15 text-bad' : 'bg-warn/15 text-warn')}>Follow up {fu} hari</span>}
        </div>
      )}
    </>
  )
}

// slot kosong: tinggi dianimasikan 0 -> tinggi kartu, bikin kartu lain geser halus
function Slot({ on, h, anim }: any) {
  return (
    <div className="overflow-hidden" style={{ height: on ? h + 8 : 0, transition: anim ? 'height 150ms ease' : 'none' }}>
      <div className="rounded-lg bg-white/[0.06]" style={{ height: h }} />
    </div>
  )
}

function ListSlot({ on, w, h, anim }: any) {
  return (
    <div className="shrink-0 overflow-hidden" style={{ width: on ? w + 12 : 0, transition: anim ? 'width 150ms ease' : 'none' }}>
      <div className="rounded-xl bg-white/[0.06]" style={{ width: w, height: h }} />
    </div>
  )
}

function CardItem({ card, src, locked, skip, onOpen }: any) {
  const drag = useDraggable({ id: 'drag-' + card.id, disabled: locked })
  return (
    <div className={src ? '' : 'mb-2'} style={src ? { height: 0, overflow: 'hidden' } : undefined}>
      <div
        ref={drag.setNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        data-card={card.id}
        onClick={() => onOpen(card)}
        className={'rounded-lg border border-line bg-raise p-2.5 text-sm hover:border-brass/60 ' + (locked ? 'cursor-pointer' : 'cursor-grab')}
      >
        <LabelStrip labels={card.labels || []} />
        <CardFace card={card} skip={skip} />
      </div>
    </div>
  )
}

function ListCol({ list, cards, drag, filtering, skip, i, n, onChange, onOpen, onMove }: any) {
  const dh = useDraggable({ id: 'lh-' + list.id })
  const [mode, setMode] = useState('')
  const [text, setText] = useState('')
  const stop = (e: any) => e.stopPropagation()
  const btn = 'rounded px-1.5 py-0.5 text-mute hover:bg-raise hover:text-white disabled:opacity-30'

  const submit = async () => {
    if (!text.trim()) return
    const data = mode === 'paste' ? parseBooking(text) : {}
    const title = mode === 'paste' ? titleOf(data) || 'Booking baru' : text
    await api('/lists/' + list.id + '/cards', 'POST', { title, data })
    setText('')
    setMode('')
    onChange()
  }
  const rename = async () => {
    const t = prompt('Nama list', list.title)
    if (t && t.trim()) {
      await api('/lists/' + list.id, 'PATCH', { title: t })
      onChange()
    }
  }
  const toggleDone = async () => {
    await api('/lists/' + list.id, 'PATCH', { is_done: !list.is_done })
    onChange()
  }
  const del = async () => {
    if (confirm('Hapus list beserta semua kartunya?')) {
      await api('/lists/' + list.id, 'DELETE')
      onChange()
    }
  }

  const dc = drag && drag.type === 'card' ? drag : null
  const src = !!drag && drag.type === 'list' && drag.id === list.id
  const rows: any[] = []
  let k = 0
  cards.forEach((c: any) => {
    const isSrc = !!dc && dc.id === c.id
    if (!isSrc) {
      rows.push(<Slot key={'s' + c.id} on={!!dc && dc.listId === list.id && dc.index === k} h={dc && dc.h} anim={dc && dc.anim} />)
      k++
    }
    rows.push(<CardItem key={c.id} card={c} src={isSrc} locked={filtering} skip={skip} onOpen={onOpen} />)
  })
  rows.push(<Slot key="end" on={!!dc && dc.listId === list.id && dc.index === k} h={dc && dc.h} anim={dc && dc.anim} />)

  return (
    <div className="shrink-0" style={src ? { width: 0, overflow: 'hidden' } : { marginRight: 12 }}>
      <div data-list={list.id} className={'w-72 rounded-xl border bg-panel ' + (dc && dc.listId === list.id ? 'border-brass/70' : 'border-line')}>
        <div ref={dh.setNodeRef} {...dh.listeners} {...dh.attributes} className="flex cursor-grab items-center gap-1 px-3 py-2.5">
          <h3 className="min-w-0 flex-1 truncate font-serif font-semibold" title="Klik dua kali untuk ganti nama" onDoubleClick={rename}>{list.title}</h3>
          <span className="text-xs text-mute">{filtering ? cards.length + '/' + list.cards.length : list.cards.length}</span>
          <button className={btn + (list.is_done ? ' !text-ok' : '')} title="Tandai list ini sebagai selesai, dihitung di dashboard" onPointerDown={stop} onClick={toggleDone}>✓</button>
          <button className={btn} disabled={i === 0} onPointerDown={stop} onClick={() => onMove(list.id, i - 1)}>←</button>
          <button className={btn} disabled={i === n - 1} onPointerDown={stop} onClick={() => onMove(list.id, i + 1)}>→</button>
          <button className={btn} onPointerDown={stop} onClick={del}>Hapus</button>
        </div>
        <div className="px-2">{rows}</div>
        <div className="p-2">
          {mode ? (
            <div className="space-y-2">
              {mode === 'paste' ? (
                <textarea autoFocus rows={6} className={INP} placeholder="Tempel teks form booking di sini" value={text} onChange={e => setText(e.target.value)} />
              ) : (
                <input autoFocus className={INP} placeholder="Judul kartu" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
              )}
              <div className="flex items-center gap-2">
                <button className="rounded-md bg-brass px-3 py-1 text-sm font-semibold text-ink" onClick={submit}>{mode === 'paste' ? 'Buat dari teks' : 'Tambah'}</button>
                <button className={btn} onClick={() => { setMode(''); setText('') }}>Batal</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1 text-sm">
              <button className={btn + ' flex-1 text-left'} onClick={() => setMode('card')}>+ Kartu</button>
              <button className={btn} onClick={() => setMode('paste')}>Tempel form</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Board({ id, onBack, tick }: { id: number; onBack: () => void; tick?: number }) {
  const [board, setBoard] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState<any>(null)
  const [drag, setDrag] = useState<any>(null)
  const [f, setF] = useState({ q: '', date: '', month: '', status: '' })
  const dr = useRef<any>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const load = () => api('/boards/' + id).then(b => { if (!dr.current) setBoard(b) })
  useEffect(() => { load() }, [id, tick])

  const upd = (p: any) => {
    dr.current = p && { ...dr.current, ...p }
    setDrag(dr.current)
  }
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const filtering = !!(f.q || f.date || f.month || f.status)
  const show = (c: any, skip = false) => {
    const d = c.data || {}
    const hay = [c.title, d.pria, d.wanita, d.urutan, d.penerima, d.hp, d.email, d.paket, d.catatan].join(' ').toLowerCase()
    if (f.q && !hay.includes(f.q.toLowerCase())) return false
    if (f.date && d.tanggal !== f.date) return false
    if (f.month && (d.tanggal || '').slice(5, 7) !== f.month) return false
    if (f.status === 'followup') return followDays(c, skip) > 0
    return !f.status || statusOf(d) === f.status
  }

  const addList = async () => {
    if (!title.trim()) return
    await api('/boards/' + id + '/lists', 'POST', { title })
    setTitle('')
    load()
  }
  const moveList = async (lid: number, pos: number) => {
    await api('/lists/' + lid + '/move', 'PATCH', { position: pos })
    load()
  }

  const toggleFollow = async () => {
    await api('/boards/' + id, 'PATCH', { no_follow: !board.no_follow })
    load()
  }

  const onDragStart = (e: any) => {
    const s = String(e.active.id)
    const isList = s.startsWith('lh-')
    const did = Number(s.slice(isList ? 3 : 5))
    const r = document.querySelector(isList ? `[data-list="${did}"]` : `[data-card="${did}"]`)!.getBoundingClientRect()
    if (isList) {
      const index = board.lists.findIndex((l: any) => l.id === did)
      upd({ type: 'list', id: did, w: r.width, h: r.height, index, fromIndex: index, anim: false })
    } else {
      const list = board.lists.find((l: any) => l.cards.some((c: any) => c.id === did))
      const index = list.cards.findIndex((c: any) => c.id === did)
      upd({ type: 'card', id: did, h: r.height, listId: list.id, index, fromList: list.id, fromIndex: index, anim: false })
    }
    setTimeout(() => dr.current && upd({ anim: true }), 50)
  }

  const onDragMove = (e: DragMoveEvent) => {
    const d = dr.current
    if (!d) return
    const px = (e.activatorEvent as PointerEvent).clientX + e.delta.x
    const py = (e.activatorEvent as PointerEvent).clientY + e.delta.y
    if (d.type === 'list') {
      const others = qsa('[data-list]').filter(n => Number(n.dataset.list) !== d.id)
      const index = others.filter(n => { const r = n.getBoundingClientRect(); return r.left + r.width / 2 < px }).length
      if (index !== d.index) upd({ index })
      return
    }
    let best: any = null
    let bd = Infinity
    qsa('[data-list]').forEach(n => {
      const r = n.getBoundingClientRect()
      const dx = px < r.left ? r.left - px : px > r.right ? px - r.right : 0
      if (dx < bd) { bd = dx; best = n }
    })
    if (!best) return
    const listId = Number(best.dataset.list)
    const index = qsa('[data-card]', best).filter(n => Number(n.dataset.card) !== d.id).filter(n => { const r = n.getBoundingClientRect(); return r.top + r.height / 2 < py }).length
    if (listId !== d.listId || index !== d.index) upd({ listId, index })
  }

  const onDragEnd = async () => {
    const d = dr.current
    if (!d || !board) return upd(null)
    if (d.type === 'list') {
      if (d.index === d.fromIndex) return upd(null)
      const lists = [...board.lists]
      const [m] = lists.splice(d.fromIndex, 1)
      lists.splice(d.index, 0, m)
      setBoard({ ...board, lists })
      upd(null)
      await api('/lists/' + d.id + '/move', 'PATCH', { position: d.index })
      return load()
    }
    if (d.listId === d.fromList && d.index === d.fromIndex) return upd(null)
    const card = board.lists.flatMap((l: any) => l.cards).find((c: any) => c.id === d.id)
    const lists = board.lists.map((l: any) => ({ ...l, cards: l.cards.filter((c: any) => c.id !== d.id) }))
    const target = lists.find((l: any) => l.id === d.listId)
    target.cards.splice(Math.min(d.index, target.cards.length), 0, card)
    setBoard({ ...board, lists })
    upd(null)
    await api('/cards/' + d.id + '/move', 'PATCH', { list_id: d.listId, position: d.index })
    load()
  }

  if (!board) return <p className="p-8 text-mute">Memuat board...</p>
  const total = board.lists.reduce((s: number, l: any) => s + l.cards.length, 0)
  const dl = drag && drag.type === 'list' ? drag : null
  const rows: any[] = []
  let k = 0
  board.lists.forEach((l: any, i: number) => {
    const isSrc = !!dl && dl.id === l.id
    if (!isSrc) {
      rows.push(<ListSlot key={'ls' + l.id} on={!!dl && dl.index === k} w={dl && dl.w} h={dl && dl.h} anim={dl && dl.anim} />)
      k++
    }
    rows.push(<ListCol key={l.id} list={l} cards={l.cards.filter((c: any) => show(c, !!board.no_follow || !!l.is_done))} drag={drag} filtering={filtering} skip={!!board.no_follow || !!l.is_done} i={i} n={board.lists.length} onChange={load} onOpen={setOpen} onMove={moveList} />)
  })
  rows.push(<ListSlot key="lend" on={!!dl && dl.index === k} w={dl && dl.w} h={dl && dl.h} anim={dl && dl.anim} />)
  const ghostCard = drag && drag.type === 'card' ? board.lists.flatMap((l: any) => l.cards).find((c: any) => c.id === drag.id) : null
  const ghostList = dl ? board.lists.find((l: any) => l.id === dl.id) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <h2 className="mr-auto font-serif text-xl font-semibold">{board.title}</h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-mute" title="Centang untuk board arsip, kartu di board ini tidak diberi auto follow up">
          <input type="checkbox" className="accent-brass" checked={!!board.no_follow} onChange={toggleFollow} />
          Tanpa auto follow up
        </label>
        <input className={INP + ' w-52'} placeholder="Cari nama mempelai..." value={f.q} onChange={e => set('q', e.target.value)} />
        <input className={INP + ' w-36'} type="date" value={f.date} onChange={e => set('date', e.target.value)} />
        <select className={INP + ' w-auto'} value={f.month} onChange={e => set('month', e.target.value)}>
          <option value="">Semua bulan</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <select className={INP + ' w-auto'} value={f.status} onChange={e => set('status', e.target.value)}>
          <option value="">Semua status</option>
          <option value="hijau">Lengkap</option>
          <option value="kuning">Kurang</option>
          <option value="merah">Data kosong</option>
          <option value="followup">Perlu follow up</option>
        </select>
        {filtering && <button className="text-sm text-mute hover:text-white" onClick={() => setF({ q: '', date: '', month: '', status: '' })}>Reset</button>}
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => upd(null)}>
        <div className="flex flex-1 items-start overflow-auto p-4">
          {rows}
          <div className="w-72 shrink-0 rounded-xl border border-dashed border-line p-2">
            <div className="flex gap-2">
              <input className={INP} placeholder="Nama list baru" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addList()} />
              <button className="rounded-md bg-brass px-3 text-sm font-semibold text-ink" onClick={addList}>+ List</button>
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {ghostCard ? (
            <div className="w-full rounded-lg border border-line bg-raise p-2.5 text-sm opacity-60 shadow-lg shadow-black/40">
              <CardFace card={ghostCard} />
            </div>
          ) : ghostList ? (
            <div className="w-72 rotate-2 rounded-xl border border-brass/50 bg-panel shadow-2xl shadow-black/60">
              <div className="px-3 py-2.5 font-serif font-semibold">{ghostList.title}</div>
              <div className="space-y-2 px-2 pb-3">
                {ghostList.cards.map((c: any) => <div key={c.id} className="rounded-lg border border-line bg-raise p-2.5 text-sm">{c.title}</div>)}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="flex items-center justify-between border-t border-line px-5 py-2 text-xs text-mute">
        <button className="hover:text-white" onClick={onBack}>Ganti board</button>
        <span>{filtering ? 'Filter aktif, geser kartu dimatikan. ' : ''}{board.lists.length} kolom, {total} kartu</span>
      </div>
      {open && <CardModal card={board.lists.flatMap((l: any) => l.cards).find((c: any) => c.id === open.id) || open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load() }} onRefresh={load} />}
    </div>
  )
}
