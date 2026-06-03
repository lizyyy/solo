import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'derivative.db')

const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'importing',
    total_records INTEGER NOT NULL DEFAULT 0,
    discrepancy_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    pending_review_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS confirmation_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    business_no TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'normal',
    ex_dividend_date TEXT,
    amount REAL NOT NULL DEFAULT 0,
    fee_amount REAL,
    principal_amount REAL,
    tax_rate REAL,
    tax_rate_remark TEXT,
    caliber_type TEXT,
    source TEXT NOT NULL DEFAULT 'confirmation',
    status TEXT NOT NULL DEFAULT 'normal',
    split_detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discrepancies (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    business_no TEXT NOT NULL,
    record_id TEXT REFERENCES confirmation_records(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    description TEXT NOT NULL,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    role TEXT NOT NULL,
    detail TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_batch ON confirmation_records(batch_id);
  CREATE INDEX IF NOT EXISTS idx_records_business_no ON confirmation_records(business_no);
  CREATE INDEX IF NOT EXISTS idx_discrepancies_batch ON discrepancies(batch_id);
  CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_batch ON audit_logs(batch_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
`)

function seedData() {
  const batchCount = db.prepare('SELECT COUNT(*) as cnt FROM batches WHERE id = ?').get('BATCH-001') as { cnt: number }
  if (batchCount.cnt > 0) return

  const now = new Date().toISOString()

  const insertBatch = db.prepare(`
    INSERT INTO batches (id, name, created_at, status, total_records, discrepancy_count, conflict_count, pending_review_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertBatch.run('BATCH-001', '2024年6月衍生品确认书批次', now, 'reviewing', 3, 2, 1, 1)

  const insertRecord = db.prepare(`
    INSERT INTO confirmation_records (id, batch_id, business_no, type, ex_dividend_date, amount, fee_amount, principal_amount, tax_rate, tax_rate_remark, caliber_type, source, status, split_detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertRecord.run(
    uuidv4(), 'BATCH-001', 'DRV-2024-001', 'normal', '2024-06-15', 500000, null, null, 10, '税率10%，与确认书一致', 'new', 'confirmation', 'normal', null, now
  )

  insertRecord.run(
    uuidv4(), 'BATCH-001', 'DRV-2024-002', 'fee_principal_split', '2024-06-20', 503500, 3500, 500000, 10, '手续费3,500 + 本金500,000，确认书拆为两行', 'new', 'confirmation', 'pending_review',
    JSON.stringify({
      feeLine: { amount: 3500, description: '衍生品手续费' },
      principalLine: { amount: 500000, description: '衍生品本金' }
    }),
    now
  )

  insertRecord.run(
    uuidv4(), 'BATCH-001', 'DRV-2024-003', 'old_caliber_supplement', '2024-06-15', 300000, null, null, 10, '旧口径：除权日2024-06-10，需补录旧口径数据', 'old', 'tax_remark', 'conflict', null, now
  )

  const insertDiscrepancy = db.prepare(`
    INSERT INTO discrepancies (id, batch_id, business_no, record_id, type, severity, description, evidence, status, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertDiscrepancy.run(
    uuidv4(), 'BATCH-001', 'DRV-2024-002', null, 'split_records', 'warning',
    '业务号DRV-2024-002在确认书中拆分为手续费行(3,500)和本金行(500,000)，需结算主管复核',
    JSON.stringify({
      confirmationData: { businessNo: 'DRV-2024-002', feeLine: 3500, principalLine: 500000, totalAmount: 503500 },
      taxRemarkData: { businessNo: 'DRV-2024-002', remark: '手续费3,500 + 本金500,000' }
    }),
    'open', null, now, now
  )

  insertDiscrepancy.run(
    uuidv4(), 'BATCH-001', 'DRV-2024-003', null, 'conflict', 'critical',
    '除权日截图显示2024-06-15，但税费率备注显示2024-06-10，存在冲突需人工裁决',
    JSON.stringify({
      confirmationData: { businessNo: 'DRV-2024-003', exDividendDate: '2024-06-15', source: '除权日截图' },
      taxRemarkData: { businessNo: 'DRV-2024-003', exDividendDate: '2024-06-10', source: '税费率备注', caliberType: 'old' }
    }),
    'conflict_pending', null, now, now
  )

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, batch_id, action, actor, role, detail, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertAudit.run(uuidv4(), 'BATCH-001', 'batch_created', 'system', 'fund_accountant', JSON.stringify({ batchName: '2024年6月衍生品确认书批次' }), now)
  insertAudit.run(uuidv4(), 'BATCH-001', 'record_imported', 'system', 'fund_accountant', JSON.stringify({ businessNo: 'DRV-2024-001', type: 'normal' }), now)
  insertAudit.run(uuidv4(), 'BATCH-001', 'record_imported', 'system', 'fund_accountant', JSON.stringify({ businessNo: 'DRV-2024-002', type: 'fee_principal_split' }), now)
  insertAudit.run(uuidv4(), 'BATCH-001', 'record_imported', 'system', 'fund_accountant', JSON.stringify({ businessNo: 'DRV-2024-003', type: 'old_caliber_supplement' }), now)
  insertAudit.run(uuidv4(), 'BATCH-001', 'discrepancy_detected', 'system', 'fund_accountant', JSON.stringify({ businessNo: 'DRV-2024-002', type: 'split_records', severity: 'warning' }), now)
  insertAudit.run(uuidv4(), 'BATCH-001', 'conflict_detected', 'system', 'fund_accountant', JSON.stringify({ businessNo: 'DRV-2024-003', type: 'conflict', severity: 'critical' }), now)
}

seedData()

export function writeAuditLog(batchId: string, action: string, actor: string, role: 'fund_accountant' | 'settlement_supervisor', detail: Record<string, unknown>) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, batch_id, action, actor, role, detail, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(uuidv4(), batchId, action, actor, role, JSON.stringify(detail), new Date().toISOString())
}

export function updateBatchCounts(batchId: string) {
  const recordCount = db.prepare('SELECT COUNT(*) as cnt FROM confirmation_records WHERE batch_id = ?').get(batchId) as { cnt: number }
  const discrepancyCount = db.prepare('SELECT COUNT(*) as cnt FROM discrepancies WHERE batch_id = ?').get(batchId) as { cnt: number }
  const conflictCount = db.prepare("SELECT COUNT(*) as cnt FROM discrepancies WHERE batch_id = ? AND type = 'conflict'").get(batchId) as { cnt: number }
  const pendingReviewCount = db.prepare("SELECT COUNT(*) as cnt FROM confirmation_records WHERE batch_id = ? AND status = 'pending_review'").get(batchId) as { cnt: number }

  db.prepare(`
    UPDATE batches SET total_records = ?, discrepancy_count = ?, conflict_count = ?, pending_review_count = ? WHERE id = ?
  `).run(recordCount.cnt, discrepancyCount.cnt, conflictCount.cnt, pendingReviewCount.cnt, batchId)
}

export { db }
