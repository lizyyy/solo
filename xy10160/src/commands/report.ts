import chalk from 'chalk';
import {
  isInitialized,
  getCheckResultById,
  getReplayTaskById,
  getCacheRecords,
  saveReport,
  getReports,
  addHistoryEntry,
} from '../storage/store';
import {
  generateFieldMissingReport,
  generateReplayReport,
  generateCacheReport,
  generateComprehensiveReport,
} from '../services/report';
import { Report } from '../types';

export const listReportsCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const reports = getReports();
  if (reports.length === 0) {
    console.log(chalk.yellow('暂无报告'));
    return;
  }

  console.log(chalk.blue('📄 报告列表:\n'));
  reports.forEach((r, i) => {
    console.log(chalk.white(`${i + 1}. ${r.name}`));
    console.log(chalk.gray(`   ID: ${r.id}`));
    console.log(chalk.gray(`   类型: ${r.type}`));
    console.log(chalk.gray(`   路径: ${r.filePath}`));
    console.log(chalk.gray(`   创建时间: ${r.createdAt}`));
    console.log();
  });
};

export const generateReportCommand = (
  options: {
    type: Report['type'];
    name: string;
    checkResultId?: string;
    replayTaskId?: string;
    cacheRecordId?: string;
  }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    addHistoryEntry('report', '生成报告失败', 'failed', '项目未初始化');
    return;
  }

  if (!options.type) {
    console.log(chalk.red('✗ 必须指定报告类型 --type'));
    console.log(chalk.gray('   可选类型: field_missing, replay_summary, cache_summary, comprehensive'));
    addHistoryEntry('report', '生成报告失败', 'failed', '未指定类型');
    return;
  }

  if (!options.name) {
    console.log(chalk.red('✗ 必须指定报告名称 --name'));
    addHistoryEntry('report', '生成报告失败', 'failed', '未指定名称');
    return;
  }

  const validTypes: Report['type'][] = ['field_missing', 'replay_summary', 'cache_summary', 'comprehensive'];
  if (!validTypes.includes(options.type)) {
    console.log(chalk.red(`✗ 无效的报告类型: ${options.type}`));
    console.log(chalk.gray(`   可选值: ${validTypes.join(', ')}`));
    addHistoryEntry('report', '生成报告失败', 'failed', `无效类型: ${options.type}`);
    return;
  }

  try {
    let content = '';

    if (options.type === 'field_missing') {
      if (!options.checkResultId) {
        console.log(chalk.red('✗ 字段缺失报告需要 --check-result-id'));
        addHistoryEntry('report', '生成报告失败', 'failed', '缺少 check-result-id');
        return;
      }
      const result = getCheckResultById(options.checkResultId);
      if (!result) {
        console.log(chalk.red(`✗ 检查结果不存在: ${options.checkResultId}`));
        addHistoryEntry('report', '生成报告失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
        return;
      }
      content = generateFieldMissingReport(result);
    } else if (options.type === 'replay_summary') {
      if (!options.replayTaskId) {
        console.log(chalk.red('✗ 回放报告需要 --replay-task-id'));
        addHistoryEntry('report', '生成报告失败', 'failed', '缺少 replay-task-id');
        return;
      }
      const task = getReplayTaskById(options.replayTaskId);
      if (!task) {
        console.log(chalk.red(`✗ 回放任务不存在: ${options.replayTaskId}`));
        addHistoryEntry('report', '生成报告失败', 'failed', `回放任务不存在: ${options.replayTaskId}`);
        return;
      }
      content = generateReplayReport(task);
    } else if (options.type === 'cache_summary') {
      if (!options.cacheRecordId) {
        console.log(chalk.red('✗ 缓存报告需要 --cache-record-id'));
        addHistoryEntry('report', '生成报告失败', 'failed', '缺少 cache-record-id');
        return;
      }
      const records = getCacheRecords();
      const record = records.find((r) => r.id === options.cacheRecordId);
      if (!record) {
        console.log(chalk.red(`✗ 缓存记录不存在: ${options.cacheRecordId}`));
        addHistoryEntry('report', '生成报告失败', 'failed', `缓存记录不存在: ${options.cacheRecordId}`);
        return;
      }
      content = generateCacheReport(record);
    } else if (options.type === 'comprehensive') {
      if (!options.checkResultId) {
        console.log(chalk.red('✗ 综合报告至少需要 --check-result-id'));
        addHistoryEntry('report', '生成报告失败', 'failed', '缺少 check-result-id');
        return;
      }
      const result = getCheckResultById(options.checkResultId);
      if (!result) {
        console.log(chalk.red(`✗ 检查结果不存在: ${options.checkResultId}`));
        addHistoryEntry('report', '生成报告失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
        return;
      }
      const taskResult = options.replayTaskId ? getReplayTaskById(options.replayTaskId) : undefined;
      const cacheRecords = getCacheRecords();
      const cacheRec = options.cacheRecordId
        ? cacheRecords.find((r) => r.id === options.cacheRecordId)
        : undefined;

      content = generateComprehensiveReport(result, taskResult ?? undefined, cacheRec);
    }

    console.log(chalk.blue('📄 正在生成报告...'));
    const report = saveReport(
      options.name,
      options.type,
      content,
      options.checkResultId,
      options.replayTaskId,
      options.cacheRecordId
    );

    console.log(chalk.green('✓ 报告生成成功'));
    console.log(chalk.gray(`   报告 ID: ${report.id}`));
    console.log(chalk.gray(`   报告路径: ${report.filePath}`));

    addHistoryEntry(
      'report',
      `生成报告: ${options.name}`,
      'success',
      `类型: ${options.type}, 路径: ${report.filePath}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 报告生成失败: ${(e as Error).message}`));
    addHistoryEntry('report', '生成报告失败', 'failed', (e as Error).message);
  }
};

export const viewReportCommand = (reportId: string): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  if (!reportId) {
    console.log(chalk.red('✗ 必须指定报告 ID'));
    return;
  }

  const reports = getReports();
  const report = reports.find((r) => r.id === reportId);

  if (!report) {
    console.log(chalk.red(`✗ 报告不存在: ${reportId}`));
    console.log(chalk.gray('   可运行: sir report list 查看可用报告'));
    return;
  }

  const fs = require('fs');
  if (!fs.existsSync(report.filePath)) {
    console.log(chalk.red(`✗ 报告文件不存在: ${report.filePath}`));
    return;
  }

  console.log(chalk.blue(`📄 报告: ${report.name}`));
  console.log(chalk.gray(`路径: ${report.filePath}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();

  const content = fs.readFileSync(report.filePath, 'utf-8');
  console.log(content);
};
