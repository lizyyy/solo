import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'kiln.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS glazes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    firing_temp INTEGER NOT NULL,
    color TEXT DEFAULT '',
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS glaze_conflicts (
    id TEXT PRIMARY KEY,
    glaze_a_id TEXT NOT NULL REFERENCES glazes(id),
    glaze_b_id TEXT NOT NULL REFERENCES glazes(id),
    reason TEXT NOT NULL DEFAULT '釉料冲突'
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_glaze_conflict_pair ON glaze_conflicts(glaze_a_id, glaze_b_id);

  CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id),
    width REAL NOT NULL DEFAULT 0,
    height REAL NOT NULL DEFAULT 0,
    depth REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','firing','completed','rescheduled','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS work_glazes (
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    glaze_id TEXT NOT NULL REFERENCES glazes(id) ON DELETE CASCADE,
    PRIMARY KEY (work_id, glaze_id)
  );

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kiln_name TEXT NOT NULL DEFAULT '1号窑',
    max_width REAL NOT NULL DEFAULT 60,
    max_height REAL NOT NULL DEFAULT 40,
    max_depth REAL NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','firing','completed')),
    fired_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queue_entries (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    work_id TEXT NOT NULL REFERENCES works(id),
    position INTEGER NOT NULL DEFAULT 0,
    queued_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_queue_batch ON queue_entries(batch_id);
  CREATE INDEX IF NOT EXISTS idx_queue_work ON queue_entries(work_id);

  CREATE TABLE IF NOT EXISTS reschedule_logs (
    id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL REFERENCES works(id),
    from_batch_id TEXT NOT NULL REFERENCES batches(id),
    to_batch_id TEXT REFERENCES batches(id),
    reason TEXT NOT NULL DEFAULT '',
    operated_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reschedule_work ON reschedule_logs(work_id);

  CREATE TABLE IF NOT EXISTS firing_reports (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    summary TEXT NOT NULL DEFAULT '',
    work_details TEXT NOT NULL DEFAULT '[]',
    conflict_resolutions TEXT NOT NULL DEFAULT '[]',
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_report_batch ON firing_reports(batch_id);
`)

const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number }
if (studentCount.count === 0) {
  const insertStudents = db.prepare(`
    INSERT INTO students (id, name, phone, notes) VALUES (?, ?, ?, ?)
  `)
  const insertGlazes = db.prepare(`
    INSERT INTO glazes (id, name, firing_temp, color, notes) VALUES (?, ?, ?, ?, ?)
  `)
  const insertGlazeConflicts = db.prepare(`
    INSERT INTO glaze_conflicts (id, glaze_a_id, glaze_b_id, reason) VALUES (?, ?, ?, ?)
  `)
  const insertBatches = db.prepare(`
    INSERT INTO batches (id, name, kiln_name, max_width, max_height, max_depth, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertWorks = db.prepare(`
    INSERT INTO works (id, name, student_id, width, height, depth, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertWorkGlazes = db.prepare(`
    INSERT INTO work_glazes (work_id, glaze_id) VALUES (?, ?)
  `)
  const insertQueueEntries = db.prepare(`
    INSERT INTO queue_entries (id, batch_id, work_id, position, queued_at) VALUES (?, ?, ?, ?, ?)
  `)
  const insertRescheduleLogs = db.prepare(`
    INSERT INTO reschedule_logs (id, work_id, from_batch_id, to_batch_id, reason, operated_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    for (const [id, name, phone, notes] of [
      ['s1', '张小明', '13800001111', '周末班学员'],
      ['s2', '李静', '13800002222', '工作日晚班'],
      ['s3', '王大伟', '13800003333', '高级班，偏好大件'],
      ['s4', '赵美丽', '13800004444', '体验课学员'],
      ['s5', '陈老师', '13800005555', '指导老师，偶尔也做作品'],
    ] as const) {
      insertStudents.run(id, name, phone, notes)
    }

    for (const [id, name, firing_temp, color, notes] of [
      ['g1', '青瓷釉', 1280, '#7BA98F', '经典青瓷'],
      ['g2', '铜红釉', 1280, '#C04851', '还原焰烧成'],
      ['g3', '冰裂纹', 1260, '#E0ECE4', '开片效果'],
      ['g4', '天目釉', 1280, '#2F2F2F', '黑釉系'],
      ['g5', '透明釉', 1260, '#F5F5F5', '基础透明'],
    ] as const) {
      insertGlazes.run(id, name, firing_temp, color, notes)
    }

    for (const [id, a, b, reason] of [
      ['gc1', 'g2', 'g3', '铜红釉与冰裂纹烧成气氛冲突，同窑会导致釉面互污'],
      ['gc2', 'g4', 'g1', '天目釉与青瓷釉对还原气氛要求不同，同窑烧制效果差'],
    ] as const) {
      insertGlazeConflicts.run(id, a, b, reason)
    }

    for (const [id, name, kiln, mw, mh, md, status, created] of [
      ['b1', '第3期-A窑', '1号窑', 60, 40, 60, 'open', '2026-05-25T09:00:00'],
      ['b2', '第3期-B窑', '2号窑', 80, 50, 80, 'open', '2026-05-25T09:30:00'],
      ['b3', '第2期-A窑', '1号窑', 60, 40, 60, 'locked', '2026-05-20T08:00:00'],
      ['b4', '第1期-A窑', '1号窑', 60, 40, 60, 'firing', '2026-05-18T10:00:00'],
    ] as const) {
      insertBatches.run(id, name, kiln, mw, mh, md, status, created)
    }

    for (const [id, name, sid, w, h, d, status, created, updated] of [
      ['w1', '茶杯套装', 's1', 12, 8, 12, 'queued', '2026-05-24T10:00:00', '2026-05-24T10:00:00'],
      ['w2', '花瓶', 's2', 15, 25, 15, 'queued', '2026-05-24T11:00:00', '2026-05-24T11:00:00'],
      ['w3', '大花瓶', 's3', 65, 50, 65, 'pending', '2026-05-24T14:00:00', '2026-05-24T14:00:00'],
      ['w4', '茶碗', 's4', 10, 6, 10, 'queued', '2026-05-24T15:00:00', '2026-05-24T15:00:00'],
      ['w5', '香炉', 's5', 20, 15, 20, 'queued', '2026-05-24T16:00:00', '2026-05-24T16:00:00'],
      ['w6', '小碟', 's1', 8, 2, 8, 'pending', '2026-05-25T09:00:00', '2026-05-25T09:00:00'],
      ['w7', '挂件', 's4', 5, 5, 3, 'rescheduled', '2026-05-23T10:00:00', '2026-05-25T10:00:00'],
      ['w8', '茶壶', 's2', 18, 12, 14, 'queued', '2026-05-25T11:00:00', '2026-05-25T11:00:00'],
      ['w9', '笔洗', 's5', 22, 10, 22, 'completed', '2026-05-15T09:00:00', '2026-05-20T18:00:00'],
      ['w10', '烟灰缸', 's3', 14, 6, 14, 'queued', '2026-05-25T14:00:00', '2026-05-25T14:00:00'],
    ] as const) {
      insertWorks.run(id, name, sid, w, h, d, status, created, updated)
    }

    for (const [workId, glazeId] of [
      ['w1', 'g1'], ['w2', 'g2'], ['w3', 'g2'], ['w4', 'g3'],
      ['w5', 'g4'], ['w6', 'g5'], ['w7', 'g1'], ['w8', 'g2'],
      ['w9', 'g1'], ['w10', 'g4'],
    ] as const) {
      insertWorkGlazes.run(workId, glazeId)
    }

    for (const [id, batchId, workId, pos, queuedAt] of [
      ['qe1', 'b1', 'w1', 1, '2026-05-24T10:30:00'],
      ['qe2', 'b1', 'w2', 2, '2026-05-24T11:30:00'],
      ['qe3', 'b1', 'w4', 3, '2026-05-24T15:30:00'],
      ['qe4', 'b2', 'w5', 1, '2026-05-24T16:30:00'],
      ['qe5', 'b2', 'w8', 2, '2026-05-25T11:30:00'],
      ['qe6', 'b2', 'w10', 3, '2026-05-25T14:30:00'],
      ['qe7', 'b3', 'w9', 1, '2026-05-20T08:30:00'],
    ] as const) {
      insertQueueEntries.run(id, batchId, workId, pos, queuedAt)
    }

    insertRescheduleLogs.run(
      'rl1', 'w7', 'b1', null, '学员赵美丽出差，无法准时取件，申请改期', '张老师', '2026-05-25T10:00:00'
    )
  })

  seed()
  console.log('Seed data inserted.')
}

export default db
