#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';

import { initStore, storeExists, getBatch, getAllBatches, getStorePath } from './utils/store';
import {
  printSuccess,
  printError,
  printTitle,
  printBatchList,
  printBatchSummary,
  printReport,
  formatStatus
} from './utils/presenter';

import {
  createBatch,
  recordInitialInspection,
  recordReinspection,
  requestConcession,
  approveConcession,
  approveRework,
  closeBatch,
  manualCorrection
} from './engine/batchService';

import { ALL_SCENARIOS, SampleScenario } from './data/samples';
import { Defect } from './types';

const program = new Command();

program
  .name('qc')
  .description('质检抽样复判 CLI - 生产质检抽样复判/让步放行历史追踪工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据仓库')
  .option('-f, --force', '强制重置现有数据')
  .action((options) => {
    printTitle('初始化数据仓库');
    
    if (storeExists() && !options.force) {
      printError('数据仓库已存在', ['使用 --force 选项可以强制重置现有数据']);
      process.exit(1);
    }

    initStore();
    printSuccess(`数据仓库已初始化: ${getStorePath()}`);
  });

program
  .command('seed')
  .description('导入内置样例数据（4个完整场景）')
  .action(() => {
    printTitle('导入内置样例数据');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    console.log(chalk.cyan(`  共 ${ALL_SCENARIOS.length} 个样例场景:\n`));

    ALL_SCENARIOS.forEach((scenario, index) => {
      console.log(chalk.bold(`  ${index + 1}. ${scenario.name}`));
      console.log(`     ${scenario.description}`);
      console.log(`     批次号: ${scenario.batchNumber}`);
      console.log();
    });

    for (const scenario of ALL_SCENARIOS) {
      executeScenario(scenario);
    }

    printSuccess('所有样例数据已导入完成');
  });

function parseDefects(defectStr: string): Defect[] {
  if (!defectStr || defectStr === 'NONE') {
    return [{ level: 'NONE', count: 0 }];
  }

  const defects: Defect[] = [];
  const parts = defectStr.split(';');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const [levelPart, rest] = trimmed.split(':', 2);
    const level = levelPart.trim().toUpperCase() as any;
    const [countPart, descPart] = (rest || '1').split(',', 2);
    const count = parseInt(countPart.trim(), 10) || 1;
    const description = descPart ? descPart.trim() : undefined;

    if (['CRITICAL', 'MAJOR', 'MINOR', 'NONE'].includes(level)) {
      defects.push({ level, count, description });
    }
  }

  return defects.length > 0 ? defects : [{ level: 'NONE', count: 0 }];
}

