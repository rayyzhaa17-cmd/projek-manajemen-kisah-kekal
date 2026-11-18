import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import { parseBooking, titleOf } from './parse.js'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(here, '.env') })

const PROD = process.env.NODE_ENV === 'production'
if (PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('ganti'))) {
  console.error('JWT_SECRET wajib diisi string acak minimal 32 karakter di server/.env')
  process.exit(1)
}
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-jangan-dipakai-di-produksi'
const COOKIE = 'crm_session'
const MIN_PASS = 6
const ROLES = ['admin', 'superadmin']
const COLORS = ['biru', 'pink']
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const FIELDS = { pria: 100, wanita: 100, urutan: 200, tanggal: 20, paket: 50, cetak: 10, tema: 100, frame: 200, qr: 100, warna: 30, addon: 300, catatan: 3000, penerima: 150, hp: 40, alamat: 1000, email: 190 }
const DUMMY = bcrypt.hashSync('tidak-dipakai', 10)

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'crm_kanban',
  charset: 'utf8mb4',
  connectionLimit: 10,
})
const q = async (sql, params = []) => (await db.query(sql, params))[0]
const tx = async fn => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'server error' }) })
const ok = res => res.json({ ok: true })
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg })

// validasi input
const cleanText = (t, max) => String(t == null ? '' : t).trim().slice(0, max)
const cleanTitle = t => cleanText(t, 190)
const cleanData = d => {
  const out = {}
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    for (const [k, max] of Object.entries(FIELDS)) {
      const v = cleanText(d[k], max)
      if (v) out[k] = v
    }
  }
  return out
}
const passOk = p => typeof p === 'string' && p.length >= MIN_PASS && p.length <= 72
const parseJson = s => { try { return s ? JSON.parse(s) : {} } catch { return {} } }

// batas percobaan
const hits = new Map()
const fails = new Map()
const recent = (m, k, ms) => (m.get(k) || []).filter(t => Date.now() - t < ms)
const limit = (max, ms) => (req, res, next) => {
  const k = req.ip + req.path
  const h = recent(hits, k, ms)
  if (h.length >= max) return bad(res, 'terlalu banyak permintaan, coba lagi nanti', 429)
  hits.set(k, [...h, Date.now()])
  next()
}
const locked = k => recent(fails, k, 900000).length >= 5
const noteFail = k => fails.set(k, [...recent(fails, k, 900000), Date.now()])
setInterval(() => { hits.clear(); fails.clear() }, 3600000).unref()

// sesi lewat cookie HttpOnly
const getCookie = (req, name) => {
  for (const c of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = c.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return ''
}
const setSession = (req, res, u) => {
  const token = jwt.sign({ id: u.id, tv: u.token_version }, SECRET, { expiresIn: '12h', algorithm: 'HS256' })
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 12 * 3600 * 1000, path: '/' })
}
const authUser = async req => {
  let t
  try { t = jwt.verify(getCookie(req, COOKIE), SECRET, { algorithms: ['HS256'] }) } catch { return null }
  const [u] = await q('SELECT id, email, role, token_version FROM users WHERE id = ?', [t.id])
  return u && u.token_version === t.tv ? u : null
}

const audit = (req, action, detail = '', user = req.user) =>
  q('INSERT INTO audit_log (user_id, email, action, detail, ip) VALUES (?, ?, ?, ?, ?)', [user ? user.id : null, user ? user.email : null, cleanText(action, 80), cleanText(detail, 500), cleanText(req.ip, 64)])
    .catch(e => console.error('audit gagal:', e.message))

const superOnly = (req, res, next) => (req.user.role === 'superadmin' ? next() : bad(res, 'hanya superadmin yang boleh', 403))
const lastSuper = async id => {
  const [t] = await q('SELECT role FROM users WHERE id = ?', [id])
  if (!t || t.role !== 'superadmin') return false
  const [{ n }] = await q("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'")
  return n <= 1
}

for (const check of ['SELECT token_version FROM users LIMIT 1', 'SELECT isi FROM card_labels LIMIT 1', 'SELECT 1 FROM audit_log LIMIT 1']) {
  try { await q(check) } catch {
    console.error('Database belum dimigrasi. Jalankan database/fase7.sql di phpMyAdmin lalu start ulang server.')
    process.exit(1)
  }
}

const app = express()
app.disable('x-powered-by')
if (process.env.TRUST_PROXY) app.set('trust proxy', 1)
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  })
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
})
app.use('/api/public', cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }))
app.use(express.json({ limit: '100kb' }))

