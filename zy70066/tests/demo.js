const storage = require('../src/storage');
const studentService = require('../src/services/studentService');
const deductionService = require('../src/services/deductionService');
const arrearService = require('../src/services/arrearService');
const installmentService = require('../src/services/installmentService');
const approvalService = require('../src/services/approvalService');
const paymentService = require('../src/services/paymentService');
const compensationService = require('../src/services/compensationService');

function log(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

console.log('========================================');
console.log('  校园缴费减免系统 - 主流程演示');
console.log('========================================');

console.log('\n[1] 初始化数据...');
storage.reset();

console.log('\n[2] 创建学生（张三，计算机学院2024级）');
const student = studentService.createStudent({
  studentNo: '202401001',
  name: '张三',
  gender: '男',
  grade: '2024',
  major: '计算机科学与技术',
  class: '1班'
});
log('学生信息', student);

console.log('\n[3] 创建缴费项目（学费、住宿费）');
const tuitionFee = arrearService.createFeeItem({
  code: 'TUITION',
  name: '学费',
  defaultAmount: 8000,
  description: '年度学费'
});
const accommodationFee = arrearService.createFeeItem({
  code: 'ACCOMMODATION',
  name: '住宿费',
  defaultAmount: 1200,
  description: '年度住宿费'
});
log('缴费项目', { tuitionFee, accommodationFee });

console.log('\n[4] 创建减免规则（奖学金80%、困难补助3000元）');
const scholarshipRule = deductionService.createDeductionRule({
  name: '国家一等奖学金',
  type: 'scholarship',
  deductionType: 'percentage',
  percentage: 80,
  maxAmount: 10000,
  applicableFeeTypes: ['TUITION'],
  priority: 1,
  description: '学费减免80%'
});
const hardshipRule = deductionService.createDeductionRule({
  name: '困难补助',
  type: 'hardship',
  deductionType: 'fixed',
  amount: 3000,
  applicableFeeTypes: [],
  priority: 10,
  description: '固定减免3000元'
});
log('减免规则', { scholarshipRule, hardshipRule });

console.log('\n[5] 创建欠费记录（学费8000元 + 住宿费1200元）');
const tuitionArrear = arrearService.createArrearRecord({
  studentId: student.id,
  feeTypeId: tuitionFee.id,
  feeTypeName: '学费',
  originalAmount: 8000,
  totalAmount: 8000,
  remainingAmount: 8000,
  academicYear: '2024-2025',
  semester: '1'
});
const accommodationArrear = arrearService.createArrearRecord({
  studentId: student.id,
  feeTypeId: accommodationFee.id,
  feeTypeName: '住宿费',
  originalAmount: 1200,
  totalAmount: 1200,
  remainingAmount: 1200,
  academicYear: '2024-2025',
  semester: '1'
});
log('欠费记录', { tuitionArrear, accommodationArrear });

console.log('\n[6] 查看欠费汇总');
const summary1 = arrearService.getArrearSummary(student.id);
log('欠费汇总（减免前）', {
  总欠费: summary1.totalOriginal,
  已缴: summary1.totalPaid,
  待缴: summary1.totalRemaining
});

console.log('\n[7] 为学费应用减免（奖学金80% + 困难补助3000元）');
const deductionResult = arrearService.calculateAndApplyDeductions(
  tuitionArrear.id,
  [
    { ruleId: scholarshipRule.id },
    { ruleId: hardshipRule.id }
  ]
);
log('减免结果', {
  原金额: deductionResult.originalAmount,
  减免金额: deductionResult.deductionAmount,
  应缴金额: deductionResult.totalAmount,
  剩余金额: deductionResult.remainingAmount
});

console.log('\n[8] 验证计算是否正确（8000的80%是6400，剩余1600，再减3000不够，所以总共减免8000）');
console.log('   预期：减免6400元（8000*80%），应缴1600元（困难补助优先级低，不够覆盖）');
console.log('   实际：减免' + deductionResult.deductionAmount + '元，应缴' + deductionResult.totalAmount + '元');

console.log('\n[9] 为应缴1600元创建分期计划（分3期）');
const installmentPlan = installmentService.createInstallmentPlan({
  arrearId: tuitionArrear.id,
  installmentCount: 3,
  description: '学费分期'
});
log('分期计划', {
  总金额: installmentPlan.totalAmount,
  期数: installmentPlan.installmentCount,
  各期金额: installmentPlan.installments.map(i => ({
    期次: i.period,
    金额: i.amount,
    状态: i.status
  }))
});

console.log('\n[10] 支付第一期（533.33元）');
const payment1 = installmentService.payInstallment(installmentPlan.id, 1, 533.33);
log('支付结果', {
  期次: payment1.period,
  支付金额: payment1.paidAmount,
  状态: payment1.status
});

console.log('\n[11] 查看更新后的分期计划');
const updatedPlan = installmentService.getInstallmentPlan(installmentPlan.id);
log('更新后分期状态', updatedPlan.installments.map(i => ({
  期次: i.period,
  金额: i.amount,
  已付: i.paidAmount,
  状态: i.status
})));

console.log('\n[12] 创建欠费冻结审批流程');
const approval = approvalService.createApprovalProcess({
  type: approvalService.PROCESS_TYPES.ARREAR_FREEZE,
  studentId: student.id,
  relatedId: accommodationArrear.id,
  relatedType: 'arrear',
  title: '住宿费缓缴申请',
  description: '家庭经济困难，申请缓缴住宿费',
  applicant: '张三'
});
log('审批流程', {
  id: approval.id,
  标题: approval.title,
  状态: approval.status
});

console.log('\n[13] 审批通过冻结');
const approved = approvalService.approve(approval.id, '李老师', '情况属实，同意缓缴');
log('审批结果', {
  状态: approved.status,
  审批人: approved.approver,
  审批时间: approved.approvedAt
});

console.log('\n[14] 查看住宿费状态');
const frozenArrear = storage.findById('arrearRecords', accommodationArrear.id);
log('住宿费状态', {
  状态: frozenArrear.status,
  冻结时间: frozenArrear.frozenAt
});

console.log('\n[15] 模拟支付回调（支付第二期学费）');
const paymentRecord = paymentService.recordPayment({
  orderNo: 'PAY' + Date.now(),
  studentId: student.id,
  arrearId: tuitionArrear.id,
  installmentPlanId: installmentPlan.id,
  installmentPeriod: 2,
  amount: 533.33,
  channel: 'alipay'
});
log('创建支付记录', {
  订单号: paymentRecord.orderNo,
  状态: paymentRecord.status
});

const callbackResult = paymentService.handlePaymentCallback(
  paymentRecord.orderNo,
  { success: true, amount: 533.33 }
);
log('支付回调结果', {
  订单状态: callbackResult.status,
  支付时间: callbackResult.paidAt
});

console.log('\n[16] 查看分期计划更新');
const planAfterPayment = installmentService.getInstallmentPlan(installmentPlan.id);
log('分期计划（支付后）', planAfterPayment.installments.map(i => ({
  期次: i.period,
  金额: i.amount,
  已付: i.paidAmount,
  状态: i.status
})));

console.log('\n[17] 模拟失败场景 - 记录失败任务');
const failedTask = compensationService.recordFailedTask({
  type: compensationService.TASK_TYPES.PAYMENT_CALLBACK,
  relatedId: tuitionArrear.id,
  errorMessage: '网络超时',
  data: {
    orderNo: 'PAY_FAILED_001',
    callbackData: { success: true, amount: 533.34 }
  }
});
log('失败任务', {
  id: failedTask.id,
  类型: failedTask.type,
  错误: failedTask.errorMessage,
  状态: failedTask.status,
  重试次数: failedTask.retryCount
});

console.log('\n[18] 查看所有失败任务');
const failedTasks = compensationService.getFailedTasks();
log('失败任务列表', failedTasks.map(t => ({
  id: t.id,
  类型: t.type,
  错误: t.errorMessage,
  状态: t.status
})));

console.log('\n[19] 重试失败任务');
const retryResult = compensationService.retryTask(failedTask.id);
log('重试结果', retryResult);

console.log('\n[20] 确认任务状态');
const taskAfterRetry = compensationService.getTaskHistory(failedTask.id);
log('任务状态（重试后）', {
  id: taskAfterRetry.id,
  状态: taskAfterRetry.status,
  重试次数: taskAfterRetry.retryCount
});

console.log('\n[21] 查看最终欠费汇总');
const finalSummary = arrearService.getArrearSummary(student.id);
log('最终欠费汇总', {
  总欠费: finalSummary.totalOriginal,
  总减免: finalSummary.totalDeduction,
  总应缴: finalSummary.totalPayable,
  已缴: finalSummary.totalPaid,
  待缴: finalSummary.totalRemaining,
  状态分布: finalSummary.byStatus
});

console.log('\n[22] 财务对账演示');
const recon = paymentService.createReconciliation({
  reconciliationDate: new Date().toISOString().split('T')[0],
  channel: 'alipay',
  channelOrders: [
    { orderNo: paymentRecord.orderNo, amount: 533.33 }
  ]
});
log('对账结果', {
  状态: recon.status,
  匹配笔数: recon.matchedCount,
  匹配金额: recon.matchedAmount,
  差异笔数: recon.unmatchedCount,
  差异金额: recon.unmatchedAmount
});

console.log('\n========================================');
console.log('  演示完成');
console.log('========================================');
console.log('\n数据已保存到 data/db.json，重启后可继续查看历史记录');
