import * as engine from './src/engine';
import * as store from './src/store';

const user1 = { userId: 'user-12345', email: 'test@example.com', isVip: false };
const user2 = { userId: 'user-001', email: 'admin@example.com', isVip: false };
const user3 = { userId: 'user-999', email: 'vip@test.com', isVip: true };

console.log('\n========================================');
console.log('    同一用户在不同环境的命中差异');
console.log('========================================');

const flags = ['payment-new-flow', 'search-experiment', 'member-benefits'];
const envs: Array<'test' | 'staging' | 'production'> = ['test', 'staging', 'production'];

for (const flagId of flags) {
  const flag = store.getFlag(flagId);
  console.log(`\n🔖 ${flag?.name} (${flagId})`);
  console.log('  ─────────────────────────────────────');
  
  for (const user of [user1, user2, user3]) {
    console.log(`\n  👤 用户: ${user.userId} (VIP: ${user.isVip ? '是' : '否'})`);
    for (const env of envs) {
      const result = engine.evaluate(flagId, user, env);
      const bucketInfo = result.computedFields.bucket 
        ? `(bucket=${result.computedFields.bucket})` 
        : '';
      const status = result.enabled ? '✅ 命中' : '❌ 未命中';
      console.log(`    ${env.padEnd(10)}: ${status} ${bucketInfo}`);
    }
  }
}

console.log('\n\n========================================');
console.log('    稳定分桶测试 (重复10次)');
console.log('========================================');

console.log('\n用户 user-12345 在 payment-new-flow 开关上的分桶值:');
for (let i = 0; i < 5; i++) {
  const result = engine.debugBucket('user-12345', 'payment-new-flow', 50);
  console.log(`  第${i + 1}次: bucket=${result.bucket}, 命中=${result.willHit ? '是' : '否'}`);
}

console.log('\n\n========================================');
console.log('    history 演示');
console.log('========================================');

const versions = store.getFlagVersions('payment-new-flow');
console.log(`\n支付新流程开关的版本历史 (共 ${versions.length} 个版本):`);
for (const v of versions) {
  const action = 
    v.action === 'create' ? '🆕 创建' :
    v.action === 'update' ? '✏️ 更新' :
    '↩️ 回滚';
  
  const prevInfo = v.previousVersion 
    ? ` 从 v${v.previousVersion} → v${v.version}` 
    : ` v${v.version}`;
  
  console.log(`\n  ${action}${prevInfo}`);
  console.log(`    时间: ${new Date(v.timestamp).toLocaleString('zh-CN')}`);
  console.log(`    规则数: ${v.flag.rules.length}`);
  console.log(`    全局关闭: ${v.flag.globallyDisabled ? '是' : '否'}`);
}

console.log('\n');
