#!/usr/bin/env node

import { createReconciliation, performMatching, performValidation, listReconciliations } from '../src/reconciliation.js'
import { initDB } from '../src/db.js'
import { printSuccess, printInfo, printReconList } from '../src/cli-utils.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function loadJSON(filename) {
  const content = fs.readFileSync(path.join(__dirname, filename), 'utf-8')
  return JSON.parse(content)
}

async function clearOldData(db) {
  db.data.reconciliations = []
  db.data.statusChanges = []
  db.data.reminders = []
  db.data.manualNotes = []
  await db.write()
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║      灰度配置对账 - 真实业务样例演示                  ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const db = await initDB()
  console.log('ℹ 清理历史数据...')
  await clearOldData(db)
  console.log('✓ 历史数据已清理\n')

  printInfo('步骤1: 创建对账任务 - 过期版本冻结通知')
  const sourceData = await loadJSON('sample-source.json')
  const recon = await createReconciliation(
    sourceData.source,
    sourceData.batchNo,
    sourceData.configType,
    sourceData.items
  )
  printSuccess(`创建成功，对账ID: ${recon.id}`)
  console.log(`批次号: ${recon.batchNo}`)
  console.log(`配置类型: ${recon.configType}\n`)

  printInfo('步骤2: 执行回执匹配（含回执晚到的脏数据）')
  const receipts = await loadJSON('sample-receipts.json')
  await performMatching(recon.id, receipts)
  printSuccess('匹配完成')
  console.log('  - V2.4.1-OPS-002: 回执晚到1天（截止5/10，回执5/11）')
  console.log('  - V2.4.1-SEC-005: 回执晚到1天（截止5/09，回执5/10）')
  console.log('  - V2.4.1-FIN-004: 缺失回执\n')

  printInfo('步骤3: 执行校验（部分成功场景）')
  const validation = await loadJSON('sample-validation.json')
  await performValidation(recon.id, validation)
  printSuccess('校验完成')
  console.log('  - 成功: 3项')
  console.log('  - 失败: 1项（产品研发部 - 回执单格式错误）')
  console.log('  - 状态: partial_success（部分成功）\n')

  printInfo('样例数据已准备完成！')
  console.log('\n接下来可以运行以下命令继续体验：')
  console.log('  node src/index.js list                    - 查看对账列表')
  console.log(`  node src/index.js detail ${recon.id}    - 查看对账详情`)
  console.log(`  node src/index.js review ${recon.id}    - 复盘对账任务`)
  console.log('  node src/index.js correct <reconId> <itemId> -s success -o 张经理 -r "线下补签完成"  - 人工修正')
  console.log('\n提示：请先运行 list 命令获取对账ID和明细ID')

  console.log('\n当前对账列表：')
  const list = await listReconciliations()
  printReconList(list)

  console.log('\n您可以重启程序后再次运行 list 命令，验证数据持久化功能！')
}

main().catch(console.error)
