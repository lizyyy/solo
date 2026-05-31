import { Router, type Request, type Response } from 'express'
import { getAuditLog } from '../services/auditService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { recordId, eventType, dateFrom, dateTo, page, pageSize } = req.query

  const result = getAuditLog({
    recordId: recordId as string | undefined,
    eventType: eventType as string | undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  })

  res.json({ success: true, data: result })
})

export default router
