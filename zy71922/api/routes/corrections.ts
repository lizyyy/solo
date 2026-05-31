import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/corrections', (req: Request, res: Response): void => {
  try {
    const { artwork_id } = req.query
    const db = getDb()

    let rows: any[]
    if (artwork_id) {
      rows = db.prepare('SELECT * FROM corrections WHERE artwork_id = ? ORDER BY created_at DESC').all(artwork_id)
    } else {
      rows = db.prepare('SELECT * FROM corrections ORDER BY created_at DESC').all()
    }

    res.json({ success: true, data: rows })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/corrections/:id/revert', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const db = getDb()

    if (!reason) {
      res.status(400).json({ success: false, error: 'reason 为必填项' })
      return
    }

    const correction = db.prepare('SELECT * FROM corrections WHERE id = ?').get(id) as any
    if (!correction) {
      res.status(404).json({ success: false, error: '修正记录未找到' })
      return
    }

    if (correction.reverted) {
      res.status(400).json({ success: false, error: '该修正已撤回' })
      return
    }

    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare(
        `UPDATE corrections SET reverted = 1, revert_reason = ?, reverted_at = ? WHERE id = ?`
      ).run(reason, now, id)

      db.prepare(
        `UPDATE artworks SET ${correction.field} = ?, updated_at = ? WHERE id = ?`
      ).run(correction.old_value, now, correction.artwork_id)

      const remainingCorrections = db.prepare(
        `SELECT COUNT(*) as cnt FROM corrections WHERE artwork_id = ? AND reverted = 0`
      ).get(correction.artwork_id) as { cnt: number }

      if (remainingCorrections.cnt === 0) {
        const hasDisputes = db.prepare(
          `SELECT COUNT(*) as cnt FROM disputes WHERE artwork_id = ? AND resolved = 0`
        ).get(correction.artwork_id) as { cnt: number }

        if (hasDisputes.cnt > 0) {
          db.prepare(`UPDATE artworks SET status = 'disputed', updated_at = ? WHERE id = ?`).run(now, correction.artwork_id)
        } else {
          db.prepare(`UPDATE artworks SET status = 'checked', updated_at = ? WHERE id = ?`).run(now, correction.artwork_id)
        }
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM corrections WHERE id = ?').get(id)

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
