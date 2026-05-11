import { Router, Request, Response, NextFunction } from 'express'
import { getAuditLogs } from '../services/audit'
import type { AuditAction, EntityType } from '../../shared/types'

const router = Router()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const entityType = req.query.entityType as EntityType | undefined
    const entityId = req.query.entityId as string | undefined
    const operatorId = req.query.operatorId as string | undefined
    const action = req.query.action as AuditAction | undefined
    const startTime = req.query.startTime as string | undefined
    const endTime = req.query.endTime as string | undefined

    const result = await getAuditLogs({
      entityType,
      entityId,
      operatorId,
      action,
      startTime,
      endTime,
      page,
      pageSize
    })

    res.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize)
      },
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

export default router
