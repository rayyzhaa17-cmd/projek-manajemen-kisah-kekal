const MAP = [
  ['pria', /pria/], ['wanita', /wanita/], ['urutan', /urutan/], ['tanggal', /tanggal/], ['paket', /paket/],
  ['cetak', /cetak sendiri/], ['tema', /tema/], ['frame', /frame/], ['qr', /qr/], ['warna', /warna/],
  ['addon', /add ?on/], ['catatan', /catatan/], ['penerima', /penerima/], ['hp', /\bhp\b|telepon|whatsapp/],
  ['alamat', /alamat/], ['email', /e-?mail/],
]
const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']

function toIso(v) {
  const m = v.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
  if (!m) return v
  const k = m[2].slice(0, 3).toLowerCase().replace('may', 'mei').replace('aug', 'agu').replace('oct', 'okt').replace('dec', 'des')
  const i = BULAN.indexOf(k)
  return i < 0 ? v : m[3] + '-' + String(i + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0')
}

export function parseBooking(text) {
  const out = {}
  for (const line of String(text).split('\n')) {
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

export const titleOf = d => d.urutan || (d.pria && d.wanita ? d.pria + ' & ' + d.wanita : '')
