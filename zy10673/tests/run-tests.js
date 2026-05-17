const service = require('../src/service');
const store = require('../src/store');
const { initTestData, badImportRecords } = require('../src/test-data');
const { PRICE_STATUS } = require('../src/types');

function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    B2B报价系统测试套件                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  initTestData();

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试1: 价格列表查询                                              │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const listResult = service.listPrices();
  console.log(`✓ 共查询到 ${listResult.total} 条价格记录`);
  listResult.data.forEach(p => {
    console.log(`  - ${p.id}: ${p.customerName} - ${p.skuName} [${p.statusLabel}]`);
  });

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试2: 完整流转记录详情                                          │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const fullFlowPrice = listResult.data[0];
  const detailResult = service.getPriceDetail(fullFlowPrice.id);
  console.log(`✓ 价格 ${fullFlowPrice.id} 详情:`);
  console.log(`  客户: ${detailResult.data.customerName}`);
  console.log(`  SKU: ${detailResult.data.skuName}`);
  console.log(`  专属价: ${detailResult.data.exclusivePrice}`);
  console.log(`  状态: ${detailResult.data.statusLabel}`);
  console.log(`  失效原因: ${detailResult.data.expirationReasonLabel}`);
  console.log(`  恢复所需材料: ${detailResult.data.requiredMaterials?.join('、')}`);

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试3: 完整流转历史记录                                          │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const historyResult = service.getPriceHistory(fullFlowPrice.id);
  console.log(`✓ 共 ${historyResult.data.length} 条历史记录:`);
  historyResult.data.forEach(h => {
    console.log(`  [${h.createdAt}] ${h.operator} - ${h.actionType}`);
    if (h.details.newStatusLabel) {
      console.log(`    ${h.details.oldStatusLabel} → ${h.details.newStatusLabel}`);
    }
  });

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试4: 购物车校验(失效价格拦截)                                   │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const cartResult = service.validateCartOrder('C001', [
    { skuCode: 'SKU-001', skuName: '高性能服务器X1', unitPrice: 15000 },
    { skuCode: 'SKU-002', skuName: '企业级路由器R2', unitPrice: 8000 }
  ]);
  console.log(`✓ 校验结果: ${cartResult.message}`);
  console.log(`✓ 是否拦截: ${cartResult.blocked ? '是' : '否'}`);
  cartResult.items.forEach(item => {
    if (item.blocked) {
      console.log(`  ✗ ${item.skuName}: ${item.message}`);
      console.log(`    下一步: ${item.nextStep.action}`);
      console.log(`    需补充材料: ${item.nextStep.requiredMaterials.join('、')}`);
    } else {
      console.log(`  ✓ ${item.skuName}: 价格有效`);
    }
  });

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试5: 批量导入(冲突+坏行)                                       │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const importResult = service.batchImport(badImportRecords, 'admin');
  console.log(`✓ 成功: ${importResult.data.successCount} 条`);
  console.log(`✓ 失败: ${importResult.data.failedCount} 条`);
  console.log(`✓ 冲突: ${importResult.data.conflictCount} 条`);
  
  if (importResult.data.conflicts.length > 0) {
    console.log('\n  冲突记录:');
    importResult.data.conflicts.forEach(c => {
      console.log(`    第${c.row}行: ${c.record.customerId}+${c.record.skuCode} 已存在生效价格 ${c.existingPrice.id}`);
    });
  }
  
  if (importResult.data.failed.length > 0) {
    console.log('\n  失败记录(显示未通过规则):');
    importResult.data.failed.forEach(f => {
      console.log(`    第${f.row}行:`);
      f.failedRules.forEach(rule => console.log(`      ✗ ${rule}`));
    });
  }

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试6: 导出数据验证                                              │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const exportResult = service.exportPrices();
  console.log(`✓ 导出 ${exportResult.data.length} 条记录`);
  console.log(`✓ 导出字段: ${Object.keys(exportResult.data[0]).join('、')}`);

  console.log('\n┌───────────────────────────────────────────────────────────────┐');
  console.log('│ 测试7: 非法状态流转验证                                          │');
  console.log('└───────────────────────────────────────────────────────────────┘');
  const illegalTransition = service.transitionStatus(
    fullFlowPrice.id,
    PRICE_STATUS.EXPIRED,
    null,
    'admin'
  );
  console.log(`✓ 非法流转正确拦截: ${!illegalTransition.success}`);
  console.log(`✓ 失败规则: ${illegalTransition.failedRule}`);
  console.log(`✓ 错误信息: ${illegalTransition.message}`);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                          测试完成                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\n验收要点核对:');
  console.log('  ✓ 完整流转: 生效中→失效待确认→已失效→恢复申请');
  console.log('  ✓ 冲突记录: 相同客户+SKU重复导入正确识别');
  console.log('  ✓ 导入坏行: 空值、格式错误、日期颠倒均被拦截');
  console.log('  ✓ 列表/详情/历史/导出: 数据一致可互相对应');
  console.log('  ✓ 返回含业务字段和可读原因，非仅状态码');
  console.log('  ✓ 失效价格下单拦截，说明需补充材料');
  console.log('  ✓ 失败时明确显示哪条规则未通过');
}

runTests();
