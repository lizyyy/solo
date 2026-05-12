const eventSourcingService = require('../src/services/OrderEventSourcingService');
const explanationService = require('../src/services/ExplanationService');
const connectDB = require('../src/config/database');
const { generateOrderId } = require('../src/utils/idGenerator');

async function runDemo() {
  console.log('======== 订单事件溯源 API 演示 ========\n');

  try {
    await connectDB();
    console.log('✅ MongoDB 连接成功\n');

    const orderId = generateOrderId();
    console.log(`创建订单: ${orderId}\n`);

    console.log('======== 场景 1: 正常下单流程 ========');
    await demoNormalOrder(orderId);

    console.log('\n======== 场景 2: 支付后取消失败 ========');
    await demoCancelFailedFlow(orderId);

    console.log('\n======== 场景 3: 库存补偿 ========');
    const compensationOrderId = generateOrderId();
    await demoInventoryCompensation(compensationOrderId);

    console.log('\n======== 场景 4: 重复事件幂等 ========');
    const idempotentOrderId = generateOrderId();
    await demoIdempotentEvents(idempotentOrderId);

    console.log('\n======== 场景 5: 投影重建 ========');
    await demoRebuildProjection(orderId);

    console.log('\n======== 演示完成 ========');
    process.exit(0);

  } catch (error) {
    console.error('❌ 演示出错:', error);
    process.exit(1);
  }
}

