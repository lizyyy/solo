import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'schedule.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_no TEXT NOT NULL,
    track_name TEXT,
    file_name TEXT,
    source TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    remark TEXT DEFAULT '',
    original_source TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    modified_by TEXT DEFAULT '',
    modified_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT DEFAULT '',
    new_value TEXT DEFAULT '',
    operator TEXT NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_schedule_status ON schedule(status);
  CREATE INDEX IF NOT EXISTS idx_schedule_source ON schedule(source);
  CREATE INDEX IF NOT EXISTS idx_audit_log_schedule_id ON audit_log(schedule_id);
`)

const countRow = db.prepare('SELECT COUNT(*) as cnt FROM schedule').get() as { cnt: number }
if (countRow.cnt === 0) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const insertSchedule = db.prepare(`
    INSERT INTO schedule (part_no, track_name, file_name, source, version, status, remark, original_source, processed_at, modified_by, modified_at)
    VALUES (@part_no, @track_name, @file_name, @source, @version, @status, @remark, @original_source, @processed_at, @modified_by, @modified_at)
  `)

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (schedule_id, field, old_value, new_value, operator, operated_at)
    VALUES (@schedule_id, @field, @old_value, @new_value, @operator, @operated_at)
  `)

  const seedData = [
    {
      part_no: 'BR-001', track_name: '铜管活塞弹簧', file_name: 'BR-001_piston_spring.wav',
      source: '曲目表A', version: 1, status: 'pending', remark: '',
      original_source: '曲目表A', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'WD-002', track_name: '木管垫片更换', file_name: 'WD-002_pad_replace.wav',
      source: '曲目表A', version: 1, status: 'pending', remark: '',
      original_source: '曲目表A', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'ST-003', track_name: '琴弦张力校准', file_name: 'ST-003_tension_cal.wav',
      source: '曲目表B', version: 1, status: 'scheduled', remark: '已安排下周二维修',
      original_source: '曲目表B', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'BR-004', track_name: '号嘴抛光修复', file_name: 'BR-004_mouthpiece_v1.wav',
      source: '旧版母带', version: 1, status: 'version_conflict',
      remark: '此为旧版母带，同编号存在新版 v2，不可悄悄覆盖',
      original_source: '旧版母带', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'BR-004', track_name: '号嘴抛光修复', file_name: 'BR-004_mouthpiece_v2.wav',
      source: '曲目表C', version: 2, status: 'pending', remark: '新版文件，v1 来自旧版母带',
      original_source: '曲目表C', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'WD-002', track_name: '木管垫片更换', file_name: 'WD-002_pad_replace_dup.wav',
      source: '曲目表A', version: 1, status: 'duplicate',
      remark: '与 WD-002（曲目表A）重复，来源相同',
      original_source: '曲目表A', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'PC-005', track_name: '打击乐鼓皮更换', file_name: 'PC-005_drumhead.wav',
      source: '曲目表D', version: 1, status: 'missing_auth',
      remark: '缺少曲目表D的授权文件，暂不可排程',
      original_source: '曲目表D', processed_at: now, modified_by: '老许', modified_at: now
    },
    {
      part_no: 'ST-006', track_name: '古筝弦轴修复', file_name: 'ST-006_guzheng_retune.wav',
      source: '曲目表E', version: 1, status: 'pending',
      remark: '人工改名：原始文件名 "ST-006_未知弦轴.wav"，经录音师老许确认为古筝弦轴修复',
      original_source: '曲目表E', processed_at: now, modified_by: '老许', modified_at: now
    },
  ]

  const transaction = db.transaction(() => {
    for (const row of seedData) {
      const result = insertSchedule.run(row)
      insertAudit.run({
        schedule_id: result.lastInsertRowid,
        field: '创建',
        old_value: '',
        new_value: `${row.part_no} ${row.track_name}`,
        operator: '系统初始导入',
        operated_at: now,
      })
    }
  })

  transaction()
}

export default db
