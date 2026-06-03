#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as path from 'path';
import { boundarySampleManager } from '../core/boundarySampleManager';
import { importManualCounterExamples, importQuestionnaireRows, loadSampleData, saveJSON } from '../core/dataImporter';
import { formatBoundaryReport, saveReportToFile } from '../core/reportGenerator';
import { calculateQueueMetrics } from '../core/queueCalculator';
import { WindowConfig, QuestionnaireRow, ManualCounterExample } from '../types';

const program = new Command();

const defaultWindowConfigs: WindowConfig[] = [
  {
    windowNumber: 1,
    startTime: '08:00',
    endTime: '18:00',
    capacity: 3,
    isActive: true,
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
  },
  {
    windowNumber: 2,
    startTime: '08:00',
    endTime: '18:00',
    capacity: 2,
    isActive: true,
    hasLunchBreak: true,
    lunchStartTime: '12:30',
    lunchEndTime: '13:30',
  },
  {
    windowNumber: 3,
    startTime: '09:00',
    endTime: '17:00',
    capacity: 1,
    isActive: true,
    hasLunchBreak: false,
  },
];

program
  .name('queue-config')
  .description('排队论窗口配置系统 - 整合手算反例与问卷原始行，支持边界样本复核流程')
  .version('1.0.0');

program
  .command('import')
  .description('导入数据并检测边界样本')
  .option('-m, --manual <path>', '手算反例JSON文件路径')
  .option('-q, --questionnaire <path>', '问卷原始行JSON文件路径')
  .option('-d, --data-dir <path>', '数据目录路径', './data')
  .action(async (options) => {
    console.log(chalk.blue('=== 开始导入数据 ===\n'));
    
    boundarySampleManager.clear();
    
    let manualExamples: ManualCounterExample[];
    let questionnaireRows: QuestionnaireRow[];
    
    if (options.manual || options.questionnaire) {
      if (options.manual) {
        const manualPath = path.resolve(options.manual);
        console.log(chalk.gray(`导入手算反例: ${manualPath}`));
        manualExamples = importManualCounterExamples(manualPath);
      } else {
        manualExamples = [];
      }
      
      if (options.questionnaire) {
        const qPath = path.resolve(options.questionnaire);
        console.log(chalk.gray(`导入问卷原始行: ${qPath}`));
        questionnaireRows = importQuestionnaireRows(qPath);
      } else {
        questionnaireRows = [];
      }
    } else {
      const dataDir = path.resolve(options.dataDir);
      console.log(chalk.gray(`从数据目录加载: ${dataDir}`));
      const data = loadSampleData(dataDir);
      manualExamples = data.manualCounterExamples;
      questionnaireRows = data.questionnaireRows;
    }
    
    console.log(chalk.green(`✓ 导入手算反例: ${manualExamples.length} 条`));
    console.log(chalk.green(`✓ 导入问卷原始行: ${questionnaireRows.length} 条\n`));
    
    console.log(chalk.blue('=== 检测负数样本 ===\n'));
    const negativeSamples = boundarySampleManager.detectNegativeSamples(manualExamples, questionnaireRows);
    
    console.log(chalk.yellow(`检测到 ${negativeSamples.length} 个负数样本\n`));
    
    for (const ns of negativeSamples) {
      const manual = manualExamples.find(m => m.sampleId === ns.sampleId);
      const questionnaire = questionnaireRows.find(q => q.sampleId === ns.sampleId);
      boundarySampleManager.createBoundarySample(ns, manual, questionnaire);
      
      console.log(`  ${chalk.cyan(ns.sampleId)}: ${ns.reason}`);
      if (ns.isMarkedAsMissing) {
        console.log(`    ${chalk.red('⚠️  旧表标记为缺失，待学生助教复核')}`);
      }
    }
    
    console.log(chalk.green(`\n✓ 创建 ${negativeSamples.length} 个边界样本`));
    
    const report = boundarySampleManager.generateReport();
    console.log(chalk.green(`✓ 边界样本报告已生成`));
    console.log(chalk.gray(`  使用 queue-config report 查看详细报告\n`));
    
    printReportSummary(report);
  });

