const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), 'points-freeze-api');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const dbPath = path.join(tmpDir, 'seed.db');
if (fs.existsSync(dbPath)) {
  console.log('数据库已存在，删除重建...');
  fs.unlinkSync(dbPath);
}

process.env.DB_PATH = dbPath;

async function main() {
  const createApp = require('../app');
  await createApp();
  
  const { getDbPath } = require('../config/database');
  const memberRepo = require('../repositories/MemberRepository');
  const freezeRuleRepo = require('../repositories/FreezeRuleRepository');
  const pointService = require('../services/PointService');
  const { BalanceService } = require('../services/BalanceService');

  const balanceService = new BalanceService();
  const systemOperator = { name: 'seeder', id: 'seeder', type: 'system' };

  console.log('--- 开始种子数据 ---');
  console.log(`数据库路径: ${getDbPath()}`);

  console.log('\n1. 创建会员...');
  const member1 = memberRepo.create('张三');
  const member2 = memberRepo.create('李四');
  console.log(`  张三 (${member1.id})`);
  console.log(`  李四 (${member2.id})`);

  console.log('\n2. 创建冻结规则...');
  const rule1 = freezeRuleRepo.create({
    code: 'RISK_7D',
    name: '风险冻结-7天',
    releaseType: 'TIME',
    releaseDays: 7,
    autoRelease: true,
    priority: 100,
    description: '风控触发，7天后自动解冻'
  });
  const rule2 = freezeRuleRepo.create({
    code: 'MANUAL',
    name: '手动冻结',
    releaseType: 'MANUAL',
    releaseDays: null,
    autoRelease: false,
    priority: 50,
    description: '需手动解冻'
  });
  console.log(`  RISK_7D (${rule1.id})`);
  console.log(`  MANUAL (${rule2.id})`);

  console.log('\n3. 充值积分...');
  pointService.recharge(member1.id, 10000, 'seed-recharge-1', systemOperator, '初始充值');
  pointService.recharge(member2.id, 5000, 'seed-recharge-2', systemOperator, '初始充值');
  logBalance('张三', member1.id, balanceService);
  logBalance('李四', member2.id, balanceService);

  console.log('\n4. 风控冻结...');
  const freezeResult = pointService.freeze(member1.id, 3000, 'RISK_7D', 'seed-freeze-1', { name: 'risk_engine', id: 'risk-001', type: 'risk' }, '异常交易检测');
  console.log(`  冻结桶 ID: ${freezeResult.result.bucket.id}`);
  logBalance('张三', member1.id, balanceService);

  console.log('\n5. 普通消费（使用可用余额）...');
  pointService.consume(member1.id, 2000, 'seed-consume-1', systemOperator, 'ORD-001', '购买商品A');
  logBalance('张三', member1.id, balanceService);

  console.log('\n6. 创建余额快照...');
  const snapshot = balanceService.createSnapshot(member1.id, new Date());
  console.log(`  快照日期: ${snapshot.snapshot_date}, 总余额: ${snapshot.total_balance}, 冻结: ${snapshot.freeze_balance}, 可用: ${snapshot.available_balance}`);

  console.log('\n7. 一致性校验...');
  const consistency = balanceService.verifyConsistency(member1.id);
  console.log(`  流水冻结余额: ${consistency.ledgerFreezeBalance}`);
  console.log(`  桶冻结余额: ${consistency.bucketFreezeBalance}`);
  console.log(`  一致性: ${consistency.isConsistent ? '✅ 通过' : '❌ 失败'}, diff=${consistency.diff}`);

  console.log('\n--- 种子数据完成 ---');

  console.log('\n📌 关键 ID 备忘:');
  console.log(`  张三: ${member1.id}`);
  console.log(`  李四: ${member2.id}`);
  console.log(`  冻结桶: ${freezeResult.result.bucket.id}`);
  console.log(`\n📌 使用这些 ID 替换 curl 示例中的 <张三的ID> 和 <冻结桶ID>`);

  process.exit(0);
}

function logBalance(name, memberId, balanceService) {
  const b = balanceService.getCurrentBalance(memberId);
  console.log(`  [${name}] 总:${b.totalBalance} | 冻结:${b.freezeBalance} | 可用:${b.availableBalance}`);
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
