const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('../utils/config');
const rules = require('../utils/rules');

function checkCommand() {
  try {
    config.ensureInitialized();
    console.log(chalk.blue('\n=== 执行规则检查 ===\n'));
    
    const sendLogs = config.getData('send');
    const bounces = config.getData('bounce');
    const retries = config.getData('retry');
    const sources = config.getData('source');
    const unsubscribed = config.getData('unsubscribed');
    const existingStatus = config.getData('status');
    
    const allEmails = [...new Set(sendLogs.map(s => s.email))];
    console.log(chalk.cyan(`检查 ${allEmails.length} 个邮箱...\n`));
    
    const statusMap = new Map(existingStatus.map(s => [s.email, s]));
    const changes = [];
    const attributions = [];
    
    allEmails.forEach(email => {
      const analysis = rules.analyzeEmail(email, sendLogs, bounces, retries, sources, unsubscribed);
      const existing = statusMap.get(email);
      
      const isManuallyUpdated = existing && existing.manuallyUpdated;
      const finalStatus = isManuallyUpdated ? existing.status : analysis.status;
      
      const attribution = {
        email,
        domain: analysis.domain,
        domainCategory: analysis.domainCategory,
        source: analysis.source,
        status: finalStatus,
        bounceType: analysis.latestBounce ? analysis.latestBounce.type : null,
        bounceCategory: analysis.latestBounce ? analysis.latestBounce.category : null,
        bounceCount: analysis.bounceCount,
        retryCount: analysis.retryCount,
        successfulRetries: analysis.successfulRetries,
        shouldRetry: analysis.retryInfo.shouldRetry && finalStatus !== 'invalid' && finalStatus !== 'unsubscribed',
        retryReason: analysis.retryInfo.reason,
        isUnsubscribed: analysis.isUnsubscribed || finalStatus === 'unsubscribed',
        manuallyUpdated: isManuallyUpdated
      };
      attributions.push(attribution);
      
      const newStatus = {
        email,
        ...analysis,
        status: finalStatus,
        manuallyUpdated: isManuallyUpdated,
        analyzedAt: new Date().toISOString()
      };
      
      if (!existing) {
        changes.push({
          type: 'new',
          email,
          oldStatus: null,
          newStatus: finalStatus,
          reason: getStatusReason(analysis)
        });
      } else if (existing.status !== finalStatus && !isManuallyUpdated) {
        changes.push({
          type: 'changed',
          email,
          oldStatus: existing.status,
          newStatus: finalStatus,
          reason: getStatusReason(analysis)
        });
        
        config.addHistoryEntry('status', email, {
          action: 'status_changed',
          before: { status: existing.status },
          after: { status: finalStatus },
          reason: getStatusReason(analysis)
        });
      }
      
      statusMap.set(email, newStatus);
    });
    
    const newStatusList = Array.from(statusMap.values());
    config.saveData('status', newStatusList);
    config.saveData('attribution', attributions);
    
    const stats = calculateStatistics(newStatusList, attributions);
    
    displayResults(changes, stats);
    
  } catch (error) {
    console.error(chalk.red('\n✗ 检查失败：'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getStatusReason(analysis) {
  if (analysis.isUnsubscribed) {
    return '用户已退订';
  }
  if (analysis.bounceCount === 0) {
    return '无退信记录';
  }
  if (analysis.successfulRetries > 0) {
    return '重试成功';
  }
  if (analysis.latestBounce) {
    return analysis.latestBounce.desc;
  }
  return '状态更新';
}

function calculateStatistics(statusList, attributions) {
  const stats = {
    total: statusList.length,
    byStatus: {
      valid: statusList.filter(s => s.status === 'valid').length,
      invalid: statusList.filter(s => s.status === 'invalid').length,
      temporary_bounce: statusList.filter(s => s.status === 'temporary_bounce').length,
      unsubscribed: statusList.filter(s => s.status === 'unsubscribed').length,
      needs_review: statusList.filter(s => s.status === 'needs_review').length
    },
    byDomain: {},
    bySource: {},
    byBounceType: {
      permanent: 0,
      temporary: 0,
      unknown: 0
    },
    retryable: 0
  };
  
  attributions.forEach(a => {
    if (a.shouldRetry) stats.retryable++;
    if (a.bounceType === 'permanent') stats.byBounceType.permanent++;
    else if (a.bounceType === 'temporary') stats.byBounceType.temporary++;
    else if (a.bounceType) stats.byBounceType.unknown++;
    
    if (!stats.byDomain[a.domain]) {
      stats.byDomain[a.domain] = { count: 0, bounces: 0, invalid: 0 };
    }
    stats.byDomain[a.domain].count++;
    if (a.bounceCount > 0) stats.byDomain[a.domain].bounces++;
    if (a.status === 'invalid') stats.byDomain[a.domain].invalid++;
    
    if (!stats.bySource[a.source]) {
      stats.bySource[a.source] = { count: 0, bounces: 0, invalid: 0 };
    }
    stats.bySource[a.source].count++;
    if (a.bounceCount > 0) stats.bySource[a.source].bounces++;
    if (a.status === 'invalid') stats.bySource[a.source].invalid++;
  });
  
  return stats;
}

function displayResults(changes, stats) {
  console.log(chalk.cyan('\n--- 状态变化 ---\n'));
  
  if (changes.length === 0) {
    console.log(chalk.gray('  无状态变化\n'));
  } else {
    const table = new Table({
      head: ['类型', '邮箱', '旧状态', '新状态', '原因'],
      colWidths: [10, 35, 15, 15, 40]
    });
    
    changes.forEach(change => {
      table.push([
        change.type === 'new' ? chalk.blue('新增') : chalk.yellow('变更'),
        change.email,
        change.oldStatus || '-',
        formatStatus(change.newStatus),
        change.reason
      ]);
    });
    console.log(table.toString() + '\n');
  }
  
  console.log(chalk.cyan('\n--- 统计概览 ---\n'));
  
  const statsTable = new Table({
    head: ['指标', '数量', '占比'],
    colWidths: [25, 10, 15]
  });
  
  const total = stats.total;
  statsTable.push(['总邮箱数', total, '100%']);
  statsTable.push([formatStatus('valid'), stats.byStatus.valid, `${((stats.byStatus.valid / total) * 100).toFixed(1)}%`]);
  statsTable.push([formatStatus('invalid'), stats.byStatus.invalid, `${((stats.byStatus.invalid / total) * 100).toFixed(1)}%`]);
  statsTable.push([formatStatus('temporary_bounce'), stats.byStatus.temporary_bounce, `${((stats.byStatus.temporary_bounce / total) * 100).toFixed(1)}%`]);
  statsTable.push([formatStatus('unsubscribed'), stats.byStatus.unsubscribed, `${((stats.byStatus.unsubscribed / total) * 100).toFixed(1)}%`]);
  statsTable.push([formatStatus('needs_review'), stats.byStatus.needs_review, `${((stats.byStatus.needs_review / total) * 100).toFixed(1)}%`]);
  statsTable.push([chalk.cyan('可重试'), stats.retryable, `${((stats.retryable / total) * 100).toFixed(1)}%`]);
  
  console.log(statsTable.toString() + '\n');
  
  console.log(chalk.cyan('下一步操作：'));
  console.log('  ' + chalk.white('bounce report') + ' - 生成完整归因报告');
  console.log('  ' + chalk.white('bounce detail <email>') + ' - 查看特定邮箱详情');
  console.log();
}

function formatStatus(status) {
  const mapping = {
    valid: chalk.green('有效'),
    invalid: chalk.red('无效'),
    temporary_bounce: chalk.yellow('临时退信'),
    unsubscribed: chalk.magenta('已退订'),
    needs_review: chalk.blue('需审核')
  };
  return mapping[status] || status;
}

module.exports = checkCommand;
