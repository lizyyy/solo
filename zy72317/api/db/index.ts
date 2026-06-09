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
      is_force_reimport INTEGER DEFAULT 0,
      is_virtual INTEGER DEFAULT 0
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
      gap_review_info TEXT,
      FOREIGN KEY (source_batch) REFERENCES import_batch(id)
    );

    CREATE INDEX IF NOT EXISTS idx_picking_route_batch ON picking_route(source_batch);
    CREATE INDEX IF NOT EXISTS idx_picking_route_status ON picking_route(status);
    CREATE INDEX IF NOT EXISTS idx_picking_route_original ON picking_route(original_line_no);

    CREATE TABLE IF NOT EXISTS gap_record (
      id TEXT PRIMARY KEY,
      before_line_no INTEGER NOT NULL,
      after_line_no INTEGER NOT NULL,
      missing_count INTEGER NOT NULL,
      before_route_id TEXT,
      after_route_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      review_info TEXT,
      FOREIGN KEY (before_route_id) REFERENCES picking_route(id),
      FOREIGN KEY (after_route_id) REFERENCES picking_route(id)
    );

    CREATE INDEX IF NOT EXISTS idx_gap_record_status ON gap_record(status);

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

    CREATE TABLE IF NOT EXISTS weight_batch (
      id TEXT PRIMARY KEY,
      batch_name TEXT NOT NULL,
      weight_ids TEXT NOT NULL,
      total_weight INTEGER NOT NULL,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parameter_version (
      id TEXT PRIMARY KEY,
      version_no TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      weight_batch_id TEXT NOT NULL,
      has_gap INTEGER DEFAULT 0,
      open_gap_count INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME
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
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_change_log_route ON change_log(route_id);
  `);

  const virtualBatch = db.prepare('SELECT id FROM import_batch WHERE id = ?').get('virtual-supplement-batch');
  if (!virtualBatch) {
    db.prepare(`
      INSERT INTO import_batch (id, file_hash, content_fingerprint, file_name, total_rows, operator, is_virtual)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      'virtual-supplement-batch',
      'virtual-hash-supplement',
      'virtual-fingerprint-supplement',
      '[人工补录批次]',
      0,
      'system'
    );
  }

  const weightCount = db.prepare('SELECT COUNT(*) as count FROM score_weight').get() as { count: number };
  const weightIds: string[] = [];
  if (weightCount.count === 0) {
    const insertWeight = db.prepare(`
      INSERT INTO score_weight (id, dimension, weight, description)
      VALUES (?, ?, ?, ?)
    `);
    insertWeight.run('w1', '拣货距离', 40, '路径总长度，单位米');
    insertWeight.run('w2', '拣货时间', 30, '预计完成时间，单位分钟');
    insertWeight.run('w3', '订单优先级', 20, '紧急订单优先处理');
    insertWeight.run('w4', '货区集中度', 10, '同一货区订单合并处理');
    weightIds.push('w1', 'w2', 'w3', 'w4');
  } else {
    const rows = db.prepare('SELECT id FROM score_weight ORDER BY id').all() as { id: string }[];
    weightIds.push(...rows.map(r => r.id));
  }

  const weightBatch = db.prepare('SELECT id FROM weight_batch WHERE id = ?').get('weight-batch-default');
  if (!weightBatch) {
    db.prepare(`
      INSERT INTO weight_batch (id, batch_name, weight_ids, total_weight)
      VALUES (?, ?, ?, ?)
    `).run(
      'weight-batch-default',
      '默认评分权重配置',
      JSON.stringify(weightIds),
      100
    );
  }
}

initializeDatabase();

export default db;
