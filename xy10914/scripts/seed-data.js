const { initializeDatabase } = require('../src/database');
const baseService = require('../src/services/baseService');
const exceptionService = require('../src/services/exceptionService');
const reassignmentService = require('../src/services/reassignmentService');
const evidenceService = require('../src/services/evidenceService');
const arbitrationService = require('../src/services/arbitrationService');

async function seedData() {
  console.log('开始初始化样例数据...');
  
  await initializeDatabase();
  
  const riders = [
    { name: '张三', phone: '13800138001', station: '朝阳站' },
    { name: '李四', phone: '13800138002', station: '海淀站' },
    { name: '王五', phone: '13800138003', station: '西城站' },
    { name: '赵六', phone: '13800138004', station: '东城站' },
    { name: '钱七', phone: '13800138005', station: '丰台站' }
  ];
  
  console.log('创建骑手数据...');
  const createdRiders = [];
  for (const rider of riders) {
    const result = await baseService.createRider(rider.name, rider.phone, rider.station);
    createdRiders.push(result);
    console.log(`  已创建骑手: ${result.name} (${result.rider_no})`);
  }
  
  const exceptionTypes = [
    { code: 'MEAL_SHORTAGE', name: '少餐', description: '商家漏餐或餐品缺失', category: 'food_issue', severity: 'normal', requiresEvidence: true },
    { code: 'DELAY_DELIVERY', name: '超时', description: '配送超时未送达', category: 'delivery_issue', severity: 'high', requiresEvidence: false },
    { code: 'RIDER_REASSIGN', name: '改派', description: '骑手申请订单改派', category: 'rider_issue', severity: 'normal', requiresEvidence: false },
    { code: 'FOOD_DAMAGE', name: '餐品损坏', description: '餐品在配送途中损坏', category: 'food_issue', severity: 'high', requiresEvidence: true },
    { code: 'WRONG_ADDRESS', name: '地址错误', description: '用户地址错误无法配送', category: 'user_issue', severity: 'normal', requiresEvidence: false },
    { code: 'BAD_WEATHER', name: '恶劣天气', description: '因恶劣天气导致配送延误', category: 'force_majeure', severity: 'low', requiresEvidence: false },
    { code: 'TRAFFIC_ACCIDENT', name: '交通事故', description: '骑手发生交通事故', category: 'rider_issue', severity: 'critical', requiresEvidence: true },
    { code: 'SYSTEM_ERROR', name: '系统异常', description: '派单系统或APP异常', category: 'system_issue', severity: 'high', requiresEvidence: false }
  ];
  
  console.log('\n创建异常类型数据...');
  const createdExceptionTypes = [];
  for (const et of exceptionTypes) {
    const result = await baseService.createExceptionType(
      et.code, et.name, et.description, et.category, et.severity, et.requiresEvidence
    );
    createdExceptionTypes.push(result);
    console.log(`  已创建异常类型: ${result.name} (${result.code})`);
  }
  
  const now = new Date();
  const orders = [
    { 
      orderNo: 'ORD202401001', 
      customerName: '王先生', 
      customerPhone: '13900139001', 
      deliveryAddress: '北京市朝阳区建国路88号', 
      restaurantName: '肯德基(国贸店)', 
      orderAmount: 45.5,
      promisedDeliveryTime: new Date(now.getTime() - 30 * 60000).toISOString()
    },
    { 
      orderNo: 'ORD202401002', 
      customerName: '李女士', 
      customerPhone: '13900139002', 
      deliveryAddress: '北京市海淀区中关村大街1号', 
      restaurantName: '麦当劳(中关村店)', 
      orderAmount: 68.0,
      promisedDeliveryTime: new Date(now.getTime() - 45 * 60000).toISOString()
    },
    { 
      orderNo: 'ORD202401003', 
      customerName: '张先生', 
      customerPhone: '13900139003', 
      deliveryAddress: '北京市西城区金融街1号', 
      restaurantName: '必胜客(金融街店)', 
      orderAmount: 128.5,
      promisedDeliveryTime: new Date(now.getTime() - 20 * 60000).toISOString()
    },
    { 
      orderNo: 'ORD202401004', 
      customerName: '刘女士', 
      customerPhone: '13900139004', 
      deliveryAddress: '北京市东城区王府井大街1号', 
      restaurantName: '海底捞(王府井店)', 
      orderAmount: 256.0,
      promisedDeliveryTime: new Date(now.getTime() - 60 * 60000).toISOString()
    },
    { 
      orderNo: 'ORD202401005', 
      customerName: '陈先生', 
      customerPhone: '13900139005', 
      deliveryAddress: '北京市丰台区南三环西路1号', 
      restaurantName: '真功夫(丰台店)', 
      orderAmount: 35.0,
      promisedDeliveryTime: new Date(now.getTime() - 15 * 60000).toISOString()
    }
  ];
  
  console.log('\n创建订单数据...');
  const createdOrders = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const result = await baseService.createOrder(
      order.orderNo,
      createdRiders[i % createdRiders.length].id,
      order.customerName,
      order.customerPhone,
      order.deliveryAddress,
      order.restaurantName,
      order.orderAmount,
      order.promisedDeliveryTime
    );
    createdOrders.push(result);
    console.log(`  已创建订单: ${result.order_no} - ${result.restaurant_name}`);
  }
  
  console.log('\n创建异常单数据...');
  
  const mealShortageType = createdExceptionTypes.find(et => et.code === 'MEAL_SHORTAGE');
  const delayType = createdExceptionTypes.find(et => et.code === 'DELAY_DELIVERY');
  const reassignmentType = createdExceptionTypes.find(et => et.code === 'RIDER_REASSIGN');
  const damageType = createdExceptionTypes.find(et => et.code === 'FOOD_DAMAGE');
  
  const exc1 = await exceptionService.createExceptionRecord(
    createdOrders[0].id,
    createdRiders[0].id,
    mealShortageType.id,
    '商家只打包了主食，饮料和小吃未放入袋中，客户现场拒收',
    { reportSource: 'rider_app', reportedVia: 'mobile' }
  );
  console.log(`  已创建异常单1: 少餐 - ${exc1.exception_no}`);
  
  const exc2 = await exceptionService.createExceptionRecord(
    createdOrders[1].id,
    createdRiders[1].id,
    delayType.id,
    '因道路严重拥堵，预计延误30分钟以上送达',
    { reportSource: 'system_auto', trafficInfo: '北四环严重拥堵' }
  );
  console.log(`  已创建异常单2: 超时 - ${exc2.exception_no}`);
  
  const exc3 = await exceptionService.createExceptionRecord(
    createdOrders[2].id,
    createdRiders[2].id,
    reassignmentType.id,
    '骑手电动车电量不足，无法完成该远距离订单配送',
    { reportSource: 'rider_app', batteryLevel: '15%' }
  );
  console.log(`  已创建异常单3: 改派 - ${exc3.exception_no}`);
  
  const exc4 = await exceptionService.createExceptionRecord(
    createdOrders[3].id,
    createdRiders[3].id,
    damageType.id,
    '配送途中汤品洒漏，餐品包装严重损坏',
    { reportSource: 'customer_call', customerSatisfaction: 'dissatisfied' }
  );
  console.log(`  已创建异常单4: 餐品损坏 - ${exc4.exception_no}`);
  
  console.log('\n创建改派记录...');
  const reassignment1 = await reassignmentService.createReassignment(
    exc3.id,
    createdRiders[2].id,
    '电动车电量不足，请求改派给附近骑手',
    { requestTime: new Date().toISOString(), reasonCategory: 'vehicle_issue' }
  );
  console.log(`  已创建改派申请: ${reassignment1.reassignment_no}`);
  
  await reassignmentService.processReassignment(
    reassignment1.id,
    createdRiders[4].id,
    'approved',
    'station_manager_01',
    '已改派给钱七，该骑手距离取餐点更近',
    { processedAt: new Date().toISOString() }
  );
  console.log(`  改派已处理: 已分配给钱七`);
  
  console.log('\n上传申诉证据...');
  const evidence1 = await evidenceService.uploadEvidence(
    exc4.id,
    createdRiders[3].id,
    'image',
    'https://example.com/evidence/damage_001.jpg',
    '餐品洒漏现场照片，汤洒了约三分之二',
    { uploadDevice: 'iPhone 14', uploadLocation: '39.9042° N, 116.4074° E' }
  );
  console.log(`  已上传证据: ${evidence1.evidence_no}`);
  
  const evidence2 = await evidenceService.uploadEvidence(
    exc1.id,
    createdRiders[0].id,
    'image',
    'https://example.com/evidence/shortage_001.jpg',
    '餐袋内实物与订单对比照片，缺少可乐和薯条',
    { uploadDevice: 'Huawei Mate 60', uploadLocation: '39.9142° N, 116.4174° E' }
  );
  console.log(`  已上传证据: ${evidence2.evidence_no}`);
  
  await evidenceService.verifyEvidence(
    evidence2.id,
    true,
    'audit_staff_01',
    { verifiedAt: new Date().toISOString() }
  );
  console.log(`  证据已审核通过`);
  
  console.log('\n创建仲裁结果...');
  const arbitration1 = await arbitrationService.createArbitration(
    exc4.id,
    'arbitrator_zhang',
    'sustained',
    '经核查，骑手在配送过程中存在操作不当，导致汤品洒漏。根据平台规则，对骑手进行50元罚款处罚。',
    'fine',
    50.0,
    { evidenceReviewed: true, penaltyPolicy: 'version_2.4' }
  );
  console.log(`  已创建仲裁: ${arbitration1.arbitration_no} - 申诉成立`);
  
  const arbitration2 = await arbitrationService.createArbitration(
    exc1.id,
    'arbitrator_li',
    'dismissed',
    '经核查，少餐责任在商家，骑手在取餐时已核对但商家漏装。骑手申诉成立，免除处罚。',
    'none',
    0,
    { evidenceReviewed: true, merchantLiable: true }
  );
  console.log(`  已创建仲裁: ${arbitration2.arbitration_no} - 申诉驳回`);
  
  await arbitrationService.finalizeArbitration(
    arbitration2.id,
    'arbitrator_li',
    { finalizedAt: new Date().toISOString() }
  );
  console.log(`  仲裁已生效，异常单已关闭`);
  
  console.log('\n人工修正示例...');
  await arbitrationService.manualCorrection(
    exc2.id,
    'supervisor_wang',
    '核实道路实时路况，确认为重大交通事故导致拥堵，属于不可抗力因素',
    'force_majeure_exempt',
    { correctionTime: new Date().toISOString(), trafficReportRef: 'TR20240115001' }
  );
  console.log(`  异常单已人工修正: 状态变更为不可抗力免责`);
  
  console.log('\n============================================');
  console.log('样例数据初始化完成！');
  console.log('============================================');
  console.log(`
统计摘要:
- 骑手数量: ${createdRiders.length}
- 异常类型: ${createdExceptionTypes.length}
- 订单数量: ${createdOrders.length}
- 异常单数量: 4
- 改派记录: 1
- 申诉证据: 2
- 仲裁结果: 2
  `);
  
  process.exit(0);
}

seedData().catch(error => {
  console.error('样例数据初始化失败:', error);
  process.exit(1);
});
