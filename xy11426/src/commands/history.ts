import { getAuditLogsByBatch, getAuditLogsByRecord, getAuditLogsByOperator, getAllAuditLogs, getRecordChangeHistory } from '../services/auditService';
import { isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';
import Table from 'cli-table3';

interface HistoryOptions {
  batch?: string;
  record?: string;
  operator?: string;
  limit?: number;
}

export async function historyCommand(options: HistoryOptions): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const limit = options.limit || 100;

  try {
    let logs: any[] = [];

    if (options.batch) {
      logs = getAuditLogsByBatch(options.batch, limit);
    } else if (options.record) {
      logs = getRecordChangeHistory(options.record);
    } else if (options.operator) {
      logs = getAuditLogsByOperator(options.operator, limit);
    } else {
      logs = getAllAuditLogs(limit);
    }

    if (logs.length === 0) {
      console.log(chalk.yellow('暂无操作记录'));
      return 0;
    }

    console.log(chalk.cyan(`操作记录 (共 ${logs.length} 条):`));
    console.log('');

    const table = new Table({
      head: ['时间', '操作员', '操作', '详情'],
      colWidths: [20, 12, 15, 80]
    });

    for (const log of logs) {
      let detail = '';
      if (log.old_value && log.new_value) {
        detail = `${log.old_value} → ${log.new_value}`;
      } else if (log.new_value) {
        detail = `新增: ${log.new_value}`;
      } else if (log.old_value) {
        detail = `删除: ${log.old_value}`;
      }

      table.push([
        log.created_at,
        log.operator,
        log.action,
        detail.substring(0, 75)
      ]);
    }

    console.log(table.toString());
    return 0;
  } catch (error) {
    console.error(chalk.red('查询历史失败:'), (error as Error).message);
    return 1;
  }
}
