const fs = require('fs')
const path = require('path')
const { splitBalance } = require('./balance')

function exportAsJson(data, filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return filePath
}

function exportAsMarkdown(data, filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const content = renderMarkdown(data)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

function renderMarkdown(data) {
  const lines = []
  lines.push('# 跨店储值余额迁移报告')
  lines.push('')
  lines.push(`> 生成时间：${new Date().toISOString()}`)
  lines.push('')

  if (data.summary) {
    lines.push('## 概览')
    lines.push('')
    lines.push(`- 总会员数：${data.summary.totalMembers}`)
    lines.push(`- 赠金问题：${data.summary.bonusIssueCount} 条`)
    lines.push(`- 冻结问题：${data.summary.frozenIssueCount} 条`)
    lines.push(`- 重复导入：${data.summary.duplicateIssueCount} 条`)
    lines.push('')
  }

  if (data.bonusIssues && data.bonusIssues.length > 0) {
    lines.push('## ⚠️ 赠金当现金问题')
    lines.push('')
    lines.push('| 卡号 | 储值 | 赠金 | 说明 |')
    lines.push('|------|------|------|------|')
    for (const issue of data.bonusIssues) {
      lines.push(`| ${issue.card_id} | ${issue.stored_value} | ${issue.bonus} | ${issue.detail} |`)
    }
    lines.push('')
  }

  if (data.frozenIssues && data.frozenIssues.length > 0) {
    lines.push('## ❄️ 冻结余额校验问题')
    lines.push('')
    lines.push('| 卡号 | 卡面冻结 | 记录冻结 | 差额 | 说明 |')
    lines.push('|------|----------|----------|------|------|')
    for (const issue of data.frozenIssues) {
      lines.push(`| ${issue.card_id} | ${issue.declaredFrozen} | ${issue.actualFrozen} | ${issue.diff} | ${issue.detail} |`)
    }
    lines.push('')
  }

  if (data.duplicateIssues && data.duplicateIssues.length > 0) {
    lines.push('## 🔄 重复导入')
    lines.push('')
    lines.push('| 卡号 | 说明 |')
    lines.push('|------|------|')
    for (const issue of data.duplicateIssues) {
      lines.push(`| ${issue.card_id} | ${issue.detail} |`)
    }
    lines.push('')
  }

  if (data.migrations && data.migrations.length > 0) {
    lines.push('## 迁移明细')
    lines.push('')
    lines.push('| 迁移ID | 卡号 | 来源门店 | 目标门店 | 状态 | 储值(前→后) | 赠金(前→后) | 冻结(前→后) | 来源 |')
    lines.push('|--------|------|----------|----------|------|-------------|-------------|-------------|------|')
    for (const mig of data.migrations) {
      const beforeSplit = mig.before_snapshot?.split || {}
      const afterSplit = mig.after_snapshot?.split || {}
      lines.push(
        `| ${mig.migration_id} | ${mig.card_id} | ${mig.from_store} | ${mig.to_store} | ${mig.status} | ` +
        `${beforeSplit.stored_value ?? '-'}→${afterSplit.stored_value ?? '-'} | ` +
        `${beforeSplit.bonus ?? '-'}→${afterSplit.bonus ?? '-'} | ` +
        `${beforeSplit.frozen ?? '-'}→${afterSplit.frozen ?? '-'} | ${mig.source} |`
      )
    }
    lines.push('')
  }

  if (data.reconciliation) {
    lines.push('## 门店对账')
    lines.push('')
    for (const recon of data.reconciliation) {
      lines.push(`### 门店 ${recon.store_id}`)
      lines.push('')
      lines.push(`- 当前会员数：${recon.current_members}`)
      lines.push(`- 当前余额：储值 ${recon.current_balance.stored_value.toFixed(2)}，赠金 ${recon.current_balance.bonus.toFixed(2)}，冻结 ${recon.current_balance.frozen.toFixed(2)}`)
      lines.push(`- 迁入：${recon.migrated_in.count} 笔`)
      lines.push(`- 迁出：${recon.migrated_out.count} 笔`)
      lines.push(`- 撤回：${recon.rolled_back} 笔`)
      if (recon.hasAnomaly) {
        lines.push(`- **⚠️ 差异：${recon.anomalyDetail}**`)
      } else {
        lines.push('- ✅ 无差异')
      }
      lines.push('')
    }
  }

  if (data.timeline) {
    lines.push('## 时间轴')
    lines.push('')
    lines.push('| 时间 | 卡号 | 动作 | 详情 | 操作人 |')
    lines.push('|------|------|------|------|--------|')
    for (const evt of data.timeline) {
      lines.push(`| ${evt.created_at} | ${evt.card_id} | ${evt.action} | ${evt.detail} | ${evt.operator} |`)
    }
    lines.push('')
  }

  if (data.members) {
    lines.push('## 会员余额拆分明细')
    lines.push('')
    lines.push('| 卡号 | 姓名 | 门店 | 储值 | 赠金 | 冻结 | 合计 | 来源 |')
    lines.push('|------|------|------|------|------|------|------|------|')
    for (const m of data.members) {
      const sp = splitBalance(m)
      lines.push(`| ${m.card_id} | ${m.name} | ${m.store_id} | ${sp.stored_value} | ${sp.bonus} | ${sp.frozen} | ${sp.total} | ${m.source} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateReport(store, filters = {}) {
  const { filterMigrationRecords, filterMembers } = require('./filter')
  const { fullBalanceAudit } = require('./balance')
  const { fullReconciliation } = require('./reconcile')
  const { buildTimeline } = require('./timeline')

  const members = filterMembers(store, filters.memberFilters || {})
  const migrations = filterMigrationRecords(store, filters.migrationFilters || {})
  const freezeRecords = store.get('freezeRecords')
  const audit = fullBalanceAudit(members, freezeRecords)
  const reconciliation = fullReconciliation(store)

  let timeline = []
  if (filters.timelineFilters) {
    timeline = buildTimeline(store, filters.timelineFilters)
  }

  return {
    summary: audit.summary,
    bonusIssues: audit.bonusIssues,
    frozenIssues: audit.frozenIssues,
    duplicateIssues: audit.duplicateIssues,
    members,
    migrations,
    reconciliation,
    timeline,
    generatedAt: new Date().toISOString(),
    filters
  }
}

function exportReport(store, outputPath, format = 'json', filters = {}) {
  const report = generateReport(store, filters)
  const ext = format === 'markdown' ? 'md' : 'json'

  let finalPath = outputPath
  if (!finalPath.endsWith(`.${ext}`)) {
    finalPath = `${finalPath}.${ext}`
  }

  if (format === 'markdown') {
    exportAsMarkdown(report, finalPath)
  } else {
    exportAsJson(report, finalPath)
  }

  return { path: finalPath, report }
}

module.exports = {
  exportAsJson,
  exportAsMarkdown,
  renderMarkdown,
  generateReport,
  exportReport
}
