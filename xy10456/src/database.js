const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, '..', 'claims.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS insurance_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      max_payout REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_requirements (
      id TEXT PRIMARY KEY,
      insurance_type_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT NOT NULL,
      is_required INTEGER DEFAULT 1,
      validity_days INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (insurance_type_id) REFERENCES insurance_types(id),
      UNIQUE(insurance_type_id, material_code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_no TEXT NOT NULL UNIQUE,
      insurance_type_id TEXT NOT NULL,
      policy_no TEXT NOT NULL,
      claimant_name TEXT NOT NULL,
      claimant_id_card TEXT NOT NULL,
      incident_date DATETIME NOT NULL,
      claimed_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      current_stage TEXT NOT NULL DEFAULT 'APPLICATION',
      estimated_payout REAL,
      actual_payout REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (insurance_type_id) REFERENCES insurance_types(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS claim_materials (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT,
      file_path TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATETIME,
      status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claim_id) REFERENCES claims(id),
      UNIQUE(claim_id, material_code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_actions (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      reviewer TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claim_id) REFERENCES claims(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplement_notifications (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT,
      reason TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (claim_id) REFERENCES claims(id)
    )
  `);

  saveDatabase();
  
  return db;
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDatabase();
      return { changes: db.getRowsModified() };
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  saveDatabase
};
