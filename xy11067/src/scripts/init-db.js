const db = require('../database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS children`);
  db.run(`DROP TABLE IF EXISTS sibling_relations`);
  db.run(`DROP TABLE IF EXISTS health_check_records`);
  db.run(`DROP TABLE IF EXISTS isolation_records`);
  db.run(`DROP TABLE IF EXISTS contact_history`);

  db.run(`CREATE TABLE children (
    child_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('男', '女')),
    birth_date DATE,
    class_name TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    address TEXT,
    allergies TEXT,
    special_conditions TEXT,
    admission_date DATE,
    status TEXT DEFAULT '在园' CHECK(status IN ('在园', '离园', '休学', '隔离中')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE sibling_relations (
    relation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id1 TEXT NOT NULL,
    child_id2 TEXT NOT NULL,
    relation_type TEXT DEFAULT '兄弟姐妹' CHECK(relation_type IN ('兄弟姐妹', '堂表亲', '同住')),
    is_living_together BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id1) REFERENCES children(child_id),
    FOREIGN KEY (child_id2) REFERENCES children(child_id)
  )`);

  db.run(`CREATE TABLE health_check_records (
    check_id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    check_date DATE NOT NULL,
    check_time TIME NOT NULL,
    checker_name TEXT NOT NULL,
    body_temperature DECIMAL(4,2) NOT NULL,
    has_fever BOOLEAN DEFAULT 0,
    cough BOOLEAN DEFAULT 0,
    runny_nose BOOLEAN DEFAULT 0,
    sore_throat BOOLEAN DEFAULT 0,
    diarrhea BOOLEAN DEFAULT 0,
    vomiting BOOLEAN DEFAULT 0,
    rash BOOLEAN DEFAULT 0,
    conjunctivitis BOOLEAN DEFAULT 0,
    hand_foot_mouth BOOLEAN DEFAULT 0,
    other_symptoms TEXT,
    spirit_status TEXT CHECK(spirit_status IN ('良好', '一般', '较差')),
    appetite_status TEXT CHECK(appetite_status IN ('良好', '一般', '较差')),
    sleep_status TEXT CHECK(sleep_status IN ('良好', '一般', '较差')),
    medication_name TEXT,
    medication_dosage TEXT,
    medication_time TEXT,
    is_allowed_entry BOOLEAN NOT NULL,
    check_result TEXT CHECK(check_result IN ('正常', '观察', '送医', '隔离', '接回')),
    remarks TEXT,
    guardian_notified BOOLEAN DEFAULT 0,
    notification_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id)
  )`);

  db.run(`CREATE TABLE isolation_records (
    isolation_id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    check_id TEXT,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE,
    end_time TIME,
    isolation_reason TEXT NOT NULL,
    isolation_type TEXT CHECK(isolation_type IN ('医学隔离', '居家观察', '班级隔离', '临时观察')),
    isolation_location TEXT,
    symptoms TEXT,
    diagnosis TEXT,
    hospital_name TEXT,
    doctor_name TEXT,
    body_temperature DECIMAL(4,2),
    has_close_contact BOOLEAN DEFAULT 0,
    close_contact_details TEXT,
    guardian_notified BOOLEAN DEFAULT 0,
    notification_method TEXT CHECK(notification_method IN ('电话', '微信', '短信', '书面')),
    notification_time DATETIME,
    guardian_signature TEXT,
    is_ended BOOLEAN DEFAULT 0,
    end_reason TEXT,
    checker_name TEXT NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id),
    FOREIGN KEY (check_id) REFERENCES health_check_records(check_id)
  )`);

  db.run(`CREATE TABLE contact_history (
    contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id TEXT NOT NULL,
    contact_child_id TEXT NOT NULL,
    contact_date DATE NOT NULL,
    contact_duration INTEGER,
    contact_location TEXT,
    is_close_contact BOOLEAN DEFAULT 0,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id),
    FOREIGN KEY (contact_child_id) REFERENCES children(child_id)
  )`);

  console.log('数据库表初始化完成');
});

db.close();
