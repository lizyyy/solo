import { DatabaseHelper } from '../src/database/helper';
import { CreditService } from '../src/services/creditService';
import { WithdrawalService } from '../src/services/withdrawalService';
import { v4 as uuidv4 } from 'uuid';

async function runConcurrencyTest(): Promise<void> {
  console.log('='.repeat(60));
  console.log('并发提款测试（简化版）');
  console.log('='.repeat(60));

  const testDbPath = './test_concurrency.db';

  try {
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  } catch (e) {}

  const db = new DatabaseHelper(testDbPath);
  const creditService = new CreditService(db);
  const withdrawalService = new WithdrawalService(db, creditService);

  try {
    console.log('\n【步骤1：创建集团额度（100万）】');
    const groupCredit = await creditService.createGroupCredit('测试集团', 1000000);
    const groupCreditId = groupCredit.id;
    console.log(`初始状态 - 可用: ${groupCredit.availableLimit}, 已用: ${groupCredit.usedLimit}`);

    console.log('\n【步骤2：创建两个子账户】');
    const subAccount1 = await creditService.createSubAccount(groupCreditId, '子公司A');
    const subAccount2 = await creditService.createSubAccount(groupCreditId, '子公司B');

    console.log('\n【步骤3：并发提款】');
    console.log('子公司A 提款 70万，子公司B 提款 40万');
    console.log('总额 110万 > 100万，应该只有一笔成功');

    const promise1 = withdrawalService.withdraw(
      groupCreditId,
      subAccount1.id,
      700000,
      uuidv4()
    );

    const promise2 = withdrawalService.withdraw(
      groupCreditId,
      subAccount2.id,
      400000,
      uuidv4()
    );

    const results = await Promise.allSettled([promise1, promise2]);

    console.log('\n【结果】');
    let successCount = 0;
    let successAmount = 0;

    results.forEach((result, index) => {
      const company = index === 0 ? '子公司A（70万）' : '子公司B（40万）';
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
          successAmount += result.value.withdrawal.amount;
          console.log(`${company}: 成功 - 提款 ${result.value.withdrawal.amount}`);
        } else {
          console.log(`${company}: 未知状态`);
        }
      } else {
        console.log(`${company}: 失败 - ${result.reason instanceof Error ? result.reason.message : result.reason}`);
      }
    });

    console.log(`\n成功笔数: ${successCount}, 成功金额: ${successAmount}`);

    console.log('\n【步骤4：查询数据库】');
    const finalGroupCredit = await creditService.getGroupCreditById(groupCreditId);
    const finalSub1 = await creditService.getSubAccountById(subAccount1.id);
    const finalSub2 = await creditService.getSubAccountById(subAccount2.id);

    console.log(`集团 - 可用: ${finalGroupCredit.availableLimit}, 已用: ${finalGroupCredit.usedLimit}`);
    console.log(`子公司A - 已用: ${finalSub1.usedLimit}`);
    console.log(`子公司B - 已用: ${finalSub2.usedLimit}`);

    const totalSubUsed = finalSub1.usedLimit + finalSub2.usedLimit;
    console.log(`子账户已用合计: ${totalSubUsed}`);

    console.log('\n【验证】');
    const isConsistent = totalSubUsed === finalGroupCredit.usedLimit;
    const isNoOverdraft = finalGroupCredit.usedLimit <= finalGroupCredit.totalLimit;
    const isSuccessMatches = successAmount === finalGroupCredit.usedLimit;
    const isOnlyOneSuccess = successCount <= 1;

    console.log(`子账户已用 = 集团已用: ${isConsistent ? '✓' : '✗'}`);
    console.log(`集团已用 <= 总额度: ${isNoOverdraft ? '✓' : '✗'}`);
    console.log(`成功金额 = 集团已用: ${isSuccessMatches ? '✓' : '✗'}`);
    console.log(`成功笔数 <= 1: ${isOnlyOneSuccess ? '✓' : '✗'}`);

    if (isConsistent && isNoOverdraft && isSuccessMatches && isOnlyOneSuccess) {
      console.log('\n✓ 测试通过！并发提款没有超额');
      if (successCount === 1) {
        console.log(`✓ 只有一笔成功，金额: ${successAmount}`);
      }
    } else {
      console.log('\n✗ 测试失败！');
      if (!isOnlyOneSuccess) {
        console.log('✗ 两笔提款都成功了，总额超额！');
      }
      if (!isConsistent) {
        console.log('✗ 集团与子账户余额不一致！');
      }
      if (!isSuccessMatches) {
        console.log('✗ 成功金额与数据库不一致！');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ 执行出错:', error instanceof Error ? error.message : error);
    if (error instanceof Error) console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
    try {
      const fs = require('fs');
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    } catch (e) {}
  }
}

runConcurrencyTest();
