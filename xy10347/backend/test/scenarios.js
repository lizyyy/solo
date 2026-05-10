const axios = require('axios');
const readline = require('readline');
const moment = require('moment');

const BASE_URL = 'http://localhost:5001/api';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function runScenario() {
  console.log('========================================');
  console.log('  社群课程返佣结算台 - 场景测试');
  console.log('========================================');
  console.log('');

  const choice = await question(
    '请选择要测试的场景：\n' +
    '1. 正常订单流程\n' +
    '2. 部分退款场景\n' +
    '3. 改价审批流程\n' +
    '4. 改价审批失败（驳回）\n' +
    '5. 跨月结算场景\n' +
    '6. 退款冲减已结算佣金\n' +
    '7. 运行所有场景\n' +
    '0. 退出\n' +
    '\n请输入选项: '
  );

  console.log('');

  switch (choice) {
    case '1':
      await testNormalOrder();
      break;
    case '2':
      await testPartialRefund();
      break;
    case '3':
      await testPriceChangeApproval();
      break;
    case '4':
      await testPriceChangeRejection();
      break;
    case '5':
      await testCrossMonthSettlement();
      break;
    case '6':
      await testRefundAfterSettlement();
      break;
    case '7':
      await testAllScenarios();
      break;
    case '0':
      console.log('退出程序');
      rl.close();
      process.exit(0);
    default:
      console.log('无效选项');
  }

  rl.close();
}

