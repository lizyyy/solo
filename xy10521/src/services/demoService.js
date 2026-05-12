const { storage, save, ORDER_STATUS, EQUIPMENT_STATUS } = require('../utils/storage');
const equipmentService = require('./equipmentService');
const orderService = require('./orderService');
const { initializeData } = require('../utils/initializer');

async function clearAllData() {
  storage.equipment = {};
  storage.rentalOrders = {};
  storage.depositLedgers = {};
  storage.feeDetails = {};
  storage.auditLogs = [];
  storage.idempotencyKeys = {};
  storage.refundCallbacks = {};
  storage.statusHistory = {};
  await save();
  await initializeData();
  return { success: true };
}

async function runScenario(scenarioId) {
  const scenarios = {
    'normal-return': normalReturnScenario,
    'overdue-fee': overdueFeeScenario,
    'damage-fee': damageFeeScenario,
    'renew-then-return': renewThenReturnScenario,
    'duplicate-refund': duplicateRefundScenario,
    'overdue-and-damage': overdueAndDamageScenario,
    'damage-exceeds-deposit': damageExceedsDepositScenario,
    'manual-adjust': manualAdjustScenario
  };
  
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    throw new Error(`未知场景: ${scenarioId}`);
  }
  
  return await scenario();
}

async function normalReturnScenario() {
  const result = {
    scenario: 'normal-return',
    name: '正常归还',
    description: '用户按时归还设备，无损坏，全额退还押金',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示相机-正常归还',
    model: 'Demo-Normal-001',
    category: '相机',
    depositAmount: 10000,
    dailyRentalFee: 100,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 10000 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_001',
    userName: '张三',
    rentalDays: 3,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId, rentalDays: 3, status: order.status } });
  
  const freezeResult = await orderService.freezeDeposit(order.orderId, 'idempotency_freeze_normal', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: freezeResult });
  
  const returnTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const returnResult = await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idempotency_return_normal'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '归还设备(按时)', data: returnResult });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'GOOD',
    damageItems: [],
    notes: '设备完好',
    idempotencyKey: 'idempotency_assess_normal'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损(无损坏)', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_normal_001'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '退款', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    depositFrozen: detail.ledger.totalFrozen,
    depositRefunded: detail.ledger.totalRefunded,
    totalOverdueFee: detail.fees.totalOverdueFee,
    totalDamageFee: detail.fees.totalDamageFee,
    refundAmount: refundResult.refundCalculation?.refundAmount,
    statusHistoryCount: detail.order.statusHistory.length,
    auditLogCount: detail.auditTimeline.length
  };
  
  return result;
}

async function overdueFeeScenario() {
  const result = {
    scenario: 'overdue-fee',
    name: '逾期扣费',
    description: '用户逾期归还，计算逾期费用后退还剩余押金',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示镜头-逾期归还',
    model: 'Demo-Overdue-001',
    category: '镜头',
    depositAmount: 5000,
    dailyRentalFee: 50,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 5000, dailyRate: 50 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_002',
    userName: '李四',
    rentalDays: 2,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId, rentalDays: 2 } });
  
  await orderService.freezeDeposit(order.orderId, 'idempotency_freeze_overdue', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 5000 } });
  
  const returnTime = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const returnResult = await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idempotency_return_overdue'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '逾期归还(逾期2天)', data: returnResult });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'GOOD',
    damageItems: [],
    idempotencyKey: 'idempotency_assess_overdue'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损(无损坏)', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_overdue_001'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '退款(扣除逾期费)', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    depositFrozen: detail.ledger.totalFrozen,
    totalOverdueFee: detail.fees.totalOverdueFee,
    depositRefunded: detail.ledger.totalRefunded,
    expectedCalculation: `50元/天 × 1.5倍 × 2天 = 150元逾期费, 应退 5000 - 150 = 4850元`,
    actualRefunded: detail.ledger.totalRefunded
  };
  
  return result;
}

