const Store = require('../utils/store');
const RuleEngine = require('../rules/engine');
const { STATUS } = require('../models/content');
const chalk = require('chalk');

function checkCommand(contentId, options) {
  console.log(chalk.blue('\n=== 检查撤稿状态 ===\n'));
  
  const store = new Store();
  
  if (contentId) {
    const content = store.getContent(contentId);
    if (!content) {
      console.log(chalk.red(`错误: 未找到内容 ID: ${contentId}`));
      return { success: false };
    }
    
    return checkSingleContent(content, store, options);
  } else {
    const allContents = store.getAllContents();
    if (allContents.length === 0) {
      console.log(chalk.yellow('暂无内容记录，请先运行 init 或 import 命令'));
      return { success: true, count: 0 };
    }
    
    console.log(chalk.cyan(`共 ${allContents.length} 条内容记录:\n`));
    
    const results = allContents.map(content => {
      const result = checkSingleContent(content, store, { summary: true });
      return { content, result };
    });
    
    const summary = {
      total: allContents.length,
      complete: results.filter(r => r.result.overallStatus === STATUS.UNPUBLISHED).length,
      partial: results.filter(r => r.result.overallStatus === STATUS.PARTIAL).length,
      active: results.filter(r => r.result.overallStatus === STATUS.ACTIVE).length,
      failed: results.filter(r => r.result.overallStatus === STATUS.FAILED).length
    };
    
    console.log(chalk.cyan(`\n=== 状态汇总 ===`));
    console.log(`  已完成撤稿: ${summary.complete}`);
    console.log(`  部分撤稿: ${summary.partial}`);
    console.log(`  仍活跃: ${summary.active}`);
    console.log(`  有问题: ${summary.failed}`);
    
    return { success: true, summary };
  }
}

function checkSingleContent(content, store, options) {
  const validation = RuleEngine.validateUnpublishRequest(content.id, store);
  const rules = validation.rules;
  
  const statusColors = {
    [STATUS.ACTIVE]: chalk.red,
    [STATUS.UNPUBLISHED]: chalk.green,
    [STATUS.PARTIAL]: chalk.yellow,
    [STATUS.FAILED]: chalk.bgRed.white,
    [STATUS.PENDING]: chalk.blue
  };
  
  const statusText = {
    [STATUS.ACTIVE]: '仍在线',
    [STATUS.UNPUBLISHED]: '已撤稿',
    [STATUS.PARTIAL]: '部分撤稿',
    [STATUS.FAILED]: '有问题',
    [STATUS.PENDING]: '待处理'
  };

  if (!options.summary) {
    console.log(chalk.bold(`内容: ${content.title}`));
    console.log(`  ID: ${content.id}`);
    console.log(`  类型: ${content.type}`);
    console.log(`  责任人: ${content.owner || chalk.red('未指定')}`);
    console.log(`  发布时间: ${content.publishedAt.format('YYYY-MM-DD HH:mm')}`);
    console.log(`  整体状态: ${(statusColors[rules.overallStatus] || chalk.gray)(statusText[rules.overallStatus] || rules.overallStatus)}\n`);
    
    console.log(chalk.underline('渠道状态:'));
    content.channels.forEach((channel, idx) => {
      const color = statusColors[channel.status] || chalk.gray;
      console.log(`  [${idx + 1}] ${channel.channelName}`);
      console.log(`      URL: ${channel.url}`);
      console.log(`      状态: ${color(statusText[channel.status] || channel.status)}`);
      console.log(`      缓存: ${getCacheStatusText(channel.cacheStatus)}`);
      console.log(`      责任人: ${channel.owner || chalk.yellow('未指定')}`);
      if (channel.errors && channel.errors.length > 0) {
        console.log(`      错误: ${chalk.red(channel.errors.join(', '))}`);
      }
    });
    
    if (rules.issues.length > 0) {
      console.log(chalk.red('\n⚠ 发现问题:'));
      rules.issues.forEach((issue, idx) => {
        const severityColor = issue.severity === 'high' ? chalk.red : 
                              issue.severity === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  [${idx + 1}] ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.message}`);
        console.log(`      建议: ${issue.suggestion}`);
      });
    }
    
    if (rules.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠ 注意事项:'));
      rules.warnings.forEach((warning, idx) => {
        console.log(`  [${idx + 1}] ${warning.message}`);
        console.log(`      建议: ${warning.suggestion}`);
      });
    }
    
    if (content.referencePages.length > 0) {
      console.log(chalk.underline('\n引用页面检查:'));
      content.referencePages.forEach((ref, idx) => {
        const linkStatus = ref.hasLink === null ? '未检查' :
                           ref.hasLink ? chalk.red('仍有链接') : chalk.green('已移除');
        console.log(`  [${idx + 1}] ${ref.title}`);
        console.log(`      URL: ${ref.url}`);
        console.log(`      链接状态: ${linkStatus}`);
        console.log(`      检查人: ${ref.owner || chalk.yellow('未指定')}`);
      });
    }
  }
  
  return {
    success: true,
    overallStatus: rules.overallStatus,
    issues: rules.issues,
    warnings: rules.warnings
  };
}

function getCacheStatusText(status) {
  const map = {
    'active': chalk.red('仍可访问'),
    'purged': chalk.green('已清理'),
    'purging': chalk.yellow('清理中'),
    'unknown': chalk.gray('未知'),
    'failed': chalk.red('清理失败')
  };
  return map[status] || chalk.gray(status);
}

module.exports = checkCommand;
