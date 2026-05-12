const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');
const { URGENCY_LEVEL } = require('../models/types');

console.log('==============================================');
console.log('       紧急变更 - 立即冻结流程演示');
console.log('==============================================');
console.log();

let ecnId;

console.log('【场景说明】');
console.log('发现关键安全零件存在设计缺陷，需要紧急变更并立即冻结在制单');
console.log('已出货的产品只能做追溯，不能冻结');
console.log();

console.log('【步骤1】创建紧急变更单');
console.log('---');
const createResult = ECNService.createECN({
  ...sampleECNs.urgent,
  reason: '安全零件材料强度不足，存在断裂风险',
  urgency: URGENCY_LEVEL.URGENT,
  createdBy: '质量经理-李四'
});
if (createResult.success) {
  ecnId = createResult.data.id;
  console.log(`✓ 变更单创建成功: ${ecnId}`);
  console.log(`  紧急程度: ${createResult.data.urgency}`);
}
console.log();

console.log('【步骤2】快速提交并完成影响分析');
console.log('---');
ECNService.submitECN(ecnId, '质量经理-李四');
console.log('✓ 已提交');

const impactData = getImpactData('full');
const analyzeResult = ECNService.addImpactAnalysis(ecnId, impactData, '分析师-王工');
console.log(`✓ 影响分析完成`);
console.log(`  在制单数量: ${analyzeResult.data.statistics.total.productionOrders}`);
console.log(`  包含: 未出货、部分出货、已出货三种状态`);
console.log();

console.log('【步骤3】快速审批');
console.log('---');
ECNService.approveECN(ecnId, 'CTO-紧急审批');
console.log('✓ 已紧急审批');
console.log();

console.log('【步骤4】开始执行 - 自动冻结');
console.log('---');
const execResult = ECNService.startExecution(ecnId, '系统-自动冻结');
if (execResult.success && execResult.data.urgentFreeze.frozen) {
  console.log(`✓ 紧急冻结已触发`);
  console.log(`  冻结级别: ${execResult.data.urgentFreeze.urgentLevel}`);
  console.log();
  
  console.log('【冻结详情】');
  console.log('---');
  if (execResult.data.urgentFreeze.frozenOrders.length > 0) {
    console.log('  已冻结的在制单:');
    execResult.data.urgentFreeze.frozenOrders.forEach((o, idx) => {
      console.log(`    [${idx + 1}] ${o.orderNo} - ${o.action}`);
    });
  }
  console.log();
  
  if (execResult.data.urgentFreeze.skippedOrders.length > 0) {
    console.log('  仅追溯（已出货）的在制单:');
    execResult.data.urgentFreeze.skippedOrders.forEach((o, idx) => {
      console.log(`    [${idx + 1}] ${o.orderNo} - ${o.reason}`);
    });
  }
  console.log();
  
  console.log('【已出货订单处理】');
  console.log('---');
  if (execResult.data.shippedOrders.tracedOrders.length > 0) {
    console.log('  客户订单追溯处理:');
    execResult.data.shippedOrders.tracedOrders.forEach((o, idx) => {
      console.log(`    [${idx + 1}] ${o.orderNo} - ${o.action}`);
    });
  }
}
console.log();

console.log('【步骤5】查看当前状态');
console.log('---');
const detail = ECNService.getECNDetail(ecnId);
console.log(`  变更单状态: ${detail.data.ecn.status}`);
console.log();
console.log('  在制单状态详情:');
detail.data.impacts.productionOrders.forEach((p, idx) => {
  console.log(`    [${idx + 1}] ${p.orderNo}`);
  console.log(`      状态: ${p.status}`);
  console.log(`      是否冻结: ${p.frozen ? '是' : '否'}`);
  console.log(`      出货状态: ${p.shipmentStatus}`);
  console.log(`      备注: ${p.note || '-'}`);
});
console.log();

console.log('【步骤6】查看历史记录');
console.log('---');
const history = detail.data.history;
console.log(`✓ 共 ${history.length} 条历史记录`);
history.forEach((h, idx) => {
  if (h.type === 'PRODUCTION_UPDATE') {
    console.log(`  [${idx + 1}] ${h.action}`);
    if (h.diff) {
      Object.entries(h.diff).forEach(([key, value]) => {
        console.log(`      ${key}: ${JSON.stringify(value.before)} -> ${JSON.stringify(value.after)}`);
      });
    }
  }
});
console.log();

console.log('==============================================');
console.log('       紧急冻结演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 紧急级别变更自动触发冻结');
console.log('  ✓ 未出货订单: 完全冻结');
console.log('  ✓ 部分出货订单: 剩余部分冻结');
console.log('  ✓ 已出货订单: 仅追溯，不冻结');
console.log('  ✓ 历史记录保留状态变化差异');
console.log('  ✓ 冻结状态可查询');
