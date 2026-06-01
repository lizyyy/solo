import type { Batch, AuditLog } from '@/types'

export function exportBatchReport(batch: Batch): void {
  const lines: string[] = []

  lines.push('=== 小提琴琴弦张力复核报告 ===')
  lines.push('')
  lines.push(`批次名称: ${batch.name}`)
  lines.push(`实验类型: ${batch.experimentType}`)
  lines.push(`创建时间: ${formatTime(batch.createdAt)}`)
  lines.push(`判定状态: ${statusLabel(batch.status)}`)
  lines.push('')

  const primaryRecord = batch.parameterRecords.find((r) => r.source === '实验表')
    ?? batch.parameterRecords.find((r) => r.measurements.length > 0)

  if (primaryRecord) {
    lines.push(`--- 参数来源: ${primaryRecord.source} ---`)
    lines.push(`来源说明: ${primaryRecord.sourceDescription}`)
    lines.push(`录入时间: ${formatTime(primaryRecord.recordedAt)}`)
    lines.push('')
    lines.push('弦别\t标准张力(N)\t实测张力(N)\t偏差率(%)\t是否异常\t异常原因')
    for (const m of primaryRecord.measurements) {
      lines.push(
        `${m.stringName}\t${m.standardTension}\t${m.measuredTension}\t${m.deviationRate}\t${m.isAnomaly ? '异常' : '正常'}\t${m.anomalyReason || '-'}`
      )
    }
    lines.push('')
  }

  const envRecord = batch.parameterRecords.find((r) => r.environment !== null)
  if (envRecord?.environment) {
    const env = envRecord.environment
    lines.push('--- 环境工况 ---')
    lines.push(`温度: ${env.temperature}°C`)
    lines.push(`湿度: ${env.humidity}%`)
    lines.push(`备注: ${env.note}`)
    lines.push('')
  }

  if (batch.conflicts.length > 0) {
    lines.push('--- 数据冲突 ---')
    for (const c of batch.conflicts) {
      lines.push(`参数: ${c.parameterName}`)
      lines.push(`  导入值: ${c.importValue}（来源: ${c.importSource}）`)
      lines.push(`  巡检值: ${c.inspectionValue}（来源: ${c.inspectionSource}）`)
      lines.push(`  建议: ${c.suggestion}`)
      lines.push('')
    }
  }

  lines.push('--- 审计日志 ---')
  for (const log of batch.auditLogs) {
    lines.push(
      `[${formatTime(log.timestamp)}] ${log.action} | 操作人: ${log.actor} | 阈值版本: ${log.thresholdVersion} | 来源: ${log.source} | 原因: ${log.reason}`
    )
  }

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `小提琴琴弦张力复核_${batch.name.replace(/\s+/g, '_')}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusLabel(status: Batch['status']): string {
  const map: Record<Batch['status'], string> = {
    pending: '待复核',
    reviewing: '复核中',
    passed: '已通过',
    anomaly: '异常',
  }
  return map[status] ?? status
}

export function exportComparisonReport(batchA: Batch, batchB: Batch): void {
  const lines: string[] = []
  lines.push('=== 小提琴琴弦张力复核 - 历史对比报告 ===')
  lines.push('')
  lines.push(`批次A: ${batchA.name}（${statusLabel(batchA.status)}）`)
  lines.push(`批次B: ${batchB.name}（${statusLabel(batchB.status)}）`)
  lines.push('')
  lines.push('弦别\t批次A标准(N)\t批次A实测(N)\t批次A偏差(%)\t批次A状态\t批次B标准(N)\t批次B实测(N)\t批次B偏差(%)\t批次B状态')

  const measA = getPrimaryMeasurements(batchA)
  const measB = getPrimaryMeasurements(batchB)

  for (const m of measA) {
    const match = measB.find((b) => b.stringName === m.stringName)
    lines.push(
      `${m.stringName}\t${m.standardTension}\t${m.measuredTension}\t${m.deviationRate}\t${m.isAnomaly ? '异常' : '正常'}\t${match?.standardTension ?? '-'}\t${match?.measuredTension ?? '-'}\t${match?.deviationRate ?? '-'}\t${match?.isAnomaly ? '异常' : '正常'}`
    )
  }
  lines.push('')
  lines.push('--- 批次A审计日志 ---')
  for (const log of batchA.auditLogs) {
    lines.push(formatAuditLine(log))
  }
  lines.push('')
  lines.push('--- 批次B审计日志 ---')
  for (const log of batchB.auditLogs) {
    lines.push(formatAuditLine(log))
  }

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `小提琴琴弦张力复核_对比_${batchA.name.replace(/\s+/g, '_')}_vs_${batchB.name.replace(/\s+/g, '_')}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatAuditLine(log: AuditLog): string {
  return `[${formatTime(log.timestamp)}] ${log.action} | 操作人: ${log.actor} | 阈值版本: ${log.thresholdVersion} | 来源: ${log.source} | 原因: ${log.reason}`
}

function getPrimaryMeasurements(batch: Batch) {
  const rec = batch.parameterRecords.find((r) => r.source === '实验表')
    ?? batch.parameterRecords.find((r) => r.measurements.length > 0)
  return rec?.measurements ?? []
}
