#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as path from 'path';
import { boundarySampleManager, STATUS_LABEL } from '../core/boundarySampleManager';
import { importManualCounterExamples, importQuestionnaireRows, loadSampleData } from '../core/dataImporter';
import { formatBoundaryReport, saveReportToFile } from '../core/reportGenerator';
import { calculateQueueMetrics } from '../core/queueCalculator';
import { WindowConfig, QuestionnaireRow, ManualCounterExample, ReviewResult, ReviewStatus } from '../types';
import { stateStore } from '../core/stateStore';

const program = new Command();

const defaultWindowConfigs: WindowConfig[] = [
  { windowNumber: 1, startTime: '08:00', endTime: '18:00', capacity: 3, isActive: true, hasLunchBreak: true, lunchStartTime: '12:00', lunchEndTime: '13:00' },
  { windowNumber: 2, startTime: '08:00', endTime: '18:00', capacity: 2, isActive: true, hasLunchBreak: true, lunchStartTime: '12:30', lunchEndTime: '13:30' },
  { windowNumber: 3, startTime: '09:00', endTime: '17:00', capacity: 1, isActive: true, hasLunchBreak: false },
];

program
  .name('queue-config')
  .description('排队论窗口配置系统 - 整合手算反例与问卷原始行，支持边界样本复核流程')
  .option('--state <path>', '状态存储文件路径', 'data/app-state.json')
  .version('1.0.0');

function ensureStateLoaded(): void {
  const opts = program.opts();
  if (opts.state) stateStore.setStatePath(path.resolve(opts.state));
  stateStore.load(true);
}

function printStats(stats: { total: number; pendingTa: number; pendingCoach: number; verified: number; resolved: number }): void {
  const table = new Table({ head: ['总样本', '待学生助教', '待唐老师', '已确认', '已解决'] });
  table.push([stats.total, stats.pendingTa, stats.pendingCoach, stats.verified, stats.resolved]);
  console.log(table.toString());
}

function printReviewError(result: ReviewResult, kind: 'ta' | 'coach'): void {
  console.log(chalk.red(`✗ ${result.errorMessage}`));
  console.log('');
  if (result.hints && result.hints.length > 0) {
    console.log(chalk.yellow('  建议操作：'));
    result.hints.forEach((h, i) => console.log(chalk.yellow(`    ${i + 1}. ${h}`)));
    console.log('');
  }
  console.log(chalk.gray(`  状态文件: ${stateStore.getStatePath()}`));
  console.log(chalk.gray(`  当前总样本数: ${boundarySampleManager.getAllBoundarySamples().length}`));
  const all = boundarySampleManager.getAllBoundarySamples();
  if (all.length > 0) {
    console.log(chalk.gray('  可用样本ID：'));
    all.forEach((s) => {
      const label = STATUS_LABEL[s.status] || s.status;
      const mark = kind === 'coach' && s.status === 'pending_coach' ? '  ✅可唐老师复核'
        : kind === 'ta' && (s.status === 'pending_ta' || s.status === 'dismissed') ? '  ✅可学生助教复核'
        : '';
      console.log(chalk.gray(`    - ${s.sampleId} (${label})${mark}`));
    });
  }
  console.log('');
}

function printSampleCard(sample: { sampleId: string; status: ReviewStatus; negativeSample: { reason: string; isMarkedAsMissing: boolean }; assignee?: string; missingMaterials: string[] }): void {
  const statusColor: Record<ReviewStatus, (s: string) => string> = {
    pending_ta: chalk.yellow,
    ta_verified: chalk.cyan,
    pending_coach: chalk.blue,
    coach_verified: chalk.green,
    resolved: chalk.green,
    dismissed: chalk.red,
  };
  const color = statusColor[sample.status] || chalk.gray;
  const missingBadge = sample.missingMaterials.length > 0 ? chalk.red(` [缺${sample.missingMaterials.length}项]`) : chalk.green(' [全]');

  console.log(chalk.bold(`  📌 ${sample.sampleId}`) + missingBadge);
  console.log(`     状态: ${color(STATUS_LABEL[sample.status] || sample.status)}`);
  console.log(`     原因: ${sample.negativeSample.reason}`);
  if (sample.negativeSample.isMarkedAsMissing) console.log(chalk.red(`     ⚠️  旧表当成缺失`));
  if (sample.assignee) console.log(`     负责人: ${sample.assignee}`);
}

