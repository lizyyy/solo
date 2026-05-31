const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Importer } = require('../utils/Importer');
const { Storage } = require('../utils/Storage');

const importCommand = new Command('import')
  .description('导入数据: 训练日志、标注、评估结果')
  .argument('<file>', '导入文件路径')
  .option('-t, --type <type>', '文件类型: auto|training_log|annotations|evaluation|defects', 'auto')
  .option('-v, --verbose', '显示详细信息')
  .action(async (file, options) => {
    const storage = new Storage();
    const importer = new Importer(storage);
    
    console.log(chalk.blue(`\n开始导入: ${file}`));
    console.log(chalk.gray(`检测类型: ${options.type}\n`));
    
    const result = await importer.importFile(file, options.type);
    
    if (result.success) {
      console.log(chalk.green('✓ 导入完成'));
      
      const table = new Table({
        head: ['项目', '数量'],
        style: { head: ['cyan'] }
      });
      table.push(['成功导入', result.stats.imported]);
      table.push(['跳过', result.stats.skipped]);
      table.push(['警告', result.stats.warnings]);
      table.push(['错误', result.stats.errors]);
      console.log(table.toString());
      
      if (options.verbose && result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  警告详情:'));
        result.warnings.slice(0, 10).forEach(w => {
          console.log(chalk.yellow(`  - ${w.message}`));
        });
        if (result.warnings.length > 10) {
          console.log(chalk.yellow(`  ... 还有 ${result.warnings.length - 10} 条警告`));
        }
      }
      
      const stats = storage.getStats();
      console.log(chalk.gray(`\n当前数据库: ${stats.total.defects} 缺陷, ${stats.total.annotations} 标注, ${stats.total.logs} 日志`));
    } else {
      console.log(chalk.red('✗ 导入失败'));
      result.errors.forEach(e => {
        console.log(chalk.red(`  - ${e.message}`));
      });
      process.exit(1);
    }
  });

module.exports = { importCommand };
