import type { CheckResult, CheckReport } from './types.js'

export function generateReport(results: CheckResult[]): CheckReport {
  const normal = results.filter((r) => r.status === 'normal').length
  const pendingConfirmation = results.filter(
    (r) => r.status === 'pending_confirmation'
  ).length
  const anomaly = results.filter((r) => r.status === 'anomaly').length

  const overallNextSteps = deduplicateNextSteps(results)

  return {
    summary: {
      total: results.length,
      normal,
      pendingConfirmation,
      anomaly,
    },
    results,
    overallNextSteps,
  }
}

export function formatReportForManager(report: CheckReport): string {
  const lines: string[] = []

  lines.push('═══════════════════════════════════════')
  lines.push('        弦乐分谱检查 · 排练小结')
  lines.push('═══════════════════════════════════════')
  lines.push('')
  lines.push(`总计 ${report.summary.total} 条记录：`)
  lines.push(`  ✅ 正常：${report.summary.normal} 条`)
  lines.push(`  ⚠️  待确认：${report.summary.pendingConfirmation} 条`)
  lines.push(`  ❌ 异常：${report.summary.anomaly} 条`)
  lines.push('')

  if (report.summary.pendingConfirmation > 0) {
    lines.push('───────────────────────────────────────')
    lines.push('⚠️  以下记录需要您确认（附原因与建议）：')
    lines.push('───────────────────────────────────────')

    const pendingResults = report.results.filter(
      (r) => r.status === 'pending_confirmation'
    )

    for (const result of pendingResults) {
      lines.push('')
      lines.push(`📌 记录编号：${result.recordId}`)

      if (result.versionDiff) {
        lines.push('  📝 版本变更提醒：')
        lines.push(`    ${result.versionDiff.summary}`)
        if (result.versionDiff.changedFields.length > 0) {
          lines.push(
            `    变更字段：${result.versionDiff.changedFields.join('、')}`
          )
        }
        if (result.versionDiff.noteAboutOldVersion) {
          lines.push(
            '    ⚠️ 此为补传旧版本，前一次判断不会被覆盖，请确认以哪个版本为准。'
          )
        }
      }

      lines.push('  🔍 判断原因：')
      for (const reason of result.reasons) {
        lines.push(`    • ${reason}`)
      }

      if (result.anomalies.length > 0) {
        lines.push('  🎵 异常详情：')
        for (const anomaly of result.anomalies) {
          const typeLabel = anomalyTypeLabel(anomaly.type)
          lines.push(`    [${typeLabel}] ${anomaly.description}`)
        }
      }

      lines.push('  👉 下一步：')
      for (const step of result.nextSteps) {
        lines.push(`    → ${step}`)
      }
    }
  }

  if (report.summary.normal > 0) {
    lines.push('')
    lines.push('───────────────────────────────────────')
    lines.push('✅ 以下记录检查通过，无需额外操作：')
    lines.push('───────────────────────────────────────')

    const normalResults = report.results.filter(
      (r) => r.status === 'normal'
    )
    const normalIds = normalResults.map((r) => r.recordId).join('、')
    lines.push(`  ${normalIds}`)
  }

  if (report.overallNextSteps.length > 0) {
    lines.push('')
    lines.push('───────────────────────────────────────')
    lines.push('📋 总体待办事项：')
    lines.push('───────────────────────────────────────')
    for (let i = 0; i < report.overallNextSteps.length; i++) {
      lines.push(`  ${i + 1}. ${report.overallNextSteps[i]}`)
    }
  }

  lines.push('')
  lines.push('═══════════════════════════════════════')
  lines.push('  如有疑问，请联系音乐老师核实详情。')
  lines.push('═══════════════════════════════════════')

  return lines.join('\n')
}

function anomalyTypeLabel(type: string): string {
  switch (type) {
    case 'measure_misalignment':
      return '小节错位'
    case 'transposition_desync':
      return '转调未同步'
    case 'duplicate_student':
      return '重复统计'
    default:
      return type
  }
}

function deduplicateNextSteps(results: CheckResult[]): string[] {
  const allSteps = results.flatMap((r) => r.nextSteps)
  const seen = new Set<string>()
  const unique: string[] = []

  for (const step of allSteps) {
    if (!seen.has(step)) {
      seen.add(step)
      unique.push(step)
    }
  }

  return unique
}
