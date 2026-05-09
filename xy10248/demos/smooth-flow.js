const { 
  apiCall, 
  logSection, 
  logStep, 
  logResult, 
  logSuccess, 
  logWarning,
  sleep 
} = require('./helpers');

let orderNo = null;
let claimNo = null;
let couponNo = null;

async function runSmoothFlow() {
  logSection('样例一：顺利赔付流程（设备日志匹配）');
  
  const userId = 'USER_SMOOTH_001';
  const deviceId = 'WASH-001';
  const IDEMPOTENCY_KEY_CLAIM = 'smooth-claim-' + Date.now();
  const IDEMPOTENCY_KEY_COUPON = 'smooth-coupon-' + Date.now();
  
  logStep(1, '重置数据环境');
  await apiCall('POST', '/api/stats/reset');
  logSuccess('数据已重置');
  
  await sleep(300);
  
  logStep(2, '创建洗衣订单 - 用户下单');
  const createOrder = await apiCall('POST', '/api/orders', {
    userId,
    deviceId,
    amount: 35.00,
    washType: 'standard',
    duration: 45
  });
  orderNo = createOrder.data.order.orderNo;
  logResult(createOrder.data, '创建订单响应');
  logSuccess(`订单创建成功: ${orderNo}`);
  
  await sleep(300);
  
  logStep(3, '推进订单状态 - 用户支付');
  const payOrder = await apiCall('POST', `/api/orders/${orderNo}/advance`, {
    status: 'paid'
  });
  logResult(payOrder.data, '支付响应');
  logSuccess('订单已支付');
  
  await sleep(300);
  
  logStep(4, '推进订单状态 - 开始洗涤');
  const startWash = await apiCall('POST', `/api/orders/${orderNo}/advance`, {
    status: 'washing'
  });
  logResult(startWash.data, '开始洗涤响应');
  logSuccess('洗衣机开始运行');
  
  await sleep(300);
  
  logStep(5, '模拟洗涤进度（注水、加热、主洗）');
  const progress = await apiCall('POST', `/api/orders/${orderNo}/progress`, {
    steps: [10, 25, 40]
  });
  logResult(progress.data, '进度响应');
  logSuccess('洗涤进度: 40%');
  
  await sleep(300);
  
  logStep(6, '设备故障 - 电机过载 (E201)，洗衣机中途停机');
  const interrupt = await apiCall('POST', `/api/orders/${orderNo}/advance`, {
    status: 'interrupted',
    extra: {
      errorCode: 'E201',
      interruptedAt: new Date().toISOString(),
      progress: 40
    }
  });
  logResult(interrupt.data, '故障响应');
  logSuccess('设备已记录故障日志，订单状态更新为 interrupted');
  
  await sleep(300);
  
  logStep(7, '查看订单详情（验证设备日志与订单状态一致）');
  const orderDetail = await apiCall('GET', `/api/orders/${orderNo}`);
  logResult(orderDetail.data, '订单详情');
  
  const hasErrorLog = orderDetail.data.deviceLogs.some(
    log => log.event === 'error' && log.details.errorCode === 'E201'
  );
  if (hasErrorLog && orderDetail.data.order.status === 'interrupted') {
    logSuccess('✅ 一致性验证通过：订单状态=interrupted，设备日志=E201错误');
  } else {
    logWarning('⚠️ 一致性验证需要关注');
  }
  
  await sleep(300);
  
  logStep(8, '用户提交赔付申请（带幂等键）');
  const createClaim = await apiCall('POST', '/api/claims', {
    orderNo,
    userId,
    reason: '洗衣机中途停机，电机过载，衣服未洗完',
    expectedCompensation: 35.00,
    idempotencyKey: IDEMPOTENCY_KEY_CLAIM
  });
  claimNo = createClaim.data.claim?.claimNo;
  logResult(createClaim.data, '赔付申请响应');
  
  if (createClaim.data.claim?.deviceLogsMatched) {
    logSuccess('✅ 设备日志自动匹配，申请进入待审核状态');
  }
  
  await sleep(300);
  
  logStep(9, '演示赔付幂等：使用相同幂等键重复提交');
  const duplicateClaim = await apiCall('POST', '/api/claims', {
    orderNo,
    userId,
    reason: '洗衣机中途停机，电机过载，衣服未洗完',
    expectedCompensation: 35.00,
    idempotencyKey: IDEMPOTENCY_KEY_CLAIM
  });
  logResult(duplicateClaim.data, '重复申请响应');
  
  if (duplicateClaim.data.duplicate) {
    logSuccess('✅ 幂等机制生效：重复请求返回已有申请，未创建新记录');
  }
  
  await sleep(300);
  
  logStep(10, '管理员审核 - 批准赔付');
  const review = await apiCall('POST', `/api/claims/${claimNo}/review`, {
    action: 'approve',
    actualCompensation: 35.00,
    reviewNote: '设备日志匹配E201故障，同意全额赔付',
    operator: 'admin_001'
  });
  logResult(review.data, '审核响应');
  logSuccess('赔付申请已批准');
  
  await sleep(300);
  
  logStep(11, '发放优惠券补偿（带幂等键）');
  const compensate = await apiCall('POST', `/api/claims/${claimNo}/compensate`, {
    idempotencyKey: IDEMPOTENCY_KEY_COUPON,
    operator: 'system'
  });
  couponNo = compensate.data.coupon?.couponNo;
  logResult(compensate.data, '补偿响应');
  logSuccess(`优惠券已发放: ${couponNo}`);
  
  await sleep(300);
  
  logStep(12, '演示补偿幂等：重复触发补偿');
  const duplicateCompensate = await apiCall('POST', `/api/claims/${claimNo}/compensate`, {
    idempotencyKey: IDEMPOTENCY_KEY_COUPON,
    operator: 'system'
  });
  logResult(duplicateCompensate.data, '重复补偿响应');
  
  if (duplicateCompensate.data.duplicate) {
    logSuccess('✅ 补偿幂等生效：返回同一优惠券，未重复发放');
  }
  
  await sleep(300);
  
  logStep(13, '查看赔付详情（验证三者一致性）');
  const claimDetail = await apiCall('GET', `/api/claims/${claimNo}`);
  logResult(claimDetail.data, '赔付详情');
  
  const statusCheck = 
    claimDetail.data.order.status === 'interrupted' &&
    claimDetail.data.claim.status === 'compensated' &&
    claimDetail.data.coupons.length === 1 &&
    claimDetail.data.deviceLogs.some(l => l.event === 'error');
  
  if (statusCheck) {
    logSuccess('✅ 三者一致性验证通过：');
    console.log('   - 订单状态: interrupted');
    console.log('   - 赔付状态: compensated');
    console.log('   - 优惠券数量: 1张');
    console.log('   - 设备日志: 含error事件');
  }
  
  await sleep(300);
  
  logStep(14, '查看统计数据');
  const stats = await apiCall('GET', '/api/stats');
  logResult(stats.data, '统计数据');
  
  logSection('顺利流程演示完成');
  
  return { orderNo, claimNo, couponNo };
}

if (require.main === module) {
  runSmoothFlow().catch(console.error);
}

module.exports = runSmoothFlow;
