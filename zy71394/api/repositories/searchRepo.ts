import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type { SearchRequest, SearchReport, SearchResult } from '../../shared/types.js'
import { calculateSimilarity, generateSnippet } from '../utils/similarity.js'

export function fulltextSearch(query: string, limit: number = 20): SearchResult[] {
  const db = getDb()

  const rows = db.prepare(`
    SELECT p.id, p.title, p.content, pv.rating, bm25(prompts_fts) as score
    FROM prompts_fts
    JOIN prompts p ON prompts_fts.rowid = p.rowid
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
    WHERE prompts_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `).all(`"${query}"*`, limit) as any[]

  return rows.map(row => ({
    promptId: row.id,
    promptTitle: row.title,
    similarity: Math.max(0.5, Math.min(1, 1 - row.score / 100)),
    snippet: generateSnippet(row.content, query)
  }))
}

export function similarSearch(request: SearchRequest): SearchReport {
  const db = getDb()
  const { query, techStacks = [], limit = 10 } = request

  let sql = `
    SELECT DISTINCT p.*, pv.content as version_content, pv.rating
    FROM prompts p
    JOIN prompt_versions pv ON p.id = pv.prompt_id AND pv.version = p.current_version
    WHERE p.status = 'active'
  `
  const params: any[] = []

  if (techStacks.length > 0) {
    sql += ` JOIN prompt_tech_stacks pts ON p.id = pts.prompt_id`
    sql += ` WHERE pts.tech_stack IN (${techStacks.map(() => '?').join(',')})`
    params.push(...techStacks)
  }

  const rows = db.prepare(sql).all(...params) as any[]

  const results: SearchResult[] = rows
    .map(row => ({
      promptId: row.id,
      promptTitle: row.title,
      similarity: calculateSimilarity(query, row.version_content),
      snippet: generateSnippet(row.version_content, query)
    }))
    .filter(r => r.similarity >= 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  const reportId = uuidv4()
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO search_reports (id, query, result_count, created_at)
      VALUES (?, ?, ?, ?)
    `).run(reportId, query, results.length, now)

    for (const r of results) {
      db.prepare(`
        INSERT INTO search_report_results (id, report_id, prompt_id, similarity, snippet)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), reportId, r.promptId, r.similarity, r.snippet)
    }
  })

  tx()

  return {
    id: reportId,
    query,
    techStacks,
    resultCount: results.length,
    results,
    createdAt: now
  }
}

export function getSearchReports(limit: number = 20): SearchReport[] {
  const db = getDb()

  const reports = db.prepare(`
    SELECT * FROM search_reports
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[]

  return reports.map(report => {
    const results = db.prepare(`
      SELECT sr.*, p.title as prompt_title
      FROM search_report_results sr
      JOIN prompts p ON sr.prompt_id = p.id
      WHERE sr.report_id = ?
      ORDER BY sr.similarity DESC
    `).all(report.id).map((r: any) => ({
      promptId: r.prompt_id,
      promptTitle: r.prompt_title,
      similarity: r.similarity,
      snippet: r.snippet
    }))

    return {
      id: report.id,
      query: report.query,
      techStacks: [],
      resultCount: report.result_count,
      results,
      createdAt: report.created_at
    }
  })
}

export function getSearchReportById(id: string): SearchReport | null {
  const db = getDb()

  const report = db.prepare('SELECT * FROM search_reports WHERE id = ?').get(id) as any
  if (!report) return null

  const results = db.prepare(`
    SELECT sr.*, p.title as prompt_title
    FROM search_report_results sr
    JOIN prompts p ON sr.prompt_id = p.id
    WHERE sr.report_id = ?
    ORDER BY sr.similarity DESC
  `).all(id).map((r: any) => ({
    promptId: r.prompt_id,
    promptTitle: r.prompt_title,
    similarity: r.similarity,
    snippet: r.snippet
  }))

  return {
    id: report.id,
    query: report.query,
    techStacks: [],
    resultCount: report.result_count,
    results,
    createdAt: report.created_at
  }
}
