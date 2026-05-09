const storage = require('../src/storage');
const studentService = require('../src/services/studentService');
const deductionService = require('../src/services/deductionService');
const arrearService = require('../src/services/arrearService');
const installmentService = require('../src/services/installmentService');
const approvalService = require('../src/services/approvalService');
const paymentService = require('../src/services/paymentService');
const compensationService = require('../src/services/compensationService');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const condition = JSON.stringify(actual) === JSON.stringify(expected);
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message} - 期望 ${expected}，实际 ${actual}`);
    failed++;
  }
}

function assertApproxEqual(actual, expected, message, tolerance = 0.01) {
  const condition = Math.abs(actual - expected) < tolerance;
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message} - 期望 ${expected}，实际 ${actual}`);
    failed++;
  }
}

console.log('========================================');
console.log('  校园缴费减免系统 - 单元测试');
console.log('========================================');

console.log('\n[初始化] 清空测试数据...');
storage.reset();

console.log('\n--- 测试 1: 学生管理 ---');
const student = studentService.createStudent({
  studentNo: '202401001',
  name: '测试学生',
  gender: '男',
  grade: '2024',
  major: '计算机科学与技术',
  class: '1班'
});
assert(student.id > 0, '创建学生成功');
assertEqual(student.name, '测试学生', '学生姓名正确');
assertEqual(student.grade, '2024', '年级正确');

const foundStudent = studentService.getStudent(student.id);
assert(foundStudent !== null, '通过ID查询学生成功');
assertEqual(foundStudent.studentNo, '202401001', '学号正确');

console.log('\n--- 测试 2: 减免规则 ---');
const tuitionFee = arrearService.createFeeItem({
  code: 'TUITION',
  name: '学费',
  defaultAmount: 8000
});
assert(tuitionFee.id > 0, '创建学费项目成功');

const scholarshipRule = deductionService.createDeductionRule({
  name: '国家一等奖学金',
  type: 'scholarship',
  deductionType: 'percentage',
  percentage: 80,
  maxAmount: 10000,
  applicableFeeTypes: ['TUITION'],
  priority: 1
});
assert(scholarshipRule.id > 0, '创建比例减免规则成功');
assertEqual(scholarshipRule.deductionType, 'percentage', '减免类型正确');
assertEqual(scholarshipRule.percentage, 80, '减免比例正确');

const hardshipRule = deductionService.createDeductionRule({
  name: '困难补助',
  type: 'hardship',
  deductionType: 'fixed',
  amount: 3000,
  priority: 10
});
assert(hardshipRule.id > 0, '创建固定减免规则成功');

const deduction80 = deductionService.calculateDeduction(8000, scholarshipRule);
assertApproxEqual(deduction80, 6400, '80%比例减免计算正确');

const deductionFixed = deductionService.calculateDeduction(5000, hardshipRule);
assertApproxEqual(deductionFixed, 3000, '固定金额减免计算正确');

const deductionSmall = deductionService.calculateDeduction(2000, hardshipRule);
assertApproxEqual(deductionSmall, 2000, '减免金额不超过欠费金额');

console.log('\n--- 测试 3: 欠费台账 + 减免叠加（核心业务）---');
const smallScholarship = deductionService.createDeductionRule({
  name: '三等奖学金',
  type: 'scholarship',
  deductionType: 'percentage',
  percentage: 30,
  applicableFeeTypes: ['TUITION'],
  priority: 1
});

const smallHardship = deductionService.createDeductionRule({
  name: '一般困难补助',
  type: 'hardship',
  deductionType: 'fixed',
  amount: 2000,
  priority: 10
});

const arrear = arrearService.createArrearRecord({
  studentId: student.id,
  feeTypeId: tuitionFee.id,
  feeTypeName: '学费',
  originalAmount: 8000,
  totalAmount: 8000,
  remainingAmount: 8000,
  academicYear: '2024-2025',
  semester: '1'
});
assert(arrear.id > 0, '创建欠费记录成功');
assertApproxEqual(arrear.originalAmount, 8000, '原始金额正确');
assertApproxEqual(arrear.totalAmount, 8000, '初始应缴金额正确');

const updatedArrear = arrearService.calculateAndApplyDeductions(
  arrear.id,
  [
    { ruleId: smallScholarship.id },
    { ruleId: smallHardship.id }
  ]
);
assertApproxEqual(updatedArrear.deductionAmount, 4400, '叠加减免：先30%（2400元），剩余5600，再减2000，总共减免4400');
assertApproxEqual(updatedArrear.totalAmount, 3600, '应缴金额正确（8000-4400）');
assertApproxEqual(updatedArrear.remainingAmount, 3600, '剩余金额正确');

