import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/:id/merge-groups', (req: Request, res: Response): void => {
  try {
    const groups = db.prepare(
      `SELECT * FROM merge_groups WHERE project_id = ? ORDER BY type, id`
    ).all(req.params.id) as any[]

    const enriched = groups.map((g) => {
      const recordIds = JSON.parse(g.record_ids) as string[]
      const records = db.prepare(
        `SELECT id, location_name, address, longitude, latitude, period, sunlight_hours, complaint, source, raw_remark FROM import_records WHERE id IN (${recordIds.map(() => '?').join(',')})`
      ).all(...recordIds)
      return { ...g, records }
    })

    res.json({ success: true, data: enriched })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id/merge-groups/:groupId', (req: Request, res: Response): void => {
  try {
    const { id, groupId } = req.params
    const { strategy, note } = req.body

    const group = db.prepare(`SELECT * FROM merge_groups WHERE id = ? AND project_id = ?`).get(groupId, id) as any
    if (!group) {
      res.status(404).json({ success: false, error: '归并分组不存在' })
      return
    }

    if (strategy && !['merge', 'separate', 'pending'].includes(strategy)) {
      res.status(400).json({ success: false, error: '无效的归并策略' })
      return
    }

    if (strategy) {
      db.prepare(`UPDATE merge_groups SET strategy = ? WHERE id = ?`).run(strategy, groupId)
    }
    if (note !== undefined) {
      db.prepare(`UPDATE merge_groups SET note = ? WHERE id = ?`).run(note, groupId)
    }

    const updated = db.prepare(`SELECT * FROM merge_groups WHERE id = ?`).get(groupId)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
