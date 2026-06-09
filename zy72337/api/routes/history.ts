import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { paramItemId, counterexampleId } = req.query

  let query = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: any[] = []

  if (paramItemId) {
    query += ' AND param_item_id = ?'
    params.push(paramItemId)
  }

  if (counterexampleId) {
    query += ' AND counterexample_id = ?'
    params.push(counterexampleId)
  }

  query += ' ORDER BY created_at DESC'

  const logs = db.prepare(query).all(...params)
  res.json({ success: true, data: logs })
})

router.get('/for/:paramItemId', (req: Request, res: Response): void => {
  const { paramItemId } = req.params

  const paramItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(paramItemId) as any

  if (!paramItem) {
    res.status(404).json({ success: false, error: 'Param item not found' })
    return
  }

  const counterexamples = db.prepare(`
    SELECT ce.* FROM counterexamples ce
    WHERE ce.source_param_id = ?
    ORDER BY ce.created_at DESC
  `).all(paramItemId) as any[]

  const counterexampleIds = counterexamples.map(c => c.id)

  let logsQuery = `
    SELECT * FROM audit_logs 
    WHERE param_item_id = ?
  `
  const queryParams: any[] = [paramItemId]

  if (counterexampleIds.length > 0) {
    const placeholders = counterexampleIds.map(() => '?').join(',')
    logsQuery += ` OR counterexample_id IN (${placeholders})`
    queryParams.push(...counterexampleIds)
  }

  logsQuery += ' ORDER BY created_at DESC'

  const auditLogs = db.prepare(logsQuery).all(...queryParams)

  const conflicts = db.prepare(`
    SELECT c.* FROM conflicts c
    WHERE c.param_item_id = ?
    ORDER BY c.detected_at DESC
  `).all(paramItemId)

  const adjudications = db.prepare(`
    SELECT a.* FROM adjudications a
    INNER JOIN conflicts c ON c.id = a.conflict_id
    WHERE c.param_item_id = ?
    ORDER BY a.adjudicated_at DESC
  `).all(paramItemId)

  const dzReviews = db.prepare(`
    SELECT * FROM denominator_zero_reviews
    WHERE param_item_id = ?
    ORDER BY reviewed_at DESC
  `).all(paramItemId)

  const demoResults = db.prepare(`
    SELECT * FROM demo_results
    WHERE param_item_id = ?
    ORDER BY calculated_at DESC
  `).all(paramItemId)

  res.json({
    success: true,
    data: {
      paramItem,
      counterexamples,
      conflicts,
      adjudications,
      dzReviews,
      demoResults,
      auditLogs
    }
  })
})

export default router