const summary = arrearService.getArrearSummary(student.id);
assertApproxEqual(summary.totalOriginal, 8000, '汇总原始金额正确');
assertApproxEqual(summary.totalDeduction, 4400, '汇总减免金额正确');
assertApproxEqual(summary.totalPayable, 3600, '汇总应缴金额正确');

console.log('\n--- 测试 4: 分期计划 ---');
const plan = installmentService.createInstallmentPlan({
  arrearId: arrear.id,
  installmentCount: 3
});
assert(plan.id > 0, '创建分期计划成功');
assertApproxEqual(plan.totalAmount, 3600, '分期总金额正确');
assertEqual(plan.installmentCount, 3, '分期期数正确');

const totalInstallments = plan.installments.reduce((sum, i) => sum + i.amount, 0);
assertApproxEqual(totalInstallments, 3600, '各期金额之和等于总金额');

console.log('\n--- 测试 5: 分期支付 ---');
const pay1 = installmentService.payInstallment(plan.id, 1, 1200);
assertApproxEqual(pay1.paidAmount, 1200, '第一期支付成功');
assertEqual(pay1.status, 'paid', '第一期状态为已支付');

const planAfterPay1 = installmentService.getInstallmentPlan(plan.id);
assertEqual(planAfterPay1.status, 'active', '计划状态仍为进行中');

const pay2 = installmentService.payInstallment(plan.id, 2, 1200);
const pay3 = installmentService.payInstallment(plan.id, 3, 1200);
assertApproxEqual(pay3.paidAmount, 1200, '第三期支付成功');

const planAfterPay3 = installmentService.getInstallmentPlan(plan.id);
assertEqual(planAfterPay3.status, 'completed', '全部支付后计划状态为已完成');

const arrearAfterPay = storage.findById('arrearRecords', arrear.id);
assertApproxEqual(arrearAfterPay.paidAmount, 3600, '欠费已全部支付');
assertEqual(arrearAfterPay.status, 'paid', '欠费状态为已结清');

