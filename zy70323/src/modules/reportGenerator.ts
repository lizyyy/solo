import { CalculationResult, RecomputeDiff } from '../types'

export class ReportGenerator {
  generateTextReport(result: CalculationResult): string {
    const lines: string[] = []

    lines.push('='.repeat(80))
    lines.push('API 调用成本分摊报告')
    lines.push('='.repeat(80))
    lines.push('')

    lines.push('【计算上下文】')
    lines.push(`  周期: ${result.context.periodStart} ~ ${result.context.periodEnd}`)
    lines.push(`  原始日志数: ${result.context.totalRawLogs}`)
    lines.push(`  去重后日志数: ${result.context.deduplicatedLogs}`)
    lines.push(`  总调用次数: ${result.context.totalCalls}`)
    lines.push('')

    lines.push('【费用汇总】')
    lines.push(`  总费用: ¥${this.formatMoney(result.summary.totalCost)}`)
    lines.push(`  已结算: ¥${this.formatMoney(result.summary.settledCost)} (${result.summary.settlementRate}%)`)
    lines.push(`  未结算: ¥${this.formatMoney(result.summary.unsettledCost)}`)
    lines.push('')

    if (result.issues.length > 0) {
      lines.push('【问题汇总】')
      for (const issue of result.issues) {
        const severityMap: Record<string, string> = { error: '错误', warning: '警告', info: '信息' }
        lines.push(`  [${severityMap[issue.severity]}] ${issue.message}`)
        if (issue.affectedCount) {
          lines.push(`    影响数量: ${issue.affectedCount}`)
        }
      }
      lines.push('')
    }

    lines.push('【团队账单明细】')
    lines.push('-'.repeat(80))
    for (const bill of result.teamBills) {
      const statusMap: Record<string, string> = {
        settled: '已结算',
        partially_settled: '部分结算',
        unsettled: '未结算'
      }
      lines.push('')
      lines.push(`  团队: ${bill.teamName} (${bill.teamId})`)
      lines.push(`  业务线: ${bill.businessLine}`)
      lines.push(`  总金额: ¥${this.formatMoney(bill.totalAmount)}`)
      lines.push(`    - 直接成本: ¥${this.formatMoney(bill.directCost)}`)
      lines.push(`    - 共享成本: ¥${this.formatMoney(bill.sharedPoolCost)}`)
      lines.push(`    - 人工调整: ¥${this.formatMoney(bill.manualAdjustment)}`)
      lines.push(`    - 未结算: ¥${this.formatMoney(bill.unsettledAmount)}`)
      lines.push(`  计费条目数: ${bill.chargeCount}`)
      lines.push(`  结算状态: ${statusMap[bill.settlementStatus]}`)
    }
    lines.push('')

    lines.push('【业务线汇总】')
    lines.push('-'.repeat(80))
    for (const bl of result.businessLineSummaries) {
      lines.push('')
      lines.push(`  业务线: ${bl.businessLine}`)
      lines.push(`  包含团队: ${bl.teams.join(', ')}`)
      lines.push(`  总费用: ¥${this.formatMoney(bl.totalCost)}`)
      lines.push(`    - 直接成本: ¥${this.formatMoney(bl.directCost)}`)
      lines.push(`    - 共享成本: ¥${this.formatMoney(bl.sharedPoolCost)}`)
    }
    lines.push('')

    lines.push('【接口成本汇总】')
    lines.push('-'.repeat(80))
    for (const api of result.apiSummaries) {
      lines.push('')
      lines.push(`  接口: ${api.apiName}`)
      lines.push(`  调用次数: ${api.totalCalls}`)
      lines.push(`  使用的 AppId: ${api.uniqueAppIds.join(', ')}`)
      lines.push(`  总费用: ¥${this.formatMoney(api.totalCost)}`)
      lines.push(`    - 已结算: ¥${this.formatMoney(api.settledCost)}`)
      lines.push(`    - 未结算: ¥${this.formatMoney(api.unsettledCost)}`)
      lines.push(`  适用成本规则版本: ${api.costRuleVersions.join(', ')}`)
    }
    lines.push('')

    if (result.sharedPoolBreakdowns.length > 0) {
      lines.push('【公共池分摊说明】')
      lines.push('-'.repeat(80))
      for (const pool of result.sharedPoolBreakdowns) {
        lines.push('')
        lines.push(`  共享池: ${pool.poolName} (${pool.poolId})`)
        lines.push(`  池总费用: ¥${this.formatMoney(pool.totalCost)}`)
        lines.push(`  分摊说明: ${pool.explanation}`)
        lines.push('  分摊明细:')
        for (const alloc of pool.allocations) {
          lines.push(`    - ${alloc.teamName}: ¥${this.formatMoney(alloc.amount)} (${Math.round(alloc.ratio * 100)}%)`)
        }
      }
      lines.push('')
    }

    if (result.unsettledItems.length > 0) {
      lines.push('【未结算费用明细】')
      lines.push('-'.repeat(80))
      lines.push('')
      for (const item of result.unsettledItems) {
        lines.push(`  RequestId: ${item.requestId}`)
        lines.push(`    AppId: ${item.appId}`)
        lines.push(`    接口: ${item.apiName}`)
        lines.push(`    费用: ¥${this.formatMoney(item.cost)}`)
        lines.push(`    原因: ${item.reason}`)
        lines.push('')
      }
    }

    lines.push('='.repeat(80))
    return lines.join('\n')
  }

