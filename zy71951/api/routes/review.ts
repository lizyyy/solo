import { Router, type Request, type Response } from 'express'
import { getReviewData } from '../services/reviewService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { dateFrom, dateTo, towerIds, status } = req.query

  if (!dateFrom || !dateTo) {
    res.status(400).json({ success: false, error: '必须提供dateFrom和dateTo' })
    return
  }

  const result = getReviewData({
    dateFrom: dateFrom as string,
    dateTo: dateTo as string,
    towerIds: towerIds ? (towerIds as string).split(',') : undefined,
    status: status ? (status as string).split(',') : undefined,
  })

  res.json({ success: true, data: result })
})

export default router
