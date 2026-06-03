import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getDb } from './api/db.js'
import * as ledger from './api/services/ledger.js'
import { seedDemoData } from './api/services/seed.js'

const argv = await yargs(hideBin(process.argv))
  .command('import', '导入除权日截图数据', (y) => {
    return y.option('file', { type: 'string', demandOption: true, describe: 'JSON 文件路径' })
      .option('operator', { type: 'string', default: 'system', describe: '操作人' })
  })
  .command('detect', '重跑一致性检测', (y) => {
    return y.option('all', { type: 'boolean', default: false, describe: '检测全部记录' })
      .option('record', { type: 'string', describe: '指定交易编号检测' })
  })
  .command('supplement', '补录税费率备注', (y) => {
    return y.option('record', { type: 'string', demandOption: true, describe: '交易编号' })
      .option('rate', { type: 'number', demandOption: true, describe: '税费率' })
      .option('remark', { type: 'string', default: '', describe: '备注' })
      .option('operator', { type: 'string', default: 'system', describe: '操作人' })
  })
  .command('correct', '人工修正记录', (y) => {
    return y.option('record', { type: 'string', demandOption: true, describe: '交易编号' })
      .option('field', { type: 'string', demandOption: true, describe: '修正字段' })
      .option('value', { type: 'string', demandOption: true, describe: '新值' })
      .option('operator', { type: 'string', default: 'system', describe: '操作人' })
  })
  .command('confirm', '财务复核确认', (y) => {
    return y.option('record', { type: 'string', demandOption: true, describe: '交易编号' })
      .option('operator', { type: 'string', default: 'system', describe: '操作人' })
  })
  .command('reject', '财务复核打回', (y) => {
    return y.option('record', { type: 'string', demandOption: true, describe: '交易编号' })
      .option('operator', { type: 'string', default: 'system', describe: '操作人' })
  })
  .command('stats', '查看状态统计', () => {})
  .command('demo', '演示数据管理', (y) => {
    return y.option('seed', { type: 'boolean', default: false, describe: '加载演示数据' })
  })
  .command('audit-log', '查看操作流水', (y) => {
    return y.option('record', { type: 'string', describe: '指定交易编号' })
  })
  .demandCommand(1)
  .strict()
  .help()
  .parse()

function findRecordByTradeNo(tradeNo: string): any {
  const db = getDb()
  return db.prepare('SELECT * FROM ledger_records WHERE trade_no = ?').get(tradeNo)
}

const command = argv._[0]

switch (command) {
  case 'import': {
    const fs = await import('fs')
    const filePath = (argv as any).file
    const operator = (argv as any).operator
    const raw = fs.readFileSync(filePath, 'utf-8')
    const records = JSON.parse(raw)
    if (!Array.isArray(records)) {
      console.error('JSON 文件内容必须为数组')
      process.exit(1)
    }
    ledger.importRecords(records, operator)
    console.log(`成功导入 ${records.length} 条记录`)
    break
  }

  case 'detect': {
    const { all, record } = argv as any
    if (record) {
      const rec = findRecordByTradeNo(record)
      if (!rec) {
        console.error(`未找到交易编号: ${record}`)
        process.exit(1)
      }
      ledger.rerun(rec.id, 'cli')
      console.log(`已重跑检测: ${record}`)
    } else if (all) {
      ledger.rerun(undefined, 'cli')
      console.log('已重跑全部检测')
    } else {
      console.error('请指定 --record <交易编号> 或 --all')
      process.exit(1)
    }
    break
  }

  case 'supplement': {
    const { record, rate, remark, operator } = argv as any
    const rec = findRecordByTradeNo(record)
    if (!rec) {
      console.error(`未找到交易编号: ${record}`)
      process.exit(1)
    }
    ledger.supplement(rec.id, rate, remark, operator)
    console.log(`已补录 ${record} 税费率: ${rate}%，备注: ${remark}`)
    break
  }

  case 'correct': {
    const { record, field, value, operator } = argv as any
    const rec = findRecordByTradeNo(record)
    if (!rec) {
      console.error(`未找到交易编号: ${record}`)
      process.exit(1)
    }
    ledger.correct(rec.id, field, value, operator)
    console.log(`已修正 ${record} ${field}: ${value}`)
    break
  }

  case 'confirm': {
    const { record, operator } = argv as any
    const rec = findRecordByTradeNo(record)
    if (!rec) {
      console.error(`未找到交易编号: ${record}`)
      process.exit(1)
    }
    ledger.confirm(rec.id, operator)
    console.log(`已确认 ${record}`)
    break
  }

  case 'reject': {
    const { record, operator } = argv as any
    const rec = findRecordByTradeNo(record)
    if (!rec) {
      console.error(`未找到交易编号: ${record}`)
      process.exit(1)
    }
    ledger.reject(rec.id, operator)
    console.log(`已打回 ${record}`)
    break
  }

  case 'stats': {
    const stats = ledger.getStats()
    console.log('状态统计:')
    console.log(`  正常: ${stats.normal}`)
    console.log(`  不一致待复核: ${stats.inconsistent}`)
    console.log(`  已补录: ${stats.supplemented}`)
    console.log(`  已确认: ${stats.confirmed}`)
    console.log(`  合计: ${stats.total}`)
    break
  }

  case 'demo': {
    const { seed } = argv as any
    if (seed) {
      seedDemoData()
      console.log('演示数据已加载')
    } else {
      console.error('请指定 --seed 加载演示数据')
    }
    break
  }

  case 'audit-log': {
    const { record } = argv as any
    let recordId: string | undefined
    if (record) {
      const rec = findRecordByTradeNo(record)
      if (!rec) {
        console.error(`未找到交易编号: ${record}`)
        process.exit(1)
      }
      recordId = rec.id
    }
    const logs = ledger.getAuditLogs(recordId)
    if (logs.length === 0) {
      console.log('暂无操作记录')
    } else {
      for (const log of logs as any[]) {
        const time = new Date(log.timestamp).toLocaleString('zh-CN')
        console.log(`[${time}] [${log.action}] ${log.detail}`)
        console.log(`  命令: ${log.cli_command}`)
      }
    }
    break
  }

  default:
    console.error('未知命令')
    process.exit(1)
}

process.exit(0)
