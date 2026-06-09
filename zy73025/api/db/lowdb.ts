import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { nanoid } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import type {
  DatabaseSchema,
  TempRecord,
  HistoryEntry,
  ExceptionItem,
  TempPoint,
  WeightPoint,
  InfluenceFactor,
} from '@shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbDir = __dirname
const dbFile = path.join(dbDir, 'data.json')

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

function genTempCurve(base: number, variance = 0.15, count = 12): TempPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i * 5,
    value: Number((base + (Math.random() - 0.5) * variance * 2).toFixed(2)),
  }))
}

function genBoundaryCurve(
  min: number,
  max: number,
  count = 12,
): TempPoint[] {
  const result: TempPoint[] = []
  const boundaryRatio = 0.4
  for (let i = 0; i < count; i++) {
    const t = i * 5
    let value: number
    if (i < Math.floor(count * boundaryRatio)) {
      value = Number((min + Math.random() * 0.15).toFixed(2))
    } else if (i < Math.floor(count * boundaryRatio * 2)) {
      value = Number((max - Math.random() * 0.15).toFixed(2))
    } else {
      const mid = (min + max) / 2
      value = Number((mid + (Math.random() - 0.5) * 0.3).toFixed(2))
    }
    result.push({ t, value })
  }
  return result
}

function genWeightCurve(
  hasLegacy = false,
  count = 8,
): WeightPoint[] {
  const base = 1000
  const result: WeightPoint[] = []
  for (let i = 0; i < count; i++) {
    const isLegacy = hasLegacy && i < 3
    result.push({
      t: i * 7,
      value: base + i * 50 + Math.floor(Math.random() * 30),
      version: isLegacy ? 'legacy' : 'new',
    })
  }
  return result
}