// -------------------- import --------------------
program
  .command('import')
  .description('导入数据并检测边界样本')
  .option('-m, --manual <path>', '手算反例JSON文件路径')
  .option('-q, --questionnaire <path>', '问卷原始行JSON文件路径')
  .option('-d, --data-dir <path>', '数据目录路径', './data')
  .option('--clear', '导入前清空所有数据', false)
  .action(async (options) => {
    ensureStateLoaded();
    console.log(chalk.blue('=== 开始导入数据 ===\n'));

    if (options.clear) {
      stateStore.clearAll();
      console.log(chalk.gray('已清空旧数据\n'));
    }

    let manualExamples: ManualCounterExample[];
    let questionnaireRows: QuestionnaireRow[];

    if (options.manual || options.questionnaire) {
      manualExamples = options.manual ? importManualCounterExamples(path.resolve(options.manual)) : [];
      questionnaireRows = options.questionnaire ? importQuestionnaireRows(path.resolve(options.questionnaire)) : [];
    } else {
      const data = loadSampleData(path.resolve(options.dataDir));
      manualExamples = data.manualCounterExamples;
      questionnaireRows = data.questionnaireRows;
    }

    stateStore.addManualCounterExamples(manualExamples);
    stateStore.addQuestionnaireRows(questionnaireRows);

    console.log(chalk.green(`✓ 手算反例: ${manualExamples.length} 条`));
    console.log(chalk.green(`✓ 问卷原始行: ${questionnaireRows.length} 条\n`));

    console.log(chalk.blue('=== 检测负数样本 ===\n'));
    const allManual = stateStore.getManualCounterExamples();
    const allQ = stateStore.getQuestionnaireRows();
    const negativeSamples = boundarySampleManager.detectNegativeSamples(allManual, allQ);
    console.log(chalk.yellow(`检测到 ${negativeSamples.length} 个负数样本\n`));

    for (const ns of negativeSamples) {
      const manual = allManual.find((m) => m.sampleId === ns.sampleId);
      const questionnaire = allQ.find((q) => q.sampleId === ns.sampleId);
      const existing = boundarySampleManager.findBySampleId(ns.sampleId);
      if (!existing) {
        boundarySampleManager.createBoundarySample(ns, manual, questionnaire);
        stateStore.addHistoryEntry({
          sampleId: ns.sampleId,
          action: 'created',
          operator: ns.detectedBy === 'old_table' ? '旧表系统' : '系统',
          reason: ns.reason,
          statusAfter: 'pending_ta',
        });
      }
    }

    const samples = boundarySampleManager.getAllBoundarySamples();
    samples.forEach((s) => stateStore.upsertBoundarySample(s));
    stateStore.addHistoryEntry({
      sampleId: '*',
      action: 'data_import',
      operator: '用户',
      reason: `导入完成，创建/更新 ${samples.length} 条边界样本`,
    });
    stateStore.save();

    const created = samples.length;
    console.log(chalk.green(`\n✓ 创建/更新 ${created} 个边界样本\n`));

    samples.forEach(printSampleCard);

    const report = boundarySampleManager.generateReport();
    printStats(report.statistics);
    console.log('');
    console.log(chalk.gray(`  状态文件: ${stateStore.getStatePath()}`));
    console.log(chalk.gray(`  后续命令：queue-config list / queue-config ta-review / queue-config report\n`));
  });

