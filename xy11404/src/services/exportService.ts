import { LedgerStatus, DataSource, Ledger } from '@prisma/client'
import { Parser } from 'json2csv'
import prisma from '../lib/prisma'
import { LedgerFilters, sensitiveFields } from '../types'
import { maskSensitiveData, maskPhone } from './diffService'

export interface ExportOptions {
  format: 'csv' | 'json'
  maskSensitive?: boolean
  includeDetails?: boolean
  includeHistory?: boolean
}

export async function exportLedgers(
  filters: LedgerFilters,
  options: ExportOptions
) {
  const where: any = {}

  if (filters.status) {
    where.status = filters.status
  }
  if (filters.batchNo) {
    where.batchNo = filters.batchNo
  }
  if (filters.driverId) {
    where.driverId = filters.driverId
  }
  if (filters.startDate || filters.endDate) {
    where.receiveDate = {}
    if (filters.startDate) {
      where.receiveDate.gte = filters.startDate
    }
    if (filters.endDate) {
      where.receiveDate.lte = filters.endDate
    }
  }

  const ledgers = await prisma.ledger.findMany({
    where,
    include: {
      scanDetails: options.includeDetails,
      statusHistories: options.includeHistory,
    },
    orderBy: { createdAt: 'desc' },
  })

  let processedLedgers = ledgers

  if (options.maskSensitive) {
    processedLedgers = ledgers.map((l) =>
      maskSensitiveData(l, [{ field: 'driverPhone', maskFn: maskPhone }])
    )
  }

  if (options.format === 'csv') {
    const flatData = processedLedgers.map((ledger) => ({
      id: ledger.id,
      boxNo: ledger.boxNo,
      batchNo: ledger.batchNo,
      driverId: ledger.driverId,
      driverName: ledger.driverName,
      driverPhone: ledger.driverPhone,
      receiveDate: ledger.receiveDate.toISOString(),
      crossDaySign: ledger.crossDaySign,
      boxNameChange: ledger.boxNameChange,
      originalBoxNo: ledger.originalBoxNo || '',
      temperatureMin: ledger.temperatureMin || '',
      temperatureMax: ledger.temperatureMax || '',
      compensationAmount: ledger.compensationAmount?.toString() || '',
      status: ledger.status,
      createdBy: ledger.createdBy,
      createdAt: ledger.createdAt.toISOString(),
      confirmedBy: ledger.confirmedBy || '',
      confirmedAt: ledger.confirmedAt?.toISOString() || '',
      rejectedBy: ledger.rejectedBy || '',
      rejectedAt: ledger.rejectedAt?.toISOString() || '',
      rejectionReason: ledger.rejectionReason || '',
      changeReason: ledger.changeReason || '',
    }))

    const parser = new Parser()
    return parser.parse(flatData)
  }

  return JSON.stringify(processedLedgers, null, 2)
}

export async function exportSingleLedger(
  ledgerId: string,
  options: ExportOptions
) {
  const ledger = await prisma.ledger.findUnique({
    where: { id: ledgerId },
    include: {
      scanDetails: true,
      statusHistories: {
        orderBy: { createdAt: 'asc' },
      },
      failedRecords: true,
      attachments: true,
    },
  })

  if (!ledger) {
    throw new Error('台账记录不存在')
  }

  let processedLedger = ledger

  if (options.maskSensitive) {
    processedLedger = maskSensitiveData(ledger, [{ field: 'driverPhone', maskFn: maskPhone }])
  }

  if (options.format === 'csv') {
    const parser = new Parser()
    const flatData = {
      id: processedLedger.id,
      boxNo: processedLedger.boxNo,
      batchNo: processedLedger.batchNo,
      driverId: processedLedger.driverId,
      driverName: processedLedger.driverName,
      driverPhone: processedLedger.driverPhone,
      receiveDate: processedLedger.receiveDate.toISOString(),
      crossDaySign: processedLedger.crossDaySign,
      boxNameChange: processedLedger.boxNameChange,
      originalBoxNo: processedLedger.originalBoxNo || '',
      temperatureMin: processedLedger.temperatureMin || '',
      temperatureMax: processedLedger.temperatureMax || '',
      compensationAmount: processedLedger.compensationAmount?.toString() || '',
      status: processedLedger.status,
      createdBy: processedLedger.createdBy,
      createdAt: processedLedger.createdAt.toISOString(),
      scanDetailCount: processedLedger.scanDetails.length,
      historyCount: processedLedger.statusHistories.length,
      failedRecordCount: processedLedger.failedRecords.length,
    }
    return parser.parse([flatData])
  }

  return JSON.stringify(processedLedger, null, 2)
}

export async function exportFailedRecords(
  ledgerId?: string,
  format: 'csv' | 'json' = 'json'
) {
  const where = ledgerId ? { ledgerId } : {}

  const failedRecords = await prisma.failedRecord.findMany({
    where,
    orderBy: { failedAt: 'desc' },
    include: { ledger: { select: { boxNo: true, batchNo: true } } },
  })

  if (format === 'csv') {
    const flatData = failedRecords.map((record) => ({
      id: record.id,
      ledgerId: record.ledgerId,
      boxNo: record.ledger.boxNo,
      batchNo: record.ledger.batchNo,
      source: record.source,
      errorMessage: record.errorMessage,
      failedAt: record.failedAt.toISOString(),
      resolved: record.resolved,
      resolvedBy: record.resolvedBy || '',
      resolvedAt: record.resolvedAt?.toISOString() || '',
    }))

    const parser = new Parser()
    return parser.parse(flatData)
  }

  return JSON.stringify(failedRecords, null, 2)
}
