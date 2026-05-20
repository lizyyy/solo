const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('创建数据目录:', dataDir);
}

const dbPath = path.join(dataDir, 'vulnerability.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      ecosystem TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, version, ecosystem)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      cve_id TEXT,
      severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
      cvss_score REAL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ANALYZING', 'EXEMPTED', 'FIXING', 'VERIFIED', 'CLOSED')),
      affected_services TEXT,
      exempt_reason TEXT,
      exempt_by TEXT,
      exempt_at DATETIME,
      fix_batch TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      vulnerability_id TEXT NOT NULL,
      verifier TEXT NOT NULL,
      result TEXT NOT NULL,
      comment TEXT,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      vulnerability_id TEXT,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      operator TEXT NOT NULL,
      request_data TEXT,
      response_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
