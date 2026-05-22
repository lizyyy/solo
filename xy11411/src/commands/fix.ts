import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/database';
import { createStateManager } from '../services/stateManager';
import { AutoCheckService } from '../services/autoCheck';
import { RecordStatus, CheckStatus } from '../models/types';

export async function fixCommand(recordId: string, options: {
  field: string;
  value: string;
  reason: string;
  operator?: string;
  recheck?: boolean;
}): Promise<void> {
  console.log(chalk.blue('\n=== 修正数据 ===\n'));

  try {
    const operatorId = options.operator || 'default-admin';
    const stateManager = await createStateManager(operatorId);
    const autoCheck = new AutoCheckService(stateManager);

    const hasPermission = await autoCheck.checkPermission('fix', 'data');
    if (!hasPermission) {
      console.error(chalk.red('✗ 权限不足: 没有修正数据的权限'));
      process.exit(1);
    }

    const record = await dbService.getRecordById(recordId);
    if (!record) {
      console.error(chalk.red(`✗ 记录不存在: ${recordId}`));
      process.exit(1);
    }

    console.log(chalk.gray(`记录ID: ${recordId}`));
    console.log(chalk.gray(`当前状态: ${record.status}`));
    console.log(chalk.gray(`物料名称: ${record.materialName || '未设置'}`));
    console.log(chalk.gray(`原始行号: ${record.rawData.originalRowNumber}`));
    console.log();

    await stateManager.transitionState(
      recordId,
      record.status,
      RecordStatus.FIXING,
      `开始修正: ${options.reason}`
    );

    const sql = `UPDATE records SET ${options.field} = ?, updated_at = ? WHERE id = ?`;
    await dbService.runQuery(sql, [options.value, Date.now(), recordId]);

    const operator = stateManager.getCurrentOperator();
    await dbService.insertCheckResult({
      id: uuidv4(),
      recordId,
      checkName: '手动修正',
      status: CheckStatus.PASS,
      message: `字段 ${options.field} 已修正为: ${options.value}`,
      details: {
        field: options.field,
        oldValue: (record as any)[options.field],
        newValue: options.value,
        reason: options.reason
      },
      timestamp: Date.now(),
      operatorId: operator.id
    });

    await stateManager.transitionState(
      recordId,
      RecordStatus.FIXING,
      RecordStatus.FIXED,
      `修正完成: ${options.reason}`,
      {
        field: options.field,
        oldValue: (record as any)[options.field],
        newValue: options.value
      }
    );

    console.log(chalk.green(`✓ 修正成功!`));
    console.log(chalk.gray(`  字段: ${options.field}`));
    console.log(chalk.gray(`  原值: ${(record as any)[options.field] || '(空)'}`));
    console.log(chalk.gray(`  新值: ${options.value}`));
    console.log(chalk.gray(`  原因: ${options.reason}`));

    if (options.recheck) {
      console.log();
      console.log(chalk.gray('重新执行校验...'));
      const { checkCommand } = await import('./import');
      await checkCommand({ recordId, operator: operatorId });
    }

    await stateManager.logAction('record_fixed', 'record', recordId, {
      field: options.field,
      oldValue: (record as any)[options.field],
      newValue: options.value,
      reason: options.reason
    });

  } catch (error) {
    console.error(chalk.red('\n✗ 修正失败:'), (error as Error).message);
    process.exit(1);
  }
}

export async function reimportCommand(recordId: string, options: {
  operator?: string;
}): Promise<void> {
  console.log(chalk.blue('\n=== 重新导入 ===\n'));

  try {
    const operatorId = options.operator || 'default-admin';
    const stateManager = await createStateManager(operatorId);
    const autoCheck = new AutoCheckService(stateManager);

    const hasPermission = await autoCheck.checkPermission('fix', 'data');
    if (!hasPermission) {
      console.error(chalk.red('✗ 权限不足: 没有重新导入的权限'));
      process.exit(1);
    }

    const record = await dbService.getRecordById(recordId);
    if (!record) {
      console.error(chalk.red(`✗ 记录不存在: ${recordId}`));
      process.exit(1);
    }

    console.log(chalk.gray(`记录ID: ${recordId}`));
    console.log(chalk.gray(`当前状态: ${record.status}`));
    console.log();

    await stateManager.transitionState(
      recordId,
      record.status,
      RecordStatus.REIMPORTED,
      '修正后重新导入',
      {
        originalStatus: record.status,
        originalRowNumber: record.rawData.originalRowNumber
      }
    );

    console.log(chalk.green(`✓ 重新导入成功!`));
    console.log(chalk.gray(`记录已标记为重新导入状态，可以再次进行校验`));

    await stateManager.logAction('record_reimported', 'record', recordId, {
      previousStatus: record.status
    });

    console.log();
    console.log(chalk.gray('执行校验...'));
    const { checkCommand } = await import('./import');
    await checkCommand({ recordId, operator: operatorId });

  } catch (error) {
    console.error(chalk.red('\n✗ 重新导入失败:'), (error as Error).message);
    process.exit(1);
  }
}
