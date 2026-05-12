const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('../utils/config');
const rules = require('../utils/rules');

function reportCommand(options) {
  try {
    config.ensureInitialized();
    console.log(chalk.blue('\n=== 邮件退信归因报告 ===\n'));
    
    const attributions = config.getData('attribution');
    
    if (attributions.length === 0) {
      console.log(chalk.yellow('⚠ 没有归因数据，请先运行 "bounce check"'));
      console.log();
      process.exit(0);
    }
    
    const reportData = generateReport(attributions);
    
    if (options.byDomain) {
      displayDomainReport(reportData);
    } else if (options.bySource) {
      displaySourceReport(reportData);
    } else if (options.byBounceCode) {
      displayBounceCodeReport(reportData);
    } else {
      displayFullReport(reportData);
    }
    
    if (options.clean) {
      exportCleanList(reportData);
    }
    
    if (options.retry) {
      exportRetryList(reportData);
    }
    
  } catch (error) {
    console.error(chalk.red('\n✗ 生成报告失败：'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function generateReport(attributions) {
  const report = {
    summary: {
      total: attributions.length,
      valid: 0,
      invalid: 0,
      temporary_bounce: 0,
      unsubscribed: 0,
      needs_review: 0,
      retryable: 0,
      qualityScore: 0
    },
    byDomain: {},
    bySource: {},
    byBounceCategory: {},
    issues: []
  };
  
  attributions.forEach(a => {
    report.summary[a.status]++;
    
    if (a.shouldRetry && a.status !== 'invalid' && a.status !== 'unsubscribed') {
      report.summary.retryable++;
    }
    
    if (!report.byDomain[a.domain]) {
      report.byDomain[a.domain] = {
        domain: a.domain,
        category: a.domainCategory,
        total: 0,
        bounces: 0,
        invalid: 0,
        temporary: 0,
        emails: []
      };
    }
    report.byDomain[a.domain].total++;
    if (a.bounceCount > 0) report.byDomain[a.domain].bounces++;
    if (a.status === 'invalid') report.byDomain[a.domain].invalid++;
    if (a.status === 'temporary_bounce') report.byDomain[a.domain].temporary++;
    report.byDomain[a.domain].emails.push(a);
    
    if (!report.bySource[a.source]) {
      report.bySource[a.source] = {
        source: a.source,
        total: 0,
        bounces: 0,
        invalid: 0,
        temporary: 0,
        emails: []
      };
    }
    report.bySource[a.source].total++;
    if (a.bounceCount > 0) report.bySource[a.source].bounces++;
    if (a.status === 'invalid') report.bySource[a.source].invalid++;
    if (a.status === 'temporary_bounce') report.bySource[a.source].temporary++;
    report.bySource[a.source].emails.push(a);
    
    if (a.bounceCategory) {
      if (!report.byBounceCategory[a.bounceCategory]) {
        report.byBounceCategory[a.bounceCategory] = {
          category: a.bounceCategory,
          type: a.bounceType,
          count: 0,
          emails: []
        };
      }
      report.byBounceCategory[a.bounceCategory].count++;
      report.byBounceCategory[a.bounceCategory].emails.push(a);
    }
    
    if (a.status === 'invalid') {
      report.issues.push({
        type: 'invalid_email',
        email: a.email,
        domain: a.domain,
        source: a.source,
        reason: a.latestBounce ? a.latestBounce.desc : '邮箱无效'
      });
    }
  });
  
  const validRate = report.summary.valid / report.summary.total;
  const invalidRate = report.summary.invalid / report.summary.total;
  const tempRate = report.summary.temporary_bounce / report.summary.total;
  report.summary.qualityScore = Math.round(
    (validRate * 100) + (tempRate * 30) - (invalidRate * 50) - (report.summary.unsubscribed * 10)
  );
  report.summary.qualityScore = Math.max(0, Math.min(100, report.summary.qualityScore));
  
  report.cleanList = attributions.filter(a => a.status === 'valid');
  report.retryList = attributions.filter(a => a.shouldRetry && a.status !== 'invalid' && a.status !== 'unsubscribed');
  report.invalidList = attributions.filter(a => a.status === 'invalid');
  report.unsubscribedList = attributions.filter(a => a.status === 'unsubscribed');
  report.tempBounceList = attributions.filter(a => a.status === 'temporary_bounce');
  
  return report;
}

function displayFullReport(report) {
  displaySummary(report.summary);
  displayDomainReport(report, true);
  displaySourceReport(report, true);
  displayBounceCodeReport(report, true);
  displayRecommendations(report);
}

function displaySummary(summary) {
  console.log(chalk.cyan('--- 总体概览 ---\n'));
  
  const table = new Table({
    head: ['指标', '数量', '占比'],
    colWidths: [25, 10, 15]
  });
  
  const total = summary.total;
  table.push(['总邮箱数', total, '100%']);
  table.push([chalk.green('有效邮箱'), summary.valid, `${((summary.valid / total) * 100).toFixed(1)}%`]);
  table.push([chalk.red('无效邮箱'), summary.invalid, `${((summary.invalid / total) * 100).toFixed(1)}%`]);
  table.push([chalk.yellow('临时退信'), summary.temporary_bounce, `${((summary.temporary_bounce / total) * 100).toFixed(1)}%`]);
  table.push([chalk.magenta('已退订'), summary.unsubscribed, `${((summary.unsubscribed / total) * 100).toFixed(1)}%`]);
  table.push([chalk.blue('需审核'), summary.needs_review, `${((summary.needs_review / total) * 100).toFixed(1)}%`]);
  table.push([chalk.cyan('可重试'), summary.retryable, `${((summary.retryable / total) * 100).toFixed(1)}%`]);
  
  console.log(table.toString() + '\n');
  
  console.log(chalk.cyan('--- 投放质量评分 ---'));
  const scoreColor = summary.qualityScore >= 70 ? chalk.green : 
                     summary.qualityScore >= 50 ? chalk.yellow : chalk.red;
  console.log(scoreColor(`\n  评分: ${summary.qualityScore}/100`));
  
  if (summary.qualityScore >= 70) {
    console.log(chalk.green('  评价: 优秀 - 名单质量良好，退信率可控'));
  } else if (summary.qualityScore >= 50) {
    console.log(chalk.yellow('  评价: 一般 - 需要关注临时退信和无效邮箱'));
  } else {
    console.log(chalk.red('  评价: 较差 - 建议检查名单来源和发送策略'));
  }
  
  console.log('\n');
}

function displayDomainReport(report, brief = false) {
  console.log(chalk.cyan('--- 域名归因分析 ---\n'));
  
  const domains = Object.values(report.byDomain).sort((a, b) => b.bounces - a.bounces);
  
  if (domains.length === 0) {
    console.log(chalk.gray('  无域名数据\n'));
    return;
  }
  
  const table = new Table({
    head: ['域名', '类型', '总数', '退信', '无效', '退信率'],
    colWidths: [25, 12, 8, 8, 8, 12]
  });
  
  domains.forEach(d => {
    const bounceRate = d.total > 0 ? `${((d.bounces / d.total) * 100).toFixed(1)}%` : '0%';
    table.push([
      d.domain,
      formatDomainCategory(d.category),
      d.total,
      d.bounces,
      chalk.red(d.invalid),
      bounceRate
    ]);
  });
  
  console.log(table.toString() + '\n');
  
  if (!brief) {
    console.log(chalk.cyan('--- 域名问题分析 ---\n'));
    domains.forEach(d => {
      if (d.bounces > 0) {
        const rate = ((d.bounces / d.total) * 100).toFixed(1);
        if (rate > 50) {
          console.log(chalk.red(`  ⚠ ${d.domain}: 高退信率 (${rate}%) - 可能是域名拦截或名单质量问题`));
        } else if (rate > 20) {
          console.log(chalk.yellow(`  ⚠ ${d.domain}: 中等退信率 (${rate}%) - 建议关注`));
        }
        
        if (d.invalid > 0 && d.invalid / d.total > 0.3) {
          console.log(chalk.red(`    - 无效邮箱占比高，建议检查名单来源`));
        }
        if (d.temporary > 0) {
          console.log(chalk.yellow(`    - 有临时退信，可考虑分批重试`));
        }
      }
    });
    console.log();
  }
}

function displaySourceReport(report, brief = false) {
  console.log(chalk.cyan('--- 名单来源归因分析 ---\n'));
  
  const sources = Object.values(report.bySource).sort((a, b) => b.bounces - a.bounces);
  
  if (sources.length === 0) {
    console.log(chalk.gray('  无来源数据\n'));
    return;
  }
  
  const table = new Table({
    head: ['来源', '总数', '退信', '无效', '有效率'],
    colWidths: [20, 8, 8, 8, 12]
  });
  
  sources.forEach(s => {
    const validCount = s.total - s.bounces;
    const validRate = s.total > 0 ? `${((validCount / s.total) * 100).toFixed(1)}%` : '0%';
    table.push([
      s.source,
      s.total,
      s.bounces,
      chalk.red(s.invalid),
      chalk.green(validRate)
    ]);
  });
  
  console.log(table.toString() + '\n');
  
  if (!brief) {
    console.log(chalk.cyan('--- 来源质量评价 ---\n'));
    sources.forEach(s => {
      const validCount = s.total - s.bounces;
      const validRate = s.total > 0 ? (validCount / s.total) * 100 : 0;
      const invalidRate = s.total > 0 ? (s.invalid / s.total) * 100 : 0;
      
      if (invalidRate > 30) {
        console.log(chalk.red(`  ✗ ${s.source}: 无效邮箱占比 ${invalidRate.toFixed(1)}% - 建议停用或重新验证`));
      } else if (validRate >= 70) {
        console.log(chalk.green(`  ✓ ${s.source}: 有效率 ${validRate.toFixed(1)}% - 优质来源`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${s.source}: 有效率 ${validRate.toFixed(1)}% - 需要优化`));
      }
    });
    console.log();
  }
}

function displayBounceCodeReport(report, brief = false) {
  console.log(chalk.cyan('--- 退信码归因分析 ---\n'));
  
  const categories = Object.values(report.byBounceCategory).sort((a, b) => b.count - a.count);
  
  if (categories.length === 0) {
    console.log(chalk.gray('  无退信数据\n'));
    return;
  }
  
  const table = new Table({
    head: ['退信分类', '类型', '数量', '占比'],
    colWidths: [25, 12, 8, 12]
  });
  
  const totalBounces = categories.reduce((sum, c) => sum + c.count, 0);
  
  categories.forEach(c => {
    table.push([
      c.category,
      formatBounceType(c.type),
      c.count,
      totalBounces > 0 ? `${((c.count / totalBounces) * 100).toFixed(1)}%` : '0%'
    ]);
  });
  
  console.log(table.toString() + '\n');
  
  if (!brief) {
    console.log(chalk.cyan('--- 退信原因分析 ---\n'));
    categories.forEach(c => {
      if (c.category === 'invalid_email') {
        console.log(chalk.red(`  无效邮箱 (${c.count}个): 邮箱不存在或拼写错误，建议从名单中移除`));
      } else if (c.category === 'mailbox_full' || c.category === 'mailbox_full_temp') {
        console.log(chalk.yellow(`  邮箱已满 (${c.count}个): 可等待用户清理后重试`));
      } else if (c.category === 'service_unavailable' || c.category === 'server_timeout') {
        console.log(chalk.yellow(`  服务不可用 (${c.count}个): 可能是对方服务器问题，建议稍后重试`));
      } else if (c.category === 'policy_block') {
        console.log(chalk.red(`  策略拦截 (${c.count}个): 可能是发送频率过高，建议降低发送频率`));
      } else if (c.category === 'missing_code') {
        console.log(chalk.blue(`  缺少退信码 (${c.count}个): 需要人工审核确认`));
      }
    });
    console.log();
  }
}

function displayRecommendations(report) {
  console.log(chalk.cyan('--- 业务建议 ---\n'));
  
  const issues = [];
  
  if (report.summary.invalid > 0) {
    issues.push({
      priority: 'high',
      title: `${report.summary.invalid} 个无效邮箱`,
      action: '建议从投放名单中移除，避免影响发送信誉'
    });
  }
  
  if (report.summary.retryable > 0) {
    issues.push({
      priority: 'medium',
      title: `${report.summary.retryable} 个可重试邮箱`,
      action: '建议分批重试，注意控制发送频率'
    });
  }
  
  const highBounceDomains = Object.values(report.byDomain)
    .filter(d => d.total > 0 && (d.bounces / d.total) > 0.5);
  if (highBounceDomains.length > 0) {
    issues.push({
      priority: 'high',
      title: `${highBounceDomains.length} 个高退信率域名`,
      action: `检查域名: ${highBounceDomains.map(d => d.domain).join(', ')}`
    });
  }
  
  if (issues.length === 0) {
    console.log(chalk.green('  ✓ 无明显问题，业务闭环良好\n'));
  } else {
    issues.sort((a, b) => a.priority === 'high' ? -1 : 1);
    issues.forEach((issue, index) => {
      const priorityColor = issue.priority === 'high' ? chalk.red : chalk.yellow;
      console.log(`  ${index + 1}. ${priorityColor(`[${issue.priority === 'high' ? '高' : '中'}]`)} ${issue.title}`);
      console.log(`     ${chalk.gray(issue.action)}\n`);
    });
  }
  
  console.log(chalk.cyan('--- 导出选项 ---\n'));
  console.log('  清洗名单: ' + chalk.white('bounce report --clean'));
  console.log('  重试名单: ' + chalk.white('bounce report --retry'));
  console.log('  域名报告: ' + chalk.white('bounce report --by-domain'));
  console.log('  来源报告: ' + chalk.white('bounce report --by-source'));
  console.log();
}

function exportCleanList(report) {
  const cleanEmails = report.cleanList.map(a => a.email);
  const filePath = config.exportToFile('clean-list', {
    count: cleanEmails.length,
    generatedAt: new Date().toISOString(),
    emails: cleanEmails
  });
  
  const csvContent = 'email\n' + cleanEmails.join('\n');
  config.exportToFile('clean-list', csvContent, 'csv');
  
  console.log(chalk.green(`\n✓ 清洗名单已导出: ${filePath}`));
  console.log(chalk.cyan(`  包含 ${cleanEmails.length} 个有效邮箱\n`));
}

function exportRetryList(report) {
  const retryEmails = report.retryList.map(a => ({
    email: a.email,
    domain: a.domain,
    source: a.source,
    reason: a.retryReason,
    waitDays: a.retryInfo && a.retryInfo.waitDays ? a.retryInfo.waitDays : 1
  }));
  
  const filePath = config.exportToFile('retry-list', {
    count: retryEmails.length,
    generatedAt: new Date().toISOString(),
    emails: retryEmails
  });
  
  const csvHeader = 'email,domain,source,reason,wait_days';
  const csvRows = retryEmails.map(e => 
    `"${e.email}","${e.domain}","${e.source}","${e.reason}",${e.waitDays}`
  );
  config.exportToFile('retry-list', [csvHeader, ...csvRows].join('\n'), 'csv');
  
  console.log(chalk.green(`\n✓ 重试名单已导出: ${filePath}`));
  console.log(chalk.cyan(`  包含 ${retryEmails.length} 个可重试邮箱\n`));
}

function formatDomainCategory(category) {
  const mapping = {
    enterprise: chalk.cyan('企业'),
    personal: chalk.green('个人'),
    free: chalk.yellow('免费'),
    other: chalk.gray('其他')
  };
  return mapping[category] || category;
}

function formatBounceType(type) {
  const mapping = {
    permanent: chalk.red('永久'),
    temporary: chalk.yellow('临时'),
    unknown: chalk.gray('未知')
  };
  return mapping[type] || type;
}

module.exports = reportCommand;
