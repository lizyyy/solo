import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'load-test.db');

const db = new Database(dbPath);

const initScripts = [
  `
  CREATE TABLE IF NOT EXISTS api_interfaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS traffic_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    total_users INTEGER DEFAULT 0,
    ramp_up_time INTEGER DEFAULT 0,
    hold_time INTEGER DEFAULT 0,
    iterations INTEGER DEFAULT 0,
    config_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS test_batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    is_baseline INTEGER DEFAULT 0,
    traffic_model_id TEXT,
    start_time DATETIME,
    end_time DATETIME,
    duration_seconds INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (traffic_model_id) REFERENCES traffic_models(id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    interface_id TEXT,
    total_requests INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    qps REAL DEFAULT 0,
    tps REAL DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    min_response_time REAL DEFAULT 0,
    max_response_time REAL DEFAULT 0,
    p50_response_time REAL DEFAULT 0,
    p75_response_time REAL DEFAULT 0,
    p95_response_time REAL DEFAULT 0,
    p99_response_time REAL DEFAULT 0,
    throughput REAL DEFAULT 0,
    error_rate REAL DEFAULT 0,
    raw_data_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES test_batches(id),
    FOREIGN KEY (interface_id) REFERENCES api_interfaces(id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS monitoring_snapshots (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    snapshot_time DATETIME NOT NULL,
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,
    network_in REAL,
    network_out REAL,
    db_connection_count INTEGER,
    custom_metrics_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES test_batches(id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    batch_id TEXT,
    related_interface_id TEXT,
    bottleneck_type TEXT,
    assignee TEXT,
    due_date DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES test_batches(id),
    FOREIGN KEY (related_interface_id) REFERENCES api_interfaces(id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS capacity_assessments (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    max_qps REAL,
    safe_qps REAL,
    breaking_point_qps REAL,
    capacity_water_level REAL,
    bottleneck_analysis TEXT,
    recommendations TEXT,
    next_test_plan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES test_batches(id)
  )
  `
];

initScripts.forEach(script => db.exec(script));

console.log('数据库初始化完成');

db.close();
