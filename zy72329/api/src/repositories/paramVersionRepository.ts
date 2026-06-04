import { db } from '../db'
import type { ParamVersion } from '../../../shared/types'

interface ParamVersionRow {
  id: string
  version: string
  snapshot: string
  change_summary: string
  operator: string
  created_at: string
  record_count: string
}

function rowToParamVersion(row: ParamVersionRow): ParamVersion {
  return {
    id: row.id,
    version: row.version,
    snapshot: row.snapshot,
    changeSummary: row.change_summary,
    operator: row.operator,
    createdAt: row.created_at,
    recordCount: JSON.parse(row.record_count)
  }
}

function paramVersionToRow(version: ParamVersion): unknown[] {
  return [
    version.id,
    version.version,
    version.snapshot,
    version.changeSummary,
    version.operator,
    version.createdAt,
    JSON.stringify(version.recordCount)
  ]
}

const insertStmt = db.prepare(`
  INSERT INTO param_versions (
    id, version, snapshot, change_summary, operator, created_at, record_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const findAllStmt = db.prepare(`
  SELECT * FROM param_versions ORDER BY created_at DESC
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM param_versions WHERE id = ?
`)

const findLatestStmt = db.prepare(`
  SELECT * FROM param_versions ORDER BY created_at DESC LIMIT 1
`)

const findByVersionStmt = db.prepare(`
  SELECT * FROM param_versions WHERE version = ?
`)

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM param_versions
`)

export function insert(version: ParamVersion): string {
  insertStmt.run(...paramVersionToRow(version))
  return version.id
}

export function findAll(): ParamVersion[] {
  const rows = findAllStmt.all() as ParamVersionRow[]
  return rows.map(rowToParamVersion)
}

export function findById(id: string): ParamVersion | undefined {
  const row = findByIdStmt.get(id) as ParamVersionRow | undefined
  return row ? rowToParamVersion(row) : undefined
}

export function findLatest(): ParamVersion | undefined {
  const row = findLatestStmt.get() as ParamVersionRow | undefined
  return row ? rowToParamVersion(row) : undefined
}

export function findByVersion(version: string): ParamVersion | undefined {
  const row = findByVersionStmt.get(version) as ParamVersionRow | undefined
  return row ? rowToParamVersion(row) : undefined
}

export function count(): number {
  const result = countStmt.get() as { count: number }
  return result.count
}

interface ParamVersionCreate {
  version: string
  snapshot: string
  changeSummary: string
  operator: string
  recordCount: {
    smooth: number
    gap: number
    supplement: number
    conflict: number
  }
}

export function create(data: ParamVersionCreate): ParamVersion {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const version: ParamVersion = {
    id,
    ...data,
    createdAt: now
  }
  insertStmt.run(...paramVersionToRow(version))
  return findById(id)!
}
