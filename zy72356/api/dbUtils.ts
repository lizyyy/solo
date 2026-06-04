import type { Database, Statement, SqlValue } from 'sql.js'

export function run(db: Database, sql: string, params: SqlValue[] = []): void {
  const stmt = db.prepare(sql, params)
  try {
    stmt.step()
  } finally {
    stmt.free()
  }
}

export function getOne<T = any>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  const stmt = db.prepare(sql, params)
  try {
    if (stmt.step()) {
      const obj = stmt.getAsObject() as unknown as T
      return obj
    }
    return null
  } finally {
    stmt.free()
  }
}

export function getAll<T = any>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql, params)
  try {
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T)
    }
    return results
  } finally {
    stmt.free()
  }
}

export function prepare(db: Database, sql: string): Statement {
  return db.prepare(sql)
}

export function runStmt(stmt: Statement, params: SqlValue[] = []): void {
  stmt.bind(params)
  stmt.step()
  stmt.reset()
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.run('BEGIN TRANSACTION')
  try {
    const result = fn()
    db.run('COMMIT')
    return result
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}
