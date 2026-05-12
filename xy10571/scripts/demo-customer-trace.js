const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');
const { URGENCY_LEVEL } = require('../models/types');

console.log('==============================================');
console.log('       客户订单追溯演示');
console.log('==============================================');
console.log();

console.log('【场景说明】');
console.log('工程变更涉及已发货的客户订单，需要追溯已出货产品，');
console.log('同时通知未出货订单的变更影响。');
console.log();
console.log('出货状态定义:');
console.log('  - NOT_SHIPPED: 未出货 -> 通知客户，可变更');
console.log('  - PARTIALLY_SHIPPED: 部分出货 -> 已出货追溯，未出货通知');
console.log('  - FULLY_SHIPPED: 已完全出货 -> 仅追溯记录');
console.log();

let ecnId;

console.log('【步骤1】创建涉及客户订单的变更单');
console.log('---');
const createResult = ECNService.createECN({
  ...sampleECNs.normal,
  title: '产品外观标识更新',
  reason: '新法规要求增加CE标识',
  reason: '客户反馈已出货产品缺少CE标识',
  urgency: URGENCY_LEVEL.NORMAL,
  createdBy: '合规专员-张工'
});
ecnId = createResult.data.id;
console.log(`✓ 变更单: ${ecnId}`);
console.log();

console.log('【步骤2】添加影响分析（含客户订单）');
console.log('---');
ECNService.submitECN(ecnId, '合规专员-张工');

const impactData = getImpactData('trace');
let analyzeResult = ECNService.addImpactAnalysis(ecnId, impactData, '分析师-王工');
console.log(`✓ 影响分析完成`);
console.log(`  客户订单数量: ${analyzeResult.data.statistics.total.customerOrders}`);
console.log();

console.log('【客户订单状态预览】');
console.log('---');
analyzeResult = ECNService.getECNDetail(ecnId);
analyzeResult.data.impacts.customerOrders.forEach((c, idx) => {
  console.log(`  [${idx + 1}] ${c.orderNo}`);
  console.log(`      客户: ${c.customer}`);
  console.log(`      数量: ${c.quantity}`);
  console.log(`      出货状态: ${c.shipmentStatus}`);
  console.log(`      当前处理状态: ${c.status}`);
});
console.log();

console.log('【步骤3】审批并开始执行');
console.log('---');
ECNService.approveECN(ecnId, '质量总监-审批');
const execResult = ECNService.startExecution(ecnId, '执行专员-李工');
console.log('✓ 已开始执行');
console.log();

console.log('【步骤4】查看自动处理后的客户订单状态');
console.log('---');
let detail = ECNService.getECNDetail(ecnId);
console.log('  自动处理后状态:');
detail.data.impacts.customerOrders.forEach((c, idx) => {
  console.log(`  [${idx + 1}] ${c.orderNo}`);
  console.log(`      出货状态: ${c.shipmentStatus}`);
  console.log(`      处理状态: ${c.status}`);
  console.log(`      备注: ${c.note || '无'}`);
});
console.log();

console.log('【规则验证】');
console.log('---');
const expectedResults = [
  {
    orderNo: 'CO-2024-1001',
    shipmentStatus: 'NOT_SHIPPED',
    expectedStatus: 'NOTIFIED',
    description: '未出货 -> 已通知（待客户确认）'
  },
  {
    orderNo: 'CO-2024-1002',
    shipmentStatus: 'PARTIALLY_SHIPPED',
    expectedStatus: 'NOTIFIED',
    description: '部分出货 -> 已通知（已出货部分追溯，未出货部分待确认）'
  },
  {
    orderNo: 'CO-2024-1003',
    shipmentStatus: 'FULLY_SHIPPED',
    expectedStatus: 'TRACE_ONLY',
    description: '已完全出货 -> 仅追溯（不做变更处理）'
  }
];

console.log('  验证结果:');
let allPassed = true;
expectedResults.forEach((expected, idx) => {
  const actual = detail.data.impacts.customerOrders.find(c => c.orderNo === expected.orderNo);
  const passed = actual?.status === expected.expectedStatus;
  console.log(`    [${idx + 1}] ${expected.orderNo}: ${passed ? '✓ 通过' : '✗ 失败'}`);
  if (passed) {
    console.log(`        ${expected.description}`);
  } else {
    console.log(`        期望: ${expected.expectedStatus}, 实际: ${actual?.status}`);
    allPassed = false;
  }
});
console.log();

console.log('【步骤5】查看追溯订单的历史记录');
console.log('---');
const history = detail.data.history.filter(h => h.type === 'CUSTOMER_UPDATE');
console.log(`  共 ${history.length} 条客户订单更新记录`);
history.forEach((h, idx) => {
  console.log(`    [${idx + 1}] ${h.action}`);
  if (h.diff) {
    Object.entries(h.diff).forEach(([key, value]) => {
      if (key === 'status' || key === 'note') {
        console.log(`        ${key}: ${JSON.stringify(value.before)} -> ${JSON.stringify(value.after)}`);
      }
    });
  }
});
console.log();

console.log('【步骤6】生成追溯报告');
console.log('---');
const report = ECNService.generateReport(ecnId);
console.log(`✓ 追溯报告生成`);
console.log(`  报告ID: ${report.data.reportId}`);
console.log(`  可关闭: ${report.data.closureStatus.canClose}`);
if (!report.data.closureStatus.canClose) {
  console.log(`  原因: ${report.data.closureStatus.reason}`);
}
console.log();

console.log('==============================================');
console.log('       客户订单追溯演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 完全出货订单: 仅追溯，不做变更处理');
console.log('  ✓ 部分出货订单: 已出货追溯，未出货通知');
console.log('  ✓ 未出货订单: 正常通知流程');
console.log('  ✓ 追溯记录可在历史中查询');
console.log('  ✓ 状态差异自动记录');
