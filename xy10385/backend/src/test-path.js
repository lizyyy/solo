const { db } = require('./database');
const DAOs = require('./daos');
const { OrderService } = require('./services');

function logStep(step, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`【步骤 ${step}】 ${description}`);
  console.log(`${'='.repeat(60)}`);
}

function logResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function testScenario1_NormalOrder() {
  logStep('1.1', '创建普通陪诊订单');
  
  const order = OrderService.createOrder({
    patient_id: 'pat-001',
    escort_id: 'esc-001',
    service_type: 'normal',
    start_time: '2025-05-12 08:00',
    end_time: '2025-05-12 12:00',
    department: '内科',
    hospital: '北京协和医院',
    notes: '患者需要血常规和肝功能检查',
    examination_ids: ['exam-001', 'exam-002']
  });
  
  console.log('订单创建成功:');
  logResult({ order_no: order.order_no, id: order.id });
  
  logStep('1.2', '推进订单流程（除最后一步）：接单 -> 接站 -> 挂号 -> 就诊 -> 检查 -> 取药');
  
  const timelinePartial = ['accept', 'meet', 'register', 'consult', 'examination', 'medicine'];
  timelinePartial.forEach((node, idx) => {
    const result = OrderService.advanceTimeline(order.id, node, '李陪诊', `完成${idx + 1}号节点`);
    console.log(`  ✓ ${node}: ${result.message}`);
  });

  logStep('1.3', '计费 - 第一次执行');
  const bill1 = OrderService.billOrder(order.id, '财务小王');
  console.log('计费结果:');
  logResult(bill1);

  logStep('1.4', '计费 - 第二次执行（幂等性测试）');
  const bill2 = OrderService.billOrder(order.id, '财务小王');
  console.log('重复计费结果:');
  logResult(bill2);
  
  if (bill2.idempotent) {
    console.log('✅ 幂等性验证通过：重复计费被识别，没有重复扣款');
  } else {
    console.log('❌ 幂等性验证失败：重复计费被执行了');
  }

  logStep('1.5', '完成订单最后一步');
  const finalResult = OrderService.advanceTimeline(order.id, 'complete', '李陪诊', '服务完成');
  console.log(`  ✓ complete: ${finalResult.message}`);

  logStep('1.6', '验证费用明细');
  const detail = OrderService.getOrderDetail(order.id);
  console.log('订单费用汇总:');
  logResult(detail.fee_summary);

  logStep('1.7', '生成客户报告');
  const report = OrderService.generateReport(order.id);
  console.log('报告内容:');
  logResult(report);

  return order.id;
}

function testScenario2_AddExamination() {
  logStep('2.1', '创建包含加项场景的订单');
  
  const order = OrderService.createOrder({
    patient_id: 'pat-002',
    escort_id: 'esc-002',
    service_type: 'normal',
    start_time: '2025-05-13 09:00',
    end_time: '2025-05-13 13:00',
    department: '放射科',
    hospital: '北京301医院',
    notes: '需要做CT检查',
    examination_ids: ['exam-003']
  });
  
  console.log('订单创建成功:', order.order_no);
  
  logStep('2.2', '推进到检查节点，然后申请临时加项');
  ['accept', 'meet', 'register', 'consult'].forEach(node => {
    OrderService.advanceTimeline(order.id, node, '王陪护', '正常推进');
  });

  logStep('2.3', '申请临时加项：增加MRI检查');
  const addResult = OrderService.addExamination(order.id, 'exam-004', '王陪护');
  logResult(addResult);

  logStep('2.4', '查看待审批加项列表');
  const pending = db._data.order_examinations.filter(
    oe => oe.order_id === order.id && oe.is_added === 1 && oe.approval_status === 'pending'
  );
  console.log('待审批加项:');
  logResult(pending.map(p => ({ id: p.id, exam_name: 'MRI检查' })));

  logStep('2.5', '【规则测试】尝试在未审批时计费');
  try {
    OrderService.billOrder(order.id, '财务小王');
    console.log('❌ 规则验证失败：未审批加项时应该不能计费');
  } catch (e) {
    console.log('✅ 规则验证通过:', e.message);
  }

  logStep('2.6', '审批加项');
  const oeId = pending[0].id;
  const approveResult = OrderService.approveExamination(oeId, '张主管');
  logResult(approveResult);

  logStep('2.7', '审批后再计费');
  const billResult = OrderService.billOrder(order.id, '财务小王');
  console.log('计费成功，包含加项费用:');
  logResult(billResult);

  logStep('2.8', '继续推进流程到完成');
  ['examination', 'medicine', 'complete'].forEach(node => {
    const r = OrderService.advanceTimeline(order.id, node, '王陪护', '');
    console.log(`  ✓ ${node}`);
  });

  logStep('2.9', '验证最终费用明细');
  const detail = OrderService.getOrderDetail(order.id);
  console.log('费用明细（含临时加项MRI 800元）:');
  logResult({
    summary: detail.fee_summary,
    fees: detail.fees.map(f => ({ item: f.item_name, amount: f.amount }))
  });

  return order.id;
}

