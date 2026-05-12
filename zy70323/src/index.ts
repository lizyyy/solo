#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import {
  CalculationContext,
  ManualAdjustment
} from './types'
import { CostCalculator } from './modules/costCalculator'
import { ReportGenerator } from './modules/reportGenerator'
import { ManualAdjustmentManager, CreateAdjustmentParams } from './modules/manualAdjustmentManager'

const program = new Command()
const calculator = new CostCalculator()
const reportGenerator = new ReportGenerator()

const DEFAULT_SAMPLES_DIR = path.join(process.cwd(), 'samples')
const STATE_FILE = path.join(process.cwd(), '.api-cost-state.json')

interface StateData {
  lastCalculationResult?: object
  lastContext?: object
  manualAdjustments?: ManualAdjustment[]
}

function loadJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as T
}

function loadState(): StateData {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return loadJsonFile<StateData>(STATE_FILE)
    } catch {
      return { manualAdjustments: [] }
    }
  }
  return { manualAdjustments: [] }
}

function saveState(state: StateData): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

function buildContext(options: {
  logs?: string
  rules?: string
  mappings?: string
  sharedConfig?: string
  periodStart: string
  periodEnd: string
}): CalculationContext {
  const samplesDir = DEFAULT_SAMPLES_DIR
  const logsPath = options.logs || path.join(samplesDir, 'logs.json')
  const rulesPath = options.rules || path.join(samplesDir, 'cost-rules.json')
  const mappingsPath = options.mappings || path.join(samplesDir, 'app-mappings.json')
  const sharedConfigPath = options.sharedConfig || path.join(samplesDir, 'shared-cost-config.json')

  const state = loadState()

  return {
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    logs: loadJsonFile(logsPath),
    costRules: loadJsonFile(rulesPath),
    appMappings: loadJsonFile(mappingsPath),
    sharedConfig: loadJsonFile(sharedConfigPath),
    manualAdjustments: state.manualAdjustments || []
  }
}

program
  .name('api-cost')
  .description('API 调用成本分摊 CLI')
  .version('1.0.0')

program
  .command('preflight')
  .description('预检映射缺口和配置问题')
  .option('-l, --logs <path>', '调用日志文件路径')
  .option('-r, --rules <path>', '成本规则文件路径')
  .option('-m, --mappings <path>', 'appId 映射文件路径')
  .option('-s, --shared-config <path>', '共享成本配置文件路径')
  .requiredOption('--start <date>', '周期开始时间 (ISO 格式)')
  .requiredOption('--end <date>', '周期结束时间 (ISO 格式)')
  .action((options) => {
    const ctx = buildContext({
      logs: options.logs,
      rules: options.rules,
      mappings: options.mappings,
      sharedConfig: options.sharedConfig,
      periodStart: options.start,
      periodEnd: options.end
    })

    const preflight = calculator.preflightCheck(ctx)
    console.log(reportGenerator.generatePreflightReport(preflight))

    if (!preflight.canProceed) {
      process.exit(1)
    }
  })

program
  .command('calculate')
  .description('执行成本分摊计算')
  .option('-l, --logs <path>', '调用日志文件路径')
  .option('-r, --rules <path>', '成本规则文件路径')
  .option('-m, --mappings <path>', 'appId 映射文件路径')
  .option('-s, --shared-config <path>', '共享成本配置文件路径')
  .requiredOption('--start <date>', '周期开始时间 (ISO 格式)')
  .requiredOption('--end <date>', '周期结束时间 (ISO 格式)')
  .option('--format <format>', '输出格式: text|json', 'text')
  .option('--save', '保存计算结果到状态文件')
  .action((options) => {
    const ctx = buildContext({
      logs: options.logs,
      rules: options.rules,
      mappings: options.mappings,
      sharedConfig: options.sharedConfig,
      periodStart: options.start,
      periodEnd: options.end
    })

    const result = calculator.calculate(ctx)

    if (options.format === 'json') {
      console.log(reportGenerator.generateJsonReport(result))
    } else {
      console.log(reportGenerator.generateTextReport(result))
    }

    if (options.save) {
      const state = loadState()
      state.lastCalculationResult = result
      state.lastContext = ctx
      saveState(state)
      console.log('\n[提示] 计算结果已保存到状态文件')
    }
  })

