import * as XLSX from 'xlsx'
import type { ImportRow, Location, DataSource, LocationStatus } from '@/types'

const COLUMN_MAP: Record<string, keyof Partial<Location>> = {
  '点位名称': 'originalName',
  '名称': 'originalName',
  '地址': 'address',
  '充电桩数量': 'chargerCount',
  '数量': 'chargerCount',
  '状态': 'status',
  '来源': 'source',
  '备注': 'rawNote',
}

const VALID_STATUSES: Set<string> = new Set<LocationStatus>(['规划中', '施工中', '已启用', '暂停'])
const VALID_SOURCES: Set<string> = new Set<DataSource>(['表格', '照片', '审批记录', '手动补录'])

function mapRow(raw: Record<string, string>): { parsed: Partial<Location>; errors: string[] } {
  const parsed: Partial<Location> = {}
  const errors: string[] = []

  for (const [header, value] of Object.entries(raw)) {
    const field = COLUMN_MAP[header]
    if (!field) continue

    if (field === 'chargerCount') {
      const num = Number(value)
      parsed.chargerCount = num
      if (isNaN(num) || num < 0) {
        errors.push(`充电桩数量无效: "${value}"`)
      }
    } else if (field === 'status') {
      parsed.status = value as LocationStatus
      if (!VALID_STATUSES.has(value)) {
        errors.push(`无法识别的状态: "${value}"`)
      }
    } else if (field === 'source') {
      parsed.source = (VALID_SOURCES.has(value) ? value : '手动补录') as DataSource
    } else {
      (parsed as Record<string, string>)[field] = value
    }
  }

  if (!parsed.originalName) {
    errors.push('缺少点位名称')
  }

  return { parsed, errors }
}

export async function parseFile(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  return rows.map((raw, index) => {
    const { parsed, errors } = mapRow(raw)
    return {
      rowIndex: index + 2,
      raw,
      parsed,
      errors,
      isAnomaly: errors.length > 0,
    }
  })
}
