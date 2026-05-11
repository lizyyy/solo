const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dental.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialization TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    gender TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treatment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    treatment_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    treatment_plan_id INTEGER,
    treatment_stage TEXT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    type TEXT DEFAULT 'follow-up',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id)
  );

  CREATE TABLE IF NOT EXISTS reschedule_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    original_date DATE,
    original_time TIME,
    new_date DATE,
    new_time TIME,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
  );

  CREATE TABLE IF NOT EXISTS no_show_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    no_show_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    receptionist_note TEXT,
    doctor_confirmation TEXT,
    doctor_confirmed_by INTEGER,
    doctor_confirmed_at DATETIME,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_confirmed_by) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    reminder_type TEXT,
    reminder_date DATETIME,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
  );
`);

const treatmentStageConfig = {
  'root_canal': {
    name: '根管治疗',
    stages: [
      { stage: 'initial_exam', name: '初诊检查', nextInterval: 1 },
      { stage: 'canal_preparation', name: '根管预备', nextInterval: 7 },
      { stage: 'canal_obturation', name: '根管充填', nextInterval: 14 },
      { stage: 'restoration', name: '修复治疗', nextInterval: 30 },
      { stage: 'final_check', name: '最终检查', nextInterval: 90 }
    ]
  },
  'orthodontics': {
    name: '正畸治疗',
    stages: [
      { stage: 'initial_consult', name: '初诊咨询', nextInterval: 14 },
      { stage: 'records_taking', name: '取模拍片', nextInterval: 7 },
      { stage: 'treatment_plan', name: '方案制定', nextInterval: 14 },
      { stage: 'brackets_install', name: '安装矫治器', nextInterval: 28 },
      { stage: 'adjustment', name: '定期调整', nextInterval: 28 },
      { stage: 'retention', name: '保持器阶段', nextInterval: 180 }
    ]
  },
  'cleaning': {
    name: '洁牙复诊',
    stages: [
      { stage: 'initial_cleaning', name: '初次洁牙', nextInterval: 180 },
      { stage: 'follow_up_cleaning', name: '定期洁牙', nextInterval: 180 }
    ]
  }
};

const initData = () => {
  const doctorCount = db.prepare('SELECT COUNT(*) as count FROM doctors').get().count;
  if (doctorCount === 0) {
    const insertDoctor = db.prepare('INSERT INTO doctors (name, specialization, phone) VALUES (?, ?, ?)');
    insertDoctor.run('张医生', '根管治疗', '13800138001');
    insertDoctor.run('李医生', '正畸治疗', '13800138002');
    insertDoctor.run('王医生', '综合治疗', '13800138003');
  }

  const patientCount = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
  if (patientCount === 0) {
    const insertPatient = db.prepare('INSERT INTO patients (name, phone, age, gender, address) VALUES (?, ?, ?, ?, ?)');
    insertPatient.run('张三', '13900139001', 35, '男', '北京市朝阳区');
    insertPatient.run('李四', '13900139002', 28, '女', '北京市海淀区');
    insertPatient.run('王五', '13900139003', 45, '男', '北京市西城区');
  }
};

initData();

module.exports = { db, treatmentStageConfig };
