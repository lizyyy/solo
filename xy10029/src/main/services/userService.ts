import { run, get, all } from '../database/index'
import { User, UserRole, Permission, RolePermissions, PaginationParams, PaginatedResult } from '@shared/types'
import { generateId, getCurrentTimestamp } from '@shared/utils'
import { createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: UserRole
): Promise<User> {
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

  await run(`
    INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    user.id,
    user.username,
    user.password,
    user.displayName,
    user.role,
    user.createdAt,
    user.updatedAt,
    user.isActive ? 1 : 0
  ])

  return user
}

export async function getUserById(id: string): Promise<User | null> {
  const row = await get<any>('SELECT * FROM users WHERE id = ?', [id])
  return row ? mapUser(row) : null
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const row = await get<any>('SELECT * FROM users WHERE username = ?', [username])
  return row ? mapUser(row) : null
}

export function getUserPermissions(user: User): Permission[] {
  return RolePermissions[user.role] || []
}

export function hasPermission(user: User, permission: Permission): boolean {
  const permissions = getUserPermissions(user)
  return permissions.includes(permission)
}

export async function listUsers(params: PaginationParams): Promise<PaginatedResult<User>> {
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc' } = params

  const countRow = await get<any>('SELECT COUNT(*) as count FROM users', [])
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM users ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [pageSize, offset]
  )

  return {
    items: rows.map(mapUser),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'displayName' | 'role' | 'isActive'>>
): Promise<User | null> {
  const user = await getUserById(id)
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

  await run(`UPDATE users SET ${updatesToApply.join(', ')} WHERE id = ?`, values)

  return getUserById(id)
}

export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
  const now = getCurrentTimestamp()
  const hashedPassword = hashPassword(newPassword)

  const result = await run(
    'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
    [hashedPassword, now, id]
  )
  return result.changes > 0
}

export async function resetUserPassword(id: string, newPassword?: string): Promise<string> {
  const password = newPassword || generateId().slice(0, 8)
  await updateUserPassword(id, password)
  return password
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username)
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
