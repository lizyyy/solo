const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runAutoTest() {
  console.log('========================================');
  console.log('  社群课程返佣结算台 - 自动化测试');
  console.log('========================================');
  console.log('');

  let allPassed = true;

  try {
    await testNormalOrder();
    console.log('✓ 场景1: 正常订单流程 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景1: 正常订单流程 - 测试失败');
    printError(error);
  }

  console.log('');

  try {
    await testPartialRefund();
    console.log('✓ 场景2: 部分退款场景 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景2: 部分退款场景 - 测试失败');
    printError(error);
  }

  console.log('');

  try {
    await testPriceChangeApproval();
    console.log('✓ 场景3: 改价审批流程 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景3: 改价审批流程 - 测试失败');
    printError(error);
  }

  console.log('');

  try {
    await testPriceChangeRejection();
    console.log('✓ 场景4: 改价审批驳回 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景4: 改价审批驳回 - 测试失败');
    printError(error);
  }

  console.log('');

  try {
    await testCrossMonthSettlement();
    console.log('✓ 场景5: 跨月结算场景 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景5: 跨月结算场景 - 测试失败');
    printError(error);
  }

  console.log('');

  try {
    await testRefundAfterSettlement();
    console.log('✓ 场景6: 退款冲减已结算佣金 - 测试通过');
  } catch (error) {
    allPassed = false;
    console.error('✗ 场景6: 退款冲减已结算佣金 - 测试失败');
    printError(error);
  }

  console.log('');
  console.log('========================================');
  if (allPassed) {
    console.log('  所有测试场景通过！ ✓');
  } else {
    console.log('  部分测试场景失败，请检查错误信息。');
  }
  console.log('========================================');
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

function printError(error) {
  if (error.response) {
    console.error('  HTTP状态码:', error.response.status);
    console.error('  响应数据:', JSON.stringify(error.response.data));
  } else if (error.request) {
    console.error('  请求未收到响应:', error.message);
  } else {
    console.error('  错误:', error.message || error);
  }
  console.error('  堆栈:', error.stack);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (期望: ${expected}, 实际: ${actual})`);
  }
}

async function testNormalOrder() {
  console.log('测试场景1: 正常订单流程');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长A',
    phone: '15900000001',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  assertEqual(leader.commission_rate, 0.25, '返佣比例不正确');
  console.log('  - 创建团长: OK (ID:', leader.id, ')');

  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '自动化测试课程',
    student_name: '自动化学员',
    student_phone: '15912345678',
    original_price: 1000,
    final_price: 1000,
    payment_time: '2024-06-15 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.25
  });
  const order = orderRes.data;
  assertEqual(order.commission_amount, 250, '佣金计算错误');
  assertEqual(order.status, 'paid', '订单状态错误');
  assertEqual(order.settlement_period, '2024-06', '账期错误');
  console.log('  - 创建订单: OK (佣金 ¥', order.commission_amount, ')');

  const settlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-06'
  });
  const settlement = settlementRes.data;
  assertEqual(settlement.total_orders, 1, '结算订单数错误');
  assertEqual(settlement.total_amount, 1000, '结算金额错误');
  assertEqual(settlement.total_commission, 250, '结算佣金错误');
  console.log('  - 生成结算: OK (', settlement.settlements_count, '条记录)');

  const orderCheckRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderCheck = orderCheckRes.data;
  assertEqual(orderCheck.is_settled, 1, '订单未标记为已结算');
  console.log('  - 验证订单状态: OK (已结算)');
}

async function testPartialRefund() {
  console.log('测试场景2: 部分退款场景');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长B',
    phone: '15900000002',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log('  - 创建团长: OK');

  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '退款测试课程',
    student_name: '退款测试学员',
    student_phone: '15912345679',
    original_price: 2000,
    final_price: 2000,
    payment_time: '2024-07-01 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  const originalCommission = order.commission_amount;
  assertEqual(originalCommission, 400, '原始佣金计算错误');
  console.log('  - 创建订单: OK (原始佣金 ¥', originalCommission, ')');

  const refundRes = await axios.post(`${BASE_URL}/orders/${order.id}/refund`, {
    refund_amount: 500,
    refund_reason: '自动化测试退款'
  });
  const refund = refundRes.data;
  
  const expectedDeduction = 100;
  assertEqual(refund.commission_deduction, expectedDeduction, '佣金扣减错误');
  
  const expectedRemaining = 300;
  assertEqual(refund.new_commission, expectedRemaining, '剩余佣金错误');
  
  assertEqual(refund.new_status, 'partially_refunded', '订单状态应该是部分退款');
  console.log('  - 部分退款: OK (扣减佣金 ¥', refund.commission_deduction, ')');
  console.log('  - 验证佣金: OK (剩余 ¥', refund.new_commission, ')');
}

async function testPriceChangeApproval() {
  console.log('测试场景3: 改价审批流程（通过）');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长C',
    phone: '15900000003',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  console.log('  - 创建团长: OK');

  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '改价测试课程',
    student_name: '改价测试学员',
    student_phone: '15912345680',
    original_price: 1500,
    final_price: 1500,
    payment_time: '2024-07-05 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.25
  });
  const order = orderRes.data;
  const originalCommission = order.commission_amount;
  assertEqual(originalCommission, 375, '原始佣金计算错误');
  assertEqual(order.is_settled, 0, '订单应该未结算');
  console.log('  - 创建订单: OK (佣金 ¥', originalCommission, ')');

  const requestRes = await axios.post(`${BASE_URL}/price-change-requests`, {
    order_id: order.id,
    requested_price: 1200,
    reason: '自动化测试改价'
  });
  const request = requestRes.data;
  assertEqual(request.status, 'pending', '申请状态应该是待审批');
  console.log('  - 创建改价申请: OK (ID:', request.id, ')');

  const approveRes = await axios.post(`${BASE_URL}/price-change-requests/${request.id}/approve`, {
    approved: true,
    approved_by: '自动测试'
  });
  const approve = approveRes.data;
  
  const expectedNewCommission = 300;
  assertEqual(approve.new_commission, expectedNewCommission, '新佣金错误');
  
  const expectedChange = -75;
  assertEqual(approve.commission_change, expectedChange, '佣金变动错误');
  
  console.log('  - 审批通过: OK');
  console.log('  - 验证价格变化: ¥', approve.old_price, '→ ¥', approve.new_price);
  console.log('  - 验证佣金变化: ¥', approve.old_commission, '→ ¥', approve.new_commission);
}

async function testPriceChangeRejection() {
  console.log('测试场景4: 改价审批流程（驳回）');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长D',
    phone: '15900000004',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log('  - 创建团长: OK');

  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '驳回测试课程',
    student_name: '驳回测试学员',
    student_phone: '15912345681',
    original_price: 1800,
    final_price: 1800,
    payment_time: '2024-07-10 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  const originalPrice = order.final_price;
  const originalCommission = order.commission_amount;
  console.log('  - 创建订单: OK (价格 ¥', originalPrice, ', 佣金 ¥', originalCommission, ')');

  const requestRes = await axios.post(`${BASE_URL}/price-change-requests`, {
    order_id: order.id,
    requested_price: 1000,
    reason: '自动化测试驳回'
  });
  const request = requestRes.data;
  console.log('  - 创建改价申请: OK (申请价 ¥', request.requested_price, ')');

  const approveRes = await axios.post(`${BASE_URL}/price-change-requests/${request.id}/approve`, {
    approved: false,
    approved_by: '自动测试'
  });
  const approve = approveRes.data;
  assertEqual(approve.approved, false, '应该返回驳回');
  console.log('  - 审批驳回: OK');

  const orderCheckRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderCheck = orderCheckRes.data;
  assertEqual(orderCheck.final_price, originalPrice, '价格不应该变化');
  assertEqual(orderCheck.commission_amount, originalCommission, '佣金不应该变化');
  console.log('  - 验证价格不变: OK (¥', orderCheck.final_price, ')');
  console.log('  - 验证佣金不变: OK (¥', orderCheck.commission_amount, ')');
}

async function testCrossMonthSettlement() {
  console.log('测试场景5: 跨月结算场景');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长E',
    phone: '15900000005',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  console.log('  - 创建团长: OK');

  const janOrders = [];
  for (let i = 1; i <= 2; i++) {
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      course_name: `跨月测试课程${i}`,
      student_name: `1月自动化学员${i}`,
      student_phone: `1591234568${i}`,
      original_price: 1000 * i,
      final_price: 1000 * i,
      payment_time: `2024-01-${10 + i} 10:00:00`,
      team_leader_id: leader.id,
      team_leader_name: leader.name,
      commission_rate: 0.25
    });
    janOrders.push(orderRes.data);
  }
  const janTotal = janOrders.reduce((sum, o) => sum + o.final_price, 0);
  const janCommission = janOrders.reduce((sum, o) => sum + o.commission_amount, 0);
  console.log('  - 创建1月订单: OK (', janOrders.length, '单, 金额 ¥', janTotal, ', 佣金 ¥', janCommission, ')');

  const febOrders = [];
  for (let i = 1; i <= 3; i++) {
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      course_name: `跨月测试课程${i + 2}`,
      student_name: `2月自动化学员${i}`,
      student_phone: `1591234569${i}`,
      original_price: 800 * i,
      final_price: 800 * i,
      payment_time: `2024-02-${5 + i} 10:00:00`,
      team_leader_id: leader.id,
      team_leader_name: leader.name,
      commission_rate: 0.25
    });
    febOrders.push(orderRes.data);
  }
  const febTotal = febOrders.reduce((sum, o) => sum + o.final_price, 0);
  const febCommission = febOrders.reduce((sum, o) => sum + o.commission_amount, 0);
  console.log('  - 创建2月订单: OK (', febOrders.length, '单, 金额 ¥', febTotal, ', 佣金 ¥', febCommission, ')');

  const janSettlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-01'
  });
  const janSettlement = janSettlementRes.data;
  assertEqual(janSettlement.total_orders, janOrders.length, '1月结算订单数错误');
  assertEqual(janSettlement.total_amount, janTotal, '1月结算金额错误');
  assertEqual(janSettlement.total_commission, janCommission, '1月结算佣金错误');
  console.log('  - 生成1月结算: OK (', janSettlement.settlements_count, '条记录)');

  const febSettlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-02'
  });
  const febSettlement = febSettlementRes.data;
  assertEqual(febSettlement.total_orders, febOrders.length, '2月结算订单数错误');
  assertEqual(febSettlement.total_amount, febTotal, '2月结算金额错误');
  assertEqual(febSettlement.total_commission, febCommission, '2月结算佣金错误');
  console.log('  - 生成2月结算: OK (', febSettlement.settlements_count, '条记录)');

  console.log('  - 验证跨月归属: OK (1月 ¥', janTotal, '| 2月 ¥', febTotal, ')');
}

async function testRefundAfterSettlement() {
  console.log('测试场景6: 退款冲减已结算佣金');
  
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '自动测试团长F',
    phone: '15900000006',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log('  - 创建团长: OK');

  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '已结算退款课程',
    student_name: '已结算退款学员',
    student_phone: '15912345700',
    original_price: 3000,
    final_price: 3000,
    payment_time: '2024-08-01 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  assertEqual(order.commission_amount, 600, '原始佣金计算错误');
  console.log('  - 创建订单: OK (佣金 ¥', order.commission_amount, ')');

  const settlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-08'
  });
  const settlement = settlementRes.data;
  const settlementRecord = settlement.settlements[0];
  assertEqual(settlementRecord.total_commission, 600, '结算佣金错误');
  assertEqual(settlementRecord.net_commission, 600, '净佣金错误');
  assertEqual(settlementRecord.refund_commission, 0, '退款扣回应该为0');
  console.log('  - 生成结算: OK (应结 ¥', settlementRecord.total_commission, ')');

  const orderBeforeRefundRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderBeforeRefund = orderBeforeRefundRes.data;
  assertEqual(orderBeforeRefund.is_settled, 1, '订单应该已结算');
  console.log('  - 验证订单已结算: OK');

  const refundRes = await axios.post(`${BASE_URL}/orders/${order.id}/refund`, {
    refund_amount: 1500,
    refund_reason: '自动化测试已结算退款'
  });
  const refund = refundRes.data;
  
  const expectedDeduction = 300;
  assertEqual(refund.commission_deduction, expectedDeduction, '佣金扣减错误');
  assertEqual(refund.was_settled, true, '应该识别为已结算订单退款');
  console.log('  - 退款处理: OK (扣减佣金 ¥', refund.commission_deduction, ')');
  console.log('  - 已结算退款冲减: OK');

  const settlementCheckRes = await axios.get(`${BASE_URL}/settlements/${settlementRecord.id}`);
  const settlementCheck = settlementCheckRes.data;
  const expectedNetCommission = 300;
  
  assertEqual(settlementCheck.refund_commission, expectedDeduction, '退款扣回错误');
  assertEqual(settlementCheck.net_commission, expectedNetCommission, '净佣金错误');
  
  console.log('  - 验证结算冲减: OK');
  console.log('    原应结佣金: ¥', settlementRecord.total_commission);
  console.log('    退款扣回: ¥', settlementCheck.refund_commission);
  console.log('    实际净佣金: ¥', settlementCheck.net_commission);
}

runAutoTest().catch(error => {
  console.error('测试执行出错:', error.message);
  if (error.response) {
    console.error('响应数据:', error.response.data);
  }
  console.error(error.stack);
  process.exit(1);
});
