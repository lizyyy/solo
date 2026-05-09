import { getDatabase } from './index'
import { User, UserRole, Permission, RolePermissions, PaginationParams, PaginatedResult } from '@shared/types'
import { generateId, getCurrentTimestamp } from '@shared/utils'
import { createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function createUser(
  username: string,
  password: string,
  displayName: string,
  role: UserRole
): User {
  const db = getDatabase()
  const now = getCurrentTimestamp()
  const user: User = {
    id: generateId(),
    username,
    password: hashPassword(password),
    displayName,
    role,
    createdAt: now,
    updatedAt: now,
    isActive: true
  }

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    user.id,
    user.username,
    user.password,
    user.displayName,
    user.role,
    user.createdAt,
    user.updatedAt,
    user.isActive ? 1 : 0
  )

  return user
}

export function getUserById(id: string): User | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
  const row = stmt.get(id) as any
  return row ? mapUser(row) : null
}

export function getUserByUsername(username: string): User | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
  const row = stmt.get(username) as any
  return row ? mapUser(row) : null
}

export function getUserPermissions(user: User): Permission[] {
  return RolePermissions[user.role] || []
}

export function hasPermission(user: User, permission: Permission): boolean {
  const permissions = getUserPermissions(user)
  return permissions.includes(permission)
}

export function listUsers(params: PaginationParams): PaginatedResult<User> {
  const db = getDatabase()
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc' } = params

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM users')
  const total = (countStmt.get() as any).count

  const offset = (page - 1) * pageSize
  const stmt = db.prepare(`
    SELECT * FROM users
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(pageSize, offset) as any[]

  return {
    items: rows.map(mapUser),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export function updateUser(id: string, updates: Partial<Pick<User, 'displayName' | 'role' | 'isActive'>>): User | null {
  const db = getDatabase()
  const user = getUserById(id)
  if (!user) return null

  const now = getCurrentTimestamp()
  const updatesToApply: string[] = []
  const values: any[] = []

  if (updates.displayName !== undefined) {
    updatesToApply.push('display_name = ?')
    values.push(updates.displayName)
  }
  if (updates.role !== undefined) {
    updatesToApply.push('role = ?')
    values.push(updates.role)
  }
  if (updates.isActive !== undefined) {
    updatesToApply.push('is_active = ?')
    values.push(updates.isActive ? 1 : 0)
  }

  if (updatesToApply.length === 0) return user

  updatesToApply.push('updated_at = ?')
  values.push(now)
  values.push(id)

  const stmt = db.prepare(`UPDATE users SET ${updatesToApply.join(', ')} WHERE id = ?`)
  stmt.run(...values)

  return getUserById(id)
}

export function updateUserPassword(id: string, newPassword: string): boolean {
  const db = getDatabase()
  const now = getCurrentTimestamp()
  const hashedPassword = hashPassword(newPassword)

  const stmt = db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
  const result = stmt.run(hashedPassword, now, id)
  return result.changes > 0
}

export function resetUserPassword(id: string, newPassword?: string): string {
  const password = newPassword || generateId().slice(0, 8)
  updateUserPassword(id, password)
  return password
}

export function verifyUser(username: string, password: string): User | null {
  const user = getUserByUsername(username)
  if (!user) return null
  if (!user.isActive) return null

  const hashedPassword = hashPassword(password)
  if (user.password === hashedPassword) {
    return { ...user, password: '***' }
  }
  return null
}

function mapUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    displayName: row.display_name,
    role: row.role as UserRole,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active === 1
  }
}