async function testNormalOrder() {
  console.log('========================================');
  console.log('场景1: 正常订单流程');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长A',
    phone: '13900000001',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name} (ID: ${leader.id})`);
  console.log(`  返佣比例: ${(leader.commission_rate * 100).toFixed(0)}%`);
  console.log('');

  console.log('步骤2: 创建订单');
  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: 'Python高级课程',
    student_name: '测试学员',
    student_phone: '13912345678',
    original_price: 2999,
    final_price: 2999,
    payment_time: '2024-03-15 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.25
  });
  const order = orderRes.data;
  console.log(`  ✓ 创建订单: ${order.id.substring(0, 8)}...`);
  console.log(`  学员: ${order.student_name}`);
  console.log(`  课程: ${order.course_name}`);
  console.log(`  实付金额: ¥${order.final_price.toFixed(2)}`);
  console.log(`  应付佣金: ¥${order.commission_amount.toFixed(2)}`);
  console.log(`  订单状态: ${order.status}`);
  console.log(`  账期: ${order.settlement_period}`);
  console.log('');

  console.log('步骤3: 生成月度结算');
  const settlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-03'
  });
  const settlement = settlementRes.data;
  console.log(`  ✓ 生成结算 (${settlement.period})`);
  console.log(`  处理订单数: ${settlement.total_orders}`);
  console.log(`  总金额: ¥${settlement.total_amount?.toFixed(2) || 0}`);
  console.log(`  总佣金: ¥${settlement.total_commission?.toFixed(2) || 0}`);
  console.log(`  生成结算记录: ${settlement.settlements_count} 条`);
  if (settlement.settlements && settlement.settlements.length > 0) {
    const s = settlement.settlements[0];
    console.log(`  团长结算: ${s.team_leader_name} - ${s.total_orders} 单, 佣金 ¥${s.total_commission.toFixed(2)}`);
  }
  console.log('');

  console.log('验证: 订单状态');
  const orderCheckRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderCheck = orderCheckRes.data;
  console.log(`  订单是否已结算: ${orderCheck.is_settled === 1 ? '是 ✓' : '否 ✗'}`);
  console.log(`  结算ID: ${orderCheck.settlement_id}`);
  console.log('');

  console.log('========================================');
  console.log('场景1 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testPartialRefund() {
  console.log('========================================');
  console.log('场景2: 部分退款场景');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长B',
    phone: '13900000002',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name}`);
  console.log('');

  console.log('步骤2: 创建订单');
  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: 'Java高级课程',
    student_name: '退款测试学员',
    student_phone: '13912345679',
    original_price: 2000,
    final_price: 2000,
    payment_time: '2024-04-01 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  console.log(`  ✓ 创建订单`);
  console.log(`  实付金额: ¥${order.final_price.toFixed(2)}`);
  console.log(`  应付佣金: ¥${order.commission_amount.toFixed(2)} (20%)`);
  console.log(`  当前佣金: ¥${order.commission_amount.toFixed(2)}`);
  console.log(`  订单状态: ${order.status}`);
  console.log('');

  console.log('步骤3: 部分退款 (退款 ¥500)');
  const refundRes = await axios.post(`${BASE_URL}/orders/${order.id}/refund`, {
    refund_amount: 500,
    refund_reason: '用户要求部分退款'
  });
  const refund = refundRes.data;
  console.log(`  ✓ 退款处理成功`);
  console.log(`  退款金额: ¥${refund.refund_amount.toFixed(2)}`);
  console.log(`  佣金扣减: ¥${refund.commission_deduction.toFixed(2)}`);
  console.log(`  剩余佣金: ¥${refund.new_commission.toFixed(2)}`);
  console.log(`  新状态: ${refund.new_status}`);
  console.log('');

  console.log('验证: 佣金计算是否正确');
  const expectedDeduction = 500 * 0.20;
  const expectedRemaining = order.commission_amount - expectedDeduction;
  console.log(`  预期佣金扣减: ¥${expectedDeduction.toFixed(2)}`);
  console.log(`  实际佣金扣减: ¥${refund.commission_deduction.toFixed(2)}`);
  console.log(`  扣减结果: ${refund.commission_deduction === expectedDeduction ? '正确 ✓' : '错误 ✗'}`);
  console.log(`  预期剩余佣金: ¥${expectedRemaining.toFixed(2)}`);
  console.log(`  实际剩余佣金: ¥${refund.new_commission.toFixed(2)}`);
  console.log(`  剩余佣金结果: ${refund.new_commission === expectedRemaining ? '正确 ✓' : '错误 ✗'}`);
  console.log('');

  console.log('========================================');
  console.log('场景2 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testPriceChangeApproval() {
  console.log('========================================');
  console.log('场景3: 改价审批流程（通过）');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长C',
    phone: '13900000003',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name}`);
  console.log('');

  console.log('步骤2: 创建订单');
  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '数据分析实战',
    student_name: '改价测试学员',
    student_phone: '13912345680',
    original_price: 1500,
    final_price: 1500,
    payment_time: '2024-04-05 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.25
  });
  const order = orderRes.data;
  console.log(`  ✓ 创建订单`);
  console.log(`  原价: ¥${order.original_price.toFixed(2)}`);
  console.log(`  实付: ¥${order.final_price.toFixed(2)}`);
  console.log(`  佣金: ¥${order.commission_amount.toFixed(2)} (25%)`);
  console.log(`  结算状态: ${order.is_settled === 1 ? '已结算' : '未结算'}`);
  console.log('');

  console.log('步骤3: 创建改价申请 (价格从 ¥1500 改为 ¥1200)');
  const requestRes = await axios.post(`${BASE_URL}/price-change-requests`, {
    order_id: order.id,
    requested_price: 1200,
    reason: '老客户优惠'
  });
  const request = requestRes.data;
  console.log(`  ✓ 创建改价申请 (ID: ${request.id})`);
  console.log(`  原价: ¥${request.original_price.toFixed(2)}`);
  console.log(`  申请价: ¥${request.requested_price.toFixed(2)}`);
  console.log(`  申请状态: ${request.status}`);
  console.log('');

  console.log('步骤4: 审批通过');
  const approveRes = await axios.post(`${BASE_URL}/price-change-requests/${request.id}/approve`, {
    approved: true,
    approved_by: '管理员'
  });
  const approve = approveRes.data;
  console.log(`  ✓ 审批通过`);
  console.log(`  价格变化: ¥${approve.old_price.toFixed(2)} → ¥${approve.new_price.toFixed(2)}`);
  console.log(`  价格变动: ${approve.price_change > 0 ? '+' : ''}¥${approve.price_change.toFixed(2)}`);
  console.log(`  佣金变化: ¥${approve.old_commission.toFixed(2)} → ¥${approve.new_commission.toFixed(2)}`);
  console.log(`  佣金变动: ${approve.commission_change > 0 ? '+' : ''}¥${approve.commission_change.toFixed(2)}`);
  console.log('');

  console.log('验证: 佣金计算是否正确');
  const expectedNewCommission = 1200 * 0.25;
  const expectedCommissionChange = expectedNewCommission - order.commission_amount;
  console.log(`  预期新佣金: ¥${expectedNewCommission.toFixed(2)}`);
  console.log(`  实际新佣金: ¥${approve.new_commission.toFixed(2)}`);
  console.log(`  佣金结果: ${approve.new_commission === expectedNewCommission ? '正确 ✓' : '错误 ✗'}`);
  console.log('');

  console.log('========================================');
  console.log('场景3 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testPriceChangeRejection() {
  console.log('========================================');
  console.log('场景4: 改价审批流程（驳回）');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长D',
    phone: '13900000004',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name}`);
  console.log('');

  console.log('步骤2: 创建订单');
  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: 'Web开发课程',
    student_name: '驳回测试学员',
    student_phone: '13912345681',
    original_price: 1800,
    final_price: 1800,
    payment_time: '2024-04-10 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  console.log(`  ✓ 创建订单`);
  console.log(`  实付价格: ¥${order.final_price.toFixed(2)}`);
  console.log(`  佣金: ¥${order.commission_amount.toFixed(2)}`);
  console.log('');

  console.log('步骤3: 创建改价申请 (价格从 ¥1800 改为 ¥1000)');
  const requestRes = await axios.post(`${BASE_URL}/price-change-requests`, {
    order_id: order.id,
    requested_price: 1000,
    reason: '用户要求大幅降价'
  });
  const request = requestRes.data;
  console.log(`  ✓ 创建改价申请 (ID: ${request.id})`);
  console.log(`  原价: ¥${request.original_price.toFixed(2)}`);
  console.log(`  申请价: ¥${request.requested_price.toFixed(2)}`);
  console.log(`  价格变动: ¥${(request.requested_price - request.original_price).toFixed(2)}`);
  console.log('');

  console.log('步骤4: 审批驳回');
  const approveRes = await axios.post(`${BASE_URL}/price-change-requests/${request.id}/approve`, {
    approved: false,
    approved_by: '管理员'
  });
  const approve = approveRes.data;
  console.log(`  ✓ 审批驳回`);
  console.log(`  审批结果: ${approve.approved ? '通过' : '驳回'}`);
  console.log(`  消息: ${approve.message}`);
  console.log('');

  console.log('验证: 订单价格和佣金是否保持不变');
  const orderCheckRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderCheck = orderCheckRes.data;
  console.log(`  原价格: ¥${order.final_price.toFixed(2)}`);
  console.log(`  当前价格: ¥${orderCheck.final_price.toFixed(2)}`);
  console.log(`  价格是否不变: ${orderCheck.final_price === order.final_price ? '是 ✓' : '否 ✗'}`);
  console.log(`  原佣金: ¥${order.commission_amount.toFixed(2)}`);
  console.log(`  当前佣金: ¥${orderCheck.commission_amount.toFixed(2)}`);
  console.log(`  佣金是否不变: ${orderCheck.commission_amount === order.commission_amount ? '是 ✓' : '否 ✗'}`);
  console.log('');

  console.log('========================================');
  console.log('场景4 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testCrossMonthSettlement() {
  console.log('========================================');
  console.log('场景5: 跨月结算场景');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长E',
    phone: '13900000005',
    commission_rate: 0.25
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name}`);
  console.log('');

  console.log('步骤2: 创建1月份订单 (2单)');
  const janOrders = [];
  for (let i = 1; i <= 2; i++) {
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      course_name: `课程${i}`,
      student_name: `1月学员${i}`,
      student_phone: `1391234568${i + 1}`,
      original_price: 1000 * i,
      final_price: 1000 * i,
      payment_time: `2024-01-${10 + i} 10:00:00`,
      team_leader_id: leader.id,
      team_leader_name: leader.name,
      commission_rate: 0.25
    });
    janOrders.push(orderRes.data);
  }
  console.log(`  ✓ 创建1月订单 2 单`);
  console.log(`  订单1: ¥${janOrders[0].final_price.toFixed(2)}, 佣金 ¥${janOrders[0].commission_amount.toFixed(2)}, 账期 ${janOrders[0].settlement_period}`);
  console.log(`  订单2: ¥${janOrders[1].final_price.toFixed(2)}, 佣金 ¥${janOrders[1].commission_amount.toFixed(2)}, 账期 ${janOrders[1].settlement_period}`);
  console.log('');

  console.log('步骤3: 创建2月份订单 (3单)');
  const febOrders = [];
  for (let i = 1; i <= 3; i++) {
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      course_name: `课程${i + 2}`,
      student_name: `2月学员${i}`,
      student_phone: `1391234569${i}`,
      original_price: 800 * i,
      final_price: 800 * i,
      payment_time: `2024-02-${5 + i} 10:00:00`,
      team_leader_id: leader.id,
      team_leader_name: leader.name,
      commission_rate: 0.25
    });
    febOrders.push(orderRes.data);
  }
  console.log(`  ✓ 创建2月订单 3 单`);
  console.log(`  订单1: ¥${febOrders[0].final_price.toFixed(2)}, 佣金 ¥${febOrders[0].commission_amount.toFixed(2)}, 账期 ${febOrders[0].settlement_period}`);
  console.log(`  订单2: ¥${febOrders[1].final_price.toFixed(2)}, 佣金 ¥${febOrders[1].commission_amount.toFixed(2)}, 账期 ${febOrders[1].settlement_period}`);
  console.log(`  订单3: ¥${febOrders[2].final_price.toFixed(2)}, 佣金 ¥${febOrders[2].commission_amount.toFixed(2)}, 账期 ${febOrders[2].settlement_period}`);
  console.log('');

  console.log('步骤4: 生成1月结算');
  const janSettlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-01'
  });
  const janSettlement = janSettlementRes.data;
  console.log(`  ✓ 生成1月结算`);
  console.log(`  处理订单数: ${janSettlement.total_orders}`);
  console.log(`  总金额: ¥${janSettlement.total_amount?.toFixed(2) || 0}`);
  console.log(`  总佣金: ¥${janSettlement.total_commission?.toFixed(2) || 0}`);
  console.log('');

  console.log('步骤5: 生成2月结算');
  const febSettlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-02'
  });
  const febSettlement = febSettlementRes.data;
  console.log(`  ✓ 生成2月结算`);
  console.log(`  处理订单数: ${febSettlement.total_orders}`);
  console.log(`  总金额: ¥${febSettlement.total_amount?.toFixed(2) || 0}`);
  console.log(`  总佣金: ¥${febSettlement.total_commission?.toFixed(2) || 0}`);
  console.log('');

  console.log('验证: 跨月订单是否正确归属');
  const expectedJanAmount = janOrders.reduce((sum, o) => sum + o.final_price, 0);
  const expectedJanCommission = janOrders.reduce((sum, o) => sum + o.commission_amount, 0);
  const expectedFebAmount = febOrders.reduce((sum, o) => sum + o.final_price, 0);
  const expectedFebCommission = febOrders.reduce((sum, o) => sum + o.commission_amount, 0);

  console.log(`  1月预期金额: ¥${expectedJanAmount.toFixed(2)}`);
  console.log(`  1月实际金额: ¥${janSettlement.total_amount?.toFixed(2) || 0}`);
  console.log(`  1月金额验证: ${janSettlement.total_amount === expectedJanAmount ? '正确 ✓' : '错误 ✗'}`);
  console.log(`  1月预期佣金: ¥${expectedJanCommission.toFixed(2)}`);
  console.log(`  1月实际佣金: ¥${janSettlement.total_commission?.toFixed(2) || 0}`);
  console.log(`  1月佣金验证: ${janSettlement.total_commission === expectedJanCommission ? '正确 ✓' : '错误 ✗'}`);
  console.log('');
  console.log(`  2月预期金额: ¥${expectedFebAmount.toFixed(2)}`);
  console.log(`  2月实际金额: ¥${febSettlement.total_amount?.toFixed(2) || 0}`);
  console.log(`  2月金额验证: ${febSettlement.total_amount === expectedFebAmount ? '正确 ✓' : '错误 ✗'}`);
  console.log(`  2月预期佣金: ¥${expectedFebCommission.toFixed(2)}`);
  console.log(`  2月实际佣金: ¥${febSettlement.total_commission?.toFixed(2) || 0}`);
  console.log(`  2月佣金验证: ${febSettlement.total_commission === expectedFebCommission ? '正确 ✓' : '错误 ✗'}`);
  console.log('');

  console.log('========================================');
  console.log('场景5 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testRefundAfterSettlement() {
  console.log('========================================');
  console.log('场景6: 退款冲减已结算佣金');
  console.log('========================================');
  console.log('');

  console.log('步骤1: 创建团长');
  const leaderRes = await axios.post(`${BASE_URL}/team-leaders`, {
    name: '测试团长F',
    phone: '13900000006',
    commission_rate: 0.20
  });
  const leader = leaderRes.data;
  console.log(`  ✓ 创建团长: ${leader.name}`);
  console.log('');

  console.log('步骤2: 创建订单');
  const orderRes = await axios.post(`${BASE_URL}/orders`, {
    course_name: '人工智能课程',
    student_name: '已结算退款学员',
    student_phone: '13912345700',
    original_price: 3000,
    final_price: 3000,
    payment_time: '2024-05-01 10:00:00',
    team_leader_id: leader.id,
    team_leader_name: leader.name,
    commission_rate: 0.20
  });
  const order = orderRes.data;
  console.log(`  ✓ 创建订单`);
  console.log(`  实付金额: ¥${order.final_price.toFixed(2)}`);
  console.log(`  应付佣金: ¥${order.commission_amount.toFixed(2)}`);
  console.log('');

  console.log('步骤3: 生成月度结算');
  const settlementRes = await axios.post(`${BASE_URL}/settlements/generate`, {
    period: '2024-05'
  });
  const settlement = settlementRes.data;
  const settlementRecord = settlement.settlements[0];
  console.log(`  ✓ 生成结算 (ID: ${settlementRecord.id})`);
  console.log(`  订单数: ${settlementRecord.total_orders}`);
  console.log(`  总金额: ¥${settlementRecord.total_amount.toFixed(2)}`);
  console.log(`  应结佣金: ¥${settlementRecord.total_commission.toFixed(2)}`);
  console.log(`  退款扣回: ¥${settlementRecord.refund_commission.toFixed(2)}`);
  console.log(`  实结佣金: ¥${settlementRecord.net_commission.toFixed(2)}`);
  console.log('');

  console.log('步骤4: 订单已结算后退款 (退款 ¥1500)');
  console.log('  退款前验证: 订单已结算');
  const orderBeforeRefundRes = await axios.get(`${BASE_URL}/orders/${order.id}`);
  const orderBeforeRefund = orderBeforeRefundRes.data;
  console.log(`  订单是否已结算: ${orderBeforeRefund.is_settled === 1 ? '是 ✓' : '否 ✗'}`);
  console.log(`  结算ID: ${orderBeforeRefund.settlement_id}`);
  console.log('');

  const refundRes = await axios.post(`${BASE_URL}/orders/${order.id}/refund`, {
    refund_amount: 1500,
    refund_reason: '课程质量问题'
  });
  const refund = refundRes.data;
  console.log(`  ✓ 退款处理成功`);
  console.log(`  退款金额: ¥${refund.refund_amount.toFixed(2)}`);
  console.log(`  佣金扣减: ¥${refund.commission_deduction.toFixed(2)}`);
  console.log(`  订单是否已结算: ${refund.was_settled ? '是' : '否'}`);
  console.log(`  从结算扣减: ${refund.was_settled ? '是 ✓' : '否 ✗'}`);
  console.log('');

  console.log('验证: 结算记录是否已冲减');
  const settlementCheckRes = await axios.get(`${BASE_URL}/settlements/${settlementRecord.id}`);
  const settlementCheck = settlementCheckRes.data;
  console.log(`  原应结佣金: ¥${settlementRecord.total_commission.toFixed(2)}`);
  console.log(`  退款扣回: ¥${settlementCheck.refund_commission.toFixed(2)}`);
  console.log(`  实结佣金: ¥${settlementCheck.net_commission.toFixed(2)}`);
  
  const expectedNetCommission = settlementRecord.total_commission - refund.commission_deduction;
  console.log(`  预期实结佣金: ¥${expectedNetCommission.toFixed(2)}`);
  console.log(`  实际实结佣金: ¥${settlementCheck.net_commission.toFixed(2)}`);
  console.log(`  冲减结果: ${settlementCheck.net_commission === expectedNetCommission ? '正确 ✓' : '错误 ✗'}`);
  console.log('');

  console.log('========================================');
  console.log('场景6 测试完成！');
  console.log('========================================');
  console.log('');
}

async function testAllScenarios() {
  console.log('========================================');
  console.log('运行所有场景测试');
  console.log('========================================');
  console.log('');

  await testNormalOrder();
  console.log('\n');
  await testPartialRefund();
  console.log('\n');
  await testPriceChangeApproval();
  console.log('\n');
  await testPriceChangeRejection();
  console.log('\n');
  await testCrossMonthSettlement();
  console.log('\n');
  await testRefundAfterSettlement();

  console.log('========================================');
  console.log('所有场景测试完成！');
  console.log('========================================');
}

runScenario().catch(error => {
  console.error('测试出错:', error.message);
  if (error.response) {
    console.error('响应数据:', error.response.data);
  }
  rl.close();
});