// proteksi CSRF: request yang mengubah data wajib bawa header khusus (kecuali endpoint publik booking)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/public/')) return next()
  if (req.headers['x-requested-with'] !== 'crm') return bad(res, 'permintaan ditolak', 403)
  next()
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ---------- login ----------
app.post('/api/auth/login', limit(30, 900000), wrap(async (req, res) => {
  const email = cleanText(req.body.email, 190).toLowerCase()
  const key = req.ip + '|' + email
  if (locked(key)) return bad(res, 'terlalu banyak percobaan gagal, coba lagi sekitar 15 menit', 429)
  const [u] = await q('SELECT * FROM users WHERE email = ?', [email])
  const good = await bcrypt.compare(String(req.body.password || ''), u ? u.password_hash : DUMMY)
  if (!u || !good) {
    noteFail(key)
    audit(req, 'login_gagal', email, null)
    return bad(res, 'email atau password salah', 401)
  }
  fails.delete(key)
  setSession(req, res, u)
  audit(req, 'login', '', u)
  res.json({ email: u.email, role: u.role })
}))

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  ok(res)
})

// ---------- realtime (SSE) dan booking dari website ----------
const clients = new Set()
const emit = (event, data) => clients.forEach(r => r.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))

app.get('/api/events', wrap(async (req, res) => {
  const u = await authUser(req)
  if (!u) return res.status(401).end()
  if (clients.size >= 200) return res.status(503).end()
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(': ok\n\n')
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => { clearInterval(ping); clients.delete(res) })
}))

// null = fitur mati, true = key benar, false = key salah
const keyOk = k => {
  const want = process.env.BOOKING_KEY || ''
  if (want.length < 24 || want.startsWith('ganti')) return null
  const a = Buffer.from(String(k || ''))
  const b = Buffer.from(want)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

app.post('/api/public/booking', limit(30, 60000), wrap(async (req, res) => {
  const k = keyOk(req.headers['x-booking-key'])
  if (k === null) return bad(res, 'booking dari website belum diaktifkan', 503)
  if (!k) return bad(res, 'key salah', 401)
  const data = cleanData(req.body.data || (req.body.text ? parseBooking(String(req.body.text).slice(0, 10000)) : {}))
  const title = cleanTitle(req.body.title) || cleanTitle(titleOf(data)) || 'Booking baru'
  const [list] = process.env.BOOKING_LIST_ID
    ? await q('SELECT * FROM lists WHERE id = ?', [process.env.BOOKING_LIST_ID])
    : await q('SELECT l.* FROM lists l JOIN boards b ON b.id = l.board_id WHERE l.position = 0 ORDER BY b.id LIMIT 1')
  if (!list) return bad(res, 'belum ada board')
  const [{ p }] = await q('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE list_id = ?', [list.id])
  const r = await q('INSERT INTO cards (list_id, title, data, position) VALUES (?, ?, ?, ?)', [list.id, title, JSON.stringify(data), p])
  audit(req, 'booking_masuk', title, null)
  emit('booking', { id: r.insertId, title, list_id: list.id, board_id: list.board_id })
  res.json({ id: r.insertId })
}))

// ---------- semua route di bawah ini wajib login ----------
app.use('/api', async (req, res, next) => {
  try {
    const u = await authUser(req)
    if (!u) return bad(res, 'unauthorized', 401)
    req.user = u
    next()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

// catat semua perubahan data (kecuali geser kartu dan list yang terlalu sering)
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && !/\/move$/.test(req.path)) {
    res.on('finish', () => {
      if (res.statusCode < 400) audit(req, req.method + ' ' + req.originalUrl.replace(/^\/api/, '').split('?')[0], res.locals.detail || '')
    })
  }
  next()
})

app.get('/api/me', (req, res) => res.json({ id: req.user.id, email: req.user.email, role: req.user.role }))

// ---------- akun (superadmin) ----------
app.get('/api/users', superOnly, wrap(async (_req, res) => res.json(await q('SELECT id, email, role, created_at FROM users ORDER BY id'))))

app.post('/api/users', superOnly, wrap(async (req, res) => {
  const email = cleanText(req.body.email, 190).toLowerCase()
  const role = req.body.role || 'admin'
  if (!EMAIL.test(email)) return bad(res, 'format email tidak valid')
  if (!passOk(req.body.password)) return bad(res, 'password harus ' + MIN_PASS + ' sampai 72 karakter')
  if (!ROLES.includes(role)) return bad(res, 'role tidak dikenal')
  const [dup] = await q('SELECT id FROM users WHERE email = ?', [email])
  if (dup) return bad(res, 'email sudah terdaftar', 409)
  await q('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, await bcrypt.hash(req.body.password, 10), role])
  res.locals.detail = email + ' (' + role + ')'
  ok(res)
}))

app.patch('/api/users/:id', superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id)
  const email = req.body.email ? cleanText(req.body.email, 190).toLowerCase() : null
  const role = req.body.role || null
  const password = req.body.password || null
  const [target] = await q('SELECT email FROM users WHERE id = ?', [id])
  if (!target) return bad(res, 'akun tidak ada', 404)
  if (email && !EMAIL.test(email)) return bad(res, 'format email tidak valid')
  if (role && !ROLES.includes(role)) return bad(res, 'role tidak dikenal')
  if (password && !passOk(password)) return bad(res, 'password harus ' + MIN_PASS + ' sampai 72 karakter')
  if (role && role !== 'superadmin' && (await lastSuper(id))) return bad(res, 'minimal harus ada satu superadmin')
  if (email) {
    const [dup] = await q('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id])
    if (dup) return bad(res, 'email sudah dipakai akun lain', 409)
  }
  await q('UPDATE users SET email = COALESCE(?, email), role = COALESCE(?, role), password_hash = COALESCE(?, password_hash), token_version = token_version + ? WHERE id = ?',
    [email, role, password ? await bcrypt.hash(password, 10) : null, password ? 1 : 0, id])
  if (password && id === req.user.id) {
    const [fresh] = await q('SELECT id, token_version FROM users WHERE id = ?', [id])
    setSession(req, res, fresh)
  }
  res.locals.detail = target.email + (role ? ' role ' + role : '') + (password ? ' password diganti' : '')
  ok(res)
}))

