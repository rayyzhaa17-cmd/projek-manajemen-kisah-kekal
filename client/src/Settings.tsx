import { useEffect, useState } from 'react'
import { api } from './api'
import { INP } from './fields'

const btn = 'rounded-md bg-brass px-3 py-1.5 text-sm font-semibold text-ink'

function UserRow({ u, me, flash, onDone }: any) {
  const [email, setEmail] = useState(u.email)
  const [role, setRole] = useState(u.role)
  const [password, setPassword] = useState('')

  const save = async () => {
    try {
      await api('/users/' + u.id, 'PATCH', { email, role, password: password || undefined }, true)
      setPassword('')
      flash('Akun disimpan')
      onDone()
    } catch (e: any) {
      flash(e.message)
    }
  }
  const del = async () => {
    if (!confirm('Hapus akun ' + u.email + '?')) return
    try {
      await api('/users/' + u.id, 'DELETE', undefined, true)
      flash('Akun dihapus')
      onDone()
    } catch (e: any) {
      flash(e.message)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <input className={INP + ' min-w-48 flex-1'} value={email} onChange={e => setEmail(e.target.value)} />
      <select className={INP + ' w-auto'} value={role} onChange={e => setRole(e.target.value)}>
        <option value="admin">admin</option>
        <option value="superadmin">superadmin</option>
      </select>
      <input className={INP + ' w-52'} type="password" autoComplete="new-password" placeholder="Password baru (opsional)" value={password} onChange={e => setPassword(e.target.value)} />
      <button className={btn} onClick={save}>Simpan</button>
      {u.id !== me.id && <button className="text-xs text-mute hover:text-bad" onClick={del}>Hapus</button>}
    </div>
  )
}

export default function Settings({ me }: { me: any }) {
  const [users, setUsers] = useState<any[]>([])
  const [log, setLog] = useState<any[]>([])
  const [f, setF] = useState({ email: '', password: '', role: 'admin' })
  const [pw, setPw] = useState({ current: '', next: '' })
  const [msg, setMsg] = useState('')
  const load = () => {
    api('/users').then(setUsers)
    api('/audit').then(setLog)
  }
  useEffect(() => { load() }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const add = async () => {
    try {
      await api('/users', 'POST', f, true)
      setF({ email: '', password: '', role: 'admin' })
      flash('Akun ditambahkan')
      load()
    } catch (e: any) {
      flash(e.message)
    }
  }
  const change = async () => {
    try {
      await api('/me/password', 'PATCH', pw, true)
      setPw({ current: '', next: '' })
      flash('Password diganti')
      load()
    } catch (e: any) {
      flash(e.message)
    }
  }

  const panel = 'rounded-xl border border-line bg-panel p-5'
  const h3 = 'mb-3 font-serif text-lg font-semibold'

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <h2 className="font-serif text-2xl font-semibold">Pengaturan</h2>
      {msg && <p className="rounded-md border border-brass/40 px-3 py-2 text-sm text-brass">{msg}</p>}

      <section className={panel}>
        <h3 className={h3}>Akun</h3>
        <p className="mb-2 text-xs text-mute">Superadmin mengelola akun dan memakai semua fitur. Admin hanya memakai fitur umum, tanpa Pengaturan dan export CSV. Password 10 sampai 72 karakter, mengganti password membuat sesi login akun itu berakhir.</p>
        <div className="divide-y divide-line">
          {users.map(u => <UserRow key={u.id} u={u} me={me} flash={flash} onDone={load} />)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <input className={INP + ' min-w-48 flex-1'} placeholder="Email akun baru" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <select className={INP + ' w-auto'} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            <option value="admin">admin</option>
            <option value="superadmin">superadmin</option>
          </select>
          <input className={INP + ' w-52'} type="password" autoComplete="new-password" placeholder="Password, minimal 10" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
          <button className={btn} onClick={add}>Tambah akun</button>
        </div>
      </section>

      <section className={panel}>
        <h3 className={h3}>Ganti password sendiri</h3>
        <div className="flex flex-wrap gap-2">
          <input className={INP + ' flex-1'} type="password" autoComplete="current-password" placeholder="Password lama" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
          <input className={INP + ' flex-1'} type="password" autoComplete="new-password" placeholder="Password baru, minimal 10" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          <button className={btn} onClick={change}>Simpan</button>
        </div>
      </section>

      <section className={panel}>
        <h3 className={h3}>Log aktivitas</h3>
        <div className="max-h-96 overflow-auto text-xs">
          {log.length === 0 ? <p className="text-mute">Belum ada aktivitas.</p> : log.map(r => (
            <div key={r.id} className="flex flex-wrap gap-x-3 border-b border-line py-1.5">
              <span className="w-28 shrink-0 text-mute">{new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="w-44 shrink-0 truncate">{r.email || 'sistem'}</span>
              <span className="font-medium">{r.action}</span>
              <span className="min-w-0 flex-1 truncate text-mute">{r.detail}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}