const Store = require('../src/utils/store');
const { ContentRecord, ChannelStatus, ReferencePage, STATUS, CHANNEL_TYPE } = require('../src/models/content');
const RuleEngine = require('../src/rules/engine');
const chalk = require('chalk');

console.log(chalk.blue('\n=== 自动演示：成功撤稿路径 ===\n'));

const store = new Store();
store.clear();
console.log(chalk.green('1. 清空历史数据'));

const newsContent = new ContentRecord({
  id: 'demo-news-001',
  title: '2024春季新品发布会新闻稿',
  type: 'news',
  contentUrl: 'https://example.com/news/spring-2024',
  version: 1,
  status: STATUS.ACTIVE,
  author: '品牌部-李明',
  owner: '张明',
  publishedAt: '2024-03-15T09:00:00+08:00',
  channels: [
    new ChannelStatus({
      channelName: '官网首页',
      channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
      url: 'https://example.com/news/spring-2024',
      status: STATUS.ACTIVE,
      cacheStatus: 'active',
      owner: '张三'
    }),
    new ChannelStatus({
      channelName: '官方公众号',
      channelType: CHANNEL_TYPE.WECHAT,
      url: 'https://mp.weixin.qq.com/s/demo-spring',
      status: STATUS.ACTIVE,
      cacheStatus: 'unknown',
      owner: '李四'
    })
  ],
  referencePages: [
    new ReferencePage({
      url: 'https://example.com/about',
      title: '关于我们',
      status: STATUS.PENDING,
      hasLink: null,
      owner: '赵六'
    })
  ],
  metadata: { priority: 'high' }
});

store.addContent(newsContent);
console.log(chalk.green('2. 创建样例新闻稿，状态: 活跃 (active)'));

console.log(chalk.cyan('\n--- 步骤3: 执行 check 命令检查状态 ---'));
const check1 = RuleEngine.runAllRules(newsContent, store);
console.log(`   整体状态: ${check1.overallStatus}`);
console.log(`   问题数量: ${check1.issues.length}`);
console.log(`   渠道状态: 官网-活跃, 公众号-活跃`);

console.log(chalk.cyan('\n--- 步骤4: 模拟官网撤稿成功 ---'));
newsContent.channels[0].status = STATUS.UNPUBLISHED;
newsContent.channels[0].cacheStatus = 'purged';
newsContent.channels[0].unpublishAttempts = 1;
newsContent.channels[0].lastAttemptAt = require('moment')();
store.updateContent(newsContent.id, { channels: newsContent.channels }, 'system', '官网撤稿完成');
console.log(chalk.green('   官网状态: 已撤稿 (unpublished), 缓存: 已清理 (purged)'));

console.log(chalk.cyan('\n--- 步骤5: 模拟公众号撤稿成功 ---'));
newsContent.channels[1].status = STATUS.UNPUBLISHED;
newsContent.channels[1].cacheStatus = 'unknown';
newsContent.channels[1].unpublishAttempts = 1;
newsContent.channels[1].lastAttemptAt = require('moment')();
store.updateContent(newsContent.id, { channels: newsContent.channels }, 'system', '公众号撤稿完成');
console.log(chalk.green('   公众号状态: 已撤稿 (unpublished)'));

console.log(chalk.cyan('\n--- 步骤6: 模拟引用页面检查完成 ---'));
newsContent.referencePages[0].status = STATUS.UNPUBLISHED;
newsContent.referencePages[0].hasLink = false;
newsContent.referencePages[0].verifiedAt = require('moment')();
store.updateContent(newsContent.id, { referencePages: newsContent.referencePages }, '赵六', '检查确认无链接');
console.log(chalk.green('   引用页面: 已确认移除链接'));

newsContent.status = STATUS.UNPUBLISHED;
newsContent.unpublishedAt = require('moment')();
store.updateContent(newsContent.id, { 
  status: STATUS.UNPUBLISHED, 
  unpublishedAt: require('moment')() 
}, '张明', '所有渠道撤稿完成');
console.log(chalk.green('7. 更新内容整体状态: 已撤稿 (unpublished)'));

console.log(chalk.cyan('\n--- 步骤8: 最终检查 ---'));
const finalCheck = RuleEngine.runAllRules(newsContent, store);
console.log(`   整体状态: ${finalCheck.overallStatus}`);
console.log(`   问题数量: ${finalCheck.issues.length}`);
if (finalCheck.issues.length === 0) {
  console.log(chalk.green('   ✓ 无阻塞问题，撤稿闭环完成！'));
}

console.log(chalk.cyan('\n--- 步骤9: 查看操作历史 ---'));
const logs = store.getAuditLogs(newsContent.id);
console.log(`   操作记录数: ${logs.length}`);
logs.forEach((log, idx) => {
  console.log(`   [${idx + 1}] ${log.action} - ${log.operator} - ${log.reason || '无原因'}`);
});

console.log(chalk.green('\n=== 成功路径演示完成 ===\n'));
console.log(chalk.gray('你可以运行以下命令查看结果:'));
console.log(chalk.gray('  npm run cli -- check demo-news-001'));
console.log(chalk.gray('  npm run cli -- detail demo-news-001 --history'));
console.log(chalk.gray('  npm run cli -- report\n'));