async function damageFeeScenario() {
  const result = {
    scenario: 'damage-fee',
    name: '损坏扣费',
    description: '用户按时归还但设备损坏，扣除损坏赔偿费后退还押金',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示三脚架-损坏',
    model: 'Demo-Damage-001',
    category: '配件',
    depositAmount: 3000,
    dailyRentalFee: 30,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 3000 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_003',
    userName: '王五',
    rentalDays: 3,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId } });
  
  await orderService.freezeDeposit(order.orderId, 'idempotency_freeze_damage', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 3000 } });
  
  const returnTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idempotency_return_damage'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '按时归还', data: { onTime: true } });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'DAMAGED',
    damageItems: [
      { description: '脚架腿划痕', amount: 200 },
      { description: '云台旋钮损坏', amount: 300 }
    ],
    notes: '轻微损坏，需要维修',
    idempotencyKey: 'idempotency_assess_damage'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损(2处损坏，共500元)', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_damage_001'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '退款(扣除损坏费)', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    depositFrozen: detail.ledger.totalFrozen,
    totalDamageFee: detail.fees.totalDamageFee,
    depositRefunded: detail.ledger.totalRefunded,
    expectedCalculation: `押金3000元 - 损坏费500元 = 应退2500元`,
    actualRefunded: detail.ledger.totalRefunded
  };
  
  return result;
}

async function renewThenReturnScenario() {
  const result = {
    scenario: 'renew-then-return',
    name: '续租后归还',
    description: '用户续租后归还，延长到期日，按时归还',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示相机-续租',
    model: 'Demo-Renew-001',
    category: '相机',
    depositAmount: 8000,
    dailyRentalFee: 150,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 8000 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_004',
    userName: '赵六',
    rentalDays: 2,
    startTime: now.toISOString()
  }, 'demo_operator');
  const originalDueTime = order.dueTime;
  result.steps.push({ step: 2, action: '创建订单(2天)', data: { orderId: order.orderId, originalDueTime } });
  
  await orderService.freezeDeposit(order.orderId, 'idempotency_freeze_renew', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 8000 } });
  
  const renewResult = await orderService.renewOrder(order.orderId, {
    renewDays: 3,
    idempotencyKey: 'idempotency_renew_1'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '续租3天', data: renewResult });
  
  const renewResult2 = await orderService.renewOrder(order.orderId, {
    renewDays: 2,
    idempotencyKey: 'idempotency_renew_2'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '再续租2天(累计7天)', data: renewResult2 });
  
  const returnTime = new Date(new Date(order.dueTime).getTime() - 1 * 24 * 60 * 60 * 1000);
  const returnResult = await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idempotency_return_renew'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '归还(在续租后的到期日之前)', data: returnResult });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'GOOD',
    damageItems: [],
    idempotencyKey: 'idempotency_assess_renew'
  }, 'demo_operator');
  result.steps.push({ step: 7, action: '定损', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_renew_001'
  }, 'demo_operator');
  result.steps.push({ step: 8, action: '退款(全额)', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    originalRentalDays: 2,
    totalRentalDays: detail.order.totalRentalDays,
    renewCount: detail.order.renewCount,
    depositFrozen: detail.ledger.totalFrozen,
    depositRefunded: detail.ledger.totalRefunded,
    overdueFee: detail.fees.totalOverdueFee,
    statusHistoryCount: detail.order.statusHistory.length
  };
  
  return result;
}

