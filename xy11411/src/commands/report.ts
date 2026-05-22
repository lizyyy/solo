import chalk from 'chalk';
import Table from 'cli-table3';
import { dbService } from '../services/database';
import { createStateManager } from '../services/stateManager';
import { AutoCheckService } from '../services/autoCheck';
import { formatDate, formatCurrency } from '../utils/fileUtils';
import {
  RecordStatus,
  DataSourceType,
  TeaMaterialRecord,
  ReportSummary,
  FailureRecord
} from '../models/types';

export async function reportCommand(options: {
  batchId?: string;
  format?: string;
  output?: string;
  failures?: boolean;
  operator?: string;
}): Promise<void> {
  console.log(chalk.blue('\n=== 数据巡检报表 ===\n'));

  try {
    const operatorId = options.operator || 'default-admin';
    const stateManager = await createStateManager(operatorId);

    let records = await dbService.getAllRecords();

    if (options.batchId) {
      records = records.filter(r => r.rawData.importBatchId === options.batchId);
    }

    if (records.length === 0) {
      console.log(chalk.yellow('没有数据记录'));
      return;
    }

    const summary = generateSummary(records, operatorId);
    const failureRecords = generateFailureRecords(records);

    if (options.failures) {
      printFailureReport(failureRecords);
    } else {
      printSummaryReport(summary, records);
      console.log();
      printFailureTable(failureRecords.slice(0, 10));
    }

    console.log();
    console.log(chalk.gray(`报表生成时间: ${formatDate(Date.now())}`));
    console.log(chalk.gray(`生成操作员: ${stateManager.getCurrentOperator().name}`));

    await stateManager.logAction('report_generated', 'report', undefined, {
      batchId: options.batchId,
      format: options.format || 'console',
      totalRecords: records.length,
      failureCount: failureRecords.length
    });

  } catch (error) {
    console.error(chalk.red('\n✗ 生成报表失败:'), (error as Error).message);
    process.exit(1);
  }
}

function generateSummary(records: TeaMaterialRecord[], operatorId: string): ReportSummary {
  const bySource: Record<DataSourceType, number> = {
    [DataSourceType.ORDER]: 0,
    [DataSourceType.LOSS]: 0,
    [DataSourceType.PRICE]: 0,
    [DataSourceType.PHOTO]: 0
  };

  const byStatus: Record<RecordStatus, number> = {
    [RecordStatus.PENDING]: 0,
    [RecordStatus.IMPORTED]: 0,
    [RecordStatus.CHECKING]: 0,
    [RecordStatus.VALID]: 0,
    [RecordStatus.INVALID]: 0,
    [RecordStatus.FIXING]: 0,
    [RecordStatus.FIXED]: 0,
    [RecordStatus.REIMPORTED]: 0,
    [RecordStatus.EXPORTED]: 0,
    [RecordStatus.ARCHIVED]: 0
  };

  const failureReasons: Record<string, number> = {};

  let totalAmount = 0;
  let validRecords = 0;
  let invalidRecords = 0;
  let pendingRecords = 0;
  let fixedRecords = 0;

  for (const record of records) {
    bySource[record.rawData.sourceType]++;
    byStatus[record.status]++;

    if (record.status === RecordStatus.VALID || record.status === RecordStatus.EXPORTED) {
      validRecords++;
      if (record.totalAmount !== undefined) {
        totalAmount += record.totalAmount;
      }
    } else if (record.status === RecordStatus.INVALID) {
      invalidRecords++;
    } else if (record.status === RecordStatus.PENDING || record.status === RecordStatus.IMPORTED) {
      pendingRecords++;
    } else if (record.status === RecordStatus.FIXED) {
      fixedRecords++;
    }

    for (const check of record.checkResults) {
      if (check.status === 'fail') {
        failureReasons[check.message] = (failureReasons[check.message] || 0) + 1;
      }
    }
  }

  return {
    generatedAt: Date.now(),
    generatedBy: operatorId,
    totalRecords: records.length,
    validRecords,
    invalidRecords,
    pendingRecords,
    fixedRecords,
    totalAmount,
    bySource,
    byStatus,
    failureReasons
  };
}

