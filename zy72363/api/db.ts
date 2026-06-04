import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const db = new Database(path.join(__dirname, 'data.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batch (id TEXT PRIMARY KEY,filename TEXT NOT NULL,total_in_file INTEGER NOT NULL DEFAULT 0,imported_count INTEGER NOT NULL DEFAULT 0,duplicate_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS sensor_data (id TEXT PRIMARY KEY,sensor_code TEXT NOT NULL UNIQUE,batch_id TEXT NOT NULL,material_type TEXT NOT NULL DEFAULT '',rpm_min REAL NOT NULL DEFAULT 0,rpm_max REAL NOT NULL DEFAULT 0,coefficient REAL NOT NULL DEFAULT 1.0,coefficient_manual INTEGER NOT NULL DEFAULT 0,coefficient_reason TEXT,remark TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (batch_id) REFERENCES batch(id));
  CREATE TABLE IF NOT EXISTS photo_meta (id TEXT PRIMARY KEY,sensor_id TEXT NOT NULL,filename TEXT NOT NULL,url TEXT NOT NULL,remark TEXT NOT NULL DEFAULT '',uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (sensor_id) REFERENCES sensor_data(id));
  CREATE TABLE IF NOT EXISTS safety_zone (id TEXT PRIMARY KEY,sensor_id TEXT NOT NULL UNIQUE,rpm_min REAL NOT NULL DEFAULT 0,rpm_max REAL NOT NULL DEFAULT 0,coefficient REAL NOT NULL DEFAULT 1.0,coefficient_source TEXT NOT NULL DEFAULT 'auto',coefficient_reason TEXT,review_status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,review_comment TEXT,reviewed_at TEXT,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (sensor_id) REFERENCES sensor_data(id));
  CREATE TABLE IF NOT EXISTS change_record (id TEXT PRIMARY KEY,target_type TEXT NOT NULL,target_id TEXT NOT NULL,field TEXT NOT NULL,old_value TEXT NOT NULL,new_value TEXT NOT NULL,operator TEXT NOT NULL DEFAULT 'system',reason TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
`)

const countRow = db.prepare('SELECT COUNT(*) as cnt FROM batch').get() as { cnt: number }
if (countRow.cnt === 0) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
  const batch1Id = uuidv4()
  const batch2Id = uuidv4()

  const insertBatch = db.prepare('INSERT INTO batch (id, filename, total_in_file, imported_count, duplicate_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  insertBatch.run(batch1Id, '\u79BB\u5FC3\u673A\u4F20\u611F\u5668\u6570\u636E_20260501.csv', 5, 5, 0, '2026-05-01 09:30:00')
  insertBatch.run(batch2Id, '\u79BB\u5FC3\u673A\u4F20\u611F\u5668\u6570\u636E_20260520.csv', 3, 3, 0, '2026-05-20 14:15:00')

  const sensors = [
    { code: 'CG-XF-001', material: '\u4E0D\u9508\u94A2304', rpmMin: 3000, rpmMax: 8000, coeff: 1.0, manual: 0, reason: null as string | null, remark: '\u4E3B\u79BB\u5FC3\u673AA' },
    { code: 'CG-XF-002', material: '\u949B\u5408\u91D1TC4', rpmMin: 2500, rpmMax: 7500, coeff: 1.2, manual: 1, reason: null as string | null, remark: '\u9AD8\u6E29\u5DE5\u51B5' },
    { code: 'CG-XF-003', material: '\u78B3\u7EA4\u7EF4\u590D\u5408\u6750\u6599', rpmMin: 4000, rpmMax: 12000, coeff: 0.85, manual: 0, reason: null as string | null, remark: '\u8F7B\u578B\u8F6C\u5B50' },
    { code: 'CG-XF-004', material: '\u94DD\u5408\u91D16061', rpmMin: 2000, rpmMax: 6000, coeff: 1.0, manual: 0, reason: null as string | null, remark: '\u6807\u51C6\u914D\u7F6E' },
    { code: 'CG-XF-005', material: '\u954D\u57FA\u5408\u91D1GH4169', rpmMin: 3500, rpmMax: 9000, coeff: 1.15, manual: 1, reason: null as string | null, remark: '\u8010\u8150\u8680\u5DE5\u51B5' },
  ]
  const sensors2 = [
    { code: 'CG-XF-006', material: '\u9676\u74F7\u57FA\u590D\u5408\u6750\u6599', rpmMin: 5000, rpmMax: 15000, coeff: 0.9, manual: 0, reason: null as string | null, remark: '\u8D85\u9AD8\u901F\u8F6C\u5B50' },
    { code: 'CG-XF-007', material: '\u4E0D\u9508\u94A2316L', rpmMin: 2800, rpmMax: 7200, coeff: 1.05, manual: 1, reason: '\u4ECB\u8D28\u7C98\u5EA6\u504F\u9AD8' as string | null, remark: '\u5316\u5DE5\u4E13\u7528' },
    { code: 'CG-XF-008', material: '\u54C8\u6C0F\u5408\u91D1C276', rpmMin: 3200, rpmMax: 8500, coeff: 1.1, manual: 0, reason: null as string | null, remark: '\u5F3A\u8150\u8680\u73AF\u5883' },
  ]
  const insertSensor = db.prepare('INSERT INTO sensor_data (id, sensor_code, batch_id, material_type, rpm_min, rpm_max, coefficient, coefficient_manual, coefficient_reason, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertZone = db.prepare('INSERT INTO safety_zone (id, sensor_id, rpm_min, rpm_max, coefficient, coefficient_source, coefficient_reason, review_status, reviewer, review_comment, reviewed_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertChange = db.prepare('INSERT INTO change_record (id, target_type, target_id, field, old_value, new_value, operator, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertPhoto = db.prepare('INSERT INTO photo_meta (id, sensor_id, filename, url, remark, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)')
  const allSensors = [...sensors.map(s => ({ ...s, batchId: batch1Id })), ...sensors2.map(s => ({ ...s, batchId: batch2Id }))]
  for (const s of allSensors) {
    const sid = uuidv4()
    insertSensor.run(sid, s.code, s.batchId, s.material, s.rpmMin, s.rpmMax, s.coeff, s.manual, s.reason, s.remark, now, now)
    const status = s.manual === 1 && !s.reason ? 'pending' : 'approved'
    const reviewer = status === 'approved' ? '\u5F20\u5DE5' : null
    const reviewComment = status === 'approved' ? '\u6570\u636E\u6821\u9A8C\u901A\u8FC7' : null
    const reviewedAt = status === 'approved' ? now : null
    insertZone.run(uuidv4(), sid, s.rpmMin, s.rpmMax, s.coeff, s.manual ? 'manual' : 'auto', s.reason, status, reviewer, reviewComment, reviewedAt, 1, now, now)
  }
  const sensor2 = db.prepare("SELECT id FROM sensor_data WHERE sensor_code = 'CG-XF-002'").get() as { id: string } | undefined
  const sensor7 = db.prepare("SELECT id FROM sensor_data WHERE sensor_code = 'CG-XF-007'").get() as { id: string } | undefined
  if (sensor2) { insertPhoto.run(uuidv4(), sensor2.id, 'CG-XF-002_\u5B89\u88C5\u7167\u7247.jpg', '/uploads/CG-XF-002_\u5B89\u88C5\u7167\u7247.jpg', '\u5B89\u88C5\u4F4D\u7F6E\u7167\u7247', now) }
  if (sensor7) { insertPhoto.run(uuidv4(), sensor7.id, 'CG-XF-007_\u94ED\u724C\u7167\u7247.jpg', '/uploads/CG-XF-007_\u94ED\u724C\u7167\u7247.jpg', '\u8BBE\u5907\u94ED\u724C', now) }
  if (sensor7) { insertChange.run(uuidv4(), 'sensor', sensor7.id, 'coefficient', '1.0', '1.05', '\u674E\u5DE5', '\u4ECB\u8D28\u7C98\u5EA6\u504F\u9AD8\uFF0C\u9700\u8C03\u6574\u7CFB\u6570', now) }
  if (sensor2) { insertChange.run(uuidv4(), 'sensor', sensor2.id, 'coefficient', '1.0', '1.2', '\u738B\u5DE5', '\u9AD8\u6E29\u5DE5\u51B5\u4FEE\u6B63', now) }
  if (sensor7) {
    const zone7 = db.prepare('SELECT id FROM safety_zone WHERE sensor_id = ?').get(sensor7.id) as { id: string } | undefined
    if (zone7) { insertChange.run(uuidv4(), 'safety_zone', zone7.id, 'coefficient', '1.0', '1.05', '\u674E\u5DE5', '\u4E0E\u4F20\u611F\u5668\u7CFB\u6570\u540C\u6B65', now) }
  }
}

export default db
