const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Storage } = require('../utils/Storage');
const { Exporter } = require('../utils/Exporter');

const statusCommand = new Command('status')
  .description('查看当前数据状态和统计')
  .option('--consistency', '运行一致性检查')
  .option('--details', '显示详细分布')
  .action(async (options) => {
    const storage = new Storage();
    const stats = storage.getStats();

    console.log(chalk.blue.bold('\n图像缺陷复核 - 数据状态\n'));

    const overview = new Table({
      head: ['类别', '数量'],
      style: { head: ['cyan'] }
    });
    overview.push(
      ['缺陷记录', stats.total.defects],
      ['标注样本', stats.total.annotations],
      ['训练日志', stats.total.logs],
      ['复核记录', stats.total.reviews]
    );
    console.log(overview.toString());

    console.log(chalk.bold('\n待处理'));
    const action = new Table({
      head: ['项目', '数量'],
      style: { head: ['yellow'] }
    });
    action.push(
      ['待复核', stats.pendingReview],
      ['标注有问题', stats.withIssues],
      ['异常日志', stats.anomalies]
    );
    console.log(action.toString());

    if (options.details) {
      console.log(chalk.bold('\n状态分布'));
      const statusTable = new Table({ head: ['状态', '数量'] });
      Object.entries(stats.byStatus).forEach(([k, v]) => statusTable.push([k, v]));
      console.log(statusTable.toString());

      console.log(chalk.bold('\n类型分布'));
      const typeTable = new Table({ head: ['类型', '数量'] });
      Object.entries(stats.byType).forEach(([k, v]) => typeTable.push([k, v]));
      console.log(typeTable.toString());
      
      console.log(chalk.bold('\n严重度分布'));
      const sevTable = new Table({ head: ['严重度', '数量'] });
      Object.entries(stats.bySeverity).forEach(([k, v]) => sevTable.push([k, v]));
      console.log(sevTable.toString());
    }

    if (options.consistency) {
      console.log(chalk.bold('\n一致性检查'));
      const exporter = new Exporter(storage);
      const report = exporter._runFullConsistencyCheck();
      
      const status = report.overall.status === 'pass' 
        ? chalk.green('✅ 通过') 
        : chalk.yellow('⚠️ 需关注');
      console.log(`整体: ${status}`);
      console.log(`  问题: ${report.overall.totalIssues}, 警告: ${report.overall.totalWarnings}`);
      
      if (report.defects.issues.length > 0) {
        console.log(chalk.red(`\n缺陷问题 (${report.defects.issues.length}):`));
        report.defects.issues.slice(0, 5).forEach(i => {
          console.log(`  - [${i.type}] ${i.message} (${i.defectId?.substring(0, 10) || ''})`);
        });
      }
      if (report.annotations.issues.length > 0) {
        console.log(chalk.red(`\n标注问题 (${report.annotations.issues.length}):`));
        report.annotations.issues.slice(0, 5).forEach(i => {
          console.log(`  - [${i.type}] ${i.message}`);
        });
      }
      if (report.crossCheck.issues.length > 0) {
        console.log(chalk.red(`\n交叉检查问题 (${report.crossCheck.issues.length}):`));
        report.crossCheck.issues.slice(0, 5).forEach(i => {
          console.log(`  - [${i.type}] ${i.message}`);
        });
      }
    }

    const meta = storage.getMetadata();
    console.log(chalk.gray(`\n最后修改: ${new Date(meta.lastModified).toLocaleString()}`));
  });

module.exports = { statusCommand };
