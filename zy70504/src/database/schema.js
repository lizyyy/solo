const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/replay.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS isolation_spaces (
        id TEXT PRIMARY KEY,
        namespace TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS event_batches (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        batch_name TEXT NOT NULL,
        source_system TEXT NOT NULL,
        event_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        FOREIGN KEY (space_id) REFERENCES isolation_spaces(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS desensitized_payloads (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        original_event_id TEXT,
        event_type TEXT NOT NULL,
        original_payload TEXT,
        desensitized_payload TEXT NOT NULL,
        desensitization_rules TEXT,
        desensitized_at INTEGER NOT NULL,
        desensitized_by TEXT,
        validation_status TEXT NOT NULL DEFAULT 'pending',
        validation_message TEXT,
        FOREIGN KEY (batch_id) REFERENCES event_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS replay_status (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        current_state TEXT NOT NULL,
        progress_percent INTEGER NOT NULL DEFAULT 0,
        processed_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER,
        last_heartbeat_at INTEGER,
        completed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY (batch_id) REFERENCES event_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS write_interceptions (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        payload_id TEXT NOT NULL,
        original_target TEXT NOT NULL,
        intercepted_target TEXT NOT NULL,
        intercepted_at INTEGER NOT NULL,
        interception_rules TEXT,
        interception_status TEXT NOT NULL,
        response_data TEXT,
        FOREIGN KEY (batch_id) REFERENCES event_batches(id),
        FOREIGN KEY (payload_id) REFERENCES desensitized_payloads(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS replay_reviews (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        summary_title TEXT NOT NULL,
        summary_content TEXT,
        root_cause TEXT,
        impact_assessment TEXT,
        corrective_actions TEXT,
        reviewed_by TEXT,
        reviewed_at INTEGER,
        review_status TEXT NOT NULL DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES event_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        payload_id TEXT,
        exception_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        original_input TEXT NOT NULL,
        processing_evidence TEXT,
        final_conclusion TEXT,
        occurred_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved_by TEXT,
        resolution_notes TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        FOREIGN KEY (batch_id) REFERENCES event_batches(id),
        FOREIGN KEY (payload_id) REFERENCES desensitized_payloads(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        payload_id TEXT,
        exception_id TEXT,
        correction_type TEXT NOT NULL,
        original_value TEXT,
        corrected_value TEXT NOT NULL,
        correction_reason TEXT NOT NULL,
        corrected_by TEXT NOT NULL,
        corrected_at INTEGER NOT NULL,
        approval_status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at INTEGER,
        FOREIGN KEY (batch_id) REFERENCES event_batches(id),
        FOREIGN KEY (payload_id) REFERENCES desensitized_payloads(id),
        FOREIGN KEY (exception_id) REFERENCES exception_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operated_by TEXT NOT NULL,
        operated_at INTEGER NOT NULL,
        namespace TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_space ON event_batches(space_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_namespace ON event_batches(namespace)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_payloads_batch ON desensitized_payloads(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_status_batch ON replay_status(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_interceptions_batch ON write_interceptions(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_exceptions_batch ON exception_records(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_corrections_batch ON manual_corrections(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_batch ON replay_reviews(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_namespace ON audit_logs(namespace)`);

      resolve();
    });
  });
};

module.exports = { db, initDatabase };