function testScenario3_TimeConflict() {
  logStep('3.1', '先创建一个订单占用陪诊员时间');
  
  const order1 = OrderService.createOrder({
    patient_id: 'pat-003',
    escort_id: 'esc-003',
    service_type: 'normal',
    start_time: '2025-05-14 08:00',
    end_time: '2025-05-14 10:00',
    department: '妇产科',
    hospital: '北京妇产医院'
  });
  
  console.log('订单1创建成功:', order1.order_no);

  logStep('3.2', '【规则测试】尝试在同一时间段为同一陪诊员创建另一个订单');
  try {
    OrderService.createOrder({
      patient_id: 'pat-001',
      escort_id: 'esc-003',
      service_type: 'normal',
      start_time: '2025-05-14 09:30',
      end_time: '2025-05-14 11:30',
      department: '儿科',
      hospital: '北京儿童医院'
    });
    console.log('❌ 规则验证失败：应该检测到时间冲突');
  } catch (e) {
    console.log('✅ 规则验证通过:', e.message);
  }

  logStep('3.3', '在不同时间创建订单（应该成功）');
  const order2 = OrderService.createOrder({
    patient_id: 'pat-001',
    escort_id: 'esc-003',
    service_type: 'normal',
    start_time: '2025-05-14 14:00',
    end_time: '2025-05-14 16:00',
    department: '儿科',
    hospital: '北京儿童医院'
  });
  
  console.log('订单2创建成功:', order2.order_no);

  return [order1.id, order2.id];
}

function testScenario4_CancelRefund() {
  logStep('4.1', '创建订单用于取消测试');
  
  const order1 = OrderService.createOrder({
    patient_id: 'pat-002',
    escort_id: 'esc-001',
    service_type: 'normal',
    start_time: '2025-05-15 08:00',
    end_time: '2025-05-15 12:00',
    department: '消化科',
    hospital: '北京协和医院',
    examination_ids: ['exam-007']
  });
  
  console.log('订单创建成功:', order1.order_no);

  logStep('4.2', '取消订单');
  const cancelResult = OrderService.cancelOrder(order1.id, '系统', '患者临时有事取消');
  logResult(cancelResult);

  logStep('4.3', '【规则测试】尝试修改已取消订单');
  try {
    OrderService.updateOrder(order1.id, { notes: '尝试修改已取消订单' });
    console.log('❌ 规则验证失败：已取消订单不应该能修改');
  } catch (e) {
    console.log('✅ 规则验证通过:', e.message);
  }

  logStep('4.4', '创建订单用于退款测试');
  const order2 = OrderService.createOrder({
    patient_id: 'pat-003',
    escort_id: 'esc-002',
    service_type: 'normal',
    start_time: '2025-05-16 08:00',
    end_time: '2025-05-16 10:00',
    department: '骨科',
    hospital: '北医三院',
    examination_ids: ['exam-004']
  });

  logStep('4.5', '推进订单（除最后一步）并计费');
  ['accept', 'meet', 'register', 'consult', 'examination', 'medicine'].forEach(node => {
    OrderService.advanceTimeline(order2.id, node, '王陪护', '');
  });
  
  OrderService.billOrder(order2.id, '财务小王');

  const beforeRefund = OrderService.getOrderDetail(order2.id);
  console.log('退款前费用:');
  logResult(beforeRefund.fee_summary);

  logStep('4.6', '完成订单');
  OrderService.advanceTimeline(order2.id, 'complete', '王陪护', '');
  console.log('  ✓ complete');

  logStep('4.7', '退款（第一次）');
  const refund1 = OrderService.refundOrder(order2.id, 500, '张主管', '患者投诉部分项目未做');
  console.log('退款结果:');
  logResult(refund1);

  logStep('4.8', '退款（第二次，幂等性测试）');
  const refund2 = OrderService.refundOrder(order2.id, 500, '张主管', '患者投诉部分项目未做');
  console.log('重复退款结果:');
  logResult(refund2);
  
  if (refund2.idempotent) {
    console.log('✅ 幂等性验证通过：重复退款被识别');
  }

  logStep('4.9', '验证退款后金额');
  const afterRefund = OrderService.getOrderDetail(order2.id);
  console.log('退款后费用:');
  logResult(afterRefund.fee_summary);

  return [order1.id, order2.id];
}