function generateFailureRecords(records: TeaMaterialRecord[]): FailureRecord[] {
  return records
    .filter(r => r.status === RecordStatus.INVALID)
    .map(record => {
      const failedChecks = record.checkResults.filter(c => c.status === 'fail');
      const stateChanges = record.stateChanges;
      const firstFailedAt = stateChanges.find(s => s.toStatus === RecordStatus.INVALID)?.timestamp || record.createdAt;
      const lastFailedAt = [...stateChanges].reverse().find(s => s.toStatus === RecordStatus.INVALID)?.timestamp || record.updatedAt;
      const fixAttempts = stateChanges.filter(s => s.toStatus === RecordStatus.FIXING || s.toStatus === RecordStatus.FIXED).length;

      return {
        recordId: record.id,
        originalRowNumber: record.rawData.originalRowNumber,
        sourceType: record.rawData.sourceType,
        sourceFile: record.rawData.sourceFile,
        status: record.status,
        failureReasons: failedChecks.map(c => c.message),
        firstFailedAt,
        lastFailedAt,
        fixAttempts,
        rawContent: record.rawData.rawContent
      };
    })
    .sort((a, b) => b.lastFailedAt - a.lastFailedAt);
}

function printSummaryReport(summary: ReportSummary, records: TeaMaterialRecord[]): void {
  console.log(chalk.bold('📊 汇总统计'));
  console.log();

  const summaryTable = new Table({
    head: ['指标', '数值'],
    colWidths: [30, 20]
  });

  summaryTable.push(
    ['总记录数', summary.totalRecords.toString()],
    ['有效记录', summary.validRecords.toString()],
    ['无效记录', summary.invalidRecords.toString()],
    ['待处理记录', summary.pendingRecords.toString()],
    ['已修正记录', summary.fixedRecords.toString()],
    ['总金额', formatCurrency(summary.totalAmount)]
  );

  console.log(summaryTable.toString());
  console.log();

  console.log(chalk.bold('📂 按数据源分布'));
  const sourceTable = new Table({
    head: ['数据源类型', '记录数', '占比'],
    colWidths: [20, 15, 15]
  });

  for (const [type, count] of Object.entries(summary.bySource)) {
    if (count > 0) {
      const percentage = ((count / summary.totalRecords) * 100).toFixed(1) + '%';
      const typeNames: Record<string, string> = {
        order: '订货表',
        loss: '损耗登记',
        price: '总部价格表',
        photo: '异常照片'
      };
      sourceTable.push([typeNames[type] || type, count.toString(), percentage]);
    }
  }

  console.log(sourceTable.toString());
  console.log();

  console.log(chalk.bold('📈 按状态分布'));
  const statusTable = new Table({
    head: ['状态', '记录数'],
    colWidths: [25, 15]
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

  for (const [status, count] of Object.entries(summary.byStatus)) {
    if (count > 0) {
      statusTable.push([statusNames[status] || status, count.toString()]);
    }
  }

  console.log(statusTable.toString());
}

function printFailureTable(failures: FailureRecord[]): void {
  if (failures.length === 0) {
    console.log(chalk.green('✓ 没有失败的记录'));
    return;
  }

  console.log(chalk.bold('❌ 失败记录清单 (前10条)'));
  console.log();

  const table = new Table({
    head: ['原始行号', '记录ID', '数据源', '失败原因', '修正次数'],
    colWidths: [12, 18, 15, 35, 12]
  });

  const typeNames: Record<string, string> = {
    order: '订货表',
    loss: '损耗登记',
    price: '价格表',
    photo: '照片'
  };

  for (const f of failures) {
    table.push([
      f.originalRowNumber.toString(),
      f.recordId.slice(0, 8),
      typeNames[f.sourceType] || f.sourceType,
      f.failureReasons.join('; ').slice(0, 30),
      f.fixAttempts.toString()
    ]);
  }

  console.log(table.toString());
}

function printFailureReport(failures: FailureRecord[]): void {
  console.log(chalk.bold('❌ 失败记录详细清单'));
  console.log(chalk.gray(`共 ${failures.length} 条失败记录`));
  console.log();

  const typeNames: Record<string, string> = {
    order: '订货表',
    loss: '损耗登记',
    price: '总部价格表',
    photo: '异常照片'
  };

  for (const [index, failure] of failures.entries()) {
    console.log(chalk.yellow(`[${index + 1}] 行号: ${failure.originalRowNumber} | 记录ID: ${failure.recordId}`));
    console.log(chalk.gray(`    来源文件: ${failure.sourceFile} (${typeNames[failure.sourceType] || failure.sourceType})`));
    console.log(chalk.gray(`    首次失败: ${formatDate(failure.firstFailedAt)}`));
    console.log(chalk.gray(`    最后失败: ${formatDate(failure.lastFailedAt)}`));
    console.log(chalk.gray(`    修正尝试: ${failure.fixAttempts} 次`));
    console.log(chalk.red(`    失败原因: ${failure.failureReasons.join('; ')}`));
    console.log(chalk.gray(`    原始数据: ${JSON.stringify(failure.rawContent).slice(0, 100)}...`));
    console.log();
  }
}
