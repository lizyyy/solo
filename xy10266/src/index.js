#!/usr/bin/env node

import { storage } from './storage.js'
import { ruleEngine } from './rules.js'
import { importer } from './importer.js'
import { exporter } from './exporter.js'
import { sampleData } from './sample-data.js'
import { HOSE_STATUS, HOSE_STATUS_DESC } from './models.js'

const args = process.argv.slice(2)

const commands = {
  init: '初始化示例数据',
  import: '导入数据文件',
  check: '执行归仓检查',
  status: '查看当前状态',
  history: '查看操作历史',
  problems: '查看问题列表',
  export: '导出数据',
  help: '显示帮助信息',
  borrow: '借出水带',
  return: '归还水带',
  'start-drying': '开始晾晒',
  'complete-drying': '完成晾晒',
  store: '归仓水带'
}

function printHelp() {
  console.log(`
消防水带晾晒归仓 CLI
====================

用法: firehose <命令> [选项]

可用命令:

  init                          初始化示例数据

  import <类型> <文件路径>       导入数据
    类型: hoses | borrow | drying

  check                         执行全量归仓检查

  status                        查看水带状态概览
    --status <状态>             按状态筛选 (wet|drying|dry|storage)

  history [--limit N]           查看操作历史

  problems                      查看问题列表

  export <类型> <输出路径>       导出数据
    类型: hoses | borrow | drying | problems | history | check | all

  borrow <水带编号> [--purpose 目的] [--borrower 借用人]

  return <水带编号>

  start-drying <水带编号>

  complete-drying <水带编号>

  store <水带编号>               尝试归仓，会执行状态检查

示例:
  firehose init
  firehose check
  firehose status
  firehose history --limit 10
  firehose export check ./report.json
`)
}

function formatDate(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN')
}

async function executeCommand() {
  const command = args[0]

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    printHelp()
    return
  }

  await storage.ensureInit()

  switch (command) {
    case 'init':
      await initCommand()
      break

    case 'import':
      await importCommand()
      break

    case 'check':
      await checkCommand()
      break

    case 'status':
      await statusCommand()
      break

    case 'history':
      await historyCommand()
      break

    case 'problems':
      await problemsCommand()
      break

    case 'export':
      await exportCommand()
      break

    case 'borrow':
      await borrowCommand()
      break

    case 'return':
      await returnHoseCommand()
      break

    case 'start-drying':
      await startDryingCommand()
      break

    case 'complete-drying':
      await completeDryingCommand()
      break

    case 'store':
      await storeCommand()
      break

    default:
      console.error(`未知命令: ${command}`)
      printHelp()
      process.exit(1)
  }
}

async function initCommand() {
  console.log('正在初始化示例数据...')
  const result = await sampleData.initialize()
  console.log(`
初始化完成:
  水带: ${result.hoses} 条
  借用记录: ${result.borrowRecords} 条
  晾晒记录: ${result.dryingRecords} 条

示例数据包含各种状态的水带，可用于测试归仓拦截逻辑。
`)
}

async function importCommand() {
  const type = args[1]
  const filePath = args[2]

  if (!type || !filePath) {
    console.error('用法: firehose import <类型> <文件路径>')
    console.error('类型: hoses | borrow | drying')
    process.exit(1)
  }

  let result
  console.log(`正在导入 ${type} 数据...`)

  switch (type) {
    case 'hoses':
      result = await importer.importHoses(filePath)
      break
    case 'borrow':
      result = await importer.importBorrowRecords(filePath)
      break
    case 'drying':
      result = await importer.importDryingRecords(filePath)
      break
    default:
      console.error(`未知导入类型: ${type}`)
      process.exit(1)
  }

  console.log(`
导入结果:
  成功导入: ${result.imported}
  跳过: ${result.skipped}
  发现问题: ${result.problems} (已记录到问题列表)
`)
}

async function checkCommand() {
  console.log('执行全量归仓检查...\n')
  
  const results = await ruleEngine.checkAllForStorage()
  
  const canStore = results.filter(r => r.canStore)
  const cannotStore = results.filter(r => !r.canStore)

  console.log(`检查完成，共检查 ${results.length} 条记录\n`)
  
  console.log(`可归仓 (${canStore.length} 条):`)
  if (canStore.length === 0) {
    console.log('  (无)')
  } else {
    for (const r of canStore) {
      console.log(`  ✓ ${r.hoseNumber} - 当前状态: ${HOSE_STATUS_DESC[r.currentStatus] || r.currentStatus}`)
    }
  }

  console.log(`\n被拦截 (${cannotStore.length} 条):`)
  if (cannotStore.length === 0) {
    console.log('  (无)')
  } else {
    for (const r of cannotStore) {
      console.log(`  ✗ ${r.hoseNumber} - ${HOSE_STATUS_DESC[r.currentStatus] || r.currentStatus}`)
      for (const reason of r.blockingReasons) {
        console.log(`      - ${reason}`)
      }
    }
  }
}

async function statusCommand() {
  const statusFilter = getArgValue(args, '--status')
  const hoses = await storage.getHoses()
  
  let filtered = hoses
  if (statusFilter) {
    filtered = hoses.filter(h => h.status === statusFilter)
  }

  const grouped = {}
  for (const status of Object.values(HOSE_STATUS)) {
    grouped[status] = hoses.filter(h => h.status === status).length
  }

  console.log('水带状态概览:')
  console.log('================')
  
  for (const [status, count] of Object.entries(grouped)) {
    const desc = HOSE_STATUS_DESC[status] || status
    console.log(`  ${desc}: ${count} 条`)
  }

  if (filtered.length > 0) {
    console.log(`\n明细 (${filtered.length} 条):`)
    for (const hose of filtered) {
      console.log(`\n  ${hose.number} - ${hose.name}`)
      console.log(`    状态: ${HOSE_STATUS_DESC[hose.status] || hose.status}`)
      console.log(`    位置: ${hose.location || '-'}`)
      if (hose.notes) console.log(`    备注: ${hose.notes}`)
    }
  } else if (!statusFilter) {
    console.log(`\n使用 --status <状态> 查看明细`)
  }
}

