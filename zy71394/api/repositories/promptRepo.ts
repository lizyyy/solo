import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type {
  Prompt,
  PromptVersion,
  PromptDetail,
  CreatePromptRequest,
  UpdatePromptRequest,
  PromptFilter,
  PaginatedResponse,
  DuplicateCheckResult
} from '../../shared/types.js'
import { calculateSimilarity } from '../utils/similarity.js'

function mapPromptRow(row: any, tags: string[], techStacks: string[], failureReasons: string[], rating: number): Prompt {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    techStacks,
    rating,
    failureReasons,
    tags,
    currentVersion: row.current_version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapVersionRow(row: any): PromptVersion {
  return {
    id: row.id,
    promptId: row.prompt_id,
    version: row.version,
    content: row.content,
    rating: row.rating,
    changeReason: row.change_reason,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at
  }
}

export function getPrompts(filter: PromptFilter = {}): PaginatedResponse<Prompt> {
  const db = getDb()

  const {
    techStacks,
    minRating,
    maxRating,
    failureReasons,
    tags,
    status,
    search,
    page = 1,
    pageSize = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filter

  let baseSql = `
    SELECT DISTINCT p.*, pv.rating
    FROM prompts p
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
  `
  const params: any[] = []
  const where: string[] = []

  if (techStacks && techStacks.length > 0) {
    baseSql += ` JOIN prompt_tech_stacks pts ON p.id = pts.prompt_id`
    where.push(`pts.tech_stack IN (${techStacks.map(() => '?').join(',')})`)
    params.push(...techStacks)
  }

  if (failureReasons && failureReasons.length > 0) {
    baseSql += ` JOIN prompt_failure_reasons pfr ON p.id = pfr.prompt_id`
    where.push(`pfr.reason IN (${failureReasons.map(() => '?').join(',')})`)
    params.push(...failureReasons)
  }

  if (tags && tags.length > 0) {
    baseSql += ` JOIN prompt_tags pt ON p.id = pt.prompt_id`
    where.push(`pt.tag IN (${tags.map(() => '?').join(',')})`)
    params.push(...tags)
  }

  if (status) {
    where.push(`p.status = ?`)
    params.push(status)
  }

  if (minRating !== undefined) {
    where.push(`pv.rating >= ?`)
    params.push(minRating)
  }

  if (maxRating !== undefined) {
    where.push(`pv.rating <= ?`)
    params.push(maxRating)
  }

  if (search && search.trim()) {
    baseSql += ` JOIN prompts_fts fts ON p.rowid = fts.rowid`
    where.push(`prompts_fts MATCH ?`)
    params.push(`"${search.trim()}"*`)
  }

  const whereClause = where.length > 0 ? ` WHERE ` + where.join(' AND ') : ''
  const fullSql = baseSql + whereClause

  const sortMap: Record<string, string> = {
    createdAt: 'p.created_at',
    updatedAt: 'p.updated_at',
    rating: 'pv.rating'
  }
  const orderSql = ` ORDER BY ${sortMap[sortBy]} ${sortOrder.toUpperCase()}`

  const totalSql = `SELECT COUNT(DISTINCT id) as count FROM (${fullSql})`
  const total = db.prepare(totalSql).get(...params) as { count: number }

  const offset = (page - 1) * pageSize
  const querySql = fullSql + orderSql + ` LIMIT ? OFFSET ?`
  const queryParams = [...params, pageSize, offset]

  const rows = db.prepare(querySql).all(...queryParams) as any[]

  const items = rows.map(row => {
    const tags = db.prepare('SELECT tag FROM prompt_tags WHERE prompt_id = ?').all(row.id).map((t: any) => t.tag)
    const techStacks = db.prepare('SELECT tech_stack FROM prompt_tech_stacks WHERE prompt_id = ?').all(row.id).map((t: any) => t.tech_stack)
    const failureReasons = db.prepare('SELECT reason FROM prompt_failure_reasons WHERE prompt_id = ?').all(row.id).map((r: any) => r.reason)
    return mapPromptRow(row, tags, techStacks, failureReasons, row.rating)
  })

  return {
    items,
    total: total.count,
    page,
    pageSize,
    totalPages: Math.ceil(total.count / pageSize)
  }
}

export function getPromptById(id: string): PromptDetail | null {
  const db = getDb()

  const promptRow = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as any
  if (!promptRow) return null

  const versions = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
  `).all(id).map(mapVersionRow)

  const currentVersion = versions.find(v => v.version === promptRow.current_version) || versions[0]

  const tags = db.prepare('SELECT tag FROM prompt_tags WHERE prompt_id = ?').all(id).map((t: any) => t.tag)
  const techStacks = db.prepare('SELECT tech_stack FROM prompt_tech_stacks WHERE prompt_id = ?').all(id).map((t: any) => t.tech_stack)
  const failureReasons = db.prepare('SELECT reason FROM prompt_failure_reasons WHERE prompt_id = ?').all(id).map((r: any) => r.reason)

  return {
    ...mapPromptRow(promptRow, tags, techStacks, failureReasons, currentVersion?.rating || 0),
    versions
  }
}

export function getPromptVersions(promptId: string): PromptVersion[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
  `).all(promptId).map(mapVersionRow)
}

export function checkDuplicates(title: string, content: string, excludeId?: string): DuplicateCheckResult {
  const db = getDb()

  const sql = `
    SELECT p.*, pv.rating, pv.version
    FROM prompts p
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
    WHERE p.status = 'active'
    ${excludeId ? 'AND p.id != ?' : ''}
  `
  const params: any[] = excludeId ? [excludeId] : []

  const rows = db.prepare(sql).all(...params) as any[]

  const duplicates: DuplicateCheckResult['duplicates'] = []

  for (const row of rows) {
    const titleSim = calculateSimilarity(title, row.title)
    const contentSim = calculateSimilarity(content, row.content)
    const combinedSim = Math.round((titleSim * 0.3 + contentSim * 0.7) * 100) / 100

    if (combinedSim >= 0.7) {
      duplicates.push({
        promptId: row.id,
        title: row.title,
        similarity: combinedSim,
        version: row.version,
        rating: row.rating
      })
    }
  }

  duplicates.sort((a, b) => b.similarity - a.similarity)

  return {
    hasDuplicate: duplicates.length > 0,
    duplicates
  }
}

export function createPrompt(data: CreatePromptRequest, confirmedBy?: string): PromptDetail {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO prompts (id, title, content, current_version, status, created_at, updated_at)
      VALUES (?, ?, ?, 1, 'active', ?, ?)
    `).run(id, data.title, data.content, now, now)

    db.prepare(`
      INSERT INTO prompt_versions (id, prompt_id, version, content, rating, change_reason, confirmed_by, confirmed_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      id,
      data.content,
      data.rating,
      data.changeReason || '初始版本',
      confirmedBy || null,
      confirmedBy ? now : null
    )

    for (const tag of data.tags) {
      db.prepare('INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)').run(uuidv4(), id, tag)
    }

    for (const tech of data.techStacks) {
      db.prepare('INSERT INTO prompt_tech_stacks (id, prompt_id, tech_stack) VALUES (?, ?, ?)').run(uuidv4(), id, tech)
    }

    for (const reason of data.failureReasons) {
      db.prepare('INSERT INTO prompt_failure_reasons (id, prompt_id, reason) VALUES (?, ?, ?)').run(uuidv4(), id, reason)
    }
  })

  tx()

  return getPromptById(id)!
}

