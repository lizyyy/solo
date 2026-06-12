import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

export function initDatabase(): Database.Database {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables(db);
  seedData(db);

  return db;
}

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      new_count INTEGER NOT NULL DEFAULT 0,
      duplicate_current_count INTEGER NOT NULL DEFAULT 0,
      duplicate_history_count INTEGER NOT NULL DEFAULT 0,
      imported_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audio_records (
      id TEXT PRIMARY KEY,
      audio_file_id TEXT NOT NULL,
      audio_file_name TEXT NOT NULL,
      remark TEXT,
      course_name TEXT NOT NULL,
      therapist_name TEXT NOT NULL,
      session_date TEXT NOT NULL,
      duration INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      is_temporary_substitute BOOLEAN NOT NULL DEFAULT 0,
      substitute_source TEXT NOT NULL DEFAULT 'audio_remark',
      authorization_expiry_date TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      error_note TEXT,
      import_batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audio_records_file_id ON audio_records(audio_file_id);
    CREATE INDEX IF NOT EXISTS idx_audio_records_status ON audio_records(status);
    CREATE INDEX IF NOT EXISTS idx_audio_records_substitute ON audio_records(is_temporary_substitute);
    CREATE INDEX IF NOT EXISTS idx_audio_records_batch ON audio_records(import_batch_id);

    CREATE TABLE IF NOT EXISTS authorization_pages (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      authorized_amount DECIMAL(10,2) NOT NULL,
      source_document TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES audio_records(id)
    );

    CREATE TABLE IF NOT EXISTS conflict_records (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      audio_remark_value TEXT NOT NULL,
      authorization_value TEXT NOT NULL,
      audio_remark_source TEXT NOT NULL,
      authorization_source TEXT NOT NULL,
      resolution TEXT,
      resolved_by TEXT,
      resolved_at DATETIME,
      resolution_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES audio_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_conflicts_record ON conflict_records(record_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT NOT NULL,
      affected_result_ids TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES audio_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);
}

function seedData(db: Database.Database): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM import_batches").get() as {
    count: number;
  };
  if (existing.count > 0) return;

  const insertBatch = db.prepare(`
    INSERT INTO import_batches (id, file_name, total_count, new_count, duplicate_current_count, duplicate_history_count, imported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRecord = db.prepare(`
    INSERT INTO audio_records (id, audio_file_id, audio_file_name, remark, course_name, therapist_name, session_date, duration, amount, is_temporary_substitute, substitute_source, authorization_expiry_date, status, import_batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAuth = db.prepare(`
    INSERT INTO authorization_pages (id, record_id, expiry_date, authorized_amount, source_document)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertConflict = db.prepare(`
    INSERT INTO conflict_records (id, record_id, field_name, audio_remark_value, authorization_value, audio_remark_source, authorization_source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, record_id, operator, operator_role, action, field_name, old_value, new_value, reason, affected_result_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertBatch.run("batch_001", "audio_remarks_2026_06_01.csv", 8, 5, 2, 1, "阿梅");

    insertRecord.run(
      "rec_001",
      "AUD001",
      "20260601_上午场_音乐放松.wav",
      "患者反馈良好，节奏稳定",
      "音乐放松治疗",
      "李医生",
      "2026-06-01",
      60,
      300.0,
      0,
      "audio_remark",
      "2026-12-31",
      "normal",
      "batch_001"
    );

    insertRecord.run(
      "rec_002",
      "AUD002",
      "20260601_下午场_认知训练.wav",
      "临时替补王医生，只在群里说了一句",
      "认知训练治疗",
      "王医生(替补)",
      "2026-06-01",
      45,
      225.0,
      1,
      "group_message",
      "2026-12-31",
      "pending_review",
      "batch_001"
    );

    insertRecord.run(
      "rec_003",
      "AUD003",
      "20260601_上午场_情绪疏导.wav",
      "授权到2026-06-30",
      "情绪疏导治疗",
      "张医生",
      "2026-06-01",
      60,
      300.0,
      0,
      "audio_remark",
      "2026-06-30",
      "conflict",
      "batch_001"
    );

    insertRecord.run(
      "rec_004",
      "AUD001",
      "20260601_上午场_音乐放松.wav",
      "历史导入重复",
      "音乐放松治疗",
      "李医生",
      "2026-06-01",
      60,
      300.0,
      0,
      "audio_remark",
      "2026-12-31",
      "duplicate_history",
      "batch_001"
    );

    insertRecord.run(
      "rec_005",
      "AUD004",
      "20260601_下午场_团体治疗.wav",
      "本次导入重复",
      "团体音乐治疗",
      "赵医生",
      "2026-06-01",
      90,
      450.0,
      0,
      "audio_remark",
      "2026-12-31",
      "duplicate_current",
      "batch_001"
    );

    insertRecord.run(
      "rec_006",
      "AUD005",
      "20260602_上午场_睡眠改善.wav",
      "患者入睡时间缩短",
      "睡眠改善治疗",
      "刘医生",
      "2026-06-02",
      60,
      300.0,
      0,
      "audio_remark",
      "2026-12-31",
      "normal",
      "batch_001"
    );

    insertRecord.run(
      "rec_007",
      "AUD006",
      "20260602_下午场_焦虑缓解.wav",
      "临时替补陈医生，只在群里说了一句",
      "焦虑缓解治疗",
      "陈医生(替补)",
      "2026-06-02",
      60,
      300.0,
      1,
      "group_message",
      "2026-12-31",
      "pending_review",
      "batch_001"
    );

    insertRecord.run(
      "rec_008",
      "AUD007",
      "20260603_上午场_记忆训练.wav",
      "记忆提取训练效果明显",
      "记忆训练治疗",
      "孙医生",
      "2026-06-03",
      45,
      225.0,
      0,
      "audio_remark",
      "2026-12-31",
      "normal",
      "batch_001"
    );

    insertAuth.run("auth_001", "rec_001", "2026-12-31", 300.0, "授权协议_2026.pdf");
    insertAuth.run("auth_002", "rec_002", "2026-12-31", 225.0, "授权协议_2026.pdf");
    insertAuth.run("auth_003", "rec_003", "2026-12-31", 300.0, "授权协议_2026.pdf");
    insertAuth.run("auth_004", "rec_004", "2026-12-31", 300.0, "授权协议_2026.pdf");
    insertAuth.run("auth_005", "rec_005", "2026-12-31", 450.0, "授权协议_2026.pdf");
    insertAuth.run("auth_006", "rec_006", "2026-12-31", 300.0, "授权协议_2026.pdf");
    insertAuth.run("auth_007", "rec_007", "2026-12-31", 300.0, "授权协议_2026.pdf");
    insertAuth.run("auth_008", "rec_008", "2026-12-31", 225.0, "授权协议_2026.pdf");

    insertConflict.run(
      "conf_001",
      "rec_003",
      "authorization_expiry_date",
      "2026-06-30",
      "2026-12-31",
      "audio_remark:AUD003",
      "authorization_pages:auth_003"
    );

    insertAudit.run(
      "audit_001",
      "rec_003",
      "系统",
      "system",
      "冲突检测",
      "authorization_expiry_date",
      "2026-06-30",
      "2026-12-31",
      "音频备注与授权期限页不一致，待人工处理",
      '["result_003"]'
    );
  });

  transaction();
}

export const db = initDatabase();
