import { v4 as uuidv4 } from 'uuid';
import { OrderService } from '../services/order.service';
import { WeightService } from '../services/weight.service';
import { RefundService } from '../services/refund.service';

const orderService = new OrderService();
const weightService = new WeightService();
const refundService = new RefundService();

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printSubtitle(title: string) {
  console.log(`\n  --- ${title} ---`);
}

async function scenario1_NormalOutbound() {
  printHeader('场景一: 正常出库流程');
  
  printSubtitle('1. 创建订单');
  const order = orderService.createOrder({
    orderNo: `ORD-${Date.now()}`,
    customerId: 'CUST-001',
    customerName: '张三',
    items: [
      { productId: 'prod-001', expectedWeight: 0.5 },
      { productId: 'prod-002', expectedWeight: 1.0 }
    ]
  });
  console.log('  订单ID:', order.id);
  console.log('  订单号:', order.orderNo);
  console.log('  订单状态:', order.status);
  console.log('  订单总金额:', order.totalExpectedAmount);
  order.items.forEach((item, index) => {
    console.log(`  商品${index + 1}: ${item.productName}, 预估: ${item.expectedWeight}kg`);
  });

  printSubtitle('2. 提交称重 - 小白菜');
  const weight1 = weightService.submitWeight({
    requestId: uuidv4(),
    orderId: order.id,
    orderItemId: order.items[0].id,
    actualWeight: 0.495,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  console.log('  称重记录ID:', weight1.id);
  console.log('  实际重量:', weight1.actualWeight, 'kg');

  printSubtitle('3. 提交称重 - 西红柿');
  const weight2 = weightService.submitWeight({
    requestId: uuidv4(),
    orderId: order.id,
    orderItemId: order.items[1].id,
    actualWeight: 1.005,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  console.log('  称重记录ID:', weight2.id);
  console.log('  实际重量:', weight2.actualWeight, 'kg');

  printSubtitle('4. 查看称重差异汇总');
  const summary = orderService.getWeightDifferenceSummary(order.id);
  console.log('  总预估重量:', summary.totalExpectedWeight, 'kg');
  console.log('  总实际重量:', summary.totalActualWeight, 'kg');
  console.log('  重量差异:', summary.totalWeightDifference, 'kg');
  console.log('  差异百分比:', summary.differencePercentage, '%');
  console.log('  是否异常:', summary.hasAbnormalWeight ? '是' : '否');

  printSubtitle('5. 确认出库');
  const outboundOrder = orderService.confirmOutbound(order.id);
  console.log('  订单状态:', outboundOrder.status);
  console.log('  出库时间:', outboundOrder.outboundTime);
  
  console.log('\n  ✅ 正常出库流程完成!');
  return order.id;
}

async function scenario2_WeightDifferenceRefund() {
  printHeader('场景二: 重量差异退款流程');
  
  printSubtitle('1. 创建订单');
  const order = orderService.createOrder({
    orderNo: `ORD-${Date.now()}`,
    customerId: 'CUST-002',
    customerName: '李四',
    items: [
      { productId: 'prod-003', expectedWeight: 0.5 }
    ]
  });
  console.log('  订单ID:', order.id);
  console.log('  商品:', order.items[0].productName);
  console.log('  预估重量:', order.items[0].expectedWeight, 'kg');
  console.log('  预估金额:', order.items[0].expectedAmount, '元');

  printSubtitle('2. 提交称重 (差异较大 - 少50g)');
  const weightRecord = weightService.submitWeight({
    requestId: uuidv4(),
    orderId: order.id,
    orderItemId: order.items[0].id,
    actualWeight: 0.45,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  console.log('  实际重量:', weightRecord.actualWeight, 'kg');
  console.log('  重量差异:', (0.45 - 0.5).toFixed(3), 'kg');

  printSubtitle('3. 查看称重差异汇总');
  const summary = orderService.getWeightDifferenceSummary(order.id);
  console.log('  差异百分比:', summary.differencePercentage, '%');
  console.log('  是否异常:', summary.hasAbnormalWeight ? '是' : '否');
  console.log('  异常商品:', summary.abnormalItems.join(', '));

  printSubtitle('4. 创建重量差异退款');
  const refund = refundService.createWeightDifferenceRefund({
    orderId: order.id,
    orderItemId: order.items[0].id,
    operatorId: 'CS-001',
    operatorName: '王客服'
  });
  console.log('  退款ID:', refund.id);
  console.log('  退款原因:', refund.reasonDetail);
  console.log('  退款金额:', refund.amount, '元');
  console.log('  退款状态:', refund.status);

  printSubtitle('5. 审核通过退款');
  const approvedRefund = refundService.approveRefund(refund.id);
  console.log('  退款状态:', approvedRefund.status);

  printSubtitle('6. 执行退款');
  const processedRefund = refundService.processRefund(refund.id);
  console.log('  退款状态:', processedRefund.status);
  console.log('  处理时间:', processedRefund.processedAt);

  printSubtitle('7. 确认出库');
  const outboundOrder = orderService.confirmOutbound(order.id);
  console.log('  订单状态:', outboundOrder.status);
  
  console.log('\n  ✅ 重量差异退款流程完成!');
  return order.id;
}

async function scenario3_ExceptionInterception() {
  printHeader('场景三: 异常拦截流程');
  
  printSubtitle('1. 创建订单');
  const order = orderService.createOrder({
    orderNo: `ORD-${Date.now()}`,
    customerId: 'CUST-003',
    customerName: '王五',
    items: [
      { productId: 'prod-001', expectedWeight: 0.5 },
      { productId: 'prod-004', expectedWeight: 1.0 }
    ]
  });
  console.log('  订单ID:', order.id);

  printSubtitle('2. 异常测试 - 实际重量为0');
  try {
    await weightService.submitWeight({
      requestId: uuidv4(),
      orderId: order.id,
      orderItemId: order.items[0].id,
      actualWeight: 0,
      operatorId: 'OP-001',
      operatorName: '李分拣',
      deviceId: 'SCALE-001'
    });
    console.log('  ❌ 未拦截到重量为0的情况');
  } catch (error: any) {
    console.log('  ✅ 成功拦截:', error.message);
  }

  printSubtitle('3. 异常测试 - 重复提交相同requestId');
  const requestId = uuidv4();
  const weight1 = weightService.submitWeight({
    requestId,
    orderId: order.id,
    orderItemId: order.items[0].id,
    actualWeight: 0.48,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  console.log('  第一次提交成功:', weight1.id);
  
  const weight2 = weightService.submitWeight({
    requestId,
    orderId: order.id,
    orderItemId: order.items[0].id,
    actualWeight: 0.48,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  console.log('  第二次相同requestId, 返回缓存结果, ID相同:', weight1.id === weight2.id ? '是' : '否');

  printSubtitle('4. 异常测试 - 替换商品价格更高');
  try {
    await weightService.replaceItemWithWeight({
      requestId: uuidv4(),
      orderId: order.id,
      orderItemId: order.items[1].id,
      newProductId: 'prod-003',
      actualWeight: 0.95,
      operatorId: 'OP-001',
      operatorName: '李分拣',
      deviceId: 'SCALE-001'
    });
    console.log('  ❌ 未拦截到替换高价商品的情况');
  } catch (error: any) {
    console.log('  ✅ 成功拦截:', error.message);
  }

  printSubtitle('5. 先正常称重, 然后出库');
  await weightService.submitWeight({
    requestId: uuidv4(),
    orderId: order.id,
    orderItemId: order.items[1].id,
    actualWeight: 0.98,
    operatorId: 'OP-001',
    operatorName: '李分拣',
    deviceId: 'SCALE-001'
  });
  
  const outboundOrder = orderService.confirmOutbound(order.id);
  console.log('  订单出库成功, 状态:', outboundOrder.status);

  printSubtitle('6. 异常测试 - 出库后修改重量');
  try {
    await weightService.submitWeight({
      requestId: uuidv4(),
      orderId: order.id,
      orderItemId: order.items[0].id,
      actualWeight: 0.55,
      operatorId: 'OP-001',
      operatorName: '李分拣',
      deviceId: 'SCALE-001'
    });
    console.log('  ❌ 未拦截到出库后修改重量的情况');
  } catch (error: any) {
    console.log('  ✅ 成功拦截:', error.message);
  }

  console.log('\n  ✅ 异常拦截流程完成!');
  return order.id;
}

async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█         生鲜分拣称重差异 API - 业务场景测试             █');
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█'.repeat(60));

  try {
    await scenario1_NormalOutbound();
    await scenario2_WeightDifferenceRefund();
    await scenario3_ExceptionInterception();
    
    console.log('\n' + '='.repeat(60));
    console.log('  🎉 所有业务场景测试完成!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  }
}

runAllTests();