program
  .command('create <batchNumber>')
  .description('创建新批次')
  .requiredOption('-p, --product <code>', '产品代码')
  .requiredOption('-n, --name <name>', '产品名称')
  .requiredOption('-q, --quantity <number>', '数量')
  .requiredOption('-d, --date <date>', '生产日期 (YYYY-MM-DD)')
  .requiredOption('-l, --line <line>', '生产线')
  .action((batchNumber: string, options) => {
    printTitle('创建批次');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const result = createBatch({
      batchNumber,
      productCode: options.product,
      productName: options.name,
      quantity: parseInt(options.quantity, 10),
      productionDate: options.date,
      productionLine: options.line
    });

    if (result.success && result.data) {
      printSuccess(result.message);
      console.log(`  批次号: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  产品: ${result.data.productName} (${result.data.productCode})`);
      console.log(`  数量: ${result.data.quantity} 件`);
      console.log(`  当前状态: ${formatStatus(result.data.status)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

program
  .command('inspect <batchNumber>')
  .description('记录初检结果')
  .requiredOption('-s, --sheet <number>', '抽样单号')
  .requiredOption('-c, --sample-count <number>', '抽样数量')
  .option('--defects <defects>', '缺陷列表 (格式: LEVEL:count,描述;...)', 'NONE')
  .requiredOption('-i, --inspector <name>', '检验员')
  .option('--notes <text>', '备注')
  .action((batchNumber: string, options) => {
    printTitle('记录初检');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const defects = parseDefects(options.defects);
    
    const result = recordInitialInspection({
      batchNumber,
      sheetNumber: options.sheet,
      sampleCount: parseInt(options.sampleCount, 10),
      defects,
      inspector: options.inspector,
      notes: options.notes
    });

    if (result.success && result.data) {
      printSuccess(result.message, result.warnings);
      console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  抽样单: ${options.sheet}`);
      console.log(`  当前状态: ${formatStatus(result.data.status)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

program
  .command('reinspect <batchNumber>')
  .description('记录复检结果')
  .requiredOption('-s, --sheet <number>', '抽样单号')
  .requiredOption('-c, --sample-count <number>', '抽样数量')
  .option('--defects <defects>', '缺陷列表 (格式: LEVEL:count,描述;...)', 'NONE')
  .requiredOption('-i, --inspector <name>', '检验员')
  .option('--notes <text>', '备注')
  .action((batchNumber: string, options) => {
    printTitle('记录复检');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const defects = parseDefects(options.defects);
    
    const result = recordReinspection({
      batchNumber,
      sheetNumber: options.sheet,
      sampleCount: parseInt(options.sampleCount, 10),
      defects,
      inspector: options.inspector,
      notes: options.notes
    });

    if (result.success && result.data) {
      printSuccess(result.message, result.warnings);
      console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  当前状态: ${formatStatus(result.data.status)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

program
  .command('concession <batchNumber>')
  .description('申请让步放行')
  .requiredOption('--reason <text>', '申请原因')
  .requiredOption('--justification <text>', '理由说明')
  .requiredOption('--risk <level>', '风险等级 (HIGH|MEDIUM|LOW)')
  .requiredOption('--requester <name>', '申请人')
  .action((batchNumber: string, options) => {
    printTitle('申请让步放行');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const risk = options.risk.toUpperCase();
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(risk)) {
      printError('无效的风险等级', ['风险等级必须是: HIGH, MEDIUM, 或 LOW']);
      process.exit(1);
    }

    const result = requestConcession({
      batchNumber,
      reason: options.reason,
      justification: options.justification,
      riskLevel: risk as any,
      requestedBy: options.requester
    });

    if (result.success && result.data) {
      printSuccess(result.message);
      console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  当前状态: ${formatStatus(result.data.status)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

program
  .command('approve <batchNumber>')
  .description('审批让步放行')
  .option('--type <type>', '审批类型 (concession|rework)', 'concession')
  .requiredOption('--approver <name>', '审批人')
  .option('--notes <text>', '审批意见')
  .option('--reason <text>', '返工原因 (rework类型时必填)')
  .action((batchNumber: string, options) => {
    printTitle('审批操作');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    if (options.type === 'rework') {
      if (!options.reason) {
        printError('缺少必填参数', ['返工审批需要提供 --reason 参数']);
        process.exit(1);
      }
      
      const result = approveRework({
        batchNumber,
        approvedBy: options.approver,
        reason: options.reason
      });

      if (result.success && result.data) {
        printSuccess(result.message);
        console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
        console.log(`  当前状态: ${formatStatus(result.data.status)}`);
      } else {
        printError(result.message, result.errors);
        process.exit(1);
      }
    } else {
      const result = approveConcession({
        batchNumber,
        approvedBy: options.approver,
        approvalNotes: options.notes
      });

      if (result.success && result.data) {
        printSuccess(result.message);
        console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
        console.log(`  当前状态: ${formatStatus(result.data.status)}`);
      } else {
        printError(result.message, result.errors);
        process.exit(1);
      }
    }
  });

program
  .command('close <batchNumber>')
  .description('关闭批次')
  .requiredOption('--by <name>', '关闭人')
  .option('--reason <text>', '关闭原因')
  .action((batchNumber: string, options) => {
    printTitle('关闭批次');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const result = closeBatch({
      batchNumber,
      closedBy: options.by,
      reason: options.reason
    });

    if (result.success && result.data) {
      printSuccess(result.message);
      console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  最终状态: ${formatStatus(result.data.status)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('查看所有批次列表')
  .action(() => {
    printTitle('批次列表');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const batches = getAllBatches();
    printBatchList(batches);
  });

program
  .command('detail <batchNumber>')
  .description('查看批次详情')
  .action((batchNumber: string) => {
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const batch = getBatch(batchNumber);
    if (!batch) {
      printError(`批次不存在: ${batchNumber}`);
      process.exit(1);
    }

    printBatchSummary(batch);
  });

program
  .command('report')
  .description('生成质量汇总报告')
  .action(() => {
    printTitle('质量汇总报告');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const batches = getAllBatches();
    printReport(batches);
  });

program
  .command('correct <batchNumber>')
  .description('人工修正（需记录差异）')
  .requiredOption('--by <name>', '操作人')
  .requiredOption('--field <field>', '要修改的字段')
  .requiredOption('--old <value>', '原值')
  .requiredOption('--new <value>', '新值')
  .requiredOption('--reason <text>', '修改原因')
  .action((batchNumber: string, options) => {
    printTitle('人工修正');
    
    if (!storeExists()) {
      printError('数据仓库未初始化', ['请先运行: qc init']);
      process.exit(1);
    }

    const result = manualCorrection({
      batchNumber,
      correctedBy: options.by,
      field: options.field,
      oldValue: options.old,
      newValue: options.new,
      reason: options.reason
    });

    if (result.success && result.data) {
      printSuccess(result.message, result.warnings);
      console.log(`  批次: ${chalk.cyan(result.data.batchNumber)}`);
      console.log(`  修改字段: ${options.field}`);
      console.log(`  差异: ${chalk.red(options.old)} → ${chalk.green(options.new)}`);
    } else {
      printError(result.message, result.errors);
      process.exit(1);
    }
  });

function executeScenario(scenario: SampleScenario): void {
  console.log(chalk.bold(`\n  ── 执行场景: ${scenario.name} ──`));
  console.log(`  ${scenario.description}\n`);

  let result = createBatch({
    batchNumber: scenario.batchNumber,
    productCode: scenario.productCode,
    productName: scenario.productName,
    quantity: scenario.quantity,
    productionDate: scenario.productionDate,
    productionLine: scenario.productionLine
  });
  console.log(`  [1/5] 创建批次: ${result.success ? '✓' : '✗'} ${result.message}`);

  result = recordInitialInspection({
    batchNumber: scenario.batchNumber,
    sheetNumber: scenario.initialInspection.sheetNumber,
    sampleCount: scenario.initialInspection.sampleCount,
    defects: scenario.initialInspection.defects,
    inspector: scenario.initialInspection.inspector,
    notes: scenario.initialInspection.notes
  });
  console.log(`  [2/5] 记录初检: ${result.success ? '✓' : '✗'} ${result.message}`);

  if (scenario.reinspection) {
    result = recordReinspection({
      batchNumber: scenario.batchNumber,
      sheetNumber: scenario.reinspection.sheetNumber,
      sampleCount: scenario.reinspection.sampleCount,
      defects: scenario.reinspection.defects,
      inspector: scenario.reinspection.inspector,
      notes: scenario.reinspection.notes
    });
    console.log(`  [3/5] 记录复检: ${result.success ? '✓' : '✗'} ${result.message}`);
  }

  if (scenario.concession) {
    result = requestConcession({
      batchNumber: scenario.batchNumber,
      reason: scenario.concession.reason,
      justification: scenario.concession.justification,
      riskLevel: scenario.concession.riskLevel,
      requestedBy: scenario.concession.requestedBy
    });
    console.log(`  [4a/5] 申请让步放行: ${result.success ? '✓' : '✗'} ${result.message}`);

    result = approveConcession({
      batchNumber: scenario.batchNumber,
      approvedBy: scenario.concession.approvedBy,
      approvalNotes: scenario.concession.approvalNotes
    });
    console.log(`  [4b/5] 批准让步放行: ${result.success ? '✓' : '✗'} ${result.message}`);
  }

  if (scenario.rework) {
    result = approveRework({
      batchNumber: scenario.batchNumber,
      approvedBy: scenario.rework.approvedBy,
      reason: scenario.rework.reason
    });
    console.log(`  [4/5] 批准返工: ${result.success ? '✓' : '✗'} ${result.message}`);
  }

  result = closeBatch({
    batchNumber: scenario.batchNumber,
    closedBy: scenario.closedBy,
    reason: `${scenario.name}流程完成`
  });
  console.log(`  [5/5] 关闭批次: ${result.success ? '✓' : '✗'} ${result.message}`);
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
