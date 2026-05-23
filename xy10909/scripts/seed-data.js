const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('创建数据目录:', dataDir);
}

const db = require('../src/database/db');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  console.log('开始初始化样例数据...');

  const now = Date.now();
  const timestamp = now.toString().slice(-6);

  const clearOldData = db.prepare(`
    DELETE FROM gate_events WHERE event_no LIKE 'SEED-%'
  `);
  const deletedResult = await clearOldData.run();
  if (deletedResult.changes > 0) {
    console.log(`清理旧样例闸机事件: ${deletedResult.changes}条`);
  }

  const personnel1Id = uuidv4();
  const personnel2Id = uuidv4();
  const personnel3Id = uuidv4();
  const blacklistPersonId = uuidv4();

  const insertPersonnel = db.prepare(`
    INSERT INTO personnel (id, employee_id, name, id_card, phone, department, position, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id) DO NOTHING
  `);

  const insertOrIgnore = async (id, empId, name, idCard, phone, dept, pos, status) => {
    const result = await insertPersonnel.run(id, empId, name, idCard, phone, dept, pos, status);
    return result.changes > 0 ? id : null;
  };

  let insertedCount = 0;
  const p1 = await insertOrIgnore(personnel1Id, `EMP-S${timestamp}1`, '张三', `110${timestamp}12345678901`, '13800138001', '工程部', '工程师', 'active');
  if (p1) insertedCount++;
  const p2 = await insertOrIgnore(personnel2Id, `EMP-S${timestamp}2`, '李四', `110${timestamp}12345678902`, '13800138002', '安全部', '安全员', 'active');
  if (p2) insertedCount++;
  const p3 = await insertOrIgnore(personnel3Id, `EMP-S${timestamp}3`, '王五', `110${timestamp}12345678903`, '13800138003', '行政部', '主管', 'active');
  if (p3) insertedCount++;
  const p4 = await insertOrIgnore(blacklistPersonId, `EMP-S${timestamp}4`, '赵六', `110${timestamp}12345678904`, '13800138004', '外包队', '工人', 'inactive');
  if (p4) insertedCount++;

  console.log(`人员档案处理完成: 新增${insertedCount}条`);

  const allPersonnelStmt = db.prepare('SELECT id, name, id_card, employee_id FROM personnel ORDER BY created_at DESC LIMIT 10');
  const allPersonnel = await allPersonnelStmt.all();
  const activePersonnel = allPersonnel.filter(p => p.employee_id && !p.employee_id.includes('4')).slice(0, 2);
  const forTraining = activePersonnel.length >= 2 ? activePersonnel : allPersonnel.slice(0, 2);
  const hostPersonnel = allPersonnel[0] || { id: personnel1Id, name: '张三' };
  const blacklistPerson = allPersonnel.find(p => p.employee_id && p.employee_id.includes('4')) || { id: blacklistPersonId, id_card: `110${timestamp}12345678904`, name: '赵六' };

  const insertTraining = db.prepare(`
    INSERT INTO training_status (id, personnel_id, training_type, training_date, expiry_date, status, score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  for (const person of forTraining) {
    const existingStmt = db.prepare('SELECT id FROM training_status WHERE personnel_id = ?');
    const existing = await existingStmt.get(person.id);
    if (!existing) {
      await insertTraining.run(
        uuidv4(),
        person.id,
        '安全培训',
        today,
        nextYear.toISOString().split('T')[0],
        'passed',
        90 + Math.floor(Math.random() * 10)
      );
      console.log(`新增培训记录: ${person.name}`);
    }
  }

  const blacklistStmt = db.prepare(`
    SELECT id FROM blacklist WHERE id_card = ? AND status = 'active'
  `);
  const existingBlacklist = await blacklistStmt.get(blacklistPerson.id_card);

  if (!existingBlacklist) {
    const insertBlacklist = db.prepare(`
      INSERT INTO blacklist (id, personnel_id, id_card, name, reason, status, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    await insertBlacklist.run(
      uuidv4(),
      blacklistPerson.id,
      blacklistPerson.id_card,
      blacklistPerson.name,
      '多次违规闯入',
      'active',
      'system'
    );
    console.log('新增黑名单记录');
  }

  const visitor1Id = uuidv4();
  const visitorStart = new Date();
  visitorStart.setHours(9, 0, 0, 0);
  const visitorEnd = new Date();
  visitorEnd.setHours(18, 0, 0, 0);

  const insertVisitor = db.prepare(`
    INSERT INTO visitor_applications (
      id, visitor_name, visitor_id_card, visitor_phone, visitor_company,
      visit_purpose, host_personnel_id, host_name, scheduled_start, scheduled_end, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await insertVisitor.run(
    visitor1Id,
    '钱七',
    `110${timestamp}12345678905`,
    '13900139001',
    '供应商A公司',
    '设备维护',
    hostPersonnel.id,
    hostPersonnel.name,
    visitorStart.toISOString(),
    visitorEnd.toISOString(),
    'approved'
  );
  console.log('新增访客申请');

  const createEvent = db.prepare(`
    INSERT INTO gate_events (
      id, event_no, personnel_id, visitor_application_id, person_type,
      name, id_card, gate_no, direction, event_time, access_result,
      access_reason, dedup_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const eventTime1 = new Date();
  eventTime1.setHours(8, 30, 0, 0);
  await createEvent.run(
    uuidv4(),
    `SEED-${timestamp}-001`,
    forTraining[0] ? forTraining[0].id : null,
    null,
    'employee',
    forTraining[0] ? forTraining[0].name : '张三',
    forTraining[0] ? forTraining[0].id_card : `110${timestamp}12345678901`,
    'GATE01',
    'in',
    eventTime1.toISOString(),
    'allowed',
    '通行校验通过',
    'seed-' + uuidv4().slice(0, 8)
  );

  const eventTime2 = new Date();
  eventTime2.setHours(9, 15, 0, 0);
  await createEvent.run(
    uuidv4(),
    `SEED-${timestamp}-002`,
    null,
    visitor1Id,
    'visitor',
    '钱七',
    `110${timestamp}12345678905`,
    'GATE01',
    'in',
    eventTime2.toISOString(),
    'allowed',
    '访客通行校验通过',
    'seed-' + uuidv4().slice(0, 8)
  );

  const eventTime3 = new Date();
  eventTime3.setHours(10, 0, 0, 0);
  await createEvent.run(
    uuidv4(),
    `SEED-${timestamp}-003`,
    null,
    null,
    'other',
    blacklistPerson.name,
    blacklistPerson.id_card,
    'GATE02',
    'in',
    eventTime3.toISOString(),
    'denied',
    '黑名单拦截: 多次违规闯入',
    'seed-' + uuidv4().slice(0, 8)
  );

  console.log('新增样例闸机事件: 3条');

  console.log('=================================');
  console.log('样例数据初始化完成！');
  console.log('时间戳:', timestamp);
  console.log('=================================');
  console.log('样例人员:');
  allPersonnel.slice(0, 4).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.employee_id})`);
  });
  console.log('  黑名单人员:', blacklistPerson.name);
  console.log('=================================');
  console.log('可重复运行此脚本，不会触发唯一约束冲突！');
};

(async () => {
  await seedData();
  await db.close();
})();