function daysAgoISO(days: number, hour = 10, minute = 0): string {
  const d = new Date('2026-06-09T10:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

function nowISO(): string {
  return new Date('2026-06-09T10:00:00Z').toISOString()
}

function createFactor(
  id: string,
  type: InfluenceFactor['type'],
  label: string,
  description: string,
  affectedRecords: string[],
  impact: InfluenceFactor['impact'] = 'neutral',
): InfluenceFactor {
  return { id, type, label, impact, description, affectedRecords }
}

function buildInitialData(): DatabaseSchema {
  const records: TempRecord[] = []
  const history: HistoryEntry[] = []
  const queue: ExceptionItem[] = []

  records.push({
    id: 'rec-R001',
    code: 'R001',
    petName: '豆豆',
    ownerName: '张小明',
    petType: '仓鼠',
    visitDate: daysAgoISO(1, 9, 30).slice(0, 10),
    reviewer: '李医生',
    status: 'pending',
    conclusion: 'normal',
    tempCurve: genTempCurve(37.2, 0.1),
    tempThreshold: { min: 36.5, max: 38.0 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: '2026-03-15', name: '狂犬疫苗' },
      { date: '2026-04-20', name: '多联疫苗' },
    ],
    notes: [
      {
        id: 'note-R001-1',
        content: '饮食正常，精神状态良好',
        source: 'written',
        operator: '李医生',
        time: daysAgoISO(1, 10, 0),
      },
    ],
    factors: [],
    hasLegacyCurve: false,
    isBoundarySample: false,
    updatedAt: daysAgoISO(1, 11, 0),
    createdAt: daysAgoISO(1, 9, 0),
  })

  records.push({
    id: 'rec-R002',
    code: 'R002',
    petName: '花花',
    ownerName: '王大伟',
    petType: '龙猫',
    visitDate: daysAgoISO(2, 14, 0).slice(0, 10),
    reviewer: '赵医生',
    status: 'pending',
    conclusion: 'abnormal',
    tempCurve: genTempCurve(38.3, 0.2),
    tempThreshold: { min: 36.0, max: 37.8 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: null, name: '狂犬疫苗' },
      { date: '2026-02-10', name: '多联疫苗' },
    ],
    notes: [],
    factors: [
      createFactor(
        'fac-R002-1',
        'vaccine_missing',
        '狂犬疫苗接种日期缺失',
        '狂犬疫苗记录中日期字段为空，无法确认免疫状态',
        ['rec-R002'],
        'negative',
      ),
    ],
    hasLegacyCurve: false,
    isBoundarySample: false,
    updatedAt: daysAgoISO(2, 16, 30),
    createdAt: daysAgoISO(2, 13, 30),
  })

  records.push({
    id: 'rec-R003',
    code: 'R003',
    petName: '毛毛',
    ownerName: '刘小芳',
    petType: '兔子',
    visitDate: daysAgoISO(4, 10, 30).slice(0, 10),
    reviewer: '孙医生',
    status: 'pending',
    conclusion: 'observe',
    tempCurve: genTempCurve(38.8, 0.12),
    tempThreshold: { min: 38.0, max: 39.5 },
    weightCurve: genWeightCurve(true, 10),
    vaccines: [
      { date: '2026-01-18', name: '狂犬疫苗' },
    ],
    notes: [
      {
        id: 'note-R003-1',
        content: '体重数据包含历史记录，需结合临床判断',
        source: 'written',
        operator: '孙医生',
        time: daysAgoISO(4, 11, 30),
      },
    ],
    factors: [
      createFactor(
        'fac-R003-1',
        'legacy_curve',
        '体重曲线包含旧版数据',
        '检测到 3 个历史版本的体重测量点，可能影响趋势分析准确性',
        ['rec-R003'],
        'neutral',
      ),
    ],
    hasLegacyCurve: true,
    isBoundarySample: false,
    updatedAt: daysAgoISO(4, 12, 0),
    createdAt: daysAgoISO(4, 10, 0),
  })

  records.push({
    id: 'rec-R004',
    code: 'R004',
    petName: '雪球',
    ownerName: '陈静怡',
    petType: '荷兰猪',
    visitDate: daysAgoISO(6, 15, 0).slice(0, 10),
    reviewer: '周医生',
    status: 'pending',
    conclusion: 'observe',
    tempCurve: genBoundaryCurve(37.2, 38.8),
    tempThreshold: { min: 37.2, max: 38.8 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: '2026-02-22', name: '狂犬疫苗' },
      { date: '2026-05-01', name: '多联疫苗' },
    ],
    notes: [],
    factors: [
      createFactor(
        'fac-R004-1',
        'boundary_sample',
        '温度样本接近阈值边界',
        '多个测量点在温度阈值 ±0.2℃ 范围内，需人工复核确认',
        ['rec-R004'],
        'neutral',
      ),
    ],
    hasLegacyCurve: false,
    isBoundarySample: true,
    updatedAt: daysAgoISO(6, 17, 0),
    createdAt: daysAgoISO(6, 14, 30),
  })

  records.push({
    id: 'rec-R005',
    code: 'R005',
    petName: '团团',
    ownerName: '林志强',
    petType: '鹦鹉',
    visitDate: daysAgoISO(9, 11, 0).slice(0, 10),
    reviewer: '吴医生',
    status: 'confirmed',
    conclusion: 'normal',
    tempCurve: genTempCurve(40.8, 0.15),
    tempThreshold: { min: 40.0, max: 42.0 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: '2026-03-08', name: '多联疫苗' },
    ],
    notes: [
      {
        id: 'note-R005-1',
        content: '主人反映近期食量略有减少，口头告知无其他异常',
        source: 'verbal',
        operator: '吴医生',
        time: daysAgoISO(9, 11, 30),
      },
      {
        id: 'note-R005-2',
        content: '体征检查正常，建议观察一周后复诊',
        source: 'written',
        operator: '吴医生',
        time: daysAgoISO(9, 12, 0),
      },
    ],
    factors: [
      createFactor(
        'fac-R005-1',
        'verbal_note',
        '存在口头备注记录',
        '检测到 1 条口述来源的备注信息，书面信息完整性受限',
        ['rec-R005'],
        'neutral',
      ),
    ],
    hasLegacyCurve: false,
    isBoundarySample: false,
    updatedAt: daysAgoISO(9, 14, 0),
    createdAt: daysAgoISO(9, 10, 30),
  })

  records.push({
    id: 'rec-R006',
    code: 'R006',
    petName: '圆圆',
    ownerName: '黄丽娟',
    petType: '雪貂',
    visitDate: daysAgoISO(12, 9, 0).slice(0, 10),
    reviewer: '郑医生',
    status: 'confirmed',
    conclusion: 'observe',
    tempCurve: genTempCurve(38.9, 0.2),
    tempThreshold: { min: 37.8, max: 39.2 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: '2026-01-05', name: '狂犬疫苗' },
      { date: '2026-04-12', name: '多联疫苗' },
    ],
    notes: [
      {
        id: 'note-R006-1',
        content: '改判说明：复查血常规指标正常，原异常为应激反应导致',
        source: 'written',
        operator: '郑医生',
        time: daysAgoISO(10, 15, 0),
      },
    ],
    factors: [],
    pendingReason: '初次检测温度偏高，疑似炎症，后经复查排除',
    hasLegacyCurve: false,
    isBoundarySample: false,
    updatedAt: daysAgoISO(10, 15, 30),
    createdAt: daysAgoISO(12, 8, 30),
  })

  records.push({
    id: 'rec-R007',
    code: 'R007',
    petName: '阿黑',
    ownerName: '许文彬',
    petType: '刺猬',
    visitDate: daysAgoISO(13, 13, 0).slice(0, 10),
    reviewer: '冯医生',
    status: 'exception',
    conclusion: 'abnormal',
    tempCurve: genTempCurve(35.8, 0.2),
    tempThreshold: { min: 36.5, max: 37.8 },
    weightCurve: genWeightCurve(false),
    vaccines: [
      { date: '2025-12-20', name: '狂犬疫苗' },
    ],
    notes: [],
    factors: [],
    pendingReason: '体温持续低于正常范围，且主人无法提供完整的既往病史，需进一步检查确认',
    hasLegacyCurve: false,
    isBoundarySample: false,
    updatedAt: daysAgoISO(13, 16, 0),
    createdAt: daysAgoISO(13, 12, 30),
  })

  for (const rec of records) {
    history.push({
      id: `hist-${rec.id}-create`,
      recordId: rec.id,
      action: 'create',
      isManual: false,
      operator: rec.reviewer,
      time: rec.createdAt,
      summary: `创建记录 ${rec.code} - ${rec.petName}`,
      oldSnapshot: {},
      newSnapshot: { ...rec },
    })
  }

  const r006 = records.find((r) => r.id === 'rec-R006')!
  const oldConclusionSnapshot: Partial<TempRecord> = {
    conclusion: 'abnormal',
    status: 'pending',
    pendingReason: '初次检测温度偏高，疑似炎症',
    updatedAt: daysAgoISO(12, 11, 0),
  }
  const newConclusionSnapshot: Partial<TempRecord> = {
    conclusion: r006.conclusion,
    status: r006.status,
    pendingReason: r006.pendingReason,
    updatedAt: r006.updatedAt,
    notes: r006.notes,
  }
  history.push({
    id: 'hist-rec-R006-rejudge',
    recordId: 'rec-R006',
    action: 'rejudge',
    isManual: true,
    operator: '郑医生',
    time: daysAgoISO(10, 15, 30),
    summary: '改判结论：abnormal → observe',
    reason: '复查血常规、CRP 指标均正常，结合临床观察，原异常为入院应激导致的一过性体温升高，建议观察两周后复诊确认',
    oldSnapshot: oldConclusionSnapshot,
    newSnapshot: newConclusionSnapshot,
  })

  queue.push({
    id: 'q-R002-vm',
    recordId: 'rec-R002',
    type: 'vaccine_missing',
    title: '狂犬疫苗接种日期缺失',
    reason: '花花（R002）的狂犬疫苗接种记录中日期为空，无法确认有效免疫',
    affectedRecords: ['rec-R002'],
    status: 'open',
    createdAt: daysAgoISO(2, 16, 35),
    suggestion: '联系主人王大伟补充狂犬疫苗接种凭证，确认免疫状态后补录日期',
  })

  queue.push({
    id: 'q-R004-bs',
    recordId: 'rec-R004',
    type: 'boundary_sample',
    title: '温度样本接近阈值边界',
    reason: '雪球（R004）的温度曲线多个测点处于阈值边缘，存在误判风险',
    affectedRecords: ['rec-R004'],
    status: 'open',
    createdAt: daysAgoISO(6, 17, 5),
    suggestion: '建议复核员周医生人工查看完整温度曲线数据，结合体征综合判断',
  })

  queue.push({
    id: 'q-R003-lc',
    recordId: 'rec-R003',
    type: 'legacy_curve',
    title: '体重曲线混入旧版数据',
    reason: '毛毛（R003）体重曲线中存在旧版测量系统的数据点',
    affectedRecords: ['rec-R003'],
    status: 'open',
    createdAt: daysAgoISO(4, 12, 5),
    suggestion: '建议孙医生确认旧版数据测量仪器的校准情况，判断是否需要剔除异常点',
  })

  queue.push({
    id: 'q-R007-pr',
    recordId: 'rec-R007',
    type: 'pending_reason',
    title: '异常记录待确认',
    reason: '阿黑（R007）体温异常偏低，且主人无法提供完整既往病史，需要人工确认原因',
    affectedRecords: ['rec-R007'],
    status: 'open',
    createdAt: daysAgoISO(13, 16, 10),
    suggestion: '冯医生需联系主人许文彬补充详细病史，必要时安排进一步检查（血常规、生化、影像）',
  })

  return { records, history, queue }
}

const defaultData = buildInitialData()

const adapter = new JSONFile<DatabaseSchema>(dbFile)
export const db = new Low<DatabaseSchema>(adapter, defaultData)

export async function initDB(): Promise<void> {
  if (!fs.existsSync(dbFile)) {
    db.data = buildInitialData()
    await db.write()
  } else {
    await db.read()
    if (!db.data || !db.data.records || !db.data.history || !db.data.queue) {
      db.data = buildInitialData()
      await db.write()
    }
  }
}

export function newId(prefix = ''): string {
  return prefix + nanoid(10)
}
