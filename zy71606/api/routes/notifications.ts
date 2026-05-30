import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import {
  createNotification,
  sendNotification,
  withdrawNotification,
  getNotifications,
  checkDuplicate,
} from '../services/notificationService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { client_id, type, status, page, pageSize } = req.query
  const result = getNotifications({
    clientId: client_id as string,
    type: type as string,
    status: status as string,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  })
  res.json({ success: true, data: result })
})

router.post('/', (req: Request, res: Response): void => {
  const { client_id, type, content, margin_shortfall } = req.body
  if (!client_id || !type) {
    res.status(400).json({ success: false, error: '客户ID和通知类型不能为空' })
    return
  }
  const notification = createNotification(client_id, type, content, margin_shortfall)
  res.status(201).json({ success: true, data: notification })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const { content, margin_shortfall } = req.body
  const db = getDb()

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
  if (!notification) {
    res.status(404).json({ success: false, error: `通知ID ${id} 不存在` })
    return
  }
  if (notification.status !== 'draft') {
    res.status(400).json({ success: false, error: '只有草稿状态才能编辑' })
    return
  }

  if (content !== undefined) {
    db.prepare('UPDATE notifications SET content = ? WHERE id = ?').run(content, id)
  }
  if (margin_shortfall !== undefined) {
    db.prepare('UPDATE notifications SET margin_shortfall = ? WHERE id = ?').run(margin_shortfall, id)
  }

  const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

router.post('/:id/send', (req: Request, res: Response): void => {
  const { id } = req.params
  const notification = sendNotification(id)
  res.json({ success: true, data: notification })
})

router.post('/:id/withdraw', (req: Request, res: Response): void => {
  const { id } = req.params
  const { reason } = req.body
  if (!reason) {
    res.status(400).json({ success: false, error: '撤回原因不能为空' })
    return
  }
  const notification = withdrawNotification(id, reason)
  res.json({ success: true, data: notification })
})

router.get('/check-dup', (req: Request, res: Response): void => {
  const { client_id, type } = req.query
  if (!client_id || !type) {
    res.status(400).json({ success: false, error: '客户ID和通知类型不能为空' })
    return
  }
  const isDuplicate = checkDuplicate(client_id as string, type as string)
  res.json({ success: true, data: { isDuplicate } })
})

export default router
