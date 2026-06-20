export interface DiffChunk {
  key: string
  before: unknown
  after: unknown
  changed: boolean
}

const FRIENDLY_KEYS: Record<string, string> = {
  pet_name: '宠物名',
  pet_id: '规范宠物ID',
  course_name: '课程名称',
  course_date: '上课日期',
  duration_min: '时长(分钟)',
  trainer: '训导师',
  status: '状态',
  anomaly_reason: '异常原因',
  confirmed_by: '确认人',
  confirmed_at: '确认时间',
  withdrawn_at: '撤回时间',
  diagnosis: '诊断',
  treatment: '处置',
  veterinarian: '医生',
  visit_date: '就诊日期',
  linked_schedule_id: '关联排程ID',
  source_label: '来源单据',
  source_row: '来源行',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  withdrawn: '已撤回',
  anomaly: '异常隔离',
  linked: '已关联',
  needs_review: '待复核',
}

export function friendlyKey(key: string): string {
  return FRIENDLY_KEYS[key] || key
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'string') {
    if (STATUS_LABELS[v]) return STATUS_LABELS[v]
    return v
  }
  if (Array.isArray(v)) return v.length > 0 ? v.join('、') : '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function deepDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): DiffChunk[] {
  const b = before ?? ({} as Record<string, unknown>)
  const a = after ?? ({} as Record<string, unknown>)
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)])
  const chunks: DiffChunk[] = []

  for (const key of Array.from(keys).sort()) {
    if (key === 'id' || key.endsWith('_id') && key !== 'pet_id' && key !== 'linked_schedule_id') continue
    const beforeVal = b[key]
    const afterVal = a[key]
    const bStr = formatValue(beforeVal)
    const aStr = formatValue(afterVal)
    chunks.push({
      key,
      before: beforeVal,
      after: afterVal,
      changed: bStr !== aStr,
    })
  }
  return chunks
}

export { formatValue }
