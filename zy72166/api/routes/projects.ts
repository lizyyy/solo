import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ success: false, error: '项目名称不能为空' })
      return
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO projects (id, name, status, created_at, updated_at)
      VALUES (?, ?, 'importing', datetime('now'), datetime('now'))
    `).run(id, name)

    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id)
    res.status(201).json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id) as any
    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' })
      return
    }

    const recordCount = (db.prepare(`SELECT COUNT(*) as count FROM import_records WHERE project_id = ?`).get(req.params.id) as any).count
    const warningCount = (db.prepare(`SELECT COUNT(*) as count FROM precheck_warnings WHERE project_id = ?`).get(req.params.id) as any).count
    const reviewStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM review_items WHERE project_id = ? GROUP BY status
    `).all(req.params.id) as any[]

    const stats: Record<string, number> = {}
    for (const s of reviewStats) {
      stats[s.status] = s.count
    }

    res.json({
      success: true,
      data: {
        ...project,
        stats: {
          recordCount,
          warningCount,
          reviewStats: stats,
        },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/', (_req: Request, res: Response): void => {
  try {
    const projects = db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all()
    res.json({ success: true, data: projects })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
