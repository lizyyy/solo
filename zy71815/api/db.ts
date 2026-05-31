import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "settlement.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settlement_records (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    activity_name TEXT NOT NULL,
    settlement_period TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    amount REAL NOT NULL,
    handling_fee REAL NOT NULL DEFAULT 0,
    handling_fee_period TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','withdrawn','conflict')),
    dedup_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dedup_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_settlement_store ON settlement_records(store_name);
  CREATE INDEX IF NOT EXISTS idx_settlement_period ON settlement_records(settlement_period);
  CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement_records(status);
  CREATE INDEX IF NOT EXISTS idx_settlement_activity ON settlement_records(activity_name);
  CREATE INDEX IF NOT EXISTS idx_settlement_dedup ON settlement_records(dedup_hash);

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES settlement_records(id),
    operation_type TEXT NOT NULL CHECK(operation_type IN ('import','confirm','withdraw','modify')),
    operator TEXT NOT NULL DEFAULT 'system',
    before_value TEXT,
    after_value TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_oplog_record ON operation_logs(record_id);
  CREATE INDEX IF NOT EXISTS idx_oplog_type ON operation_logs(operation_type);

  CREATE TABLE IF NOT EXISTS batch_operations (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    record_id TEXT NOT NULL REFERENCES settlement_records(id),
    operation TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success','skipped','failed')),
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_batch_batchid ON batch_operations(batch_id);

  CREATE TABLE IF NOT EXISTS import_sessions (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    new_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function computeDedupHash(
  store_name: string,
  activity_name: string,
  settlement_period: string,
  serial_number: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${store_name}|${activity_name}|${settlement_period}|${serial_number}`)
    .digest("hex");
}

const countRow = db
  .prepare("SELECT COUNT(*) as cnt FROM settlement_records")
  .get() as { cnt: number };

if (countRow.cnt === 0) {
  const seedData = [
    { store_name: "杭州旗舰店", activity_name: "春季联名", settlement_period: "2025-01", serial_number: "SN20250101001", amount: 15800.0, handling_fee: 316.0, handling_fee_period: "2025-01", status: "pending" as const },
    { store_name: "杭州旗舰店", activity_name: "春季联名", settlement_period: "2025-02", serial_number: "SN20250201001", amount: 22300.0, handling_fee: 446.0, handling_fee_period: "2025-02", status: "confirmed" as const },
    { store_name: "杭州旗舰店", activity_name: "夏日狂欢联名", settlement_period: "2025-03", serial_number: "SN20250301001", amount: 9500.0, handling_fee: 190.0, handling_fee_period: "2025-03", status: "pending" as const },
    { store_name: "上海南京路店", activity_name: "春季联名", settlement_period: "2025-01", serial_number: "SN20250102001", amount: 31200.0, handling_fee: 624.0, handling_fee_period: "2025-01", status: "confirmed" as const },
    { store_name: "上海南京路店", activity_name: "夏日狂欢联名", settlement_period: "2025-03", serial_number: "SN20250302001", amount: 18700.0, handling_fee: 374.0, handling_fee_period: "2025-03", status: "pending" as const },
    { store_name: "上海南京路店", activity_name: "周年庆联名", settlement_period: "2025-04", serial_number: "SN20250402001", amount: 45000.0, handling_fee: 900.0, handling_fee_period: "2025-04", status: "pending" as const },
    { store_name: "北京三里屯店", activity_name: "春季联名", settlement_period: "2025-01", serial_number: "SN20250103001", amount: 27600.0, handling_fee: 552.0, handling_fee_period: "2025-01", status: "withdrawn" as const },
    { store_name: "北京三里屯店", activity_name: "周年庆联名", settlement_period: "2025-04", serial_number: "SN20250403001", amount: 51000.0, handling_fee: 1020.0, handling_fee_period: "2025-04", status: "pending" as const },
    { store_name: "北京三里屯店", activity_name: "春季联名", settlement_period: "2025-02", serial_number: "SN20250203001", amount: 19800.0, handling_fee: 396.0, handling_fee_period: "2025-02", status: "confirmed" as const },
    { store_name: "成都太古里店", activity_name: "夏日狂欢联名", settlement_period: "2025-03", serial_number: "SN20250304001", amount: 12400.0, handling_fee: 248.0, handling_fee_period: "2025-02", status: "conflict" as const },
    { store_name: "成都太古里店", activity_name: "周年庆联名", settlement_period: "2025-04", serial_number: "SN20250404001", amount: 38600.0, handling_fee: 772.0, handling_fee_period: "2025-03", status: "pending" as const },
    { store_name: "成都太古里店", activity_name: "春季联名", settlement_period: "2025-01", serial_number: "SN20250104001", amount: 8900.0, handling_fee: 178.0, handling_fee_period: "2025-01", status: "confirmed" as const },
    { store_name: "深圳万象城店", activity_name: "周年庆联名", settlement_period: "2025-04", serial_number: "SN20250405001", amount: 62300.0, handling_fee: 1246.0, handling_fee_period: "2025-04", status: "pending" as const },
    { store_name: "深圳万象城店", activity_name: "春季联名", settlement_period: "2025-02", serial_number: "SN20250205001", amount: 16700.0, handling_fee: 334.0, handling_fee_period: "2025-02", status: "withdrawn" as const },
    { store_name: "深圳万象城店", activity_name: "夏日狂欢联名", settlement_period: "2025-03", serial_number: "SN20250305001", amount: 22100.0, handling_fee: 442.0, handling_fee_period: "2025-03", status: "confirmed" as const },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO settlement_records (id, store_name, activity_name, settlement_period, serial_number, amount, handling_fee, handling_fee_period, status, dedup_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO operation_logs (id, record_id, operation_type, operator, before_value, after_value, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const seedTransaction = db.transaction(() => {
    for (const row of seedData) {
      const id = crypto.randomUUID();
      const dedupHash = computeDedupHash(
        row.store_name,
        row.activity_name,
        row.settlement_period,
        row.serial_number
      );
      insertStmt.run(
        id,
        row.store_name,
        row.activity_name,
        row.settlement_period,
        row.serial_number,
        row.amount,
        row.handling_fee,
        row.handling_fee_period,
        row.status,
        dedupHash
      );
      insertLogStmt.run(
        crypto.randomUUID(),
        id,
        "import",
        "system",
        null,
        JSON.stringify(row),
        null
      );
    }
  });

  seedTransaction();
}

export default db;
