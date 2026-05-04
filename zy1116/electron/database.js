const Database = require('better-sqlite3')

class TheaterDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
  }

  init() {
    this.createTables()
    this.createIndexes()
  }

  createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS shows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        venue TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        name TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_time INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        description TEXT,
        "order" INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS actors (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        phone TEXT,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS props (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        name TEXT NOT NULL,
        location TEXT,
        status TEXT DEFAULT 'stored',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS microphones (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        name TEXT NOT NULL,
        channel INTEGER,
        battery_level INTEGER DEFAULT 100,
        status TEXT DEFAULT 'available',
        current_holder_id TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
        FOREIGN KEY (current_holder_id) REFERENCES actors(id)
      )`,
      `CREATE TABLE IF NOT EXISTS cues (
        id TEXT PRIMARY KEY,
        scene_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        start_time INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        "order" INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        delay_reason TEXT,
        delay_seconds INTEGER DEFAULT 0,
        actual_start_time INTEGER,
        actual_end_time INTEGER,
        executed_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS cue_actors (
        cue_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        PRIMARY KEY (cue_id, actor_id),
        FOREIGN KEY (cue_id) REFERENCES cues(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS cue_props (
        cue_id TEXT NOT NULL,
        prop_id TEXT NOT NULL,
        action TEXT NOT NULL,
        PRIMARY KEY (cue_id, prop_id),
        FOREIGN KEY (cue_id) REFERENCES cues(id) ON DELETE CASCADE,
        FOREIGN KEY (prop_id) REFERENCES props(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS cue_microphones (
        cue_id TEXT NOT NULL,
        microphone_id TEXT NOT NULL,
        action TEXT NOT NULL,
        PRIMARY KEY (cue_id, microphone_id),
        FOREIGN KEY (cue_id) REFERENCES cues(id) ON DELETE CASCADE,
        FOREIGN KEY (microphone_id) REFERENCES microphones(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        description TEXT NOT NULL,
        affected_cue_ids TEXT,
        resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS execution_logs (
        id TEXT PRIMARY KEY,
        cue_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (cue_id) REFERENCES cues(id) ON DELETE CASCADE
      )`
    ]

    tables.forEach(sql => this.db.exec(sql))
  }

  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_programs_show_id ON programs(show_id)',
      'CREATE INDEX IF NOT EXISTS idx_scenes_program_id ON scenes(program_id)',
      'CREATE INDEX IF NOT EXISTS idx_actors_show_id ON actors(show_id)',
      'CREATE INDEX IF NOT EXISTS idx_props_show_id ON props(show_id)',
      'CREATE INDEX IF NOT EXISTS idx_microphones_show_id ON microphones(show_id)',
      'CREATE INDEX IF NOT EXISTS idx_cues_scene_id ON cues(scene_id)',
      'CREATE INDEX IF NOT EXISTS idx_conflicts_show_id ON conflicts(show_id)'
    ]

    indexes.forEach(sql => this.db.exec(sql))
  }

  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql)
      return stmt.all(...params)
    } catch (error) {
      console.error('Query error:', error.message)
      throw error
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql)
      return stmt.get(...params)
    } catch (error) {
      console.error('Get error:', error.message)
      throw error
    }
  }

  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql)
      const result = stmt.run(...params)
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes
      }
    } catch (error) {
      console.error('Run error:', error.message)
      throw error
    }
  }

  transaction(fn) {
    const transaction = this.db.transaction(fn)
    return transaction()
  }

  close() {
    if (this.db) {
      this.db.close()
    }
  }
}

module.exports = TheaterDatabase
