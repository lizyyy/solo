const models = require('./src/models');

console.log('=== 依赖破坏提醒系统 - 去重验证测试 ===\n');

models.createSubscription('订单服务', '交易团队', '/api/v1/users', ['id', 'name', 'email']);
models.createSubscription('支付服务', '支付团队', '/api/v1/users', ['id', 'balance']);

const baseSchema = {
  id: { type: 'string', description: '用户ID' },
  name: { type: 'string', description: '用户名' },
  email: { type: 'string', description: '用户邮箱' },
  balance: { type: 'number', description: '账户余额' }
};

const schemaAfterDeleteEmail = {
  id: { type: 'string', description: '用户ID' },
  name: { type: 'string', description: '用户名' },
  balance: { type: 'number', description: '账户余额' }
};

console.log('1. 第一次提交变更（删除email字段）...');
const change1 = models.createChange('/api/v1/users', baseSchema, schemaAfterDeleteEmail, 'zhangsan', '删除email字段');
console.log(`   变更ID: ${change1.id}`);
console.log(`   风险等级: ${change1.riskLevel}`);

console.log('\n2. 检查确认项数量...');
const confirmations1 = models.getConfirmations();
console.log(`   确认项数量: ${confirmations1.length}`);

console.log('\n3. 重复提交相同变更...');
const change2 = models.createChange('/api/v1/users', baseSchema, schemaAfterDeleteEmail, 'zhangsan', '删除email字段');
console.log(`   变更ID: ${change2.id}`);
console.log(`   与第一次相同: ${change1.id === change2.id}`);

console.log('\n4. 检查确认项数量（去重后）...');
const confirmations2 = models.getConfirmations();
console.log(`   确认项数量: ${confirmations2.length}`);
console.log(`   未重复生成: ${confirmations1.length === confirmations2.length}`);

console.log('\n5. 检查变更记录数量...');
const changes = models.getAllChanges();
console.log(`   变更记录数量: ${changes.length} (应为1，证明去重有效)`);

console.log('\n6. 验证风险等级区分...');
const schemaAfterTypeChange = {
  id: { type: 'string', description: '用户ID' },
  name: { type: 'string', description: '用户名' },
  email: { type: 'string', description: '用户邮箱' },
  balance: { type: 'string', description: '账户余额' }
};
const changeType = models.createChange('/api/v1/users', baseSchema, schemaAfterTypeChange, 'lisi', 'balance类型变更');
console.log(`   类型变更风险等级: ${changeType.riskLevel} (应为 medium)`);

const schemaAfterDescChange = {
  id: { type: 'string', description: '用户ID' },
  name: { type: 'string', description: '用户姓名' },
  email: { type: 'string', description: '用户邮箱' },
  balance: { type: 'number', description: '账户余额' }
};
const changeDesc = models.createChange('/api/v1/users', baseSchema, schemaAfterDescChange, 'wangwu', 'name描述变更');
console.log(`   描述变更风险等级: ${changeDesc.riskLevel} (应为 low)`);

console.log('\n=== 测试结果 ===');
const allTestsPassed = 
  change1.id === change2.id && 
  confirmations1.length === confirmations2.length &&
  changes.length === 1 &&
  changeType.riskLevel === 'medium' &&
  changeDesc.riskLevel === 'low';

if (allTestsPassed) {
  console.log('✅ 所有测试通过！去重和风险等级机制正常工作。');
} else {
  console.log('❌ 部分测试失败！');
}

process.exit(allTestsPassed ? 0 : 1);
