import { generateReport, formatReportText } from '../services/reportService';
import { isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';

export async function reportCommand(batchId: string): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  try {
    const report = generateReport(batchId);
    const text = formatReportText(report);
    
    console.log(text);

    if (report.invalidRecords > 0) {
      console.log(chalk.yellow(`注意: 存在 ${report.invalidRecords} 条问题记录，请处理后重新校验`));
      return 2;
    }

    return 0;
  } catch (error) {
    console.error(chalk.red('生成报表失败:'), (error as Error).message);
    return 1;
  }
}