// -------------------- list --------------------
program
  .command('list')
  .description('列出所有边界样本')
  .option('-s, --status <status>', '按状态筛选: pending_ta|pending_coach|coach_verified|dismissed')
  .option('--long', '显示详细卡片', false)
  .action(async (options) => {
    ensureStateLoaded();
    console.log(chalk.blue('=== 边界样本列表 ===\n'));

    let samples = boundarySampleManager.getAllBoundarySamples();
    if (options.status) samples = samples.filter((s) => s.status === options.status);

    if (samples.length === 0) {
      console.log(chalk.yellow('总样本数: 0（尚无边界样本）'));
      console.log('');
      console.log(chalk.gray('  请先运行: queue-config import'));
      console.log(chalk.gray(`  状态文件: ${stateStore.getStatePath()}`));
      return;
    }

    if (options.long) {
      samples.forEach(printSampleCard);
      console.log('');
    } else {
      const table = new Table({
        head: ['样本ID', '状态', '异常原因', '负责人', '缺项数'],
        colWidths: [18, 18, 40, 14, 8],
        wordWrap: true,
      });
      for (const sample of samples) {
        const color = (() => {
          const m: Record<ReviewStatus, (s: string) => string> = {
            pending_ta: chalk.yellow, ta_verified: chalk.cyan,
            pending_coach: chalk.blue, coach_verified: chalk.green,
            resolved: chalk.green, dismissed: chalk.red,
          };
          return m[sample.status] || chalk.gray;
        })();
        table.push([
          sample.sampleId,
          color(STATUS_LABEL[sample.status] || sample.status),
          sample.negativeSample.reason,
          sample.assignee || '-',
          sample.missingMaterials.length,
        ]);
      }
      console.log(table.toString());
    }

    const report = boundarySampleManager.generateReport();
    printStats(report.statistics);
    console.log('');
  });

// -------------------- history --------------------
program
  .command('history')
  .description('查看复核历史')
  .argument('[sampleId]', '样本ID（省略显示全部）')
  .action(async (sampleId) => {
    ensureStateLoaded();
    console.log(chalk.blue('=== 复核历史记录 ===\n'));
    const history = stateStore.getHistory(sampleId);
    if (history.length === 0) {
      console.log(chalk.yellow('暂无历史记录'));
      return;
    }
    for (const h of history) {
      const time = new Date(h.timestamp).toLocaleString('zh-CN');
      const statusPart =
        h.statusBefore && h.statusAfter
          ? chalk.cyan(` [${STATUS_LABEL[h.statusBefore]} → ${STATUS_LABEL[h.statusAfter]}]`)
          : '';
      console.log(`${chalk.gray(time)}  ${chalk.bold(h.operator)}  ${h.action}${statusPart}`);
      if (h.reason) console.log(chalk.gray(`    原因: ${h.reason}`));
      if (h.notes) console.log(chalk.gray(`    备注: ${h.notes}`));
    }
    console.log('');
  });

// -------------------- ta-review --------------------
program
  .command('ta-review')
  .description('学生助教复核样本')
  .argument('<sampleId>', '样本ID')
  .requiredOption('-v, --verified <true|false>', '是否验证通过')
  .option('-n, --notes <text>', '复核备注', '')
  .option('-q, --questionnaire <path>', '补充问卷原始行JSON路径')
  .action(async (sampleId, options) => {
    ensureStateLoaded();
    console.log(chalk.blue(`=== 学生助教复核: ${sampleId} ===\n`));

    let supplementaryQ: QuestionnaireRow | undefined;
    if (options.questionnaire) {
      const rows = importQuestionnaireRows(path.resolve(options.questionnaire));
      supplementaryQ = rows.find((r) => r.sampleId === sampleId);
      if (supplementaryQ) {
        console.log(chalk.green(`✓ 已加载补充问卷原始行\n`));
        stateStore.addQuestionnaireRows([supplementaryQ]);
      } else {
        console.log(chalk.yellow(`⚠ 未在问卷文件中找到 ${sampleId} 对应条目\n`));
      }
    }

    const verified = options.verified === 'true';
    const result = boundarySampleManager.taReviewV2(sampleId, verified, options.notes, supplementaryQ);

    if (!result.success || !result.sample) {
      printReviewError(result, 'ta');
      process.exitCode = 1;
      return;
    }

    stateStore.upsertBoundarySample(result.sample);
    stateStore.addHistoryEntry({
      sampleId,
      action: 'ta_review',
      operator: '学生助教',
      statusBefore: result.sample.reviewLog[result.sample.reviewLog.length - 1]?.statusBefore,
      statusAfter: result.sample.status,
      notes: options.notes,
      reason: verified ? '学生助教确认通过' : '学生助教驳回',
      rawStatementAdded: !!supplementaryQ,
    });
    stateStore.save();

    console.log(chalk.green(`✓ 复核完成`));
    console.log(`  样本ID: ${result.sample.sampleId}`);
    console.log(`  状态: ${STATUS_LABEL[result.sample.status]}`);
    console.log(`  缺项数: ${result.sample.missingMaterials.length}`);
    if (result.sample.missingMaterials.length > 0) {
      result.sample.missingMaterials.forEach((m) => console.log(chalk.red(`    ⭕ ${m}`)));
    }
    console.log(`  下一步: ${result.sample.nextAction}`);
    if (result.sample.assignee) console.log(`  负责人: ${result.sample.assignee}`);
    console.log('');
    printStats(boundarySampleManager.generateReport().statistics);
    console.log('');
  });

