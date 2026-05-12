const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');
const { URGENCY_LEVEL } = require('../models/types');

console.log('==============================================');
console.log('       采购确认规则演示');
console.log('==============================================');
console.log();

console.log('【规则说明】');
console.log('紧急变更在完成前必须检查:');
console.log('  1. 所有采购单必须已确认');
console.log('  2. 存在未确认采购单时不能关闭');
console.log('  3. 非紧急变更不受此限制');
console.log();

let ecnId;

console.log('【步骤1】创建紧急变更单');
console.log('---');
const createResult = ECNService.createECN({
  ...sampleECNs.critical,
  reason: '关键零件采购规格变更，必须供应商确认',
  urgency: URGENCY_LEVEL.CRITICAL,
  createdBy: '采购总监-王总'
});
ecnId = createResult.data.id;
console.log(`✓ 变更单: ${ecnId}`);
console.log(`  紧急程度: ${URGENCY_LEVEL.CRITICAL}`);
console.log();

console.log('【步骤2】提交、分析、审批');
console.log('---');
ECNService.submitECN(ecnId, '采购总监-王总');
const impactData = getImpactData('purchase');
ECNService.addImpactAnalysis(ecnId, impactData, '分析师-赵工');
ECNService.approveECN(ecnId, 'CTO-审批');
const execResult = ECNService.startExecution(ecnId, '执行专员');
console.log('✓ 已进入执行状态');
console.log();

console.log('【步骤3】查看采购单状态');
console.log('---');
let detail = ECNService.getECNDetail(ecnId);
const purchases = detail.data.impacts.purchaseOrders;
console.log('  采购单列表:');
purchases.forEach((p, idx) => {
  console.log(`    [${idx + 1}] ${p.poNumber}`);
  console.log(`      供应商: ${p.supplier}`);
  console.log(`      确认状态: ${p.confirmStatus}`);
});
console.log();
console.log('  注意: PUR-2024-0101 状态是 NOT_CONFIRMED（未确认）');
console.log('        PUR-2024-0102 状态是 CONFIRMED（已确认）');
console.log();

console.log('【步骤4】尝试直接完成变更单（应该失败）');
console.log('---');
const completeFail = ECNService.completeECN(ecnId, '系统-自动');
if (!completeFail.success) {
  console.log(`✗ 预期失败: ${completeFail.error}`);
  if (completeFail.details && completeFail.details.unconfirmedPurchases) {
    console.log(`  未确认采购单: ${completeFail.details.unconfirmedPurchases.join(', ')}`);
  }
}
console.log();

console.log('【步骤5】确认采购单');
console.log('---');
const unconfirmedPO = purchases.find(p => p.confirmStatus === 'NOT_CONFIRMED');
if (unconfirmedPO) {
  ECNService.notifyItem(ecnId, 'PURCHASE', unconfirmedPO.id, '采购协调员');
  console.log(`✓ 已通知: ${unconfirmedPO.poNumber}`);
  
  ECNService.acknowledgeItem(ecnId, 'PURCHASE', unconfirmedPO.id, '采购经理-张经理', {
    confirmStatus: 'CONFIRMED'
  });
  console.log(`✓ 已确认: ${unconfirmedPO.poNumber}`);
  console.log(`  供应商已确认按新规格生产`);
}
console.log();

console.log('【步骤6】完成所有采购单');
console.log('---');
detail = ECNService.getECNDetail(ecnId);
detail.data.impacts.purchaseOrders.forEach((p, idx) => {
  ECNService.completeItem(ecnId, 'PURCHASE', p.id, '采购经理-张经理', {
    completionNote: '供应商已确认变更，订单已更新'
  });
  console.log(`✓ 采购单完成[${idx + 1}]: ${p.poNumber}`);
});
console.log();

console.log('【步骤7】确认所有物料处理完毕');
console.log('---');
detail = ECNService.getECNDetail(ecnId);
detail.data.impacts.materials.forEach((m, idx) => {
  ECNService.notifyItem(ecnId, 'MATERIAL', m.id, '物料协调员');
  ECNService.acknowledgeItem(ecnId, 'MATERIAL', m.id, '物料经理');
  ECNService.completeItem(ecnId, 'MATERIAL', m.id, '物料经理');
  console.log(`✓ 物料完成[${idx + 1}]: ${m.materialCode}`);
});
console.log();

console.log('【步骤8】再次尝试完成变更单（应该成功）');
console.log('---');
const completeSuccess = ECNService.completeECN(ecnId, '采购总监-王总');
if (completeSuccess.success) {
  console.log(`✓ 变更单已完成`);
  console.log(`  最终状态: ${completeSuccess.data.ecn.status}`);
} else {
  console.log(`✗ 意外失败: ${completeSuccess.error}`);
}
console.log();

console.log('==============================================');
console.log('       采购确认演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 紧急变更必须检查采购确认状态');
console.log('  ✓ 未确认采购单时无法完成变更');
console.log('  ✓ 完成所有采购单确认后可正常关闭');
console.log('  ✓ 可查询未确认采购单列表');
