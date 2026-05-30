const { getDb, initDatabase } = require('../src/db/connection');
const importService = require('../src/services/importService');
const stateMachine = require('../src/services/stateMachine');
const expenseAllocator = require('../src/services/expenseAllocator');

const members = [
  { member_id: 'MEM001', name: '张明', role: '主唱', phone: '13800138001', email: 'zhangming@band.com' },
  { member_id: 'MEM002', name: '李华', role: '吉他手', phone: '13800138002', email: 'lihua@band.com' },
  { member_id: 'MEM003', name: '王芳', role: '鼓手', phone: '13800138003', email: 'wangfang@band.com' },
  { member_id: 'MEM004', name: '赵强', role: '贝斯手', phone: '13800138004', email: 'zhaoqiang@band.com' },
  { member_id: 'MEM005', name: '陈静', role: '键盘手', phone: '13800138005', email: 'chenjing@band.com' }
];

const equipment = [
  { equipment_id: 'EQP001', name: '主扩声音箱', category: 'SPEAKER', brand: 'JBL', model: 'SRX815', hourly_rate: 80, deposit_amount: 500, description: '15寸有源主音箱' },
  { equipment_id: 'EQP002', name: '返听音箱', category: 'SPEAKER', brand: 'Yamaha', model: 'SM12V', hourly_rate: 50, deposit_amount: 300, description: '12寸返听音箱' },
  { equipment_id: 'EQP003', name: '架子鼓套装', category: 'DRUM_KIT', brand: 'Pearl', model: 'Export EXX', hourly_rate: 120, deposit_amount: 1000, description: '5鼓3镲全套' },
  { equipment_id: 'EQP004', name: '动圈话筒', category: 'MICROPHONE', brand: 'Shure', model: 'SM58', hourly_rate: 30, deposit_amount: 200, description: '人声动圈话筒' },
  { equipment_id: 'EQP005', name: '电容话筒', category: 'MICROPHONE', brand: 'AKG', model: 'C414', hourly_rate: 60, deposit_amount: 800, description: '大振膜电容话筒' },
  { equipment_id: 'EQP006', name: '吉他音箱', category: 'AMPLIFIER', brand: 'Marshall', model: 'DSL40CR', hourly_rate: 70, deposit_amount: 600, description: '40W吉他音箱' },
  { equipment_id: 'EQP007', name: '贝斯音箱', category: 'AMPLIFIER', brand: 'Ampeg', model: 'BA-115', hourly_rate: 60, deposit_amount: 500, description: '150W贝斯音箱' }
];

const orderNormal = {
  order_id: 'ORD20250501',
  order_date: '2025-05-01T09:00:00Z',
  start_date: '2025-05-01T10:00:00Z',
  end_date: '2025-05-01T18:00:00Z',
  remarks: '5月1日日常排练',
  items: [
    {
      item_id: 'ITEM001',
      equipment_id: 'EQP003',
      planned_start_date: '2025-05-01T10:00:00Z',
      planned_end_date: '2025-05-01T18:00:00Z',
      actual_start_date: '2025-05-01T10:00:00Z',
      actual_end_date: '2025-05-01T18:00:00Z',
      hourly_rate: 120,
      deposit_amount: 1000,
      usage_records: [
        { usage_id: 'USG001', member_id: 'MEM003', start_time: '2025-05-01T10:00:00Z', end_time: '2025-05-01T14:00:00Z' },
        { usage_id: 'USG002', member_id: 'MEM003', start_time: '2025-05-01T15:00:00Z', end_time: '2025-05-01T18:00:00Z' }
      ]
    },
    {
      item_id: 'ITEM002',
      equipment_id: 'EQP001',
      planned_start_date: '2025-05-01T10:00:00Z',
      planned_end_date: '2025-05-01T18:00:00Z',
      actual_start_date: '2025-05-01T10:00:00Z',
      actual_end_date: '2025-05-01T18:00:00Z',
      hourly_rate: 80,
      deposit_amount: 500,
      usage_records: [
        { usage_id: 'USG003', member_id: 'MEM001', start_time: '2025-05-01T10:00:00Z', end_time: '2025-05-01T12:00:00Z' },
        { usage_id: 'USG004', member_id: 'MEM002', start_time: '2025-05-01T13:00:00Z', end_time: '2025-05-01T15:00:00Z' },
        { usage_id: 'USG005', member_id: 'MEM004', start_time: '2025-05-01T15:00:00Z', end_time: '2025-05-01T18:00:00Z' }
      ]
    },
    {
      item_id: 'ITEM003',
      equipment_id: 'EQP004',
      planned_start_date: '2025-05-01T10:00:00Z',
      planned_end_date: '2025-05-01T18:00:00Z',
      actual_start_date: '2025-05-01T10:00:00Z',
      actual_end_date: '2025-05-01T18:00:00Z',
      hourly_rate: 30,
      deposit_amount: 200,
      usage_records: [
        { usage_id: 'USG006', member_id: 'MEM001', start_time: '2025-05-01T10:00:00Z', end_time: '2025-05-01T18:00:00Z' }
      ]
    }
  ]
};