console.log('\n--- 测试 6: 审批冻结 ---');
const accommodationFee = arrearService.createFeeItem({
  code: 'ACCOMMODATION',
  name: '住宿费',
  defaultAmount: 1200
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

const approval = approvalService.createApprovalProcess({
  type: approvalService.PROCESS_TYPES.ARREAR_FREEZE,
  studentId: student.id,
  relatedId: accommodationArrear.id,
  relatedType: 'arrear',
  title: '住宿费缓缴申请',
  applicant: '测试学生'
});
assertEqual(approval.status, 'pending', '审批状态为待审批');

const pendingList = approvalService.getPendingApprovals();
assertEqual(pendingList.length, 1, '待审批列表中有1条记录');

const approved = approvalService.approve(approval.id, '审批人', '同意');
assertEqual(approved.status, 'approved', '审批状态为已通过');

const frozenArrear = storage.findById('arrearRecords', accommodationArrear.id);
assertEqual(frozenArrear.status, 'frozen', '欠费已被冻结');

console.log('\n--- 测试 7: 支付回调 ---');
const newArrear = arrearService.createArrearRecord({
  studentId: student.id,
  feeTypeId: tuitionFee.id,
  feeTypeName: '学费',
  originalAmount: 5000,
  totalAmount: 5000,
  remainingAmount: 5000,
  academicYear: '2023-2024',
  semester: '2'
});

const orderNo = 'TEST_PAY_' + Date.now();
const paymentRecord = paymentService.recordPayment({
  orderNo: orderNo,
  studentId: student.id,
  arrearId: newArrear.id,
  amount: 5000,
  channel: 'alipay'
});
assertEqual(paymentRecord.status, 'pending', '支付记录初始状态为待处理');

const callbackResult = paymentService.handlePaymentCallback(
  orderNo,
  { success: true, amount: 5000 }
);
assertEqual(callbackResult.status, 'success', '回调成功，状态更新为成功');

const paidArrear = storage.findById('arrearRecords', newArrear.id);
assertApproxEqual(paidArrear.paidAmount, 5000, '欠费已更新为已支付');
assertEqual(paidArrear.status, 'paid', '欠费状态为已结清');

console.log('\n--- 测试 8: 失败任务补偿机制 ---');
const failedOrderNo = 'FAILED_PAY_' + Date.now();
paymentService.recordPayment({
  orderNo: failedOrderNo,
  studentId: student.id,
  arrearId: newArrear.id,
  amount: 100,
  channel: 'wechat'
});

const failedTask = compensationService.recordFailedTask({
  type: compensationService.TASK_TYPES.PAYMENT_CALLBACK,
  relatedId: newArrear.id,
  errorMessage: '模拟失败',
  data: {
    orderNo: failedOrderNo,
    callbackData: { success: true, amount: 100 }
  }
});
assertEqual(failedTask.status, 'failed', '失败任务状态为失败');

const failedTasks = compensationService.getFailedTasks();
assert(failedTasks.length > 0, '可以查询到失败任务');

const retryResult = compensationService.retryTask(failedTask.id);
assert(retryResult.success, '重试成功');

const taskAfterRetry = compensationService.getTaskHistory(failedTask.id);
assertEqual(taskAfterRetry.status, 'success', '任务状态更新为成功');

console.log('\n--- 测试 9: 边界情况 ---');
console.log('\n  [边界 1] 减免金额大于欠费金额');
const smallArrear = arrearService.createArrearRecord({
  studentId: student.id,
  feeTypeId: tuitionFee.id,
  feeTypeName: '学费',
  originalAmount: 1000,
  totalAmount: 1000,
  remainingAmount: 1000,
  academicYear: '2024-2025',
  semester: '2'
});
const updatedSmall = arrearService.calculateAndApplyDeductions(
  smallArrear.id,
  [{ ruleId: hardshipRule.id }]
);
assertApproxEqual(updatedSmall.deductionAmount, 1000, '减免不超过欠费金额');
assertApproxEqual(updatedSmall.totalAmount, 0, '应缴金额为0');

console.log('\n  [边界 2] 分期金额为0（已结清的欠费）');
try {
  installmentService.createInstallmentPlan({
    arrearId: newArrear.id,
    installmentCount: 2
  });
  assert(false, '应该抛出异常');
} catch (e) {
  assert(e.message.includes('已结清'), '已结清的欠费不能创建分期');
}

console.log('\n  [边界 3] 重复审批');
try {
  approvalService.approve(approval.id, '另一个审批人', '重复审批');
  assert(false, '应该抛出异常');
} catch (e) {
  assert(e.message.includes('已处理'), '已处理的流程不能重复审批');
}

console.log('\n  [边界 4] 支付回调订单不存在');
try {
  paymentService.handlePaymentCallback('NON_EXISTENT_ORDER', { success: true });
  assert(false, '应该抛出异常');
} catch (e) {
  assert(e.message.includes('不存在'), '不存在的订单回调报错');
}

console.log('\n  [边界 5] 重试已成功的任务');
try {
  compensationService.retryTask(failedTask.id);
  assert(false, '应该抛出异常');
} catch (e) {
  assert(e.message.includes('已成功'), '已成功的任务不能重试');
}

console.log('\n--- 测试 10: 财务对账 ---');
const reconPaymentOrder = 'RECON_PAY_' + Date.now();
paymentService.recordPayment({
  orderNo: reconPaymentOrder,
  studentId: student.id,
  arrearId: smallArrear.id,
  amount: 0,
  channel: 'alipay'
});
paymentService.handlePaymentCallback(
  reconPaymentOrder,
  { success: true, amount: 0 }
);

const recon = paymentService.createReconciliation({
  reconciliationDate: new Date().toISOString().split('T')[0],
  channel: 'alipay',
  channelOrders: [
    { orderNo: orderNo, amount: 5000 },
    { orderNo: reconPaymentOrder, amount: 0 }
  ]
});
assertEqual(recon.status, 'matched', '对账匹配成功');
assertEqual(recon.unmatchedCount, 0, '无差异记录');

console.log('\n--- 测试 11: 数据持久化验证 ---');
const currentState = storage.loadData();
assert(currentState.students.length > 0, '学生数据已持久化');
assert(currentState.arrearRecords.length > 0, '欠费数据已持久化');
assert(currentState.failedTasks.length > 0, '任务历史已持久化');

console.log('\n========================================');
console.log('  测试结果');
console.log('========================================');
console.log(`\n通过: ${passed} 个`);
console.log(`失败: ${failed} 个`);
console.log(`\n测试完成率: ${passed + failed > 0 ? Math.round(passed / (passed + failed) * 100) : 0}%`);

if (failed > 0) {
  console.log('\n❌ 有测试失败，请检查');
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！');
  console.log('\n数据已保存到 data/db.json，重启服务后可继续查询历史记录');
  process.exit(0);
}