program
  .command('report')
  .description('生成边界样本报告')
  .option('-o, --output <path>', '输出文件路径')
  .option('-f, --format <format>', '输出格式: txt|html', 'txt')
  .action(async (options) => {
    console.log(chalk.blue('=== 生成边界样本报告 ===\n'));
    
    const report = boundarySampleManager.generateReport();
    
    if (options.output) {
      const outputPath = path.resolve(options.output);
      saveReportToFile(report, outputPath, options.format);
      console.log(chalk.green(`✓ 报告已保存到: ${outputPath}\n`));
    } else {
      console.log(formatBoundaryReport(report));
      console.log('');
    }
  });

program
  .command('list')
  .description('列出所有边界样本')
  .option('-s, --status <status>', '按状态筛选: pending_ta|pending_coach|coach_verified')
  .action(async (options) => {
    console.log(chalk.blue('=== 边界样本列表 ===\n'));
    
    let samples;
    if (options.status) {
      samples = boundarySampleManager.getBoundarySamplesByStatus(options.status);
    } else {
      samples = boundarySampleManager.getAllBoundarySamples();
    }
    
    if (samples.length === 0) {
      console.log(chalk.yellow('暂无边界样本'));
      return;
    }
    
    const table = new Table({
      head: ['样本ID', '状态', '异常原因', '当前负责人'],
      colWidths: [20, 18, 40, 15],
      wordWrap: true,
    });
    
    const statusColors: Record<string, (s: string) => string> = {
      pending_ta: chalk.yellow,
      pending_coach: chalk.blue,
      coach_verified: chalk.green,
      resolved: chalk.green,
      dismissed: chalk.red,
    };
    
    const statusLabels: Record<string, string> = {
      pending_ta: '待学生助教',
      pending_coach: '待唐老师',
      coach_verified: '已确认',
      resolved: '已解决',
      dismissed: '已驳回',
    };
    
    for (const sample of samples) {
      const colorFn = statusColors[sample.status] || chalk.gray;
      table.push([
        sample.sampleId,
        colorFn(statusLabels[sample.status] || sample.status),
        sample.negativeSample.reason,
        sample.assignee || '-',
      ]);
    }
    
    console.log(table.toString());
    console.log('');
  });

program
  .command('ta-review')
  .description('学生助教复核样本')
  .argument('<sampleId>', '样本ID')
  .requiredOption('-v, --verified <true|false>', '是否验证通过')
  .option('-n, --notes <text>', '复核备注')
  .option('-q, --questionnaire <path>', '补充问卷原始行JSON路径')
  .action(async (sampleId, options) => {
    console.log(chalk.blue(`=== 学生助教复核: ${sampleId} ===\n`));
    
    let supplementaryQ: QuestionnaireRow | undefined;
    if (options.questionnaire) {
      const qPath = path.resolve(options.questionnaire);
      const rows = importQuestionnaireRows(qPath);
      supplementaryQ = rows.find(r => r.sampleId === sampleId);
      if (supplementaryQ) {
        console.log(chalk.green(`✓ 已加载补充问卷原始行`));
      }
    }
    
    const verified = options.verified === 'true';
    const result = boundarySampleManager.taReview(
      sampleId,
      verified,
      options.notes || '',
      supplementaryQ
    );
    
    if (result) {
      console.log(chalk.green(`✓ 复核完成`));
      console.log(`  新状态: ${result.status}`);
      console.log(`  下一步: ${result.nextAction}`);
      if (result.assignee) {
        console.log(`  负责人: ${result.assignee}`);
      }
    } else {
      console.log(chalk.red(`✗ 复核失败: 样本不存在或状态不允许复核`));
    }
    console.log('');
  });

program
  .command('coach-review')
  .description('竞赛教练唐老师复核样本')
  .argument('<sampleId>', '样本ID')
  .requiredOption('-v, --verified <true|false>', '是否验证通过')
  .option('-n, --notes <text>', '复核备注')
  .action(async (sampleId, options) => {
    console.log(chalk.blue(`=== 唐老师复核: ${sampleId} ===\n`));
    
    const verified = options.verified === 'true';
    const result = boundarySampleManager.coachReview(
      sampleId,
      verified,
      options.notes || ''
    );
    
    if (result) {
      console.log(chalk.green(`✓ 复核完成`));
      console.log(`  新状态: ${result.status}`);
      console.log(`  下一步: ${result.nextAction}`);
      if (result.assignee) {
        console.log(`  负责人: ${result.assignee}`);
      }
    } else {
      console.log(chalk.red(`✗ 复核失败: 样本不存在或状态不允许复核`));
    }
    console.log('');
  });

