import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { updateReviewStatus, addNote, getDiff, resolveConflict, getHistory } from '../services/review.js'

const router = Router()

router.get('/:id/reviews', (req: Request, res: Response): void => {
  try {
    const reviews = db.prepare(`
      SELECT ri.*, ir.location_name, ir.address, ir.sunlight_hours, ir.source, ir.period, ir.raw_remark, ir.complaint
      FROM review_items ri
      JOIN import_records ir ON ri.record_id = ir.id
      WHERE ri.project_id = ?
      ORDER BY ri.status, ir.location_name
    `).all(req.params.id)

    const enriched = (reviews as any[]).map((r) => {
      const notes = db.prepare(`SELECT * FROM review_notes WHERE review_item_id = ? ORDER BY rowid DESC`).all(r.id)
      return { ...r, notes }
    })

    res.json({ success: true, data: enriched })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id/reviews/:reviewId', (req: Request, res: Response): void => {
  try {
    const { status, verdict, reason, author } = req.body
    if (!status || !reason || !author) {
      res.status(400).json({ success: false, error: '需要status、reason和author参数' })
      return
    }

    const updated = updateReviewStatus(req.params.reviewId, status, verdict || null, reason, author)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/reviews/:reviewId/notes', (req: Request, res: Response): void => {
  try {
    const { content, author } = req.body
    if (!content || !author) {
      res.status(400).json({ success: false, error: '需要content和author参数' })
      return
    }

    const note = addNote(req.params.reviewId, content, author)
    res.status(201).json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/reviews/:reviewId/diff', (req: Request, res: Response): void => {
  try {
    const diff = getDiff(req.params.reviewId)
    res.json({ success: true, data: diff })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/reviews/:reviewId/resolve', (req: Request, res: Response): void => {
  try {
    const { resolution, resolvedBy } = req.body
    if (!resolution || !resolvedBy) {
      res.status(400).json({ success: false, error: '需要resolution和resolvedBy参数' })
      return
    }

    const updated = resolveConflict(req.params.reviewId, resolution, resolvedBy)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/reviews/:reviewId/history', (req: Request, res: Response): void => {
  try {
    const history = getHistory(req.params.reviewId)
    res.json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
