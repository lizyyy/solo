import { db, newId } from '../db/lowdb.js'
import { analyzeFactors } from './analyzer.js'
import { addHistoryEntry } from './historyService.js'
import { tryResolveVaccineMissingForRecord } from './queueService.js'
import type {
  TempRecord,
  RejudgeRequest,
  SupplementRequest,
  VaccineSupplementContent,
  WeightSupplementContent,
  NoteSupplementContent,
  RecordStatus,
  HistoryEntry,
} from '@shared/types.js'

export interface ListFilters {
  status?: RecordStatus
  startDate?: string
  endDate?: string
  petName?: string
}

export function listRecords(filters?: ListFilters): TempRecord[] {
  let result = [...db.data.records]
  if (!filters) {
    return result
  }
  if (filters.status) {
    result = result.filter((r) => r.status === filters.status)
  }
  if (filters.startDate) {
    result = result.filter((r) => r.visitDate >= filters.startDate!)
  }
  if (filters.endDate) {
    result = result.filter((r) => r.visitDate <= filters.endDate!)
  }
  if (filters.petName && filters.petName.trim()) {
    const kw = filters.petName.trim().toLowerCase()
    result = result.filter(
      (r) =>
        r.petName.toLowerCase().includes(kw) ||
        r.ownerName.toLowerCase().includes(kw) ||
        r.code.toLowerCase().includes(kw),
    )
  }
  return result
}

export function getRecord(id: string): TempRecord | undefined {
  return db.data.records.find((r) => r.id === id)
}

function snapshotRecordFields(rec: TempRecord): Partial<TempRecord> {
  return {
    status: rec.status,
    conclusion: rec.conclusion,
    pendingReason: rec.pendingReason,
    updatedAt: rec.updatedAt,
    factors: [...rec.factors],
    hasLegacyCurve: rec.hasLegacyCurve,
    isBoundarySample: rec.isBoundarySample,
  }
}

export async function updateConclusion(
  id: string,
  req: RejudgeRequest,
): Promise<TempRecord | null> {
  const record = db.data.records.find((r) => r.id === id)
  if (!record) {
    return null
  }

  if (!req.reason || !req.reason.trim()) {
    throw new Error('改判必须填写原因')
  }

  const oldSnapshot = snapshotRecordFields(record)
  const oldConclusion = record.conclusion

  record.conclusion = req.conclusion
  record.pendingReason = req.reason
  record.status = 'confirmed'
  record.updatedAt = new Date().toISOString()

  const analyzeResult = analyzeFactors(record)
  record.factors = analyzeResult.factors
  record.hasLegacyCurve = analyzeResult.hasLegacyCurve
  record.isBoundarySample = analyzeResult.isBoundarySample

  const newSnapshot = snapshotRecordFields(record)

  const historyEntry: HistoryEntry = {
    id: newId('hist-'),
    recordId: id,
    action: 'rejudge',
    isManual: true,
    operator: req.operator || 'system',
    time: record.updatedAt,
    summary: `改判结论：${oldConclusion} → ${req.conclusion}`,
    reason: req.reason,
    oldSnapshot,
    newSnapshot,
  }
  addHistoryEntry(historyEntry)

  await db.write()
  return record
}

export async function supplementRecord(
  id: string,
  req: SupplementRequest,
): Promise<TempRecord | null> {
  const record = db.data.records.find((r) => r.id === id)
  if (!record) {
    return null
  }

  const oldSnapshot = snapshotRecordFields(record)
  const now = new Date().toISOString()
  let summary = ''

  switch (req.type) {
    case 'vaccine': {
      const content = req.content as VaccineSupplementContent
      if (!content || typeof content.name !== 'string') {
        throw new Error('疫苗补录缺少 name 字段')
      }
      record.vaccines.push({
        date: content.date ?? null,
        name: content.name,
      })
      summary = `补录疫苗：${content.name}${content.date ? `（${content.date}）` : ''}`
      break
    }
    case 'weight': {
      const content = req.content as WeightSupplementContent
      if (!content || typeof content.value !== 'number') {
        throw new Error('体重补录缺少 value 字段')
      }
      record.weightCurve.push({
        t: content.t ?? record.weightCurve.length * 7,
        value: content.value,
        version: content.version ?? 'new',
      })
      summary = `补录体重：${content.value}g`
      break
    }
    case 'note': {
      const content = req.content as NoteSupplementContent
      if (!content || typeof content.content !== 'string') {
        throw new Error('备注补录缺少 content 字段')
      }
      record.notes.push({
        id: newId('note-'),
        content: content.content,
        source: content.source ?? 'written',
        operator: req.operator || 'system',
        time: now,
      })
      summary = `补录${content.source === 'verbal' ? '口头' : '书面'}备注`
      break
    }
    default:
      throw new Error(`未知的补录类型：${req.type}`)
  }

  record.updatedAt = now

  const analyzeResult = analyzeFactors(record)
  record.factors = analyzeResult.factors
  record.hasLegacyCurve = analyzeResult.hasLegacyCurve
  record.isBoundarySample = analyzeResult.isBoundarySample

  const hasVaccineMissing = analyzeResult.factors.some(
    (f) => f.type === 'vaccine_missing',
  )
  if (req.type === 'vaccine' && !hasVaccineMissing) {
    tryResolveVaccineMissingForRecord(record.id)
  }

  const newSnapshot = snapshotRecordFields(record)

  const historyEntry: HistoryEntry = {
    id: newId('hist-'),
    recordId: id,
    action: 'supplement',
    isManual: true,
    operator: req.operator || 'system',
    time: now,
    summary,
    oldSnapshot,
    newSnapshot,
  }
  addHistoryEntry(historyEntry)

  await db.write()
  return record
}

export function analyzeRecord(id: string): TempRecord | null {
  const record = db.data.records.find((r) => r.id === id)
  if (!record) {
    return null
  }
  const result = analyzeFactors(record)
  record.factors = result.factors
  record.hasLegacyCurve = result.hasLegacyCurve
  record.isBoundarySample = result.isBoundarySample
  record.updatedAt = new Date().toISOString()
  return record
}
