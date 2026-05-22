import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler'
import {
  createLedger,
  getLedgerById,
  getLedgers,
  updateLedger,
  submitLedger,
  rejectLedger,
  confirmLedger,
  auditLedger,
  addScanDetail,
  getFailedRecords,
  getStatusHistory,
  addFailedRecord,
  getReportSummary,
} from '../services/ledgerService'
import { exportLedgers, exportSingleLedger, exportFailedRecords } from '../services/exportService'
import { LedgerStatus, DataSource } from '@prisma/client'

const router = Router()

const createLedgerSchema = z.object({
  boxNo: z.string(),
  batchNo: z.string(),
  driverId: z.string(),
  driverName: z.string(),
  driverPhone: z.string(),
  receiveDate: z.coerce.date(),
  crossDaySign: z.boolean().optional(),
  boxNameChange: z.boolean().optional(),
  originalBoxNo: z.string().optional(),
  temperatureMin: z.number().optional(),
  temperatureMax: z.number().optional(),
  compensationAmount: z.number().optional(),
  source: z.nativeEnum(DataSource),
  createdBy: z.string(),
})

const updateLedgerSchema = z.object({
  boxNo: z.string().optional(),
  batchNo: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  receiveDate: z.coerce.date().optional(),
  crossDaySign: z.boolean().optional(),
  boxNameChange: z.boolean().optional(),
  originalBoxNo: z.string().optional(),
  temperatureMin: z.number().optional(),
  temperatureMax: z.number().optional(),
  compensationAmount: z.number().optional(),
  changeReason: z.string(),
})

const statusActionSchema = z.object({
  changedBy: z.string(),
  changeReason: z.string(),
  rejectionReason: z.string().optional(),
})

const scanDetailSchema = z.object({
  scanTime: z.coerce.date(),
  scanLocation: z.string(),
  operator: z.string(),
  temperature: z.number().optional(),
  boxCondition: z.string().optional(),
  remark: z.string().optional(),
})

const failedRecordSchema = z.object({
  source: z.nativeEnum(DataSource),
  rawData: z.object({}),
  errorMessage: z.string(),
})

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const dto = createLedgerSchema.parse(req.body)
    const ledger = await createLedger(dto)
    res.status(201).json(ledger)
  })
)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const filters: any = {}

    if (req.query.status) {
      filters.status = req.query.status as LedgerStatus
    }
    if (req.query.batchNo) {
      filters.batchNo = req.query.batchNo as string
    }
    if (req.query.driverId) {
      filters.driverId = req.query.driverId as string
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string)
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string)
    }

    const result = await getLedgers(filters, page, pageSize)
    res.json(result)
  })
)

router.get(
  '/report/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {}

    if (req.query.status) {
      filters.status = req.query.status as LedgerStatus
    }
    if (req.query.batchNo) {
      filters.batchNo = req.query.batchNo as string
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string)
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string)
    }

    const summary = await getReportSummary(filters)
    res.json(summary)
  })
)

router.get(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as 'csv' | 'json') || 'json'
    const maskSensitive = req.query.maskSensitive !== 'false'
    const includeDetails = req.query.includeDetails === 'true'
    const includeHistory = req.query.includeHistory === 'true'

    const filters: any = {}
    if (req.query.status) {
      filters.status = req.query.status as LedgerStatus
    }
    if (req.query.batchNo) {
      filters.batchNo = req.query.batchNo as string
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string)
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string)
    }

    const data = await exportLedgers(filters, {
      format,
      maskSensitive,
      includeDetails,
      includeHistory,
    })

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=ledgers.csv')
    } else {
      res.setHeader('Content-Type', 'application/json')
    }
    res.send(data)
  })
)

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const maskSensitive = req.query.maskSensitive !== 'false'
    const ledger = await getLedgerById(req.params.id, maskSensitive)
    res.json(ledger)
  })
)

router.get(
  '/:id/export',
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as 'csv' | 'json') || 'json'
    const maskSensitive = req.query.maskSensitive !== 'false'

    const data = await exportSingleLedger(req.params.id, {
      format,
      maskSensitive,
    })

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename=ledger-${req.params.id}.csv`)
    } else {
      res.setHeader('Content-Type', 'application/json')
    }
    res.send(data)
  })
)

router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dto = updateLedgerSchema.parse(req.body)
    const updatedBy = req.headers['x-user-id'] as string || 'system'
    const result = await updateLedger(req.params.id, dto, updatedBy)
    res.json(result)
  })
)

router.post(
  '/:id/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const { changedBy, changeReason } = statusActionSchema.parse(req.body)
    const ledger = await submitLedger(req.params.id, changedBy, changeReason)
    res.json(ledger)
  })
)

router.post(
  '/:id/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const { changedBy, changeReason, rejectionReason } = statusActionSchema.parse(req.body)
    const ledger = await rejectLedger(
      req.params.id,
      changedBy,
      changeReason,
      rejectionReason || '未提供原因'
    )
    res.json(ledger)
  })
)

router.post(
  '/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const { changedBy, changeReason } = statusActionSchema.parse(req.body)
    const ledger = await confirmLedger(req.params.id, changedBy, changeReason)
    res.json(ledger)
  })
)

router.post(
  '/:id/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { changedBy, changeReason } = statusActionSchema.parse(req.body)
    const ledger = await auditLedger(req.params.id, changedBy, changeReason)
    res.json(ledger)
  })
)

router.post(
  '/:id/scan-details',
  asyncHandler(async (req: Request, res: Response) => {
    const dto = scanDetailSchema.parse(req.body)
    const detail = await addScanDetail(req.params.id, dto)
    res.status(201).json(detail)
  })
)

router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const history = await getStatusHistory(req.params.id)
    res.json(history)
  })
)

router.get(
  '/:id/failed-records',
  asyncHandler(async (req: Request, res: Response) => {
    const records = await getFailedRecords(req.params.id)
    res.json(records)
  })
)

router.post(
  '/:id/failed-records',
  asyncHandler(async (req: Request, res: Response) => {
    const { source, rawData, errorMessage } = failedRecordSchema.parse(req.body)
    const record = await addFailedRecord(req.params.id, source, rawData, errorMessage)
    res.status(201).json(record)
  })
)

router.get(
  '/export/failed-records',
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as 'csv' | 'json') || 'json'
    const ledgerId = req.query.ledgerId as string

    const data = await exportFailedRecords(ledgerId, format)

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=failed-records.csv')
    } else {
      res.setHeader('Content-Type', 'application/json')
    }
    res.send(data)
  })
)

export default router
