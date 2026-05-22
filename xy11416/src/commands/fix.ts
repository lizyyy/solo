import path from 'path';
import chalk from 'chalk';
import moment from 'moment';
import { getDatabase } from '../database';

interface FixOptions {
  record?: string;
  error?: string;
  field?: string;
  value?: string;
  operator?: string;
  reason?: string;
  withdraw?: string;
  freeze?: string;
  unfreeze?: string;
}

export async function fixCommand(workDir: string, options: FixOptions): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);
  const operator = options.operator || 'cli';

  if (options.withdraw) {
    await withdrawRecord(db, options.withdraw, operator, options.reason || '人工撤回');
    return;
  }

  if (options.freeze) {
    await freezeFact(db, options.freeze, operator, options.reason || '导出前冻结');
    return;
  }

  if (options.unfreeze) {
    await unfreezeFact(db, options.unfreeze, operator);
    return;
  }

  if (options.error && options.reason) {
    await resolveError(db, options.error, operator, options.reason);
    return;
  }

  if (options.record && options.field && options.value !== undefined) {
    await overrideField(db, options.record, options.field, options.value, operator, options.reason || '人工改判');
    return;
  }

  console.log(chalk.yellow('请指定修复操作:'));
  console.log('');
  console.log(chalk.blue('撤回记录:'));
  console.log(chalk.gray('  pmi fix --withdraw <记录ID> --reason "撤回原因"'));
  console.log('');
  console.log(chalk.blue('解决错误:'));
  console.log(chalk.gray('  pmi fix --error <错误ID> --reason "解决方式说明"'));
  console.log('');
  console.log(chalk.blue('人工改判字段:'));
  console.log(chalk.gray('  pmi fix --record <记录ID> --field <字段名> --value <新值> --reason "改判原因"'));
  console.log('');
  console.log(chalk.blue('冻结/解冻工单:'));
  console.log(chalk.gray('  pmi fix --freeze <工单号> --reason "导出前冻结"'));
  console.log(chalk.gray('  pmi fix --unfreeze <工单号>'));
}

async function withdrawRecord(db: any, recordId: string, operator: string, reason: string): Promise<void> {
  await db.updateRawRecordStatus(recordId, 'withdrawn');
  await db.logChange(recordId, 'status', 'failed', 'withdrawn', operator, reason);
  console.log(chalk.green('OK 记录 ' + recordId + ' 已撤回'));
}

async function freezeFact(db: any, orderNumber: string, operator: string, reason: string): Promise<void> {
  const fact = await db.findFactByOrderNumber(orderNumber);
  if (!fact) {
    console.log(chalk.red('ERROR 工单 ' + orderNumber + ' 不存在'));
    return;
  }
  if (fact.isFrozen) {
    console.log(chalk.yellow('工单 ' + orderNumber + ' 已冻结'));
    return;
  }
  await db.updateFactRecord(fact.id, { isFrozen: true, frozenBy: operator });
  await db.logChange(fact.id, 'frozen', 'false', 'true', operator, reason);
  console.log(chalk.green('OK 工单 ' + orderNumber + ' 已冻结'));
}

async function unfreezeFact(db: any, orderNumber: string, operator: string): Promise<void> {
  const fact = await db.findFactByOrderNumber(orderNumber);
  if (!fact) {
    console.log(chalk.red('ERROR 工单 ' + orderNumber + ' 不存在'));
    return;
  }
  if (!fact.isFrozen) {
    console.log(chalk.yellow('工单 ' + orderNumber + ' 未冻结'));
    return;
  }
  await db.updateFactRecord(fact.id, { isFrozen: false, frozenBy: operator });
  await db.logChange(fact.id, 'frozen', 'true', 'false', operator, '人工解冻');
  console.log(chalk.green('OK 工单 ' + orderNumber + ' 已解冻'));
}

async function resolveError(db: any, errorId: string, operator: string, resolution: string): Promise<void> {
  await db.resolveValidationError(errorId, operator, resolution);
  console.log(chalk.green('OK 错误 ' + errorId + ' 已标记为已解决'));
  console.log(chalk.gray('  解决方式: ' + resolution));
}

async function overrideField(db: any, recordId: string, field: string, value: string, operator: string, reason: string): Promise<void> {
  const history = await db.getImportHistory(100);
  let rawRecord = null;

  for (const session of history) {
    const records = await db.getRawRecordsByBatch(session.batchId);
    rawRecord = records.find((r: any) => r.id === recordId);
    if (rawRecord) break;
  }

  if (!rawRecord) {
    console.log(chalk.red('ERROR 记录 ' + recordId + ' 不存在'));
    return;
  }

  const standardizedRecords = await db.getStandardizedRecordsByFact('');
  const stdRecord = standardizedRecords.find((s: any) => s.rawRecordId === recordId);

  if (stdRecord) {
    const oldValue = (stdRecord as any)[field] || '';
    await db.logChange(stdRecord.factId, field, oldValue, value, operator, reason);

    const now = moment().toISOString();
    const fieldMap: Record<string, string> = {
      orderNumber: 'order_number',
      residentName: 'resident_name',
      roomNumber: 'room_number',
      phoneNumber: 'phone_number',
      repairType: 'repair_type',
      description: 'description',
      reportTime: 'report_time',
      technicianName: 'technician_name',
      arrivalTime: 'arrival_time',
      completionTime: 'completion_time',
      repairResult: 'repair_result',
      materialName: 'material_name',
      materialQuantity: 'material_quantity',
      materialUnit: 'material_unit',
      supervisorNote: 'supervisor_note',
    };

    const dbField = fieldMap[field] || field;
    const sql = 'UPDATE standardized_records SET ' + dbField + ' = ?, is_manual_override = 1, standardized_at = ?, standardized_by = ? WHERE raw_record_id = ?';

    await db.run(sql, [value, now, operator, recordId]);

    const fact = await db.findFactByOrderNumber(stdRecord.orderNumber);
    if (fact) {
      await db.updateFactRecord(fact.id, { currentStatus: '已修正' });
    }

    await db.updateRawRecordStatus(recordId, 'fixed');

    console.log(chalk.green('OK 字段 ' + field + ' 已更新'));
    console.log(chalk.gray('  原值: ' + oldValue));
    console.log(chalk.gray('  新值: ' + value));
  } else {
    console.log(chalk.red('ERROR 未找到标准化记录'));
  }
}
