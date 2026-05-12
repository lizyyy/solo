const Store = require('../utils/store');
const SampleDataGenerator = require('../utils/samples');
const chalk = require('chalk');

function initCommand(options) {
  console.log(chalk.blue('\n=== 初始化内容发布撤稿系统 ===\n'));
  
  const store = new Store();
  
  if (options.clear) {
    store.clear();
    console.log(chalk.yellow('已清空历史数据'));
  }
  
  console.log(chalk.green('✓ 数据目录已创建: data/'));
  console.log(chalk.green('✓ 存储文件已初始化: data/store.json'));
  
  if (options.samples) {
    const count = SampleDataGenerator.loadAllSamples(store);
    console.log(chalk.green(`✓ 已加载 ${count} 条内置样例数据`));
    console.log(chalk.gray('  样例类型: 新闻稿、活动页、产品说明、问题案例'));
  }
  
  console.log(chalk.cyan('\n提示: 运行 `npm run cli -- --help` 查看所有可用命令\n'));
  
  return { success: true };
}

module.exports = initCommand;
