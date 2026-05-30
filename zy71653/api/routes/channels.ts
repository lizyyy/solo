import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const channels = db.prepare(`
    SELECT c.*, COALESCE(SUM(cv.conversions), 0) as total_conversions,
      COALESCE(SUM(cv.cost), 0) as total_cost,
      COALESCE(SUM(cv.revenue), 0) as total_revenue
    FROM channels c
    LEFT JOIN conversions cv ON cv.channel_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all()

  res.json({ success: true, data: channels })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params

  const channel = db.prepare(`
    SELECT c.*, COALESCE(SUM(cv.conversions), 0) as total_conversions,
      COALESCE(SUM(cv.cost), 0) as total_cost,
      COALESCE(SUM(cv.revenue), 0) as total_revenue
    FROM channels c
    LEFT JOIN conversions cv ON cv.channel_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id) as any

  if (!channel) {
    res.status(404).json({ success: false, error: '渠道不存在' })
    return
  }

  const conversions = db.prepare(`
    SELECT * FROM conversions WHERE channel_id = ? ORDER BY conversion_date DESC
  `).all(id)

  const creativeTags = db.prepare(`
    SELECT * FROM creative_tags WHERE channel_id = ?
  `).all(id)

  res.json({
    success: true,
    data: { ...channel, conversions, creativeTags },
  })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, platform, conversion_rate, fatigue_score, spend_velocity, status } = req.body

  if (!name || !platform) {
    res.status(400).json({ success: false, error: '渠道名称和平台为必填项' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO channels (id, name, platform, conversion_rate, fatigue_score, spend_velocity, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    platform,
    conversion_rate || 0,
    fatigue_score || 0,
    spend_velocity || 0,
    status || 'active',
    now,
    now
  )

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: channel })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const { name, platform, conversion_rate, fatigue_score, spend_velocity, status } = req.body

  const existing = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any
  if (!existing) {
    res.status(404).json({ success: false, error: '渠道不存在' })
    return
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE channels SET
      name = COALESCE(?, name),
      platform = COALESCE(?, platform),
      conversion_rate = COALESCE(?, conversion_rate),
      fatigue_score = COALESCE(?, fatigue_score),
      spend_velocity = COALESCE(?, spend_velocity),
      status = COALESCE(?, status),
      updated_at = ?
    WHERE id = ?
  `).run(
    name || null,
    platform || null,
    conversion_rate !== undefined ? conversion_rate : null,
    fatigue_score !== undefined ? fatigue_score : null,
    spend_velocity !== undefined ? spend_velocity : null,
    status || null,
    now,
    id
  )

  const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

export default router