program
  .command('calculate')
  .description('计算排队指标')
  .option('-w, --window <number>', '窗口号', '1')
  .option('-t, --time <time>', '时间点 (HH:MM)', '10:00')
  .option('-a, --arrival <number>', '到达人数', '10')
  .option('-s, --service <number>', '平均服务时间(分钟)', '5')
  .action(async (options) => {
    console.log(chalk.blue('=== 排队指标计算 ===\n'));
    
    const windowNumber = parseInt(options.window);
    const windowConfig = defaultWindowConfigs.find(w => w.windowNumber === windowNumber) || defaultWindowConfigs[0];
    const [hours, minutes] = options.time.split(':').map(Number);
    const timestamp = new Date();
    timestamp.setHours(hours, minutes, 0, 0);
    
    const result = calculateQueueMetrics(
      'calc_' + Date.now(),
      windowNumber,
      timestamp,
      parseInt(options.arrival),
      parseInt(options.service),
      windowConfig
    );
    
    console.log(`窗口配置: #${windowNumber}`);
    console.log(`时间: ${options.time}`);
    console.log(`到达率: ${result.arrivalRate} 人/小时`);
    console.log(`服务率: ${result.serviceRate.toFixed(2)} 人/小时`);
    console.log(`平均等待时间: ${result.averageWaitTime} 分钟`);
    console.log(`队列长度: ${result.queueLength} 人`);
    console.log(`是否溢出: ${result.isOverflow ? chalk.red('是') : chalk.green('否')}`);
    console.log('');
    console.log(chalk.blue('影响因素:'));
    console.log(`  午休影响: ${(result.factors.lunchBreakImpact * 100).toFixed(0)}%`);
    console.log(`  临时关窗影响: ${(result.factors.temporaryClosureImpact * 100).toFixed(0)}%`);
    console.log(`  排队溢出影响: ${(result.factors.queueOverflowImpact * 100).toFixed(0)}%`);
    console.log('');
  });

program
  .command('web')
  .description('启动Web小看板')
  .option('-p, --port <number>', '端口号', '3000')
  .action(async (options) => {
    console.log(chalk.blue('=== 启动Web小看板 ===\n'));
    const port = parseInt(options.port);
    
    const { startWebServer } = await import('../web/server');
    startWebServer(port, boundarySampleManager, defaultWindowConfigs);
  });