const orderDepositMissing = {
  order_id: 'ORD20250415',
  order_date: '2025-04-15T09:00:00Z',
  start_date: '2025-04-15T10:00:00Z',
  end_date: '2025-04-15T20:00:00Z',
  remarks: '4月15日演出彩排',
  items: [
    {
      item_id: 'ITEM004',
      equipment_id: 'EQP006',
      planned_start_date: '2025-04-15T10:00:00Z',
      planned_end_date: '2025-04-15T20:00:00Z',
      actual_start_date: '2025-04-15T10:00:00Z',
      actual_end_date: '2025-04-15T20:00:00Z',
      hourly_rate: 70,
      deposit_amount: 600,
      usage_records: [
        { usage_id: 'USG007', member_id: 'MEM002', start_time: '2025-04-15T10:00:00Z', end_time: '2025-04-15T20:00:00Z' }
      ]
    },
    {
      item_id: 'ITEM005',
      equipment_id: 'EQP007',
      planned_start_date: '2025-04-15T10:00:00Z',
      planned_end_date: '2025-04-15T20:00:00Z',
      actual_start_date: '2025-04-15T10:00:00Z',
      actual_end_date: '2025-04-15T20:00:00Z',
      hourly_rate: 60,
      deposit_amount: 500,
      usage_records: [
        { usage_id: 'USG008', member_id: 'MEM004', start_time: '2025-04-15T10:00:00Z', end_time: '2025-04-15T20:00:00Z' }
      ]
    }
  ]
};

const orderOverlap = {
  order_id: 'ORD20250420',
  order_date: '2025-04-20T09:00:00Z',
  start_date: '2025-04-20T14:00:00Z',
  end_date: '2025-04-20T22:00:00Z',
  remarks: '4月20日新歌排练 - 存在使用时长重叠',
  items: [
    {
      item_id: 'ITEM006',
      equipment_id: 'EQP004',
      planned_start_date: '2025-04-20T14:00:00Z',
      planned_end_date: '2025-04-20T22:00:00Z',
      actual_start_date: '2025-04-20T14:00:00Z',
      actual_end_date: '2025-04-20T22:00:00Z',
      hourly_rate: 30,
      deposit_amount: 200,
      usage_records: [
        { usage_id: 'USG009', member_id: 'MEM001', start_time: '2025-04-20T15:00:00Z', end_time: '2025-04-20T17:00:00Z' },
        { usage_id: 'USG010', member_id: 'MEM005', start_time: '2025-04-20T16:30:00Z', end_time: '2025-04-20T18:30:00Z' },
        { usage_id: 'USG011', member_id: 'MEM002', start_time: '2025-04-20T19:00:00Z', end_time: '2025-04-20T21:00:00Z' }
      ]
    },
    {
      item_id: 'ITEM007',
      equipment_id: 'EQP005',
      planned_start_date: '2025-04-20T14:00:00Z',
      planned_end_date: '2025-04-20T22:00:00Z',
      actual_start_date: '2025-04-20T14:00:00Z',
      actual_end_date: '2025-04-20T22:00:00Z',
      hourly_rate: 60,
      deposit_amount: 800,
      usage_records: [
        { usage_id: 'USG012', member_id: 'MEM005', start_time: '2025-04-20T14:00:00Z', end_time: '2025-04-20T16:00:00Z' },
        { usage_id: 'USG013', member_id: 'MEM001', start_time: '2025-04-20T17:00:00Z', end_time: '2025-04-20T19:00:00Z' }
      ]
    }
  ]
};

