import { db } from '../db'
import type { User, UserRole } from '../../../shared/types'

interface UserRow {
  id: string
  username: string
  password: string
  name: string
  role: string
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as UserRole
  }
}

const findByUsernameStmt = db.prepare(`
  SELECT * FROM users WHERE username = ?
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM users WHERE id = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM users
`)

export function findByUsername(username: string): (User & { password: string }) | undefined {
  const row = findByUsernameStmt.get(username) as UserRow | undefined
  if (!row) return undefined
  return {
    ...rowToUser(row),
    password: row.password
  }
}

export function findById(id: string): User | undefined {
  const row = findByIdStmt.get(id) as UserRow | undefined
  return row ? rowToUser(row) : undefined
}

export function findAll(): User[] {
  const rows = findAllStmt.all() as UserRow[]
  return rows.map(rowToUser)
}
