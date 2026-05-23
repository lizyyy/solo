import { exportToCSV, exportToExcel, exportFailuresToCSV, exportAuditLogs, exportReportToText } from '../services/exportService';
import { generateReport } from '../services/reportService';
import { isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';

interface ExportOptions {
  format?: string;
  failures?: boolean;
  audit?: boolean;
  report?: boolean;
  output?: string;
}

export async function exportCommand(batchId: string, options: ExportOptions): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  const format = options.format || 'csv';
  const outputPath = options.output || `./exports/${batchId}.${format}`;

  try {
    if (options.failures) {
      const failuresPath = options.output || `./exports/${batchId}-failures.csv`;
      exportFailuresToCSV(batchId, failuresPath);
      console.log(chalk.green(`✓ 失败记录已导出: ${failuresPath}`));
      return 0;
    }

    if (options.audit) {
      const auditPath = options.output || `./exports/${batchId}-audit.csv`;
      exportAuditLogs(batchId, auditPath);
      console.log(chalk.green(`✓ 审计日志已导出: ${auditPath}`));
      return 0;
    }

    if (options.report) {
      const report = generateReport(batchId);
      const reportPath = options.output || `./exports/${batchId}-report.txt`;
      exportReportToText(report, reportPath);
      console.log(chalk.green(`✓ 报表已导出: ${reportPath}`));
      return 0;
    }

    if (format === 'csv') {
      exportToCSV(batchId, outputPath);
    } else if (format === 'excel' || format === 'xlsx') {
      exportToExcel(batchId, outputPath);
    } else {
      console.error(chalk.red(`错误: 不支持的导出格式: ${format}`));
      return 1;
    }

    console.log(chalk.green(`✓ 数据已导出: ${outputPath}`));
    return 0;
  } catch (error) {
    console.error(chalk.red('导出失败:'), (error as Error).message);
    return 1;
  }
}