program
  .command('demo')
  .description('运行完整演示流程')
  .action(async () => {
    console.log(chalk.blue('=== 排队论窗口配置 - 完整演示 ===\n'));
    
    console.log(chalk.cyan('第一步: 导入手算反例，检测负数样本'));
    console.log(chalk.gray('  模拟: 第一次导入，发现旧表把负数样本当成缺失\n'));
    
    boundarySampleManager.clear();
    
    const demoManualData = [
      {
        sampleId: 'SAMPLE-001',
        timestamp: '2024-01-15T10:30:00',
        windowNumber: 1,
        arrivalCount: 15,
        serviceTime: 8,
        waitTime: -5,
        source: 'old_table' as const,
        mainProcessEvidence: '主流程步骤3异常，系统记录等待时间为负',
      },
      {
        sampleId: 'SAMPLE-002',
        timestamp: '2024-01-15T14:00:00',
        windowNumber: 2,
        arrivalCount: -3,
        serviceTime: 5,
        waitTime: 12,
        source: 'old_table' as const,
        mainProcessEvidence: '到达人数统计异常',
      },
      {
        sampleId: 'SAMPLE-003',
        timestamp: '2024-01-15T11:00:00',
        windowNumber: 1,
        arrivalCount: 20,
        serviceTime: 6,
        waitTime: 8,
        source: 'manual' as const,
      },
    ];
    
    const manualExamples = demoManualData.map(raw => ({
      id: 'mce_' + raw.sampleId,
      sampleId: raw.sampleId,
      timestamp: new Date(raw.timestamp),
      windowNumber: raw.windowNumber,
      arrivalCount: raw.arrivalCount,
      serviceTime: raw.serviceTime,
      waitTime: raw.waitTime,
      isNegative: raw.waitTime < 0 || raw.arrivalCount < 0,
      source: raw.source,
      mainProcessEvidence: raw.mainProcessEvidence,
    }));
    
    const negativeSamples = boundarySampleManager.detectNegativeSamples(manualExamples, []);
    for (const ns of negativeSamples) {
      const manual = manualExamples.find(m => m.sampleId === ns.sampleId);
      boundarySampleManager.createBoundarySample(ns, manual, undefined);
    }
    
    console.log(chalk.yellow(`  检测到 ${negativeSamples.length} 个负数样本，待学生助教复核\n`));
    
    console.log(chalk.cyan('第二步: 学生助教补录问卷原始行'));
    console.log(chalk.gray('  模拟: 学生助教补充现场说法数据\n'));
    
    const demoQuestionnaireData = [
      {
        sampleId: 'SAMPLE-001',
        timestamp: '2024-01-15T10:30:00',
        windowNumber: 1,
        onSiteStatement: '窗口1在10:20-10:40临时关闭处理紧急事务，实际等待时间应为15分钟',
        witnessName: '张三',
        hasBreak: false,
        isTemporaryClosed: true,
        queueOverflow: false,
        actualWaitTime: 15,
        actualArrivalCount: 15,
      },
      {
        sampleId: 'SAMPLE-002',
        timestamp: '2024-01-15T14:00:00',
        windowNumber: 2,
        onSiteStatement: '下午2点窗口2排队溢出，队伍排到门外，系统统计出错',
        witnessName: '李四',
        hasBreak: false,
        isTemporaryClosed: false,
        queueOverflow: true,
        actualWaitTime: 25,
        actualArrivalCount: 25,
      },
    ];
    
    const questionnaireRows = demoQuestionnaireData.map(raw => ({
      id: 'qr_' + raw.sampleId,
      sampleId: raw.sampleId,
      timestamp: new Date(raw.timestamp),
      windowNumber: raw.windowNumber,
      onSiteStatement: raw.onSiteStatement,
      witnessName: raw.witnessName,
      hasBreak: raw.hasBreak,
      isTemporaryClosed: raw.isTemporaryClosed,
      queueOverflow: raw.queueOverflow,
      actualWaitTime: raw.actualWaitTime,
      actualArrivalCount: raw.actualArrivalCount,
    }));
    
    boundarySampleManager.taReview('SAMPLE-001', true, '已核实现场说法，数据合理', questionnaireRows[0]);
    boundarySampleManager.taReview('SAMPLE-002', true, '排队溢出情况属实，数据已修正', questionnaireRows[1]);
    
    console.log(chalk.green('  ✓ 学生助教已补充问卷原始行并完成初步复核\n'));
    
    console.log(chalk.cyan('第三步: 竞赛教练唐老师最终确认，边界样本报告更新'));
    console.log(chalk.gray('  模拟: 唐老师复核后生成最终报告\n'));
    
    boundarySampleManager.coachReview('SAMPLE-001', true, '临时关窗情况确认，该样本保留用于窗口排班优化分析');
    boundarySampleManager.coachReview('SAMPLE-002', true, '排队溢出情况属实，建议该时段增加窗口');
    
    console.log(chalk.green('  ✓ 唐老师已完成最终确认\n'));
    
    const report = boundarySampleManager.generateReport();
    console.log(chalk.blue('=== 最终边界样本报告 ===\n'));
    console.log(formatBoundaryReport(report));
    
    console.log(chalk.green('\n=== 演示完成 ==='));
    console.log(chalk.gray('  你可以使用以下命令继续探索:'));
    console.log(chalk.gray('  - queue-config web: 启动可视化小看板'));
    console.log(chalk.gray('  - queue-config report: 查看完整报告'));
    console.log(chalk.gray('  - queue-config list: 列出所有样本\n'));
  });

function printReportSummary(report: { statistics: { total: number; pendingTa: number; pendingCoach: number; verified: number; resolved: number } }) {
  const table = new Table({
    head: ['总样本', '待学生助教', '待唐老师', '已确认', '已解决'],
  });
  table.push([
    report.statistics.total,
    report.statistics.pendingTa,
    report.statistics.pendingCoach,
    report.statistics.verified,
    report.statistics.resolved,
  ]);
  console.log(table.toString());
}

if (require.main === module) {
  program.parse();
}

export { program };
