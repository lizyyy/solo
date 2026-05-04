const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../../data/app.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createTables();
    saveDatabase();
  }
  
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS context_packages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      conversations_jsonl TEXT,
      docs_md TEXT,
      tool_results_json TEXT,
      budget_yaml TEXT,
      total_tokens INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS token_strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      max_tokens INTEGER NOT NULL,
      priority_rules TEXT,
      is_default INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      context_package_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      result_json TEXT,
      retained_tokens INTEGER,
      lost_tokens INTEGER,
      risk_level TEXT DEFAULT 'low',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (context_package_id) REFERENCES context_packages(id),
      FOREIGN KEY (strategy_id) REFERENCES token_strategies(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS high_risk_samples (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      sample_type TEXT NOT NULL,
      content TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      format TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_context_packages_task ON context_packages(task_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_evaluations_context ON evaluations(context_package_id)
  `);
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function runQuery(query, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(query);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  if (query.trim().toUpperCase().startsWith('INSERT') || 
      query.trim().toUpperCase().startsWith('UPDATE') || 
      query.trim().toUpperCase().startsWith('DELETE')) {
    saveDatabase();
  }
  
  return results;
}

function getLastInsertId() {
  const result = runQuery('SELECT last_insert_rowid() as id');
  return result[0]?.id;
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  runQuery,
  getLastInsertId,
  DB_PATH
};
