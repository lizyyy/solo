const demoService = require('../src/services/demoService');

async function runTests() {
  console.log('='.repeat(80));
  console.log('设备租赁押金系统 - 自动化测试');
  console.log('='.repeat(80));
  console.log();
  
  console.log('清除现有数据...');
  await demoService.clearAllData();
  
  const results = [];
  
  console.log('测试 1: 正常归还场景');
  try {
    const r = await demoService.normalReturnScenario();
    const passed = r.finalState.orderStatus === 'REFUND_SUCCESS' && 
                   r.finalState.depositRefunded === r.finalState.depositFrozen &&
                   r.finalState.totalOverdueFee === 0 &&
                   r.finalState.totalDamageFee === 0;
    results.push({ test: 'normal-return', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'normal-return', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 2: 逾期扣费场景');
  try {
    const r = await demoService.overdueFeeScenario();
    const passed = r.finalState.orderStatus === 'REFUND_SUCCESS' &&
                   r.finalState.totalOverdueFee === 150 &&
                   r.finalState.depositRefunded === 4850;
    results.push({ test: 'overdue-fee', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'overdue-fee', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 3: 损坏扣费场景');
  try {
    const r = await demoService.damageFeeScenario();
    const passed = r.finalState.orderStatus === 'REFUND_SUCCESS' &&
                   r.finalState.totalDamageFee === 500 &&
                   r.finalState.depositRefunded === 2500;
    results.push({ test: 'damage-fee', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'damage-fee', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 4: 续租后归还场景');
  try {
    const r = await demoService.renewThenReturnScenario();
    const passed = r.finalState.orderStatus === 'REFUND_SUCCESS' &&
                   r.finalState.renewCount === 2 &&
                   r.finalState.totalRentalDays === 7;
    results.push({ test: 'renew-then-return', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'renew-then-return', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 5: 重复退款(幂等性)');
  try {
    const r = await demoService.duplicateRefundScenario();
    const passed = r.finalState.idempotencyVerified &&
                   r.finalState.refundTransactionCount === 1;
    results.push({ test: 'duplicate-refund', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'duplicate-refund', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 6: 逾期+损坏同时存在');
  try {
    const r = await demoService.overdueAndDamageScenario();
    const passed = r.finalState.verified;
    results.push({ test: 'overdue-and-damage', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'overdue-and-damage', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 7: 损坏费用超过押金');
  try {
    const r = await demoService.damageExceedsDepositScenario();
    const passed = r.finalState.verified &&
                   r.finalState.depositRefunded === 0 &&
                   r.finalState.damageExceedsDeposit;
    results.push({ test: 'damage-exceeds-deposit', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'damage-exceeds-deposit', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log('测试 8: 人工修正');
  try {
    const r = await demoService.manualAdjustScenario();
    const passed = r.finalState.totalManualAdjust !== 0 &&
                   r.finalState.auditLogs >= 2;
    results.push({ test: 'manual-adjust', passed, detail: r.finalState });
    console.log(passed ? '  ✓ 通过' : '  ✗ 失败');
  } catch (e) {
    results.push({ test: 'manual-adjust', passed: false, error: e.message });
    console.log('  ✗ 失败:', e.message);
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('测试结果汇总');
  console.log('='.repeat(80));
  
  const passedCount = results.filter(r => r.passed).length;
  results.forEach(r => {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${r.test}`);
    if (r.error) console.log(`    错误: ${r.error}`);
  });
  
  console.log();
  console.log(`总计: ${passedCount}/${results.length} 个测试通过`);
  console.log();
  
  if (passedCount < results.length) {
    process.exit(1);
  }
}

runTests().catch(console.error);