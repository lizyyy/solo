import type { Location, LocationAlias, Feedback } from '@/types'

const HEADERS = [
  '标准名称',
  '原始写法',
  '地址',
  '充电桩数量',
  '状态',
  '来源',
  '来源详情',
  '归并状态',
  '是否例外',
  '例外说明',
  '原始备注',
  '别名列表',
  '关联反馈数',
  '创建时间',
  '更新时间',
]

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportToCSV(
  locations: Location[],
  aliases: LocationAlias[],
  feedbacks: Feedback[]
): string {
  const aliasMap = new Map<string, string[]>()
  for (const alias of aliases) {
    const list = aliasMap.get(alias.locationId) ?? []
    list.push(alias.alias)
    aliasMap.set(alias.locationId, list)
  }

  const feedbackCountMap = new Map<string, number>()
  for (const fb of feedbacks) {
    feedbackCountMap.set(fb.locationId, (feedbackCountMap.get(fb.locationId) ?? 0) + 1)
  }

  const headerLine = HEADERS.map(escapeCSV).join(',')

  const rows = locations.map((loc) => {
    const aliasList = aliasMap.get(loc.id)?.join('/') ?? ''
    const feedbackCount = feedbackCountMap.get(loc.id) ?? 0
    const values = [
      loc.canonicalName,
      loc.originalName,
      loc.address,
      String(loc.chargerCount),
      loc.status,
      loc.source,
      loc.sourceDetail,
      loc.mergeStatus,
      loc.isException ? '是' : '否',
      loc.exceptionNote,
      loc.rawNote,
      aliasList,
      String(feedbackCount),
      loc.createdAt,
      loc.updatedAt,
    ]
    return values.map(escapeCSV).join(',')
  })

  return [headerLine, ...rows].join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
