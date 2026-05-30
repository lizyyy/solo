import { Router, type Request, type Response } from 'express'
import {
  getDeposits,
  createDeposit,
  autoMatch,
  manualMatch,
  getUnmatched,
} from '../services/depositMatcher.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { client_id, match_status, page, pageSize } = req.query
  const result = getDeposits({
    clientId: client_id as string,
    matchStatus: match_status as string,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  })
  res.json({ success: true, data: result })
})

router.post('/', (req: Request, res: Response): void => {
  const { client_id, amount, deposit_time } = req.body
  if (!client_id || !amount || !deposit_time) {
    res.status(400).json({ success: false, error: '客户ID、金额和入金时间不能为空' })
    return
  }
  const deposit = createDeposit(client_id, Number(amount), deposit_time)
  res.status(201).json({ success: true, data: deposit })
})

router.post('/match', (req: Request, res: Response): void => {
  const result = autoMatch()
  res.json({ success: true, data: result })
})

router.post('/:id/manual-match', (req: Request, res: Response): void => {
  const { id } = req.params
  const { notification_id, matched_amount } = req.body
  if (!notification_id || !matched_amount) {
    res.status(400).json({ success: false, error: '通知ID和匹配金额不能为空' })
    return
  }
  const match = manualMatch(id, notification_id, Number(matched_amount))
  res.json({ success: true, data: match })
})

router.get('/unmatched', (req: Request, res: Response): void => {
  const result = getUnmatched()
  res.json({ success: true, data: result })
})

export default router