async function duplicateRefundScenario() {
  const result = {
    scenario: 'duplicate-refund',
    name: '重复退款',
    description: '演示幂等性，重复调用退款接口不会重复退款',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示相机-幂等性',
    model: 'Demo-Idempotency-001',
    category: '相机',
    depositAmount: 6000,
    dailyRentalFee: 100,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_005',
    userName: '钱七',
    rentalDays: 2,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId } });
  
  await orderService.freezeDeposit(order.orderId, 'idem_freeze_dup', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 6000 } });
  
  const returnTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idem_return_dup'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '归还', data: {} });
  
  await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'GOOD',
    damageItems: [],
    idempotencyKey: 'idem_assess_dup'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损', data: {} });
  
  const refundId = 'same_refund_id_12345';
  
  const refund1 = await orderService.processRefund(order.orderId, {
    refundId: refundId
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '第一次退款', data: refund1 });
  
  const refund2 = await orderService.processRefund(order.orderId, {
    refundId: refundId
  }, 'demo_operator');
  result.steps.push({ step: 7, action: '第二次退款(相同refundId，幂等)', data: refund2 });
  
  const refund3 = await orderService.processRefund(order.orderId, {
    refundId: refundId
  }, 'demo_operator');
  result.steps.push({ step: 8, action: '第三次退款(相同refundId，幂等)', data: refund3 });
  
  const callback1 = await orderService.handleRefundCallback({
    refundId: refundId,
    orderId: order.orderId,
    status: 'SUCCESS',
    reference: 'REF_001'
  });
  result.steps.push({ step: 9, action: '第一次退款回调', data: callback1 });
  
  const callback2 = await orderService.handleRefundCallback({
    refundId: refundId,
    orderId: order.orderId,
    status: 'SUCCESS',
    reference: 'REF_001'
  });
  result.steps.push({ step: 10, action: '第二次退款回调(幂等)', data: callback2 });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    totalDepositFrozen: detail.ledger.totalFrozen,
    totalRefunded: detail.ledger.totalRefunded,
    refundTransactionCount: detail.ledger.transactions.filter(t => t.type === 'REFUND').length,
    expectedResult: '只应有1次退款交易，总退款金额=押金6000元',
    idempotencyVerified: detail.ledger.transactions.filter(t => t.type === 'REFUND').length === 1 && detail.ledger.totalRefunded === 6000
  };
  
  return result;
}

async function overdueAndDamageScenario() {
  const result = {
    scenario: 'overdue-and-damage',
    name: '逾期+损坏同时存在',
    description: '用户逾期且设备损坏，同时扣除两部分费用',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示相机-逾期+损坏',
    model: 'Demo-Both-001',
    category: '相机',
    depositAmount: 12000,
    dailyRentalFee: 200,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 12000 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_006',
    userName: '孙八',
    rentalDays: 3,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单(3天)', data: { orderId: order.orderId } });
  
  await orderService.freezeDeposit(order.orderId, 'idem_freeze_both', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 12000 } });
  
  const returnTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const returnResult = await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idem_return_both'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '逾期2天归还', data: returnResult });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'DAMAGED',
    damageItems: [
      { description: '镜头划痕', amount: 800 },
      { description: '机身磕碰', amount: 400 }
    ],
    idempotencyKey: 'idem_assess_both'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损(1200元)', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_both_001'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '退款(扣除两部分费用)', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  const expectedOverdue = 200 * 1.5 * 2;
  const expectedDamage = 1200;
  const totalDeduction = expectedOverdue + expectedDamage;
  const expectedRefund = 12000 - totalDeduction;
  
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    depositFrozen: detail.ledger.totalFrozen,
    totalOverdueFee: detail.fees.totalOverdueFee,
    totalDamageFee: detail.fees.totalDamageFee,
    totalDeduction: detail.fees.totalOverdueFee + detail.fees.totalDamageFee,
    depositRefunded: detail.ledger.totalRefunded,
    expectedCalculation: `押金12000元 - 逾期费(${expectedOverdue}元) - 损坏费(${expectedDamage}元) = 应退${expectedRefund}元`,
    actualRefunded: detail.ledger.totalRefunded,
    verified: detail.ledger.totalRefunded === expectedRefund
  };
  
  return result;
}