program
  .command('register')
  .description('登记人工归属')
  .requiredOption('--created-by <user>', '登记人')
  .requiredOption('--target-team-id <teamId>', '目标团队 ID')
  .requiredOption('--target-team-name <teamName>', '目标团队名称')
  .requiredOption('--target-business-line <bl>', '目标业务线')
  .requiredOption('--amount <number>', '金额')
  .requiredOption('--reason <text>', '原因')
  .option('--request-id <reqId>', '指定 requestId')
  .option('--app-id <appId>', '指定 appId')
  .option('--api-name <apiName>', '指定接口名')
  .option('--effective-from <date>', '生效开始时间', new Date().toISOString())
  .option('--effective-to <date>', '生效结束时间')
  .action((options) => {
    const state = loadState()
    const adjManager = new ManualAdjustmentManager()
    if (state.manualAdjustments && state.manualAdjustments.length > 0) {
      adjManager.loadAdjustments(state.manualAdjustments)
    }

    const params: CreateAdjustmentParams = {
      createdBy: options.createdBy,
      effectiveFrom: options.effectiveFrom,
      effectiveTo: options.effectiveTo,
      requestId: options.requestId,
      appId: options.appId,
      apiName: options.apiName,
      targetTeamId: options.targetTeamId,
      targetTeamName: options.targetTeamName,
      targetBusinessLine: options.targetBusinessLine,
      amount: parseFloat(options.amount),
      reason: options.reason
    }

    const adjustment = adjManager.createAdjustment(params)
    state.manualAdjustments = adjManager.getAdjustments()
    saveState(state)

    console.log('人工归属已登记:')
    console.log(`  ID: ${adjustment.id}`)
    console.log(`  创建时间: ${adjustment.createdAt}`)
    console.log(`  创建人: ${adjustment.createdBy}`)
    console.log(`  目标团队: ${adjustment.targetTeamName}`)
    console.log(`  金额: ¥${adjustment.amount.toFixed(4)}`)
    console.log(`  原因: ${adjustment.reason}`)
  })

program
  .command('recompute')
  .description('使用最新配置重新计算')
  .option('-l, --logs <path>', '调用日志文件路径')
  .option('-r, --rules <path>', '成本规则文件路径')
  .option('-m, --mappings <path>', 'appId 映射文件路径')
  .option('-s, --shared-config <path>', '共享成本配置文件路径')
  .requiredOption('--start <date>', '周期开始时间 (ISO 格式)')
  .requiredOption('--end <date>', '周期结束时间 (ISO 格式)')
  .option('--format <format>', '输出格式: text|json', 'text')
  .action((options) => {
    const state = loadState()

    if (!state.lastCalculationResult) {
      console.error('错误: 没有找到之前的计算结果，请先运行 calculate 命令并使用 --save 选项')
      process.exit(1)
    }

    const ctx = buildContext({
      logs: options.logs,
      rules: options.rules,
      mappings: options.mappings,
      sharedConfig: options.sharedConfig,
      periodStart: options.start,
      periodEnd: options.end
    })

    const newResult = calculator.calculate(ctx)
    const diffs = calculator.computeDiff(
      state.lastCalculationResult as any,
      newResult
    )

    console.log(reportGenerator.generateTextReport(newResult))
    console.log('')
    console.log(reportGenerator.generateDiffReport(diffs))

    state.lastCalculationResult = newResult
    state.lastContext = ctx
    saveState(state)
  })

program
  .command('export')
  .description('导出报告')
  .requiredOption('--output <path>', '输出文件路径')
  .option('--format <format>', '导出格式: json', 'json')
  .action((options) => {
    const state = loadState()

    if (!state.lastCalculationResult) {
      console.error('错误: 没有找到之前的计算结果，请先运行 calculate 命令')
      process.exit(1)
    }

    const outputPath = path.resolve(options.output)
    const content = JSON.stringify(state.lastCalculationResult, null, 2)
    fs.writeFileSync(outputPath, content, 'utf-8')

    console.log(`报告已导出到: ${outputPath}`)
  })

program
  .command('list-adjustments')
  .description('列出所有人工归属记录')
  .option('--show-expired', '显示已过期的记录')
  .action((options) => {
    const state = loadState()
    const adjManager = new ManualAdjustmentManager()
    if (state.manualAdjustments && state.manualAdjustments.length > 0) {
      adjManager.loadAdjustments(state.manualAdjustments)
    }

    const adjustments = options.showExpired
      ? adjManager.getAdjustments()
      : adjManager.getAdjustments().filter(a => !a.isExpired)

    if (adjustments.length === 0) {
      console.log('没有人工归属记录')
      return
    }

    console.log('人工归属记录列表:')
    console.log('-'.repeat(60))

    for (const adj of adjustments) {
      console.log(`\nID: ${adj.id}`)
      console.log(`  创建时间: ${adj.createdAt}`)
      console.log(`  创建人: ${adj.createdBy}`)
      console.log(`  目标团队: ${adj.targetTeamName} (${adj.targetTeamId})`)
      console.log(`  金额: ¥${adj.amount.toFixed(4)}`)
      console.log(`  原因: ${adj.reason}`)
      console.log(`  生效时间: ${adj.effectiveFrom}${adj.effectiveTo ? ' ~ ' + adj.effectiveTo : ''}`)
      console.log(`  状态: ${adj.isExpired ? '已过期' : '有效'}`)
    }
  })

program.parse(process.argv)
