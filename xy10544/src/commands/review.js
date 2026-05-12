const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { submitReview } = require('../core/reviewService');
const { getHazardById, colorizeStatus } = require('../utils/helpers');
const { REVIEW_RESULT } = require('../utils/constants');
const chalk = require('chalk');

const command = new Command('review')
  .description('提交复查记录')
  .argument('<hazardId>', '隐患ID')
  .option('-r, --result <result>', '复查结果: passed|failed')
  .option('-c, --comment <text>', '复查意见')
  .option('-v, --reviewer <name>', '复查人')
  .option('-i, --images <list>', '复查照片（逗号分隔）')
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

    if (!options.result) {
      console.log(chalk.red('❌ 请指定复查结果: --result passed 或 --result failed'));
      return;
    }

    const validResults = Object.values(REVIEW_RESULT);
    if (!validResults.includes(options.result)) {
      console.log(chalk.red(`❌ 无效的复查结果，有效值: ${validResults.join(', ')}`));
      return;
    }

    let images = [];
    if (options.images) {
      images = options.images.split(',').map(i => i.trim());
    }

    const reviewData = {
      result: options.result,
      comment: options.comment || '',
      reviewer: options.reviewer || 'system',
      images
    };

    const result = submitReview(hazardId, reviewData);

    if (result.success) {
      if (result.isIdempotent) {
        console.log(chalk.yellow(`⚠️  ${result.message}`));
      } else {
        console.log(chalk.green('✅ 复查提交成功！'));
        console.log(chalk.cyan(`   复查ID: ${result.review.id}`));
        console.log(chalk.cyan(`   复查人: ${result.review.reviewer}`));
        console.log(chalk.cyan(`   复查结果: ${result.review.result === 'passed' ? '通过' : '不通过'}`));
        if (result.needsSecondReview) {
          console.log(chalk.yellow(`   ⚠️  重大/特大隐患需要二次复查验证才能闭环`));
        }
      }
      console.log(chalk.cyan(`   隐患状态: ${colorizeStatus(result.hazard.status)}`));
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

module.exports = command;
