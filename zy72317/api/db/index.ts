import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'picking-route.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_batch (
      id TEXT PRIMARY KEY,
      file_hash TEXT NOT NULL,
      content_fingerprint TEXT NOT NULL,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_force_reimport INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_import_batch_hash ON import_batch(file_hash);
    CREATE INDEX IF NOT EXISTS idx_import_batch_fingerprint ON import_batch(content_fingerprint);

    CREATE TABLE IF NOT EXISTS picking_route (
      id TEXT PRIMARY KEY,
      original_line_no INTEGER NOT NULL,
      current_line_no INTEGER NOT NULL,
      route_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal',
      source_batch TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_log TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (source_batch) REFERENCES import_batch(id)
    );

    CREATE INDEX IF NOT EXISTS idx_picking_route_batch ON picking_route(source_batch);
    CREATE INDEX IF NOT EXISTS idx_picking_route_status ON picking_route(status);
    CREATE INDEX IF NOT EXISTS idx_picking_route_original ON picking_route(original_line_no);

    CREATE TABLE IF NOT EXISTS score_weight (
      id TEXT PRIMARY KEY,
      dimension TEXT NOT NULL,
      weight INTEGER NOT NULL,
      description TEXT,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parameter_version (
      id TEXT PRIMARY KEY,
      version_no TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      weight_batch_id TEXT,
      has_gap INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME,
      FOREIGN KEY (weight_batch_id) REFERENCES score_weight(id)
    );

    CREATE INDEX IF NOT EXISTS idx_parameter_version_status ON parameter_version(status);

    CREATE TABLE IF NOT EXISTS change_log (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      before_value TEXT,
      after_value TEXT,
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES picking_route(id)
    );

    CREATE INDEX IF NOT EXISTS idx_change_log_route ON change_log(route_id);
  `);

  const weightCount = db.prepare('SELECT COUNT(*) as count FROM score_weight').get() as { count: number };
  if (weightCount.count === 0) {
    const insertWeight = db.prepare(`
      INSERT INTO score_weight (id, dimension, weight, description)
      VALUES (?, ?, ?, ?)
    `);
    insertWeight.run('w1', '拣货距离', 40, '路径总长度，单位米');
    insertWeight.run('w2', '拣货时间', 30, '预计完成时间，单位分钟');
    insertWeight.run('w3', '订单优先级', 20, '紧急订单优先处理');
    insertWeight.run('w4', '货区集中度', 10, '同一货区订单合并处理');
  }
}

initializeDatabase();

export default db;
