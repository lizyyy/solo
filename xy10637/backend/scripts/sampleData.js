const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const sampleData = async () => {
  try {
    await db.run('BEGIN TRANSACTION');

    const ward1Id = generateId();
    const ward2Id = generateId();
    const ward3Id = generateId();
    
    await db.run(`INSERT INTO wards (id, name, department, level) VALUES 
      (?, '内科一病区', '内科', 2),
      (?, '外科二病区', '外科', 1),
      (?, 'ICU', '重症医学科', 3)`, [ward1Id, ward2Id, ward3Id]);

    const caregiver1Id = generateId();
    const caregiver2Id = generateId();
    const caregiver3Id = generateId();
    const caregiver4Id = generateId();
    
    await db.run(`INSERT INTO caregivers (id, name, phone, id_card, qualifications, skill_level, max_consecutive_hours, status) VALUES 
      (?, '张三', '13800138001', '310101199001010001', '["基础护理", "重症护理"]', 3, 16, 'active'),
      (?, '李四', '13800138002', '310101199002020002', '["基础护理"]', 2, 24, 'active'),
      (?, '王五', '13800138003', '310101199003030003', '["基础护理", "康复护理"]', 2, 16, 'active'),
      (?, '赵六', '13800138004', '310101199004040004', '["基础护理", "重症护理"]', 3, 24, 'active')`,
      [caregiver1Id, caregiver2Id, caregiver3Id, caregiver4Id]);

    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const shifts = ['morning', 'afternoon', 'night'];
    const wardDemands = [];

    for (const date of dates) {
      for (const shift of shifts) {
        const demandId = generateId();
        wardDemands.push(demandId);
        await db.run(`INSERT INTO ward_demands (id, ward_id, date, shift_type, required_count, required_qualifications, min_skill_level, status)
                      VALUES (?, ?, ?, ?, 2, ?, 1, 'pending')`,
                      [demandId, ward1Id, date, shift, '["基础护理"]']);
      }
    }

    console.log('样例数据导入完成！');
    await db.run('COMMIT');
  } catch (err) {
    console.error('导入失败:', err);
    await db.run('ROLLBACK');
  }
  process.exit();
};

sampleData();