  generateDiffReport(diffs: RecomputeDiff[]): string {
    const lines: string[] = []

    lines.push('='.repeat(80))
    lines.push('重新计算差异报告')
    lines.push('='.repeat(80))
    lines.push('')

    for (const diff of diffs) {
      if (Math.abs(diff.difference) < 0.0001) continue

      lines.push(`  团队: ${diff.teamName} (${diff.teamId})`)
      lines.push(`    前次金额: ¥${this.formatMoney(diff.previousAmount)}`)
      lines.push(`    当前金额: ¥${this.formatMoney(diff.currentAmount)}`)
      lines.push(`    差异: ${diff.difference >= 0 ? '+' : ''}¥${this.formatMoney(diff.difference)}`)
      lines.push('    变更原因:')
      for (const reason of diff.changeReasons) {
        lines.push(`      - ${reason}`)
      }
      lines.push('')
    }

    lines.push('='.repeat(80))
    return lines.join('\n')
  }

  generateJsonReport(result: CalculationResult): string {
    return JSON.stringify(result, null, 2)
  }

  generatePreflightReport(preflight: {
    issues: Array<{ type: string; severity: string; message: string; affectedCount?: number }>
    mappingGaps: Array<{ appId: string; callCount: number; lastSeen: string }>
    unknownApis: Array<{ apiName: string; callCount: number }>
    ratioIssues: Array<{ poolId: string; poolName: string; totalRatio: number; teams: string[] }>
    expiredAdjustments: Array<{ id: string; reason: string; effectiveTo: string | null }>
    canProceed: boolean
  }): string {
    const lines: string[] = []

    lines.push('='.repeat(80))
    lines.push('预检检查报告')
    lines.push('='.repeat(80))
    lines.push('')

    lines.push(`可继续执行: ${preflight.canProceed ? '是' : '否'}`)
    lines.push('')

    if (preflight.issues.length > 0) {
      lines.push('【检查问题】')
      const severityMap: Record<string, string> = { error: '错误', warning: '警告', info: '信息' }
      for (const issue of preflight.issues) {
        lines.push(`  [${severityMap[issue.severity]}] ${issue.message}`)
      }
      lines.push('')
    }

    if (preflight.mappingGaps.length > 0) {
      lines.push('【映射缺口 (未知 AppId)】')
      for (const gap of preflight.mappingGaps) {
        lines.push(`  AppId: ${gap.appId}`)
        lines.push(`    调用次数: ${gap.callCount}`)
        lines.push(`    最后出现: ${gap.lastSeen}`)
      }
      lines.push('')
    }

    if (preflight.unknownApis.length > 0) {
      lines.push('【未知接口 (无成本规则)】')
      for (const api of preflight.unknownApis) {
        lines.push(`  接口: ${api.apiName}`)
        lines.push(`    调用次数: ${api.callCount}`)
      }
      lines.push('')
    }

    if (preflight.ratioIssues.length > 0) {
      lines.push('【共享池比例问题】')
      for (const issue of preflight.ratioIssues) {
        lines.push(`  共享池: ${issue.poolName}`)
        lines.push(`    比例合计: ${Math.round(issue.totalRatio * 100)}%`)
        lines.push(`    涉及团队: ${issue.teams.join(', ')}`)
      }
      lines.push('')
    }

    if (preflight.expiredAdjustments.length > 0) {
      lines.push('【过期的人工归属】')
      for (const adj of preflight.expiredAdjustments) {
        lines.push(`  ID: ${adj.id}`)
        lines.push(`    原因: ${adj.reason}`)
        lines.push(`    到期时间: ${adj.effectiveTo}`)
      }
      lines.push('')
    }

    lines.push('='.repeat(80))
    return lines.join('\n')
  }

  private formatMoney(amount: number): string {
    return amount.toFixed(4)
  }
}
