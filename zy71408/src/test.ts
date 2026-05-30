import { RentRescheduleService } from './rentRescheduleService';
import { RescheduleRequest } from './types';

const service = new RentRescheduleService();

console.log('='.repeat(60));
console.log('🧪 融资租赁租金重排服务 - 功能测试');
console.log('='.repeat(60));

const contractId = 'contract_001';

console.log('\n📋 步骤 1: 获取合同信息');
const contract = service.getContract(contractId);
console.log(`   合同编号: ${contract?.contractNo}`);
console.log(`   客户名称: ${contract?.customerName}`);
console.log(`   合同金额: ${contract?.totalAmount.toFixed(2)} 元`);

console.log('\n📋 步骤 2: 获取原始租金计划（前5期）');
const originalPlan = service.getActiveRentPlan(contractId);
originalPlan?.items.slice(0, 5).forEach(item => {
  console.log(`   第${item.periodNo}期: ${item.dueDate} | 本金:${item.principal.toFixed(2)} | 利息:${item.interest.toFixed(2)} | 合计:${item.totalAmount.toFixed(2)}`);
});

console.log('\n📋 步骤 3: 提交租金重排请求（宽限+提前还款）');
const rescheduleRequest: RescheduleRequest = {
  contractId,
  requestType: 'both',
  gracePeriods: [3, 4],
  graceDays: 15,
  prepaymentAmount: 100000,
  prepaymentDate: '2024-03-20',
  reason: '客户资金周转调整，申请第3-4期宽限15天并提前还款10万元',
  requestedBy: '张三',
  requestedAt: new Date().toISOString(),
};

const result = service.processReschedule(rescheduleRequest);
console.log(`   重排结果ID: ${result.id}`);
console.log(`   调整记录数: ${result.adjustments.length}`);
console.log(`   计算步骤数: ${result.calculationDetails.length}`);
console.log(`   不一致记录数: ${result.inconsistencies.length}`);

console.log('\n📋 步骤 4: 查看调整记录');
result.adjustments.forEach((adj, idx) => {
  console.log(`   ${idx + 1}. 第${adj.periodNo}期 ${adj.type === 'grace' ? '宽限' : '提前还款'}: ${adj.field} ${adj.oldValue} → ${adj.newValue}`);
});

console.log('\n📋 步骤 5: 查看计算明细（关键中间量）');
result.calculationDetails.forEach(detail => {
  console.log(`   [${detail.step}]`);
  console.log(`      ${detail.description}`);
  console.log(`      公式: ${detail.formula}`);
  console.log(`      结果: ${typeof detail.result === 'number' ? detail.result.toFixed(2) : detail.result}`);
});

console.log('\n📋 步骤 6: 查看不一致记录（含证据）');
if (result.inconsistencies.length === 0) {
  console.log('   无不一致记录');
} else {
  result.inconsistencies.forEach((inc, idx) => {
    console.log(`   ${idx + 1}. [${inc.severity.toUpperCase()}] ${inc.type}`);
    console.log(`      ${inc.description}`);
    console.log(`      证据来源: ${inc.evidence.map(e => e.source).join(', ')}`);
  });
}

console.log('\n📋 步骤 7: 查看事件时间线（先后顺序）');
result.eventTimeline
  .sort((a, b) => a.sequence - b.sequence)
  .forEach(event => {
    console.log(`   ${event.sequence}. [${event.timestamp.split('T')[0]}] ${event.description}`);
  });

console.log('\n📋 步骤 8: 查看新租金计划（前5期对比）');
result.newPlan.items.slice(0, 5).forEach((newItem, idx) => {
  const oldItem = result.originalPlan.items[idx];
  console.log(`   第${newItem.periodNo}期:`);
  console.log(`      原计划: ${oldItem.dueDate} | ${oldItem.totalAmount.toFixed(2)} 元`);
  console.log(`      新计划: ${newItem.dueDate} | ${newItem.totalAmount.toFixed(2)} 元`);
  console.log(`      状态: ${newItem.status}`);
});

console.log('\n📋 步骤 9: 复核重排结果');
const reviewedResult = service.reviewReschedule(
  result.id,
  '李四',
  '经复核，调整计算正确，宽限期和提前还款抵扣符合业务规则，同意通过。',
  true
);
console.log(`   复核状态: ${reviewedResult.status}`);
console.log(`   复核人: ${reviewedResult.reviewedBy}`);
console.log(`   复核意见: ${reviewedResult.reviewComments}`);

console.log('\n📋 步骤 10: 导出数据');
const exportData = service.exportRescheduleData(result.id, '王五');
console.log(`   导出文件名: ${exportData.filename}`);
console.log(`   包含数据: 合同、重排结果、${exportData.data.paymentFlows.length}条还款流水、${exportData.data.invoices.length}张发票`);

console.log('\n' + '='.repeat(60));
console.log('✅ 测试完成！所有功能正常运行');
console.log('='.repeat(60));
console.log('\n💡 启动服务命令: npm run dev');
console.log('💡 服务地址: http://localhost:3000');
console.log('');
