import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()

router.get('/results', (_req: Request, res: Response): void => {
  const results = db.prepare('SELECT * FROM demo_results ORDER BY param_name').all() as any[]

  for (const item of results) {
    if (item.is_denominator_zero === 1 && item.review_status === 'pending_review') {
      item.display_label = '⚠ 分母为0，值为空字符串（待复核）'
    } else {
      item.display_label = item.value
    }
  }

  res.json({ success: true, data: results })
})

router.post('/recalculate', (_req: Request, res: Response): void => {
  const latestVersion = db.prepare('SELECT id, version FROM param_versions ORDER BY version DESC LIMIT 1').get() as { id: string; version: number } | undefined

  if (!latestVersion) {
    res.status(400).json({ success: false, error: 'No param version found' })
    return
  }

  const paramItems = db.prepare('SELECT * FROM param_items WHERE version_id = ?').all(latestVersion.id) as any[]

  const insertResult = db.prepare(`
    INSERT INTO demo_results (id, param_item_id, param_name, value, param_version, rationale, is_denominator_zero, review_status, display_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM demo_results').run()

    for (const item of paramItems) {
      let displayLabel = item.value
      let reviewStatus = item.review_status || 'normal'

      if (item.is_denominator_zero === 1) {
        reviewStatus = 'pending_review'
        displayLabel = '⚠ 分母为0，值为空字符串（待复核）'
      }

      insertResult.run(
        uuidv4(),
        item.id,
        item.name,
        item.value,
        String(latestVersion.version),
        item.rationale ?? '',
        item.is_denominator_zero ?? 0,
        reviewStatus,
        displayLabel
      )
    }
  })

  transaction()

  const results = db.prepare('SELECT * FROM demo_results ORDER BY param_name').all()
  res.json({ success: true, data: results })
})

router.get('/export', (_req: Request, res: Response): void => {
  const results = db.prepare('SELECT * FROM demo_results ORDER BY param_name').all() as any[]

  for (const item of results) {
    if (item.is_denominator_zero === 1 && item.review_status === 'pending_review') {
      item.display_label = '⚠ 分母为0，值为空字符串（待复核）'
    } else {
      item.display_label = item.value
    }
  }

  const jsonStr = JSON.stringify(results)
  const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex')

  res.json({ success: true, data: { results, checksum } })
})

export default router