const orderDamageUnallocated = {
  order_id: 'ORD20250410',
  order_date: '2025-04-10T09:00:00Z',
  start_date: '2025-04-10T10:00:00Z',
  end_date: '2025-04-10T23:00:00Z',
  remarks: '4月10日小型演出 - 设备损坏',
  items: [
    {
      item_id: 'ITEM008',
      equipment_id: 'EQP002',
      planned_start_date: '2025-04-10T10:00:00Z',
      planned_end_date: '2025-04-10T23:00:00Z',
      actual_start_date: '2025-04-10T10:00:00Z',
      actual_end_date: '2025-04-10T23:00:00Z',
      hourly_rate: 50,
      deposit_amount: 300,
      usage_records: [
        { usage_id: 'USG014', member_id: 'MEM001', start_time: '2025-04-10T19:00:00Z', end_time: '2025-04-10T22:00:00Z' },
        { usage_id: 'USG015', member_id: 'MEM002', start_time: '2025-04-10T15:00:00Z', end_time: '2025-04-10T18:00:00Z' }
      ]
    },
    {
      item_id: 'ITEM009',
      equipment_id: 'EQP003',
      planned_start_date: '2025-04-10T10:00:00Z',
      planned_end_date: '2025-04-10T23:00:00Z',
      actual_start_date: '2025-04-10T10:00:00Z',
      actual_end_date: '2025-04-10T23:00:00Z',
      hourly_rate: 120,
      deposit_amount: 1000,
      usage_records: [
        { usage_id: 'USG016', member_id: 'MEM003', start_time: '2025-04-10T19:00:00Z', end_time: '2025-04-10T22:30:00Z' }
      ]
    }
  ],
  damages: [
    {
      damage_id: 'DMG001',
      equipment_id: 'EQP002',
      damage_description: '返听音箱喇叭纸盆破裂，搬运时不慎磕碰',
      repair_cost: 350,
      reported_by: 'MEM004',
      reported_at: '2025-04-10T23:30:00Z'
    },
    {
      damage_id: 'DMG002',
      equipment_id: 'EQP003',
      damage_description: '军鼓鼓皮破裂，演奏时损坏',
      repair_cost: 180,
      reported_by: 'MEM003',
      reported_at: '2025-04-10T22:45:00Z'
    }
  ]
};