export function updatePrompt(id: string, data: UpdatePromptRequest, confirmedBy?: string): PromptDetail | null {
  const db = getDb()
  const existing = getPromptById(id)
  if (!existing) return null

  const newVersion = existing.currentVersion + 1
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE prompts
      SET title = ?, content = ?, current_version = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(data.title, data.content, newVersion, data.status || existing.status, now, id)

    db.prepare(`
      INSERT INTO prompt_versions (id, prompt_id, version, content, rating, change_reason, confirmed_by, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      id,
      newVersion,
      data.content,
      data.rating,
      data.changeReason,
      confirmedBy || null,
      confirmedBy ? now : null
    )

    db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(id)
    for (const tag of data.tags) {
      db.prepare('INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)').run(uuidv4(), id, tag)
    }

    db.prepare('DELETE FROM prompt_tech_stacks WHERE prompt_id = ?').run(id)
    for (const tech of data.techStacks) {
      db.prepare('INSERT INTO prompt_tech_stacks (id, prompt_id, tech_stack) VALUES (?, ?, ?)').run(uuidv4(), id, tech)
    }

    db.prepare('DELETE FROM prompt_failure_reasons WHERE prompt_id = ?').run(id)
    for (const reason of data.failureReasons) {
      db.prepare('INSERT INTO prompt_failure_reasons (id, prompt_id, reason) VALUES (?, ?, ?)').run(uuidv4(), id, reason)
    }
  })

  tx()

  return getPromptById(id)
}

export function deletePrompt(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
  return result.changes > 0
}

export function confirmVersion(promptId: string, version: number, confirmedBy: string): boolean {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db.prepare(`
    UPDATE prompt_versions
    SET confirmed_by = ?, confirmed_at = ?
    WHERE prompt_id = ? AND version = ?
  `).run(confirmedBy, now, promptId, version)
  return result.changes > 0
}

export function getAllTags(): string[] {
  const db = getDb()
  return db.prepare('SELECT DISTINCT tag FROM prompt_tags ORDER BY tag').all().map((r: any) => r.tag)
}

export function getAllTechStacks(): string[] {
  const db = getDb()
  return db.prepare('SELECT DISTINCT tech_stack FROM prompt_tech_stacks ORDER BY tech_stack').all().map((r: any) => r.tech_stack)
}

export function getAllFailureReasons(): string[] {
  const db = getDb()
  return db.prepare('SELECT DISTINCT reason FROM prompt_failure_reasons ORDER BY reason').all().map((r: any) => r.reason)
}

export function createTag(tag: string): string {
  const db = getDb()
  const existing = db.prepare('SELECT tag FROM prompt_tags WHERE tag = ?').get(tag)
  if (existing) return tag
  db.prepare('INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)').run(uuidv4(), 'system', tag)
  return tag
}
