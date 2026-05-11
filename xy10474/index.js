const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const ReconciliationManager = require('./src/ReconciliationManager');
const reportGenerator = require('./src/reportGenerator');

const program = new Command();

program
  .name('cash-recon')
  .description('门店现金长短款核对 CLI 工具')
  .version('1.0.0');

program
  .command('import')
  .description('导入数据文件')
  .option('-t, --type <type>', '数据类型: transactions|refunds|petty-cash|handover')
  .option('-f, --file <file>', '文件路径 (支持 CSV 或 JSON)')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    try {
      const manager = new ReconciliationManager(options.dataDir);
      const result = manager.importData(options.type, options.file);
      console.log(chalk.green(`✓ 成功导入 ${result.count} 条 ${result.type} 记录`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('reconcile')
  .description('执行日结核对')
  .option('-d, --date <date>', '核对日期 (YYYY-MM-DD)')
  .option('-s, --store <store>', '门店编号')
  .option('-D, --data-dir <dir>', '数据存储目录', './data')
  .option('-o, --output <file>', '报告输出路径')
  .action((options) => {
    try {
      const manager = new ReconciliationManager(options.dataDir);
      const result = manager.reconcile(options.date, options.store);
      
      console.log(reportGenerator.formatConsoleReport(result));
      
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(chalk.green(`\n✓ 报告已保存到: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ 核对失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('add-note')
  .description('添加调查备注')
  .option('-d, --date <date>', '核对日期 (YYYY-MM-DD)')
  .option('-s, --store <store>', '门店编号')
  .option('-c, --cashier <cashier>', '收银员编号')
  .option('-n, --note <note>', '备注内容')
  .option('-D, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    try {
      const manager = new ReconciliationManager(options.dataDir);
      manager.addNote(options.date, options.store, options.cashier, options.note);
      console.log(chalk.green('✓ 备注添加成功'));
    } catch (error) {
      console.error(chalk.red(`✗ 添加备注失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('regenerate-report')
  .description('重新生成责任报告')
  .option('-d, --date <date>', '核对日期 (YYYY-MM-DD)')
  .option('-s, --store <store>', '门店编号')
  .option('-D, --data-dir <dir>', '数据存储目录', './data')
  .option('-o, --output <file>', '报告输出路径')
  .action((options) => {
    try {
      const manager = new ReconciliationManager(options.dataDir);
      const result = manager.regenerateReport(options.date, options.store);
      
      console.log(reportGenerator.formatConsoleReport(result));
      
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(chalk.green(`\n✓ 报告已保存到: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ 生成报告失败: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
