const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { getAuditByEntity } = require('../utils/audit');
const { getHazardById, formatDateTime, colorizeStatus } = require('../utils/helpers');
const { HAZARD_STATUS } = require('../utils/constants');
const chalk = require('chalk');

const command = new Command('history')
  .description('查看操作历史记录')
  .option('--hazard <hazardId>', '查看指定隐患的历史')
  .option('--limit <number>', '显示条数限制 (默认: 20)')
  .action((options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    if (options.hazard) {
      showHazardHistory(options.hazard);
    } else {
      console.log(chalk.yellow('⚠️  请指定查看范围'));
      console.log(chalk.gray('   用法: hazard history --hazard <hazardId>'));
    }
  });

function showHazardHistory(hazardId) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    console.log(chalk.red(`❌ 隐患不存在: ${hazardId}`));
    return;
  }

  const audit = getAuditByEntity('hazard', hazardId);

  if (audit.length === 0) {
    console.log(chalk.yellow('ℹ️  暂无操作历史记录'));
    return;
  }

  console.log(chalk.bold.cyan(`📜 隐患 ${hazardId} 操作历史`));
  console.log(chalk.gray('━'.repeat(80)));
  console.log(`当前状态: ${colorizeStatus(hazard.status)}`);
  console.log();

  audit.forEach((entry, index) => {
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.cyan(`[${index + 1}] ${formatActionName(entry.action)}`));
    console.log(chalk.gray(`    时间: ${formatDateTime(entry.createdAt)}`));

    switch (entry.action) {
      case 'create':
        console.log(`    操作: 创建隐患`);
        console.log(`    类型: ${entry.details.type}`);
        console.log(`    位置: ${entry.details.location}`);
        console.log(`    等级: ${entry.details.level}`);
        break;

      case 'status_change':
        console.log(`    状态变更: ${entry.details.oldStatus} → ${entry.details.newStatus}`);
        if (entry.details.rectificationCount !== undefined) {
          console.log(`    整改次数: ${entry.details.rectificationCount}`);
        }
        if (entry.details.reviewFailCount !== undefined) {
          console.log(`    复查失败: ${entry.details.reviewFailCount} 次`);
        }
        break;

      case 'rectify':
        console.log(`    操作: 提交整改`);
        console.log(`    整改人: ${entry.details.rectifier}`);
        console.log(`    照片数: ${entry.details.imageCount} 张`);
        break;

      case 'review':
        console.log(`    操作: 提交复查`);
        console.log(`    复查人: ${entry.details.reviewer}`);
        console.log(`    结果: ${entry.details.result === 'passed' ? '通过' : '不通过'}`);
        if (entry.details.isReopened) {
          console.log(chalk.yellow(`    状态: 隐患被重新打开`));
        }
        break;

      case 'amend':
        console.log(`    操作: 人工修正`);
        console.log(`    操作人: ${entry.details.operator}`);
        console.log(`    变更明细:`);
        for (const [key, diff] of Object.entries(entry.details.oldValue || {})) {
          console.log(chalk.red(`      - ${key}: ${JSON.stringify(diff)} → ${JSON.stringify(entry.details.newValue?.[key])}`));
        }
        break;

      case 'fine':
        console.log(`    操作: 生成罚款`);
        console.log(`    金额: ¥${entry.details.amount?.toLocaleString() || '未知'}`);
        break;

      default:
        console.log(`    详情: ${JSON.stringify(entry.details)}`);
    }
  });

  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.gray(`共 ${audit.length} 条记录`));
}

function formatActionName(action) {
  const actionMap = {
    'create': '创建隐患',
    'status_change': '状态变更',
    'rectify': '提交整改',
    'review': '提交复查',
    'amend': '人工修正',
    'fine': '生成罚款'
  };
  return actionMap[action] || action;
}

module.exports = command;
