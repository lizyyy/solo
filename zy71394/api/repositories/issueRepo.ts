import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type {
  Issue,
  IssueLog,
  CreateIssueRequest,
  SubmitFixRequest,
  ConfirmFixRequest
} from '../../shared/types.js'

function mapIssueRow(row: any, relatedPromptIds: string[], relatedPrompts?: { id: string; title: string }[]): Issue {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    description: row.description,
    relatedPromptIds,
    relatedPrompts,
    fixPlan: row.fix_plan,
    fixedBy: row.fixed_by,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapLogRow(row: any): IssueLog {
  return {
    id: row.id,
    issueId: row.issue_id,
    action: row.action,
    actor: row.actor,
    comment: row.comment,
    createdAt: row.created_at
  }
}

export function getIssues(filters?: {
  type?: Issue['type']
  status?: Issue['status']
  severity?: Issue['severity']
}): Issue[] {
  const db = getDb()

  let sql = 'SELECT * FROM issues'
  const params: any[] = []
  const where: string[] = []

  if (filters?.type) {
    where.push('type = ?')
    params.push(filters.type)
  }
  if (filters?.status) {
    where.push('status = ?')
    params.push(filters.status)
  }
  if (filters?.severity) {
    where.push('severity = ?')
    params.push(filters.severity)
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ')
  }
  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as any[]

  return rows.map(row => {
    const relations = db.prepare('SELECT prompt_id FROM issue_prompt_relations WHERE issue_id = ?').all(row.id) as { prompt_id: string }[]
    const relatedPromptIds = relations.map(r => r.prompt_id)

    const relatedPrompts = relatedPromptIds.map(pid => {
      const p = db.prepare('SELECT id, title FROM prompts WHERE id = ?').get(pid) as { id: string; title: string } | undefined
      return p || { id: pid, title: '(已删除)' }
    })

    return mapIssueRow(row, relatedPromptIds, relatedPrompts)
  })
}

export function getIssueById(id: string): Issue | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as any
  if (!row) return null

  const relations = db.prepare('SELECT prompt_id FROM issue_prompt_relations WHERE issue_id = ?').all(id) as { prompt_id: string }[]
  const relatedPromptIds = relations.map(r => r.prompt_id)

  const relatedPrompts = relatedPromptIds.map(pid => {
    const p = db.prepare('SELECT id, title FROM prompts WHERE id = ?').get(pid) as { id: string; title: string } | undefined
    return p || { id: pid, title: '(已删除)' }
  })

  return mapIssueRow(row, relatedPromptIds, relatedPrompts)
}

export function getIssueLogs(issueId: string): IssueLog[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM issue_logs
    WHERE issue_id = ?
    ORDER BY created_at ASC
  `).all(issueId).map(mapLogRow)
}

export function createIssue(data: CreateIssueRequest, actor: string = 'system'): Issue {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO issues (id, type, severity, status, description, created_at, updated_at)
      VALUES (?, ?, ?, 'open', ?, ?, ?)
    `).run(id, data.type, data.severity, data.description, now, now)

    for (const pid of data.relatedPromptIds) {
      db.prepare('INSERT INTO issue_prompt_relations (id, issue_id, prompt_id) VALUES (?, ?, ?)').run(uuidv4(), id, pid)
    }

    db.prepare(`
      INSERT INTO issue_logs (id, issue_id, action, actor, comment)
      VALUES (?, ?, 'created', ?, ?)
    `).run(uuidv4(), id, actor, data.description)
  })

  tx()

  return getIssueById(id)!
}

export function submitFix(issueId: string, data: SubmitFixRequest): Issue | null {
  const db = getDb()
  const issue = getIssueById(issueId)
  if (!issue) return null

  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE issues
      SET status = 'fixing', fix_plan = ?, fixed_by = ?, updated_at = ?
      WHERE id = ?
    `).run(data.fixPlan, data.fixedBy, now, issueId)

    db.prepare(`
      INSERT INTO issue_logs (id, issue_id, action, actor, comment)
      VALUES (?, ?, 'fix_submitted', ?, ?)
    `).run(uuidv4(), issueId, data.fixedBy, data.fixPlan)
  })

  tx()

  return getIssueById(issueId)
}

export function confirmFix(issueId: string, data: ConfirmFixRequest): Issue | null {
  const db = getDb()
  const issue = getIssueById(issueId)
  if (!issue) return null

  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE issues
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(data.confirmedBy, now, now, issueId)

    db.prepare(`
      INSERT INTO issue_logs (id, issue_id, action, actor, comment)
      VALUES (?, ?, 'fix_confirmed', ?, ?)
    `).run(uuidv4(), issueId, data.confirmedBy, data.comment || '确认通过')
  })

  tx()

  return getIssueById(issueId)
}

export function rejectFix(issueId: string, actor: string, comment: string): Issue | null {
  const db = getDb()
  const issue = getIssueById(issueId)
  if (!issue) return null

  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE issues
      SET status = 'open', updated_at = ?
      WHERE id = ?
    `).run(now, issueId)

    db.prepare(`
      INSERT INTO issue_logs (id, issue_id, action, actor, comment)
      VALUES (?, ?, 'fix_rejected', ?, ?)
    `).run(uuidv4(), issueId, actor, comment)
  })

  tx()

  return getIssueById(issueId)
}

