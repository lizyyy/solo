import { importFile, getBatches } from '../services/importService';
import { isDatabaseInitialized } from '../db/database';
import { DataSourceType, ImportStrategy } from '../types';
import chalk from 'chalk';
import Table from 'cli-table3';

interface ImportOptions {
  source: string;
  strategy?: string;
  operator?: string;
}

export async function importCommand(filePath: string, options: ImportOptions): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const sourceType = options.source as DataSourceType;
  const validSources = Object.values(DataSourceType);
  if (!validSources.includes(sourceType)) {
    console.error(chalk.red(`错误: 无效的数据源类型。可选值: ${validSources.join(', ')}`));
    return 1;
  }

  const strategy = (options.strategy as ImportStrategy) || ImportStrategy.APPEND;
  const validStrategies = Object.values(ImportStrategy);
  if (!validStrategies.includes(strategy)) {
    console.error(chalk.red(`错误: 无效的导入策略。可选值: ${validStrategies.join(', ')}`));
    return 1;
  }

  const operator = options.operator || process.env.USER || 'unknown';

  console.log(chalk.blue(`正在导入文件: ${filePath}`));
  console.log(chalk.gray(`  数据源: ${sourceType}`));
  console.log(chalk.gray(`  策略: ${strategy}`));
  console.log(chalk.gray(`  操作员: ${operator}`));
  console.log('');

  try {
    const result = await importFile(filePath, {
      sourceType,
      strategy,
      operator,
      skipHeader: true
    });

    console.log(chalk.green('✓ 导入成功！'));
    console.log('');
    console.log(chalk.cyan('导入结果:'));
    console.log(`  批次ID: ${result.batchId}`);
    console.log(`  总记录数: ${result.totalRecords}`);
    console.log(`  成功导入: ${result.importedRecords}`);
    console.log(`  跳过: ${result.skippedRecords}`);
    console.log(`  策略: ${result.strategy}`);
    console.log('');
    console.log(chalk.cyan('下一步操作:'));
    console.log(`  校验数据: park-inspect check ${result.batchId}`);

    return 0;
  } catch (error) {
    console.error(chalk.red('导入失败:'), (error as Error).message);
    return 1;
  }
}

export async function listCommand(): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const batches = getBatches();

  if (batches.length === 0) {
    console.log(chalk.yellow('暂无导入记录'));
    return 0;
  }

  const sourceTypeNames: Record<string, string> = {
    'visitor_appointment': '访客预约表',
    'gate_record': '闸机记录',
    'temp_plate': '临时车牌',
    'refund_flow': '退款流水'
  };

  const table = new Table({
    head: ['批次ID', '文件名', '类型', '状态', '总数', '有效', '无效', '操作员', '导入时间'],
    colWidths: [38, 20, 12, 10, 6, 6, 6, 10, 20]
  });

  for (const batch of batches) {
    table.push([
      batch.id.substring(0, 36),
      batch.file_name,
      sourceTypeNames[batch.source_type] || batch.source_type,
      batch.status,
      batch.total_records,
      batch.valid_records || 0,
      batch.invalid_records || 0,
      batch.operator,
      batch.created_at
    ]);
  }

  console.log(table.toString());
  return 0;
}
