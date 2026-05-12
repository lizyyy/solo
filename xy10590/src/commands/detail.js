const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('../utils/config');
const rules = require('../utils/rules');

const validManualStatuses = ['valid', 'invalid', 'unsubscribed'];

function detailCommand(email, options) {
  try {
    config.ensureInitialized();
    
    const sendLogs = config.getData('send');
    const bounces = config.getData('bounce');
    const retries = config.getData('retry');
    const sources = config.getData('source');
    const unsubscribed = config.getData('unsubscribed');
    const statusList = config.getData('status');
    
    const existingEmail = sendLogs.find(s => s.email === email);
    if (!existingEmail) {
      console.error(chalk.red(`\n✗ 未找到邮箱: ${email}`));
      console.log(chalk.gray('  请确认该邮箱存在于发送日志中'));
      process.exit(1);
    }
    
    if (options.manual) {
      handleManualCorrection(email, options, statusList, unsubscribed);
      return;
    }
    
    console.log(chalk.blue(`\n=== 邮箱详情: ${email} ===\n`));
    
    const analysis = rules.analyzeEmail(email, sendLogs, bounces, retries, sources, unsubscribed);
    const history = config.getHistory('status', email);
    
    displayBasicInfo(analysis);
    displayBounceHistory(analysis.bounceHistory);
    displayRetryHistory(analysis.retryHistory);
    displayStatusHistory(history);
    
    console.log(chalk.cyan('\n操作建议：'));
    if (analysis.retryInfo.shouldRetry) {
      console.log(chalk.green(`  ✓ 可以重试: ${analysis.retryInfo.reason}`));
      if (analysis.retryInfo.waitDays) {
        console.log(chalk.gray(`    建议等待 ${analysis.retryInfo.waitDays} 天后重试`));
      }
    } else {
      console.log(chalk.red(`  ✗ 不建议重试: ${analysis.retryInfo.reason}`));
    }
    
    console.log(chalk.cyan('\n人工修正命令：'));
    console.log(chalk.white(`  bounce detail ${email} --manual valid --operator your_name --reason "人工验证有效"`));
    console.log(chalk.white(`  bounce detail ${email} --manual invalid --operator your_name --reason "确认邮箱不存在"`));
    console.log();
    
  } catch (error) {
    console.error(chalk.red('\n✗ 错误：'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function handleManualCorrection(email, options, statusList, unsubscribed) {
  const newStatus = options.manual.toLowerCase();
  
  if (!validManualStatuses.includes(newStatus)) {
    console.error(chalk.red(`\n✗ 无效的状态: ${newStatus}`));
    console.log(chalk.yellow(`  有效状态: ${validManualStatuses.join(', ')}`));
    process.exit(1);
  }
  
  if (!options.operator) {
    console.error(chalk.red('\n✗ 请指定 --operator 参数（操作者名称）'));
    process.exit(1);
  }
  
  console.log(chalk.yellow('\n=== 人工修正 ===\n'));
  
  const currentStatus = statusList.find(s => s.email === email);
  const oldStatus = currentStatus ? currentStatus.status : 'unknown';
  
  if (oldStatus === newStatus) {
    console.log(chalk.gray(`  状态已为 "${newStatus}"，无需修改\n`));
    return;
  }
  
  console.log(chalk.cyan('  变更前:'), formatStatus(oldStatus));
  console.log(chalk.cyan('  变更后:'), formatStatus(newStatus));
  console.log(chalk.cyan('  操作者:'), options.operator);
  console.log(chalk.cyan('  原因:'), options.reason || '未提供');
  
  const updatedStatusList = statusList.map(s => {
    if (s.email === email) {
      return { ...s, status: newStatus, manuallyUpdated: true, updatedAt: new Date().toISOString() };
    }
    return s;
  });
  
  if (!statusList.find(s => s.email === email)) {
    updatedStatusList.push({
      email,
      status: newStatus,
      manuallyUpdated: true,
      updatedAt: new Date().toISOString()
    });
  }
  
  config.saveData('status', updatedStatusList);
  
  let updatedUnsubscribed = [...unsubscribed];
  if (newStatus === 'unsubscribed' && !unsubscribed.includes(email)) {
    updatedUnsubscribed.push(email);
  } else if (newStatus !== 'unsubscribed' && unsubscribed.includes(email)) {
    updatedUnsubscribed = updatedUnsubscribed.filter(e => e !== email);
  }
  config.saveData('unsubscribed', updatedUnsubscribed);
  
  config.addHistoryEntry('status', email, {
    action: 'manual_correction',
    operator: options.operator,
    before: { status: oldStatus },
    after: { status: newStatus },
    reason: options.reason || '人工修正'
  });
  
  console.log(chalk.green('\n✓ 人工修正已保存\n'));
}

function displayBasicInfo(analysis) {
  console.log(chalk.cyan('--- 基本信息 ---'));
  
  const table = new Table({
    head: ['字段', '值'],
    colWidths: [20, 60]
  });
  
  table.push(['邮箱', analysis.email]);
  table.push(['域名', analysis.domain]);
  table.push(['域名类型', formatDomainCategory(analysis.domainCategory)]);
  table.push(['名单来源', analysis.source]);
  table.push(['当前状态', formatStatus(analysis.status)]);
  table.push(['发送次数', analysis.sendCount]);
  table.push(['退信次数', analysis.bounceCount]);
  table.push(['重试次数', `${analysis.retryCount} (成功: ${analysis.successfulRetries})`]);
  table.push(['是否退订', analysis.isUnsubscribed ? chalk.red('是') : chalk.green('否')]);
  
  console.log(table.toString() + '\n');
}

function displayBounceHistory(bounceHistory) {
  console.log(chalk.cyan('--- 退信历史 ---'));
  
  if (bounceHistory.length === 0) {
    console.log(chalk.gray('  无退信记录\n'));
    return;
  }
  
  const table = new Table({
    head: ['时间', '退信码', '类型', '分类', '描述'],
    colWidths: [25, 12, 12, 18, 33]
  });
  
  bounceHistory.forEach(b => {
    table.push([
      new Date(b.timestamp).toLocaleString(),
      b.bounceCode || 'N/A',
      formatBounceType(b.type),
      b.category,
      b.desc
    ]);
  });
  
  console.log(table.toString() + '\n');
}

function displayRetryHistory(retryHistory) {
  console.log(chalk.cyan('--- 重试历史 ---'));
  
  if (retryHistory.length === 0) {
    console.log(chalk.gray('  无重试记录\n'));
    return;
  }
  
  const table = new Table({
    head: ['时间', '成功', '消息'],
    colWidths: [25, 8, 65]
  });
  
  retryHistory.forEach(r => {
    table.push([
      new Date(r.attemptedAt).toLocaleString(),
      r.success ? chalk.green('是') : chalk.red('否'),
      r.message
    ]);
  });
  
  console.log(table.toString() + '\n');
}

function displayStatusHistory(history) {
  console.log(chalk.cyan('--- 状态变更历史 ---'));
  
  if (history.length === 0) {
    console.log(chalk.gray('  无状态变更记录\n'));
    return;
  }
  
  const table = new Table({
    head: ['时间', '操作', '操作者', '变更'],
    colWidths: [25, 18, 15, 40]
  });
  
  history.forEach(h => {
    const change = h.before && h.after 
      ? `${formatStatus(h.before.status)} → ${formatStatus(h.after.status)}`
      : h.action;
    
    table.push([
      new Date(h.timestamp).toLocaleString(),
      h.action,
      h.operator || 'system',
      change
    ]);
  });
  
  console.log(table.toString() + '\n');
}

function formatStatus(status) {
  const mapping = {
    valid: chalk.green('有效'),
    invalid: chalk.red('无效'),
    temporary_bounce: chalk.yellow('临时退信'),
    unsubscribed: chalk.magenta('已退订'),
    needs_review: chalk.blue('需审核'),
    unknown: chalk.gray('未知')
  };
  return mapping[status] || status;
}

function formatDomainCategory(category) {
  const mapping = {
    enterprise: chalk.cyan('企业邮箱'),
    personal: chalk.green('个人邮箱'),
    free: chalk.yellow('免费邮箱'),
    other: chalk.gray('其他')
  };
  return mapping[category] || category;
}

function formatBounceType(type) {
  const mapping = {
    permanent: chalk.red('永久失败'),
    temporary: chalk.yellow('临时失败'),
    unknown: chalk.gray('未知')
  };
  return mapping[type] || type;
}

module.exports = detailCommand;