export function closeIssue(issueId: string, actor: string, comment: string): Issue | null {
  const db = getDb()
  const issue = getIssueById(issueId)
  if (!issue) return null

  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE issues
      SET status = 'closed', updated_at = ?
      WHERE id = ?
    `).run(now, issueId)

    db.prepare(`
      INSERT INTO issue_logs (id, issue_id, action, actor, comment)
      VALUES (?, ?, 'closed', ?, ?)
    `).run(uuidv4(), issueId, actor, comment)
  })

  tx()

  return getIssueById(issueId)
}

export function autoDetectIssues(): Issue[] {
  const db = getDb()
  const createdIssues: Issue[] = []

  const allPrompts = db.prepare(`
    SELECT p.*, pv.rating, pv.content
    FROM prompts p
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
    WHERE p.status = 'active'
  `).all() as any[]

  const threshold = 0.85
  for (let i = 0; i < allPrompts.length; i++) {
    for (let j = i + 1; j < allPrompts.length; j++) {
      const sim = calculateSimpleSimilarity(allPrompts[i].content, allPrompts[j].content)
      if (sim >= threshold) {
        const existing = db.prepare(`
          SELECT i.* FROM issues i
          JOIN issue_prompt_relations r1 ON i.id = r1.issue_id
          JOIN issue_prompt_relations r2 ON i.id = r2.issue_id
          WHERE i.type = 'duplicate' AND i.status IN ('open', 'fixing')
            AND r1.prompt_id = ? AND r2.prompt_id = ?
        `).get(allPrompts[i].id, allPrompts[j].id)

        if (!existing) {
          const issue = createIssue({
            type: 'duplicate',
            severity: sim > 0.95 ? 'high' : 'medium',
            description: `检测到高度相似的提示词："${allPrompts[i].title}" 和 "${allPrompts[j].title}"，相似度 ${(sim * 100).toFixed(0)}%`,
            relatedPromptIds: [allPrompts[i].id, allPrompts[j].id]
          }, 'system')
          createdIssues.push(issue)
        }
      }
    }
  }

  const titleGroups = new Map<string, any[]>()
  for (const p of allPrompts) {
    const key = p.title.toLowerCase().trim()
    if (!titleGroups.has(key)) titleGroups.set(key, [])
    titleGroups.get(key)!.push(p)
  }

  for (const [title, prompts] of titleGroups) {
    if (prompts.length < 2) continue
    const ratings = prompts.map(p => p.rating)
    const minR = Math.min(...ratings)
    const maxR = Math.max(...ratings)
    if (maxR - minR >= 3) {
      const existing = db.prepare(`
        SELECT i.id FROM issues i
        WHERE i.type = 'rating_inconsistency' AND i.status IN ('open', 'fixing')
          AND i.description LIKE ?
      `).get(`%${title}%`)

      if (!existing) {
        const issue = createIssue({
          type: 'rating_inconsistency',
          severity: maxR - minR >= 5 ? 'high' : 'medium',
          description: `同题提示词评分口径不一："${title}" 的评分范围 ${minR} - ${maxR}，差异超过 3 分`,
          relatedPromptIds: prompts.map(p => p.id)
        }, 'system')
        createdIssues.push(issue)
      }
    }
  }

  const deprecatedPrompts = db.prepare(`
    SELECT p.*, pv.content
    FROM prompts p
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
    WHERE p.status = 'deprecated'
  `).all() as any[]

  for (const deprecated of deprecatedPrompts) {
    const usages = db.prepare(`
      SELECT sr.*, s.query
      FROM search_report_results sr
      JOIN search_reports s ON sr.report_id = s.id
      WHERE sr.prompt_id = ? AND sr.similarity > 0.8
      ORDER BY s.created_at DESC
      LIMIT 5
    `).all(deprecated.id)

    if (usages.length > 0) {
      const existing = db.prepare(`
        SELECT i.id FROM issues i
        WHERE i.type = 'deprecated_usage' AND i.status IN ('open', 'fixing')
          AND i.description LIKE ?
      `).get(`%${deprecated.title}%`)

      if (!existing) {
        const issue = createIssue({
          type: 'deprecated_usage',
          severity: 'high',
          description: `已弃用的提示词"${deprecated.title}"仍在被检索使用，最近 ${usages.length} 次检索命中`,
          relatedPromptIds: [deprecated.id]
        }, 'system')
        createdIssues.push(issue)
      }
    }
  }

  return createdIssues
}

function calculateSimpleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)))
  return intersection.size / Math.max(wordsA.size, wordsB.size)
}
