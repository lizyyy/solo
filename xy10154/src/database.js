const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { generateId, generateHash, formatDate } = require('./utils');

class LogisticsDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'logistics.db');
    this.db = null;
    this.SQL = null;
  }
  
  async init() {
    if (this.db) return;
    
    this.ensureDataDir();
    this.SQL = await initSqlJs();
    
    if (fs.existsSync(this.dbPath)) {
      try {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(buffer);
      } catch (e) {
        console.warn('数据库文件损坏，创建新数据库:', e.message);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }
    
    this.initSchema();
    this.save();
  }
  
  ensureDataDir() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  save() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (e) {
      console.warn('保存数据库失败:', e.message);
    }
  }
  
  initSchema() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY,
        tracking_number TEXT NOT NULL,
        source TEXT,
        carrier TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        data_hash TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        status TEXT NOT NULL,
        location TEXT,
        city TEXT,
        time TEXT NOT NULL,
        message TEXT,
        operator_id TEXT,
        device_id TEXT,
        raw_data TEXT,
        trace_hash TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS validations (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        result TEXT NOT NULL,
        trace_count INTEGER,
        anomalies_total INTEGER,
        anomalies_high INTEGER,
        anomalies_medium INTEGER,
        anomalies_low INTEGER,
        started_at TEXT DEFAULT (datetime('now', 'localtime')),
        completed_at TEXT,
        duration_ms INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS anomalies (
        id TEXT PRIMARY KEY,
        validation_id TEXT NOT NULL,
        package_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        name TEXT,
        message TEXT,
        confidence TEXT,
        action_priority TEXT,
        causes TEXT,
        evidence TEXT,
        suggestions TEXT,
        details TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        name TEXT,
        source TEXT,
        package_count INTEGER,
        started_at TEXT DEFAULT (datetime('now', 'localtime')),
        completed_at TEXT,
        duration_ms INTEGER,
        status TEXT
      )`
    ];
    
    for (const sql of tables) {
      this.db.run(sql);
    }
    
    this.save();
  }
  
  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
  
  _getAsObject(stmt) {
    const columnNames = stmt.getColumnNames();
    const values = stmt.get();
    const obj = {};
    for (let i = 0; i < columnNames.length; i++) {
      obj[columnNames[i]] = values[i];
    }
    return obj;
  }
  
  _run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    this.save();
    return { changes: 1 };
  }
  
  _getOne(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    let result = undefined;
    if (stmt.step()) {
      result = this._getAsObject(stmt);
    }
    
    stmt.free();
    return result;
  }
  
  _getAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
      results.push(this._getAsObject(stmt));
    }
    
    stmt.free();
    return results;
  }
  
  packageExists(trackingNumber) {
    const row = this._getOne('SELECT id FROM packages WHERE tracking_number = ?', [trackingNumber]);
    return row !== undefined;
  }
  
  getPackage(trackingNumber) {
    return this._getOne('SELECT * FROM packages WHERE tracking_number = ?', [trackingNumber]);
  }
  
  getPackageById(id) {
    return this._getOne('SELECT * FROM packages WHERE id = ?', [id]);
  }
  
  insertPackage(trackingNumber, data = {}) {
    const id = generateId();
    const dataHash = generateHash({ trackingNumber, ...data });
    
    this._run(
      'INSERT INTO packages (id, tracking_number, source, carrier, data_hash) VALUES (?, ?, ?, ?, ?)',
      [id, trackingNumber, data.source || null, data.carrier || null, dataHash]
    );
    
    return { id, trackingNumber, dataHash };
  }
  
  upsertPackage(trackingNumber, data = {}) {
    const existing = this.getPackage(trackingNumber);
    
    if (existing) {
      const dataHash = generateHash({ trackingNumber, ...data });
      if (existing.data_hash === dataHash) {
        return { id: existing.id, trackingNumber, dataHash, updated: false };
      }
      
      this._run(
        `UPDATE packages 
         SET source = ?, carrier = ?, data_hash = ?, updated_at = datetime('now', 'localtime')
         WHERE tracking_number = ?`,
        [data.source || existing.source, data.carrier || existing.carrier, dataHash, trackingNumber]
      );
      
      return { id: existing.id, trackingNumber, dataHash, updated: true };
    }
    
    const result = this.insertPackage(trackingNumber, data);
    return { ...result, updated: false, isNew: true };
  }
  
  getPackageTraces(packageId) {
    return this._getAll(
      'SELECT * FROM traces WHERE package_id = ? ORDER BY time ASC',
      [packageId]
    );
  }
  
  insertTrace(packageId, trace) {
    const id = generateId();
    const traceHash = generateHash({
      packageId,
      status: trace.status,
      location: trace.location,
      time: trace.time || trace.timestamp
    });
    
    const existing = this._getOne(
      'SELECT id FROM traces WHERE package_id = ? AND trace_hash = ?',
      [packageId, traceHash]
    );
    
    if (existing) {
      return { id: existing.id, inserted: false };
    }
    
    this._run(
      `INSERT INTO traces (
        id, package_id, status, location, city, time, message,
        operator_id, device_id, raw_data, trace_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        packageId,
        trace.status,
        trace.location || null,
        trace.city || null,
        formatDate(trace.time || trace.timestamp),
        trace.message || trace.description || null,
        trace.operatorId || trace.operator || null,
        trace.deviceId || trace.device || null,
        JSON.stringify(trace),
        traceHash
      ]
    );
    
    return { id, inserted: true };
  }
  
  insertTraces(packageId, traces) {
    const results = [];
    for (const trace of traces) {
      results.push(this.insertTrace(packageId, trace));
    }
    return results;
  }
  
  createRun(data = {}) {
    const id = generateId();
    this._run(
      'INSERT INTO runs (id, name, source, status) VALUES (?, ?, ?, ?)',
      [id, data.name || null, data.source || null, 'running']
    );
    return { id };
  }
  
  completeRun(runId, results) {
    const run = this._getOne('SELECT * FROM runs WHERE id = ?', [runId]);
    if (!run) return null;
    
    const startedAt = new Date(run.started_at).getTime();
    const durationMs = Date.now() - startedAt;
    
    this._run(
      `UPDATE runs 
       SET status = 'completed', package_count = ?, completed_at = datetime('now', 'localtime'), duration_ms = ?
       WHERE id = ?`,
      [results.packageCount || 0, durationMs, runId]
    );
    
    return { runId, status: 'completed', durationMs };
  }
  
  createValidation(packageId, runId, result) {
    const id = generateId();
    const summary = result.summary || {};
    
    this._run(
      `INSERT INTO validations (
        id, package_id, run_id, result, trace_count,
        anomalies_total, anomalies_high, anomalies_medium, anomalies_low,
        started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [
        id,
        packageId,
        runId,
        result.result,
        result.traceCount || 0,
        summary.total || 0,
        summary.high || 0,
        summary.medium || 0,
        summary.low || 0
      ]
    );
    
    return { id };
  }
  
  completeValidation(validationId, durationMs) {
    this._run(
      `UPDATE validations 
       SET completed_at = datetime('now', 'localtime'), duration_ms = ?
       WHERE id = ?`,
      [durationMs, validationId]
    );
  }
  
  insertAnomaly(validationId, packageId, anomaly) {
    const id = generateId();
    
    this._run(
      `INSERT INTO anomalies (
        id, validation_id, package_id, type, severity, name, message,
        confidence, action_priority, causes, evidence, suggestions, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        validationId,
        packageId,
        anomaly.type,
        anomaly.severity,
        anomaly.name || null,
        anomaly.message || null,
        anomaly.confidence || null,
        anomaly.actionPriority || null,
        JSON.stringify(anomaly.causes || []),
        JSON.stringify(anomaly.evidence || []),
        JSON.stringify(anomaly.suggestions || []),
        JSON.stringify(anomaly.details || {})
      ]
    );
    
    return { id };
  }
  
  insertAnomalies(validationId, packageId, anomalies) {
    const results = [];
    for (const anomaly of anomalies) {
      results.push(this.insertAnomaly(validationId, packageId, anomaly));
    }
    return results;
  }
  
  getValidationHistory(limit = 50) {
    return this._getAll(
      `SELECT v.*, p.tracking_number, r.name as run_name
       FROM validations v
       LEFT JOIN packages p ON v.package_id = p.id
       LEFT JOIN runs r ON v.run_id = r.id
       ORDER BY v.started_at DESC
       LIMIT ?`,
      [limit]
    );
  }
  
  getPackageValidations(trackingNumber, limit = 10) {
    const pkg = this.getPackage(trackingNumber);
    if (!pkg) return [];
    
    return this._getAll(
      `SELECT v.*, r.name as run_name
       FROM validations v
       LEFT JOIN runs r ON v.run_id = r.id
       WHERE v.package_id = ?
       ORDER BY v.started_at DESC
       LIMIT ?`,
      [pkg.id, limit]
    );
  }
  
  getValidationAnomalies(validationId) {
    return this._getAll(
      `SELECT * FROM anomalies 
       WHERE validation_id = ? 
       ORDER BY CASE severity 
         WHEN 'high' THEN 1 
         WHEN 'medium' THEN 2 
         WHEN 'low' THEN 3 
         ELSE 4 
       END, type ASC`,
      [validationId]
    );
  }
  
  getRunValidations(runId) {
    return this._getAll(
      `SELECT v.*, p.tracking_number
       FROM validations v
       LEFT JOIN packages p ON v.package_id = p.id
       WHERE v.run_id = ?
       ORDER BY CASE v.result 
         WHEN 'error' THEN 1 
         WHEN 'warning' THEN 2 
         WHEN 'valid' THEN 3 
         ELSE 4 
       END, p.tracking_number`,
      [runId]
    );
  }
  
  getRuns(limit = 20) {
    return this._getAll(
      'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?',
      [limit]
    );
  }
  
  getRun(runId) {
    return this._getOne('SELECT * FROM runs WHERE id = ?', [runId]);
  }
  
  getFailedValidations(limit = 50) {
    return this._getAll(
      `SELECT v.*, p.tracking_number
       FROM validations v
       LEFT JOIN packages p ON v.package_id = p.id
       WHERE v.result = 'error'
       ORDER BY v.started_at DESC
       LIMIT ?`,
      [limit]
    );
  }
  
  deletePackageTraces(packageId) {
    this._run('DELETE FROM traces WHERE package_id = ?', [packageId]);
    return { changes: 1 };
  }
}

module.exports = LogisticsDatabase;
