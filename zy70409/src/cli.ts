#!/usr/bin/env node

import { Command } from 'commander'
import { DataGenerator } from './services/dataGenerator'
import { DataStore } from './store/dataStore'
import { RuleEngine } from './services/ruleEngine'
import { BatchService } from './services/batchService'
import { QueryService } from './services/queryService'
import { OutputFormatter } from './services/outputFormatter'

const program = new Command()

program
  .name('proc-audit')
  .description('采购询价单复核审计命令行工具')
  .version('1.0.0')

program
  .command('init-demo')
  .description('初始化演示数据')
  .action(() => {
    console.log('正在初始化演示数据...')
    DataGenerator.initDemoData()
    console.log('✅ 演示数据初始化完成')
    console.log('已创建:')
    console.log(`  - ${DataStore.getRules().length} 条规则`)
    console.log(`  - ${DataStore.getInquiries().length} 条询价单`)
    console.log(`  - ${DataStore.getPermissionTickets().length} 条权限临时票`)
  })

program
  .command('list-inquiries')
  .description('列出询价单')
  .option('--batch-id <batchId>', '按批次筛选')
  .option('--status <status>', '按状态筛选')
  .option('--format <format>', '输出格式 (json|markdown)', 'json')
  .action((options) => {
    const result = QueryService.queryInquiries(
      {
        batchId: options.batchId,
        status: options.status
      },
      1,
      100
    )

    if (options.format === 'markdown') {
      let md = '# 询价单列表\n\n'
      md += `共 ${result.metadata?.total} 条记录\n\n`
      md += '| 询价单号 | 标题 | 部门 | 申请人 | 总金额 | 状态 | 批次 |\n'
      md += '|----------|------|------|--------|--------|------|------|\n'
      for (const inquiry of result.data || []) {
        md += `| ${inquiry.inquiryNo} | ${inquiry.title} | ${inquiry.department} | ${inquiry.applicantName} | ¥${inquiry.totalAmount.toLocaleString()} | ${inquiry.status} | ${inquiry.batchId} |\n`
      }
      console.log(md)
    } else {
      console.log(OutputFormatter.toJSON(result))
    }
  })

program
  .command('review')
  .description('复核询价单')
  .argument('<inquiryId>', '询价单ID')
  .option('--rule-version <version>', '指定规则版本')
  .option('--save', '保存复核结果')
  .action((inquiryId, options) => {
    const inquiry = DataStore.getInquiryById(inquiryId)
    if (!inquiry) {
      console.error(`❌ 询价单 ${inquiryId} 不存在`)
      process.exit(1)
    }

    const ruleEngine = options.ruleVersion
      ? new RuleEngine(options.ruleVersion)
      : new RuleEngine()

    console.log(`使用规则版本: ${ruleEngine.getRuleVersion()}`)
    console.log(`规则描述: ${ruleEngine.getRuleDescription()}\n`)

    const result = ruleEngine.review(inquiry)

    if (options.save) {
      DataStore.addReviewResult(result)
      console.log('✅ 复核结果已保存\n')
    }

    console.log(OutputFormatter.toJSON(result))
  })

program
  .command('batch-preview')
  .description('批量操作预览')
  .argument('<name>', '操作名称')
  .argument('<batchId>', '批次ID')
  .option('--type <type>', '操作类型 (review)', 'review')
  .action((name, batchId, options) => {
    const inquiries = DataStore.getInquiriesByBatch(batchId)
    if (inquiries.length === 0) {
      console.error(`❌ 批次 ${batchId} 不存在或无数据`)
      process.exit(1)
    }

    const targetIds = inquiries.map(i => i.id)
    const operation = BatchService.createPreview(
      name,
      options.type,
      targetIds,
      'cli-user'
    )

    console.log('✅ 批量操作预览已创建\n')
    console.log(OutputFormatter.toJSON(operation))
  })

program
  .command('batch-execute')
  .description('执行批量操作')
  .argument('<operationId>', '批量操作ID')
  .action((operationId) => {
    try {
      const operation = BatchService.executeBatch(operationId)
      console.log('✅ 批量操作执行完成\n')
      console.log(OutputFormatter.toJSON(operation))
    } catch (error) {
      console.error(`❌ 执行失败: ${(error as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('generate-report')
  .description('生成报告')
  .argument('<inquiryId>', '询价单ID')
  .option('--output <path>', '输出文件路径')
  .option('--format <format>', '输出格式 (markdown|json)', 'markdown')
  .action((inquiryId, options) => {
    try {
      if (options.format === 'json') {
        const details = QueryService.getInquiryWithDetails(inquiryId)
        const content = OutputFormatter.toJSON(details)
        if (options.output) {
          OutputFormatter.saveToFile(content, options.output)
          console.log(`✅ 报告已保存到: ${options.output}`)
        } else {
          console.log(content)
        }
      } else {
        const report = OutputFormatter.generateReport(inquiryId)
        if (options.output) {
          OutputFormatter.saveToFile(report, options.output)
          console.log(`✅ 报告已保存到: ${options.output}`)
        } else {
          console.log(report)
        }
      }
    } catch (error) {
      console.error(`❌ 生成报告失败: ${(error as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('generate-batch-report')
  .description('生成批次报告')
  .argument('<batchId>', '批次ID')
  .option('--output <path>', '输出文件路径')
  .action((batchId, options) => {
    const report = OutputFormatter.generateBatchReport(batchId)
    if (options.output) {
      OutputFormatter.saveToFile(report, options.output)
      console.log(`✅ 批次报告已保存到: ${options.output}`)
    } else {
      console.log(report)
    }
  })

program
  .command('query-results')
  .description('查询复核结果')
  .option('--batch-id <batchId>', '按批次筛选')
  .option('--status <status>', '按状态筛选 (success|warning|error)')
  .action((options) => {
    const result = QueryService.queryReviewResults(
      {
        batchId: options.batchId,
        status: options.status
      },
      1,
      100
    )
    console.log(OutputFormatter.toJSON(result))
  })

program
  .command('list-rules')
  .description('列出所有规则')
  .action(() => {
    const rules = DataStore.getRules()
    console.log(OutputFormatter.toJSON(rules))
  })

program.parse()
