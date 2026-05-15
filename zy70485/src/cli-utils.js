import chalk from 'chalk'
import Table from 'cli-table3'
import { STATUS_LABELS, ITEM_STATUS_LABELS } from './constants.js'

export function printReconList(recons) {
  const table = new Table({
    head: [
      chalk.cyan('批次号'),
      chalk.cyan('配置类型'),
      chalk.cyan('来源'),
      chalk.cyan('状态'),
      chalk.cyan('总数'),
      chalk.cyan('成功'),
      chalk.cyan('失败'),
      chalk.cyan('创建时间')
    ],
    colWidths: [20, 18, 15, 14, 8, 8, 8, 25]
  })

  for (const recon of recons) {
    table.push([
      recon.batchNo,
      recon.configType,
      recon.source,
      getStatusColor(recon.status)(STATUS_LABELS[recon.status]),
      recon.summary.total,
      recon.summary.success,
      recon.summary.failed,
      recon.createdAt.slice(0, 19).replace('T', ' ')
    ])
  }

  console.log(table.toString())
}

export function printReconDetail(recon, statusChanges, reminders, manualNotes) {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════╗'))
  console.log(chalk.bold.cyan('║                    对账任务详情                          ║'))
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝\n'))

  console.log(chalk.bold('基本信息'))
  const basicTable = new Table()
  basicTable.push(
    { '对账ID': recon.id },
    { '批次号': recon.batchNo },
    { '配置类型': recon.configType },
    { '来源系统': recon.source },
    { '当前状态': getStatusColor(recon.status)(STATUS_LABELS[recon.status]) },
    { '创建时间': recon.createdAt.slice(0, 19).replace('T', ' ') },
    { '更新时间': recon.updatedAt.slice(0, 19).replace('T', ' ') }
  )
  console.log(basicTable.toString())

  console.log(chalk.bold('\n材料摘要'))
  const summaryTable = new Table()
  summaryTable.push(
    { '来源': recon.materialSummary.source },
    { '项目数量': recon.materialSummary.itemCount },
    { '涉及部门': recon.materialSummary.departments.join('、') },
    { '最早截止': recon.materialSummary.earliestDeadline },
    { '最晚截止': recon.materialSummary.latestDeadline },
    { '涉及金额': recon.materialSummary.totalAmount.toLocaleString() + ' 元' }
  )
  console.log(summaryTable.toString())

  console.log(chalk.bold('\n明细列表'))
  const itemsTable = new Table({
    head: [
      chalk.cyan('序号'),
      chalk.cyan('项目编号'),
      chalk.cyan('部门'),
      chalk.cyan('负责人'),
      chalk.cyan('状态'),
      chalk.cyan('截止时间'),
      chalk.cyan('人工修正')
    ]
  })

  recon.items.forEach((item, idx) => {
    itemsTable.push([
      idx + 1,
      item.itemRef,
      item.department,
      item.owner,
      getItemStatusColor(item.status)(ITEM_STATUS_LABELS[item.status]),
      item.deadline,
      item.manualCorrected ? chalk.yellow('是') : '否'
    ])
  })
  console.log(itemsTable.toString())

  if (statusChanges.length > 0) {
    console.log(chalk.bold('\n状态变化轨迹'))
    const changesTable = new Table({
      head: [chalk.cyan('时间'), chalk.cyan('从状态'), chalk.cyan('到状态'), chalk.cyan('原因')]
    })
    statusChanges.forEach(change => {
      changesTable.push([
        change.changedAt.slice(0, 19).replace('T', ' '),
        change.fromStatus ? STATUS_LABELS[change.fromStatus] || change.fromStatus : '-',
        getStatusColor(change.toStatus)(STATUS_LABELS[change.toStatus] || change.toStatus),
        change.reason
      ])
    })
    console.log(changesTable.toString())
  }

  if (reminders.length > 0) {
    console.log(chalk.bold('\n审批催办列表'))
    const remindersTable = new Table({
      head: [chalk.cyan('类型'), chalk.cyan('内容'), chalk.cyan('创建时间'), chalk.cyan('是否解决')]
    })
    reminders.forEach(r => {
      remindersTable.push([
        chalk.red(r.type),
        r.content,
        r.createdAt.slice(0, 19).replace('T', ' '),
        r.isResolved ? chalk.green('是') : chalk.red('否')
      ])
    })
    console.log(remindersTable.toString())
  }

  if (manualNotes.length > 0) {
    console.log(chalk.bold('\n人工修正备注'))
    const notesTable = new Table({
      head: [chalk.cyan('操作人'), chalk.cyan('原状态'), chalk.cyan('新状态'), chalk.cyan('备注'), chalk.cyan('时间')]
    })
    manualNotes.forEach(note => {
      notesTable.push([
        note.operator,
        ITEM_STATUS_LABELS[note.previousStatus] || note.previousStatus,
        ITEM_STATUS_LABELS[note.newStatus] || note.newStatus,
        note.remark,
        note.createdAt.slice(0, 19).replace('T', ' ')
      ])
    })
    console.log(notesTable.toString())
  }

  console.log('\n')
}

export function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`))
}

export function printError(message) {
  console.log(chalk.red(`✗ ${message}`))
}

export function printInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`))
}

function getStatusColor(status) {
  const colorMap = {
    'pending': chalk.gray,
    'matched': chalk.blue,
    'partial_success': chalk.yellow,
    'success': chalk.green,
    'failed': chalk.red,
    'manual_corrected': chalk.magenta,
    'receipt_late': chalk.redBright
  }
  return colorMap[status] || chalk.white
}

function getItemStatusColor(status) {
  const colorMap = {
    'pending': chalk.gray,
    'matched': chalk.blue,
    'success': chalk.green,
    'failed': chalk.red,
    'waiting_receipt': chalk.yellow,
    'overdue': chalk.redBright,
    'manual_corrected': chalk.magenta
  }
  return colorMap[status] || chalk.white
}
