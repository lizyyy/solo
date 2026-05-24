'use strict'

const chalk = require('chalk')
const Table = require('cli-table3')

const { RISK_LEVELS } = require('../config/constants')

function printTerminalSummary (result, options = {}) {
  const { verbose = false, showAll = false } = options

  console.log()
  printHeader()
  printAppInfo(result)
  console.log()
  printSummary(result)
  console.log()

  if (result.risk && result.risk.overall) {
    printRiskSummary(result.risk)
    console.log()
  }

  if (result.permissions && result.permissions.added.length > 0) {
    printPermissionsTable('新增权限', result.permissions.added, 'green')
    console.log()
  }

  if (result.permissions && result.permissions.removed.length > 0) {
    printPermissionsTable('移除权限', result.permissions.removed, 'red')
    console.log()
  }

  if (result.permissions && result.permissions.changed.length > 0) {
    printChangedPermissionsTable(result.permissions.changed)
    console.log()
  }

  if (result.features && result.features.added.length > 0) {
    printFeaturesTable('新增特性', result.features.added, 'green')
    console.log()
  }

  if (result.features && result.features.removed.length > 0) {
    printFeaturesTable('移除特性', result.features.removed, 'red')
    console.log()
  }

  if (result.sources && result.sources.summary) {
    printSourcesSummary(result.sources)
    console.log()
  }

  if (result.obfuscated && result.obfuscated.hasObfuscated) {
    printObfuscatedWarning(result.obfuscated)
    console.log()
  }

  if (result.risk && result.risk.recommendations && result.risk.recommendations.length > 0) {
    printRecommendations(result.risk.recommendations)
    console.log()
  }

  if (verbose && showAll && result.permissions && result.permissions.unchanged.length > 0) {
    printPermissionsTable('未变更权限', result.permissions.unchanged, 'gray')
    console.log()
  }

  printExitCodeInfo(result)
  console.log()
}

function printHeader () {
  console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════'))
  console.log(chalk.bold.cyan('           Android 权限差异分析报告'))
  console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════'))
}

function printAppInfo (result) {
  const { oldVersion, newVersion } = result

  if (oldVersion && newVersion) {
    console.log()
    console.log(chalk.bold('应用对比信息:'))
    console.log(`  ${chalk.gray('旧版本:')} ${oldVersion.appInfo.packageName || 'N/A'} (${oldVersion.appInfo.versionName || 'N/A'})`)
    console.log(`  ${chalk.gray('新版本:')} ${newVersion.appInfo.packageName || 'N/A'} (${newVersion.appInfo.versionName || 'N/A'})`)
  }
}

function printSummary (result) {
  const summary = result.permissions ? result.permissions.summary : { addedCount: 0, removedCount: 0, changedCount: 0 }

  console.log(chalk.bold('权限变更摘要:'))
  console.log(`  ${chalk.green('✓ 新增:')} ${summary.addedCount} 个`)
  console.log(`  ${chalk.red('✗ 移除:')} ${summary.removedCount} 个`)
  console.log(`  ${chalk.yellow('△ 变更:')} ${summary.changedCount} 个`)
  console.log(`  ${chalk.gray('○ 不变:')} ${summary.unchangedCount || 0} 个`)
}

function printRiskSummary (risk) {
  console.log(chalk.bold('风险评估:'))

  if (risk.overall.hasHighRiskChanges) {
    console.log(`  ${chalk.red('⚠ 检测到高风险权限变更!')}`)
  }

  if (risk.overall.highestAddedRisk) {
    const highest = risk.overall.highestAddedRisk
    const colorFn = getRiskColor(highest.key)
    console.log(`  ${chalk.gray('最高新增风险:')} ${colorFn(highest.name)} - ${highest.description}`)
  }

  console.log(`  ${chalk.red('严重:')} +${risk.critical.addedCount}/-${risk.critical.removedCount}`)
  console.log(`  ${chalk.magenta('高:')} +${risk.high.addedCount}/-${risk.high.removedCount}`)
  console.log(`  ${chalk.yellow('中:')} +${risk.medium.addedCount}/-${risk.medium.removedCount}`)
  console.log(`  ${chalk.blue('低:')} +${risk.low.addedCount}/-${risk.low.removedCount}`)
}

