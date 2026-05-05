import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'lb-replay.db');

export let db: Database.Database;

export function initDatabase(): void {
  fs.ensureDirSync(DATA_DIR);
  
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  
  createTables();
}

function createTables(): void {
  // 回放任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS replay_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      policy_version TEXT NOT NULL,
      upstream_count INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      health_event_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      error TEXT
    )
  `);

  // 上游表
  db.exec(`
    CREATE TABLE IF NOT EXISTS upstreams (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE
    )
  `);

  // 实例表
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      upstream_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      weight INTEGER DEFAULT 1,
      status TEXT DEFAULT 'healthy',
      connections INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (upstream_id) REFERENCES upstreams(id) ON DELETE CASCADE
    )
  `);

  // 负载均衡策略表
  db.exec(`
    CREATE TABLE IF NOT EXISTS lb_policies (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // 请求表
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      headers TEXT,
      body TEXT,
      session_id TEXT,
      hash_key TEXT,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE
    )
  `);

  // 健康事件表
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      instance_id TEXT NOT NULL,
      type TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE
    )
  `);

  // 路由决策表
  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_decisions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      selected_instance_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retry_attempt INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
    )
  `);

  // 风险结论表
  db.exec(`
    CREATE TABLE IF NOT EXISTS risk_conclusions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_requests TEXT NOT NULL,
      affected_instances TEXT NOT NULL,
      confirmed INTEGER DEFAULT 0,
      confirmed_by TEXT,
      confirmed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES replay_tasks(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_routing_decisions_task ON routing_decisions(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_routing_decisions_request ON routing_decisions(request_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_conclusions_task ON risk_conclusions(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_task ON requests(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_health_events_task ON health_events(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_instances_task ON instances(task_id)`);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
