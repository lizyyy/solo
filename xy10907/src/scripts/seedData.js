const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const dbPath = path.join(dataDir, 'pet_medication.db');
const db = new sqlite3.Database(dbPath);

async function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function seedData() {
  console.log('开始插入示例数据...\n');

  const petId1 = uuidv4();
  const petId2 = uuidv4();

  await runQuery(`
    INSERT INTO pets (id, name, species, breed, age, weight, owner_name, owner_phone, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [petId1, '旺财', '狗', '金毛', 3, 25.5, '张三', '13800138001', '性格温顺，喜欢玩耍']);

  await runQuery(`
    INSERT INTO pets (id, name, species, breed, age, weight, owner_name, owner_phone, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [petId2, '咪咪', '猫', '英短', 2, 4.2, '李四', '13800138002', '怕生，需要安静环境']);

  console.log('✅ 已插入 2 条宠物档案');

  const orderId1 = uuidv4();
  const orderId2 = uuidv4();

  await runQuery(`
    INSERT INTO orders (id, pet_id, check_in_date, check_out_date, room_number, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [orderId1, petId1, moment().subtract(2, 'days').format('YYYY-MM-DD'), moment().add(5, 'days').format('YYYY-MM-DD'), 'A101', 'active', '需要每天遛弯']);

  await runQuery(`
    INSERT INTO orders (id, pet_id, check_in_date, check_out_date, room_number, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [orderId2, petId2, moment().subtract(1, 'days').format('YYYY-MM-DD'), moment().add(3, 'days').format('YYYY-MM-DD'), 'B202', 'active', '特殊饮食要求']);

  console.log('✅ 已插入 2 条寄养订单');

  const planId1 = uuidv4();
  const planId2 = uuidv4();

  await runQuery(`
    INSERT INTO medication_plans (id, order_id, pet_id, medication_name, dosage, dosage_unit, frequency, start_date, end_date, administration_method, version, is_active, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [planId1, orderId1, petId1, '消炎药', '1', '片', '每日2次', moment().subtract(2, 'days').format('YYYY-MM-DD'), moment().add(5, 'days').format('YYYY-MM-DD'), '餐后服用', 1, 1, '管理员', '注意观察过敏反应']);

  await runQuery(`
    INSERT INTO medication_plans (id, order_id, pet_id, medication_name, dosage, dosage_unit, frequency, start_date, end_date, administration_method, version, is_active, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [planId2, orderId2, petId2, '维生素片', '0.5', '片', '每日1次', moment().subtract(1, 'days').format('YYYY-MM-DD'), moment().add(3, 'days').format('YYYY-MM-DD'), '混入猫粮', 1, 1, '管理员', '确保完全吃下']);

  console.log('✅ 已插入 2 条喂药计划');

  const shifts = [];
  
  for (let i = 0; i < 8; i++) {
    const date = moment().subtract(2, 'days').add(i, 'days');
    if (date.isAfter(moment().add(5, 'days'))) break;
    
    shifts.push({
      id: uuidv4(),
      medication_plan_id: planId1,
      scheduled_time: date.clone().hour(9).minute(0).toISOString(),
      shift_type: 'morning',
      status: i < 2 ? 'completed' : 'pending'
    });
    shifts.push({
      id: uuidv4(),
      medication_plan_id: planId1,
      scheduled_time: date.clone().hour(21).minute(0).toISOString(),
      shift_type: 'night',
      status: i < 2 ? 'completed' : 'pending'
    });
  }

  for (let i = 0; i < 5; i++) {
    const date = moment().subtract(1, 'days').add(i, 'days');
    if (date.isAfter(moment().add(3, 'days'))) break;
    
    shifts.push({
      id: uuidv4(),
      medication_plan_id: planId2,
      scheduled_time: date.clone().hour(12).minute(0).toISOString(),
      shift_type: 'noon',
      status: i < 1 ? 'completed' : 'pending'
    });
  }

  for (const shift of shifts) {
    await runQuery(`
      INSERT INTO shift_executions (id, medication_plan_id, scheduled_time, shift_type, actual_time, status, administered_by, actual_dosage, notes, has_alarm, alarm_acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shift.id,
      shift.medication_plan_id,
      shift.scheduled_time,
      shift.shift_type,
      shift.status === 'completed' ? moment(shift.scheduled_time).add(10, 'minutes').toISOString() : null,
      shift.status,
      shift.status === 'completed' ? '护理员A' : null,
      shift.status === 'completed' ? '1片' : null,
      shift.status === 'completed' ? '正常执行' : '',
      0,
      0
    ]);
  }

  console.log(`✅ 已插入 ${shifts.length} 条班次执行记录`);

  const confirmationId = uuidv4();
  await runQuery(`
    INSERT INTO change_confirmations (id, request_id, resource_type, resource_id, change_type, original_data, new_data, status, requested_by, reviewed_by, reviewed_at, review_notes, compensation_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    confirmationId,
    uuidv4(),
    'medication_plan',
    planId1,
    'dosage_change',
    JSON.stringify({ dosage: '1', dosage_unit: '片' }),
    JSON.stringify({ dosage: '0.5', dosage_unit: '片' }),
    'pending_review',
    '白班护理员',
    null,
    null,
    null,
    null,
    moment().toISOString(),
    moment().toISOString()
  ]);

  console.log('✅ 已插入 1 条变更确认记录');

  console.log('\n═══════════════════════════════════════════════');
  console.log('示例数据插入完成！');
  console.log('═══════════════════════════════════════════════');
  console.log(`
  示例数据摘要：
  - 宠物档案: 2 条
  - 寄养订单: 2 条
  - 喂药计划: 2 条（含版本控制）
  - 班次执行: ${shifts.length} 条（含已完成和待执行）
  - 变更确认: 1 条（待复核状态）
  
  下一步操作：
  1. npm start 启动服务
  2. 访问 http://localhost:3000/api 查看API列表
  3. 使用示例数据进行接口测试
  `);

  db.close();
}

seedData().catch(err => {
  console.error('插入示例数据失败:', err);
  db.close();
  process.exit(1);
});
