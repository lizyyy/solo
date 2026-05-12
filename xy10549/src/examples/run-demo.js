const {
  importWaybill,
  createExceptionShipment,
  uploadEvidence,
  judgeLiability,
  calculateShipmentCompensation,
  submitForReview,
  reviewShipment,
  submitAppeal,
  processAppeal,
  completeShipment,
  getShipmentDetail,
  getAllShipments,
  getStatistics,
  processCallback
} = require('../services/shipmentService');
const { SAMPLE_WAYBILLS, SAMPLE_SHIPMENTS, SAMPLE_EVIDENCES, SAMPLE_APPEAL } = require('./sampleData');

function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function printSection(title) {
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${title}`);
  console.log('-'.repeat(60));
}

function printResult(label, data) {
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(data, null, 2));
}

async function runDelayCompensationDemo() {
  printHeader('案例 1：延误赔付（普通客户）');
  
  printSection('1. 导入运单');
  const waybillResult = importWaybill(SAMPLE_WAYBILLS[0]);
  printResult('运单导入结果', waybillResult.success ? { waybillId: waybillResult.waybill.waybillId, customer: waybillResult.waybill.customerName } : { error: waybillResult.error });
  
  printSection('2. 创建异常件（延误类型）');
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[0],
    operator: '客服小王'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  printResult('异常件创建结果', {
    shipmentId,
    type: shipmentResult.shipment.type,
    status: shipmentResult.shipment.status,
    description: shipmentResult.shipment.description
  });
  
  printSection('3. 责任判定（承运商确认）');
  const liabilityResult = judgeLiability(shipmentId, {
    status: 'confirmed',
    responsibleParty: '顺丰速运',
    responsiblePercentage: 100,
    reason: '物流节点显示延误，责任明确'
  }, '理赔专员小李');
  printResult('责任判定结果', {
    liabilityId: liabilityResult.judgment.liabilityId,
    status: liabilityResult.judgment.status,
    responsibleParty: liabilityResult.judgment.responsibleParty
  });
  
  printSection('4. 赔付计算');
  const compResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('赔付计算结果', {
    compensationId: compResult.compensation.compensationId,
    amount: compResult.compensation.calculatedAmount,
    status: compResult.compensation.status,
    calculation: compResult.compensation.calculation,
    delayDays: compResult.compensation.delayDays
  });
  
  printSection('5. 提交审核');
  const reviewSubResult = submitForReview(shipmentId, '理赔专员小李');
  printResult('审核提交结果', { reviewId: reviewSubResult.review.reviewId });
  
  printSection('6. 审核通过');
  const reviewResult = reviewShipment(shipmentId, {
    decision: 'approved',
    reason: '符合延误赔付规则'
  }, '审核主管老张');
  printResult('审核结果', reviewResult.review);
  
  printSection('7. 结案');
  const completeResult = completeShipment(shipmentId, '系统');
  printResult('结案结果', completeResult);
  
  printSection('8. 查看完整详情（含历史记录）');
  const detail = getShipmentDetail(shipmentId);
  printResult('异常件详情', {
    shipmentId: detail.shipment.shipmentId,
    currentStatus: detail.shipment.status,
    trackingSummary: detail.trackingSummary,
    compensation: detail.compensation ? {
      amount: detail.compensation.calculatedAmount,
      calculation: detail.compensation.calculation
    } : null,
    liability: detail.liability ? {
      status: detail.liability.status,
      responsibleParty: detail.liability.responsibleParty
    } : null,
    historyCount: detail.history.length,
    latestHistory: detail.history.length > 0 ? detail.history[detail.history.length - 1] : null
  });
  
  return shipmentId;
}

async function runDamagePendingDemo() {
  printHeader('案例 2：破损待审（VIP 客户，证据充足）');
  
  printSection('1. 导入运单');
  importWaybill(SAMPLE_WAYBILLS[1]);
  
  printSection('2. 创建异常件（破损类型）');
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[1],
    operator: '客服小张'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  printResult('异常件信息', {
    shipmentId,
    customerLevel: shipmentResult.shipment.customerLevel,
    damagePercentage: shipmentResult.shipment.damagePercentage + '%'
  });
  
  printSection('3. 上传证据（2 张照片 + 1 个视频）');
  const evidenceResults = [];
  for (let i = 0; i < SAMPLE_EVIDENCES.length; i++) {
    const result = uploadEvidence(shipmentId, SAMPLE_EVIDENCES[i], '客服小张');
    evidenceResults.push({
      evidenceId: result.evidence.evidenceId,
      type: result.evidence.type
    });
  }
  printResult('证据上传结果', evidenceResults);
  
  printSection('4. 责任判定（待承运商确认 - 演示回调流程）');
  const liabilityResult = judgeLiability(shipmentId, {
    status: 'pending_carrier',
    reason: '需要承运商确认破损原因'
  }, '理赔专员小李');
  printResult('初始责任判定', { status: liabilityResult.judgment.status });
  
  printSection('5. 模拟承运商回调确认（幂等演示）');
  const callbackKey = 'callback_' + Date.now();
  const callbackResult1 = processCallback(shipmentId, {
    idempotencyKey: callbackKey,
    type: 'liability_confirmation',
    status: 'confirmed',
    responsibleParty: '圆通速递',
    reason: '经核实，破损发生在运输过程中'
  }, 'carrier_callback');
  printResult('回调结果（首次）', {
    idempotent: callbackResult1.idempotent,
    liabilityStatus: callbackResult1.judgment?.status
  });
  
  printSection('6. 重复回调（幂等性测试）');
  const callbackResult2 = processCallback(shipmentId, {
    idempotencyKey: callbackKey,
    type: 'liability_confirmation',
    status: 'confirmed'
  }, 'carrier_callback');
  printResult('重复回调结果', {
    idempotent: callbackResult2.idempotent,
    message: '返回相同结果，不会重复处理'
  });
  
  printSection('7. 赔付计算');
  const compResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('赔付计算', {
    amount: compResult.compensation.calculatedAmount,
    calculation: compResult.compensation.calculation,
    customerLevel: compResult.compensation.customerLevel
  });
  
  printSection('8. 提交审核（待审状态）');
  submitForReview(shipmentId, '理赔专员小李');
  
  printSection('9. 查看状态');
  const detail = getShipmentDetail(shipmentId);
  printResult('当前状态', {
    status: detail.shipment.status,
    nextPossibleStatuses: detail.nextPossibleStatuses,
    evidenceCount: detail.evidences.length
  });
  
  return shipmentId;
}

async function runLostConfirmedDemo() {
  printHeader('案例 3：丢件确认（VIP+ 客户，需先确认责任）');
  
  printSection('1. 导入运单');
  importWaybill(SAMPLE_WAYBILLS[2]);
  
  printSection('2. 创建异常件（丢件类型）');
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[2],
    operator: '客服小刘'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  printResult('异常件信息', {
    shipmentId,
    customerLevel: shipmentResult.shipment.customerLevel,
    insuredAmount: shipmentResult.shipment.insuredAmount
  });
  
  printSection('3. 尝试直接计算赔付（无责任确认，应失败）');
  const earlyCompResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('未确认责任的赔付结果', {
    amount: earlyCompResult.compensation.calculatedAmount,
    status: earlyCompResult.compensation.status,
    reason: earlyCompResult.compensation.reason
  });
  
  printSection('4. 责任判定（确认承运商责任）');
  judgeLiability(shipmentId, {
    status: 'confirmed',
    responsibleParty: 'EMS',
    responsiblePercentage: 100,
    reason: '包裹未送达且无法定位，确认丢件'
  }, '理赔专员小李');
  
  printSection('5. 重新计算赔付');
  const compResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('赔付计算结果', {
    amount: compResult.compensation.calculatedAmount,
    calculation: compResult.compensation.calculation,
    customerLevel: compResult.compensation.customerLevel
  });
  
  printSection('6. 审核通过并结案');
  submitForReview(shipmentId, '理赔专员小李');
  reviewShipment(shipmentId, { decision: 'approved', reason: '丢件责任明确，按 VIP+ 规则赔付' }, '审核主管老张');
  completeShipment(shipmentId, '系统');
  
  printSection('7. 最终详情');
  const detail = getShipmentDetail(shipmentId);
  printResult('结案信息', {
    status: detail.shipment.status,
    compensation: detail.compensation ? {
      amount: detail.compensation.calculatedAmount,
      status: detail.compensation.status
    } : null
  });
  
  return shipmentId;
}

async function runEvidenceFailureDemo() {
  printHeader('案例 4：证据不足失败（破损证据不够）');
  
  printSection('1. 导入运单');
  importWaybill(SAMPLE_WAYBILLS[3]);
  
  printSection('2. 创建异常件（破损类型）');
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[3],
    operator: '客服小陈'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  
  printSection('3. 只上传 1 张照片（不满足最低要求）');
  uploadEvidence(shipmentId, {
    type: 'photo',
    url: 'evidence://only_one.jpg',
    description: '只有一张照片'
  }, '客服小陈');
  
  printSection('4. 责任判定');
  judgeLiability(shipmentId, {
    status: 'confirmed',
    responsibleParty: '京东物流',
    reason: '运输责任'
  }, '理赔专员小李');
  
  printSection('5. 赔付计算（证据不足，赔付被拒）');
  const compResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('赔付结果', {
    amount: compResult.compensation.calculatedAmount,
    status: compResult.compensation.status,
    reason: compResult.compensation.reason,
    message: '需要至少 2 张有效证据'
  });
  
  printSection('6. 查看当前状态（已关闭）');
  const detail = getShipmentDetail(shipmentId);
  printResult('状态', {
    status: detail.shipment.status,
    reason: detail.shipment.statusReason
  });
  
  return shipmentId;
}

async function runForceMajeureDemo() {
  printHeader('案例 5：不可抗力延误（暴雨导致延误，不予赔付）');
  
  printSection('1. 导入运单');
  importWaybill(SAMPLE_WAYBILLS[4]);
  
  printSection('2. 创建异常件（延误类型，轨迹中包含暴雨）');
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[4],
    operator: '客服小周'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  
  printSection('3. 责任判定');
  judgeLiability(shipmentId, {
    status: 'confirmed',
    responsibleParty: '韵达快递',
    reason: '运输延误'
  }, '理赔专员小李');
  
  printSection('4. 赔付计算（不可抗力，不予赔付）');
  const compResult = calculateShipmentCompensation(shipmentId, '理赔专员小李');
  printResult('赔付结果', {
    amount: compResult.compensation.calculatedAmount,
    status: compResult.compensation.status,
    forceMajeure: compResult.compensation.forceMajeure,
    reason: compResult.compensation.reason,
    calculation: compResult.compensation.calculation
  });
  
  return shipmentId;
}

async function runDuplicateAppealDemo() {
  printHeader('案例 6：重复申诉（申诉改判 + 重复申诉限制）');
  
  printSection('1. 创建一个完整的异常件流程');
  importWaybill(SAMPLE_WAYBILLS[1]);
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[1],
    operator: '客服系统'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  
  for (const ev of SAMPLE_EVIDENCES) {
    uploadEvidence(shipmentId, ev, '客服系统');
  }
  
  judgeLiability(shipmentId, {
    status: 'confirmed',
    responsibleParty: '圆通速递',
    reason: '运输破损'
  }, '理赔系统');
  
  calculateShipmentCompensation(shipmentId, '理赔系统');
  submitForReview(shipmentId, '理赔系统');
  reviewShipment(shipmentId, {
    decision: 'approved',
    reason: '审核通过'
  }, '审核系统');
  
  printSection('2. 客户第一次申诉');
  const firstAppeal = submitAppeal(shipmentId, SAMPLE_APPEAL, '客户李四');
  printResult('第一次申诉', {
    appealId: firstAppeal.appeal.appealId,
    reason: firstAppeal.appeal.reason,
    requestedAmount: firstAppeal.appeal.requestedAmount
  });
  
  printSection('3. 重复提交申诉（应被拦截）');
  const secondAppeal = submitAppeal(shipmentId, {
    reason: '再次申诉，要求更高赔付',
    requestedAmount: 5000
  }, '客户李四');
  printResult('重复申诉结果', {
    success: secondAppeal.success,
    error: secondAppeal.error,
    message: '系统检测到已有待处理申诉，拦截重复提交'
  });
  
  printSection('4. 处理申诉（改判）');
  const appealResult = processAppeal(shipmentId, {
    decision: 'approved',
    reason: '客户提供新凭证，调整赔付金额',
    newCompensation: {
      amount: 2500,
      reason: '申诉通过，按新证据重新计算'
    }
  }, '申诉处理专员');
  printResult('申诉处理结果', appealResult.appeal);
  
  printSection('5. 申诉改判后结案');
  completeShipment(shipmentId, '系统');
  
  printSection('6. 查看完整历史记录');
  const detail = getShipmentDetail(shipmentId);
  const historySummary = detail.history.map(h => ({
    time: h.timestamp?.substring(11, 19),
    action: h.action,
    operator: h.operator
  }));
  printResult('操作历史', historySummary);
  
  return shipmentId;
}

async function runManualEditDemo() {
  printHeader('案例 7：人工修正（记录前后差异和操作者）');
  
  const { manualEditShipment, getShipmentDetail } = require('../services/shipmentService');
  
  printSection('1. 创建基础异常件');
  importWaybill(SAMPLE_WAYBILLS[0]);
  const shipmentResult = createExceptionShipment({
    ...SAMPLE_SHIPMENTS[0],
    description: '原始描述',
    operator: '客服系统'
  });
  const shipmentId = shipmentResult.shipment.shipmentId;
  
  printSection('2. 人工修正（修改描述和其他字段）');
  const editResult = manualEditShipment(
    shipmentId,
    {
      description: '修正后的描述：客户反馈延误情况更严重',
      statusReason: '客服人工介入'
    },
    '客户反馈描述不准确，需要修正',
    '客服主管老王'
  );
  printResult('人工修正结果', {
    message: editResult.message,
    operator: editResult.history.operator,
    reason: editResult.history.details.reason
  });
  
  printSection('3. 查看修正历史中的前后差异');
  const detail = getShipmentDetail(shipmentId);
  const editHistory = detail.history.find(h => h.action === 'manual_edit');
  if (editHistory) {
    printResult('差异详情', {
      before: editHistory.details.before,
      after: editHistory.details.after,
      diff: editHistory.details.diff
    });
  }
  
  return shipmentId;
}

async function generateReport() {
  printHeader('系统报表总览');
  
  printSection('统计数据');
  const stats = getStatistics();
  printResult('全局统计', stats);
  
  printSection('所有异常件列表');
  const allShipments = getAllShipments();
  const shipmentList = allShipments.map(s => ({
    shipmentId: s.shipmentId,
    waybillId: s.waybillId,
    type: s.type,
    customerLevel: s.customerLevel,
    status: s.status,
    customer: s.customerName
  }));
  printResult('异常件列表', shipmentList);
  
  printSection('各状态数量统计');
  const statusBreakdown = {};
  allShipments.forEach(s => {
    const key = s.status;
    statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
  });
  printResult('状态分布', statusBreakdown);
  
  return {
    stats,
    totalShipments: allShipments.length
  };
}

async function main() {
  console.log('\n' + '#'.repeat(80));
  console.log('#');
  console.log('#          物流异常赔付 API - 完整演示');
  console.log('#          Logistics Compensation API Demo');
  console.log('#');
  console.log('#'.repeat(80));
  
  try {
    console.log('\n\n开始执行演示案例...\n');
    
    const shipmentIds = [];
    
    shipmentIds.push(await runDelayCompensationDemo());
    shipmentIds.push(await runDamagePendingDemo());
    shipmentIds.push(await runLostConfirmedDemo());
    shipmentIds.push(await runEvidenceFailureDemo());
    shipmentIds.push(await runForceMajeureDemo());
    shipmentIds.push(await runDuplicateAppealDemo());
    shipmentIds.push(await runManualEditDemo());
    
    const report = await generateReport();
    
    console.log('\n' + '#'.repeat(80));
    console.log('#');
    console.log('#          演示完成总结');
    console.log('#');
    console.log('#'.repeat(80));
    
    console.log('\n✅ 已创建异常件数量:', report.totalShipments);
    console.log('\n✅ 演示覆盖场景:');
    console.log('   1. 普通客户延误赔付（完整流程）');
    console.log('   2. VIP 客户破损待审（含幂等回调）');
    console.log('   3. VIP+ 客户丢件确认（责任前置检查）');
    console.log('   4. 证据不足失败路径（破损证据不够）');
    console.log('   5. 不可抗力延误（不予赔付）');
    console.log('   6. 重复申诉拦截 + 申诉改判');
    console.log('   7. 人工修正（记录前后差异）');
    
    console.log('\n📊 赔付金额汇总:');
    console.log('   - 已批准赔付: ¥', report.stats.compensationAmounts.approved);
    console.log('   - 待审核赔付: ¥', report.stats.compensationAmounts.pending);
    console.log('   - 已拒绝赔付: ¥', report.stats.compensationAmounts.rejected);
    console.log('   - 计算总金额: ¥', report.stats.compensationAmounts.total);
    
    console.log('\n📋 状态分布:');
    Object.entries(report.stats.statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} 件`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 提示:');
    console.log('   - 运行 npm start 启动 API 服务器');
    console.log('   - 访问 http://localhost:3000 查看 API 文档');
    console.log('   - 各案例的 shipmentId:', shipmentIds);
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ 演示执行出错:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
