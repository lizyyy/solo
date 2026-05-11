import { prescriptionService } from '../services/prescriptionService';

async function testNormalFlow() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    测试正常业务流程                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. 问诊建单
  console.log('1. 问诊建单...');
  const consultationResult = await prescriptionService.createConsultation({
    patientId: 'P001',
    patientName: '张三',
    doctorId: 'D001',
    doctorName: '李医生',
    idempotentKey: `consult_${Date.now()}`
  });
  console.log('   问诊单ID:', consultationResult.data?.id);
  console.log('   当前状态:', consultationResult.data?.status);
  console.log();

  const consultationId = consultationResult.data?.id;

  // 2. 医生开方
  console.log('2. 医生开方...');
  const prescriptionResult = await prescriptionService.createPrescription({
    consultationId,
    doctorId: 'D001',
    items: [
      {
        medicineId: 'M001',
        medicineName: '阿莫西林胶囊',
        specification: '0.5g*24粒',
        quantity: 2,
        unit: '盒',
        dosage: '每日3次，每次1粒',
        price: 25.00
      },
      {
        medicineId: 'M002',
        medicineName: '布洛芬缓释胶囊',
        specification: '0.3g*20粒',
        quantity: 1,
        unit: '盒',
        dosage: '每日2次，每次1粒',
        price: 18.50
      }
    ],
    idempotentKey: `presc_${Date.now()}`
  });
  console.log('   处方ID:', prescriptionResult.data?.id);
  console.log('   处方状态:', prescriptionResult.data?.status);
  console.log('   总金额:', prescriptionResult.data?.totalAmount);
  console.log();

  const prescriptionId = prescriptionResult.data?.id;

  // 3. 药师审核通过
  console.log('3. 药师审核通过...');
  const reviewResult = await prescriptionService.pharmacistReview({
    prescriptionId,
    pharmacistId: 'PH001',
    pharmacistName: '王药师',
    approved: true,
    idempotentKey: `review_${Date.now()}`
  });
  console.log('   处方状态:', reviewResult.data?.status);
  console.log('   审核药师:', reviewResult.data?.pharmacist_name);
  console.log();

  // 4. 支付确认
  console.log('4. 支付确认...');
  const paymentResult = await prescriptionService.confirmPayment({
    consultationId,
    amount: 68.50,
    paymentNo: `PAY${Date.now()}`,
    idempotentKey: `pay_${Date.now()}`
  });
  console.log('   订单状态:', paymentResult.data?.status);
  console.log('   支付时间:', paymentResult.data?.paid_at);
  console.log();

  // 5. 出库配送
  console.log('5. 出库配送...');
  const shipResult = await prescriptionService.ship({
    consultationId,
    logisticsNo: `SF${Date.now()}`,
    logisticsCompany: '顺丰速运',
    operatorId: 'O001',
    operatorName: '库管员',
    idempotentKey: `ship_${Date.now()}`
  });
  console.log('   订单状态:', shipResult.data?.status);
  console.log('   物流单号:', shipResult.data?.logistics_no);
  console.log();

  // 6. 查询详情
  console.log('6. 查询问诊详情...');
  const detailResult = await prescriptionService.getConsultation(consultationId);
  console.log('   问诊状态:', detailResult.data?.consultation.status);
  console.log('   处方状态:', detailResult.data?.prescription?.status);
  console.log('   状态变更次数:', detailResult.data?.statusLogs.length);
  console.log();

  return consultationId;
}