app.delete('/api/users/:id', superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return bad(res, 'tidak bisa menghapus akun sendiri')
  if (await lastSuper(id)) return bad(res, 'minimal harus ada satu superadmin')
  const [t] = await q('SELECT email FROM users WHERE id = ?', [id])
  if (!t) return bad(res, 'akun tidak ada', 404)
  await q('DELETE FROM users WHERE id = ?', [id])
  res.locals.detail = t.email
  ok(res)
}))

app.patch('/api/me/password', superOnly, wrap(async (req, res) => {
  const { current, next } = req.body
  const [u] = await q('SELECT * FROM users WHERE id = ?', [req.user.id])
  if (!u || !(await bcrypt.compare(String(current || ''), u.password_hash))) return bad(res, 'password lama salah')
  if (!passOk(next)) return bad(res, 'password baru harus ' + MIN_PASS + ' sampai 72 karakter')
  await q('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [await bcrypt.hash(next, 10), u.id])
  const [fresh] = await q('SELECT id, token_version FROM users WHERE id = ?', [u.id])
  setSession(req, res, fresh)
  ok(res)
}))

app.get('/api/audit', superOnly, wrap(async (_req, res) => res.json(await q('SELECT id, email, action, detail, ip, created_at FROM audit_log ORDER BY id DESC LIMIT 200'))))

app.post('/api/audit/export', superOnly, wrap(async (req, res) => {
  res.locals.detail = 'baris: ' + (Number(req.body.count) || 0) + ', bulan: ' + cleanText(req.body.month, 7)
  ok(res)
}))

// ---------- boards ----------
app.get('/api/boards', wrap(async (_req, res) => res.json(await q('SELECT * FROM boards ORDER BY id DESC'))))

app.post('/api/boards', wrap(async (req, res) => {
  const title = cleanTitle(req.body.title)
  if (!title) return bad(res, 'nama board wajib diisi')
  const names = ['Customer Masuk', 'Customer Process Page', 'Customer Acc Page', 'Customer Proses Cetak', 'Customer Selesai']
  const id = await tx(async c => {
    const [r] = await c.query('INSERT INTO boards (title) VALUES (?)', [title])
    for (let i = 0; i < names.length; i++) {
      await c.query('INSERT INTO lists (board_id, title, position, is_done) VALUES (?, ?, ?, ?)', [r.insertId, names[i], i, i === names.length - 1 ? 1 : 0])
    }
    return r.insertId
  })
  res.json({ id })
}))

app.patch('/api/boards/:id', wrap(async (req, res) => {
  const title = cleanTitle(req.body.title) || null
  const nf = req.body.no_follow == null ? null : req.body.no_follow ? 1 : 0
  await q('UPDATE boards SET title = COALESCE(?, title), no_follow = COALESCE(?, no_follow) WHERE id = ?', [title, nf, req.params.id])
  ok(res)
}))

app.delete('/api/boards/:id', superOnly, wrap(async (req, res) => {
  const [b] = await q('SELECT title FROM boards WHERE id = ?', [req.params.id])
  if (!b) return bad(res, 'board tidak ada', 404)
  await q('DELETE FROM boards WHERE id = ?', [req.params.id])
  res.locals.detail = 'board: ' + b.title
  ok(res)
}))

app.get('/api/boards/:id', wrap(async (req, res) => {
  const [board] = await q('SELECT * FROM boards WHERE id = ?', [req.params.id])
  if (!board) return bad(res, 'board tidak ada', 404)
  const lists = await q('SELECT * FROM lists WHERE board_id = ? ORDER BY position', [board.id])
  const cards = await q('SELECT c.* FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ? ORDER BY c.position', [board.id])
  const labels = await q('SELECT cl.* FROM card_labels cl JOIN cards c ON c.id = cl.card_id JOIN lists l ON l.id = c.list_id WHERE l.board_id = ? ORDER BY cl.position, cl.id', [board.id])
  res.json({
    ...board,
    lists: lists.map(l => ({
      ...l,
      cards: cards.filter(c => c.list_id === l.id).map(c => ({ ...c, data: parseJson(c.data), labels: labels.filter(x => x.card_id === c.id) })),
    })),
  })
}))

// ---------- lists ----------
app.post('/api/boards/:id/lists', wrap(async (req, res) => {
  const title = cleanTitle(req.body.title)
  if (!title) return bad(res, 'nama list wajib diisi')
  const [board] = await q('SELECT id FROM boards WHERE id = ?', [req.params.id])
  if (!board) return bad(res, 'board tidak ada', 404)
  const [{ p }] = await q('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM lists WHERE board_id = ?', [board.id])
  const r = await q('INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)', [board.id, title, p])
  res.json({ id: r.insertId })
}))

app.patch('/api/lists/:id', wrap(async (req, res) => {
  const title = cleanTitle(req.body.title) || null
  const done = req.body.is_done == null ? null : req.body.is_done ? 1 : 0
  await q('UPDATE lists SET title = COALESCE(?, title), is_done = COALESCE(?, is_done) WHERE id = ?', [title, done, req.params.id])
  ok(res)
}))

app.delete('/api/lists/:id', wrap(async (req, res) => {
  const [l] = await q('SELECT title FROM lists WHERE id = ?', [req.params.id])
  if (!l) return bad(res, 'list tidak ada', 404)
  await q('DELETE FROM lists WHERE id = ?', [req.params.id])
  res.locals.detail = 'list: ' + l.title
  ok(res)
}))

app.patch('/api/lists/:id/move', wrap(async (req, res) => {
  const [l] = await q('SELECT * FROM lists WHERE id = ?', [req.params.id])
  if (!l) return bad(res, 'list tidak ada', 404)
  const pos = Math.max(0, parseInt(req.body.position, 10) || 0)
  await tx(async c => {
    const ids = (await c.query('SELECT id FROM lists WHERE board_id = ? AND id <> ? ORDER BY position', [l.board_id, l.id]))[0].map(x => x.id)
    ids.splice(Math.min(pos, ids.length), 0, l.id)
    for (let i = 0; i < ids.length; i++) await c.query('UPDATE lists SET position = ? WHERE id = ?', [i, ids[i]])
  })
  ok(res)
}))

// ---------- cards ----------
app.post('/api/lists/:id/cards', wrap(async (req, res) => {
  const data = cleanData(req.body.data)
  const title = cleanTitle(req.body.title) || cleanTitle(titleOf(data))
  if (!title) return bad(res, 'judul kartu wajib diisi')
  const [list] = await q('SELECT id FROM lists WHERE id = ?', [req.params.id])
  if (!list) return bad(res, 'list tidak ada', 404)
  const [{ p }] = await q('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE list_id = ?', [list.id])
  const r = await q('INSERT INTO cards (list_id, title, data, position) VALUES (?, ?, ?, ?)', [list.id, title, JSON.stringify(data), p])
  res.json({ id: r.insertId })
}))

app.patch('/api/cards/:id', wrap(async (req, res) => {
  const title = cleanTitle(req.body.title) || null
  const description = req.body.description == null ? null : cleanText(req.body.description, 5000)
  const data = req.body.data == null ? null : JSON.stringify(cleanData(req.body.data))
  await q('UPDATE cards SET title = COALESCE(?, title), description = COALESCE(?, description), data = COALESCE(?, data), updated_at = NOW() WHERE id = ?', [title, description, data, req.params.id])
  ok(res)
}))

app.delete('/api/cards/:id', wrap(async (req, res) => {
  const [c] = await q('SELECT title FROM cards WHERE id = ?', [req.params.id])
  if (!c) return bad(res, 'kartu tidak ada', 404)
  await q('DELETE FROM cards WHERE id = ?', [req.params.id])
  res.locals.detail = 'kartu: ' + c.title
  ok(res)
}))

app.patch('/api/cards/:id/move', wrap(async (req, res) => {
  const listId = Number(req.body.list_id)
  const pos = Math.max(0, parseInt(req.body.position, 10) || 0)
  const [card] = await q('SELECT * FROM cards WHERE id = ?', [req.params.id])
  const [target] = await q('SELECT id FROM lists WHERE id = ?', [listId])
  if (!card || !target) return bad(res, 'kartu atau list tidak ada', 404)
  await tx(async c => {
    const ids = (await c.query('SELECT id FROM cards WHERE list_id = ? AND id <> ? ORDER BY position', [listId, card.id]))[0].map(x => x.id)
    ids.splice(Math.min(pos, ids.length), 0, card.id)
    for (let i = 0; i < ids.length; i++) await c.query('UPDATE cards SET list_id = ?, position = ? WHERE id = ?', [listId, i, ids[i]])
    if (card.list_id !== listId) {
      const old = (await c.query('SELECT id FROM cards WHERE list_id = ? ORDER BY position', [card.list_id]))[0].map(x => x.id)
      for (let i = 0; i < old.length; i++) await c.query('UPDATE cards SET position = ? WHERE id = ?', [i, old[i]])
    }
    await c.query('UPDATE cards SET updated_at = NOW() WHERE id = ?', [card.id])
  })
  ok(res)
}))

// ---------- catatan (label) per kartu ----------
app.post('/api/cards/:id/labels', wrap(async (req, res) => {
  const color = req.body.color == null ? 'biru' : String(req.body.color)
  if (!COLORS.includes(color)) return bad(res, 'warna tidak valid')
  const [card] = await q('SELECT id FROM cards WHERE id = ?', [req.params.id])
  if (!card) return bad(res, 'kartu tidak ada', 404)
  const [{ p }] = await q('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM card_labels WHERE card_id = ?', [card.id])
  const r = await q('INSERT INTO card_labels (card_id, title, isi, color, position) VALUES (?, ?, ?, ?, ?)', [card.id, cleanText(req.body.title, 100), cleanText(req.body.isi, 3000), color, p])
  await q('UPDATE cards SET updated_at = NOW() WHERE id = ?', [card.id])
  res.json({ id: r.insertId })
}))

app.patch('/api/labels/:id', wrap(async (req, res) => {
  const b = req.body
  if (b.color != null && !COLORS.includes(String(b.color))) return bad(res, 'warna tidak valid')
  await q('UPDATE card_labels SET title = COALESCE(?, title), isi = COALESCE(?, isi), color = COALESCE(?, color) WHERE id = ?',
    [b.title == null ? null : cleanText(b.title, 100), b.isi == null ? null : cleanText(b.isi, 3000), b.color == null ? null : String(b.color), req.params.id])
  await q('UPDATE cards SET updated_at = NOW() WHERE id = (SELECT card_id FROM card_labels WHERE id = ?)', [req.params.id])
  ok(res)
}))

app.delete('/api/labels/:id', wrap(async (req, res) => {
  await q('UPDATE cards SET updated_at = NOW() WHERE id = (SELECT card_id FROM card_labels WHERE id = ?)', [req.params.id])
  await q('DELETE FROM card_labels WHERE id = ?', [req.params.id])
  ok(res)
}))

app.use('/api', (_req, res) => bad(res, 'tidak ditemukan', 404))

// ---------- hasil build client ----------
const dist = path.join(here, '../client/dist')
if (fs.existsSync(dist)) {
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '30d', immutable: true }))
  app.use(express.static(dist, { index: false }))
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return bad(res, 'JSON tidak valid')
  if (err.type === 'entity.too.large') return bad(res, 'data terlalu besar', 413)
  console.error(err)
  res.status(500).json({ error: 'server error' })
})

process.on('unhandledRejection', e => console.error('unhandledRejection:', e))
app.listen(process.env.PORT || 4000, () => console.log('API jalan di port ' + (process.env.PORT || 4000)))
