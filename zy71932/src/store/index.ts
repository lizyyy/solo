import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type {
  FontRecord,
  ColorCard,
  OperationLog,
  ExportSnapshot,
  ImportSession,
  ImportRow,
  ConflictItem,
  ConflictResolution,
  AnomalyItem,
  RecordStatus,
  LicenseType,
  ExportFilter,
  LogAction,
} from '@/types'
import * as db from '@/lib/db'
import { parseCSV, parseJSON } from '@/utils/parser'
import { detectDuplicates, buildDuplicateKey } from '@/utils/duplicate'
import { validateBeforeExport } from '@/utils/validation'
import { generateDeliveryNote } from '@/utils/delivery'
import { seedData } from '@/utils/seed'

type LogVal = { [key: string]: unknown } | undefined

interface FontLicenseStore {
  records: FontRecord[]
  colorCards: ColorCard[]
  operationLogs: OperationLog[]
  exportSnapshots: ExportSnapshot[]
  importSessions: ImportSession[]
  initialized: boolean

  init: () => Promise<void>
  resetWithSeed: () => Promise<void>
  addRecords: (records: FontRecord[], operator?: string) => Promise<void>
  updateRecord: (id: string, patch: Partial<FontRecord>, operator?: string) => Promise<void>
  batchUpdateStatus: (ids: string[], status: RecordStatus, operator?: string) => Promise<void>
  linkColorCard: (recordId: string, cardId: string, version: string, operator?: string) => Promise<void>
  addReviewNote: (recordId: string, content: string, author: string) => Promise<void>
  logOperation: (log: Omit<OperationLog, 'id' | 'timestamp'>) => Promise<void>
  revokeOperation: (logId: string) => Promise<void>
  deleteRecord: (id: string, operator?: string) => Promise<void>
  importFile: (file: File) => Promise<{ session: ImportSession; rows: ImportRow[]; conflicts: ConflictItem[] }>
  resolveConflictsAndImport: (session: ImportSession, rows: ImportRow[], conflicts: ConflictItem[], operator?: string) => Promise<void>
  filterRecords: (filter: ExportFilter) => FontRecord[]
  validateExport: (ids: string[]) => AnomalyItem[]
  exportRecords: (ids: string[], format: 'csv' | 'json', operator?: string) => Promise<ExportSnapshot>
  getColorCardById: (id: string) => ColorCard | undefined
  getRecordById: (id: string) => FontRecord | undefined
  getLogsByRecord: (recordId: string) => OperationLog[]
}

function toLogVal(obj: unknown): LogVal {
  return obj as LogVal
}

