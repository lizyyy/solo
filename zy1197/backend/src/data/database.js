const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function safeJsonParse(str, defaultValue = null) {
  if (str === null || str === undefined || str === 'null' || str === 'undefined') {
    return defaultValue;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('Failed to parse JSON:', str);
    return defaultValue;
  }
}

class Database {
  constructor(dbPath = null) {
    if (dbPath) {
      this.dbPath = dbPath;
    } else {
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'experiments.db');
    }
    this.db = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const SQL = await initSqlJs();
    
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.initialized = true;
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT NOT NULL,
        status TEXT DEFAULT 'created',
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        reactor_results TEXT,
        proactor_results TEXT,
        comparison TEXT,
        error TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS event_timelines (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL,
        model TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp INTEGER NOT NULL,
        status TEXT,
        error TEXT,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id)
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_experiments_created ON experiments(created_at)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_timelines_experiment ON event_timelines(experiment_id)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_timelines_model ON event_timelines(model)
    `);

    this.save();
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  saveExperiment(experiment) {
    const existing = this.db.prepare('SELECT id FROM experiments WHERE id = ?').get([experiment.id]);
    
    if (existing) {
      this.db.run(`
        UPDATE experiments SET
          name = ?, description = ?, config = ?, status = ?,
          created_at = ?, completed_at = ?, reactor_results = ?,
          proactor_results = ?, comparison = ?, error = ?
        WHERE id = ?
      `, [
        experiment.config.name,
        experiment.config.description,
        JSON.stringify(experiment.config),
        experiment.status,
        experiment.createdAt,
        experiment.completedAt || null,
        experiment.reactorResults ? JSON.stringify(experiment.reactorResults) : null,
        experiment.proactorResults ? JSON.stringify(experiment.proactorResults) : null,
        experiment.comparison ? JSON.stringify(experiment.comparison) : null,
        experiment.error || null,
        experiment.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO experiments (
          id, name, description, config, status, created_at,
          completed_at, reactor_results, proactor_results, comparison, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        experiment.id,
        experiment.config.name,
        experiment.config.description,
        JSON.stringify(experiment.config),
        experiment.status,
        experiment.createdAt,
        experiment.completedAt || null,
        experiment.reactorResults ? JSON.stringify(experiment.reactorResults) : null,
        experiment.proactorResults ? JSON.stringify(experiment.proactorResults) : null,
        experiment.comparison ? JSON.stringify(experiment.comparison) : null,
        experiment.error || null
      ]);
    }

    if (experiment.reactorResults && experiment.reactorResults.timeline) {
      this.saveTimeline(experiment.id, 'Reactor', experiment.reactorResults.timeline);
    }
    if (experiment.proactorResults && experiment.proactorResults.timeline) {
      this.saveTimeline(experiment.id, 'Proactor', experiment.proactorResults.timeline);
    }

    this.save();
  }

  saveTimeline(experimentId, model, events) {
    const deleteStmt = this.db.prepare('DELETE FROM event_timelines WHERE experiment_id = ? AND model = ?');
    deleteStmt.run([experimentId, model]);

    const insertStmt = this.db.prepare(`
      INSERT INTO event_timelines (
        id, experiment_id, model, event_type, event_data,
        timestamp, status, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of events) {
      insertStmt.run([
        event.id,
        experimentId,
        model,
        event.type,
        JSON.stringify(event.data),
        event.timestamp,
        event.status,
        event.error ? JSON.stringify(event.error) : null
      ]);
    }

    this.save();
  }

  getExperiment(experimentId) {
    const row = this.db.prepare('SELECT * FROM experiments WHERE id = ?').get([experimentId]);
    if (!row) return null;
    return this.rowToExperiment(row);
  }

  getAllExperiments() {
    const rows = this.db.exec('SELECT * FROM experiments ORDER BY created_at DESC');
    if (!rows || rows.length === 0) return [];
    
    const columns = rows[0].columns;
    return rows[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return this.rowToExperiment(obj);
    });
  }

  rowToExperiment(row) {
    return {
      id: row.id,
      config: safeJsonParse(row.config, {}),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      status: row.status,
      reactorResults: safeJsonParse(row.reactor_results, null),
      proactorResults: safeJsonParse(row.proactor_results, null),
      comparison: safeJsonParse(row.comparison, null),
      error: row.error
    };
  }

  getTimeline(experimentId, model = null) {
    let query = 'SELECT * FROM event_timelines WHERE experiment_id = ?';
    const params = [experimentId];

    if (model) {
      query += ' AND model = ?';
      params.push(model);
    }

    query += ' ORDER BY timestamp ASC';

    const rows = this.db.exec(query, params);
    if (!rows || rows.length === 0) return [];

    const columns = rows[0].columns;
    return rows[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id,
        type: obj.event_type,
        data: safeJsonParse(obj.event_data, {}),
        timestamp: obj.timestamp,
        status: obj.status,
        error: safeJsonParse(obj.error, null),
        model: obj.model
      };
    });
  }

  deleteExperiment(experimentId) {
    this.db.run('DELETE FROM event_timelines WHERE experiment_id = ?', [experimentId]);
    const result = this.db.run('DELETE FROM experiments WHERE id = ?', [experimentId]);
    this.save();
    return result.getRowsModified() > 0;
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = Database;
