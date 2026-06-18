import type { AnomalyRecord, FilterProfile } from './types'

export function filterAnomalies(records: AnomalyRecord[], filter: FilterProfile): AnomalyRecord[] {
  return records.filter((r) => {
    if (filter.buoyId && r.buoyId !== filter.buoyId) return false
    if (filter.anomalyType && r.anomalyType !== filter.anomalyType) return false
    if (filter.status && r.status !== filter.status) return false
    if (filter.dateFrom && r.sensorTimestamp < filter.dateFrom) return false
    if (filter.dateTo && r.sensorTimestamp > filter.dateTo + 'T23:59:59') return false
    return true
  })
}

export function exportToCSV(records: AnomalyRecord[], filter: FilterProfile): void {
  const header = [
    '浮标编号',
    '传感器时间',
    '纬度',
    '经度',
    '水温(°C)',
    '盐度(PSU)',
    '溶解氧(mg/L)',
    'pH值',
    '异常类型',
    '状态',
    '创建时间',
  ].join(',')

  const rows = records.map((r) =>
    [
      r.buoyId,
      r.sensorTimestamp,
      r.sensorLat,
      r.sensorLng,
      r.waterTemp,
      r.salinity,
      r.dissolvedOxygen,
      r.phValue,
      r.anomalyType,
      r.status,
      r.createdAt,
    ].join(',')
  )

  const filterMeta = filter.applyToExport
    ? `\n# 筛选口径: buoyId=${filter.buoyId || '*'}, anomalyType=${filter.anomalyType || '*'}, status=${filter.status || '*'}, dateFrom=${filter.dateFrom || '*'}, dateTo=${filter.dateTo || '*'}\n\n`
    : '\n'

  const csv = filterMeta + header + '\n' + rows.join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `浮标海况异常预警_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
