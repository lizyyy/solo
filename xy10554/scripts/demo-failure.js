const Store = require('../src/utils/store');
const { ContentRecord, ChannelStatus, ReferencePage, STATUS, CHANNEL_TYPE } = require('../src/models/content');
const RuleEngine = require('../src/rules/engine');
const chalk = require('chalk');

console.log(chalk.blue('\n=== 自动演示：失败撤稿路径 ===\n'));

const store = new Store();
store.clear();
console.log(chalk.green('1. 清空历史数据'));

const problematicContent = new ContentRecord({
  id: 'demo-fail-001',
  title: '有问题的撤稿案例',
  type: 'news',
  contentUrl: 'https://example.com/news/problematic',
  version: 1,
  status: STATUS.PARTIAL,
  author: '测试用户',
  owner: '',
  publishedAt: '2024-01-01T00:00:00+08:00',
  channels: [
    new ChannelStatus({
      channelName: '官网频道',
      channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
      url: 'https://example.com/news/problematic',
      status: STATUS.UNPUBLISHED,
      cacheStatus: 'active',
      unpublishAttempts: 3,
      errors: ['缓存清理API超时'],
      owner: ''
    }),
    new ChannelStatus({
      channelName: '合作媒体C',
      channelType: CHANNEL_TYPE.COOPERATION,
      url: 'https://partner-c.com/news/problem',
      status: STATUS.ACTIVE,
      cacheStatus: 'unknown',
      unpublishAttempts: 2,
      errors: ['合作方未响应撤稿请求'],
      owner: ''
    })
  ],
  referencePages: [
    new ReferencePage({
      url: 'https://example.com/archive',
      title: '新闻存档',
      status: STATUS.ACTIVE,
      hasLink: true,
      owner: ''
    })
  ],
  metadata: {}
});

store.addContent(problematicContent);
console.log(chalk.yellow('2. 创建有问题的案例数据'));
console.log(chalk.gray('   问题说明:'));
console.log(chalk.gray('   - 内容责任人缺失'));
console.log(chalk.gray('   - 官网已撤稿但缓存仍可访问'));
console.log(chalk.gray('   - 合作媒体内容仍在线且未响应'));
console.log(chalk.gray('   - 引用页面仍包含撤稿链接'));
console.log(chalk.gray('   - 所有渠道和页面负责人都未指定'));

console.log(chalk.cyan('\n--- 步骤3: 执行 check 命令检查问题 ---'));
const checkResult = RuleEngine.runAllRules(problematicContent, store);
console.log(`   整体状态: ${checkResult.overallStatus}`);
console.log(`   阻塞问题数量: ${checkResult.issues.length}`);

console.log(chalk.red('\n--- 发现的问题 ---'));
checkResult.issues.forEach((issue, idx) => {
  const severity = issue.severity === 'high' ? '[紧急]' : issue.severity === 'medium' ? '[中等]' : '[低]';
  console.log(`   [${idx + 1}] ${severity} ${issue.type}`);
  console.log(`       ${issue.message}`);
  console.log(`       建议: ${issue.suggestion}`);
});

console.log(chalk.cyan('\n--- 步骤4: 验证幂等性 - 尝试重复撤稿 ---'));
const IdempotentManager = require('../src/utils/idempotent');
const duplicateCheck = IdempotentManager.checkDuplicateUnpublish(store, problematicContent.id);
console.log(`   重复检查结果: ${duplicateCheck.isDuplicate ? '检测到重复操作' : '无重复'}`);

console.log(chalk.yellow('\n--- 步骤5: 人工修正演示 ---'));
console.log(chalk.gray('   模拟人工指定责任人...'));

const result = store.manualEdit(
  problematicContent.id,
  { owner: '李经理' },
  '运维-小王',
  '紧急指定撤稿总负责人'
);

console.log(chalk.green(`   修正成功!`));
console.log(`   操作者: ${result.operator}`);
console.log(`   原因: ${result.reason}`);
console.log(`   变更字段:`);
result.diff.forEach((d, idx) => {
  console.log(`     [${idx + 1}] ${d.field}: "${d.before}" -> "${d.after}"`);
});

console.log(chalk.cyan('\n--- 步骤6: 重新检查状态 ---'));
const updatedContent = store.getContent(problematicContent.id);
const recheck = RuleEngine.runAllRules(updatedContent, store);
console.log(`   剩余阻塞问题: ${recheck.issues.length}`);

if (recheck.issues.length > 0) {
  console.log(chalk.yellow('\n--- 仍需处理的问题 ---'));
  recheck.issues.forEach((issue, idx) => {
    const severity = issue.severity === 'high' ? '[紧急]' : '[中等]';
    console.log(`   [${idx + 1}] ${severity} ${issue.message}`);
    console.log(`       下一步: ${issue.suggestion}`);
  });
}

console.log(chalk.red('\n=== 失败路径演示完成 ==='));
console.log(chalk.yellow('业务未闭环的原因:'));
console.log(chalk.gray('  1. 缓存未清理 - 官网内容通过CDN缓存仍可访问'));
console.log(chalk.gray('  2. 合作方未配合 - 合作媒体C内容仍在线'));
console.log(chalk.gray('  3. 引用页面残留 - 新闻存档页仍指向撤稿内容'));
console.log(chalk.gray('  4. 责任人缺失 - 各渠道缺乏明确负责人'));

console.log(chalk.cyan('\n你可以运行以下命令查看完整详情:'));
console.log(chalk.gray('  npm run cli -- check demo-fail-001'));
console.log(chalk.gray('  npm run cli -- detail demo-fail-001 --history'));
console.log(chalk.gray('  npm run cli -- report\n'));
