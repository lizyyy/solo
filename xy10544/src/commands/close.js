const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { closeHazard } = require('../core/hazardService');
const { getHazardById, colorizeStatus } = require('../utils/helpers');
const chalk = require('chalk');

const command = new Command('close')
  .description('关闭隐患（完成闭环）')
  .argument('<hazardId>', '隐患ID')
  .action((hazardId) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    const result = closeHazard(hazardId);

    if (result.success) {
      if (result.isIdempotent) {
        console.log(chalk.yellow(`⚠️  ${result.message}`));
      } else {
        console.log(chalk.green('✅ 隐患闭环成功！'));
      }
      console.log(chalk.cyan(`   隐患状态: ${colorizeStatus(result.hazard.status)}`));
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

module.exports = command;
