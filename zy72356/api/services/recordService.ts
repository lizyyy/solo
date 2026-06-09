import { getDb, saveDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { parse } from 'csv-parse/sync'
import { createAuditLog } from './auditService.js'
import type {
  RecordDetail,
  BatchImport,
  ReportResponse,
  ReportSummary,
  ReportGroup,
  RecordStatus,
  RecordSource,
  TemperatureUnit,
  Credibility,
} from '../types.js'

function parseRow(row: Record<string, string>, index: number): {
  sensorId: string
  temperatureValue: number
  temperatureUnit: TemperatureUnit
} {
  const sensorId = row['sensor_id']?.trim()
  const temperatureStr = row['temperature']?.trim()
  const unit = row['unit']?.trim().toUpperCase() as TemperatureUnit

  if (!sensorId) {
    throw new Error(`Row ${index + 1}: 缺少 sensor_id`)
  }
  if (!temperatureStr) {
    throw new Error(`Row ${index + 1}: 缺少 temperature`)
  }
  const temperatureValue = parseFloat(temperatureStr)
  if (isNaN(temperatureValue)) {
    throw new Error(`Row ${index + 1}: temperature 不是有效数字`)
  }
  if (unit !== 'C' && unit !== 'K') {
    throw new Error(`Row ${index + 1}: unit 必须是 C 或 K`)
  }

  return { sensorId, temperatureValue, temperatureUnit: unit }
}

function detectMixedUnits(records: Array<{ sensorId: string; temperatureUnit: TemperatureUnit }>): Map<string, boolean> {
  const sensorUnits = new Map<string, Set<TemperatureUnit>>()
  const hasMixed = new Map<string, boolean>()

  for (const r of records) {
    if (!sensorUnits.has(r.sensorId)) {
      sensorUnits.set(r.sensorId, new Set())
    }
    sensorUnits.get(r.sensorId)!.add(r.temperatureUnit)
  }

  for (const [sensorId, units] of sensorUnits) {
    hasMixed.set(sensorId, units.size > 1)
  }

  return hasMixed
}

function assertCoachRole(operatorRole: string, action: string) {
  const normalized = normalizeRole(operatorRole)
  if (normalized !== 'training_coach') {
    throw new Error(`权限不足：只有训练教练才能${action}，当前角色：${roleToLabel(operatorRole)}`)
  }
}

export function normalizeRole(role: string): string {
  const legacyMap: Record<string, string> = {
    'coach': 'training_coach',
    'senior': 'training_coach',
    'trainer': 'training_coach',
    'engineer_lead': 'engineer',
    'maintenance': 'maintenance_worker',
    'repair': 'maintenance_worker',
  }
  return legacyMap[role] || role
}

export function roleToLabel(role: string): string {
  const r = normalizeRole(role)
  const map: Record<string, string> = {
    'training_coach': '训练教练',
    'maintenance_worker': '维修师傅',
    'engineer': '实验工程师',
    'system': '系统',
  }
  return map[r] || r
}

export async function importFromCsv(fileBuffer: Buffer, fileName: string): Promise<{
  batch: BatchImport
  records: RecordDetail[]
}> {
  const db = await getDb()
  const content = fileBuffer.toString('utf-8')
  const rows = parse(content, { columns: true, skip_empty_lines: true })

  const parsedRows = rows.map((row: Record<string, string>, index: number) =>
    parseRow(row, index)
  )

  const mixedUnits = detectMixedUnits(parsedRows)
  const batchId = uuidv4()
  const now = new Date().toISOString()
  const records: RecordDetail[] = []
  let mixedCount = 0

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]
    const isMixed = mixedUnits.get(row.sensorId)!
    const recordId = uuidv4()
    const status: RecordStatus = isMixed ? 'mixed_unit' : 'normal'
    const source: RecordSource = 'sensor_original'
    const credibility: Credibility | null = isMixed ? 'pending_confirmation' : 'sensor_trusted'

    if (isMixed) {
      mixedCount++
    }

    db.run(`
      INSERT INTO records (
        id, sensor_id, original_line_no, temperature_value, temperature_unit,
        corrected_value, corrected_unit, status, credibility, source, note,
        batch_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      recordId, row.sensorId, i + 1, row.temperatureValue, row.temperatureUnit,
      null, null, status, credibility, source, null,
      batchId, now, now
    ])

    records.push({
      id: recordId,
      sensorId: row.sensorId,
      originalLineNo: i + 1,
      temperatureValue: row.temperatureValue,
      temperatureUnit: row.temperatureUnit,
      correctedValue: null,
      correctedUnit: null,
      status,
      credibility,
      source,
      note: null,
      batchId,
      createdAt: now,
      updatedAt: now,
    })

    await createAuditLog(
      recordId,
      'import',
      'system',
      null,
      JSON.stringify({
        sensorId: row.sensorId,
        temperatureValue: row.temperatureValue,
        temperatureUnit: row.temperatureUnit,
      }),
      isMixed ? '单位混用，待教练复核' : '正常导入'
    )
  }

  db.run(`
    INSERT INTO batch_imports (id, file_name, total_count, mixed_count, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [batchId, fileName, parsedRows.length, mixedCount, now])

  saveDb()

  const batchResult = db.exec('SELECT * FROM batch_imports WHERE id = ?', [batchId])[0]?.values[0]

  const batch: BatchImport = {
    id: batchResult[0] as string,
    fileName: batchResult[1] as string,
    totalCount: batchResult[2] as number,
    mixedCount: batchResult[3] as number,
    createdAt: batchResult[4] as string,
  }
  return { batch, records }
}

function mapRowToRecord(row: any[]): RecordDetail {
  return {
    id: row[0],
    sensorId: row[1],
    originalLineNo: row[2],
    temperatureValue: row[3],
    temperatureUnit: row[4] as TemperatureUnit,
    correctedValue: row[5],
    correctedUnit: row[6] as TemperatureUnit | null,
    status: row[7] as RecordStatus,
    credibility: row[8] as Credibility | null,
    source: row[9] as RecordSource,
    note: row[10],
    batchId: row[11],
    createdAt: row[12],
    updatedAt: row[13],
  }
}

export async function getRecords(filters: {
  status?: RecordStatus
  sensorId?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ records: RecordDetail[]; total: number }> {
  const db = await getDb()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const offset = (page - 1) * pageSize

  let whereClauses: string[] = []
  let params: any[] = []

  if (filters.status) {
    whereClauses.push('status = ?')
    params.push(filters.status)
  }
  if (filters.sensorId) {
    whereClauses.push('sensor_id = ?')
    params.push(filters.sensorId)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countResult = db.exec(
    `SELECT COUNT(*) FROM records ${whereSql}`,
    params
  )[0]?.values[0]?.[0] || 0

  const rows = db.exec(
    `SELECT * FROM records ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )[0]?.values || []

  return {
    records: rows.map(mapRowToRecord),
    total: countResult as number,
  }
}

export async function getRecordById(id: string): Promise<RecordDetail | null> {
  const db = await getDb()
  const row = db.exec('SELECT * FROM records WHERE id = ?', [id])[0]?.values[0]
  return row ? mapRowToRecord(row) : null
}

export async function reviewRecord(
  id: string,
  data: {
    credibility: Credibility
    correctedValue?: number
    correctedUnit?: TemperatureUnit
    note?: string | null
    operatorRole: string
  }
): Promise<RecordDetail | null> {
  const db = await getDb()
  const record = await getRecordById(id)
  if (!record) return null

  const now = new Date().toISOString()
  const oldValue = JSON.stringify({
    correctedValue: record.correctedValue,
    correctedUnit: record.correctedUnit,
    credibility: record.credibility,
    status: record.status,
    source: record.source,
    note: record.note,
  })

  const newCorrectedValue = data.correctedValue ?? record.correctedValue
  const newCorrectedUnit = data.correctedUnit ?? record.correctedUnit
  const newNote = data.note ?? record.note
  const newStatus = data.correctedValue !== undefined ? 'anomaly' : record.status
  const newSource = data.correctedValue !== undefined ? 'photo_corrected' : record.source

  db.run(`
    UPDATE records
    SET corrected_value = ?, corrected_unit = ?, status = ?, credibility = ?, source = ?, note = ?, updated_at = ?
    WHERE id = ?
  `, [
    newCorrectedValue,
    newCorrectedUnit,
    newStatus,
    data.credibility,
    newSource,
    newNote,
    now,
    id,
  ])

  saveDb()

  await createAuditLog(
    id,
    'review',
    normalizeRole(data.operatorRole),
    oldValue,
    JSON.stringify({
      correctedValue: newCorrectedValue,
      correctedUnit: newCorrectedUnit,
      credibility: data.credibility,
      status: newStatus,
      source: newSource,
    }),
    newNote || '复核操作'
  )

  return await getRecordById(id)
}

export async function confirmRecord(
  id: string,
  operatorRole: string,
  note?: string | null
): Promise<RecordDetail | null> {
  assertCoachRole(operatorRole, '确认记录')

  const db = await getDb()
  const record = await getRecordById(id)
  if (!record) return null

  const now = new Date().toISOString()
  const oldValue = JSON.stringify({
    status: record.status,
    credibility: record.credibility,
    source: record.source,
    note: record.note,
  })

  const newNote = note ?? record.note

  db.run(`
    UPDATE records
    SET status = ?, credibility = ?, source = ?, note = ?, updated_at = ?
    WHERE id = ?
  `, [
    'confirmed',
    'photo_trusted',
    'coach_confirmed',
    newNote,
    now,
    id,
  ])

  saveDb()

  await createAuditLog(
    id,
    'confirm',
    normalizeRole(operatorRole),
    oldValue,
    JSON.stringify({ status: 'confirmed', credibility: 'photo_trusted' }),
    newNote || '教练确认'
  )

  return await getRecordById(id)
}

export async function rollbackRecord(
  id: string,
  reason: string,
  operatorRole: string
): Promise<RecordDetail | null> {
  assertCoachRole(operatorRole, '回滚记录')

  const db = await getDb()
  const record = await getRecordById(id)
  if (!record) return null

  const now = new Date().toISOString()
  const oldValue = JSON.stringify({
    correctedValue: record.correctedValue,
    correctedUnit: record.correctedUnit,
    status: record.status,
    credibility: record.credibility,
    source: record.source,
    note: record.note,
  })

  db.run(`
    UPDATE records
    SET corrected_value = ?, corrected_unit = ?, status = ?, credibility = ?, source = ?, note = ?, updated_at = ?
    WHERE id = ?
  `, [
    null,
    null,
    'rolled_back',
    null,
    'rolled_back',
    reason,
    now,
    id,
  ])

  saveDb()

  await createAuditLog(
    id,
    'rollback',
    normalizeRole(operatorRole),
    oldValue,
    JSON.stringify({ status: 'rolled_back', reason }),
    reason
  )

  return await getRecordById(id)
}

export async function getReport(): Promise<ReportResponse> {
  const db = await getDb()

  const allRecords = db.exec('SELECT * FROM records ORDER BY sensor_id, original_line_no')[0]?.values || []

  const records = allRecords.map(mapRowToRecord)

  const isPending = (r: RecordDetail) =>
    r.status === 'mixed_unit' ||
    r.status === 'anomaly' ||
    r.credibility === 'pending_confirmation'

  const summary: ReportSummary = {
    totalRecords: records.length,
    normalCount: records.filter(r => r.status === 'normal').length,
    mixedCount: records.filter(r => r.status === 'mixed_unit').length,
    pendingCount: records.filter(isPending).length,
    confirmedCount: records.filter(r => r.status === 'confirmed').length,
    rolledBackCount: records.filter(r => r.status === 'rolled_back').length,
  }

  const groupsMap = new Map<string, RecordDetail[]>()
  for (const record of records) {
    if (!groupsMap.has(record.sensorId)) {
      groupsMap.set(record.sensorId, [])
    }
    groupsMap.get(record.sensorId)!.push(record)
  }

  const groups: ReportGroup[] = Array.from(groupsMap.entries()).map(([sensorId, records]) => ({
    sensorId,
    records,
  }))

  return { summary, groups }
}

export async function getReportCsv(): Promise<string> {
  const report = await getReport()

  const statusToLabel: Record<string, string> = {
    normal: '正常',
    mixed_unit: '混用待复核',
    anomaly: '已修正待确认',
    confirmed: '教练已确认',
    rolled_back: '已回滚',
  }
  const credibilityToLabel: Record<string, string> = {
    sensor_trusted: '传感器可信',
    photo_trusted: '工况照片可信',
    pending_confirmation: '待训练教练复核',
  }
  const sourceToLabel: Record<string, string> = {
    sensor_original: '传感器原始',
    photo_corrected: '维修师傅补看照片修正',
    coach_confirmed: '训练教练确认',
    rolled_back: '训练教练回滚',
  }
  const nextStepFor = (r: RecordDetail): string => {
    if (r.status === 'confirmed') return '记录已完成，无待办'
    if (r.status === 'rolled_back') return '已回滚至原始值，如需确认请训练教练处理'
    if (r.credibility === 'pending_confirmation') return '请训练教练复核并确认/回滚'
    if (r.correctedValue !== null) return '已标记照片可信，请训练教练确认'
    if (r.status === 'mixed_unit') return '同一传感器单位混用，请维修师傅先补看工况照片，再由训练教练复核'
    if (r.status === 'anomaly') return '请训练教练确认'
    return '数据正常，无需处理'
  }

  const header = [
    '传感器ID',
    '原始行号',
    '原始温度',
    '原始单位',
    '修正后温度',
    '修正后单位',
    '展示温度',
    '展示单位',
    '处理状态',
    '可信度结论',
    '数据来源',
    '单位混用风险',
    '处理备注',
    '下一步找谁',
    '批次ID',
    '创建时间',
    '更新时间',
  ].join(',')

  const rows = report.groups.flatMap(group =>
    group.records.map(r => [
      r.sensorId,
      r.originalLineNo,
      r.temperatureValue,
      r.temperatureUnit === 'C' ? '°C' : 'K',
      r.correctedValue !== null ? r.correctedValue : '',
      r.correctedUnit !== null ? (r.correctedUnit === 'C' ? '°C' : 'K') : '',
      r.correctedValue ?? r.temperatureValue,
      (r.correctedUnit ?? r.temperatureUnit) === 'C' ? '°C' : 'K',
      statusToLabel[r.status] ?? r.status,
      r.credibility ? (credibilityToLabel[r.credibility] ?? r.credibility) : '',
      sourceToLabel[r.source] ?? r.source,
      r.status === 'mixed_unit' ? '是 - 同一传感器两种单位混用' : (r.credibility === 'pending_confirmation' ? '待复核确认' : '否'),
      r.note ?? '',
      nextStepFor(r),
      r.batchId,
      r.createdAt,
      r.updatedAt,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  )

  return [header, ...rows].join('\n')
}
