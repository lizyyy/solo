import { Command } from 'commander';
import chalk from 'chalk';
import { generateReport, exportReport, generateAnomalySummary } from '../report/generator';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('生成并导出复算报告')
    .option('-f, --format <format>', '输出格式: csv|json', 'csv')
    .option('-o, --output <dir>', '输出目录', './data/reports')
    .option('--anomaly-only', '仅输出异常摘要', false)
    .action((opts) => {
      if (opts.anomalyOnly) {
        const summary = generateAnomalySummary();
        console.log(summary);
        return;
      }

      const entries = generateReport();

      if (entries.length === 0) {
        console.log(chalk.yellow('无复算结果，请先执行 calculate 命令'));
        return;
      }

      const format = opts.format as 'csv' | 'json';
      if (!['csv', 'json'].includes(format)) {
        console.error(chalk.red(`不支持的格式: ${format}`));
        process.exit(1);
      }

      const filePath = exportReport(entries, format, opts.output);
      console.log(chalk.green(`\n报告已导出: ${filePath}`));
      console.log(`  条目数: ${entries.length}`);
      console.log(`  格式:   ${format.toUpperCase()}`);

      const anomalyCount = entries.reduce((s, e) => s + e.anomalies.length, 0);
      const errorCount = entries.reduce(
        (s, e) => s + e.anomalies.filter((a) => a.severity === 'error').length,
        0
      );

      if (anomalyCount > 0) {
        console.log(`  异常数: ${anomalyCount} (错误: ${errorCount})`);
        console.log(chalk.yellow('\n使用 bdc report --anomaly-only 查看异常详情'));
      }
    });
}
