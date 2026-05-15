#!/usr/bin/env node

import { Command } from 'commander'
import { initDB } from './db.js'
import {
  createReconciliation,
  performMatching,
  performValidation,
  manualCorrect,
  getReconciliation,
  listReconciliations,
  getStatusChanges,
  getReminders,
  getManualNotes
} from './reconciliation.js'
import {
  printReconList,
  printReconDetail,
  printSuccess,
  printError,
  printInfo
} from './cli-utils.js'
import { ITEM_STATUS } from './constants.js'

const program = new Command()

program
  .name('recon')
  .description('灰度配置对账命令行工具')
  .version('1.0.0')

program.command('list')
  .description('列出所有对账任务')
  .option('-s, --status <status>', '按状态筛选')
  .action(async (options) => {
    try {
      await initDB()
      const recons = await listReconciliations(options)
      if (recons.length === 0) {
        printInfo('暂无对账记录')
        return
      }
      printReconList(recons)
    } catch (err) {
      printError(err.message)
    }
  })

program.command('detail <id>')
  .description('查看对账任务详情')
  .action(async (id) => {
    try {
      await initDB()
      const recon = await getReconciliation(id)
      if (!recon) {
        printError('对账记录不存在')
        return
      }
      const statusChanges = await getStatusChanges(id)
      const reminders = await getReminders(id)
      const manualNotes = await getManualNotes(id)
      printReconDetail(recon, statusChanges, reminders, manualNotes)
    } catch (err) {
      printError(err.message)
    }
  })

program.command('create')
  .description('创建对账任务（交互式）')
  .action(async () => {
    try {
      await initDB()
      printInfo('使用样例数据，请运行: node tests/run-samples.js')
      printInfo('或准备以下格式的JSON数据:')
      console.log(`
{
  "source": "灰度发布系统",
  "batchNo": "FREEZE-20240515-001",
  "configType": "版本冻结通知",
  "items": [
    {
      "itemRef": "V2.4.1-FR-001",
      "department": "风控合规部",
      "owner": "张明",
      "deadline": "2024-05-10 18:00:00",
      "amount": 50000,
      "description": "风控规则引擎版本冻结"
    }
  ]
}
      `)
    } catch (err) {
      printError(err.message)
    }
  })

program.command('match <reconId> <receiptFile>')
  .description('执行回执匹配')
  .action(async (reconId, receiptFile) => {
    try {
      await initDB()
      const receiptData = await import(`../${receiptFile}`, { assert: { type: 'json' } })
      const recon = await performMatching(reconId, receiptData.default)
      printSuccess(`匹配完成，当前状态: ${recon.status}`)
    } catch (err) {
      printError(err.message)
    }
  })

program.command('validate <reconId> <validationFile>')
  .description('执行校验')
  .action(async (reconId, validationFile) => {
    try {
      await initDB()
      const validationResults = await import(`../${validationFile}`, { assert: { type: 'json' } })
      const recon = await performValidation(reconId, validationResults.default)
      printSuccess(`校验完成，当前状态: ${recon.status}`)
    } catch (err) {
      printError(err.message)
    }
  })

program.command('correct <reconId> <itemId>')
  .description('人工修正明细状态')
  .requiredOption('-s, --status <status>', '新状态: success|manual_corrected')
  .requiredOption('-o, --operator <operator>', '操作人')
  .requiredOption('-r, --remark <remark>', '修正备注')
  .action(async (reconId, itemId, options) => {
    try {
      await initDB()
      const statusMap = {
        'success': ITEM_STATUS.SUCCESS,
        'manual_corrected': ITEM_STATUS.MANUAL_CORRECTED
      }
      const newStatus = statusMap[options.status]
      if (!newStatus) {
        printError('无效的状态值')
        return
      }
      await manualCorrect(reconId, itemId, newStatus, options.operator, options.remark)
      printSuccess('人工修正完成')
    } catch (err) {
      printError(err.message)
    }
  })

program.command('review <reconId>')
  .description('复盘对账任务，查看状态变化和催办列表')
  .action(async (reconId) => {
    try {
      await initDB()
      const recon = await getReconciliation(reconId)
      if (!recon) {
        printError('对账记录不存在')
        return
      }
      const statusChanges = await getStatusChanges(reconId)
      const reminders = await getReminders(reconId)
      const manualNotes = await getManualNotes(reconId)

      printReconDetail(recon, statusChanges, reminders, manualNotes)
    } catch (err) {
      printError(err.message)
    }
  })

program.parse()
