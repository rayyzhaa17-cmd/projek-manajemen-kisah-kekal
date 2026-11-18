import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') })

const [rawEmail, password, role] = process.argv.slice(2)
const email = String(rawEmail || '').trim().toLowerCase()
if (!email || !password || password.length < 6 || password.length > 72 || (role && !['admin', 'superadmin'].includes(role))) {
  console.log('Cara pakai: npm run user:add -- email password [admin|superadmin]')
  console.log('Password 6 sampai 72 karakter. Role hanya berubah kalau diisi, akun baru otomatis admin.')
  process.exit(1)
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'crm_kanban',
})
const hash = await bcrypt.hash(password, 10)
if (role) {
  await db.query('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), token_version = token_version + 1', [email, hash, role])
} else {
  await db.query('INSERT INTO users (email, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), token_version = token_version + 1', [email, hash])
}
console.log('Akun siap dipakai: ' + email + (role ? ' (' + role + ')' : ''))
await db.end()
