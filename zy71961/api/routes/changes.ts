import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { reportId, entityType, operator } = req.query

    let sql = 'SELECT * FROM change_history WHERE 1=1'
    const params: unknown[] = []

    if (reportId) {
      sql += ' AND report_id = ?'
      params.push(reportId)
    }
    if (entityType) {
      sql += ' AND entity_type = ?'
      params.push(entityType)
    }
    if (operator) {
      sql += ' AND operator = ?'
      params.push(operator)
    }

    sql += ' ORDER BY operated_at DESC'

    const changes = db.prepare(sql).all(...params)
    res.json({ success: true, data: changes })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { entityType, entityId, reportId, fieldName, oldValue, newValue, operator } = req.body

    if (!entityType || !entityId || !fieldName || !oldValue || !newValue || !operator) {
      res.status(400).json({ success: false, error: '缺少必要字段' })
      return
    }

    const id = uuidv4()
    db.prepare(
      'INSERT INTO change_history (id, entity_type, entity_id, report_id, field_name, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, entityType, entityId, reportId || null, fieldName, oldValue, newValue, operator)

    const change = db.prepare('SELECT * FROM change_history WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: change })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.get('/:reportId', (req: Request, res: Response): void => {
  try {
    const { reportId } = req.params

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' })
      return
    }

    const conclusions = db.prepare(
      'SELECT * FROM conclusions WHERE report_id = ?'
    ).all(reportId) as { id: string; title: string; description: string; severity: string }[]

    const evaluations = db.prepare(
      'SELECT * FROM evaluations WHERE report_id = ?'
    ).all(reportId) as { id: string; metric: string; value: number; baseline: number; drift: number }[]

    const inconsistencies: { conclusion: typeof conclusions[0]; evaluation: typeof evaluations[0]; reason: string }[] = []

    for (const conclusion of conclusions) {
      for (const evaluation of evaluations) {
        const description = conclusion.description

        if (description.includes('上升') && evaluation.drift < 0) {
          inconsistencies.push({
            conclusion,
            evaluation,
            reason: `结论描述"上升"与指标${evaluation.metric}的漂移方向(下降${evaluation.drift})不一致`,
          })
        }
        if (description.includes('下降') && evaluation.drift > 0) {
          inconsistencies.push({
            conclusion,
            evaluation,
            reason: `结论描述"下降"与指标${evaluation.metric}的漂移方向(上升+${evaluation.drift})不一致`,
          })
        }
        if (conclusion.severity === 'critical' && Math.abs(evaluation.drift) < 0.05) {
          inconsistencies.push({
            conclusion,
            evaluation,
            reason: `结论严重级别为critical，但指标${evaluation.metric}的漂移幅度(${evaluation.drift})较小`,
          })
        }
        if (conclusion.severity === 'low' && Math.abs(evaluation.drift) > 0.05) {
          inconsistencies.push({
            conclusion,
            evaluation,
            reason: `结论严重级别为low，但指标${evaluation.metric}的漂移幅度(${evaluation.drift})较大`,
          })
        }
      }
    }

    res.json({
      success: true,
      data: {
        reportId,
        consistent: inconsistencies.length === 0,
        inconsistencies,
        conclusionCount: conclusions.length,
        evaluationCount: evaluations.length,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
