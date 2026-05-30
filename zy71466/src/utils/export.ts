import { saveAs } from 'file-saver'
import type { TensileCurve, ClusterResult, ConflictRecord, FilterState, AlignmentParams, AnalysisReport } from '@/types'

export function exportCSV(curves: TensileCurve[], filename: string) {
  const headers = ['ID', '样品编号', '批次', '设备', '断裂形态', '是否异常', '聚类编号', '最大应力', '最大应变']
  const rows = curves.map((c) => [
    c.id,
    c.sampleId,
    c.batchNo,
    c.deviceId,
    c.fractureType || '',
    c.isAnomaly ? '是' : '否',
    c.clusterId !== undefined ? String(c.clusterId) : '',
    Math.max(...c.stress).toFixed(2),
    Math.max(...c.strain).toFixed(4),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, filename)
}

export function exportJSON(report: AnalysisReport, filename: string) {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  saveAs(blob, filename)
}

export function exportFullReport(
  curves: TensileCurve[],
  clusterResult: ClusterResult | null,
  conflicts: ConflictRecord[],
  filterState: FilterState,
  alignmentParams: AlignmentParams
) {
  const report: AnalysisReport = {
    filterState,
    curves,
    clusterResult,
    conflicts,
    alignmentParams,
    exportTime: new Date().toISOString(),
  }

  const reportLines: string[] = [
    '=== 材料强度异常聚类分析报告 ===',
    '',
    `导出时间: ${report.exportTime}`,
    '',
    '--- 筛选条件 ---',
    `批次: ${filterState.selectedBatches.length > 0 ? filterState.selectedBatches.join(', ') : '全部'}`,
    `设备: ${filterState.selectedDevices.length > 0 ? filterState.selectedDevices.join(', ') : '全部'}`,
    `异常类型: ${filterState.selectedAnomalyTypes.length > 0 ? filterState.selectedAnomalyTypes.join(', ') : '全部'}`,
    `断裂形态: ${filterState.selectedFractureTypes.length > 0 ? filterState.selectedFractureTypes.join(', ') : '全部'}`,
    '',
    '--- 对齐参数 ---',
    `对齐方式: ${alignmentParams.mode === 'interpolation' ? '线性插值' : '动态时间规整(DTW)'}`,
    `目标长度: ${alignmentParams.targetLength}`,
    '',
    '--- 数据概览 ---',
    `曲线总数: ${curves.length}`,
    `异常曲线: ${curves.filter((c) => c.isAnomaly).length}`,
    `涉及批次: ${new Set(curves.map((c) => c.batchNo)).size}`,
    `涉及设备: ${new Set(curves.map((c) => c.deviceId)).size}`,
    '',
  ]

  if (clusterResult) {
    reportLines.push('--- 聚类结果 ---')
    reportLines.push(`K值: ${clusterResult.k}`)
    reportLines.push(`轮廓系数: ${clusterResult.silhouette}`)
    reportLines.push('')
    clusterResult.explanations.forEach((e) => {
      reportLines.push(`[簇 ${e.clusterId}] ${e.description}`)
      reportLines.push(`  样本数: ${e.count}, 平均断裂强度: ${e.avgFractureStrength}, 异常比例: ${(e.anomalyRatio * 100).toFixed(1)}%`)
      reportLines.push(`  主导断裂形态: ${e.dominantFractureType}, 主导批次: ${e.dominantBatch}`)
      reportLines.push('')
    })
  }

  if (conflicts.length > 0) {
    reportLines.push('--- 冲突记录 ---')
    reportLines.push(`冲突总数: ${conflicts.length}`)
    reportLines.push('')
    conflicts.forEach((c, i) => {
      reportLines.push(`[${i + 1}] ${c.severity === 'error' ? '严重' : '警告'} - ${c.conflictType}`)
      reportLines.push(`  样品: ${c.sampleId}, 描述: ${c.description}`)
      reportLines.push(`  曲线判断: ${c.curveJudgment}`)
      reportLines.push(`  元数据判断: ${c.metaJudgment}`)
      reportLines.push(`  建议: ${c.suggestion}`)
      reportLines.push('')
    })
  }

  reportLines.push('--- 样品明细 ---')
  curves.forEach((c) => {
    reportLines.push(`${c.id} | ${c.sampleId} | 批次:${c.batchNo} | 设备:${c.deviceId} | ${c.fractureType || '未知'} | ${c.isAnomaly ? '异常' : '正常'} | 簇:${c.clusterId ?? '-'} | 最大应力:${Math.max(...c.stress).toFixed(2)}`)
  })

  const text = reportLines.join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, '材料强度异常聚类报告.txt')

  exportJSON(report, '材料强度异常聚类数据.json')
}
