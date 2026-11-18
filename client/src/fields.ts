export const INP = 'w-full rounded-md border border-line bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-brass'
export const DOT: any = { hijau: 'bg-ok', kuning: 'bg-warn', merah: 'bg-bad' }
export const LABEL: any = { hijau: 'Lengkap', kuning: 'Kurang', merah: 'Data kosong' }

export const GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: 'Mempelai', fields: [['pria', 'Panggilan pria'], ['wanita', 'Panggilan wanita'], ['urutan', 'Urutan nama photobooth']] },
  { title: 'Acara', fields: [['tanggal', 'Tanggal acara'], ['paket', 'Paket'], ['cetak', 'Cetak sendiri']] },
  { title: 'Desain', fields: [['tema', 'Tema page'], ['frame', 'Template frame'], ['qr', 'Template QR cetak'], ['warna', 'Warna web'], ['addon', 'Add on'], ['catatan', 'Catatan']] },
  { title: 'Pengiriman QR cetak', fields: [['penerima', 'Nama penerima'], ['hp', 'No HP'], ['alamat', 'Alamat lengkap']] },
  { title: 'Akses mempelai', fields: [['email', 'Email']] },
]

const MAIN = ['pria', 'wanita', 'tanggal', 'paket']
const OTHER = ['urutan', 'cetak', 'tema', 'frame', 'warna', 'email']
const SHIP = ['qr', 'penerima', 'hp', 'alamat']

export function missing(d: any = {}) {
  const has = (k: string) => !!String(d[k] || '').trim()
  return {
    main: MAIN.filter(k => !has(k)),
    other: [...OTHER, ...(d.cetak === 'Ya' ? [] : SHIP)].filter(k => !has(k)),
  }
}

export function statusOf(d: any = {}) {
  const m = missing(d)
  return m.main.length ? 'merah' : m.other.length ? 'kuning' : 'hijau'
}

const MAP: [string, RegExp][] = [
  ['pria', /pria/], ['wanita', /wanita/], ['urutan', /urutan/], ['tanggal', /tanggal/], ['paket', /paket/],
  ['cetak', /cetak sendiri/], ['tema', /tema/], ['frame', /frame/], ['qr', /qr/], ['warna', /warna/],
  ['addon', /add ?on/], ['catatan', /catatan/], ['penerima', /penerima/], ['hp', /\bhp\b|telepon|whatsapp/],
  ['alamat', /alamat/], ['email', /e-?mail/],
]
const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']

function toIso(v: string) {
  const m = v.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
  if (!m) return v
  const k = m[2].slice(0, 3).toLowerCase().replace('may', 'mei').replace('aug', 'agu').replace('oct', 'okt').replace('dec', 'des')
  const i = BULAN.indexOf(k)
  return i < 0 ? v : m[3] + '-' + String(i + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0')
}

export function parseBooking(text: string) {
  const out: any = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const label = line.slice(0, i).trim().toLowerCase()
    const value = line.slice(i + 1).trim().replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    const hit = MAP.find(([, re]) => re.test(label))
    if (hit && value) out[hit[0]] = value
  }
  if (out.tanggal) out.tanggal = toIso(out.tanggal)
  if (out.cetak) out.cetak = /^y/i.test(out.cetak) ? 'Ya' : 'Tidak'
  return out
}

export const titleOf = (d: any) => d.urutan || (d.pria && d.wanita ? d.pria + ' & ' + d.wanita : '')

export const fmtDate = (iso?: string) =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : iso || ''

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function followDays(card: any, skip = false) {
  if (skip || !card.updated_at) return 0
  const days = Math.floor((Date.now() - new Date(card.updated_at).getTime()) / 864e5)
  return days >= 3 ? days : 0
}
