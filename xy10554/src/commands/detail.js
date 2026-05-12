const Store = require('../utils/store');
const { STATUS } = require('../models/content');
const chalk = require('chalk');
const moment = require('moment');

function detailCommand(contentId, options) {
  console.log(chalk.blue('\n=== 内容详情 ===\n'));
  
  const store = new Store();
  const content = store.getContent(contentId);
  
  if (!content) {
    console.log(chalk.red(`错误: 未找到内容 ID: ${contentId}`));
    return { success: false };
  }
  
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
  
  console.log(chalk.bold.yellow('📋 基本信息'));
  console.log(`  ID: ${content.id}`);
  console.log(`  标题: ${content.title}`);
  console.log(`  类型: ${content.type}`);
  console.log(`  版本: v${content.version}`);
  console.log(`  作者: ${content.author}`);
  console.log(`  责任人: ${content.owner || chalk.red('未指定')}`);
  console.log(`  状态: ${(statusColors[content.status] || chalk.gray)(statusText[content.status] || content.status)}`);
  console.log(`  发布时间: ${content.publishedAt.format('YYYY-MM-DD HH:mm:ss')}`);
  if (content.unpublishedAt) {
    console.log(`  撤稿时间: ${content.unpublishedAt.format('YYYY-MM-DD HH:mm:ss')}`);
  }
  console.log(`  源URL: ${content.contentUrl}`);
  console.log('');
  
  console.log(chalk.bold.yellow('🌐 渠道详情'));
  content.channels.forEach((channel, idx) => {
    const statusColor = statusColors[channel.status] || chalk.gray;
    const cacheColor = {
      'active': chalk.red,
      'purged': chalk.green,
      'purging': chalk.yellow,
      'unknown': chalk.gray,
      'failed': chalk.red
    }[channel.cacheStatus] || chalk.gray;
    
    console.log(`\n  渠道 #${idx + 1}: ${channel.channelName}`);
    console.log(`    类型: ${channel.channelType}`);
    console.log(`    URL: ${channel.url}`);
    console.log(`    状态: ${statusColor(statusText[channel.status] || channel.status)}`);
    console.log(`    缓存: ${cacheColor(channel.cacheStatus)}`);
    console.log(`    撤稿尝试: ${channel.unpublishAttempts} 次`);
    if (channel.lastAttemptAt) {
      console.log(`    最后尝试: ${channel.lastAttemptAt.format('YYYY-MM-DD HH:mm:ss')}`);
    }
    console.log(`    责任人: ${channel.owner || chalk.yellow('未指定')}`);
    if (channel.verifiedAt) {
      console.log(`    验证时间: ${channel.verifiedAt.format('YYYY-MM-DD HH:mm:ss')}`);
    }
    if (channel.errors && channel.errors.length > 0) {
      console.log(`    错误信息:`);
      channel.errors.forEach((err, eIdx) => {
        console.log(`      [${eIdx + 1}] ${err}`);
      });
    }
    if (channel.notes) {
      console.log(`    备注: ${channel.notes}`);
    }
  });
  
  if (content.referencePages.length > 0) {
    console.log(chalk.bold.yellow('\n🔗 引用页面'));
    content.referencePages.forEach((ref, idx) => {
      const linkText = ref.hasLink === null ? '未检查' :
                       ref.hasLink ? chalk.red('✗ 仍有链接') : chalk.green('✓ 已移除');
      console.log(`\n  页面 #${idx + 1}: ${ref.title}`);
      console.log(`    URL: ${ref.url}`);
      console.log(`    链接状态: ${linkText}`);
      console.log(`    检查人: ${ref.owner || chalk.yellow('未指定')}`);
      if (ref.verifiedAt) {
        console.log(`    验证时间: ${ref.verifiedAt.format('YYYY-MM-DD HH:mm:ss')}`);
      }
    });
  }
  
  if (options.history) {
    const logs = store.getAuditLogs(contentId);
    if (logs.length > 0) {
      console.log(chalk.bold.yellow('\n📜 操作历史'));
      logs.forEach((log, idx) => {
        console.log(`\n  操作 #${idx + 1}: ${log.action}`);
        console.log(`    操作者: ${log.operator}`);
        console.log(`    时间: ${log.timestamp.format('YYYY-MM-DD HH:mm:ss')}`);
        if (log.reason) {
          console.log(`    原因: ${log.reason}`);
        }
        if (log.diff && log.diff.length > 0) {
          console.log(`    变更:`);
          log.diff.forEach((d, dIdx) => {
            console.log(`      [${dIdx + 1}] ${d.field}`);
            console.log(`        旧值: ${JSON.stringify(d.before)}`);
            console.log(`        新值: ${JSON.stringify(d.after)}`);
          });
        }
      });
    } else {
      console.log(chalk.gray('\n  暂无操作历史'));
    }
  }
  
  return { success: true, content: content.toJSON() };
}

module.exports = detailCommand;
