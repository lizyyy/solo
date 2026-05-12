import { Router, Request, Response } from 'express'
import { store } from './store'
import { CreateSessionRequest, AddPlayerRequest, ConfirmAttendanceRequest, CancelPlayerRequest } from './types'

const router = Router()

router.get('/sessions', (_req: Request, res: Response) => {
  const sessions = store.getAllSessions()
  res.json(sessions)
})

router.get('/sessions/:id', (req: Request, res: Response) => {
  const session = store.getSession(req.params.id)
  if (!session) {
    return res.status(404).json({ error: '场次不存在' })
  }
  res.json(session)
})

router.post('/sessions', (req: Request<unknown, unknown, CreateSessionRequest>, res: Response) => {
  try {
    const session = store.createSession(req.body)
    res.status(201).json(session)
  } catch (error) {
    res.status(400).json({ error: '创建场次失败' })
  }
})

router.post('/sessions/:id/players', (req: Request<{ id: string }, unknown, AddPlayerRequest>, res: Response) => {
  const result = store.addPlayer(req.params.id, req.body)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/players/:playerId/confirm', (req: Request<{ id: string; playerId: string }>, res: Response) => {
  const result = store.confirmAttendance(req.params.id, req.params.playerId)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/players/:playerId/cancel', (req: Request<{ id: string; playerId: string }, unknown, CancelPlayerRequest>, res: Response) => {
  const result = store.cancelPlayer(req.params.id, req.params.playerId)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/players/:playerId/refund', (req: Request<{ id: string; playerId: string }>, res: Response) => {
  const result = store.processRefund(req.params.id, req.params.playerId)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/cancel', (req: Request<{ id: string }>, res: Response) => {
  const result = store.cancelSession(req.params.id)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/complete', (req: Request<{ id: string }>, res: Response) => {
  const result = store.completeSession(req.params.id)
  if ('error' in result) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/sessions/:id/check-auto-cancel', (req: Request<{ id: string }>, res: Response) => {
  const result = store.checkAndCancelIfNeeded(req.params.id)
  res.json(result)
})

router.get('/members', (_req: Request, res: Response) => {
  const members = store.getAllMembers()
  res.json(members)
})

export default router
