import { Ledger, LedgerStatus, DataSource, Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import {
  CreateLedgerDto,
  UpdateLedgerDto,
  AddScanDetailDto,
  LedgerFilters,
  sensitiveFields,
} from '../types'
import { validateTransition, isEditable, isReadOnly } from './stateMachine'
import { computeDiff, maskSensitiveData, maskPhone } from './diffService'
import { createHash } from 'crypto'

export class LedgerNotFoundError extends Error {
  constructor(id: string) {
    super(`台账记录不存在: ${id}`)
    this.name = 'LedgerNotFoundError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function generateFileHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function createLedger(dto: CreateLedgerDto) {
  return prisma.$transaction(async (tx) => {
    const ledger = await tx.ledger.create({
      data: {
        boxNo: dto.boxNo,
        batchNo: dto.batchNo,
        driverId: dto.driverId,
        driverName: dto.driverName,
        driverPhone: dto.driverPhone,
        receiveDate: dto.receiveDate,
        crossDaySign: dto.crossDaySign,
        boxNameChange: dto.boxNameChange,
        originalBoxNo: dto.originalBoxNo,
        temperatureMin: dto.temperatureMin,
        temperatureMax: dto.temperatureMax,
        compensationAmount: dto.compensationAmount
          ? new Prisma.Decimal(dto.compensationAmount)
          : undefined,
        status: LedgerStatus.DRAFT,
        createdBy: dto.createdBy,
        changeReason: '初始建账',
        sensitiveFields: sensitiveFields,
      },
    })

    await tx.statusHistory.create({
      data: {
        ledgerId: ledger.id,
        fromStatus: null,
        toStatus: LedgerStatus.DRAFT,
        changedBy: dto.createdBy,
        changeReason: '初始建账',
        diffBefore: null,
        diffAfter: ledger,
      },
    })

    return ledger
  })
}

export async function getLedgerById(id: string, maskSensitive = true) {
  const ledger = await prisma.ledger.findUnique({
    where: { id },
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
    throw new LedgerNotFoundError(id)
  }

  if (maskSensitive) {
    return maskSensitiveData(ledger, [{ field: 'driverPhone', maskFn: maskPhone }])
  }

  return ledger
}

export async function getLedgers(filters: LedgerFilters, page = 1, pageSize = 20) {
  const where: Prisma.LedgerWhereInput = {}

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

  const [ledgers, total] = await Promise.all([
    prisma.ledger.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ledger.count({ where }),
  ])

  const maskedLedgers = ledgers.map((l) =>
    maskSensitiveData(l, [{ field: 'driverPhone', maskFn: maskPhone }])
  )

  return {
    data: maskedLedgers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function updateLedger(
  id: string,
  dto: UpdateLedgerDto,
  updatedBy: string
) {
  const existing = await prisma.ledger.findUnique({ where: { id } })
  if (!existing) {
    throw new LedgerNotFoundError(id)
  }

  if (!isEditable(existing.status)) {
    throw new ValidationError(`当前状态 ${existing.status} 不允许编辑`)
  }

  return prisma.$transaction(async (tx) => {
    const beforeData = { ...existing }
    delete (beforeData as Partial<Ledger>).updatedAt

    const updateData: Prisma.LedgerUpdateInput = {}
    if (dto.boxNo !== undefined) updateData.boxNo = dto.boxNo
    if (dto.batchNo !== undefined) updateData.batchNo = dto.batchNo
    if (dto.driverId !== undefined) updateData.driverId = dto.driverId
    if (dto.driverName !== undefined) updateData.driverName = dto.driverName
    if (dto.driverPhone !== undefined) updateData.driverPhone = dto.driverPhone
    if (dto.receiveDate !== undefined) updateData.receiveDate = dto.receiveDate
    if (dto.crossDaySign !== undefined) updateData.crossDaySign = dto.crossDaySign
    if (dto.boxNameChange !== undefined) updateData.boxNameChange = dto.boxNameChange
    if (dto.originalBoxNo !== undefined) updateData.originalBoxNo = dto.originalBoxNo
    if (dto.temperatureMin !== undefined) updateData.temperatureMin = dto.temperatureMin
    if (dto.temperatureMax !== undefined) updateData.temperatureMax = dto.temperatureMax
    if (dto.compensationAmount !== undefined) {
      updateData.compensationAmount = new Prisma.Decimal(dto.compensationAmount)
    }
    updateData.changeReason = dto.changeReason

    const updated = await tx.ledger.update({
      where: { id },
      data: updateData,
    })

    const afterData = { ...updated }
    delete (afterData as Partial<Ledger>).updatedAt

    const diff = computeDiff(
      beforeData as Record<string, unknown>,
      afterData as Record<string, unknown>
    )

    await tx.statusHistory.create({
      data: {
        ledgerId: id,
        fromStatus: existing.status,
        toStatus: updated.status,
        changedBy: updatedBy,
        changeReason: dto.changeReason,
        diffBefore: beforeData,
        diffAfter: afterData,
      },
    })

    return { ledger: updated, diff }
  })
}

export async function submitLedger(id: string, submittedBy: string, reason: string) {
  return transitionStatus(id, LedgerStatus.SUBMITTED, submittedBy, reason)
}

export async function rejectLedger(
  id: string,
  rejectedBy: string,
  reason: string,
  rejectionReason: string
) {
  return transitionStatus(id, LedgerStatus.REJECTED, rejectedBy, reason, rejectionReason)
}

export async function confirmLedger(id: string, confirmedBy: string, reason: string) {
  return transitionStatus(id, LedgerStatus.CONFIRMED, confirmedBy, reason)
}

export async function auditLedger(id: string, auditedBy: string, reason: string) {
  return transitionStatus(id, LedgerStatus.AUDITED, auditedBy, reason)
}

async function transitionStatus(
  id: string,
  toStatus: LedgerStatus,
  changedBy: string,
  changeReason: string,
  rejectionReason?: string
) {
  const existing = await prisma.ledger.findUnique({ where: { id } })
  if (!existing) {
    throw new LedgerNotFoundError(id)
  }

  validateTransition(existing.status, toStatus)

  return prisma.$transaction(async (tx) => {
    const beforeData = { ...existing }
    delete (beforeData as Partial<Ledger>).updatedAt

    const updateData: Prisma.LedgerUpdateInput = {
      status: toStatus,
      changeReason,
    }

    if (toStatus === LedgerStatus.CONFIRMED) {
      updateData.confirmedBy = changedBy
      updateData.confirmedAt = new Date()
    } else if (toStatus === LedgerStatus.REJECTED) {
      updateData.rejectedBy = changedBy
      updateData.rejectedAt = new Date()
      updateData.rejectionReason = rejectionReason
    } else if (toStatus === LedgerStatus.AUDITED) {
      updateData.auditedBy = changedBy
      updateData.auditedAt = new Date()
    }

    const updated = await tx.ledger.update({
      where: { id },
      data: updateData,
    })

    const afterData = { ...updated }
    delete (afterData as Partial<Ledger>).updatedAt

    await tx.statusHistory.create({
      data: {
        ledgerId: id,
        fromStatus: existing.status,
        toStatus,
        changedBy,
        changeReason,
        diffBefore: beforeData,
        diffAfter: afterData,
      },
    })

    return updated
  })
}

export async function addScanDetail(ledgerId: string, dto: AddScanDetailDto) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } })
  if (!ledger) {
    throw new LedgerNotFoundError(ledgerId)
  }

  if (isReadOnly(ledger.status)) {
    throw new ValidationError(`当前状态 ${ledger.status} 不允许追加明细`)
  }

  return prisma.scanDetail.create({
    data: {
      ...dto,
      ledgerId,
    },
  })
}

export async function addFailedRecord(
  ledgerId: string,
  source: DataSource,
  rawData: Record<string, unknown>,
  errorMessage: string
) {
  return prisma.failedRecord.create({
    data: {
      ledgerId,
      source,
      rawData,
      errorMessage,
    },
  })
}

export async function getFailedRecords(ledgerId: string) {
  return prisma.failedRecord.findMany({
    where: { ledgerId },
    orderBy: { failedAt: 'desc' },
  })
}

export async function getStatusHistory(ledgerId: string) {
  return prisma.statusHistory.findMany({
    where: { ledgerId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function addAttachment(
  ledgerId: string,
  source: DataSource,
  fileName: string,
  fileContent: string,
  uploadedBy: string
) {
  const fileHash = generateFileHash(fileContent)
  const fileUrl = `/attachments/${ledgerId}/${fileName}`

  return prisma.attachment.create({
    data: {
      ledgerId,
      source,
      fileName,
      fileUrl,
      fileHash,
      uploadedBy,
    },
  })
}

export async function getReportSummary(filters: LedgerFilters) {
  const where: Prisma.LedgerWhereInput = {}

  if (filters.status) {
    where.status = filters.status
  }
  if (filters.batchNo) {
    where.batchNo = filters.batchNo
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

  const validLedgers = await prisma.ledger.findMany({
    where: {
      ...where,
      status: {
        in: [LedgerStatus.CONFIRMED, LedgerStatus.AUDITED, LedgerStatus.ARCHIVED],
      },
    },
    include: { scanDetails: true },
  })

  const totalCompensation = validLedgers.reduce((sum, l) => {
    return sum + (l.compensationAmount?.toNumber() || 0)
  }, 0)

  const crossDayCount = validLedgers.filter((l) => l.crossDaySign).length
  const boxNameChangeCount = validLedgers.filter((l) => l.boxNameChange).length
  const totalScanDetails = validLedgers.reduce((sum, l) => sum + l.scanDetails.length, 0)

  const statusBreakdown = await prisma.ledger.groupBy({
    by: ['status'],
    where,
    _count: true,
  })

  return {
    totalValidLedgers: validLedgers.length,
    totalCompensation,
    crossDayCount,
    boxNameChangeCount,
    totalScanDetails,
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count,
    })),
  }
}