// -------------------- coach-review --------------------
program
  .command('coach-review')
  .description('竞赛教练唐老师复核样本')
  .argument('<sampleId>', '样本ID')
  .requiredOption('-v, --verified <true|false>', '是否验证通过')
  .option('-n, --notes <text>', '复核备注', '')
  .action(async (sampleId, options) => {
    ensureStateLoaded();
    console.log(chalk.blue(`=== 唐老师复核: ${sampleId} ===\n`));

    const verified = options.verified === 'true';
    const result = boundarySampleManager.coachReviewV2(sampleId, verified, options.notes);

    if (!result.success || !result.sample) {
      printReviewError(result, 'coach');
      process.exitCode = 1;
      return;
    }

    stateStore.upsertBoundarySample(result.sample);
    stateStore.addHistoryEntry({
      sampleId,
      action: 'coach_review',
      operator: '竞赛教练唐老师',
      statusBefore: result.sample.reviewLog[result.sample.reviewLog.length - 1]?.statusBefore,
      statusAfter: result.sample.status,
      notes: options.notes,
      reason: verified ? '唐老师确认通过' : '唐老师退回，需补充数据',
    });
    stateStore.save();

    console.log(chalk.green(`✓ 复核完成`));
    console.log(`  样本ID: ${result.sample.sampleId}`);
    console.log(`  状态: ${STATUS_LABEL[result.sample.status]}`);
    if (result.sample.dataResolution?.finalWaitTime !== undefined) {
      console.log(`  最终等待时间: ${result.sample.dataResolution.finalWaitTime}分钟`);
    }
    if (result.sample.dataResolution?.finalArrivalCount !== undefined) {
      console.log(`  最终到达人数: ${result.sample.dataResolution.finalArrivalCount}人`);
    }
    if (result.sample.dataResolution?.nextContactPerson) {
      console.log(`  后续联系: ${result.sample.dataResolution.nextContactPerson}`);
    }
    console.log(`  下一步: ${result.sample.nextAction}`);
    console.log('');
    printStats(boundarySampleManager.generateReport().statistics);
    console.log('');
  });

// -------------------- report --------------------
program
  .command('report')
  .description('生成边界样本报告')
  .option('-o, --output <path>', '输出文件路径')
  .option('-f, --format <format>', '输出格式: txt|html', 'txt')
  .option('--brief', '只显示统计摘要', false)
  .action(async (options) => {
    ensureStateLoaded();
    console.log(chalk.blue('=== 边界样本报告 ===\n'));

    const report = boundarySampleManager.generateReport();

    if (options.output) {
      const outputPath = path.resolve(options.output);
      saveReportToFile(report, outputPath, options.format);
      console.log(chalk.green(`✓ 报告已保存: ${outputPath} (${options.format})`));
      console.log('');
    }

    if (options.brief) {
      printStats(report.statistics);
      console.log('');
      console.log(chalk.gray(`  状态文件: ${stateStore.getStatePath()}`));
    } else {
      console.log(formatBoundaryReport(report));
      console.log('');
      console.log(chalk.gray(`  状态文件: ${stateStore.getStatePath()}`));
      console.log(chalk.gray(`  数据同步: 本报告基于同一份持久化状态，与 list / review 命令一致\n`));
    }
  });

