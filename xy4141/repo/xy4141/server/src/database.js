const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const pluginsDir = path.join(dataDir, 'plugins');
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

const samplesDir = path.join(dataDir, 'samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'wasm-validator.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    vendor TEXT,
    description TEXT,
    manifest TEXT NOT NULL,
    wasm_path TEXT NOT NULL,
    input_schema TEXT,
    output_schema TEXT,
    error_codes TEXT,
    max_memory_mb INTEGER DEFAULT 64,
    max_timeout_ms INTEGER DEFAULT 5000,
    performance_threshold_ms INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
  );

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sample_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plugin_id) REFERENCES plugins(id)
  );

  CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    input_data TEXT NOT NULL,
    expected_output TEXT,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    sample_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    input_data TEXT NOT NULL,
    output_data TEXT,
    execution_time_ms INTEGER,
    memory_usage_mb INTEGER,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    error_code TEXT,
    schema_validation_passed BOOLEAN,
    schema_errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (sample_id) REFERENCES samples(id),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE,
    reviewer TEXT,
    conclusion TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_plugins_name ON plugins(name);
  CREATE INDEX IF NOT EXISTS idx_plugins_version ON plugins(version);
  CREATE INDEX IF NOT EXISTS idx_batches_plugin ON batches(plugin_id);
  CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
  CREATE INDEX IF NOT EXISTS idx_samples_batch ON samples(batch_id);
  CREATE INDEX IF NOT EXISTS idx_runs_batch ON runs(batch_id);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
  CREATE INDEX IF NOT EXISTS idx_reviews_run ON reviews(run_id);
`);

module.exports = {
  db,
  dataDir,
  pluginsDir,
  samplesDir
};
