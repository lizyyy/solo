const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Exporter } = require('../utils/Exporter');
const { Storage } = require('../utils/Storage');

const exportCommand = new Command('export')
  .description('导出数据: JSON/Markdown/CSV')
  .argument('[type]', '导出类型: defects|annotations|logs|reviews|summary|full', 'summary')
  .option('-f, --format <format>', '格式: json|md|csv', 'json')
  .option('-s, --status <status>', '按状态筛选(仅defects)')
  .option('--source <source>', '按来源筛选(仅defects)')
  .option('--severity <severity>', '按严重度筛选(仅defects)')
  .option('--anomalies', '仅导出异常(仅logs)')
  .action(async (type, options) => {
    const storage = new Storage();
    const exporter = new Exporter(storage);

    const exportOptions = {
      status: options.status,
      source: options.source,
      severity: options.severity,
      anomaliesOnly: options.anomalies
    };

    console.log(chalk.blue(`\n导出: ${type} [${options.format}]\n`));

    try {
      const result = exporter.export(type, options.format, exportOptions);
      
      console.log(chalk.green('✓ 导出成功'));
      console.log(chalk.gray(`路径: ${result.path}`));
      
      if (type === 'summary' && options.format === 'json') {
        const summary = exporter._prepareSummaryReport(exportOptions);
        displaySummaryStats(summary);
      }
      
      if (type === 'summary' || type === 'full') {
        const stats = storage.getStats();
        if (stats.total.defects > 0 && stats.byStatus?.pending > 0) {
          console.log(chalk.yellow(`\n⚠️  还有 ${stats.byStatus.pending + (stats.byStatus.needs_review || 0)} 条待复核`));
        }
      }
    } catch (e) {
      console.log(chalk.red(`✗ 导出失败: ${e.message}`));
      process.exit(1);
    }
  });

function displaySummaryStats(summary) {
  console.log('\n');
  
  const overview = new Table({
    head: ['指标', '数量'],
    style: { head: ['cyan'] }
  });
  overview.push(
    ['总缺陷数', summary.overview.totalDefects],
    ['总标注数', summary.overview.totalAnnotations],
    ['日志条目', summary.overview.totalLogs],
    ['复核记录', summary.overview.totalReviews]
  );
  console.log(overview.toString());

  const cr = summary.consistencyReport?.overall;
  console.log(chalk.gray(`\n一致性状态: ${cr?.status === 'pass' ? '✅ 通过' : '⚠️ 需关注'}`));
  if (cr?.totalIssues > 0) {
    console.log(chalk.yellow(`  问题: ${cr.totalIssues}, 警告: ${cr.totalWarnings}`));
  }
}

module.exports = { exportCommand };
