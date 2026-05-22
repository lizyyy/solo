import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getDatabase } from '../database';
import { ImportService, ImportOptions } from '../services/importer';

export async function importCommand(
  filePaths: string[],
  workDir: string,
  options: ImportOptions & { batch?: string; mode?: string }
): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);

  const importService = new ImportService(db, absoluteDir);

  const importOptions: ImportOptions = {
    mode: (options.mode as any) || 'update',
    batchId: options.batch,
    operator: options.operator || 'cli',
    sourceType: options.sourceType,
  };

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalUpdated = 0;
  const allFailedRecords: any[] = [];

  for (const filePath of filePaths) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      console.log(chalk.red(`✗ 文件不存在: ${filePath}`));
      continue;
    }

    console.log(chalk.blue(`\n导入文件: ${path.basename(absolutePath)}`));
    console.log(chalk.gray(`  路径: ${absolutePath}`));

    try {
      const result = await importService.importFile(absolutePath, importOptions);

      console.log(chalk.green(`  ✓ 批次号: ${result.batchId}`));
      console.log(chalk.gray(`  总计: ${result.totalRecords}`));
      console.log(chalk.green(`  成功: ${result.successCount}`));
      if (result.updatedCount > 0) {
        console.log(chalk.blue(`  更新: ${result.updatedCount}`));
      }
      if (result.skippedCount > 0) {
        console.log(chalk.yellow(`  跳过: ${result.skippedCount}`));
      }
      if (result.failedCount > 0) {
        console.log(chalk.red(`  失败: ${result.failedCount}`));
      }

      totalSuccess += result.successCount;
      totalFailed += result.failedCount;
      totalUpdated += result.updatedCount;
      allFailedRecords.push(...result.failedRecords.map(r => ({ ...r, batchId: result.batchId })));
    } catch (error: any) {
      console.log(chalk.red(`  ✗ 导入失败: ${error.message}`));
      totalFailed++;
    }
  }

  if (allFailedRecords.length > 0) {
    console.log(chalk.red('\n失败记录详情:'));
    const table = new Table({
      head: ['批次号', '源文件', '行号', '错误信息'],
      colWidths: [12, 20, 8, 50],
      wordWrap: true,
    });

    for (const record of allFailedRecords) {
      table.push([
        record.batchId,
        record.sourceFile,
        record.rawLineNumber.toString(),
        record.errors.join('\n'),
      ]);
    }

    console.log(table.toString());
  }

  console.log('');
  console.log(chalk.blue('汇总:'));
  console.log(chalk.gray(`  成功: ${totalSuccess}, 失败: ${totalFailed}, 更新: ${totalUpdated}`));
}
