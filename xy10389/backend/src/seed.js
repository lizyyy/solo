const { getDb, initDatabase } = require('./database');
const path = require('path');
const fs = require('fs');

function seedDatabase() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  initDatabase();
  const db = getDb();

  db.exec(`
    DELETE FROM cage_history;
    DELETE FROM care_tasks;
    DELETE FROM transfer_requests;
    DELETE FROM alerts;
    DELETE FROM hospitalizations;
    DELETE FROM pets;
    DELETE FROM owners;
    DELETE FROM cages;
    DELETE FROM cage_locations;
    DELETE FROM care_levels;
    DELETE FROM animal_species;
  `);

  const speciesStmt = db.prepare(`
    INSERT INTO animal_species (name, description) VALUES (?, ?)
  `);
  speciesStmt.run('猫', '家猫，Felis catus');
  speciesStmt.run('狗', '家犬，Canis lupus familiaris');
  speciesStmt.run('兔', '家兔，Oryctolagus cuniculus');
  speciesStmt.run('鸟', '观赏鸟');

  const careLevelStmt = db.prepare(`
    INSERT INTO care_levels (name, frequency_hours, description) VALUES (?, ?, ?)
  `);
  careLevelStmt.run('常规护理', 12, '每日两次检查，正常饮食和用药');
  careLevelStmt.run('加强护理', 6, '每6小时检查一次，密切监控生命体征');
  careLevelStmt.run('重症监护', 2, '每2小时检查一次，需要持续监控');
  careLevelStmt.run('隔离护理', 4, '传染病隔离，防护措施执行');

  const locationStmt = db.prepare(`
    INSERT INTO cage_locations (name, description) VALUES (?, ?)
  `);
  locationStmt.run('普通病区A区', '一楼左侧普通住院区');
  locationStmt.run('普通病区B区', '一楼右侧普通住院区');
  locationStmt.run('隔离病区', '二楼传染病隔离区');
  locationStmt.run('ICU重症区', '三楼重症监护室');

  const cageStmt = db.prepare(`
    INSERT INTO cages (cage_number, location_id, is_isolation, max_weight_kg, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  cageStmt.run('A-001', 1, 0, 15, 'available', '小型犬笼');
  cageStmt.run('A-002', 1, 0, 15, 'available', '小型犬笼');
  cageStmt.run('A-003', 1, 0, 8, 'available', '猫笼');
  cageStmt.run('A-004', 1, 0, 8, 'available', '猫笼');
  cageStmt.run('A-005', 1, 0, 30, 'available', '大型犬笼');

  cageStmt.run('B-001', 2, 0, 8, 'available', '猫笼');
  cageStmt.run('B-002', 2, 0, 8, 'available', '猫笼');
  cageStmt.run('B-003', 2, 0, 15, 'available', '小型犬笼');
  cageStmt.run('B-004', 2, 0, 30, 'available', '大型犬笼');
  cageStmt.run('B-005', 2, 0, 30, 'available', '大型犬笼');

  cageStmt.run('ISO-001', 3, 1, 15, 'available', '隔离笼-独立通风');
  cageStmt.run('ISO-002', 3, 1, 15, 'available', '隔离笼-独立通风');
  cageStmt.run('ISO-003', 3, 1, 8, 'available', '隔离猫笼-负压');

  cageStmt.run('ICU-001', 4, 0, 15, 'available', '重症监护笼-带氧舱');
  cageStmt.run('ICU-002', 4, 0, 30, 'available', '重症监护笼-大型');

  const ownerStmt = db.prepare(`
    INSERT INTO owners (name, phone, email, address) VALUES (?, ?, ?, ?)
  `);
  ownerStmt.run('张小明', '13800138001', 'zhang@example.com', '北京市朝阳区');
  ownerStmt.run('李华', '13800138002', 'li@example.com', '北京市海淀区');
  ownerStmt.run('王芳', '13800138003', 'wang@example.com', '北京市西城区');
  ownerStmt.run('陈强', '13800138004', 'chen@example.com', '北京市东城区');

  const petStmt = db.prepare(`
    INSERT INTO pets (name, species_id, owner_id, gender, age_years, weight_kg, breed, microchip, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  petStmt.run('豆豆', 2, 1, '公', 3, 8.5, '金毛', 'CHIP001', '性格温顺，对头孢过敏');
  petStmt.run('咪咪', 1, 2, '母', 2, 4.2, '英短', 'CHIP002', '室内猫，已绝育');
  petStmt.run('旺财', 2, 3, '公', 5, 25, '拉布拉多', 'CHIP003', '导盲犬，训练有素');
  petStmt.run('小白', 1, 4, '公', 1, 3.8, '橘猫', 'CHIP004', '流浪猫救助，尚未绝育');
  petStmt.run('花花', 2, 1, '母', 7, 12, '哈士奇', 'CHIP005', '老年犬，关节不好');

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const hospStmt = db.prepare(`
    INSERT INTO hospitalizations
    (pet_id, cage_id, admission_number, primary_diagnosis, is_infectious,
     infectious_disease, care_level_id, admission_date, expected_discharge_date,
     admission_reason, attending_vet, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cageHistoryStmt = db.prepare(`
    INSERT INTO cage_history (hospitalization_id, cage_id, start_date, notes)
    VALUES (?, ?, ?, ?)
  `);

  const taskStmt = db.prepare(`
    INSERT INTO care_tasks (hospitalization_id, task_type, scheduled_time, notes, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const alertStmt = db.prepare(`
    INSERT INTO alerts (hospitalization_id, alert_type, message, severity, is_resolved)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transferStmt = db.prepare(`
    INSERT INTO transfer_requests
    (hospitalization_id, from_cage_id, to_cage_id, request_reason, requested_by,
     requested_at, reviewed_by, reviewed_at, status, rejection_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hosps = [];

  hosps.push(hospStmt.run(
    1, 1, 'ADM-2026-001', '胃肠炎', 0, null, 1,
    twoDaysAgo.toISOString(), twoDaysLater.toISOString(),
    '呕吐腹泻2天', '张医生', 'active'
  ).lastInsertRowid);

  hosps.push(hospStmt.run(
    2, 3, 'ADM-2026-002', '猫瘟热', 1, '猫细小病毒', 4,
    oneDayAgo.toISOString(), threeDaysLater.toISOString(),
    '发热、食欲废绝', '李医生', 'active'
  ).lastInsertRowid);

  hosps.push(hospStmt.run(
    3, 5, 'ADM-2026-003', '股骨骨折术后', 0, null, 2,
    twoDaysAgo.toISOString(), tomorrow.toISOString(),
    '车祸导致股骨骨折', '王医生', 'active'
  ).lastInsertRowid);

  hosps.push(hospStmt.run(
    4, 6, 'ADM-2026-004', '上呼吸道感染', 0, null, 1,
    oneDayAgo.toISOString(), twoDaysLater.toISOString(),
    '咳嗽流涕', '张医生', 'active'
  ).lastInsertRowid);

  hosps.push(hospStmt.run(
    5, 13, 'ADM-2026-005', '糖尿病酮症酸中毒', 0, null, 3,
    oneDayAgo.toISOString(), threeDaysLater.toISOString(),
    '多饮多尿，精神沉郁', '李医生', 'active'
  ).lastInsertRowid);

  hosps.forEach((hospId, idx) => {
    cageHistoryStmt.run(hospId, [1, 11, 5, 6, 13][idx], new Date(now.getTime() - (idx + 1) * 24 * 60 * 60 * 1000).toISOString(), '初始入院');
  });

  const tasks1 = [
    { type: '体温监测', time: oneDayAgo, status: 'completed' },
    { type: '给药：止吐', time: oneDayAgo, status: 'completed' },
    { type: '体温监测', time: now, status: 'pending' },
    { type: '输液', time: new Date(now.getTime() + 4 * 60 * 60 * 1000), status: 'pending' },
  ];
  tasks1.forEach(t => taskStmt.run(hosps[0], t.type, t.time.toISOString(), null, t.status));

  const tasks2 = [
    { type: '体温监测', time: oneDayAgo, status: 'completed' },
    { type: '隔离消毒', time: oneDayAgo, status: 'completed' },
    { type: '体温监测', time: now, status: 'pending' },
    { type: '抗病毒治疗', time: new Date(now.getTime() + 2 * 60 * 60 * 1000), status: 'pending' },
  ];
  tasks2.forEach(t => taskStmt.run(hosps[1], t.type, t.time.toISOString(), null, t.status));

  const tasks3 = [
    { type: '伤口检查', time: twoDaysAgo, status: 'completed' },
    { type: '给药：止痛', time: oneDayAgo, status: 'completed' },
    { type: '体温监测', time: now, status: 'pending' },
    { type: '伤口换药', time: new Date(now.getTime() + 6 * 60 * 60 * 1000), status: 'pending' },
    { type: '出院评估', time: new Date(now.getTime() + 12 * 60 * 60 * 1000), status: 'pending' },
  ];
  tasks3.forEach(t => taskStmt.run(hosps[2], t.type, t.time.toISOString(), null, t.status));

  alertStmt.run(hosps[1], 'infectious', '传染病病例隔离：猫细小病毒', 'danger', 0);
  alertStmt.run(hosps[2], 'medical', '大型犬骨折术后，需要密切观察', 'warning', 0);

  transferStmt.run(
    hosps[0], 1, 2, '相邻笼位更安静，利于恢复', '前台小王',
    oneDayAgo.toISOString(), '张医生', oneDayAgo.toISOString(), 'approved', null
  );

  db.prepare(`
    UPDATE hospitalizations SET cage_id = 2 WHERE id = ?
  `).run(hosps[0]);

  cageHistoryStmt.run(hosps[0], 2, oneDayAgo.toISOString(), '转笼（已批准）');
  db.prepare(`
    UPDATE cage_history SET end_date = ? WHERE hospitalization_id = ? AND cage_id = 1
  `).run(oneDayAgo.toISOString(), hosps[0]);

  transferStmt.run(
    hosps[2], 5, 15, '术后需要ICU监护', '王医生',
    new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    '李医生', new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    'rejected', '大型犬笼空间更充足，利于术后恢复活动'
  );

  transferStmt.run(
    hosps[3], 6, 7, '需要更安静的环境', '前台小李',
    new Date().toISOString(), null, null, 'pending', null
  );

  console.log('✅ 样例数据已成功导入！');
  console.log('\n📋 导入的数据摘要：');
  console.log('  - 动物种类: 4 种');
  console.log('  - 护理等级: 4 级');
  console.log('  - 笼位区域: 4 个');
  console.log('  - 笼位: 15 个');
  console.log('  - 主人: 4 位');
  console.log('  - 宠物: 5 只');
  console.log('  - 住院病例: 5 例 (含1例传染病隔离)');
  console.log('  - 护理任务: 多笔 (部分待处理，用于测试出院拦截)');
  console.log('  - 转笼申请: 3 笔 (1已批准, 1已驳回, 1待处理)');
  console.log('  - 异常提示: 2 条');

  console.log('\n🔍 测试场景：');
  console.log('  1. 普通住院: ADM-2026-001 (豆豆，金毛)');
  console.log('  2. 传染病隔离: ADM-2026-002 (咪咪，猫瘟热) - 已在隔离笼 ISO-001');
  console.log('  3. 转笼成功: ADM-2026-001 从 A-001 转至 A-002');
  console.log('  4. 转笼驳回: ADM-2026-003 申请转ICU被驳回');
  console.log('  5. 待处理转笼: ADM-2026-004 申请转笼待审批');
  console.log('  6. 出院拦截: ADM-2026-003 (旺财) 有3个待处理护理任务，出院时会被拦截');
}

seedDatabase();
