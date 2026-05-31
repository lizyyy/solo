import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'deposit.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS deposit_records (
    id TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    amount REAL NOT NULL,
    deposit_type TEXT NOT NULL DEFAULT '租赁保证金',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'returned', 'suspended')),
    source TEXT NOT NULL DEFAULT '',
    original_remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES deposit_records(id),
    action TEXT NOT NULL CHECK(action IN ('create', 'rejudge', 'rollback', 'supplement')),
    old_status TEXT NOT NULL DEFAULT '',
    new_status TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    diff_summary TEXT NOT NULL DEFAULT '',
    operator TEXT NOT NULL DEFAULT '资金组',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES deposit_records(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('bank_receipt', 'ledger', 'screenshot', 'explanation', 'other')),
    original_remark TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_status ON deposit_records(status);
  CREATE INDEX IF NOT EXISTS idx_records_created ON deposit_records(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_record_id ON audit_logs(record_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_record_id ON attachments(record_id);
`)

const count = db.prepare('SELECT COUNT(*) as cnt FROM deposit_records').get() as { cnt: number }
if (count.cnt === 0) {
  const insertRecord = db.prepare(`
    INSERT INTO deposit_records (id, unit_name, amount, deposit_type, status, source, original_remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, old_status, new_status, reason, diff_summary, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const seedData = [
    { id: 'rec001', unit_name: '华通科技有限公司', amount: 50000, deposit_type: '租赁保证金', status: 'confirmed', source: '2024年度A栋租赁合同', original_remark: '3年期租赁保证金，合同编号HT-2024-A001' },
    { id: 'rec002', unit_name: '万达物业管理有限公司', amount: 120000, deposit_type: '租赁保证金', status: 'suspended', source: '2023年度B栋租赁合同', original_remark: '5年期租赁保证金，对方已进入清算程序，暂挂处理' },
    { id: 'rec003', unit_name: '中建三局第一分公司', amount: 80000, deposit_type: '租赁保证金', status: 'returned', source: '2022年度C栋租赁合同', original_remark: '租赁期满，保证金已退回原账户' },
    { id: 'rec004', unit_name: '深圳市锐信电子有限公司', amount: 35000, deposit_type: '租赁保证金', status: 'pending', source: '2025年度D栋租赁合同', original_remark: '新签合同保证金，待对方确认到账' },
    { id: 'rec005', unit_name: '广州天河商贸集团', amount: 200000, deposit_type: '租赁保证金', status: 'suspended', source: '2021年度E栋租赁合同', original_remark: '合同纠纷中，法院已冻结该笔保证金' },
    { id: 'rec006', unit_name: '北京中科创新科技有限公司', amount: 65000, deposit_type: '租赁保证金', status: 'confirmed', source: '2024年度F栋租赁合同', original_remark: '2年期租赁保证金，已核对银企回单确认' },
    { id: 'rec007', unit_name: '上海浦东物流有限公司', amount: 95000, deposit_type: '租赁保证金', status: 'pending', source: '2025年度G栋租赁合同', original_remark: '仓库租赁保证金，等待财务确认' },
    { id: 'rec008', unit_name: '成都锦城物业发展有限公司', amount: 150000, deposit_type: '租赁保证金', status: 'suspended', source: '2020年度H栋租赁合同', original_remark: '租赁合同提前终止，保证金退回流程中止，待法律部门出具意见' },
  ]

  const transaction = db.transaction(() => {
    for (const item of seedData) {
      insertRecord.run(item.id, item.unit_name, item.amount, item.deposit_type, item.status, item.source, item.original_remark)
      insertLog.run(`log_${item.id}_1`, item.id, 'create', '', item.status, '初始录入', `创建记录，状态: ${item.status}`, '资金组')
    }
  })
  transaction()
}

export function getDb(): Database.Database {
  return db
}
