const { 
  apiCall, 
  logSection, 
  logStep, 
  logResult, 
  logSuccess, 
  logWarning,
  logError,
  sleep 
} = require('./helpers');

async function runInterceptionFlow() {
  logSection('样例二：拦截与待复核流程');
  
  const userId1 = 'USER_INTERCEPT_001';
  const userId2 = 'USER_INTERCEPT_002';
  const deviceId1 = 'WASH-002';
  const deviceId2 = 'WASH-003';
  
  logStep(1, '重置数据环境');
  await apiCall('POST', '/api/stats/reset');
  logSuccess('数据已重置');
  
  await sleep(300);
  
  logStep(2, '场景A：无设备日志的赔付申请（触发待复核）');
  console.log('--- 创建订单但不产生设备故障日志 ---');
  
  const order1 = await apiCall('POST', '/api/orders', {
    userId: userId1,
    deviceId: deviceId1,
    amount: 45.00,
    washType: 'premium',
    duration: 60
  });
  const orderNo1 = order1.data.order.orderNo;
  
  await apiCall('POST', `/api/orders/${orderNo1}/advance`, { status: 'paid' });
  await apiCall('POST', `/api/orders/${orderNo1}/advance`, { status: 'washing' });
  await apiCall('POST', `/api/orders/${orderNo1}/progress`, { steps: [10, 25] });
  
  console.log('\n--- 用户直接申请赔付，但订单还在washing状态且无error日志 ---');
  const claim1 = await apiCall('POST', '/api/claims', {
    orderNo: orderNo1,
    userId: userId1,
    reason: '我觉得机器有问题，衣服没洗干净',
    expectedCompensation: 45.00
  });
  logResult(claim1.data, '申请响应');
  
  if (claim1.data.needsReview) {
    logWarning('⚠️ 触发待复核：无设备故障日志匹配，需人工审核');
  }
  
  await sleep(300);
  
  logStep(3, '场景A后续：管理员将申请标记为待复核');
  if (claim1.data.claim) {
    const review1 = await apiCall('POST', `/api/claims/${claim1.data.claim.claimNo}/review`, {
      action: 'review',
      reviewNote: '需联系用户确认具体故障情况，调取监控核实',
      operator: 'admin_002'
    });
    logResult(review1.data, '标记待复核响应');
    logSuccess('申请已进入 pending_review 状态');
  }
  
  await sleep(300);
  
  logStep(4, '场景B：同一订单重复申请赔付（触发重复拦截）');
  console.log('--- 创建有真实故障的订单 ---');
  
  const order2 = await apiCall('POST', '/api/orders', {
    userId: userId2,
    deviceId: deviceId2,
    amount: 35.00,
    washType: 'standard',
    duration: 45
  });
  const orderNo2 = order2.data.order.orderNo;
  
  await apiCall('POST', `/api/orders/${orderNo2}/advance`, { status: 'paid' });
  await apiCall('POST', `/api/orders/${orderNo2}/advance`, { status: 'washing' });
  await apiCall('POST', `/api/orders/${orderNo2}/advance`, {
    status: 'interrupted',
    extra: { errorCode: 'E101', progress: 30 }
  });
  
  console.log('\n--- 第一次申请 ---');
  const firstClaim = await apiCall('POST', '/api/claims', {
    orderNo: orderNo2,
    userId: userId2,
    reason: '水压异常，机器停了',
    expectedCompensation: 35.00
  });
  logResult(firstClaim.data, '第一次申请');
  logSuccess('第一次申请成功');
  
  await sleep(300);
  
  console.log('\n--- 用户忘记已申请，再次提交 ---');
  const secondClaim = await apiCall('POST', '/api/claims', {
    orderNo: orderNo2,
    userId: userId2,
    reason: '水压异常，机器停了，申请赔付',
    expectedCompensation: 35.00
  });
  logResult(secondClaim.data, '第二次申请');
  
  if (secondClaim.data.error === 'DUPLICATE_CLAIM') {
    logWarning('⚠️ 重复赔付拦截生效：同一订单已有进行中的申请');
    console.log('   已存在的申请号:', secondClaim.data.existingClaim?.claimNo);
  }
  
  await sleep(300);
  
  logStep(5, '场景C：赔付金额修正演示');
  console.log('--- 审核通过并发放补偿 ---');
  const claimNo2 = firstClaim.data.claim.claimNo;
  
  await apiCall('POST', `/api/claims/${claimNo2}/review`, {
    action: 'approve',
    actualCompensation: 35.00,
    reviewNote: '设备日志匹配，全额赔付',
    operator: 'admin_001'
  });
  
  const compensate = await apiCall('POST', `/api/claims/${claimNo2}/compensate`, {
    operator: 'system'
  });
  logResult(compensate.data, '补偿发放');
  
  await sleep(300);
  
  console.log('\n--- 管理员发现应该只赔50%，修正赔付金额 ---');
  const correct = await apiCall('POST', `/api/claims/${claimNo2}/correct`, {
    actualCompensation: 17.50,
    reason: '经复核，用户衣物较少，按50%比例赔付',
    operator: 'admin_001'
  });
  logResult(correct.data, '修正响应');
  
  if (correct.data.claim?.status === 'corrected') {
    logSuccess('✅ 赔付已修正，原金额35.00 → 新金额17.50');
    console.log('   修正记录已保存，可追溯');
  }
  
  await sleep(300);
  
  logStep(6, '场景D：用户撤回申请');
  console.log('--- 用户改变主意，想自己再试一次 ---');
  const withdraw = await apiCall('POST', `/api/claims/${claim1.data.claim.claimNo}/withdraw`, {
    userId: userId1,
    reason: '我想重新启动机器试试，暂时不需要赔付'
  });
  logResult(withdraw.data, '撤回响应');
  
  if (withdraw.data.claim?.status === 'withdrawn') {
    logSuccess('✅ 申请已撤回，用户可重新提交');
  }
  
  await sleep(300);
  
  logStep(7, '场景E：订单状态流转校验（非法状态转换拦截）');
  const order3 = await apiCall('POST', '/api/orders', {
    userId: userId1,
    deviceId: deviceId1,
    amount: 35.00
  });
  const orderNo3 = order3.data.order.orderNo;
  
  console.log('\n--- 尝试直接从未支付跳转到洗涤（非法转换）---');
  const invalidAdvance = await apiCall('POST', `/api/orders/${orderNo3}/advance`, {
    status: 'washing'
  });
  logResult(invalidAdvance.data, '非法转换响应');
  
  if (invalidAdvance.data.error === 'INVALID_TRANSITION') {
    logWarning('⚠️ 状态流转校验生效：不允许 created → washing');
    console.log('   正确路径: created → paid → washing');
  }
  
  await sleep(300);
  
  logStep(8, '查看当前统计（含拦截和待复核数据）');
  const stats = await apiCall('GET', '/api/stats');
  logResult(stats.data, '统计数据');
  
  console.log('\n📊 数据解读:');
  console.log('   - 待复核申请:', stats.data.claims.pendingReview);
  console.log('   - 已撤回申请: 需要从列表中过滤 withdrawn 状态');
  console.log('   - 已修正赔付: status = corrected');
  
  logSection('拦截与待复核流程演示完成');
  
  return {
    pendingReviewClaimNo: claim1.data.claim?.claimNo,
    correctedClaimNo: claimNo2,
    withdrawnClaimNo: claim1.data.claim?.claimNo
  };
}

if (require.main === module) {
  runInterceptionFlow().catch(console.error);
}

module.exports = runInterceptionFlow;
