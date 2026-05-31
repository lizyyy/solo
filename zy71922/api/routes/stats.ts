import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/stats', (req: Request, res: Response): void => {
  try {
    const db = getDb()

    const total = db.prepare('SELECT COUNT(*) as cnt FROM artworks').get() as { cnt: number }
    const unchecked = db.prepare("SELECT COUNT(*) as cnt FROM artworks WHERE status = 'unchecked'").get() as { cnt: number }
    const checked = db.prepare("SELECT COUNT(*) as cnt FROM artworks WHERE status = 'checked'").get() as { cnt: number }
    const disputed = db.prepare("SELECT COUNT(*) as cnt FROM artworks WHERE status = 'disputed'").get() as { cnt: number }
    const corrected = db.prepare("SELECT COUNT(*) as cnt FROM artworks WHERE status = 'corrected'").get() as { cnt: number }

    res.json({
      success: true,
      data: {
        total: total.cnt,
        unchecked: unchecked.cnt,
        checked: checked.cnt,
        disputed: disputed.cnt,
        corrected: corrected.cnt,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
