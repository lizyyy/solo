#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import path from 'path'
import fs from 'fs'
import { initDatabase } from '../server/database'
import { ImportService } from '../server/services/importService'
import { reportService } from '../server/services/reportService'
import { fileParser } from '../server/services/fileParser'
import type { FileFormat, RowResult } from '../shared/types'

const program = new Command()

initDatabase()

let importService: ImportService | null = null

function getImportService(): ImportService {
  if (!importService) {
    importService = new ImportService()
    importService.initDefaultSchemas()
  }
  return importService
}

program
  .name('import-validator')
  .description('前端导入校验差异回放器 - 详细追踪每一行的导入结果')
  .version('1.0.0')

program
  .command('list')
  .description('列出历史导入任务')
  .option('-l, --limit <number>', '限制数量', '50')
  .action(async (options) => {
    try {
      const service = getImportService()
      const jobs = service.getJobs(parseInt(options.limit))

      if (jobs.length === 0) {
        console.log(chalk.yellow('暂无历史记录'))
        return
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('名称'),
          chalk.cyan('类型'),
          chalk.cyan('状态'),
          chalk.cyan('总计'),
          chalk.green('成功'),
          chalk.red('失败'),
          chalk.magenta('创建时间')
        ],
        colWidths: [38, 25, 10, 10, 8, 8, 8, 22]
      })

      for (const job of jobs) {
        const successRate = job.totalRows > 0 
          ? ((job.successCount / job.totalRows) * 100).toFixed(0) + '%'
          : '0%'
        
        table.push([
          job.id.substring(0, 36),
          job.name,
          job.type,
          job.status === 'completed' 
            ? chalk.green(job.status) 
            : chalk.red(job.status),
          job.totalRows,
          chalk.green(job.successCount),
          chalk.red(job.failedCount),
          new Date(job.createdAt).toLocaleString('zh-CN')
        ])
      }

      console.log(table.toString())
      console.log(chalk.gray(`\n共 ${jobs.length} 条记录`))
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('schemas')
  .description('列出可用的校验规则')
  .action(() => {
    try {
      const service = getImportService()
      const schemas = service.getSchemas()

      if (schemas.length === 0) {
        console.log(chalk.yellow('暂无校验规则'))
        return
      }

      for (const schema of schemas) {
        console.log(chalk.cyan.bold(`\n[${schema.id}] ${schema.name}`))
        console.log(chalk.gray(`  类型: ${schema.type}`))
        console.log(chalk.gray(`  字段:`))
        
        for (const field of schema.fields) {
          const req = field.required ? chalk.red('必填') : chalk.gray('可选')
          const rules = field.rules.length > 0 
            ? field.rules.map(r => r.type).join(', ')
            : '-'
          console.log(`    - ${field.name} (${field.label}) [${req}] ${chalk.gray('| 规则: ' + rules)}`)
        }
      }
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('import')
  .description('导入并校验文件')
  .argument('<file>', '文件路径')
  .requiredOption('-s, --schema <id>', '校验规则 ID')
  .option('-f, --format <format>', '文件格式: csv, xlsx, xls', 'auto')
  .option('-d, --delimiter <char>', 'CSV 分隔符', ',')
  .option('--no-header', '没有表头行')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file)
      
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`文件不存在: ${filePath}`))
        process.exit(1)
      }

      let format: FileFormat
      if (options.format === 'auto') {
        const ext = path.extname(filePath).slice(1).toLowerCase()
        if (['csv', 'xlsx', 'xls'].includes(ext)) {
          format = ext as FileFormat
        } else {
          console.error(chalk.red('无法自动检测文件格式，请使用 -f 参数指定'))
          process.exit(1)
        }
      } else {
        format = options.format as FileFormat
      }

      const service = getImportService()
      const schema = service.getSchema(options.schema)
      
      if (!schema) {
        console.error(chalk.red(`校验规则不存在: ${options.schema}`))
        const schemas = service.getSchemas()
        if (schemas.length > 0) {
          console.log(chalk.gray('\n可用的规则:'))
          for (const s of schemas) {
            console.log(`  ${s.id} - ${s.name}`)
          }
        }
        process.exit(1)
      }

      console.log(chalk.cyan(`\n导入文件: ${filePath}`))
      console.log(chalk.cyan(`校验规则: ${schema.name}`))
      console.log(chalk.cyan(`文件格式: ${format}`))
      console.log(chalk.gray('----------------------------------------'))

      const { job, summary } = await service.processImport({
        schemaId: options.schema,
        filePath,
        format,
        fileName: path.basename(filePath),
        options: {
          delimiter: options.delimiter,
          hasHeader: options.header !== false
        }
      })

      console.log(chalk.green(`\n✓ 导入任务完成`))
      console.log(`任务ID: ${chalk.yellow(job.id)}`)
      console.log(`文件名: ${job.name}`)
      console.log(`\n统计:`)
      console.log(`  总计: ${summary.total}`)
      console.log(`  成功: ${chalk.green(summary.success)}`)
      console.log(`  失败: ${chalk.red(summary.failed)}`)
      
      const successRate = summary.total > 0 
        ? ((summary.success / summary.total) * 100).toFixed(1)
        : '0'
      console.log(`  成功率: ${chalk.cyan(successRate + '%')}`)

      if (summary.failedDetails.length > 0) {
        console.log(chalk.red(`\n错误统计:`))
        for (const err of summary.failedDetails) {
          console.log(`  - ${err.message}`)
        }
      }

      if (summary.failed > 0) {
        console.log(chalk.yellow(`\n提示: 使用 "import-validator replay ${job.id}" 查看详细错误`))
        console.log(chalk.yellow(`      使用 "import-validator retry ${job.id}" 重试失败行`))
      }
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('replay')
  .description('复验历史任务 - 查看详细结果')
  .argument('<jobId>', '任务 ID')
  .option('-a, --all', '显示所有行', false)
  .option('-s, --success', '仅显示成功行', false)
  .option('-f, --failed', '仅显示失败行', true)
  .option('-r, --rows <rows>', '显示指定行号（如 1,3,5）')
  .option('-j, --json', '输出 JSON 格式', false)
  .action(async (jobId, options) => {
    try {
      const service = getImportService()
      const job = service.getJob(jobId)

      if (!job) {
        console.error(chalk.red(`任务不存在: ${jobId}`))
        process.exit(1)
      }

      let rows: RowResult[]
      
      if (options.rows) {
        const rowIds = options.rows.split(',').map((r: string) => r.trim())
        rows = service.getFailedRows(jobId, rowIds)
      } else if (options.success) {
        rows = service.getSuccessRows(jobId)
      } else if (options.all) {
        rows = service.getAllRows(jobId)
      } else {
        rows = service.getFailedRows(jobId)
      }

      if (options.json) {
        console.log(JSON.stringify({
          job,
          rows: rows.map(r => ({
            rowIndex: r.rowIndex,
            status: r.status,
            data: r.data,
            errors: r.errors,
            retryCount: r.retryCount
          }))
        }, null, 2))
        return
      }

      console.log(chalk.cyan.bold(`\n任务详情`))
      console.log(`任务ID: ${job.id}`)
      console.log(`文件名: ${job.name}`)
      console.log(`类型: ${job.type}`)
      console.log(`状态: ${job.status}`)
      console.log(`\n统计:`)
      console.log(`  总计: ${job.totalRows}`)
      console.log(`  成功: ${chalk.green(job.successCount)}`)
      console.log(`  失败: ${chalk.red(job.failedCount)}`)
      
      if (rows.length === 0) {
        console.log(chalk.green('\n✓ 没有需要显示的错误行'))
        return
      }

      console.log(chalk.red(`\n共 ${rows.length} 条${options.success ? '成功' : '失败'}记录:\n`))

      for (const row of rows) {
        const statusColor = row.status === 'success' ? chalk.green : chalk.red
        console.log(statusColor(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`))
        console.log(statusColor(`行号: ${row.rowIndex} | 状态: ${row.status}`))
        if (row.retryCount > 0) {
          console.log(chalk.gray(`重试次数: ${row.retryCount}`))
        }
        
        console.log(chalk.gray('\n数据:'))
        for (const [key, value] of Object.entries(row.data)) {
          console.log(`  ${key}: ${value}`)
        }

        if (row.errors.length > 0) {
          console.log(chalk.red('\n错误:'))
          for (const error of row.errors) {
            console.log(`  ${chalk.yellow(error.field)}: ${error.message}`)
            if (error.value !== undefined) {
              console.log(`    实际值: ${chalk.gray(String(error.value))}`)
            }
          }
        }
        console.log('')
      }
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('retry')
  .description('重试失败的行')
  .argument('<jobId>', '任务 ID')
  .option('-r, --rows <rows>', '重试指定行号（如 1,3,5）')
  .option('-e, --edit <json>', '覆盖数据 (JSON 格式: {"行号": {"字段": "新值"}})')
  .option('-y, --yes', '跳过确认', false)
  .action(async (jobId, options) => {
    try {
      const service = getImportService()
      const job = service.getJob(jobId)

      if (!job) {
        console.error(chalk.red(`任务不存在: ${jobId}`))
        process.exit(1)
      }

      const failedRows = options.rows 
        ? service.getFailedRows(jobId, options.rows.split(',').map((r: string) => r.trim()))
        : service.getFailedRows(jobId)

      if (failedRows.length === 0) {
        console.log(chalk.green('没有失败的行需要重试'))
        return
      }

      let overrideData: Record<string, Record<string, any>> | undefined = undefined
      
      if (options.edit) {
        try {
          const editMap = JSON.parse(options.edit)
          overrideData = {}
          
          for (const [rowIndex, data] of Object.entries(editMap)) {
            const row = failedRows.find(r => r.rowIndex === parseInt(rowIndex))
            if (row) {
              overrideData[row.id] = data as Record<string, any>
            }
          }
        } catch (e) {
          console.error(chalk.red('覆盖数据格式错误，应为 JSON 格式'))
          process.exit(1)
        }
      }

      if (!options.yes) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        })

        await new Promise((resolve) => {
          readline.question(
            chalk.yellow(`确定要重试 ${failedRows.length} 条失败记录吗？(y/N) `),
            (answer: string) => {
              readline.close()
              if (!['y', 'yes'].includes(answer.toLowerCase())) {
                console.log(chalk.gray('已取消'))
                process.exit(0)
              }
              resolve(undefined)
            }
          )
        })
      }

      const rowIds = options.rows 
        ? options.rows.split(',').map((r: string) => r.trim())
        : undefined

      console.log(chalk.cyan(`\n正在重试 ${failedRows.length} 条记录...`))

      const { job: updatedJob, summary } = await service.retryFailed(jobId, rowIds, overrideData)

      console.log(chalk.green('\n✓ 重试完成'))
      console.log(`\n统计:`)
      console.log(`  总计: ${summary.total}`)
      console.log(`  成功: ${chalk.green(summary.success)}`)
      console.log(`  失败: ${chalk.red(summary.failed)}`)

      const newSuccess = summary.total - updatedJob.totalRows + updatedJob.successCount
      if (newSuccess > 0) {
        console.log(chalk.green(`\n新增成功: ${newSuccess} 条`))
      }

      if (summary.failed > 0) {
        console.log(chalk.yellow(`\n仍有 ${summary.failed} 条失败记录`))
        console.log(chalk.gray(`使用 "import-validator replay ${jobId}" 查看详情`))
      }
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('export')
  .description('导出报告')
  .argument('<jobId>', '任务 ID')
  .option('-f, --format <format>', '导出格式: csv, json, xlsx', 'csv')
  .option('-o, --output <path>', '输出路径')
  .option('--no-failed', '不包含失败行', false)
  .option('--no-success', '不包含成功行', false)
  .action(async (jobId, options) => {
    try {
      const format = options.format as 'csv' | 'json' | 'xlsx'
      
      if (!['csv', 'json', 'xlsx'].includes(format)) {
        console.error(chalk.red(`不支持的格式: ${format}`))
        process.exit(1)
      }

      const report = await reportService.generateReport(jobId, format, {
        includeSuccess: options.success !== false,
        includeFailed: options.failed !== false,
        includeSkipped: true
      })

      let outputPath = report.filePath
      if (options.output) {
        const dest = path.resolve(options.output)
        fs.copyFileSync(report.filePath, dest)
        outputPath = dest
      }

      console.log(chalk.green(`✓ 报告已导出`))
      console.log(`路径: ${outputPath}`)
      console.log(`格式: ${format.toUpperCase()}`)
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program
  .command('validate')
  .description('仅校验文件，不保存历史记录')
  .argument('<file>', '文件路径')
  .requiredOption('-s, --schema <id>', '校验规则 ID')
  .option('-f, --format <format>', '文件格式', 'auto')
  .option('-j, --json', '输出 JSON 格式', false)
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file)
      
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`文件不存在: ${filePath}`))
        process.exit(1)
      }

      let format: FileFormat
      if (options.format === 'auto') {
        const ext = path.extname(filePath).slice(1).toLowerCase()
        if (['csv', 'xlsx', 'xls'].includes(ext)) {
          format = ext as FileFormat
        } else {
          console.error(chalk.red('无法自动检测文件格式'))
          process.exit(1)
        }
      } else {
        format = options.format as FileFormat
      }

      const service = getImportService()
      const schema = service.getSchema(options.schema)
      
      if (!schema) {
        console.error(chalk.red(`校验规则不存在: ${options.schema}`))
        process.exit(1)
      }

      const parsed = await fileParser.parse(filePath, format)
      
      const { validator } = await import('../server/services/validator')
      const context = validator.createContext('temp', schema, parsed.rows)
      
      const results: any[] = []
      let success = 0
      let failed = 0

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i]
        const result = validator.validate(row, i + 1, context)
        results.push({
          rowIndex: i + 1,
          status: result.status,
          data: result.data,
          errors: result.errors
        })
        
        if (result.status === 'success') success++
        else failed++
      }

      if (options.json) {
        console.log(JSON.stringify({ total: parsed.totalRows, success, failed, results }, null, 2))
        return
      }

      console.log(chalk.cyan(`校验文件: ${filePath}`))
      console.log(chalk.cyan(`校验规则: ${schema.name}`))
      console.log(`\n总计: ${parsed.totalRows}`)
      console.log(`成功: ${chalk.green(success)}`)
      console.log(`失败: ${chalk.red(failed)}`)

      if (failed > 0) {
        console.log(chalk.red(`\n错误记录:`))
        const failedResults = results.filter(r => r.status === 'failed')
        for (const r of failedResults.slice(0, 10)) {
          console.log(`\n行 ${r.rowIndex}:`)
          for (const e of r.errors) {
            console.log(`  ${e.field}: ${e.message}`)
          }
        }
        if (failedResults.length > 10) {
          console.log(chalk.gray(`\n... 还有 ${failedResults.length - 10} 条错误`))
        }
      }
    } catch (error: any) {
      console.error(chalk.red('错误: ' + error.message))
      process.exit(1)
    }
  })

program.parse()
