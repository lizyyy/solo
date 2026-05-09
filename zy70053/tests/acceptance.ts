import { DatabaseHelper } from '../src/database/helper';
import { CreditService } from '../src/services/creditService';
import { WithdrawalService } from '../src/services/withdrawalService';
import { RepaymentService } from '../src/services/repaymentService';
import { FreezeService } from '../src/services/freezeService';
import { SnapshotService } from '../src/services/snapshotService';
import { v4 as uuidv4 } from 'uuid';

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new AssertionError(`${message}。期望: ${expected}, 实际: ${actual}`);
  }
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('集团授信共享额度 API 验收测试');
  console.log('='.repeat(60));

  const testDbPath = './test_acceptance.db';

  try {
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (e) {}

  const db = new DatabaseHelper(testDbPath);

  const creditService = new CreditService(db);
  const withdrawalService = new WithdrawalService(db, creditService);
  const repaymentService = new RepaymentService(db, creditService, withdrawalService);
  const freezeService = new FreezeService(db, creditService);
  const snapshotService = new SnapshotService(db, creditService);

  let groupCreditId: string;
  let subAccount1Id: string;
  let subAccount2Id: string;
  let withdrawal1Id: string;
  let freezeRecordId: string;
  let snapshotId: string;

  try {
    console.log('\n【第1步：测试创建集团额度】');
    {
      const groupCredit = await creditService.createGroupCredit('测试集团', 1000000);
      groupCreditId = groupCredit.id;
      
      assertEqual(groupCredit.totalLimit, 1000000, '总额度');
      assertEqual(groupCredit.availableLimit, 1000000, '可用额度');
      assertEqual(groupCredit.usedLimit, 0, '已用额度');
      assertEqual(groupCredit.frozenLimit, 0, '冻结额度');
      
      console.log('✓ 集团额度创建成功');
      console.log(`  总额度: ${groupCredit.totalLimit}`);
      console.log(`  可用额度: ${groupCredit.availableLimit}`);
    }

    console.log('\n【第2步：测试缺字段校验】');
    {
      let threw = false;
      try {
        await creditService.createGroupCredit('', 1000000);
      } catch (e) {
        if (e instanceof Error && e.message.includes('缺少集团名称')) {
          threw = true;
        }
      }
      assert(threw, '应该拒绝空的集团名称');
      console.log('✓ 缺字段校验正常工作');
    }

    console.log('\n【第3步：测试创建子账户】');
    {
      const sub1 = await creditService.createSubAccount(groupCreditId, '子公司A');
      const sub2 = await creditService.createSubAccount(groupCreditId, '子公司B');
      
      subAccount1Id = sub1.id;
      subAccount2Id = sub2.id;
      
      assertEqual(sub1.groupCreditId, groupCreditId, '子公司A所属集团');
      assertEqual(sub2.groupCreditId, groupCreditId, '子公司B所属集团');
      assertEqual(sub1.usedLimit, 0, '子公司A初始已用额度');
      
      console.log('✓ 两个子账户创建成功');
    }

    console.log('\n【第4步：测试提款功能（子账户A提款30万）】');
    {
      const idempotencyKey = uuidv4();
      const result = await withdrawalService.withdraw(
        groupCreditId,
        subAccount1Id,
        300000,
        idempotencyKey
      );
      
      withdrawal1Id = result.withdrawal.id;
      
      assert(result.success, '提款应该成功');
      assertEqual(result.withdrawal.status, 'success', '提款状态');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      assertEqual(groupCredit.availableLimit, 700000, '集团可用额度');
      assertEqual(groupCredit.usedLimit, 300000, '集团已用额度');
      
      const subAccount1 = await creditService.getSubAccountById(subAccount1Id);
      assertEqual(subAccount1.usedLimit, 300000, '子公司A已用额度');
      
      console.log('✓ 提款成功');
      console.log(`  提款金额: 300000`);
      console.log(`  集团可用额度: ${groupCredit.availableLimit}`);
      console.log(`  子公司A已用额度: ${subAccount1.usedLimit}`);
    }

    console.log('\n【第5步：测试提款幂等性（重复相同请求）】');
    {
      const existingWithdrawal = await withdrawalService.getWithdrawalById(withdrawal1Id);
      const idempotencyKey = existingWithdrawal.idempotencyKey;
      
      const result = await withdrawalService.withdraw(
        groupCreditId,
        subAccount1Id,
        300000,
        idempotencyKey
      );
      
      assert(result.isDuplicate, '应该被识别为重复请求');
      assertEqual(result.withdrawal.id, withdrawal1Id, '应该返回原提款记录');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      assertEqual(groupCredit.availableLimit, 700000, '集团可用额度不变');
      
      console.log('✓ 幂等性正常，重复请求不会重复扣款');
    }

    console.log('\n【第6步：测试额度不足时提款】');
    {
      let threw = false;
      try {
        await withdrawalService.withdraw(
          groupCreditId,
          subAccount1Id,
          800000,
          uuidv4()
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes('可用额度不足')) {
          threw = true;
        }
      }
      assert(threw, '应该拒绝超出可用额度的提款');
      console.log('✓ 额度不足时提款被拒绝');
    }

    console.log('\n【第7步：测试还款功能（子账户A还款10万）】');
    {
      const repaymentKey = uuidv4();
      const result = await repaymentService.repay(
        groupCreditId,
        subAccount1Id,
        100000,
        repaymentKey
      );
      
      assert(result.success, '还款应该成功');
      assertEqual(result.repayment.status, 'success', '还款状态');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      assertEqual(groupCredit.availableLimit, 800000, '集团可用额度增加');
      assertEqual(groupCredit.usedLimit, 200000, '集团已用额度减少');
      
      const subAccount1 = await creditService.getSubAccountById(subAccount1Id);
      assertEqual(subAccount1.usedLimit, 200000, '子公司A已用额度减少');
      
      console.log('✓ 还款成功');
      console.log(`  还款金额: 100000`);
      console.log(`  集团可用额度: ${groupCredit.availableLimit}`);
      console.log(`  子公司A已用额度: ${subAccount1.usedLimit}`);
    }

    console.log('\n【第8步：测试冻结功能（冻结子公司B 20万）】');
    {
      const freezeRecord = await freezeService.freeze(
        groupCreditId,
        200000,
        '业务需要',
        subAccount2Id
      );
      
      freezeRecordId = freezeRecord.id;
      
      assertEqual(freezeRecord.status, 'active', '冻结状态');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      assertEqual(groupCredit.availableLimit, 600000, '集团可用额度减少');
      assertEqual(groupCredit.frozenLimit, 200000, '集团冻结额度增加');
      
      const subAccount2 = await creditService.getSubAccountById(subAccount2Id);
      assertEqual(subAccount2.frozenLimit, 200000, '子公司B冻结额度');
      
      console.log('✓ 冻结成功');
      console.log(`  冻结金额: 200000`);
      console.log(`  集团可用额度: ${groupCredit.availableLimit}`);
      console.log(`  集团冻结额度: ${groupCredit.frozenLimit}`);
    }

    console.log('\n【第9步：测试余额快照】');
    {
      const snapshot = await snapshotService.createSnapshot(groupCreditId);
      snapshotId = snapshot.id;
      
      assertEqual(snapshot.totalLimit, 1000000, '快照总额度');
      assertEqual(snapshot.availableLimit, 600000, '快照可用额度');
      assertEqual(snapshot.usedLimit, 200000, '快照已用额度');
      assertEqual(snapshot.frozenLimit, 200000, '快照冻结额度');
      assertEqual(snapshot.subAccounts.length, 2, '快照包含子账户数量');
      
      console.log('✓ 快照创建成功');
      console.log(`  总额度: ${snapshot.totalLimit}`);
      console.log(`  可用: ${snapshot.availableLimit}, 已用: ${snapshot.usedLimit}, 冻结: ${snapshot.frozenLimit}`);
    }

    console.log('\n【第10步：测试一致性校验】');
    {
      const result = await snapshotService.verifyConsistency(groupCreditId);
      assert(result.consistent, '系统应该保持一致性');
      console.log('✓ 一致性校验通过');
    }

    console.log('\n【第11步：测试快照校验】');
    {
      const result = await snapshotService.validateSnapshot(snapshotId);
      assert(result.valid, '快照与当前状态应该一致');
      console.log('✓ 快照校验通过');
    }

    console.log('\n【第12步：测试解冻功能】');
    {
      const releasedFreeze = await freezeService.unfreeze(freezeRecordId);
      
      assertEqual(releasedFreeze.status, 'released', '冻结已释放');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      assertEqual(groupCredit.availableLimit, 800000, '集团可用额度恢复');
      assertEqual(groupCredit.frozenLimit, 0, '集团冻结额度归零');
      
      const subAccount2 = await creditService.getSubAccountById(subAccount2Id);
      assertEqual(subAccount2.frozenLimit, 0, '子公司B冻结额度归零');
      
      console.log('✓ 解冻成功');
      console.log(`  集团可用额度: ${groupCredit.availableLimit}`);
      console.log(`  集团冻结额度: ${groupCredit.frozenLimit}`);
    }

    console.log('\n【第13步：测试超额还款】');
    {
      let threw = false;
      try {
        await repaymentService.repay(
          groupCreditId,
          subAccount1Id,
          300000,
          uuidv4()
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes('不能超过')) {
          threw = true;
        }
      }
      assert(threw, '应该拒绝超出已用额度的还款');
      console.log('✓ 超额还款被拒绝');
    }

    console.log('\n【第14步：测试多子账户共享额度】');
    {
      const result1 = await withdrawalService.withdraw(
        groupCreditId,
        subAccount1Id,
        100000,
        uuidv4()
      );
      
      const result2 = await withdrawalService.withdraw(
        groupCreditId,
        subAccount2Id,
        200000,
        uuidv4()
      );
      
      assert(result1.success, '子公司A提款应该成功');
      assert(result2.success, '子公司B提款应该成功');
      
      const groupCredit = await creditService.getGroupCreditById(groupCreditId);
      const sub1 = await creditService.getSubAccountById(subAccount1Id);
      const sub2 = await creditService.getSubAccountById(subAccount2Id);
      
      const totalUsed = sub1.usedLimit + sub2.usedLimit;
      assertEqual(totalUsed, groupCredit.usedLimit, '子账户已用总和应该等于集团已用');
      
      const totalShouldBe = groupCredit.usedLimit + groupCredit.availableLimit + groupCredit.frozenLimit;
      assertEqual(totalShouldBe, groupCredit.totalLimit, '已用+可用+冻结应该等于总额度');
      
      console.log('✓ 多子账户共享额度正常');
      console.log(`  子公司A已用: ${sub1.usedLimit}`);
      console.log(`  子公司B已用: ${sub2.usedLimit}`);
      console.log(`  集团已用: ${groupCredit.usedLimit}`);
      console.log(`  集团总额度: ${groupCredit.totalLimit}`);
    }

    console.log('\n【第15步：测试交易原子性（中途失败回滚）】');
    {
      const beforeGroupCredit = await creditService.getGroupCreditById(groupCreditId);
      const beforeSub1 = await creditService.getSubAccountById(subAccount1Id);
      
      let threw = false;
      try {
        await withdrawalService.withdraw(
          'invalid-group-id',
          subAccount1Id,
          50000,
          uuidv4()
        );
      } catch (e) {
        threw = true;
      }
      
      assert(threw, '无效的集团ID应该导致失败');
      
      const afterGroupCredit = await creditService.getGroupCreditById(groupCreditId);
      const afterSub1 = await creditService.getSubAccountById(subAccount1Id);
      
      assertEqual(afterGroupCredit.usedLimit, beforeGroupCredit.usedLimit, '失败后集团已用额度应该不变');
      assertEqual(afterSub1.usedLimit, beforeSub1.usedLimit, '失败后子账户已用额度应该不变');
      
      console.log('✓ 交易原子性正常，失败后回滚');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ 所有验收测试通过！');
    console.log('='.repeat(60));

  } catch (error) {
    if (error instanceof AssertionError) {
      console.error(`\n✗ 测试失败: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`\n✗ 执行出错: ${error.message}`);
      console.error(error.stack);
    } else {
      console.error(`\n✗ 未知错误`);
    }
    process.exit(1);
  } finally {
    db.close();
    try {
      const fs = require('fs');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {}
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
