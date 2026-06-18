import type { SampleRecord, DataSourceEntry, ChangeRecord, ReviewFlag, HandoverItem } from '@/types'

export function exportToCSV(
  records: SampleRecord[],
  dataSources: DataSourceEntry[],
  changes: ChangeRecord[],
  reviews: ReviewFlag[],
  handovers: HandoverItem[]
) {
  const headers = [
    '采样瓶编号', '站点', '纬度', '经度', '采样时间',
    '检测参数', '检测值', '单位', '阈值', '是否异常',
    '记录本页码', '当前结论', '数据来源类型', '来源时间戳', '操作人',
    '复核状态', '复核原因', '对齐状态', '交接状态', '结论变更次数',
  ]

  const rows = records.map((r) => {
    const ds = dataSources.filter((d) => d.recordId === r.id)
    const latestDs = ds[ds.length - 1]
    const review = reviews.find((rv) => rv.recordId === r.id)
    const handover = handovers.find((h) => h.recordId === r.id)
    const changeCount = changes.filter((c) => c.recordId === r.id && c.field === 'conclusion').length

    return [
      r.bottleNumber,
      r.stationName,
      r.latitude,
      r.longitude,
      r.sampleTime,
      r.parameter,
      r.value,
      r.unit,
      r.threshold,
      r.isAnomaly ? '是' : '否',
      r.logbookPage,
      r.conclusion,
      latestDs?.sourceType ?? '',
      latestDs?.timestamp ?? '',
      latestDs?.operator ?? '',
      review?.reviewStatus ?? '',
      review?.reviewReason ?? '',
      handover?.alignmentStatus ?? '',
      handover?.handoverStatus ?? '',
      changeCount,
    ]
  })

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `近岸水质空间标注_交接明细_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function formatDateTime(isoString: string) {
  if (!isoString) return '--'
  const d = new Date(isoString)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getSourceTypeColor(type: string) {
  switch (type) {
    case 'original': return 'bg-[#00BFA5]/20 text-[#00BFA5] border-[#00BFA5]/30'
    case 'late_attachment': return 'bg-[#D4A843]/20 text-[#D4A843] border-[#D4A843]/30'
    case 'supplementary_note': return 'bg-[#7C8CF8]/20 text-[#7C8CF8] border-[#7C8CF8]/30'
    case 'latest_export': return 'bg-[#E8653A]/20 text-[#E8653A] border-[#E8653A]/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}
