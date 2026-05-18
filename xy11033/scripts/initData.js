const { runAsync, initTables } = require('../src/db');
const { v4: uuidv4 } = require('uuid');
const feedingChangeService = require('../src/services/feedingChangeService');
const { CHANGE_STATUSES, CHANGE_TYPES, SUBMIT_SOURCES } = require('../src/constants/statuses');

async function clearAllData() {
  await runAsync('DELETE FROM change_status_logs');
  await runAsync('DELETE FROM feeding_changes');
  await runAsync('DELETE FROM daily_care_reports');
  await runAsync('DELETE FROM foster_orders');
  await runAsync('DELETE FROM pets');
  await runAsync('DELETE FROM food_inventory');
  await runAsync('DELETE FROM operators');
  console.log('✅ 已清空所有数据');
}

async function insertOperators() {
  const operators = [
    { id: uuidv4(), name: '张护理', role: 'nurse', phone: '13800138001', created_at: new Date().toISOString() },
    { id: uuidv4(), name: '李店长', role: 'manager', phone: '13800138002', created_at: new Date().toISOString() },
    { id: uuidv4(), name: '王医生', role: 'vet', phone: '13800138003', created_at: new Date().toISOString() }
  ];

  const stmt = 'INSERT INTO operators (id, name, role, phone, created_at) VALUES (?, ?, ?, ?, ?)';
  for (const op of operators) {
    await runAsync(stmt, [op.id, op.name, op.role, op.phone, op.created_at]);
  }
  console.log(`✅ 已插入 ${operators.length} 名操作员`);
  return operators;
}

async function insertPets() {
  const pets = [
    { id: uuidv4(), name: '旺财', breed: '金毛', age: 3, owner_id: 'O001', owner_name: '张先生', owner_phone: '13900139001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), name: '咪咪', breed: '英短蓝猫', age: 2, owner_id: 'O002', owner_name: '李女士', owner_phone: '13900139002', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), name: '豆豆', breed: '泰迪', age: 5, owner_id: 'O003', owner_name: '王先生', owner_phone: '13900139003', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), name: '布丁', breed: '布偶猫', age: 1, owner_id: 'O004', owner_name: '赵小姐', owner_phone: '13900139004', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const stmt = 'INSERT INTO pets (id, name, breed, age, owner_id, owner_name, owner_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  for (const pet of pets) {
    await runAsync(stmt, [pet.id, pet.name, pet.breed, pet.age, pet.owner_id, pet.owner_name, pet.owner_phone, pet.created_at, pet.updated_at]);
  }
  console.log(`✅ 已插入 ${pets.length} 只宠物`);
  return pets;
}

async function insertFosterOrders(pets) {
  const orders = [
    { id: uuidv4(), pet_id: pets[0].id, checkin_date: '2024-01-15', checkout_date: '2024-01-25', room_number: 'A101', original_food_brand: '皇家', original_food_type: '成犬粮', original_daily_amount: 0.3, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), pet_id: pets[1].id, checkin_date: '2024-01-18', checkout_date: '2024-01-28', room_number: 'B202', original_food_brand: '渴望', original_food_type: '室内猫粮', original_daily_amount: 0.08, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), pet_id: pets[2].id, checkin_date: '2024-01-20', checkout_date: '2024-02-05', room_number: 'A103', original_food_brand: '比瑞吉', original_food_type: '小型成犬粮', original_daily_amount: 0.1, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), pet_id: pets[3].id, checkin_date: '2024-01-22', checkout_date: '2024-01-30', room_number: 'B204', original_food_brand: '巅峰', original_food_type: '全价猫粮', original_daily_amount: 0.06, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const stmt = 'INSERT INTO foster_orders (id, pet_id, checkin_date, checkout_date, room_number, original_food_brand, original_food_type, original_daily_amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  for (const order of orders) {
    await runAsync(stmt, [order.id, order.pet_id, order.checkin_date, order.checkout_date, order.room_number, order.original_food_brand, order.original_food_type, order.original_daily_amount, order.status, order.created_at, order.updated_at]);
  }
  console.log(`✅ 已插入 ${orders.length} 个寄养订单`);
  return orders;
}

async function insertInventory() {
  const inventoryItems = [
    { id: uuidv4(), brand: '皇家', type: '成犬粮', stock_quantity: 15.5, unit: 'kg', warning_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), brand: '渴望', type: '室内猫粮', stock_quantity: 8.2, unit: 'kg', warning_threshold: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), brand: '比瑞吉', type: '小型成犬粮', stock_quantity: 0.5, unit: 'kg', warning_threshold: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), brand: '巅峰', type: '全价猫粮', stock_quantity: 12.0, unit: 'kg', warning_threshold: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: uuidv4(), brand: '伯纳天纯', type: '幼犬粮', stock_quantity: 6.8, unit: 'kg', warning_threshold: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const stmt = 'INSERT INTO food_inventory (id, brand, type, stock_quantity, unit, warning_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  for (const item of inventoryItems) {
    await runAsync(stmt, [item.id, item.brand, item.type, item.stock_quantity, item.unit, item.warning_threshold, item.created_at, item.updated_at]);
  }
  console.log(`✅ 已插入 ${inventoryItems.length} 条库存记录`);
  return inventoryItems;
}

