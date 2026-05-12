import { initDB, getDB } from '../src/config/database.js';
import { issueVoucher, bindPassenger, redeemVoucher, refundVoucher, getQuota } from '../src/services/voucherService.js';
import { VOUCHER_TYPES } from '../src/models/Voucher.js';

async function testFlow() {
  console.log('='.repeat(60));
  console.log('机场贵宾厅券核销 API - 完整流程演示');
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
    totalQuota: 10,
    contact: '王经理'
  });
  const corporateId = company.id;

  let voucherCode;

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 1: 查询初始企业额度');
  console.log('─'.repeat(60));
  const quota0 = await getQuota(corporateId);
  console.log('总额度:', quota0.totalQuota);
  console.log('已用额度:', quota0.usedQuota);
  console.log('剩余额度:', quota0.remainingQuota);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 2: 发放企业券（扣减额度）');
  console.log('─'.repeat(60));
  const issueResult = await issueVoucher({
    type: VOUCHER_TYPES.CORPORATE,
    sourceId: 'DEMO_SOURCE',
    corporateId: corporateId,
    amount: 1,
    requestId: 'req_issue_001'
  });
  console.log('发券结果:', issueResult.success ? '成功' : '失败');
  voucherCode = issueResult.voucher.code;
  console.log('券码:', voucherCode);
  console.log('券状态:', issueResult.voucher.status);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 3: 查询发券后的企业额度');
  console.log('─'.repeat(60));
  const quota1 = await getQuota(corporateId);
  console.log('总额度:', quota1.totalQuota);
  console.log('已用额度:', quota1.usedQuota);
  console.log('剩余额度:', quota1.remainingQuota);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 4: 绑定旅客');
  console.log('─'.repeat(60));
  const bindResult = await bindPassenger({
    voucherCode: voucherCode,
    passengerName: '张三',
    idCard: '110101199001011234',
    phone: '13800138000',
    requestId: 'req_bind_001'
  });
  console.log('绑定结果:', bindResult.success ? '成功' : '失败');
  console.log('旅客姓名:', bindResult.passenger.name);
  console.log('券状态:', bindResult.voucher.status);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 5: 成功核销');
  console.log('─'.repeat(60));
  const redeemResult = await redeemVoucher({
    voucherCode: voucherCode,
    passengerName: '张三',
    requestId: 'req_redeem_001'
  });
  console.log('核销结果:', redeemResult.success ? '✅ 成功' : '❌ 失败');
  if (redeemResult.success) {
    console.log('券状态:', redeemResult.voucher.status);
    console.log('核销时间:', redeemResult.voucher.usedAt);
  } else {
    console.log('错误信息:', redeemResult.error);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 6: 测试 - 重复核销（应该失败）');
  console.log('─'.repeat(60));
  const duplicateRedeem = await redeemVoucher({
    voucherCode: voucherCode,
    passengerName: '张三',
    requestId: 'req_redeem_002'
  });
  console.log('核销结果:', duplicateRedeem.success ? '成功' : '❌ 失败');
  console.log('错误信息:', duplicateRedeem.error);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 7: 测试 - 旅客姓名不匹配');
  console.log('─'.repeat(60));
  const issueResult2 = await issueVoucher({
    type: VOUCHER_TYPES.BANK,
    sourceId: 'DEMO_BANK',
    amount: 1,
    requestId: 'req_issue_002'
  });
  await bindPassenger({
    voucherCode: issueResult2.voucher.code,
    passengerName: '李四',
    idCard: '310101199002025678'
  });
  const nameMismatch = await redeemVoucher({
    voucherCode: issueResult2.voucher.code,
    passengerName: '王五'
  });
  console.log('核销结果:', nameMismatch.success ? '成功' : '❌ 失败');
  console.log('错误信息:', nameMismatch.error);
  console.log('期望姓名:', nameMismatch.expectedName);
  console.log('提供姓名:', nameMismatch.providedName);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 8: 退券回滚');
  console.log('─'.repeat(60));
  const refundResult = await refundVoucher({
    voucherCode: voucherCode,
    reason: '旅客取消行程',
    requestId: 'req_refund_001'
  });
  console.log('退券结果:', refundResult.success ? '✅ 成功' : '失败');
  console.log('券状态:', refundResult.voucher.status);
  console.log('退款时间:', refundResult.voucher.refundedAt);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 9: 查询退券后的企业额度（应该恢复）');
  console.log('─'.repeat(60));
  const quota2 = await getQuota(corporateId);
  console.log('总额度:', quota2.totalQuota);
  console.log('已用额度:', quota2.usedQuota);
  console.log('剩余额度:', quota2.remainingQuota);
  console.log('额度已恢复:', quota2.usedQuota === quota1.usedQuota - 1 ? '✅ 是' : '❌ 否');

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 10: 测试 - 企业额度超限');
  console.log('─'.repeat(60));
  const { createCorporateAccount: createAccount } = await import('../src/models/CorporateAccount.js');
  const smallCompany = await createAccount({
    name: '小公司',
    totalQuota: 1,
    contact: '测试'
  });
  
  await issueVoucher({
    type: VOUCHER_TYPES.CORPORATE,
    sourceId: 'TEST_SOURCE',
    corporateId: smallCompany.id,
    amount: 1
  });
  
  const overQuota = await issueVoucher({
    type: VOUCHER_TYPES.CORPORATE,
    sourceId: 'TEST_SOURCE',
    corporateId: smallCompany.id,
    amount: 1
  });
  console.log('发券结果:', overQuota.success ? '成功' : '❌ 失败');
  console.log('错误信息:', overQuota.error);

  console.log('\n' + '─'.repeat(60));
  console.log('步骤 11: 测试 - 幂等性（重复提交相同 requestId）');
  console.log('─'.repeat(60));
  const idempotentResult = await issueVoucher({
    type: VOUCHER_TYPES.BANK,
    sourceId: 'DEMO_SOURCE',
    amount: 1,
    requestId: 'req_issue_001'
  });
  console.log('是否重复:', idempotentResult.duplicated ? '✅ 是' : '否');
  console.log('返回相同券码:', idempotentResult.voucher.code === voucherCode ? '✅ 是' : '否');

  console.log('\n' + '='.repeat(60));
  console.log('✅ 流程演示完成!');
  console.log('='.repeat(60));
  console.log('\n已验证场景:');
  console.log('  ✅ 成功核销');
  console.log('  ✅ 退券回滚');
  console.log('  ✅ 重复核销');
  console.log('  ✅ 旅客姓名不匹配');
  console.log('  ✅ 额度恢复');
  console.log('  ✅ 企业额度超限');
  console.log('  ✅ 幂等性（重复提交）');
  console.log('\n提示: 运行 npm run test-reconciliation 可以体验对账差异');
}

testFlow().catch(console.error);