async function demoNormalOrder(orderId) {
  console.log('\n1. 创建订单...');
  const createResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'ORDER_CREATED',
    payload: {
      userId: 'USER-001',
      items: [
        {
          productId: 'PROD-001',
          productName: 'iPhone 15',
          quantity: 1,
          unitPrice: 6999,
          totalPrice: 6999
        }
      ],
      totalAmount: 6999,
      shippingAddress: {
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园路 1 号',
        phone: '13800138000',
        name: '张三'
      },
      paymentMethod: 'WECHAT_PAY',
      remark: '请尽快发货'
    },
    metadata: {
      operator: 'SYSTEM',
      source: 'ORDER_SERVICE',
      requestId: 'REQ-001',
      description: '用户下单'
    }
  });
  console.log(`✅ 订单创建成功，当前状态: ${createResult.projection.currentStateDescription}`);
  console.log(`   版本: ${createResult.projection.version}`);

  console.log('\n2. 发起支付...');
  const paymentInitiatedResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'PAYMENT_INITIATED',
    payload: {},
    metadata: {
      operator: 'USER-001',
      source: 'PAYMENT_SERVICE',
      requestId: 'REQ-002',
      description: '用户发起支付'
    }
  });
  console.log(`✅ 支付发起成功，当前状态: ${paymentInitiatedResult.projection.currentStateDescription}`);

  console.log('\n3. 支付成功...');
  const paymentSuccessResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'PAYMENT_SUCCEEDED',
    payload: {
      paymentId: 'PAY-20240101001',
      amount: 6999,
      paidAt: new Date()
    },
    metadata: {
      operator: 'PAYMENT_GATEWAY',
      source: 'PAYMENT_SERVICE',
      requestId: 'REQ-003',
      description: '支付网关回调成功'
    }
  });
  console.log(`✅ 支付成功，当前状态: ${paymentSuccessResult.projection.currentStateDescription}`);

  console.log('\n4. 锁定库存...');
  const inventoryResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'INVENTORY_LOCKED',
    payload: {
      items: [
        {
          productId: 'PROD-001',
          lockedQuantity: 1
        }
      ],
      lockedAt: new Date()
    },
    metadata: {
      operator: 'INVENTORY_SERVICE',
      source: 'INVENTORY_SERVICE',
      requestId: 'REQ-004',
      description: '库存锁定成功'
    }
  });
  console.log(`✅ 库存锁定成功，当前状态: ${inventoryResult.projection.currentStateDescription}`);

  console.log('\n5. 发货...');
  const shippedResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'SHIPPING_INITIATED',
    payload: {},
    metadata: {
      operator: 'LOGISTICS_DEPT',
      source: 'SHIPPING_SERVICE',
      requestId: 'REQ-005',
      description: '开始发货流程'
    }
  });
  console.log(`✅ 发货流程开始，当前状态: ${shippedResult.projection.currentStateDescription}`);

  console.log('\n6. 查看时间线...');
  const timeline = await eventSourcingService.getOrderTimeline(orderId);
  console.log(`✅ 事件总数: ${timeline.totalEvents}`);
  console.log(`   有效事件: ${timeline.validEvents}`);
  console.log(`   当前状态: ${timeline.currentStateDescription}`);

  timeline.stateTransitions.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.timestamp.toLocaleTimeString()}] ${t.description}`);
    console.log(`      ${t.fromStateDescription} → ${t.toStateDescription}`);
  });
}

async function demoCancelFailedFlow(orderId) {
  console.log('\n1. 尝试在已发货状态发起取消申请...');
  try {
    await eventSourcingService.appendEvent(orderId, {
      eventType: 'CANCEL_REQUESTED',
      payload: {
        reason: '不想要了'
      },
      metadata: {
        operator: 'USER-001',
        source: 'USER_CENTER',
        requestId: 'REQ-CANCEL-001',
        description: '用户申请取消订单'
      }
    });
  } catch (error) {
    console.log(`❌ 取消申请被拒绝: ${error.message}`);
  }

  console.log('\n2. 查看解释报告...');
  const report = await explanationService.generateExplanationReport(orderId);
  console.log(`\n【客服视角关键问题】`);
  
  Object.entries(report.commonQuestions).forEach(([q, a]) => {
    console.log(`\nQ: ${q}`);
    if (a.reasons) {
      console.log(`A: 原因: ${a.reasons.join('; ')}`);
    }
    if (a.currentState) {
      console.log(`   当前状态: ${a.currentState}`);
    }
    if (a.canShip !== undefined) {
      console.log(`   可以继续发货: ${a.canShip}`);
    }
  });

  console.log(`\n【研发视角】`);
  console.log(`   投影版本: ${report.developerView.projectionInfo.version}`);
  console.log(`   状态一致性: ${report.developerView.projectionInfo.isConsistent ? '一致' : '不一致'}`);
  console.log(`   非法事件数: ${report.developerView.invalidEvents.length}`);
}

async function demoInventoryCompensation(orderId) {
  console.log('\n1. 创建订单...');
  await eventSourcingService.appendEvent(orderId, {
    eventType: 'ORDER_CREATED',
    payload: {
      userId: 'USER-002',
      items: [
        {
          productId: 'PROD-002',
          productName: 'MacBook Pro',
          quantity: 1,
          unitPrice: 14999,
          totalPrice: 14999
        }
      ],
      totalAmount: 14999,
      shippingAddress: {
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '望京 SOHO',
        phone: '13900139000',
        name: '李四'
      },
      paymentMethod: 'ALIPAY',
      remark: ''
    },
    metadata: {
      operator: 'SYSTEM',
      source: 'ORDER_SERVICE',
      requestId: 'REQ-COMP-001',
      description: '用户下单'
    }
  });

  console.log('\n2. 支付成功...');
  await eventSourcingService.appendEvent(orderId, {
    eventType: 'PAYMENT_INITIATED',
    payload: {}
  });

  await eventSourcingService.appendEvent(orderId, {
    eventType: 'PAYMENT_SUCCEEDED',
    payload: {
      paymentId: 'PAY-20240101002',
      amount: 14999
    }
  });

  console.log('\n3. 库存锁定失败（模拟缺货）...');
  const inventoryFailResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'INVENTORY_FAILED',
    payload: {
      reason: 'PROD-002 库存不足，剩余 0 件'
    },
    metadata: {
      operator: 'INVENTORY_SERVICE',
      source: 'INVENTORY_SERVICE',
      description: '库存锁定失败'
    }
  });
  console.log(`✅ 库存锁定失败，当前状态: ${inventoryFailResult.projection.currentStateDescription}`);

  console.log('\n4. 执行补偿：退款...');
  const compensationResult = await eventSourcingService.appendEvent(orderId, {
    eventType: 'COMPENSATION_PAYMENT_REFUNDED',
    isCompensation: true,
    compensatesEventId: inventoryFailResult.event.eventId,
    payload: {
      refundId: 'REFUND-001',
      amount: 14999,
      reason: '库存锁定失败，自动退款'
    },
    metadata: {
      operator: 'COMPENSATION_SERVICE',
      source: 'COMPENSATION_ENGINE',
      description: '补偿：因库存锁定失败，退款已支付金额'
    }
  });
  console.log(`✅ 补偿执行成功，当前状态: ${compensationResult.projection.currentStateDescription}`);
  console.log(`   补偿事件 ID: ${compensationResult.event.eventId}`);

  console.log('\n5. 查看补偿后的报告...');
  const report = await explanationService.generateExplanationReport(orderId);
  console.log(`   存在补偿事件: ${report.summary.hasCompensations}`);
  console.log(`   补偿事件数: ${report.summary.compensationCount}`);
  
  if (report.summary.hasCompensations) {
    report.developerView.eventStream
      .filter(e => e.isCompensation)
      .forEach(e => {
        console.log(`   - 补偿事件: ${e.type}`);
        console.log(`     补偿原事件: ${e.compensates}`);
        console.log(`     时间: ${e.time.toLocaleString()}`);
      });
  }
}

async function demoIdempotentEvents(orderId) {
  console.log('\n1. 第一次创建订单...');
  const eventId = 'EVT-IDEM-001';
  const result1 = await eventSourcingService.appendEvent(orderId, {
    eventId,
    eventType: 'ORDER_CREATED',
    payload: {
      userId: 'USER-003',
      items: [
        {
          productId: 'PROD-003',
          productName: 'iPad Air',
          quantity: 1,
          unitPrice: 4799,
          totalPrice: 4799
        }
      ],
      totalAmount: 4799,
      shippingAddress: {
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detail: '张江高科',
        phone: '13700137000',
        name: '王五'
      },
      paymentMethod: 'WECHAT_PAY'
    }
  });
  console.log(`✅ 第一次创建成功，版本: ${result1.projection.version}`);
  console.log(`   事件 ID: ${result1.event.eventId}`);

  console.log('\n2. 使用相同 eventId 再次创建...');
  const result2 = await eventSourcingService.appendEvent(orderId, {
    eventId,
    eventType: 'ORDER_CREATED',
    payload: {
      userId: 'USER-003',
      items: [
        {
          productId: 'PROD-003',
          productName: 'iPad Air',
          quantity: 1,
          unitPrice: 4799,
          totalPrice: 4799
        }
      ],
      totalAmount: 4799,
      shippingAddress: {
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detail: '张江高科',
        phone: '13700137000',
        name: '王五'
      },
      paymentMethod: 'WECHAT_PAY'
    }
  });
  console.log(`✅ 幂等处理成功，isIdempotent: ${result2.isIdempotent}`);
  console.log(`   投影版本: ${result2.projection.version} (版本未增加)`);
  console.log(`   消息: ${result2.message}`);

  console.log('\n3. 验证最终状态...');
  const projection = await eventSourcingService.getProjection(orderId);
  console.log(`   最终版本: ${projection.version}`);
  console.log(`   当前状态: ${projection.currentStateDescription}`);
}

async function demoRebuildProjection(orderId) {
  console.log('\n1. 重建投影前查看版本...');
  const beforeProjection = await eventSourcingService.getProjection(orderId);
  console.log(`   重建前版本: ${beforeProjection.version}`);
  console.log(`   一致性检查: ${(await eventSourcingService.checkConsistency(orderId)).isConsistent}`);

  console.log('\n2. 执行重建...');
  const rebuildResult = await eventSourcingService.rebuildProjection(orderId);
  console.log(`✅ 重建完成`);
  console.log(`   处理事件数: ${rebuildResult.eventsProcessed}`);
  console.log(`   非法事件数: ${rebuildResult.invalidEvents}`);
  console.log(`   一致性: ${rebuildResult.isConsistent}`);

  console.log('\n3. 重建后查看...');
  const afterProjection = await eventSourcingService.getProjection(orderId);
  console.log(`   重建后版本: ${afterProjection.version}`);
  console.log(`   当前状态: ${afterProjection.currentStateDescription}`);

  console.log('\n4. 导出文本报告...');
  const textReport = await explanationService.exportReportAsText(orderId);
  console.log(textReport.substring(0, 500) + '...');
  console.log('   (报告已截断)');
}

runDemo();
