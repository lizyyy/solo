import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'

const router = Router()

function buildFilterClause(query: Request['query']): { where: string, params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (query.featureName) {
    conditions.push('feature_name LIKE ?')
    params.push(`%${query.featureName}%`)
  }

  if (query.status && query.status !== 'all') {
    if (query.status === 'consistent') {
      conditions.push('is_consistent = 1')
    } else if (query.status === 'inconsistent') {
      conditions.push('is_consistent = 0')
    } else if (query.status === 'pending') {
      conditions.push('is_consistent IS NULL')
    }
  }

  if (query.dateFrom) {
    conditions.push('created_at >= ?')
    params.push(query.dateFrom)
  }

  if (query.dateTo) {
    conditions.push('created_at <= ?')
    params.push(query.dateTo)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { where, params }
}

function mapRow(row: any) {
  return {
    id: row.id,
    featureName: row.feature_name,
    trainingSpec: row.training_spec,
    onlineSpec: row.online_spec,
    isConsistent: row.is_consistent === null ? null : row.is_consistent === 1,
    inconsistentReason: row.inconsistent_reason,
    judgmentBasis: row.judgment_basis,
    source: row.source,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const format = (req.query.format as string) || 'json'
    const db = getDb()
    const { where, params } = buildFilterClause(req.query)

    const features = db.prepare(`SELECT * FROM feature_specs ${where} ORDER BY created_at DESC`).all(...params) as any[]

    const filterSnapshot = JSON.stringify({
      featureName: req.query.featureName || '',
      status: req.query.status || 'all',
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
    })

    db.prepare(`
      INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), 'filter_export', 'system', null, null,
      null, null, `导出${features.length}条特征数据，格式: ${format}`,
      filterSnapshot, new Date().toISOString(),
    )

    if (format === 'csv') {
      const headers = 'id,featureName,trainingSpec,onlineSpec,isConsistent,inconsistentReason,judgmentBasis,source,version,createdAt,updatedAt'
      const rows = features.map(f => {
        const m = mapRow(f)
        return [
          m.id,
          m.featureName,
          m.trainingSpec,
          m.onlineSpec,
          m.isConsistent === null ? '' : m.isConsistent ? 'true' : 'false',
          m.inconsistentReason || '',
          m.judgmentBasis || '',
          m.source,
          m.version,
          m.createdAt,
          m.updatedAt,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      })

      const csv = [headers, ...rows].join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=feature_specs_${new Date().toISOString().slice(0, 10)}.csv`)
      res.send('\uFEFF' + csv)
    } else {
      const mapped = features.map(mapRow)
      res.json({ success: true, data: mapped })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