// -------------------- calculate --------------------
program
  .command('calculate')
  .description('计算排队指标（考虑午休、临时关窗、排队溢出）')
  .option('-w, --window <number>', '窗口号', '1')
  .option('-t, --time <time>', '时间点 (HH:MM)', '10:00')
  .option('-a, --arrival <number>', '到达人数', '10')
  .option('-s, --service <number>', '平均服务时间(分钟)', '5')
  .action(async (options) => {
    console.log(chalk.blue('=== 排队指标计算（含现场因素） ===\n'));
    const windowNumber = parseInt(options.window);
    const windowConfig = defaultWindowConfigs.find((w) => w.windowNumber === windowNumber) || defaultWindowConfigs[0];
    const [hours, minutes] = options.time.split(':').map(Number);
    const timestamp = new Date();
    timestamp.setHours(hours, minutes, 0, 0);
    const result = calculateQueueMetrics('calc_' + Date.now(), windowNumber, timestamp, parseInt(options.arrival), parseInt(options.service), windowConfig);
    console.log(`窗口 #${windowNumber}  ${options.time}`);
    console.log(`到达率: ${result.arrivalRate} 人/小时 | 服务率: ${result.serviceRate.toFixed(2)} 人/小时`);
    console.log(`平均等待时间: ${result.averageWaitTime} 分钟 | 队列长度: ${result.queueLength} 人`);
    console.log(`是否溢出: ${result.isOverflow ? chalk.red('是') : chalk.green('否')}`);
    console.log('');
    console.log(chalk.blue('影响因素（贴近窗口排班现场）:'));
    console.log(`  午休影响: ${(result.factors.lunchBreakImpact * 100).toFixed(0)}%`);
    console.log(`  临时关窗影响: ${(result.factors.temporaryClosureImpact * 100).toFixed(0)}%`);
    console.log(`  排队溢出影响: ${(result.factors.queueOverflowImpact * 100).toFixed(0)}%`);
    console.log('');
  });

// -------------------- reset --------------------
program
  .command('reset')
  .description('清空所有持久化状态')
  .option('-y, --yes', '确认清空', false)
  .action(async (options) => {
    ensureStateLoaded();
    if (!options.yes) {
      console.log(chalk.yellow(`将清空状态文件: ${stateStore.getStatePath()}`));
      console.log(chalk.yellow('请使用 --yes 确认'));
      return;
    }
    stateStore.clearAll();
    console.log(chalk.green('✓ 已清空所有状态'));
    console.log(chalk.gray(`  总样本数: 0\n`));
  });

// -------------------- web --------------------
program
  .command('web')
  .description('启动Web小看板')
  .option('-p, --port <number>', '端口号', '3000')
  .action(async (options) => {
    ensureStateLoaded();
    console.log(chalk.blue('=== 启动Web小看板 ===\n'));
    const port = parseInt(options.port);
    const { startWebServer } = await import('../web/server');
    startWebServer(port, boundarySampleManager, defaultWindowConfigs, stateStore);
  });

