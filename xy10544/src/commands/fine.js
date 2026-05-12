const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { createFine, markFinePaid } = require('../core/fineService');
const { getHazardById, getTeamById } = require('../utils/helpers');
const chalk = require('chalk');

const command = new Command('fine')
  .description('罚款管理（创建、标记已缴）')
  .option('--create <hazardId>', '为隐患创建罚款记录')
  .option('--pay <fineId>', '标记罚款已缴纳')
  .option('-a, --amount <number>', '罚款金额（默认自动计算）')
  .option('-r, --reason <text>', '罚款原因')
  .option('-o, --operator <name>', '操作人')
  .action((options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    if (options.create) {
      createFineAction(options);
    } else if (options.pay) {
      payFineAction(options.pay);
    } else {
      console.log(chalk.yellow('⚠️  请指定操作'));
      console.log(chalk.gray('   创建罚款: hazard fine --create <hazardId>'));
      console.log(chalk.gray('   标记缴纳: hazard fine --pay <fineId>'));
    }
  });

function createFineAction(options) {
  const hazardId = options.create;
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    console.log(chalk.red(`❌ 隐患不存在: ${hazardId}`));
    return;
  }

  const fineData = {};
  if (options.amount) {
    fineData.amount = parseInt(options.amount);
  }
  if (options.reason) {
    fineData.reason = options.reason;
  }
  if (options.operator) {
    fineData.operator = options.operator;
  }

  const result = createFine(hazardId, fineData);

  if (result.success) {
    const team = getTeamById(result.fine.teamId);
    
    if (result.isIdempotent) {
      console.log(chalk.yellow(`⚠️  ${result.message}`));
    } else {
      console.log(chalk.green('✅ 罚款记录创建成功！'));
      console.log(chalk.cyan(`   罚款ID: ${result.fine.id}`));
      console.log(chalk.cyan(`   隐患ID: ${result.fine.hazardId}`));
      console.log(chalk.cyan(`   责任班组: ${team ? team.name : result.fine.teamId}`));
      console.log(chalk.cyan(`   罚款金额: ¥${result.fine.amount.toLocaleString()}`));
      console.log(chalk.cyan(`   罚款原因: ${result.fine.reason}`));
    }
  } else {
    console.log(chalk.red(`❌ ${result.message}`));
  }
}

function payFineAction(fineId) {
  const result = markFinePaid(fineId);

  if (result.success) {
    if (result.isIdempotent) {
      console.log(chalk.yellow(`⚠️  ${result.message}`));
    } else {
      console.log(chalk.green('✅ 罚款已标记为已缴纳！'));
      console.log(chalk.cyan(`   缴纳时间: ${new Date(result.fine.paidAt).toLocaleString('zh-CN')}`));
    }
  } else {
    console.log(chalk.red(`❌ ${result.message}`));
  }
}

module.exports = command;