export const useStore = create<FontLicenseStore>((set, get) => ({
  records: [],
  colorCards: [],
  operationLogs: [],
  exportSnapshots: [],
  importSessions: [],
  initialized: false,

  init: async () => {
    const records = await db.dbGetAllRecords()
    const colorCards = await db.dbGetAllColorCards()
    const operationLogs = await db.dbGetAllLogs()
    const exportSnapshots = await db.dbGetAllSnapshots()
    const importSessions = await db.dbGetAllImportSessions()
    if (records.length === 0) {
      const seed = seedData()
      await db.dbPutRecords(seed.records)
      for (const card of seed.colorCards) await db.dbPutColorCard(card)
      set({ records: seed.records, colorCards: seed.colorCards, operationLogs, exportSnapshots, importSessions, initialized: true })
    } else {
      set({ records, colorCards, operationLogs, exportSnapshots, importSessions, initialized: true })
    }
  },

  resetWithSeed: async () => {
    await db.dbClearAll()
    const seed = seedData()
    await db.dbPutRecords(seed.records)
    for (const card of seed.colorCards) await db.dbPutColorCard(card)
    set({ records: seed.records, colorCards: seed.colorCards, operationLogs: [], exportSnapshots: [], importSessions: [] })
  },

  addRecords: async (records, operator = '设计师') => {
    await db.dbPutRecords(records)
    const now = new Date().toISOString()
    for (const r of records) {
      await db.dbPutLog({ id: uuid(), recordId: r.id, action: 'import', newValue: toLogVal(r), operator, timestamp: now, detail: `导入字体：${r.fontName}` })
    }
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: [...s.records, ...records], operationLogs: allLogs }))
  },

  updateRecord: async (id, patch, operator = '设计师') => {
    const prev = get().records.find((r) => r.id === id)
    if (!prev) return
    const updated: FontRecord = { ...prev, ...patch, updatedAt: new Date().toISOString() }
    await db.dbPutRecord(updated)
    await db.dbPutLog({ id: uuid(), recordId: id, action: 'update', previousValue: toLogVal(prev), newValue: toLogVal(patch), operator, timestamp: new Date().toISOString(), detail: `更新字体记录：${prev.fontName}` })
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: s.records.map((r) => (r.id === id ? updated : r)), operationLogs: allLogs }))
  },

  batchUpdateStatus: async (ids, status, operator = '设计师') => {
    const now = new Date().toISOString()
    const updatedRecords = get().records.map((r) => ids.includes(r.id) ? { ...r, status, updatedAt: now } : r)
    for (const r of updatedRecords) { if (ids.includes(r.id)) await db.dbPutRecord(r) }
    for (const id of ids) {
      const r = get().records.find((rec) => rec.id === id)!
      await db.dbPutLog({ id: uuid(), recordId: id, action: status === 'confirmed' ? 'confirm' : 'update', newValue: toLogVal({ status }), operator, timestamp: now, detail: `批量更新状态为 ${status}：${r.fontName}` })
    }
    const allLogs = await db.dbGetAllLogs()
    set({ records: updatedRecords, operationLogs: allLogs })
  },

  linkColorCard: async (recordId, cardId, version, operator = '设计师') => {
    const prev = get().records.find((r) => r.id === recordId)
    if (!prev) return
    const updated: FontRecord = { ...prev, colorCardId: cardId, colorCardVersion: version, updatedAt: new Date().toISOString() }
    await db.dbPutRecord(updated)
    const card = get().colorCards.find((c) => c.id === cardId)
    await db.dbPutLog({ id: uuid(), recordId, action: 'update', previousValue: toLogVal({ colorCardId: prev.colorCardId, colorCardVersion: prev.colorCardVersion }), newValue: toLogVal({ colorCardId: cardId, colorCardVersion: version }), operator, timestamp: new Date().toISOString(), detail: `关联色卡：${card?.name ?? cardId} v${version}` })
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: s.records.map((r) => (r.id === recordId ? updated : r)), operationLogs: allLogs }))
  },

  addReviewNote: async (recordId, content, author) => {
    const prev = get().records.find((r) => r.id === recordId)
    if (!prev) return
    const note = { id: uuid(), content, author, createdAt: new Date().toISOString(), resolved: false }
    const updated: FontRecord = { ...prev, reviewNotes: [...prev.reviewNotes, note], updatedAt: new Date().toISOString() }
    await db.dbPutRecord(updated)
    await db.dbPutLog({ id: uuid(), recordId, action: 'update', newValue: toLogVal({ reviewNotes: updated.reviewNotes }), operator: author, timestamp: new Date().toISOString(), detail: `添加审稿意见：${content.slice(0, 30)}` })
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: s.records.map((r) => (r.id === recordId ? updated : r)), operationLogs: allLogs }))
  },

  logOperation: async (log) => {
    await db.dbPutLog({ ...log, id: uuid(), timestamp: new Date().toISOString() })
    const allLogs = await db.dbGetAllLogs()
    set({ operationLogs: allLogs })
  },

  revokeOperation: async (logId) => {
    const log = get().operationLogs.find((l) => l.id === logId)
    if (!log || !log.previousValue) return
    const prev = get().records.find((r) => r.id === log.recordId)
    if (!prev) return
    const restored: FontRecord = { ...prev, ...(log.previousValue as Partial<FontRecord>), updatedAt: new Date().toISOString() }
    await db.dbPutRecord(restored)
    await db.dbPutLog({ id: uuid(), recordId: log.recordId, action: 'revoke', previousValue: log.newValue, newValue: log.previousValue, operator: '设计师', timestamp: new Date().toISOString(), detail: `撤回操作：${log.detail}` })
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: s.records.map((r) => (r.id === log.recordId ? restored : r)), operationLogs: allLogs }))
  },

  deleteRecord: async (id, operator = '设计师') => {
    const prev = get().records.find((r) => r.id === id)
    if (!prev) return
    await db.dbDeleteRecord(id)
    await db.dbPutLog({ id: uuid(), recordId: id, action: 'update', previousValue: toLogVal(prev), operator, timestamp: new Date().toISOString(), detail: `删除字体记录：${prev.fontName}` })
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: s.records.filter((r) => r.id !== id), operationLogs: allLogs }))
  },

  importFile: async (file) => {
    const text = await file.text()
    let rows: ImportRow[] = []
    if (file.name.endsWith('.csv')) rows = parseCSV(text)
    else if (file.name.endsWith('.json')) rows = parseJSON(text)
    else throw new Error('不支持的文件格式，请使用 CSV 或 JSON')
    const { conflicts } = detectDuplicates(rows, get().records)
    const session: ImportSession = { id: uuid(), timestamp: new Date().toISOString(), fileName: file.name, totalRows: rows.length, newCount: rows.length - conflicts.length, updateCount: 0, conflictCount: conflicts.length, skipCount: 0, status: 'preview' }
    await db.dbPutImportSession(session)
    set((s) => ({ importSessions: [...s.importSessions, session] }))
    return { session, rows, conflicts }
  },

  resolveConflictsAndImport: async (session, rows, conflicts, operator = '设计师') => {
    const existingRecords = get().records
    const existingMap = new Map<string, FontRecord>()
    for (const r of existingRecords) existingMap.set(buildDuplicateKey(r), r)
    const now = new Date().toISOString()
    const toAdd: FontRecord[] = []
    let updateCount = 0
    let skipCount = 0
    const conflictMap = new Map<number, ConflictItem>()
    for (const c of conflicts) conflictMap.set(c.index, c)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const key = buildDuplicateKey({ fontName: row.fontName, licenseType: row.licenseType as LicenseType, colorCardVersion: row.colorCardVersion })
      const existing = existingMap.get(key)
      const conflict = conflictMap.get(i)
      if (existing && conflict) {
        if (conflict.resolution === 'overwrite') {
          toAdd.push({ ...existing, fontName: row.fontName, foundry: row.foundry, licenseType: (row.licenseType as LicenseType) || existing.licenseType, expiryDate: row.expiryDate || existing.expiryDate, usageScope: row.usageScope || existing.usageScope, customNotes: row.customNotes || existing.customNotes, updatedAt: now })
          updateCount++
        } else if (conflict.resolution === 'merge') {
          toAdd.push({ ...existing, expiryDate: row.expiryDate || existing.expiryDate, usageScope: row.usageScope || existing.usageScope, customNotes: row.customNotes ? `${existing.customNotes}\n${row.customNotes}` : existing.customNotes, updatedAt: now })
          updateCount++
        } else { skipCount++ }
      } else {
        const status: RecordStatus = !row.expiryDate ? 'pending' : isExpired(row.expiryDate) ? 'expired' : 'pending'
        toAdd.push({ id: uuid(), fontName: row.fontName, foundry: row.foundry, licenseType: (row.licenseType as LicenseType) || '自定义', expiryDate: row.expiryDate, usageScope: row.usageScope, colorCardVersion: row.colorCardVersion, customNotes: row.customNotes || '', status, reviewNotes: [], createdAt: now, updatedAt: now, sourceImportId: session.id })
      }
    }

    await db.dbPutRecords(toAdd)
    for (const r of toAdd) {
      await db.dbPutLog({ id: uuid(), recordId: r.id, action: (existingMap.has(buildDuplicateKey(r)) ? 'update' : 'import') as LogAction, newValue: toLogVal(r), operator, timestamp: now, detail: `导入处理：${r.fontName}` })
    }
    const updatedSession: ImportSession = { ...session, newCount: toAdd.length - updateCount, updateCount, skipCount, status: 'completed' }
    await db.dbPutImportSession(updatedSession)
    const allRecords = await db.dbGetAllRecords()
    const allLogs = await db.dbGetAllLogs()
    set((s) => ({ records: allRecords, operationLogs: allLogs, importSessions: s.importSessions.map((imp) => (imp.id === session.id ? updatedSession : imp)) }))
  },

  filterRecords: (filter) => {
    return get().records.filter((r) => {
      if (filter.statuses.length > 0 && !filter.statuses.includes(r.status)) return false
      if (filter.licenseTypes.length > 0 && !filter.licenseTypes.includes(r.licenseType)) return false
      if (filter.colorCardIds.length > 0 && (!r.colorCardId || !filter.colorCardIds.includes(r.colorCardId))) return false
      if (filter.expiryRange) { if (!r.expiryDate) return false; if (r.expiryDate < filter.expiryRange.start || r.expiryDate > filter.expiryRange.end) return false }
      if (filter.search) { const s = filter.search.toLowerCase(); if (!r.fontName.toLowerCase().includes(s) && !r.foundry.toLowerCase().includes(s) && !r.customNotes.toLowerCase().includes(s)) return false }
      return true
    })
  },

  validateExport: (ids) => validateBeforeExport(ids, get().records, get().colorCards),

  exportRecords: async (ids, format, operator = '设计师') => {
    const { records, colorCards } = get()
    const selected = records.filter((r) => ids.includes(r.id))
    const anomalies = validateBeforeExport(ids, records, colorCards)
    const note = generateDeliveryNote(selected, anomalies, operator)
    const snapshot: ExportSnapshot = { id: uuid(), timestamp: new Date().toISOString(), filterCriteria: {}, recordCount: selected.length, anomalyCount: anomalies.length, deliveryNote: note, operator, recordIds: ids }
    await db.dbPutSnapshot(snapshot)
    await db.dbPutLog({ id: uuid(), recordId: snapshot.id, action: 'export', newValue: toLogVal({ recordCount: selected.length, anomalyCount: anomalies.length, format }), operator, timestamp: new Date().toISOString(), detail: `导出 ${selected.length} 条记录（${anomalies.length} 条异常）` })
    downloadFile(selected, anomalies, note, format)
    const allLogs = await db.dbGetAllLogs()
    const allSnapshots = await db.dbGetAllSnapshots()
    set({ operationLogs: allLogs, exportSnapshots: allSnapshots })
    return snapshot
  },

  getColorCardById: (id) => get().colorCards.find((c) => c.id === id),
  getRecordById: (id) => get().records.find((r) => r.id === id),
  getLogsByRecord: (recordId) => get().operationLogs.filter((l) => l.recordId === recordId),
}))

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function downloadFile(records: FontRecord[], anomalies: AnomalyItem[], note: string, format: 'csv' | 'json') {
  let content: string
  let mimeType: string
  let ext: string
  if (format === 'json') {
    content = JSON.stringify({ records, anomalies, deliveryNote: note, exportedAt: new Date().toISOString() }, null, 2)
    mimeType = 'application/json'
    ext = 'json'
  } else {
    const header = '字体名称,厂商,授权类型,到期日,状态,色卡版本,备注'
    const csvRows = records.map((r) => [r.fontName, r.foundry, r.licenseType, r.expiryDate || '', r.status, r.colorCardVersion || '', `"${r.customNotes.replace(/"/g, '""')}"`].join(','))
    content = [header, ...csvRows, '', '# 交付说明', ...note.split('\n').map((l) => `# ${l}`)].join('\n')
    mimeType = 'text/csv;charset=utf-8'
    ext = 'csv'
  }
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `字体授权导出_${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