// -------------------- demo --------------------
program
  .command('demo')
  .description('运行完整分步演示（每次步骤后保存到持久化状态）')
  .option('--reset', '演示前重置数据', true)
  .action(async (options) => {
    console.log(chalk.blue('=== 排队论窗口配置 - 分步演示（每次保存，可分步重复执行） ===\n'));

    if (options.reset) {
      stateStore.setStatePath(path.resolve('data/app-state.json'));
      stateStore.clearAll();
    } else {
      ensureStateLoaded();
    }

    // ====== 第一步 ======
    console.log(chalk.cyan('▌ 第一步：导入手算反例（发现负数样本被旧表当成缺失）'));
    console.log(chalk.gray('  对应命令: queue-config import --clear\n'));

    const demoManual = [
      { sampleId: 'SAMPLE-001', timestamp: '2024-01-15T10:30:00', windowNumber: 1, arrivalCount: 15, serviceTime: 8, waitTime: -5, source: 'old_table' as const, mainProcessEvidence: '主流程步骤3异常，等待时间为负，可能与临时关窗有关' },
      { sampleId: 'SAMPLE-002', timestamp: '2024-01-15T14:00:00', windowNumber: 2, arrivalCount: -3, serviceTime: 5, waitTime: 12, source: 'old_table' as const, mainProcessEvidence: '到达人数为负，怀疑排队溢出时统计出错' },
      { sampleId: 'SAMPLE-003', timestamp: '2024-01-15T11:00:00', windowNumber: 1, arrivalCount: 20, serviceTime: 6, waitTime: 8, source: 'manual' as const },
    ];
    const manualList = demoManual.map((raw) => ({
      id: 'mce_' + raw.sampleId, sampleId: raw.sampleId, timestamp: new Date(raw.timestamp),
      windowNumber: raw.windowNumber, arrivalCount: raw.arrivalCount, serviceTime: raw.serviceTime,
      waitTime: raw.waitTime, isNegative: raw.waitTime < 0 || raw.arrivalCount < 0,
      source: raw.source, mainProcessEvidence: raw.mainProcessEvidence,
    }));
    stateStore.addManualCounterExamples(manualList);

    const nsList = boundarySampleManager.detectNegativeSamples(stateStore.getManualCounterExamples(), stateStore.getQuestionnaireRows());
    nsList.forEach((ns) => {
      if (!boundarySampleManager.findBySampleId(ns.sampleId)) {
        const manual = stateStore.getManualCounterExamples().find((m) => m.sampleId === ns.sampleId);
        const q = stateStore.getQuestionnaireRows().find((x) => x.sampleId === ns.sampleId);
        boundarySampleManager.createBoundarySample(ns, manual, q);
        stateStore.addHistoryEntry({ sampleId: ns.sampleId, action: 'created', operator: '旧表系统', reason: ns.reason, statusAfter: 'pending_ta' });
      }
    });
    boundarySampleManager.getAllBoundarySamples().forEach((s) => stateStore.upsertBoundarySample(s));
    stateStore.save();

    console.log(chalk.yellow(`  检测到 ${nsList.length} 个负数样本，全部标为「待学生助教复核」`));
    nsList.forEach((ns) => {
      if (ns.isMarkedAsMissing) console.log(chalk.red(`    ⚠️  ${ns.sampleId}: ${ns.reason}（旧表当成缺失，先服务复核，不急着归正常）`));
      else console.log(`    • ${ns.sampleId}: ${ns.reason}`);
    });
    printStats(boundarySampleManager.generateReport().statistics);
    console.log('');

    // ====== 第二步 ======
    console.log(chalk.cyan('▌ 第二步：学生助教补录问卷原始行（现场说法）并复核'));
    console.log(chalk.gray('  对应命令: queue-config ta-review SAMPLE-001 -v true -n "已核实" -q data/questionnaireRows.json\n'));

    const demoQ = [
      { sampleId: 'SAMPLE-001', timestamp: '2024-01-15T10:30:00', windowNumber: 1, onSiteStatement: '窗口1在10:20-10:40临时关闭处理紧急事务，实际等待时间应为15分钟', witnessName: '张三', hasBreak: false, isTemporaryClosed: true, queueOverflow: false, actualWaitTime: 15, actualArrivalCount: 15 },
      { sampleId: 'SAMPLE-002', timestamp: '2024-01-15T14:00:00', windowNumber: 2, onSiteStatement: '下午2点窗口2排队溢出，队伍排到门外，系统统计出错', witnessName: '李四', hasBreak: false, isTemporaryClosed: false, queueOverflow: true, actualWaitTime: 25, actualArrivalCount: 25 },
    ];
    const qList = demoQ.map((raw) => ({
      id: 'qr_' + raw.sampleId, sampleId: raw.sampleId, timestamp: new Date(raw.timestamp),
      windowNumber: raw.windowNumber, onSiteStatement: raw.onSiteStatement, witnessName: raw.witnessName,
      hasBreak: raw.hasBreak, isTemporaryClosed: raw.isTemporaryClosed, queueOverflow: raw.queueOverflow,
      actualWaitTime: raw.actualWaitTime, actualArrivalCount: raw.actualArrivalCount,
    }));
    stateStore.addQuestionnaireRows(qList);

    for (const q of qList) {
      const r = boundarySampleManager.taReviewV2(q.sampleId, true, '已核实现场说法，数据合理', q);
      if (r.success && r.sample) {
        stateStore.upsertBoundarySample(r.sample);
        stateStore.addHistoryEntry({
          sampleId: q.sampleId, action: 'ta_review', operator: '学生助教',
          statusBefore: 'pending_ta', statusAfter: r.sample.status,
          notes: '已核实现场说法，数据合理', reason: '学生助教确认通过', rawStatementAdded: true,
        });
      }
    }
    stateStore.save();

    console.log(chalk.green('  ✓ SAMPLE-001: 补录临时关窗说法 → 状态 待唐老师复核'));
    console.log(chalk.green('  ✓ SAMPLE-002: 补录排队溢出说法 → 状态 待唐老师复核'));
    console.log(chalk.gray('  原始负数保留在 originalNegativeValues，未提前归入正常统计'));
    printStats(boundarySampleManager.generateReport().statistics);
    console.log('');

    // ====== 第三步 ======
    console.log(chalk.cyan('▌ 第三步：唐老师最终确认，边界样本报告跟着更新'));
    console.log(chalk.gray('  对应命令: queue-config coach-review SAMPLE-001 -v true -n "临时关窗情况确认"\n'));

    const notes1 = '临时关窗情况确认，该样本保留用于窗口排班优化分析';
    const r1 = boundarySampleManager.coachReviewV2('SAMPLE-001', true, notes1);
    if (r1.success && r1.sample) {
      stateStore.upsertBoundarySample(r1.sample);
      stateStore.addHistoryEntry({ sampleId: 'SAMPLE-001', action: 'coach_review', operator: '竞赛教练唐老师', statusBefore: 'pending_coach', statusAfter: 'coach_verified', notes: notes1, reason: '唐老师确认通过' });
    }
    const notes2 = '排队溢出情况属实，建议该时段增加窗口';
    const r2 = boundarySampleManager.coachReviewV2('SAMPLE-002', true, notes2);
    if (r2.success && r2.sample) {
      stateStore.upsertBoundarySample(r2.sample);
      stateStore.addHistoryEntry({ sampleId: 'SAMPLE-002', action: 'coach_review', operator: '竞赛教练唐老师', statusBefore: 'pending_coach', statusAfter: 'coach_verified', notes: notes2, reason: '唐老师确认通过' });
    }
    stateStore.save();

    console.log(chalk.green('  ✓ 2 条样本完成最终确认'));
    const finalReport = boundarySampleManager.generateReport();
    printStats(finalReport.statistics);
    console.log('');

    // 展示关键细节
    const s1 = boundarySampleManager.findBySampleId('SAMPLE-001');
    if (s1) {
      console.log(chalk.magenta('  以 SAMPLE-001 为例，完整数据：'));
      console.log(`    原始负数值: 等待时间=${s1.originalNegativeValues.waitTime ?? '无'} (保留)`);
      const qRow = s1.questionnaireRow;
      console.log(`    补录后值: 等待时间=${qRow?.actualWaitTime ?? '无'}  现场说法=${qRow?.onSiteStatement ?? '无'}`);
      console.log(`    为什么留下: ${s1.whyKept}`);
      console.log(`    还缺什么材料: ${s1.missingMaterials.length === 0 ? '✅ 齐全' : s1.missingMaterials.join('、')}`);
      console.log(`    下一步找谁: ${s1.dataResolution?.nextContactPerson ?? s1.assignee ?? '无'}`);
      console.log(`    复核历史共 ${s1.reviewLog.length} 条`);
    }

    console.log('');
    console.log(chalk.green('=== 演示完成 ==='));
    console.log(chalk.gray(`  数据已保存: ${stateStore.getStatePath()}`));
    console.log(chalk.gray('  你可以分步执行：'));
    console.log(chalk.gray('    1. queue-config reset -y    清空'));
    console.log(chalk.gray('    2. queue-config import      导入'));
    console.log(chalk.gray('    3. queue-config list        查看'));
    console.log(chalk.gray('    4. queue-config ta-review   学生助教'));
    console.log(chalk.gray('    5. queue-config coach-review 唐老师'));
    console.log(chalk.gray('    6. queue-config report      查看报告（摘要+详细+历史）\n'));
  });

if (require.main === module) program.parse();
export { program };
