import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { DDL_STATEMENTS } from './schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.resolve(__dirname, '../../data/app.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

for (const ddl of DDL_STATEMENTS) {
  db.exec(ddl)
}

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (userCount.count === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, name, role)
    VALUES (?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()

  insertUser.run(
    crypto.randomUUID(),
    'admin',
    'admin123',
    '行政老师',
    'admin'
  )

  insertUser.run(
    crypto.randomUUID(),
    'coach',
    'coach123',
    '唐老师',
    'coach'
  )

  insertUser.run(
    crypto.randomUUID(),
    'reviewer',
    'reviewer123',
    '教研组',
    'reviewer'
  )
}

export { db }
export default db