async function historyCommand() {
  const limit = parseInt(getArgValue(args, '--limit') || '50', 10)
  const history = await storage.getHistory()
  const sorted = [...history].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  ).slice(0, limit)

  console.log(`操作历史 (最近 ${sorted.length} 条):\n`)
  
  for (const record of sorted) {
    console.log(`[${formatDate(record.createdAt)}] ${record.operation}`)
    console.log(`  ${record.details}`)
    if (record.operator) console.log(`  操作人: ${record.operator}`)
    console.log()
  }
}

async function problemsCommand() {
  const problems = await storage.getProblems()
  
  console.log(`问题列表 (共 ${problems.length} 条):\n`)
  
  if (problems.length === 0) {
    console.log('  暂无问题记录')
    return
  }

  const sorted = [...problems].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  )

  for (const p of sorted) {
    const severityColor = p.severity === 'error' ? 'ERROR' : 
                         p.severity === 'warning' ? 'WARN' : 'INFO'
    console.log(`[${severityColor}] [${formatDate(p.createdAt)}] ${p.type}`)
    console.log(`  来源: ${p.source}`)
    console.log(`  ${p.message}`)
    console.log()
  }
}

async function exportCommand() {
  const type = args[1]
  const outputPath = args[2]

  if (!type || !outputPath) {
    console.error('用法: firehose export <类型> <输出路径>')
    console.error('类型: hoses | borrow | drying | problems | history | check | all')
    process.exit(1)
  }

  console.log(`正在导出 ${type} 数据...`)

  let result
  switch (type) {
    case 'hoses':
      result = await exporter.exportHoses(outputPath)
      break
    case 'borrow':
      result = await exporter.exportBorrowRecords(outputPath)
      break
    case 'drying':
      result = await exporter.exportDryingRecords(outputPath)
      break
    case 'problems':
      result = await exporter.exportProblems(outputPath)
      break
    case 'history':
      result = await exporter.exportHistory(outputPath)
      break
    case 'check':
      result = await exporter.exportCheckResults(outputPath)
      break
    case 'all':
      result = await exporter.exportAllData(outputPath)
      break
    default:
      console.error(`未知导出类型: ${type}`)
      process.exit(1)
  }

  console.log(`导出完成: ${outputPath}`)
  if (result.count !== undefined) {
    console.log(`记录数: ${result.count}`)
  }
}

async function findHoseByNumberArg(argIndex = 1) {
  const number = args[argIndex]
  if (!number) {
    console.error('请指定水带编号')
    process.exit(1)
  }
  
  const hoses = await storage.getHoses()
  const hose = hoses.find(h => h.number === number)
  
  if (!hose) {
    console.error(`未找到水带: ${number}`)
    process.exit(1)
  }
  
  return hose
}

function getArgValue(argList, key) {
  const index = argList.indexOf(key)
  if (index >= 0 && index < argList.length - 1) {
    return argList[index + 1]
  }
  return null
}

async function borrowCommand() {
  const hose = await findHoseByNumberArg(1)
  const purpose = getArgValue(args, '--purpose') || ''
  const borrower = getArgValue(args, '--borrower') || ''

  const result = await ruleEngine.borrowHose(hose.id, purpose, borrower)
  
  if (result.success) {
    console.log(`借出成功: ${hose.number}`)
    console.log(`新状态: ${HOSE_STATUS_DESC[result.hose.status]}`)
  } else {
    console.error(`借出失败: ${result.reason}`)
    process.exit(1)
  }
}

async function returnHoseCommand() {
  const hose = await findHoseByNumberArg(1)
  const result = await ruleEngine.returnHose(hose.id)
  
  if (result.success) {
    console.log(`归还成功: ${hose.number}`)
    console.log(`状态已更新为: ${HOSE_STATUS_DESC[HOSE_STATUS.WET]}`)
  } else {
    console.error(`归还失败: ${result.reason}`)
    process.exit(1)
  }
}

async function startDryingCommand() {
  const hose = await findHoseByNumberArg(1)
  const result = await ruleEngine.startDrying(hose.id)
  
  if (result.success) {
    console.log(`开始晾晒: ${hose.number}`)
    console.log(`新状态: ${HOSE_STATUS_DESC[result.hose.status]}`)
  } else {
    console.error(`操作失败: ${result.reason}`)
    process.exit(1)
  }
}

async function completeDryingCommand() {
  const hose = await findHoseByNumberArg(1)
  const result = await ruleEngine.completeDrying(hose.id)
  
  if (result.success) {
    console.log(`完成晾晒: ${hose.number}`)
    console.log(`新状态: ${HOSE_STATUS_DESC[result.hose.status]}`)
  } else {
    console.error(`操作失败: ${result.reason}`)
    process.exit(1)
  }
}

async function storeCommand() {
  const hose = await findHoseByNumberArg(1)
  const result = await ruleEngine.storeHose(hose.id)
  
  if (result.success) {
    console.log(`✓ ${result.message}`)
  } else {
    console.error(`✗ ${result.message}`)
    if (result.reason && Array.isArray(result.reason)) {
      console.error(`\n拦截原因:`)
      for (const r of result.reason) {
        console.error(`  - ${r}`)
      }
    }
    process.exit(1)
  }
}

executeCommand().catch(err => {
  console.error('执行错误:', err)
  process.exit(1)
})
