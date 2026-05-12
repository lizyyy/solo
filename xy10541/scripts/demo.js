const moment = require('moment');
const TechnicianService = require('../src/services/technicianService');
const PartsService = require('../src/services/partsService');
const OrderService = require('../src/services/orderService');
const ReportService = require('../src/services/reportService');
const { RESCHEDULE_TYPE } = require('../src/config/constants');

TechnicianService.initializeTechnicians();
PartsService.initializeParts();

function printSeparator(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60) + '\n');
}

function printResult(label, result) {
  console.log(`【${label}】`);
  if (result.success) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('失败:');
    console.log(JSON.stringify(result, null, 2));
  }
  console.log('');
}

async function runDemo() {
  console.log('\n' + '#'.repeat(60));
  console.log('#  家电上门安装预约改约 API 演示');
  console.log('#  '.repeat(30));
  console.log('#  场景覆盖:');
  console.log('#  1. 正常预约流程');
  console.log('#  2. 客户改期流程');
  console.log('#  3. 师傅改派流程');
  console.log('#  4. 配件不足场景');
  console.log('#  5. 超时赔付场景');
  console.log('#'.repeat(60));

  const techs = TechnicianService.getAllTechniciansWorkload(
    moment().startOf('day').toISOString(),
    moment().add(7, 'days').endOf('day').toISOString()
  );
  const tech1Id = techs[0].technicianId;
  const tech2Id = techs[1].technicianId;
  const tech3Id = techs[2].technicianId;
  const tech4Id = techs[3].technicianId;

  printSeparator('场景 1: 正常预约流程');
  
  console.log('步骤 1: 创建订单');
  const order1Result = OrderService.createOrder({
    customerId: 'C001',
    customerName: '张三',
    customerPhone: '13900139001',
    address: '北京市朝阳区XX小区1号楼101',
    applianceType: '空调',
    applianceModel: '格力 KFR-35GW',
    partCodes: ['AIRCON-BRACKET', 'AIRCON-PIPE']
  }, null, 'customer_service');
  const order1Id = order1Result.order.id;
  printResult('创建订单', order1Result);

  console.log('步骤 2: 分配师傅 (2天后上午9点)');
  const startTime1 = moment().add(2, 'days').hour(9).minute(0).second(0).toISOString();
  const endTime1 = moment().add(2, 'days').hour(11).minute(0).second(0).toISOString();
  const assign1 = OrderService.assignTechnician(order1Id, tech1Id, startTime1, endTime1, 'scheduler');
  printResult('分配师傅', assign1);

  console.log('步骤 3: 分配配件');
  const allocate1 = OrderService.allocateParts(order1Id, 'system');
  printResult('分配配件', allocate1);

  console.log('步骤 4: 发送预约确认');
  const confirmSend1 = OrderService.sendConfirmation(order1Id, 'system');
  printResult('发送确认', confirmSend1);

  console.log('步骤 5: 客户确认预约');
  const confirmationId = confirmSend1.confirmation.id;
  const confirm1 = OrderService.confirmAppointment(order1Id, confirmationId, 'customer');
  printResult('确认预约', confirm1);

  console.log('步骤 6: 开始服务 (准时)');
  const start1 = OrderService.startOrder(order1Id, startTime1, 'technician');
  printResult('开始服务', start1);

  console.log('步骤 7: 完成服务');
  const complete1 = OrderService.completeOrder(order1Id, endTime1, 'technician');
  printResult('完成服务', complete1);

  console.log('步骤 8: 生成订单报告');
  const report1 = ReportService.generateOrderReport(order1Id);
  console.log(ReportService.exportToText(report1));

  printSeparator('场景 2: 客户改期流程');

  console.log('步骤 1: 创建订单');
  const order2Result = OrderService.createOrder({
    customerId: 'C002',
    customerName: '李四',
    customerPhone: '13900139002',
    address: '北京市海淀区YY小区2号楼202',
    applianceType: '洗衣机',
    applianceModel: '海尔 XQG100',
    partCodes: ['WASHING-MACHINE-HOSE']
  }, null, 'customer_service');
  const order2Id = order2Result.order.id;
  printResult('创建订单', order2Result);

  console.log('步骤 2: 分配师傅 (3天后上午10点)');
  const startTime2 = moment().add(3, 'days').hour(10).minute(0).second(0).toISOString();
  const endTime2 = moment().add(3, 'days').hour(12).minute(0).second(0).toISOString();
  const assign2 = OrderService.assignTechnician(order2Id, tech3Id, startTime2, endTime2, 'scheduler');
  printResult('分配师傅', assign2);

  console.log('步骤 3: 分配配件');
  const allocate2 = OrderService.allocateParts(order2Id, 'system');
  printResult('分配配件', allocate2);

  console.log('步骤 4: 客户申请改期 (改到4天后下午2点)');
  const newStartTime2 = moment().add(4, 'days').hour(14).minute(0).second(0).toISOString();
  const rescheduleReq2 = {
    type: RESCHEDULE_TYPE.CUSTOMER,
    reason: '客户当天有事，需要改期',
    newStartTime: newStartTime2
  };
  const reschedule2 = OrderService.requestReschedule(order2Id, rescheduleReq2, 'customer');
  printResult('申请改期', reschedule2);

  console.log('步骤 5: 审批改期');
  const rescheduleId2 = reschedule2.reschedule.id;
  const approve2 = OrderService.approveReschedule(order2Id, rescheduleId2, 'scheduler');
  printResult('审批改期', approve2);

  console.log('步骤 6: 发送新的预约确认');
  const confirmSend2 = OrderService.sendConfirmation(order2Id, 'system');
  printResult('发送确认', confirmSend2);

  console.log('步骤 7: 客户确认新预约');
  const confirm2 = OrderService.confirmAppointment(order2Id, confirmSend2.confirmation.id, 'customer');
  printResult('确认预约', confirm2);

  console.log('步骤 8: 查看改期历史');
  const order2Detail = OrderService.getOrder(order2Id);
  console.log('改期次数统计:');
  console.log(`  总改约次数: ${order2Detail.rescheduleCount}`);
  console.log(`  客户发起: ${order2Detail.customerRescheduleCount}`);
  console.log('改期历史记录:');
  order2Detail.rescheduleHistory.forEach((rs, i) => {
    console.log(`  ${i + 1}. [${rs.type}] ${rs.reason}`);
    console.log(`     从: ${rs.oldStartTime} -> 到: ${rs.newStartTime}`);
  });
  console.log('');

  printSeparator('场景 3: 师傅改派流程');

  console.log('步骤 1: 创建订单');
  const order3Result = OrderService.createOrder({
    customerId: 'C003',
    customerName: '王五',
    customerPhone: '13900139003',
    address: '北京市西城区ZZ小区3号楼303',
    applianceType: '电视',
    applianceModel: '小米 65寸',
    partCodes: ['TV-MOUNT']
  }, null, 'customer_service');
  const order3Id = order3Result.order.id;
  printResult('创建订单', order3Result);

  console.log('步骤 2: 分配师傅1 (4天后上午9点)');
  const startTime3 = moment().add(4, 'days').hour(9).minute(0).second(0).toISOString();
  const endTime3 = moment().add(4, 'days').hour(11).minute(0).second(0).toISOString();
  const assign3 = OrderService.assignTechnician(order3Id, tech3Id, startTime3, endTime3, 'scheduler');
  printResult('分配师傅', assign3);

  console.log('步骤 3: 分配配件');
  const allocate3 = OrderService.allocateParts(order3Id, 'system');
  printResult('分配配件', allocate3);

  console.log('步骤 4: 师傅申请改派 (师傅临时有事)');
  const newStartTime3 = moment().add(5, 'days').hour(10).minute(0).second(0).toISOString();
  const rescheduleReq3 = {
    type: RESCHEDULE_TYPE.TECHNICIAN,
    reason: '师傅王师傅家中有事，申请改派',
    newStartTime: newStartTime3,
    newTechnicianId: tech4Id
  };
  const reschedule3 = OrderService.requestReschedule(order3Id, rescheduleReq3, 'technician_manager');
  printResult('申请改派', reschedule3);

  console.log('步骤 5: 审批改派');
  const approve3 = OrderService.approveReschedule(order3Id, reschedule3.reschedule.id, 'scheduler');
  printResult('审批改派', approve3);

  console.log('步骤 6: 查看师傅工作量变化');
  const workload = TechnicianService.getAllTechniciansWorkload(
    moment().startOf('day').toISOString(),
    moment().add(7, 'days').endOf('day').toISOString()
  );
  console.log('师傅工作量统计:');
  workload.forEach(w => {
    console.log(`  ${w.technicianName}: ${w.totalAssignments} 个任务, ${w.totalHours} 小时`);
  });
  console.log('');

  printSeparator('场景 4: 配件不足场景');

  console.log('先耗尽 TV-MOUNT 配件库存...');
  for (let i = 0; i < 7; i++) {
    const tempOrder = OrderService.createOrder({
      customerId: `TEMP${i}`,
      customerName: `临时订单${i}`,
      customerPhone: '13800000000',
      address: '临时地址',
      applianceType: '电视',
      applianceModel: '临时',
      partCodes: ['TV-MOUNT']
    });
    OrderService.assignTechnician(
      tempOrder.order.id,
      tech4Id,
      moment().add(10 + i, 'days').toISOString(),
      moment().add(10 + i, 'days').add(2, 'hours').toISOString()
    );
    OrderService.allocateParts(tempOrder.order.id);
  }
  console.log('TV-MOUNT 配件已耗尽\n');

  console.log('步骤 1: 创建订单 (需要 TV-MOUNT)');
  const order4Result = OrderService.createOrder({
    customerId: 'C004',
    customerName: '赵六',
    customerPhone: '13900139004',
    address: '北京市东城区AA小区4号楼404',
    applianceType: '电视',
    applianceModel: '索尼 55寸',
    partCodes: ['TV-MOUNT']
  }, null, 'customer_service');
  const order4Id = order4Result.order.id;
  printResult('创建订单', order4Result);

  console.log('步骤 2: 分配师傅');
  const startTime4 = moment().add(6, 'days').hour(14).minute(0).second(0).toISOString();
  const endTime4 = moment().add(6, 'days').hour(16).minute(0).second(0).toISOString();
  const assign4 = OrderService.assignTechnician(order4Id, tech4Id, startTime4, endTime4, 'scheduler');
  printResult('分配师傅', assign4);

  console.log('步骤 3: 尝试分配配件 (预期失败)');
  const allocate4 = OrderService.allocateParts(order4Id, 'system');
  printResult('分配配件', allocate4);

  console.log('当前配件库存状态:');
  const partsStatus = PartsService.getPartStatus();
  partsStatus.forEach(p => {
    console.log(`  ${p.name} (${p.code}): ${p.availableQuantity}/${p.totalQuantity} 可用`);
  });
  console.log('');

  printSeparator('场景 5: 超时赔付场景');

  console.log('步骤 1: 创建订单');
  const order5Result = OrderService.createOrder({
    customerId: 'C005',
    customerName: '钱七',
    customerPhone: '13900139005',
    address: '北京市丰台区BB小区5号楼505',
    applianceType: '冰箱',
    applianceModel: '海尔 BCD-500',
    partCodes: ['REFRIGERATOR-STAND']
  }, null, 'customer_service');
  const order5Id = order5Result.order.id;
  printResult('创建订单', order5Result);

  console.log('步骤 2: 分配师傅');
  const startTime5 = moment().add(1, 'days').hour(8).minute(0).second(0).toISOString();
  const endTime5 = moment().add(1, 'days').hour(10).minute(0).second(0).toISOString();
  const assign5 = OrderService.assignTechnician(order5Id, tech2Id, startTime5, endTime5, 'scheduler');
  printResult('分配师傅', assign5);

  console.log('步骤 3: 分配配件');
  const allocate5 = OrderService.allocateParts(order5Id, 'system');
  printResult('分配配件', allocate5);

  console.log('步骤 4: 发送确认');
  const confirmSend5 = OrderService.sendConfirmation(order5Id, 'system');
  printResult('发送确认', confirmSend5);

  console.log('步骤 5: 客户确认');
  const confirm5 = OrderService.confirmAppointment(order5Id, confirmSend5.confirmation.id, 'customer');
  printResult('确认预约', confirm5);

  console.log('步骤 6: 开始服务 (迟到 45 分钟，超过 30 分钟阈值)');
  const lateStartTime = moment(startTime5).add(45, 'minutes').toISOString();
  const start5 = OrderService.startOrder(order5Id, lateStartTime, 'technician');
  printResult('开始服务', start5);

  if (start5.compensation) {
    console.log('赔付已触发!');
    console.log(`  赔付金额: ¥${start5.compensation.amount}`);
    console.log(`  赔付原因: ${start5.compensation.reason}`);
    console.log(`  赔付状态: ${start5.compensation.status}`);
    
    console.log('\n步骤 7: 处理赔付支付');
    const paidComp = OrderService.processCompensation(start5.compensation.id, 'finance');
    printResult('处理赔付', paidComp);
  }

  console.log('步骤 8: 完成服务');
  const complete5 = OrderService.completeOrder(order5Id, null, 'technician');
  printResult('完成服务', complete5);

  console.log('步骤 9: 查看订单完整报告 (含赔付记录)');
  const report5 = ReportService.generateOrderReport(order5Id);
  console.log(ReportService.exportToText(report5));

  printSeparator('异常场景测试: 已完工订单尝试改期');

  console.log('尝试对已完工的订单1发起改期...');
  const invalidReschedule = OrderService.requestReschedule(order1Id, {
    type: RESCHEDULE_TYPE.CUSTOMER,
    reason: '测试已完工改期',
    newStartTime: moment().add(10, 'days').toISOString()
  }, 'customer');
  printResult('改期结果 (预期失败)', invalidReschedule);

  printSeparator('异常场景测试: 幂等性测试 - 重复确认');

  console.log('再次确认订单1的确认记录 (应该幂等返回)...');
  const idempotentConfirm = OrderService.confirmAppointment(order1Id, 'non-existent-id', 'customer');
  printResult('重复确认 (幂等测试)', idempotentConfirm);

  printSeparator('人工修正测试');

  console.log('创建一个订单用于人工修正...');
  const orderFixResult = OrderService.createOrder({
    customerId: 'C006',
    customerName: '孙八',
    customerPhone: '13900139006',
    address: '北京市通州区CC小区6号楼606',
    applianceType: '空调',
    applianceModel: '美的 1.5匹',
    partCodes: ['AIRCON-PIPE']
  }, null, 'customer_service');
  const orderFixId = orderFixResult.order.id;
  printResult('创建订单', orderFixResult);

  console.log('人工修正订单地址...');
  const manualFix = OrderService.manualCorrection(
    orderFixId,
    { address: '北京市通州区CC小区6号楼606 (已修正: 单元号改为2单元)' },
    'admin_user',
    '客户反馈地址写错了，需要修正单元号'
  );
  printResult('人工修正', {
    success: manualFix.success,
    diff: {
      beforeAddress: manualFix.diff?.before?.address,
      afterAddress: manualFix.diff?.after?.address,
      reason: '客户反馈地址写错了，需要修正单元号',
      operator: 'admin_user'
    }
  });

  printSeparator('生成汇总仪表盘报告');

  const dashboard = ReportService.generateDashboardReport(
    moment().startOf('day').toISOString(),
    moment().add(30, 'days').endOf('day').toISOString()
  );
  
  console.log('仪表盘报告摘要:');
  console.log(JSON.stringify(dashboard.report.summary, null, 2));
  console.log('');
  console.log('赔付统计:');
  console.log(`  总赔付笔数: ${dashboard.report.compensation.totalCount}`);
  console.log(`  总赔付金额: ¥${dashboard.report.compensation.totalAmount}`);

  console.log('\n' + '#'.repeat(60));
  console.log('#  演示完成!');
  console.log('#  上述演示覆盖了:');
  console.log('#  1. 正常预约流程 (订单1)');
  console.log('#  2. 客户改期流程 (订单2)');
  console.log('#  3. 师傅改派流程 (订单3)');
  console.log('#  4. 配件不足场景 (订单4)');
  console.log('#  5. 超时赔付场景 (订单5)');
  console.log('#  6. 异常场景测试');
  console.log('#  7. 幂等性测试');
  console.log('#  8. 人工修正记录');
  console.log('#'.repeat(60) + '\n');
}

runDemo().catch(console.error);
