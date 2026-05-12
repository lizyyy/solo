const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { submitRectification } = require('../core/rectificationService');
const { updateHazardStatus } = require('../core/hazardService');
const { HAZARD_STATUS } = require('../utils/constants');
const { getHazardById, colorizeStatus } = require('../utils/helpers');
const chalk = require('chalk');

const command = new Command('rectify')
  .description('提交整改反馈')
  .argument('<hazardId>', '隐患ID')
  .option('-d, --description <text>', '整改描述')
  .option('-i, --images <list>', '整改照片（逗号分隔）')
  .option('-r, --rectifier <name>', '整改人')
  .action((hazardId, options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    const hazard = getHazardById(hazardId);
    if (!hazard) {
      console.log(chalk.red(`❌ 隐患不存在: ${hazardId}`));
      return;
    }

    if (hazard.status === HAZARD_STATUS.DISCOVERED) {
      updateHazardStatus(hazardId, HAZARD_STATUS.RECTIFYING);
    }

    let images = [];
    if (options.images) {
      images = options.images.split(',').map(i => i.trim());
    }

    const rectificationData = {
      description: options.description || '已完成整改',
      images,
      rectifier: options.rectifier || 'system'
    };

    const result = submitRectification(hazardId, rectificationData);

    if (result.success) {
      if (result.isIdempotent) {
        console.log(chalk.yellow(`⚠️  ${result.message}`));
        console.log(chalk.gray(`   整改ID: ${result.rectification.id}`));
      } else {
        console.log(chalk.green('✅ 整改提交成功！'));
        console.log(chalk.cyan(`   整改ID: ${result.rectification.id}`));
        console.log(chalk.cyan(`   整改人: ${result.rectification.rectifier}`));
        console.log(chalk.cyan(`   照片数量: ${result.rectification.images.length} 张`));
      }
      console.log(chalk.cyan(`   隐患状态: ${colorizeStatus(result.hazard.status)}`));
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

module.exports = command;
