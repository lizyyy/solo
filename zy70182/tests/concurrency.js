const rebateRules = require('../modules/rebateRules');
const salesSummary = require('../modules/salesSummary');
const reconciliation = require('../modules/reconciliation');
const { acquireLock, releaseLock, isLocked } = require('../utils/lock');

console.log('=== 并发控制测试 ===\n');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runConcurrencyTest() {
  try {
    console.log('[准备] 创建测试供应商和规则...');
    
    const supplier = rebateRules.createSupplier({
      name: '并发测试供应商',
      contact: '测试联系人'
    }, 'test');
    
    const rule = rebateRules.createRule({
      supplier_id: supplier.id,
      name: '并发测试规则',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      tiers: [
        { min_quantity: 0, max_quantity: null, rebate_rate: 0.05 }
      ]
    }, 'test');
    
    rebateRules.activateRule(rule.id, 'test');
    
    salesSummary.addSalesRecord({
      supplier_id: supplier.id,
      product_sku: 'TEST001',
      product_name: '测试商品',
      quantity: 100,
      unit_price: 100,
      sale_date: '2026-05-01'
    }, 'test');
    
    console.log('[准备] 测试数据创建完成\n');
    
    console.log('[测试1] 直接测试锁机制...');
    console.log('        预期：第一个请求获得锁，第二个请求被拒绝');
    
    const resourceType = 'reconciliation';
    const resourceId = `${supplier.id}_2026-05_test`;
    const holderA = 'user_A_test';
    const holderB = 'user_B_test';
    
    console.log('        [请求A] 尝试获取锁...');
    const lockA = acquireLock(resourceType, resourceId, holderA);
    console.log(`        [请求A] 锁获取结果: ${lockA.success ? '成功' : '失败'}`);
    
    if (lockA.success) {
      console.log(`        [检查] 资源是否被锁定: ${isLocked(resourceType, resourceId) ? '是' : '否'}`);
      
      console.log('        [请求B] 尝试获取锁（应失败）...');
      const lockB = acquireLock(resourceType, resourceId, holderB);
      console.log(`        [请求B] 锁获取结果: ${lockB.success ? '成功' : '失败: ' + lockB.error}`);
      
      if (!lockB.success) {
        console.log('[验证1] ✓ 锁机制正常，同一资源不能被重复获取');
      } else {
        console.log('[验证1] ✗ 锁机制存在问题');
      }
      
      console.log('\n[测试2] 释放锁后再次获取...');
      console.log('        [请求A] 释放锁...');
      const released = releaseLock(resourceType, resourceId);
      console.log(`        释放结果: ${released ? '成功' : '失败'}`);
      
      console.log(`        [检查] 资源是否被锁定: ${isLocked(resourceType, resourceId) ? '是' : '否'}`);
      
      console.log('        [请求B] 尝试获取锁（应成功）...');
      const lockBAfter = acquireLock(resourceType, resourceId, holderB);
      console.log(`        [请求B] 锁获取结果: ${lockBAfter.success ? '成功' : '失败: ' + lockBAfter.error}`);
      
      if (lockBAfter.success) {
        console.log('[验证2] ✓ 锁释放后可以正常获取');
        releaseLock(resourceType, resourceId);
      } else {
        console.log('[验证2] ✗ 锁释放后获取失败');
      }
    }
    
    console.log('\n[测试3] 已确认的核算不能重算...');
    console.log('        预期：已确认的核算不能重算');
    
    let summary = reconciliation.calculateReconciliation(supplier.id, '2026-05', 'test');
    reconciliation.submitForConfirmation(summary.id, 'test');
    
    const letter = reconciliation.createConfirmationLetter(summary.id, null, 'test');
    reconciliation.confirmReconciliation(summary.id, letter.id, '测试确认人', '', 'test');
    
    try {
      reconciliation.calculateReconciliation(supplier.id, '2026-05', 'user_D');
      console.log('[验证3] ✗ 已确认的核算被重算，存在问题');
    } catch (err) {
      console.log('        错误:', err.message);
      console.log('[验证3] ✓ 已确认的核算正确阻止了重算');
    }
    
    console.log('\n[测试4] 状态流转验证...');
    console.log('        验证：calculating → pending_confirmation → confirmed');
    
    const supplier2 = rebateRules.createSupplier({
      name: '状态流转测试供应商',
      contact: '测试'
    }, 'test');
    
    const rule2 = rebateRules.createRule({
      supplier_id: supplier2.id,
      name: '状态流转测试规则',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      tiers: [
        { min_quantity: 0, max_quantity: null, rebate_rate: 0.05 }
      ]
    }, 'test');
    
    rebateRules.activateRule(rule2.id, 'test');
    
    salesSummary.addSalesRecord({
      supplier_id: supplier2.id,
      product_sku: 'TEST002',
      product_name: '测试商品2',
      quantity: 200,
      unit_price: 150,
      sale_date: '2026-06-01'
    }, 'test');
    
    let summary2 = reconciliation.calculateReconciliation(supplier2.id, '2026-06', 'test');
    console.log(`        计算后状态: ${summary2.status}`);
    
    summary2 = reconciliation.submitForConfirmation(summary2.id, 'test');
    console.log(`        提交确认后状态: ${summary2.status}`);
    
    const letter2 = reconciliation.createConfirmationLetter(summary2.id, null, 'test');
    const result = reconciliation.confirmReconciliation(summary2.id, letter2.id, '确认人', '', 'test');
    console.log(`        确认后状态: ${result.summary.status}`);
    
    if (result.summary.status === 'confirmed') {
      console.log('[验证4] ✓ 状态流转正确：calculating → pending_confirmation → confirmed');
    } else {
      console.log('[验证4] ✗ 状态流转存在问题');
    }
    
    console.log('\n=== 并发控制测试完成 ===');
    
  } catch (err) {
    console.error('测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runConcurrencyTest();