function printPermissionsTable (title, permissions, color) {
  console.log(chalk.bold[color](`${title} (${permissions.length}):`))

  const table = new Table({
    head: ['权限', '风险等级', '权限组', '来源'],
    colWidths: [50, 10, 12, 20],
    style: { head: ['cyan'], compact: true }
  })

  for (const item of permissions) {
    const permName = item.permission ? item.permission.name : item.name
    const risk = item.risk || { name: '未知', key: 'UNKNOWN' }
    const riskColor = getRiskColor(risk.key)
    const groupName = item.group ? item.group.name : '-'
    const sources = item.sources && item.sources.length > 0
      ? item.sources.slice(0, 2).map(s => s.name).join(', ')
      : (item.sourceType || '未知')

    table.push([
      chalk.gray(permName),
      riskColor(risk.name),
      groupName,
      sources
    ])
  }

  console.log(table.toString())
}

function printChangedPermissionsTable (changed) {
  console.log(chalk.bold.yellow(`变更权限 (${changed.length}):`))

  const table = new Table({
    head: ['权限', '变更字段', '旧值', '新值'],
    colWidths: [40, 15, 15, 15],
    style: { head: ['cyan'], compact: true }
  })

  for (const item of changed) {
    for (const change of item.changes) {
      table.push([
        chalk.gray(item.permission.name),
        change.field,
        String(change.oldValue || '-'),
        String(change.newValue || '-')
      ])
    }
  }

  console.log(table.toString())
}

function printFeaturesTable (title, features, color) {
  console.log(chalk.bold[color](`${title} (${features.length}):`))

  const table = new Table({
    head: ['特性', '必需', '隐含权限'],
    colWidths: [45, 8, 30],
    style: { head: ['cyan'], compact: true }
  })

  for (const item of features) {
    const featureName = item.feature ? item.feature.name : item.name
    const required = item.feature ? item.feature.required : item.required
    const implied = item.impliedPermissions || []

    table.push([
      chalk.gray(featureName),
      required ? chalk.green('是') : chalk.yellow('否'),
      implied.length > 0 ? implied.join(', ') : '-'
    ])
  }

  console.log(table.toString())
}

function printSourcesSummary (sources) {
  console.log(chalk.bold('权限来源分析:'))

  const summary = sources.summary || {}
  console.log(`  ${chalk.green('可溯源:')} ${summary.withSources || 0} 个`)
  console.log(`  ${chalk.red('未知来源:')} ${summary.withoutSources || 0} 个`)

  if (sources.injected && sources.injected.count > 0) {
    console.log(`  ${chalk.magenta('可能来自第三方库:')} ${sources.injected.likelyFromLibraries} 个`)
  }
}

function printObfuscatedWarning (obfuscated) {
  console.log(chalk.bold.red('⚠ 警告: 检测到可能混淆的权限名称!'))
  if (obfuscated.added.length > 0) {
    console.log(`  新增混淆权限: ${obfuscated.added.map(p => p.permission.name).join(', ')}`)
  }
  if (obfuscated.removed.length > 0) {
    console.log(`  移除混淆权限: ${obfuscated.removed.map(p => p.permission.name).join(', ')}`)
  }
}

function printRecommendations (recommendations) {
  console.log(chalk.bold('安全建议:'))

  for (const rec of recommendations) {
    const priorityColor = rec.priority === 'critical' ? chalk.red
      : rec.priority === 'high' ? chalk.magenta
        : rec.priority === 'medium' ? chalk.yellow
          : chalk.blue

    console.log()
    console.log(`  ${priorityColor('●')} ${priorityColor.bold(rec.title)}`)
    console.log(`    ${chalk.gray(rec.description)}`)
    if (rec.permissions && rec.permissions.length > 0) {
      console.log(`    ${chalk.gray('涉及权限:')} ${rec.permissions.slice(0, 5).join(', ')}${rec.permissions.length > 5 ? '...' : ''}`)
    }
  }
}

function printExitCodeInfo (result) {
  console.log(chalk.gray(`退出码: ${result.exitCode || 0}`))

  if (result.exitCode && result.exitCode >= 10) {
    console.log(chalk.yellow(`  (非零退出码表示存在需要关注的变更)`))
  }
}

function getRiskColor (riskKey) {
  const colorMap = {
    CRITICAL: chalk.red,
    HIGH: chalk.magenta,
    MEDIUM: chalk.yellow,
    LOW: chalk.blue,
    UNKNOWN: chalk.gray
  }
  return colorMap[riskKey] || chalk.gray
}

module.exports = {
  printTerminalSummary,
  printHeader,
  printAppInfo,
  printSummary,
  printRiskSummary,
  printPermissionsTable,
  printChangedPermissionsTable,
  printFeaturesTable,
  printSourcesSummary,
  printObfuscatedWarning,
  printRecommendations
}