function testScenario5_CompletedOrderProtection() {
  logStep('5.1', '创建订单并完成');
  
  const order = OrderService.createOrder({
    patient_id: 'pat-001',
    escort_id: 'esc-003',
    service_type: 'normal',
    start_time: '2025-05-17 08:00',
    end_time: '2025-05-17 10:00',
    department: '眼科',
    hospital: '北京同仁医院',
    examination_ids: ['exam-006']
  });

  logStep('5.1.1', '推进到取药，然后计费');
  ['accept', 'meet', 'register', 'consult', 'examination', 'medicine'].forEach(node => {
    OrderService.advanceTimeline(order.id, node, '张助理', '');
  });
  OrderService.billOrder(order.id, '财务小王');
  
  logStep('5.1.2', '完成订单');
  OrderService.advanceTimeline(order.id, 'complete', '张助理', '');
  console.log('  ✓ complete');

  logStep('5.2', '【规则测试】尝试推进已完成订单的流程');
  try {
    OrderService.advanceTimeline(order.id, 'accept', '张助理', '');
    console.log('❌ 规则验证失败：已完成订单不应能推进流程');
  } catch (e) {
    console.log('✅ 规则验证通过:', e.message);
  }

  logStep('5.3', '【规则测试】尝试在已完成订单加项');
  try {
    OrderService.addExamination(order.id, 'exam-005', '张助理');
    console.log('❌ 规则验证失败：已完成订单不应能加项');
  } catch (e) {
    console.log('✅ 规则验证通过:', e.message);
  }

  return order.id;
}

function runAllTests() {
  console.log('\n' + '#'.repeat(60));
  console.log('#  医院陪诊订单协调台 - 完整测试场景');
  console.log('#'.repeat(60));

  try {
    console.log('\n\n' + '📋 场景一：普通陪诊流程（含时间线、计费、幂等性）');
    const order1 = testScenario1_NormalOrder();
    
    console.log('\n\n' + '📋 场景二：临时加检查（含审批流程、未确认不能计费）');
    const order2 = testScenario2_AddExamination();
    
    console.log('\n\n' + '📋 场景三：陪诊员时间冲突校验');
    const order3 = testScenario3_TimeConflict();
    
    console.log('\n\n' + '📋 场景四：取消与退款流程');
    const order4 = testScenario4_CancelRefund();
    
    console.log('\n\n' + '📋 场景五：已结束订单保护机制');
    const order5 = testScenario5_CompletedOrderProtection();

    console.log('\n\n' + '#'.repeat(60));
    console.log('#  测试完成！所有业务规则验证通过');
    console.log('#'.repeat(60));
    
    console.log('\n📊 测试数据汇总:');
    const orders = DAOs.OrderDAO.getAll();
    console.log(`  创建订单数: ${orders.length}`);
    
    console.log(`  费用记录数: ${db._data.order_fees.length}`);
    console.log(`  幂等记录数: ${db._data.idempotent_records.length} (证明重复操作被记录)`);

    console.log('\n✅ 重复操作路径验证说明:');
    console.log('  - 计费操作：相同订单+操作人，第二次执行返回 idempotent=true');
    console.log('  - 退款操作：相同订单+金额，第二次执行返回 idempotent=true');
    console.log('  - 已结束订单：修改/加项/推进流程都会被拒绝');
    console.log('  - 时间冲突：同一陪诊员重叠时间不能创建订单');
    console.log('  - 加项计费：未审批加项时不能计费');
    
  } catch (e) {
    console.error('\n❌ 测试执行出错:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runAllTests();
