const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

class DatabaseManager {
  constructor(dbPath = config.db.path) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this._initTables();
    this._initIndexes();
  }
  
  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_name TEXT NOT NULL,
        package_path TEXT NOT NULL,
        inspected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        total_risks INTEGER DEFAULT 0,
        critical_risks INTEGER DEFAULT 0,
        warning_risks INTEGER DEFAULT 0,
        notes TEXT,
        UNIQUE(package_path, inspected_at)
      );

      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at DATETIME,
        modified_at DATETIME,
        file_count INTEGER DEFAULT 0,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id)
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        version TEXT,
        voice_part TEXT,
        modified_at DATETIME,
        FOREIGN KEY (package_id) REFERENCES packages(id)
      );

      CREATE TABLE IF NOT EXISTS risks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        file_path TEXT,
        details TEXT,
        is_resolved INTEGER DEFAULT 0,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL,
        risk_id INTEGER,
        content TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id),
        FOREIGN KEY (risk_id) REFERENCES risks(id)
      );

      CREATE TABLE IF NOT EXISTS exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id)
      );
    `);
  }
  
  _initIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inspections_package ON inspections(package_path);
      CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
      CREATE INDEX IF NOT EXISTS idx_risks_inspection ON risks(inspection_id);
      CREATE INDEX IF NOT EXISTS idx_risks_severity ON risks(severity);
      CREATE INDEX IF NOT EXISTS idx_notes_inspection ON notes(inspection_id);
    `);
  }
  
  createInspection(packageName, packagePath) {
    const stmt = this.db.prepare(`
      INSERT INTO inspections (package_name, package_path) 
      VALUES (?, ?)
    `);
    const result = stmt.run(packageName, packagePath);
    return this.getInspectionById(result.lastInsertRowid);
  }
  
  getInspectionById(id) {
    return this.db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
  }
  
  getInspections(limit = 50, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM inspections 
      ORDER BY inspected_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
  
  updateInspectionStatus(id, status, riskCounts = {}) {
    const stmt = this.db.prepare(`
      UPDATE inspections 
      SET status = ?, 
          total_risks = ?, 
          critical_risks = ?, 
          warning_risks = ?
      WHERE id = ?
    `);
    stmt.run(
      status,
      riskCounts.total || 0,
      riskCounts.critical || 0,
      riskCounts.warning || 0,
      id
    );
    return this.getInspectionById(id);
  }
  
  createPackage(inspectionId, packageInfo) {
    const stmt = this.db.prepare(`
      INSERT INTO packages (inspection_id, name, path, created_at, modified_at, file_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      inspectionId,
      packageInfo.name,
      packageInfo.path,
      packageInfo.createdAt,
      packageInfo.modifiedAt,
      packageInfo.fileCount
    );
    return result.lastInsertRowid;
  }
  
  createFile(packageId, fileInfo) {
    const stmt = this.db.prepare(`
      INSERT INTO files (package_id, name, path, size, type, version, voice_part, modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      packageId,
      fileInfo.name,
      fileInfo.path,
      fileInfo.size,
      fileInfo.type,
      fileInfo.version,
      fileInfo.voicePart,
      fileInfo.modifiedAt
    );
    return result.lastInsertRowid;
  }
  
  createRisk(inspectionId, riskInfo) {
    const stmt = this.db.prepare(`
      INSERT INTO risks (inspection_id, type, severity, category, message, file_path, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      inspectionId,
      riskInfo.type,
      riskInfo.severity,
      riskInfo.category,
      riskInfo.message,
      riskInfo.filePath,
      JSON.stringify(riskInfo.details)
    );
    return result.lastInsertRowid;
  }
  
  getRisksByInspection(inspectionId) {
    return this.db.prepare(`
      SELECT * FROM risks WHERE inspection_id = ? ORDER BY severity DESC, created_at
    `).all(inspectionId);
  }
  
  resolveRisk(riskId) {
    const stmt = this.db.prepare(`
      UPDATE risks 
      SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(riskId);
  }
  
  createNote(inspectionId, noteInfo) {
    const stmt = this.db.prepare(`
      INSERT INTO notes (inspection_id, risk_id, content, created_by)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      inspectionId,
      noteInfo.riskId || null,
      noteInfo.content,
      noteInfo.createdBy || 'system'
    );
    return result.lastInsertRowid;
  }
  
  getNotesByInspection(inspectionId) {
    return this.db.prepare(`
      SELECT * FROM notes WHERE inspection_id = ? ORDER BY created_at DESC
    `).all(inspectionId);
  }
  
  getFilesByPackage(packageId) {
    return this.db.prepare(`
      SELECT * FROM files WHERE package_id = ?
    `).all(packageId);
  }
  
  getPackageById(packageId) {
    return this.db.prepare(`
      SELECT * FROM packages WHERE id = ?
    `).get(packageId);
  }
  
  createExport(inspectionId, type, exportPath) {
    const stmt = this.db.prepare(`
      INSERT INTO exports (inspection_id, type, path)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(inspectionId, type, exportPath);
    return result.lastInsertRowid;
  }
  
  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
