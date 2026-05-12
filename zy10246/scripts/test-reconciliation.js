import { initDB, getDB } from '../src/config/database.js';
import { issueVoucher, bindPassenger, redeemVoucher, refundVoucher } from '../src/services/voucherService.js';
import { reconcile, getReconciliationDetails } from '../src/services/reconciliationService.js';
import { VOUCHER_TYPES } from '../src/models/Voucher.js';

async function testReconciliation() {
  console.log('='.repeat(60));
  console.log('机场贵宾厅券核销 API - 对账差异演示');
  console.log('='.repeat(60));

  await initDB();
  const db = await getDB();

  db.data.vouchers = [];
  db.data.passengers = [];
  db.data.corporateAccounts = [];
  db.data.transactions = [];
  await db.write();

  const { createCorporateAccount } = await import('../src/models/CorporateAccount.js');
  const company = await createCorporateAccount({
    name: '演示航空公司',
    totalQuota: 100,
    contact: '王经理'
  });

  const SOURCE_ID = 'BANK_ZHAOSHANG_DEMO';

  console.log('\n' + '─'.repeat(60));
  console.log('场景: 模拟银行渠道实际业务流程');
  console.log('─'.repeat(60));

  console.log('\n1. 发放 5 张银行券...');
  for (let i = 1; i <= 5; i++) {
    await issueVoucher({
      type: VOUCHER_TYPES.BANK,
      sourceId: SOURCE_ID,
      amount: 1,
      requestId: `bank_issue_${i}`
    });
  }
  console.log('   ✅ 已发放 5 张银行券');

  console.log('\n2. 绑定旅客并核销 3 张券...');
  const vouchers = db.data.vouchers.slice(0, 3);
  for (let i = 0; i < vouchers.length; i++) {
    await bindPassenger({
      voucherCode: vouchers[i].code,
      passengerName: `旅客${i + 1}`,
      idCard: `11010119900101000${i + 1}`,
      requestId: `bank_bind_${i + 1}`
    });
    await redeemVoucher({
      voucherCode: vouchers[i].code,
      passengerName: `旅客${i + 1}`,
      requestId: `bank_redeem_${i + 1}`
    });
  }
  console.log('   ✅ 已核销 3 张券');

  console.log('\n3. 退券 1 张...');
  await refundVoucher({
    voucherCode: vouchers[0].code,
    reason: '旅客取消行程',
    requestId: 'bank_refund_1'
  });
  console.log('   ✅ 已退券 1 张');

  console.log('\n' + '─'.repeat(60));
  console.log('对账场景 1: 银行系统数据与系统数据一致');
  console.log('─'.repeat(60));
  
  const correctExternalData = {
    totalUsed: 3,
    totalRefunded: 1,
    totalAmount: 5
  };
  
  const result1 = await reconcile(SOURCE_ID, null, null, correctExternalData);
  console.log('系统统计:');
  console.log('  - 总发放:', result1.statistics.totalIssued, '张');
  console.log('  - 已核销:', result1.statistics.totalUsed, '张');
  console.log('  - 已退款:', result1.statistics.totalRefunded, '张');
  console.log('  - 银行券:', result1.statistics.bankVouchers, '张');
  console.log('  - 总金额:', result1.statistics.totalAmount);
  console.log('\n外部数据（银行提供）:');
  console.log('  - 已核销:', correctExternalData.totalUsed, '张');
  console.log('  - 已退款:', correctExternalData.totalRefunded, '张');
  console.log('  - 总金额:', correctExternalData.totalAmount);
  console.log('\n对账结果:', result1.differences.length === 0 ? '✅ 完全一致' : '❌ 存在差异');
  if (result1.differences.length > 0) {
    result1.differences.forEach(d => {
      console.log('  -', d.type, `(期望:${d.expected}, 实际:${d.actual})`);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('对账场景 2: 银行漏报 1 笔核销（产生差异）');
  console.log('─'.repeat(60));
  
  const mismatchExternalData1 = {
    totalUsed: 2,
    totalRefunded: 1,
    totalAmount: 5
  };
  
  const result2 = await reconcile(SOURCE_ID, null, null, mismatchExternalData1);
  console.log('系统统计:');
  console.log('  - 已核销:', result2.statistics.totalUsed, '张');
  console.log('  - 已退款:', result2.statistics.totalRefunded, '张');
  console.log('\n外部数据（银行提供 - 漏报1笔）:');
  console.log('  - 已核销:', mismatchExternalData1.totalUsed, '张');
  console.log('  - 已退款:', mismatchExternalData1.totalRefunded, '张');
  console.log('\n对账结果:', result2.differences.length === 0 ? '✅ 完全一致' : '❌ 存在差异');
  if (result2.differences.length > 0) {
    result2.differences.forEach(d => {
      console.log('  ❌', d.type);
      console.log('     期望:', d.expected, ', 实际:', d.actual, ', 差异:', d.difference);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('对账场景 3: 银行漏报退款 + 金额不符（多重差异）');
  console.log('─'.repeat(60));
  
  const mismatchExternalData2 = {
    totalUsed: 3,
    totalRefunded: 0,
    totalAmount: 4
  };
  
  const result3 = await reconcile(SOURCE_ID, null, null, mismatchExternalData2);
  console.log('系统统计:');
  console.log('  - 已核销:', result3.statistics.totalUsed, '张');
  console.log('  - 已退款:', result3.statistics.totalRefunded, '张');
  console.log('  - 总金额:', result3.statistics.totalAmount);
  console.log('\n外部数据（银行提供 - 漏报退款+金额不符）:');
  console.log('  - 已核销:', mismatchExternalData2.totalUsed, '张');
  console.log('  - 已退款:', mismatchExternalData2.totalRefunded, '张');
  console.log('  - 总金额:', mismatchExternalData2.totalAmount);
  console.log('\n对账结果:', result3.differences.length === 0 ? '✅ 完全一致' : '❌ 存在差异');
  if (result3.differences.length > 0) {
    result3.differences.forEach(d => {
      console.log('  ❌', d.type);
      console.log('     期望:', d.expected, ', 实际:', d.actual, ', 差异:', d.difference);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('对账明细查询');
  console.log('─'.repeat(60));
  
  const details = await getReconciliationDetails(SOURCE_ID);
  console.log('券列表:');
  details.vouchers.list.forEach(v => {
    console.log('  -', v.code, `(${v.type}, ${v.status})`);
  });
  console.log('\n交易记录:');
  details.transactions.list.slice(0, 5).forEach(t => {
    console.log('  -', t.type, '|', t.voucherId.substring(0, 8) + '...', '|', t.createdAt.substring(0, 19));
  });
  console.log('  ... (更多交易记录)');

  console.log('\n' + '='.repeat(60));
  console.log('✅ 对账差异演示完成!');
  console.log('='.repeat(60));
  console.log('\n已验证对账场景:');
  console.log('  ✅ 数据完全一致');
  console.log('  ✅ 核销数量差异');
  console.log('  ✅ 退款数量差异');
  console.log('  ✅ 多重差异同时出现');
  console.log('  ✅ 对账明细查询');
  console.log('\n提示: 运行 npm start 可以启动 API 服务器');
}

testReconciliation().catch(console.error);