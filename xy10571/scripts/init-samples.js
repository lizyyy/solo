const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');
const { URGENCY_LEVEL } = require('../models/types');

console.log('========== 初始化样例数据 ==========');
console.log();

const results = [];

console.log('【样例1】普通变更 - 待提交');
const normalResult = ECNService.createECN(sampleECNs.normal);
if (normalResult.success) {
  console.log(`  ✓ 已创建: ${normalResult.data.id}`);
  console.log(`    标题: ${normalResult.data.title}`);
  console.log(`    状态: ${normalResult.data.status}`);
  results.push({ type: 'normal', ecnId: normalResult.data.id });
}
console.log();

console.log('【样例2】紧急变更 - 已分析待审批');
const urgentResult = ECNService.createECN(sampleECNs.urgent);
if (urgentResult.success) {
  console.log(`  ✓ 已创建: ${urgentResult.data.id}`);
  ECNService.submitECN(urgentResult.data.id, '工程师-李四');
  console.log('  ✓ 已提交');
  ECNService.addImpactAnalysis(urgentResult.data.id, getImpactData('full'), '分析师-王工');
  console.log('  ✓ 已完成影响分析');
  console.log(`    紧急程度: ${urgentResult.data.urgency}`);
  results.push({ type: 'urgent', ecnId: urgentResult.data.id });
}
console.log();

console.log('【样例3】严重变更 - 执行中（含冻结和追溯）');
const criticalResult = ECNService.createECN(sampleECNs.critical);
if (criticalResult.success) {
  console.log(`  ✓ 已创建: ${criticalResult.data.id}`);
  ECNService.submitECN(criticalResult.data.id, '技术总监-王五');
  console.log('  ✓ 已提交');
  ECNService.addImpactAnalysis(criticalResult.data.id, getImpactData('full'), '首席分析师-赵工');
  console.log('  ✓ 已完成影响分析');
  ECNService.approveECN(criticalResult.data.id, 'CTO-审批');
  console.log('  ✓ 已审批');
  const execResult = ECNService.startExecution(criticalResult.data.id, '系统-自动执行');
  console.log('  ✓ 已开始执行');
  if (execResult.data.urgentFreeze.frozen) {
    console.log(`    冻结订单数: ${execResult.data.urgentFreeze.frozenOrders.length}`);
    console.log(`    追溯订单数: ${execResult.data.urgentFreeze.skippedOrders.length}`);
  }
  results.push({ type: 'critical', ecnId: criticalResult.data.id });
}
console.log();

console.log('========== 初始化完成 ==========');
console.log();
console.log('已创建的样例变更单:');
results.forEach(r => {
  const detail = ECNService.getECNDetail(r.ecnId);
  console.log(`  ${r.type}: ${r.ecnId} - 状态: ${detail.data.ecn.status}`);
  if (detail.data.statistics) {
    console.log(`    影响范围: 物料${detail.data.statistics.total.materials} | 在制${detail.data.statistics.total.productionOrders} | 采购${detail.data.statistics.total.purchaseOrders} | 客户${detail.data.statistics.total.customerOrders}`);
  }
});

console.log();
console.log('可使用以下命令运行演示脚本:');
console.log('  npm run demo-normal    - 普通变更完整流程');
console.log('  npm run demo-urgent    - 紧急变更冻结流程');
console.log('  npm run demo-purchase  - 采购确认流程');
console.log('  npm run demo-customer  - 客户订单追溯');
console.log('  npm run demo-duplicate - 重复通知幂等性');
console.log('  npm run demo-failure   - 异常处理流程');