async function insertDailyReports(fosterOrders, operators) {
  const reports = [];
  const today = new Date();
  
  for (let i = 0; i < 5; i++) {
    const reportDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    for (let j = 0; j < fosterOrders.length; j++) {
      const order = fosterOrders[j];
      reports.push({
        id: uuidv4(),
        foster_order_id: order.id,
        report_date: reportDate,
        food_brand: order.original_food_brand,
        food_type: order.original_food_type,
        food_amount: order.original_daily_amount,
        feeding_time: '08:30',
        appetite_status: i % 3 === 0 ? 'good' : (i % 3 === 1 ? 'normal' : 'poor'),
        health_status: 'normal',
        notes: i % 4 === 0 ? '今日食欲很好，全部吃完' : null,
        created_by: operators[j % operators.length].name,
        created_at: new Date().toISOString()
      });
    }
  }

  const stmt = 'INSERT INTO daily_care_reports (id, foster_order_id, report_date, food_brand, food_type, food_amount, feeding_time, appetite_status, health_status, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  for (const report of reports) {
    await runAsync(stmt, [report.id, report.foster_order_id, report.report_date, report.food_brand, report.food_type, report.food_amount, report.feeding_time, report.appetite_status, report.health_status, report.notes, report.created_by, report.created_at]);
  }
  console.log(`✅ 已插入 ${reports.length} 条护理日报`);
  return reports;
}

async function insertFeedingChanges(fosterOrders, operators) {
  const changes = [
    {
      foster_order_id: fosterOrders[0].id,
      change_type: CHANGE_TYPES.OWNER_TEMPORARY_FOOD_CHANGE,
      change_reason: '主人微信临时要求换粮，狗狗肠胃不适需要换易消化粮',
      original_food_brand: '皇家',
      original_food_type: '成犬粮',
      original_daily_amount: 0.3,
      new_food_brand: '伯纳天纯',
      new_food_type: '幼犬粮',
      new_daily_amount: 0.25,
      feeding_time_adjustment: '09:00',
      submit_source: SUBMIT_SOURCES.OWNER_WECHAT,
      submitted_by: operators[0].name
    },
    {
      foster_order_id: fosterOrders[2].id,
      change_type: CHANGE_TYPES.INVENTORY_SHORTAGE_SWITCH,
      change_reason: '库存不足自动触发换粮，比瑞吉小型成犬粮仅剩0.5kg',
      original_food_brand: '比瑞吉',
      original_food_type: '小型成犬粮',
      original_daily_amount: 0.1,
      new_food_brand: '皇家',
      new_food_type: '成犬粮',
      new_daily_amount: 0.1,
      feeding_time_adjustment: null,
      submit_source: SUBMIT_SOURCES.AUTOMATIC_DETECTION,
      submitted_by: 'system'
    },
    {
      foster_order_id: fosterOrders[1].id,
      change_type: CHANGE_TYPES.FEEDING_TIME_ADJUSTMENT,
      change_reason: '猫咪早上食欲不佳，调整到晚上喂食',
      original_food_brand: '渴望',
      original_food_type: '室内猫粮',
      original_daily_amount: 0.08,
      new_food_brand: null,
      new_food_type: null,
      new_daily_amount: null,
      feeding_time_adjustment: '18:00',
      submit_source: SUBMIT_SOURCES.STAFF_SYSTEM,
      submitted_by: operators[1].name
    },
    {
      foster_order_id: fosterOrders[3].id,
      change_type: CHANGE_TYPES.HEALTH_RELATED_CHANGE,
      change_reason: '兽医建议术后恢复期间减少喂食量',
      original_food_brand: '巅峰',
      original_food_type: '全价猫粮',
      original_daily_amount: 0.06,
      new_food_brand: null,
      new_food_type: null,
      new_daily_amount: 0.04,
      feeding_time_adjustment: null,
      submit_source: SUBMIT_SOURCES.STAFF_SYSTEM,
      submitted_by: operators[2].name
    }
  ];

  const results = [];
  for (const change of changes) {
    results.push(await feedingChangeService.createFeedingChange(change));
  }
  
  console.log(`✅ 已插入 ${results.length} 条喂食变更记录`);
  console.log(`   - 正常记录: ${results.filter(r => r.recordType === 'normal').length}`);
  console.log(`   - 异常记录: ${results.filter(r => r.recordType === 'abnormal').length}`);
  return results;
}

async function initData() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始初始化宠物寄养喂食变更系统样例数据');
  console.log('='.repeat(60) + '\n');

  await initTables();

  try {
    await clearAllData();
    const operators = await insertOperators();
    const pets = await insertPets();
    const orders = await insertFosterOrders(pets);
    await insertInventory();
    await insertDailyReports(orders, operators);
    await insertFeedingChanges(orders, operators);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 样例数据初始化完成！');
    console.log('='.repeat(60));
    console.log('💡 接下来可以运行:');
    console.log('   npm start      - 启动服务');
    console.log('   npm test       - 运行测试');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

initData();
