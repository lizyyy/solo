import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  try {
    const models = db.prepare('SELECT * FROM models').all()
    res.json({ success: true, data: models })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
