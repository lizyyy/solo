import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getDatabase } from '../database';

export async function checkCommand(workDir: string, options: { batch?: string; all?: boolean }): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);

  console.log(chalk.blue('数据质量检查'));
  console.log('');

  const errors = await db.getUnresolvedErrors();
  const failedRecords = await db.getFailedRecords(options.batch);

  if (failedRecords.length === 0 && errors.length === 0) {
    console.log(chalk.green('✓ 所有数据检查通过!'));
    return;
  }

  console.log(chalk.red(`发现 ${failedRecords.length} 条失败记录, ${errors.length} 个验证错误`));
  console.log('');

  if (failedRecords.length > 0) {
    console.log(chalk.red('失败记录:'));
    const table = new Table({
      head: ['记录ID', '源文件', '行号', '错误'],
      colWidths: [14, 22, 8, 46],
      wordWrap: true,
    });

    for (const record of failedRecords.slice(0, options.all ? undefined : 20)) {
      table.push([
        record.id,
        record.sourceFile,
        record.rawLineNumber.toString(),
        record.errors.join('\n'),
      ]);
    }

    console.log(table.toString());

    if (!options.all && failedRecords.length > 20) {
      console.log(chalk.yellow(`  还有 ${failedRecords.length - 20} 条记录，使用 --all 查看全部`));
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log(chalk.yellow('验证错误详情:'));
    const table = new Table({
      head: ['错误ID', '字段', '错误码', '错误信息', '严重程度'],
      colWidths: [14, 12, 18, 32, 10],
      wordWrap: true,
    });

    for (const error of errors.slice(0, options.all ? undefined : 20)) {
      table.push([
        error.id,
        error.fieldName,
        error.errorCode,
        error.errorMessage,
        error.severity === 'error' ? chalk.red('错误') : chalk.yellow('警告'),
      ]);
    }

    console.log(table.toString());

    if (!options.all && errors.length > 20) {
      console.log(chalk.yellow(`  还有 ${errors.length - 20} 个错误，使用 --all 查看全部`));
    }
  }

  console.log('');
  console.log(chalk.blue('修复建议:'));
  console.log(chalk.gray('  1. 运行 pmi fix --record <记录ID> 人工修正单条记录'));
  console.log(chalk.gray('  2. 修正源文件后重新导入: pmi import <文件路径>'));
  console.log(chalk.gray('  3. 查看原始内容: pmi show <记录ID>'));
}
