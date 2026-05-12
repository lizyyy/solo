const { v4: uuidv4 } = require('uuid');
const { db, transaction } = require('../database/db');

const HOSPITAL_A = 'hosp-001';
const HOSPITAL_B = 'hosp-002';
const DEPT_CARDIO = 'dept-cardio';
const DEPT_NEURO = 'dept-neuro';
const DEPT_ICU = 'dept-icu';
const DEPT_EMERG = 'dept-emerg';

function seed() {
  const tx = transaction(() => {
    db.prepare(`
      INSERT INTO hospitals (id, name, address, phone) VALUES
      (?, '中心医院', '人民大道100号', '021-12345678'),
      (?, '社区医院', '社区街50号', '021-87654321')
    `).run(HOSPITAL_A, HOSPITAL_B);

    db.prepare(`
      INSERT INTO departments (id, hospital_id, name, description, is_active) VALUES
      (?, ?, '心内科', '心脏疾病诊治', 1),
      (?, ?, '神经内科', '神经系统疾病', 1),
      (?, ?, 'ICU', '重症监护室', 1),
      (?, ?, '急诊科', '急诊救治', 0)
    `).run(DEPT_CARDIO, HOSPITAL_A, DEPT_NEURO, HOSPITAL_A, DEPT_ICU, HOSPITAL_A, DEPT_EMERG, HOSPITAL_A);

    const beds = [];
    for (let i = 1; i <= 5; i++) {
      beds.push({
        id: `bed-cardio-${i}`,
        dept: DEPT_CARDIO,
        number: `C-${String(i).padStart(3, '0')}`,
        type: i <= 2 ? 'critical' : 'general'
      });
    }
    for (let i = 1; i <= 4; i++) {
      beds.push({
        id: `bed-neuro-${i}`,
        dept: DEPT_NEURO,
        number: `N-${String(i).padStart(3, '0')}`,
        type: 'general'
      });
    }
    for (let i = 1; i <= 2; i++) {
      beds.push({
        id: `bed-icu-${i}`,
        dept: DEPT_ICU,
        number: `I-${String(i).padStart(3, '0')}`,
        type: 'critical'
      });
    }

    const bedStmt = db.prepare(`
      INSERT INTO beds (id, department_id, bed_number, type, status)
      VALUES (?, ?, ?, ?, 'available')
    `);

    beds.forEach(bed => {
      bedStmt.run(bed.id, bed.dept, bed.number, bed.type);
    });

    db.prepare(`
      INSERT INTO patients (id, name, id_card, gender, age, phone) VALUES
      ('pat-001', '张三', '310101198001011234', '男', 45, '13800138001'),
      ('pat-002', '李四', '310101197505052345', '女', 50, '13800138002'),
      ('pat-003', '王五', '310101199009093456', '男', 35, '13800138003'),
      ('pat-004', '赵六', '310101198803034567', '男', 38, '13800138004'),
      ('pat-005', '孙七', '310101197207075678', '女', 54, '13800138005')
    `).run();
  });

  tx();
  console.log('✓ 基础数据已创建');
}

function getSeedData() {
  return {
    hospitals: { HOSPITAL_A, HOSPITAL_B },
    departments: { DEPT_CARDIO, DEPT_NEURO, DEPT_ICU, DEPT_EMERG }
  };
}

module.exports = { seed, getSeedData };

if (require.main === module) {
  seed();
  console.log('造数完成！');
}
