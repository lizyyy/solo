const chalk = require('chalk');
const reporter = require('../reporter');
const dayjs = require('dayjs');

module.exports = {
  command: 'report [type]',
  aliases: ['r'],
  describe: '输出对账报表：customers(客户欠桶) / person(配送员差异) / weekly(本周押金变动) / all(全部)',
  builder: {
    type: {
      describe: '报表类型',
      choices: ['customers', 'person', 'weekly', 'all'],
      default: 'all',
      type: 'string'
    },
    weeks: {
      alias: 'w',
      describe: '查看几周前的数据 (weekly报表专用)',
      type: 'number',
      default: 0
    },
    json: {
      alias: 'j',
      describe: '输出 JSON 格式',
      type: 'boolean',
      default: false
    }
  },
  handler: function(argv) {
    const { type, weeks, json } = argv;
    
    if (json) {
      outputJson(type, weeks);
      return;
    }
    
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('           📊 水站桶装水押金对账报表'));
    console.log(chalk.cyan('           生成时间: ' + dayjs().format('YYYY-MM-DD HH:mm:ss')));
    console.log(chalk.cyan('='.repeat(60) + '\n'));
    
    if (type === 'all' || type === 'customers') {
      reportCustomers();
    }
    
    if (type === 'all' || type === 'person') {
      reportDeliveryPerson();
    }
    
    if (type === 'all' || type === 'weekly') {
      reportWeekly(weeks);
    }
    
    console.log(chalk.gray('\n' + '='.repeat(60)));
  }
};

function reportCustomers() {
  const stats = reporter.calculateCustomerOwedBuckets();
  
  console.log(chalk.green('\n📋 【客户欠桶统计】'));
  console.log(chalk.gray('-'.repeat(40)));
  
  if (stats.length === 0) {
    console.log(chalk.gray('   暂无数据'));
    return;
  }
  
  let totalOwed = 0;
  let totalDeposit = 0;
  
  stats.forEach((s, idx) => {
    totalOwed += s.netOwed;
    totalDeposit += s.netDeposit;
    
    const status = s.netOwed > 0 ? chalk.red('欠') : s.netOwed < 0 ? chalk.green('超') : chalk.gray('平');
    console.log(chalk.white(`   ${idx + 1}. ${s.customer}`));
    console.log(chalk.gray(`      配送:${s.delivered}桶 + 历史:${s.historyOwed}桶 - 回收:${s.returned}桶`));
    console.log(chalk.gray(`      押金: ¥${s.totalDeposit.toFixed(2)} - 已退: ¥${s.refunded.toFixed(2)}`));
    console.log(`      ${status} 桶数: ${chalk.bold(Math.abs(s.netOwed))}桶, 押金: ${chalk.bold('¥' + Math.abs(s.netDeposit).toFixed(2))}`);
    console.log('');
  });
  
  console.log(chalk.cyan(`   总计: ${stats.length}位客户, 欠桶 ${chalk.bold(totalOwed)}桶, 押金余额 ${chalk.bold('¥' + totalDeposit.toFixed(2))}`));
}

function reportDeliveryPerson() {
  const stats = reporter.calculateDeliveryPersonStats();
  
  console.log(chalk.green('\n👷 【配送员桶数差异】'));
  console.log(chalk.gray('-'.repeat(40)));
  
  if (stats.length === 0) {
    console.log(chalk.gray('   暂无数据'));
    return;
  }
  
  let totalDiff = 0;
  
  stats.forEach((s, idx) => {
    totalDiff += s.difference;
    
    const status = s.difference > 0 ? chalk.red('未交') : s.difference < 0 ? chalk.green('超额') : chalk.gray('正常');
    console.log(chalk.white(`   ${idx + 1}. ${s.person}`));
    console.log(chalk.gray(`      配送:${s.delivered}桶, 回收:${s.returned}桶`));
    console.log(`      ${status}: ${chalk.bold(Math.abs(s.difference))}桶`);
    console.log('');
  });
  
  console.log(chalk.cyan(`   总计: ${stats.length}位配送员, 差异桶数: ${chalk.bold(totalDiff)}桶`));
}

function reportWeekly(weeks) {
  const weekly = reporter.calculateWeeklyDepositChanges(weeks);
  
  const periodLabel = weeks === 0 ? '本周' : `${weeks}周前`;
  console.log(chalk.green(`\n💰 【${periodLabel}押金变动】`));
  console.log(chalk.gray('-'.repeat(40)));
  console.log(chalk.gray(`   统计周期: ${weekly.period}`));
  console.log('');
  
  console.log(chalk.green(`   押金收入: +${chalk.bold('¥' + weekly.depositIn.toFixed(2))}`));
  console.log(chalk.gray(`   (配送单数: ${weekly.deliveryCount} 单)`));
  console.log('');
  
  console.log(chalk.red(`   押金支出: -${chalk.bold('¥' + weekly.depositOut.toFixed(2))}`));
  console.log(chalk.gray(`   (退款单数: ${weekly.refundCount} 单)`));
  console.log('');
  
  const netLabel = weekly.netChange >= 0 ? '净增加' : '净减少';
  const netColor = weekly.netChange >= 0 ? chalk.green : chalk.red;
  console.log(netColor(`   ${netLabel}: ${chalk.bold('¥' + Math.abs(weekly.netChange).toFixed(2))}`));
}

function outputJson(type, weeks) {
  const result = {};
  
  if (type === 'all' || type === 'customers') {
    result.customers = reporter.calculateCustomerOwedBuckets();
  }
  
  if (type === 'all' || type === 'person') {
    result.deliveryPersons = reporter.calculateDeliveryPersonStats();
  }
  
  if (type === 'all' || type === 'weekly') {
    result.weekly = reporter.calculateWeeklyDepositChanges(weeks);
  }
  
  console.log(JSON.stringify(result, null, 2));
}
