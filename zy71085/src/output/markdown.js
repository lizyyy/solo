'use strict'

const fs = require('fs').promises
const path = require('path')
const { EXIT_CODES, RISK_LEVELS } = require('../config/constants')

class MarkdownOutputError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'MarkdownOutputError'
    this.code = code || EXIT_CODES.ERROR_OUTPUT_FAILED
  }
}

async function writeMarkdownReport (result, outputDir, fileName = 'permission-diff.md') {
  try {
    await fs.mkdir(outputDir, { recursive: true })

    const markdown = buildMarkdownReport(result)
    const filePath = path.join(outputDir, fileName)

    await fs.writeFile(filePath, markdown, 'utf-8')

    return {
      path: filePath,
      fileName,
      size: Buffer.byteLength(markdown, 'utf-8')
    }
  } catch (err) {
    throw new MarkdownOutputError(`写入 Markdown 报告失败: ${err.message}`)
  }
}

function buildMarkdownReport (result) {
  const lines = []

  lines.push('# Android 权限差异分析报告')
  lines.push('')
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`)
  lines.push(`> 工具版本: ${require('../../package.json').version}`)
  lines.push('')

  lines.push('## 📱 应用信息')
  lines.push('')
  lines.push('| 版本 | 包名 | 版本号 | 来源 |')
  lines.push('|------|------|--------|------|')
  if (result.oldVersion) {
    lines.push(`| 旧版 | ${result.oldVersion.appInfo.packageName || '-'} | ${result.oldVersion.appInfo.versionName || '-'} | ${result.oldVersion.fileName || '-'} |`)
  }
  if (result.newVersion) {
    lines.push(`| 新版 | ${result.newVersion.appInfo.packageName || '-'} | ${result.newVersion.appInfo.versionName || '-'} | ${result.newVersion.fileName || '-'} |`)
  }
  lines.push('')

  lines.push('## 📊 变更摘要')
  lines.push('')
  if (result.permissions && result.permissions.summary) {
    const s = result.permissions.summary
    lines.push(`- **新增权限**: ${s.addedCount} 个`)
    lines.push(`- **移除权限**: ${s.removedCount} 个`)
    lines.push(`- **变更权限**: ${s.changedCount} 个`)
    lines.push(`- **未变更权限**: ${s.unchangedCount || 0} 个`)
  }
  lines.push('')

  if (result.risk) {
    lines.push('## ⚠️ 风险评估')
    lines.push('')

    if (result.risk.overall) {
      if (result.risk.overall.hasHighRiskChanges) {
        lines.push('> ❗ **警告**: 检测到高风险权限变更，需要重点关注!')
        lines.push('')
      }
      if (result.risk.overall.highestAddedRisk) {
        const r = result.risk.overall.highestAddedRisk
        lines.push(`> 最高新增风险等级: **${r.name}** - ${r.description}`)
        lines.push('')
      }
    }

    lines.push('| 风险等级 | 新增 | 移除 | 说明 |')
    lines.push('|----------|------|------|------|')
    lines.push(`| 🔴 严重 | ${result.risk.critical.addedCount} | ${result.risk.critical.removedCount} | 涉及隐私或安全的高危权限 |`)
    lines.push(`| 🟣 高 | ${result.risk.high.addedCount} | ${result.risk.high.removedCount} | 敏感权限，需要用户授权 |`)
    lines.push(`| 🟡 中 | ${result.risk.medium.addedCount} | ${result.risk.medium.removedCount} | 普通权限，存在一定风险 |`)
    lines.push(`| 🔵 低 | ${result.risk.low.addedCount} | ${result.risk.low.removedCount} | 正常权限，基本无风险 |`)
    lines.push(`| ⚪ 未知 | ${result.risk.unknown.addedCount} | ${result.risk.unknown.removedCount} | 未知权限，需要人工评估 |`)
    lines.push('')
  }

  if (result.permissions && result.permissions.added.length > 0) {
    lines.push('## ➕ 新增权限详情')
    lines.push('')
    lines.push('| 权限名称 | 风险等级 | 权限组 | 来源 | 置信度 | 说明 |')
    lines.push('|----------|----------|--------|------|--------|------|')

    const sortedAdded = [...result.permissions.added].sort((a, b) =>
      (a.risk?.level || 4) - (b.risk?.level || 4)
    )

    for (const item of sortedAdded) {
      const risk = item.risk || { name: '未知', key: 'UNKNOWN', description: '' }
      const riskBadge = getRiskBadge(risk.key)
      const groupName = item.group ? item.group.name : '-'
      const sources = item.sources && item.sources.length > 0
        ? item.sources.slice(0, 2).map(s => s.name).join(', ')
        : (item.sourceType === 'unknown' ? '未知' : item.sourceType)
      const confidence = item.confidence != null ? `${Math.round(item.confidence * 100)}%` : '-'

      lines.push(`| ${item.permission.name} | ${riskBadge} ${risk.name} | ${groupName} | ${sources} | ${confidence} | ${risk.description} |`)
    }
    lines.push('')
  }

  if (result.permissions && result.permissions.removed.length > 0) {
    lines.push('## ➖ 移除权限详情')
    lines.push('')
    lines.push('| 权限名称 | 风险等级 | 权限组 | 说明 |')
    lines.push('|----------|----------|--------|------|')

    for (const item of result.permissions.removed) {
      const risk = item.risk || { name: '未知', key: 'UNKNOWN', description: '' }
      const riskBadge = getRiskBadge(risk.key)
      const groupName = item.group ? item.group.name : '-'

      lines.push(`| ${item.permission.name} | ${riskBadge} ${risk.name} | ${groupName} | ${risk.description} |`)
    }
    lines.push('')
  }

  if (result.permissions && result.permissions.changed.length > 0) {
    lines.push('## 🔄 变更权限详情')
    lines.push('')

    for (const item of result.permissions.changed) {
      lines.push(`### ${item.permission.name}`)
      lines.push('')
      lines.push('| 字段 | 旧值 | 新值 |')
      lines.push('|------|------|------|')

      for (const change of item.changes) {
        lines.push(`| ${change.field} | ${change.oldValue || '-'} | ${change.newValue || '-'} |`)
      }
      lines.push('')
    }
  }

  if (result.features) {
    if (result.features.added.length > 0 || result.features.removed.length > 0) {
      lines.push('## 🎯 特性变更')
      lines.push('')

      if (result.features.added.length > 0) {
        lines.push('### 新增特性')
        lines.push('')
        lines.push('| 特性名称 | 必需 | 隐含权限 |')
        lines.push('|----------|------|----------|')

        for (const item of result.features.added) {
          const feat = item.feature || item
          const required = feat.required !== false ? '是' : '否'
          const implied = item.impliedPermissions && item.impliedPermissions.length > 0
            ? item.impliedPermissions.join(', ')
            : '-'

          lines.push(`| ${feat.name} | ${required} | ${implied} |`)
        }
        lines.push('')
      }

      if (result.features.removed.length > 0) {
        lines.push('### 移除特性')
        lines.push('')
        lines.push('| 特性名称 | 必需 | 隐含权限 |')
        lines.push('|----------|------|----------|')

        for (const item of result.features.removed) {
          const feat = item.feature || item
          const required = feat.required !== false ? '是' : '否'
          const implied = item.impliedPermissions && item.impliedPermissions.length > 0
            ? item.impliedPermissions.join(', ')
            : '-'

          lines.push(`| ${feat.name} | ${required} | ${implied} |`)
        }
        lines.push('')
      }
    }
  }

  if (result.groups && result.groups.groups && result.groups.groups.length > 0) {
    lines.push('## 👥 权限组变更')
    lines.push('')
    lines.push('| 权限组 | 旧数量 | 新数量 | 新增 | 移除 |')
    lines.push('|--------|--------|--------|------|------|')

    for (const group of result.groups.groups) {
      lines.push(`| ${group.groupName} | ${group.totalOld} | ${group.totalNew} | ${group.added.length} | ${group.removed.length} |`)
    }
    lines.push('')
  }

  if (result.sources && result.sources.injected && result.sources.injected.count > 0) {
    lines.push('## 🔍 权限来源分析')
    lines.push('')

    if (result.sources.summary) {
      lines.push(`- **可溯源权限**: ${result.sources.summary.withSources || 0} 个`)
      lines.push(`- **未知来源权限**: ${result.sources.summary.withoutSources || 0} 个`)
      lines.push(`- **可能来自第三方库**: ${result.sources.injected.likelyFromLibraries} 个`)
      lines.push('')
    }

    if (result.sources.injected.injected.length > 0) {
      lines.push('### 可能由第三方库注入的权限')
      lines.push('')
      lines.push('| 权限名称 | 可能来自库 |')
      lines.push('|----------|------------|')

      for (const item of result.sources.injected.injected) {
        lines.push(`| ${item.permission} | ${item.likelyFromLibrary ? '是' : '可能'} |`)
      }
      lines.push('')
    }
  }

  if (result.obfuscated && result.obfuscated.hasObfuscated) {
    lines.push('## ⚠️ 混淆检测')
    lines.push('')
    lines.push('> 检测到可能被混淆的权限名称，建议人工核实')
    lines.push('')

    if (result.obfuscated.added.length > 0) {
      lines.push('### 新增混淆权限')
      lines.push('')
      for (const item of result.obfuscated.added) {
        const name = item.permission ? item.permission.name : item.name
        lines.push(`- ${name}`)
      }
      lines.push('')
    }

    if (result.obfuscated.removed.length > 0) {
      lines.push('### 移除混淆权限')
      lines.push('')
      for (const item of result.obfuscated.removed) {
        const name = item.permission ? item.permission.name : item.name
        lines.push(`- ${name}`)
      }
      lines.push('')
    }
  }

  if (result.risk && result.risk.recommendations && result.risk.recommendations.length > 0) {
    lines.push('## 💡 安全建议')
    lines.push('')

    for (const rec of result.risk.recommendations) {
      const priorityEmoji = rec.priority === 'critical' ? '🔴'
        : rec.priority === 'high' ? '🟣'
          : rec.priority === 'medium' ? '🟡'
            : '🔵'

      lines.push(`### ${priorityEmoji} ${rec.title}`)
      lines.push('')
      lines.push(rec.description)
      lines.push('')

      if (rec.permissions && rec.permissions.length > 0) {
        lines.push('**涉及权限:**')
        lines.push('')
        for (const perm of rec.permissions) {
          lines.push(`- ${perm}`)
        }
        lines.push('')
      }
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(`*退出码: ${result.exitCode || 0}*`)
  if (result.exitCode && result.exitCode >= 10) {
    lines.push('')
    lines.push('> 非零退出码表示存在需要关注的变更')
  }

  return lines.join('\n')
}

function getRiskBadge (riskKey) {
  const badgeMap = {
    CRITICAL: '🔴',
    HIGH: '🟣',
    MEDIUM: '🟡',
    LOW: '🔵',
    UNKNOWN: '⚪'
  }
  return badgeMap[riskKey] || '⚪'
}

module.exports = {
  writeMarkdownReport,
  buildMarkdownReport,
  MarkdownOutputError
}
