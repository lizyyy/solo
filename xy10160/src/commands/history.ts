import chalk from 'chalk';
import moment from 'moment';
import {
  isInitialized,
  getHistory,
  getCheckResults,
  getReplayTasks,
  getCacheRecords,
  addHistoryEntry,
} from '../storage/store';
import { HistoryEntry } from '../types';

const formatDate = (iso: string): string => {
  return moment(iso).format('YYYY-MM-DD HH:mm:ss');
};

export const historyCommand = (options: { limit?: number; type?: HistoryEntry['type'] }): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    return;
  }

  const limit = options.limit || 20;
  const entries = getHistory(limit, options.type);

  if (entries.length === 0) {
    console.log(chalk.yellow('暂无历史记录'));
    return;
  }

  console.log(chalk.blue(`📜 操作历史 (最近 ${entries.length} 条):\n`));

  entries.forEach((entry, index) => {
    const statusColor = entry.status === 'success' ? chalk.green : chalk.red;
    const typeEmoji: Record<string, string> = {
      init: '🏗️',
      import: '📥',
      check: '🔍',
      replay: '🔄',
      cache: '🗄️',
      report: '📄',
    };

    console.log(
      chalk.white(
        `${index + 1}. ${typeEmoji[entry.type] || '📌'} [${entry.type.toUpperCase()}] ${entry.action}`
      )
    );
    console.log(chalk.gray(`   时间: ${formatDate(entry.timestamp)}`));
    console.log(chalk.gray(`   状态: ${statusColor(entry.status)}`));
    console.log(chalk.gray(`   详情: ${entry.details}`));
    console.log();
  });
};

export const listChecksCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const results = getCheckResults();
  if (results.length === 0) {
    console.log(chalk.yellow('暂无检查结果'));
    return;
  }

  console.log(chalk.blue('📋 检查结果列表:\n'));
  results.forEach((r, i) => {
    const issueRate = ((r.summary.withIssues / r.summary.totalChecked) * 100).toFixed(1);
    const hasIssues = r.summary.withIssues > 0;

    console.log(chalk.white(`${i + 1}. 检查结果 #${r.id.slice(0, 8)}`));
    console.log(chalk.gray(`   完整 ID: ${r.id}`));
    console.log(chalk.gray(`   检查时间: ${formatDate(r.timestamp)}`));
    console.log(
      chalk.gray(
        `   商品: ${r.summary.totalChecked} | 问题: ${
          hasIssues ? chalk.yellow(r.summary.withIssues) : r.summary.withIssues
        } (${issueRate}%)`
      )
    );
    console.log(
      chalk.gray(
        `   缺失字段: ${r.summary.missingFieldsTotal} | 不一致: ${r.summary.mismatchedFieldsTotal}`
      )
    );
    console.log();
  });
};

export const listReplaysCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const tasks = getReplayTasks();
  if (tasks.length === 0) {
    console.log(chalk.yellow('暂无回放任务'));
    return;
  }

  console.log(chalk.blue('🔄 回放任务列表:\n'));
  tasks.forEach((t, i) => {
    const statusColor: Record<string, chalk.Chalk> = {
      pending: chalk.blue,
      running: chalk.yellow,
      completed: chalk.green,
      failed: chalk.red,
    };

    console.log(chalk.white(`${i + 1}. ${t.name}`));
    console.log(chalk.gray(`   ID: ${t.id}`));
    console.log(chalk.gray(`   状态: ${statusColor[t.status](t.status)}`));
    console.log(chalk.gray(`   商品数: ${t.productIds.length}`));
    console.log(
      chalk.gray(
        `   成功: ${t.successCount} | 失败: ${t.failedCount}`
      )
    );
    if (t.startTime) {
      console.log(chalk.gray(`   开始: ${formatDate(t.startTime)}`));
    }
    if (t.endTime) {
      console.log(chalk.gray(`   结束: ${formatDate(t.endTime)}`));
    }
    console.log();
  });
};

export const listCachesCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const records = getCacheRecords();
  if (records.length === 0) {
    console.log(chalk.yellow('暂无缓存刷新记录'));
    return;
  }

  console.log(chalk.blue('🗄️ 缓存刷新记录:\n'));
  records.forEach((r, i) => {
    const statusColor: Record<string, chalk.Chalk> = {
      success: chalk.green,
      failed: chalk.red,
      partial: chalk.yellow,
    };

    console.log(chalk.white(`${i + 1}. 刷新记录 #${r.id.slice(0, 8)}`));
    console.log(chalk.gray(`   完整 ID: ${r.id}`));
    console.log(chalk.gray(`   时间: ${formatDate(r.timestamp)}`));
    console.log(chalk.gray(`   状态: ${statusColor[r.status](r.status)}`));
    console.log(
      chalk.gray(
        `   成功: ${r.refreshedCount} | 失败: ${r.failedCount} | 总数: ${r.productIds.length}`
      )
    );
    console.log();
  });
};
