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

const dbPath = path.join(dataDir, 'queue.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS queue_records (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('活动复盘', '关卡草表')),
    status TEXT NOT NULL CHECK(status IN ('待草表', '待确认', '已完成', '已驳回')) DEFAULT '待草表',
    submitted_by TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL DEFAULT '',
    is_duplicate INTEGER NOT NULL DEFAULT 0,
    is_anomaly INTEGER NOT NULL DEFAULT 0,
    anomaly_reason TEXT,
    related_record_id TEXT,
    FOREIGN KEY (related_record_id) REFERENCES queue_records(id)
  );

  CREATE TABLE IF NOT EXISTS status_changes (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    reason TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (record_id) REFERENCES queue_records(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now')),
    detail TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (record_id) REFERENCES queue_records(id)
  );
`)

const countRow = db.prepare('SELECT COUNT(*) as count FROM queue_records').get() as { count: number }
if (countRow.count === 0) {
  const insertRecords = db.prepare(`
    INSERT INTO queue_records (id, activity_id, source, status, submitted_by, content, is_duplicate, is_anomaly, anomaly_reason) VALUES
      ('rec-001', 'ACT-2026-001', '活动复盘', '待草表', '张运营', '夏季活动复盘：玩家参与度超预期30%', 0, 0, NULL),
      ('rec-002', 'ACT-2026-002', '活动复盘', '待确认', '李策划', '周末双倍经验活动复盘', 0, 0, NULL),
      ('rec-003', 'ACT-2026-003', '活动复盘', '待草表', '张运营', '新服冲榜活动复盘', 0, 1, '关卡草表提交超时48小时'),
      ('rec-004', 'ACT-2026-001', '关卡草表', '待确认', '王策划', '夏季活动关卡草表v2.1', 1, 0, NULL),
      ('rec-005', 'ACT-2026-004', '活动复盘', '已完成', '赵运营', '春节限定活动复盘', 0, 0, NULL)
  `)

  const insertStatusChanges = db.prepare(`
    INSERT INTO status_changes (id, record_id, from_status, to_status, changed_by, reason) VALUES
      ('sc-001', 'rec-002', '待草表', '待确认', '王策划', '关卡草表已提交'),
      ('sc-002', 'rec-005', '待确认', '已完成', '负责人陈', '材料齐全，确认通过')
  `)

  const insertAuditLogs = db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, operator, detail) VALUES
      ('log-001', 'rec-001', '创建', '张运营', '创建活动复盘记录，活动ID: ACT-2026-001'),
      ('log-002', 'rec-002', '创建', '李策划', '创建活动复盘记录，活动ID: ACT-2026-002'),
      ('log-003', 'rec-002', '状态变更', '王策划', '状态从 待草表 变更为 待确认，原因: 关卡草表已提交'),
      ('log-004', 'rec-003', '创建', '张运营', '创建活动复盘记录，活动ID: ACT-2026-003，标记异常: 关卡草表提交超时48小时'),
      ('log-005', 'rec-004', '创建', '王策划', '创建关卡草表记录，活动ID: ACT-2026-001，检测到重复提交，关联已有记录 rec-001'),
      ('log-006', 'rec-004', '重复标记', '系统', '活动ID ACT-2026-001 已存在记录 rec-001，本次提交标记为重复'),
      ('log-007', 'rec-005', '创建', '赵运营', '创建活动复盘记录，活动ID: ACT-2026-004'),
      ('log-008', 'rec-005', '人工确认', '负责人陈', '材料齐全，确认通过'),
      ('log-009', 'rec-005', '状态变更', '负责人陈', '状态从 待确认 变更为 已完成，原因: 材料齐全，确认通过')
  `)

  const transaction = db.transaction(() => {
    insertRecords.run()
    insertStatusChanges.run()
    insertAuditLogs.run()
  })
  transaction()
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default db