const seed = async () => {
  console.log('开始初始化样例数据...');
  
  await initDatabase();
  const db = await getDb();

  await db.exec(`
    DELETE FROM expense_allocations;
    DELETE FROM usage_records;
    DELETE FROM deposits;
    DELETE FROM damage_records;
    DELETE FROM rental_items;
    DELETE FROM rental_orders;
    DELETE FROM equipment;
    DELETE FROM members;
    DELETE FROM batch_records;
    DELETE FROM state_transitions;
    DELETE FROM anomalies;
  `);
  console.log('已清空原有数据');

  const memberResult = await importService.importMembers(members, { description: '初始化乐队成员数据' });
  console.log(`成员导入: 成功 ${memberResult.success} 条, 失败 ${memberResult.failed} 条, 批次: ${memberResult.batchId}`);

  const equipResult = await importService.importEquipment(equipment, { description: '初始化设备清单' });
  console.log(`设备导入: 成功 ${equipResult.success} 条, 失败 ${equipResult.failed} 条, 批次: ${equipResult.batchId}`);

  const normalResult = await importService.importRentalOrders([orderNormal], { description: '正常结算单 - 5月1日排练' });
  console.log(`正常订单导入: 成功 ${normalResult.success} 条, 批次: ${normalResult.batchId}`);

  const depositResult = await importService.importRentalOrders([orderDepositMissing], { description: '押金漏退场景 - 4月15日彩排' });
  console.log(`押金漏退订单导入: 成功 ${depositResult.success} 条, 批次: ${depositResult.batchId}`);

  const overlapResult = await importService.importRentalOrders([orderOverlap], { description: '时长重叠场景 - 4月20日排练' });
  console.log(`时长重叠订单导入: 成功 ${overlapResult.success} 条, 批次: ${overlapResult.batchId}`);

  const damageResult = await importService.importRentalOrders([orderDamageUnallocated], { description: '损坏未分摊场景 - 4月10日演出' });
  console.log(`损坏未分摊订单导入: 成功 ${damageResult.success} 条, 批次: ${damageResult.batchId}`);

  console.log('\n开始处理状态流转...');
  
  await stateMachine.transitionRentalOrder('ORD20250501', 'CONFIRMED', '确认租赁', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250501', 'IN_USE', '开始使用', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250501', 'RETURNED', '设备归还，检查正常', 'admin');
  
  await stateMachine.transitionRentalOrder('ORD20250415', 'CONFIRMED', '确认租赁', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250415', 'IN_USE', '开始使用', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250415', 'RETURNED', '设备归还', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250415', 'SETTLED', '费用已结算', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250415', 'CLOSED', '订单关闭 - 押金漏退未处理', 'admin');
  
  await stateMachine.transitionRentalOrder('ORD20250420', 'CONFIRMED', '确认租赁', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250420', 'IN_USE', '开始使用', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250420', 'RETURNED', '设备归还 - 存在使用时长重叠', 'admin');
  
  await stateMachine.transitionRentalOrder('ORD20250410', 'CONFIRMED', '确认租赁', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250410', 'IN_USE', '开始使用', 'admin');
  await stateMachine.transitionRentalOrder('ORD20250410', 'RETURNED', '设备归还，发现损坏', 'admin');
  
  console.log('状态流转完成');

  console.log('\n开始费用分摊...');
  const allocResult1 = await expenseAllocator.runAllocation('ORD20250501', { damageAllocBasis: 'EQUAL' });
  console.log(`订单 ORD20250501 分摊完成: 租赁费 ¥${allocResult1.allocationSummary.totals.rental_total.toFixed(2)}, 异常数: ${allocResult1.anomalyCount}`);

  const allocResult2 = await expenseAllocator.runAllocation('ORD20250420', { damageAllocBasis: 'EQUAL' });
  console.log(`订单 ORD20250420 分摊完成: 租赁费 ¥${allocResult2.allocationSummary.totals.rental_total.toFixed(2)}, 异常数: ${allocResult2.anomalyCount}`);

  console.log('\n处理押金退款...');
  await db.transaction(async () => {
    await db.prepare(`
      UPDATE deposits 
      SET refunded_amount = collected_amount, 
          status = 'REFUNDED',
          updated_at = datetime('now')
      WHERE order_id = 'ORD20250501'
    `).run();
    
    await db.prepare(`
      UPDATE deposits 
      SET refunded_amount = collected_amount, 
          status = 'REFUNDED',
          updated_at = datetime('now')
      WHERE order_id = 'ORD20250420'
    `).run();
    
    await db.prepare(`
      UPDATE deposits 
      SET deducted_amount = 350,
          refunded_amount = collected_amount - 350,
          status = 'DEDUCTED',
          updated_at = datetime('now')
      WHERE order_id = 'ORD20250410' AND equipment_id = 'EQP002'
    `).run();
    
    await db.prepare(`
      UPDATE deposits 
      SET deducted_amount = 180,
          refunded_amount = collected_amount - 180,
          status = 'DEDUCTED',
          updated_at = datetime('now')
      WHERE order_id = 'ORD20250410' AND equipment_id = 'EQP003'
    `).run();
  });
  console.log('押金退款处理完成: ORD20250501/ORD20250420 全额退还, ORD20250410 扣除损坏费后退还');

  console.log('\n样例数据初始化完成!');
  console.log('\n=== 数据概览 ===');
  console.log('成员: 5人 (张明、李华、王芳、赵强、陈静)');
  console.log('设备: 7台 (音箱2、鼓1、话筒2、功放2)');
  console.log('订单: 4单');
  console.log('  - ORD20250501: 正常单，已归还，已分摊');
  console.log('  - ORD20250415: 押金漏退，已关闭但押金 ¥1100 未退还');
  console.log('  - ORD20250420: 使用时长重叠，EQP004 16:30-17:00 同时被两人使用');
  console.log('  - ORD20250410: 设备损坏未分摊，维修费 ¥530 未分摊');

  console.log('\n=== API 测试建议 ===');
  console.log('1. GET /api/statistics - 查看统计数据');
  console.log('2. GET /api/anomalies - 查看检测到的异常');
  console.log('3. POST /api/orders/ORD20250501/allocate - 重新计算分摊');
  console.log('4. GET /api/orders/ORD20250501/allocation-summary - 查看分摊结果');
  console.log('5. GET /api/orders/ORD20250501/trace - 查看追溯链路');
  console.log('6. POST /api/reports/settlement/ORD20250501 - 生成结算报告');
  console.log('7. GET /api/reports - 查看生成的报告列表');
};

seed().catch(console.error);
