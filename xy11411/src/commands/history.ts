import chalk from 'chalk';
import Table from 'cli-table3';
import { dbService } from '../services/database';
import { createStateManager } from '../services/stateManager';
import { formatDate } from '../utils/fileUtils';
import { StateChange, RecordStatus } from '../models/types';

export async function historyCommand(options: {
  recordId?: string;
  limit?: number;
  audit?: boolean;
  operator?: string;
}): Promise<void> {
  console.log(chalk.blue('\n=== 历史记录查询 ===\n'));

  try {
    const operatorId = options.operator || 'default-admin';
    const stateManager = await createStateManager(operatorId);

    if (options.audit) {
      await showAuditLogs(options.limit || 50);
    } else if (options.recordId) {
      await showRecordHistory(options.recordId);
    } else {
      await showRecentChanges(options.limit || 20);
    }

    await stateManager.logAction('history_query', 'system', undefined, {
      recordId: options.recordId,
      audit: options.audit || false,
      limit: options.limit || 20
    });

  } catch (error) {
    console.error(chalk.red('\n✗ 查询失败:'), (error as Error).message);
    process.exit(1);
  }
}

async function showRecordHistory(recordId: string): Promise<void> {
  const record = await dbService.getRecordById(recordId);
  if (!record) {
    console.error(chalk.red(`✗ 记录不存在: ${recordId}`));
    process.exit(1);
  }

  console.log(chalk.bold(`📋 记录详情: ${recordId}`));
  console.log();
  console.log(chalk.gray(`物料名称: ${record.materialName || '未设置'}`));
  console.log(chalk.gray(`原始行号: ${record.rawData.originalRowNumber}`));
  console.log(chalk.gray(`来源文件: ${record.rawData.sourceFile}`));
  console.log(chalk.gray(`当前状态: ${record.status}`));
  console.log();

  const stateChanges = record.stateChanges;

  if (stateChanges.length === 0) {
    console.log(chalk.yellow('没有状态变更记录'));
    return;
  }

  console.log(chalk.bold('🔄 状态变更历史'));
  console.log();

  const table = new Table({
    head: ['序号', '时间', '从状态', '到状态', '操作员', '原因'],
    colWidths: [8, 22, 15, 15, 15, 40]
  });

  const statusNames: Record<string, string> = {
    pending: '待处理',
    imported: '已导入',
    checking: '校验中',
    valid: '有效',
    invalid: '无效',
    fixing: '修正中',
    fixed: '已修正',
    reimported: '重新导入',
    exported: '已导出',
    archived: '已归档'
  };

  stateChanges.forEach((change, index) => {
    table.push([
      (index + 1).toString(),
      formatDate(change.timestamp),
      change.fromStatus ? (statusNames[change.fromStatus] || change.fromStatus) : '-',
      statusNames[change.toStatus] || change.toStatus,
      change.operator.name,
      change.reason
    ]);
  });

  console.log(table.toString());

  if (record.checkResults.length > 0) {
    console.log();
    console.log(chalk.bold('✅ 校验结果历史'));
    console.log();

    const checkTable = new Table({
      head: ['检查项', '状态', '消息', '时间', '操作员'],
      colWidths: [20, 10, 40, 22, 15]
    });

    for (const check of record.checkResults) {
      const operator = await dbService.getOperatorById(check.operatorId);
      checkTable.push([
        check.checkName,
        check.status === 'pass' ? chalk.green('通过') : check.status === 'fail' ? chalk.red('失败') : chalk.yellow(check.status),
        check.message,
        formatDate(check.timestamp),
        operator?.name || check.operatorId
      ]);
    }

    console.log(checkTable.toString());
  }
}

async function showRecentChanges(limit: number): Promise<void> {
  console.log(chalk.bold(`📋 最近 ${limit} 条状态变更`));
  console.log();

  const sql = `
    SELECT 
      sc.id,
      sc.record_id,
      sc.from_status,
      sc.to_status,
      sc.operator_name,
      sc.reason,
      sc.timestamp,
      r.material_name,
      r.original_row_number
    FROM state_changes sc
    LEFT JOIN records r ON sc.record_id = r.id
    ORDER BY sc.timestamp DESC
    LIMIT ?
  `;

  const rows = await dbService.runQuery(sql, [limit]);

  if (rows.length === 0) {
    console.log(chalk.yellow('没有状态变更记录'));
    return;
  }

  const table = new Table({
    head: ['时间', '记录ID', '物料', '行号', '状态变更', '操作员', '原因'],
    colWidths: [22, 18, 15, 8, 25, 12, 30]
  });

  const statusNames: Record<string, string> = {
    pending: '待处理',
    imported: '已导入',
    checking: '校验中',
    valid: '有效',
    invalid: '无效',
    fixing: '修正中',
    fixed: '已修正',
    reimported: '重新导入',
    exported: '已导出',
    archived: '已归档'
  };

  for (const row of rows) {
    const fromStatus = row.from_status ? (statusNames[row.from_status] || row.from_status) : '-';
    const toStatus = statusNames[row.to_status] || row.to_status;
    const statusChange = `${fromStatus} → ${toStatus}`;

    table.push([
      formatDate(row.timestamp),
      row.record_id.slice(0, 8),
      (row.material_name || '').slice(0, 12),
      row.original_row_number?.toString() || '-',
      statusChange,
      row.operator_name,
      row.reason.slice(0, 25)
    ]);
  }

  console.log(table.toString());
}

async function showAuditLogs(limit: number): Promise<void> {
  console.log(chalk.bold(`📋 最近 ${limit} 条审计日志`));
  console.log();

  const logs = await dbService.getAuditLogs(limit);

  if (logs.length === 0) {
    console.log(chalk.yellow('没有审计日志'));
    return;
  }

  const table = new Table({
    head: ['时间', '操作', '操作员', '资源类型', '资源ID', '详情'],
    colWidths: [22, 20, 12, 15, 15, 35]
  });

  for (const log of logs) {
    let details = '';
    try {
      details = JSON.stringify(log.details).slice(0, 30);
    } catch {
      details = String(log.details).slice(0, 30);
    }

    table.push([
      formatDate(log.timestamp),
      log.action,
      log.operatorName,
      log.resourceType,
      log.resourceId?.slice(0, 8) || '-',
      details
    ]);
  }

  console.log(table.toString());
}
