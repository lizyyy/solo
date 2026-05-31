import { Router, type Request, type Response } from 'express'
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

router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { where, params } = buildFilterClause(req.query)

    const features = db.prepare(`SELECT * FROM feature_specs ${where} ORDER BY created_at DESC`).all(...params) as any[]

    const totalFeatures = features.length
    const consistentCount = features.filter(f => f.is_consistent === 1).length
    const inconsistentCount = features.filter(f => f.is_consistent === 0).length
    const pendingCount = features.filter(f => f.is_consistent === null).length

    const leakAlertCount = (db.prepare('SELECT COUNT(*) as cnt FROM leak_alerts WHERE is_resolved = 0').get() as any).cnt

    const filterConditions: Record<string, unknown> = {}
    if (req.query.featureName) filterConditions.featureName = req.query.featureName
    if (req.query.status) filterConditions.status = req.query.status
    if (req.query.dateFrom) filterConditions.dateFrom = req.query.dateFrom
    if (req.query.dateTo) filterConditions.dateTo = req.query.dateTo

    const conclusions: Array<{
      featureName: string
      conclusion: string
      reason: string
      nextStep: string
      severity: 'info' | 'warning' | 'critical'
    }> = []

    for (const f of features) {
      if (f.is_consistent === 1) {
        conclusions.push({
          featureName: f.feature_name,
          conclusion: '一致',
          reason: f.judgment_basis || '训练口径与线上口径完全匹配',
          nextStep: '无需操作，继续监控',
          severity: 'info',
        })
      } else if (f.is_consistent === 0) {
        const isLeak = (db.prepare('SELECT COUNT(*) as cnt FROM leak_alerts WHERE feature_name = ? AND is_resolved = 0').get(f.feature_name) as any).cnt > 0
        conclusions.push({
          featureName: f.feature_name,
          conclusion: '不一致',
          reason: f.inconsistent_reason || f.judgment_basis || '训练口径与线上口径不匹配',
          nextStep: isLeak
            ? '该特征存在泄漏风险，建议优先处理泄漏告警后再修正口径'
            : '修正训练口径或线上口径使其一致',
          severity: isLeak ? 'critical' : 'warning',
        })
      } else {
        conclusions.push({
          featureName: f.feature_name,
          conclusion: '待确认',
          reason: f.online_spec ? '训练口径缺失' : '线上口径缺失',
          nextStep: '补充缺失的口径定义后重新对账',
          severity: 'warning',
        })
      }
    }

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        filterConditions,
        totalFeatures,
        consistentCount,
        inconsistentCount,
        pendingCount,
        leakAlertCount,
        conclusions,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