async function damageExceedsDepositScenario() {
  const result = {
    scenario: 'damage-exceeds-deposit',
    name: '损坏费用超过押金',
    description: '损坏费用超过押金金额，押金全部扣除',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示设备-高额损坏',
    model: 'Demo-Exceed-001',
    category: '精密仪器',
    depositAmount: 5000,
    dailyRentalFee: 100,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId, deposit: 5000 } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_007',
    userName: '周九',
    rentalDays: 1,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId } });
  
  await orderService.freezeDeposit(order.orderId, 'idem_freeze_exceed', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 5000 } });
  
  const returnTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  await orderService.returnEquipment(order.orderId, {
    returnTime: returnTime.toISOString(),
    idempotencyKey: 'idem_return_exceed'
  }, 'demo_operator');
  result.steps.push({ step: 4, action: '按时归还', data: {} });
  
  const assessResult = await orderService.assessDamage(order.orderId, {
    assessor: 'demo_operator',
    overallStatus: 'DAMAGED',
    damageItems: [
      { description: '核心部件损坏', amount: 4000 },
      { description: '外壳破损', amount: 1500 }
    ],
    notes: '严重损坏，维修费用超过押金',
    idempotencyKey: 'idem_assess_exceed'
  }, 'demo_operator');
  result.steps.push({ step: 5, action: '定损(共5500元，超过押金)', data: assessResult });
  
  const refundResult = await orderService.processRefund(order.orderId, {
    refundId: 'refund_exceed_001'
  }, 'demo_operator');
  result.steps.push({ step: 6, action: '退款(0元)', data: refundResult });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    equipmentStatus: detail.equipment.status,
    depositFrozen: detail.ledger.totalFrozen,
    totalDamageFee: detail.fees.totalDamageFee,
    totalDeducted: detail.ledger.totalDeducted,
    depositRefunded: detail.ledger.totalRefunded,
    damageExceedsDeposit: detail.fees.totalDamageFee > detail.ledger.totalFrozen,
    expectedResult: '押金5000元全部扣除，退款0元',
    verified: detail.ledger.totalRefunded === 0
  };
  
  return result;
}

async function manualAdjustScenario() {
  const result = {
    scenario: 'manual-adjust',
    name: '人工修正',
    description: '演示人工修正功能，记录前后差异和操作者',
    steps: [],
    finalState: {}
  };
  
  const equipment = await equipmentService.createEquipment({
    name: '演示相机-人工修正',
    model: 'Demo-Manual-001',
    category: '相机',
    depositAmount: 9000,
    dailyRentalFee: 150,
    overdueDailyRate: 1.5
  }, 'demo_operator');
  result.steps.push({ step: 1, action: '创建设备', data: { equipmentId: equipment.equipmentId } });
  
  const now = new Date();
  const order = await orderService.createRentalOrder({
    equipmentId: equipment.equipmentId,
    userId: 'USER_008',
    userName: '吴十',
    rentalDays: 2,
    startTime: now.toISOString()
  }, 'demo_operator');
  result.steps.push({ step: 2, action: '创建订单', data: { orderId: order.orderId } });
  
  await orderService.freezeDeposit(order.orderId, 'idem_freeze_manual', 'demo_operator');
  result.steps.push({ step: 3, action: '冻结押金', data: { frozen: 9000 } });
  
  const adjustResult = await orderService.manualAdjust(order.orderId, {
    adjustDeposit: -500,
    reason: '老客户优惠，减免500元押金',
    newStatus: null
  }, 'admin_manager_001');
  result.steps.push({ step: 4, action: '人工修正押金(-500元)，操作者: admin_manager_001', data: adjustResult });
  
  const adjustResult2 = await orderService.manualAdjust(order.orderId, {
    adjustFees: [
      { type: 'DAMAGE', amount: 300, description: '预扣除损坏赔偿' }
    ],
    reason: '提前扣除预估损坏费用',
    newStatus: null
  }, 'admin_manager_002');
  result.steps.push({ step: 5, action: '人工修正费用(+300元)，操作者: admin_manager_002', data: adjustResult2 });
  
  const detail = await orderService.getOrderDetail(order.orderId);
  result.finalState = {
    orderStatus: detail.order.status,
    depositFrozen: detail.ledger.totalFrozen,
    totalManualAdjust: detail.ledger.totalManualAdjust,
    totalDamageFee: detail.fees.totalDamageFee,
    auditLogs: detail.auditTimeline.filter(l => l.action === 'MANUAL_ADJUST').length,
    operators: [...new Set(detail.auditTimeline.filter(l => l.action === 'MANUAL_ADJUST').map(l => l.operator))],
    expectedResult: '应看到2条人工修正记录，分别由不同操作者执行'
  };
  
  return result;
}

module.exports = {
  runScenario,
  clearAllData,
  normalReturnScenario,
  overdueFeeScenario,
  damageFeeScenario,
  renewThenReturnScenario,
  duplicateRefundScenario,
  overdueAndDamageScenario,
  damageExceedsDepositScenario,
  manualAdjustScenario
};