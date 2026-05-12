const { Command } = require('commander');
const { initStorage, isInitialized } = require('../utils/storage');
const { getSampleData } = require('../data/sampleData');
const chalk = require('chalk');

const command = new Command('init')
  .description('初始化隐患管理数据目录')
  .option('--sample', '使用内置样例数据初始化')
  .option('--force', '强制重新初始化（覆盖现有数据）')
  .action((options) => {
    if (isInitialized() && !options.force) {
      console.log(chalk.yellow('⚠️  数据目录已存在，使用 --force 强制重新初始化'));
      return;
    }

    let sampleData = null;
    if (options.sample) {
      sampleData = getSampleData();
      console.log(chalk.cyan('📦 正在加载内置样例数据...'));
    }

    initStorage(sampleData);
    console.log(chalk.green('✅ 隐患管理数据目录初始化完成'));
    console.log(chalk.gray('   数据目录: .hazard-data/'));
    
    if (options.sample) {
      console.log(chalk.cyan('📊 样例数据已加载：'));
      console.log(chalk.cyan(`   - ${sampleData.hazards.length} 条隐患记录`));
      console.log(chalk.cyan(`   - ${sampleData.teams.length} 个责任班组`));
      console.log(chalk.cyan(`   - ${sampleData.rectifications.length} 条整改记录`));
      console.log(chalk.cyan(`   - ${sampleData.reviews.length} 条复查记录`));
      console.log(chalk.cyan(`   - ${sampleData.fines.length} 条罚款记录`));
    }
  });

module.exports = command;
