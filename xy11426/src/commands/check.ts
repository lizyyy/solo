import { checkBatch, getFailedRecords } from '../services/checkService';
import { isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';
import Table from 'cli-table3';

interface CheckOptions {
  operator?: string;
}

export async function checkCommand(batchId: string, options: CheckOptions): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const operator = options.operator || process.env.USER || 'unknown';

  console.log(chalk.blue(`正在校验批次: ${batchId}`));
  console.log(chalk.gray(`  操作员: ${operator}`));
  console.log('');

  try {
    const result = checkBatch(batchId, operator);

    console.log(chalk.green('✓ 校验完成！'));
    console.log('');
    console.log(chalk.cyan('校验结果:'));
    console.log(`  总记录数: ${result.total}`);
    console.log(`  有效记录: ${result.valid}`);
    console.log(`  问题记录: ${result.invalid}`);
    console.log('');

    if (result.failures.length > 0) {
      console.log(chalk.yellow('问题详情:'));
      
      const table = new Table({
        head: ['行号', '访客姓名', '问题原因'],
        colWidths: [8, 12, 50]
      });

      const seen = new Set<string>();
      for (const failure of result.failures) {
        const key = `${failure.originalLineNo}-${failure.visitorName}`;
        if (!seen.has(key)) {
          table.push([
            failure.originalLineNo,
            failure.visitorName,
            failure.message
          ]);
          seen.add(key);
        }
      }

      console.log(table.toString());
    }

    console.log('');
    console.log(chalk.cyan('下一步操作:'));
    console.log(`  自动修复: park-inspect fix ${batchId} --auto`);
    console.log(`  生成报表: park-inspect report ${batchId}`);

    return result.invalid > 0 ? 2 : 0;
  } catch (error) {
    console.error(chalk.red('校验失败:'), (error as Error).message);
    return 1;
  }
}

export async function failuresCommand(batchId: string): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const records = getFailedRecords(batchId);

  if (records.length === 0) {
    console.log(chalk.green('该批次无失败记录'));
    return 0;
  }

  console.log(chalk.yellow(`失败记录 (共 ${records.length} 条):`));
  console.log('');

  const table = new Table({
    head: ['行号', '访客姓名', '手机号', '车牌号', '问题原因'],
    colWidths: [8, 12, 15, 12, 40]
  });

  for (const record of records) {
    table.push([
      record.original_line_no,
      record.visitor_name,
      record.visitor_phone || '-',
      record.plate_number || '-',
      record.check_message || '未知错误'
    ]);
  }

  console.log(table.toString());
  return 0;
}
