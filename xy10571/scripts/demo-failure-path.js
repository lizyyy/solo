const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');
const { URGENCY_LEVEL } = require('../models/types');

console.log('==============================================');
console.log('       异常处理与失败路径演示');
console.log('==============================================');
console.log();

console.log('【场景说明】');
console.log('演示以下异常场景:');
console.log('  1. 状态转换错误（跳过审批直接执行）');
console.log('  2. 数据验证失败（缺少必填字段）');
console.log('  3. 业务规则冲突（紧急变更采购未确认）');
console.log('  4. 记录异常并重试');
console.log();

let ecnId;

console.log('【异常场景1】状态转换错误');
console.log('---');
console.log('尝试: 草稿状态直接跳过提交去执行');

const createResult = ECNService.createECN({
  ...sampleECNs.normal,
  title: '异常测试-状态转换',
  createdBy: '测试工程师'
});
ecnId = createResult.data.id;

console.log(`  当前状态: ${createResult.data.status}`);
console.log(`  尝试执行: 直接从 DRAFT -> IN_PROGRESS`);

const invalidExec = ECNService.startExecution(ecnId, '测试人员');
if (!invalidExec.success) {
  console.log(`  ✓ 预期失败`);
  console.log(`    错误码: ${invalidExec.errorCode}`);
  console.log(`    错误信息: ${invalidExec.error}`);
}
console.log();

console.log('【异常场景2】数据验证失败');
console.log('---');
console.log('尝试: 创建变更单但缺少必填字段');

const invalidCreate = ECNService.createECN({
  title: '缺少字段测试',
  urgency: URGENCY_LEVEL.NORMAL
});

if (!invalidCreate.success) {
  console.log(`  ✓ 预期失败`);
  console.log(`    错误码: ${invalidCreate.errorCode}`);
  console.log(`    错误信息: ${invalidCreate.error}`);
}
console.log();

console.log('【异常场景3】业务规则冲突 - 紧急变更采购未确认');
console.log('---');
const createUrgent = ECNService.createECN({
  ...sampleECNs.urgent,
  title: '异常测试-采购未确认',
  urgency: URGENCY_LEVEL.URGENT,
  createdBy: '测试工程师'
});
const urgentEcnId = createUrgent.data.id;

console.log(`  创建紧急变更: ${urgentEcnId}`);

ECNService.submitECN(urgentEcnId, '测试工程师');
const impactData = getImpactData('purchase');
ECNService.addImpactAnalysis(urgentEcnId, impactData, '分析师');
ECNService.approveECN(urgentEcnId, '审批人');
ECNService.startExecution(urgentEcnId, '执行专员');

let detail = ECNService.getECNDetail(urgentEcnId);
console.log(`  采购单中有未确认的: ${detail.data.impacts.purchaseOrders.find(p => p.confirmStatus === 'NOT_CONFIRMED')?.poNumber}`);
console.log(`  尝试直接完成变更单...`);

const completeFail = ECNService.completeECN(urgentEcnId, '测试人员');
if (!completeFail.success) {
  console.log(`  ✓ 预期失败`);
  console.log(`    错误码: ${completeFail.errorCode}`);
  console.log(`    错误信息: ${completeFail.error}`);
  if (completeFail.details?.unconfirmedPurchases) {
    console.log(`    未确认采购单: ${completeFail.details.unconfirmedPurchases.join(', ')}`);
  }
}
console.log();

console.log('【异常场景4】记录异常并查询失败原因');
console.log('---');
console.log('模拟: 外部系统调用失败，记录异常信息');

const createForException = ECNService.createECN({
  ...sampleECNs.normal,
  title: '异常测试-记录失败原因',
  createdBy: '测试工程师'
});
const exceptionEcnId = createForException.data.id;

ECNService.submitECN(exceptionEcnId, '测试工程师');
ECNService.addImpactAnalysis(exceptionEcnId, getImpactData('full'), '分析师');
ECNService.approveECN(exceptionEcnId, '审批人');
ECNService.startExecution(exceptionEcnId, '执行专员');

console.log(`  模拟外部系统调用失败: 采购系统接口超时`);

const exceptionResult = ECNService.handleException(exceptionEcnId, {
  errorCode: 'PURCHASE_SYSTEM_TIMEOUT',
  errorMessage: '采购管理系统接口调用超时，采购单通知失败',
  affectedItems: ['PUR-2024-0101', 'PUR-2024-0102']
}, '系统管理员-李四');

if (exceptionResult.success) {
  console.log(`  ✓ 异常已记录`);
  console.log(`    变更单状态: ${exceptionResult.data.status}`);
  console.log(`    最后错误: ${exceptionResult.data.lastError?.message}`);
}
console.log();

console.log('【异常场景5】从失败状态重试');
console.log('---');
console.log('查看当前状态后重试...');

const retryDetail = ECNService.getECNDetail(exceptionEcnId);
console.log(`  当前状态: ${retryDetail.data.ecn.status}`);
console.log(`  重试次数: ${retryDetail.data.ecn.retryCount || 0}`);

console.log(`  模拟问题已解决: 采购系统已恢复`);
console.log(`  执行重试...`);

const retryResult = ECNService.retryFromFailure(exceptionEcnId, '系统管理员-李四');
if (retryResult.success) {
  console.log(`  ✓ 重试成功`);
  console.log(`    新状态: ${retryResult.data.status}`);
  console.log(`    重试次数: ${retryResult.data.retryCount}`);
}
console.log();

console.log('【查询】查看历史记录中的异常信息');
console.log('---');
const finalDetail = ECNService.getECNDetail(exceptionEcnId);
const exceptionHistory = finalDetail.data.history.filter(h => 
  h.type === 'EXCEPTION' || h.type === 'RETRY'
);

console.log(`  异常相关历史记录: ${exceptionHistory.length} 条`);
exceptionHistory.forEach((h, idx) => {
  console.log(`    [${idx + 1}] ${h.action}`);
  console.log(`        类型: ${h.type}`);
  console.log(`        操作者: ${h.operator}`);
  if (h.errorCode) {
    console.log(`        错误码: ${h.errorCode}`);
    console.log(`        错误信息: ${h.errorMessage}`);
  }
  if (h.retryNumber) {
    console.log(`        重试次数: ${h.retryNumber}`);
  }
});
console.log();

console.log('【生成报告】查看异常信息');
console.log('---');
const report = ECNService.generateReport(exceptionEcnId);
console.log(`  报告ID: ${report.data.reportId}`);
console.log(`  变更单状态: ${report.data.ecn.status}`);
console.log(`  可关闭: ${report.data.closureStatus.canClose}`);
console.log(`  已完成项目: ${report.data.summary.completed}`);
console.log(`  待处理项目: ${report.data.summary.pending}`);
console.log();

console.log('==============================================');
console.log('       异常处理演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 状态转换受严格控制，无效转换被拒绝');
console.log('  ✓ 数据验证失败时返回明确的错误信息');
console.log('  ✓ 业务规则冲突可被检测并阻止');
console.log('  ✓ 异常信息被完整记录（错误码、消息、受影响项）');
console.log('  ✓ 失败状态可重试，重试次数被记录');
console.log('  ✓ 历史记录保留完整的异常追踪链');
console.log('  ✓ 报告中可查看失败原因和处理进度');
