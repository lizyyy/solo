const chalk = require('chalk');
const validator = require('../validator');
const { TYPES } = require('../models');
const storage = require('../storage');

module.exports = {
  command: 'check',
  aliases: ['c'],
  describe: '运行异常检查，包括重复、数据有效性、业务逻辑等',
  builder: {
    detailed: {
      alias: 'd',
      describe: '显示详细错误信息',
      type: 'boolean',
      default: true
    },
    type: {
      alias: 't',
      describe: '只检查特定类型 (delivery/return/refund/history)',
      type: 'string',
      choices: ['delivery', 'return', 'refund', 'history', 'all'],
      default: 'all'
    }
  },
  handler: function(argv) {
    const { detailed, type } = argv;
    
    console.log(chalk.blue('\n🔍 运行异常检查...\n'));
    
    const result = validator.runAllChecks();
    const { errors, warnings, all } = result;
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log(chalk.green('✅ 所有检查通过！数据完整有效。'));
      printStagingStatus();
      console.log(chalk.gray('\n💡 提示: 运行 \'water-deposit confirm\' 确认入账'));
      return;
    }
    
    if (errors.length > 0) {
      console.log(chalk.red(`❌ 发现 ${errors.length} 个错误（必须修正）：\n`));
      printIssues(errors, detailed);
    }
    
    if (warnings.length > 0) {
      console.log(chalk.yellow(`⚠️  发现 ${warnings.length} 个警告（建议关注）：\n`));
      printIssues(warnings, detailed, true);
    }
    
    if (errors.length > 0) {
      console.log(chalk.red('\n✗ 存在错误，请修正后重新检查'));
      console.log(chalk.gray('💡 提示: 运行 \'water-deposit fix\' 进行人工修正'));
      process.exitCode = 1;
    } else {
      console.log(chalk.green('\n✓ 无错误，可以确认入账'));
      console.log(chalk.gray('💡 提示: 运行 \'water-deposit confirm\' 确认入账，警告信息会在报表中显示'));
    }
  }
};

function printIssues(issues, detailed, isWarning = false) {
  const grouped = {};
  issues.forEach(issue => {
    const type = issue.type || 'UNKNOWN';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(issue);
  });
  
  const prefixColor = isWarning ? chalk.yellow : chalk.yellow;
  
  Object.entries(grouped).forEach(([type, items]) => {
    console.log(prefixColor(`【${getTypeLabel(type)}】${items.length} 条`));
    
    if (detailed) {
      items.forEach((item, idx) => {
        console.log(chalk.gray(`   ${idx + 1}. ${formatIssue(item)}`));
      });
    }
    console.log('');
  });
}

function getTypeLabel(type) {
  const labels = {
    'VALIDATION': '数据校验',
    'DUPLICATE': '重复记录',
    'OVER_RETURN': '超量回收',
    'REFUND_WITHOUT_BUCKETS': '退押金欠桶',
    'DELIVERY_PERSON_SHORT': '配送员差异',
    'UNKNOWN': '未知异常'
  };
  return labels[type] || type;
}

function formatIssue(issue) {
  switch (issue.type) {
    case 'VALIDATION':
      return `第${issue.index}条 [${issue.id}] ${issue.customer}: ${issue.issues?.join(', ') || issue.message}`;
    
    case 'OVER_RETURN':
      return `${issue.customer}: 配送${issue.delivered}桶 + 历史${issue.historyOwed}桶 = ${issue.totalAvailable}桶 → 回收${issue.returned}桶，多回收${issue.excess}桶`;
    
    case 'REFUND_WITHOUT_BUCKETS':
      return `${issue.customer}: 配送${issue.delivered}桶 + 历史${issue.historyOwed}桶 - 回收${issue.returned}桶 = 净欠${issue.netOwed}桶 → 已退${issue.refunded}桶押金，仍欠${issue.netOwed}桶`;
    
    case 'DELIVERY_PERSON_SHORT':
      return `${issue.person}: 配送${issue.delivered}桶 → 回收${issue.returned}桶，未交回${issue.unaccounted}桶`;
    
    default:
      return issue.message || JSON.stringify(issue);
  }
}

function printStagingStatus() {
  const types = [
    { key: TYPES.DELIVERY, label: '配送单' },
    { key: TYPES.RETURN, label: '回收单' },
    { key: TYPES.REFUND, label: '退款申请' },
    { key: TYPES.HISTORY, label: '历史欠桶' }
  ];
  
  console.log(chalk.cyan('\n📊 当前 staging 数据状态:'));
  types.forEach(t => {
    const staging = storage.getStagingData(t.key).length;
    const confirmed = storage.getConfirmedData(t.key).length;
    console.log(chalk.gray(`   ${t.label}: ${staging} 条待确认, ${confirmed} 条已入账`));
  });
}