async function testRejectFlow() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                  测试药师驳回流程                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. 问诊建单
  const consultationResult = await prescriptionService.createConsultation({
    patientId: 'P002',
    patientName: '李四',
    doctorId: 'D002',
    doctorName: '赵医生',
    idempotentKey: `consult2_${Date.now()}`
  });
  const consultationId = consultationResult.data?.id;
  console.log('1. 问诊建单完成，ID:', consultationId);

  // 2. 医生开方
  const prescriptionResult = await prescriptionService.createPrescription({
    consultationId,
    doctorId: 'D002',
    items: [
      {
        medicineId: 'M003',
        medicineName: '感冒药',
        specification: '10g*10袋',
        quantity: 1,
        unit: '盒',
        dosage: '每日3次',
        price: 30.00
      }
    ],
    idempotentKey: `presc2_${Date.now()}`
  });
  const prescriptionId = prescriptionResult.data?.id;
  console.log('2. 医生开方完成，ID:', prescriptionId);

  // 3. 药师驳回
  console.log('3. 药师驳回（不填原因，应报错）...');
  const rejectFail = await prescriptionService.pharmacistReview({
    prescriptionId,
    pharmacistId: 'PH002',
    pharmacistName: '孙药师',
    approved: false,
    idempotentKey: `review2_fail_${Date.now()}`
  });
  console.log('   结果:', rejectFail.message);

  console.log('3. 药师驳回（填写原因）...');
  const rejectResult = await prescriptionService.pharmacistReview({
    prescriptionId,
    pharmacistId: 'PH002',
    pharmacistName: '孙药师',
    approved: false,
    rejectReason: '用药剂量不准确，请重新开方',
    idempotentKey: `review2_${Date.now()}`
  });
  console.log('   处方状态:', rejectResult.data?.status);
  console.log('   驳回原因:', rejectResult.data?.reject_reason);
  console.log();

  // 4. 尝试支付已驳回的订单（应失败）
  console.log('4. 尝试支付已驳回的订单（应失败）...');
  const payFail = await prescriptionService.confirmPayment({
    consultationId,
    amount: 30.00,
    paymentNo: `PAY_FAIL${Date.now()}`,
    idempotentKey: `pay2_fail_${Date.now()}`
  });
  console.log('   结果:', payFail.message);
  console.log();
}

async function testIdempotent() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    测试幂等性（重复提交）                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const idempotentKey = `test_idempotent_${Date.now()}`;

  console.log('1. 第一次提交建单...');
  const result1 = await prescriptionService.createConsultation({
    patientId: 'P003',
    patientName: '王五',
    doctorId: 'D003',
    doctorName: '周医生',
    idempotentKey
  });
  console.log('   创建时间:', result1.data?.created_at);

  console.log('2. 第二次提交相同请求（应返回已有数据）...');
  const result2 = await prescriptionService.createConsultation({
    patientId: 'P003',
    patientName: '王五',
    doctorId: 'D003',
    doctorName: '周医生',
    idempotentKey
  });
  console.log('   结果:', result2.message);
  console.log('   创建时间相同:', result1.data?.created_at === result2.data?.created_at);
  console.log();
}

async function testCancelFlow() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    测试取消流程                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const consultationResult = await prescriptionService.createConsultation({
    patientId: 'P004',
    patientName: '赵六',
    doctorId: 'D004',
    doctorName: '吴医生',
    idempotentKey: `consult_cancel_${Date.now()}`
  });
  const consultationId = consultationResult.data?.id;
  console.log('1. 问诊建单完成，ID:', consultationId);

  console.log('2. 取消订单...');
  const cancelResult = await prescriptionService.cancelOrReject({
    consultationId,
    operatorId: 'O001',
    operatorName: '客服',
    reason: '患者取消订单',
    idempotentKey: `cancel_${Date.now()}`
  });
  console.log('   订单状态:', cancelResult.data?.status);
  console.log();
}

async function testSummary() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    查看汇总统计                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const summary = await prescriptionService.getStatusSummary();
  console.log('总订单数:', summary.data.total);
  console.log('总支付金额:', summary.data.totalPaidAmount);
  console.log('各状态分布:');
  summary.data.byStatus.forEach((s: any) => {
    console.log(`  ${s.status}: ${s.count}`);
  });
  console.log();

  const logs = await prescriptionService.getAllStatusLogs();
  console.log('状态变更总记录数:', logs.data.length);
  console.log();
}

async function runAllTests() {
  try {
    await testNormalFlow();
    await testRejectFlow();
    await testIdempotent();
    await testCancelFlow();
    await testSummary();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    所有测试完成！                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('测试出错:', error);
  }

  process.exit(0);
}

runAllTests();
