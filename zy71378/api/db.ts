import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'webhook_audit.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS callback_records (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    signature_header TEXT,
    signature_status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    order_id TEXT NOT NULL,
    order_status TEXT NOT NULL,
    previous_status TEXT,
    processing_result TEXT NOT NULL DEFAULT 'pending',
    raw_payload TEXT,
    confirm_status TEXT NOT NULL DEFAULT 'pending',
    confirm_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_callbacks_signature_status ON callback_records(signature_status);
  CREATE INDEX IF NOT EXISTS idx_callbacks_order_status ON callback_records(order_status);
  CREATE INDEX IF NOT EXISTS idx_callbacks_confirm_status ON callback_records(confirm_status);
  CREATE INDEX IF NOT EXISTS idx_callbacks_order_id ON callback_records(order_id);
  CREATE INDEX IF NOT EXISTS idx_callbacks_timestamp ON callback_records(timestamp);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS replay_tasks (
    id TEXT PRIMARY KEY,
    callback_id TEXT NOT NULL REFERENCES callback_records(id),
    status TEXT NOT NULL DEFAULT 'queued',
    idempotency_key TEXT NOT NULL,
    idempotency_check TEXT NOT NULL DEFAULT 'skip',
    result TEXT,
    status_before TEXT,
    status_after TEXT,
    executed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_replay_callback_id ON replay_tasks(callback_id);
  CREATE INDEX IF NOT EXISTS idx_replay_status ON replay_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_replay_idempotency ON replay_tasks(idempotency_key);
`)

const countRow = db.prepare('SELECT COUNT(*) as count FROM callback_records').get() as { count: number }

if (countRow.count === 0) {
  const insertCallback = db.prepare(`
    INSERT INTO callback_records (id, webhook_id, timestamp, signature_header, signature_status, retry_count, order_id, order_status, previous_status, processing_result, confirm_status, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const seedData = [
    ['cb_001', 'wh_pay_001', '2026-05-29T10:00:00Z', 'sha256=abc123', 'valid', 0, 'ORD-20260529-001', 'paid', null, 'success', 'confirmed', '{"event":"payment.success","amount":100.00}'],
    ['cb_002', 'wh_pay_002', '2026-05-29T10:05:00Z', 'sha256=expired_sig', 'expired', 2, 'ORD-20260529-002', 'paid', null, 'pending', 'pending', '{"event":"payment.success","amount":200.00}'],
    ['cb_003', 'wh_pay_001', '2026-05-29T10:00:01Z', 'sha256=abc123', 'valid', 1, 'ORD-20260529-001', 'paid', 'paid', 'duplicate', 'pending', '{"event":"payment.success","amount":100.00}'],
    ['cb_004', 'wh_pay_003', '2026-05-29T10:10:00Z', 'sha256=def456', 'valid', 0, 'ORD-20260529-003', 'pending', 'paid', 'pending', 'pending', '{"event":"payment.refund","amount":50.00}'],
    ['cb_005', 'wh_pay_004', '2026-05-29T10:15:00Z', 'sha256=bad_sig', 'invalid', 3, 'ORD-20260529-004', 'failed', null, 'failed', 'pending', '{"event":"payment.failed","amount":300.00}'],
    ['cb_006', 'wh_pay_005', '2026-05-29T10:20:00Z', 'sha256=ghi789', 'valid', 1, 'ORD-20260529-005', 'paid', null, 'success', 'confirmed', '{"event":"payment.success","amount":150.00}'],
    ['cb_007', 'wh_pay_006', '2026-05-29T10:25:00Z', 'sha256=jkl012', 'expired', 1, 'ORD-20260529-006', 'paid', null, 'pending', 'pending', '{"event":"payment.success","amount":250.00}'],
    ['cb_008', 'wh_pay_007', '2026-05-29T10:30:00Z', 'sha256=mno345', 'valid', 0, 'ORD-20260529-007', 'refunded', 'paid', 'success', 'confirmed', '{"event":"payment.refund","amount":100.00}'],
    ['cb_009', 'wh_pay_008', '2026-05-29T10:35:00Z', null, 'invalid', 0, 'ORD-20260529-008', 'pending', null, 'failed', 'pending', '{"event":"payment.pending","amount":500.00}'],
    ['cb_010', 'wh_pay_009', '2026-05-29T10:40:00Z', 'sha256=pqr678', 'valid', 4, 'ORD-20260529-009', 'failed', null, 'failed', 'pending', '{"event":"payment.failed","amount":75.00}'],
  ]

  const insertTransaction = db.transaction((records: any[][]) => {
    for (const record of records) {
      insertCallback.run(...record)
    }
  })

  insertTransaction(seedData)

  const insertReplay = db.prepare(`
    INSERT INTO replay_tasks (id, callback_id, status, idempotency_key, idempotency_check, result, status_before, status_after, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertReplay.run('rp_001', 'cb_002', 'completed', 'idem_ORD-20260529-002_1', 'pass', 'success', 'paid', 'paid', '2026-05-29T11:00:00Z')
  insertReplay.run('rp_002', 'cb_004', 'failed', 'idem_ORD-20260529-003_1', 'fail', 'status_regression_blocked', 'pending', 'pending', '2026-05-29T11:05:00Z')
}

export default db
