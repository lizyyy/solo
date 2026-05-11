import { Router, Request, Response, NextFunction } from 'express'
import { borrowDevice, returnDevice, getBorrowRecords, getBorrowRecordById, getBorrowRecordsForReport } from '../services/borrow'
import { getAuditLogs } from '../services/audit'
import { cacheIdempotentResponse, getEndpointKey } from '../middleware/idempotency'
import type { BorrowStatus, ReportFilters } from '../../shared/types'

const router = Router()

const CURRENT_USER = {
  id: 'demo-user-id',
  name: '演示用户'
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const status = req.query.status as BorrowStatus | undefined
    const deviceId = req.query.deviceId as string | undefined
    const userId = req.query.userId as string | undefined
    const startTime = req.query.startTime as string | undefined
    const endTime = req.query.endTime as string | undefined

    const result = await getBorrowRecords({
      page,
      pageSize,
      status,
      deviceId,
      userId,
      startTime,
      endTime
    })

    res.json({
      success: true,
      data: result,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: ReportFilters = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      deviceId: req.query.deviceId as string | undefined,
      userId: req.query.userId as string | undefined,
      status: req.query.status as BorrowStatus | undefined
    }

    const records = await getBorrowRecordsForReport(filters)

    res.json({
      success: true,
      data: records,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getBorrowRecordById(req.params.id)

    if (!record) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '借用记录不存在'
        },
        requestId: req.idempotency.requestId,
        timestamp: new Date().toISOString()
      })
      return
    }

    res.json({
      success: true,
      data: record,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.post('/borrow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
      res.json(req.idempotency.cachedResponse)
      return
    }

    const record = await borrowDevice({
      deviceId: req.body.deviceId,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      purpose: req.body.purpose,
      expectedReturnTime: req.body.expectedReturnTime,
      requestId: req.body.requestId || req.idempotency.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    const response = {
      success: true,
      data: record,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    }

    await cacheIdempotentResponse(
      req.idempotency.requestId,
      getEndpointKey(req.method, req.originalUrl),
      response
    )

    res.status(201).json(response)
  } catch (error) {
    next(error)
  }
})

router.post('/return', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
      res.json(req.idempotency.cachedResponse)
      return
    }

    const record = await returnDevice({
      borrowRecordId: req.body.borrowRecordId,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      notes: req.body.notes,
      version: req.body.version,
      requestId: req.body.requestId || req.idempotency.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    const response = {
      success: true,
      data: record,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    }

    await cacheIdempotentResponse(
      req.idempotency.requestId,
      getEndpointKey(req.method, req.originalUrl),
      response
    )

    res.json(response)
  } catch (error) {
    next(error)
  }
})

export default router
