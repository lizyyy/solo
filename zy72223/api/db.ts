import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

const db = new Database(':memory:')

db.exec(`
  CREATE TABLE settlements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('upload', 'cli', 'api')),
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'imported' CHECK(status IN ('imported', 'notes_supplemented', 'summary_updated'))
  );

  CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES settlements(id),
    trade_date TEXT NOT NULL,
    ex_dividend_date TEXT,
    security_code TEXT NOT NULL,
    security_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    tax_rate REAL,
    tax_rate_note TEXT,
    status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal', 'pending_review', 'reviewed', 'corrected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    correction_reason TEXT
  );

  CREATE TABLE summaries (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES entries(id),
    reason TEXT NOT NULL,
    missing_materials TEXT NOT NULL DEFAULT '[]',
    next_step TEXT NOT NULL,
    responsible_role TEXT NOT NULL CHECK(responsible_role IN ('fund_accountant', 'risk_control')),
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES settlements(id),
    entry_id TEXT REFERENCES entries(id),
    action TEXT NOT NULL CHECK(action IN ('import', 'supplement_note', 'manual_correction', 'rerun', 'review')),
    operator TEXT NOT NULL,
    detail TEXT NOT NULL,
    command TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_entries_settlement ON entries(settlement_id);
  CREATE INDEX idx_entries_status ON entries(status);
  CREATE INDEX idx_summaries_entry ON summaries(entry_id);
  CREATE INDEX idx_audit_logs_settlement ON audit_logs(settlement_id);
  CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
`)

const insertSettlement = db.prepare(
  `INSERT INTO settlements (id, name, source, imported_at, status) VALUES (?, ?, ?, ?, ?)`
)
const insertEntry = db.prepare(
  `INSERT INTO entries (id, settlement_id, trade_date, ex_dividend_date, security_code, security_name, amount, note, tax_rate, tax_rate_note, status, reviewed_by, reviewed_at, correction_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
const insertSummary = db.prepare(
  `INSERT INTO summaries (id, entry_id, reason, missing_materials, next_step, responsible_role, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
)
const insertAuditLog = db.prepare(
  `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
)

const seedData = db.transaction(() => {
  const s1Id = uuidv4()
  const s2Id = uuidv4()
  const e1Id = uuidv4()
  const e2Id = uuidv4()
  const e3Id = uuidv4()
  const e4Id = uuidv4()

  insertSettlement.run(s1Id, '除权日截图-20240615', 'upload', '2024-06-15T10:00:00Z', 'summary_updated')
  insertSettlement.run(s2Id, '人工修正测试-20240616', 'cli', '2024-06-16T09:00:00Z', 'notes_supplemented')

  insertEntry.run(e1Id, s1Id, '2024-06-14', '2024-06-15', '600519', '贵州茅台', 0, '已冲正', 0.10, '红利税10%（补录于2024-06-16）', 'pending_review', null, null, null)
  insertEntry.run(e2Id, s1Id, '2024-06-14', '2024-06-15', '000858', '五粮液', 12500.00, '分红到账', 0.10, '红利税10%', 'normal', null, null, null)
  insertEntry.run(e3Id, s1Id, '2024-06-14', '2024-06-15', '000568', '泸州老窖', 0, '已冲正', null, null, 'pending_review', null, null, null)
  insertEntry.run(e4Id, s2Id, '2024-06-16', '2024-06-17', '601318', '中国平安', 5600.00, '红利到账', 0.10, '红利税10%', 'corrected', null, null, '原金额录入错误，由5800修正为5600')

  insertSummary.run(uuidv4(), e1Id, '金额为0且备注为已冲正，疑似冲销交易，不能直接归为正常', JSON.stringify(['原始冲销凭证']), '需风控同事复核冲销原因后签署', 'risk_control', '2024-06-15T10:01:00Z')
  insertSummary.run(uuidv4(), e3Id, '金额为0且备注为已冲正，且税费率备注尚未补录', JSON.stringify(['税费率备注', '原始冲销凭证']), '先由基金会计林姐补录税费率备注，再交风控同事复核', 'fund_accountant', '2024-06-15T10:01:00Z')

  insertAuditLog.run(uuidv4(), s1Id, null, 'import', '基金会计林姐', '导入除权日截图-20240615，共3条记录', 'settle import --file 除权日截图-20240615.json --source upload', '2024-06-15T10:00:00Z')
  insertAuditLog.run(uuidv4(), s1Id, e1Id, 'supplement_note', '基金会计林姐', '为贵州茅台(600519)补录税费率：红利税10%', null, '2024-06-16T11:00:00Z')
  insertAuditLog.run(uuidv4(), s2Id, e4Id, 'manual_correction', '基金会计林姐', '修正中国平安(601318)金额：5800→5600，原因：原金额录入错误', null, '2024-06-16T09:05:00Z')
  insertAuditLog.run(uuidv4(), s2Id, null, 'import', '基金会计林姐', '导入人工修正测试-20240616，共1条记录', 'settle import --file 人工修正测试-20240616.json --source cli', '2024-06-16T09:00:00Z')
  insertAuditLog.run(uuidv4(), s1Id, null, 'rerun', '基金会计林姐', '重跑导入除权日截图-20240615', 'settle import --file 除权日截图-20240615.json --source upload --rerun', '2024-06-16T14:00:00Z')
})

seedData()

export default db
