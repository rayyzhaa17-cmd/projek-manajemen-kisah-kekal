import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(here, '.env') })

const keep = Number(process.env.BACKUP_KEEP) || 14
const dir = path.join(here, 'backups')
fs.mkdirSync(dir, { recursive: true })

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'crm_kanban',
  charset: 'utf8mb4',
})

const tables = (await conn.query('SHOW TABLES'))[0].map(r => Object.values(r)[0])
let out = '-- backup ' + new Date().toISOString() + '\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n'
for (const t of tables) {
  const [[c]] = await conn.query('SHOW CREATE TABLE ??', [t])
  out += '\nDROP TABLE IF EXISTS `' + t + '`;\n' + c['Create Table'] + ';\n'
  const [rows] = await conn.query('SELECT * FROM ??', [t])
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const cols = Object.keys(chunk[0]).map(k => '`' + k + '`').join(', ')
    out += 'INSERT INTO `' + t + '` (' + cols + ') VALUES\n' + chunk.map(r => '(' + Object.values(r).map(v => conn.escape(v)).join(', ') + ')').join(',\n') + ';\n'
  }
}
out += '\nSET FOREIGN_KEY_CHECKS=1;\n'

const pad = n => String(n).padStart(2, '0')
const d = new Date()
const name = 'crm-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.sql'
fs.writeFileSync(path.join(dir, name), out)
const old = fs.readdirSync(dir).filter(f => /^crm-.*\.sql$/.test(f)).sort().reverse().slice(keep)
old.forEach(f => fs.unlinkSync(path.join(dir, f)))
console.log('Backup tersimpan: backups/' + name + ' (' + tables.length + ' tabel, simpan ' + keep + ' file terakhir)')
await conn.end()
