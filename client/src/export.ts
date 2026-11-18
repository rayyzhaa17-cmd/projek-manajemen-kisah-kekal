import { LABEL, statusOf } from './fields'

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
const idle = (c: any) => (c.updated_at ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 864e5) : '')

const COLS: [string, (r: any) => any][] = [
  ['Tanggal booking masuk', r => ymd(r.c.created_at)],
  ['Board', r => r.b.title],
  ['Tahap', r => r.l.title],
  ['Status tahap', r => (r.l.is_done ? 'Selesai' : 'Pending')],
  ['Nama', r => r.c.title],
  ['Panggilan pria', r => r.c.data.pria],
  ['Panggilan wanita', r => r.c.data.wanita],
  ['Urutan nama', r => r.c.data.urutan],
  ['Tanggal acara', r => r.c.data.tanggal],
  ['Paket', r => r.c.data.paket],
  ['Cetak sendiri', r => r.c.data.cetak],
  ['Tema page', r => r.c.data.tema],
  ['Template frame', r => r.c.data.frame],
  ['Template QR cetak', r => r.c.data.qr],
  ['Warna web', r => r.c.data.warna],
  ['Add on', r => r.c.data.addon],
  ['Catatan', r => r.c.data.catatan],
  ['Nama penerima', r => r.c.data.penerima],
  ['No HP', r => r.c.data.hp],
  ['Alamat', r => r.c.data.alamat],
  ['Email', r => r.c.data.email],
  ['Catatan kartu', r => (r.c.labels || []).map((x: any) => (x.title ? x.title + ': ' : '') + (x.isi || '')).join(' | ')],
  ['Status data', r => LABEL[statusOf(r.c.data)]],
  ['Hari tanpa perubahan', r => idle(r.c)],
]

// cegah rumus Excel dari data luar, nomor HP dijaga sebagai teks supaya angka 0 di depan tidak hilang
function cell(v: any, phone = false) {
  let s = v == null ? '' : String(v)
  if (phone && /^\d+$/.test(s)) return '"=""' + s + '"""'
  if (/^[=@]|^[+\-][^0-9\s]/.test(s)) s = "'" + s
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function downloadCsv(name: string, rows: any[]) {
  const head = COLS.map(([h]) => cell(h)).join(';')
  const body = rows.map(r => COLS.map(([h, f]) => cell(f(r), h === 'No HP')).join(';'))
  const text = '\ufeffsep=;\r\n' + [head, ...body].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
