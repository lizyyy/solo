import fs from 'fs';
import path from 'path';
import db from '../config/database';
import { seedData } from './seed-data';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('开始初始化数据库...');

db.exec(`
  CREATE TABLE IF NOT EXISTS person_in_charge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT '巡检员',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pump_room (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    building TEXT,
    equipment_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT '正常',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inspection_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pump_room_id INTEGER NOT NULL,
    inspector_id INTEGER NOT NULL,
    inspection_date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT '待处理',
    water_pressure REAL,
    water_equipment_status TEXT,
    has_leakage BOOLEAN DEFAULT 0,
    noise_level TEXT,
    remarks TEXT,
    exception_type TEXT,
    is_needs_repair BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pump_room_id) REFERENCES pump_room(id),
    FOREIGN KEY (inspector_id) REFERENCES person_in_charge(id)
  );

  CREATE TABLE IF NOT EXISTS repair_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    pump_room_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    handler_id INTEGER,
    problem_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '待派单',
    priority TEXT NOT NULL DEFAULT '普通',
    due_date DATETIME,
    escalated BOOLEAN DEFAULT 0,
    escalated_at DATETIME,
    resolved_at DATETIME,
    resolution TEXT,
    retest_failed BOOLEAN DEFAULT 0,
    retest_remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES inspection_record(id),
    FOREIGN KEY (pump_room_id) REFERENCES pump_room(id),
    FOREIGN KEY (reporter_id) REFERENCES person_in_charge(id),
    FOREIGN KEY (handler_id) REFERENCES person_in_charge(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    passed BOOLEAN NOT NULL,
    operator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_inspection_pump_room ON inspection_record(pump_room_id);
  CREATE INDEX IF NOT EXISTS idx_inspection_date ON inspection_record(inspection_date);
  CREATE INDEX IF NOT EXISTS idx_inspection_status ON inspection_record(status);
  CREATE INDEX IF NOT EXISTS idx_repair_pump_room ON repair_record(pump_room_id);
  CREATE INDEX IF NOT EXISTS idx_repair_status ON repair_record(status);
  CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_type, record_id);
`);

console.log('数据库表创建完成！');

const shouldSeed = process.argv.includes('--seed');
if (shouldSeed) {
  seedData();
}

console.log('数据库初始化完成！');
