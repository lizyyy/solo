CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_type TEXT NOT NULL,
    source_file TEXT,
    import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'completed',
    record_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    import_hash TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS annotator_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    store_id TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    original_line_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    sentiment_label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_hash TEXT,
    UNIQUE(comment_id, original_line_no),
    FOREIGN KEY (batch_id) REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS model_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    comment_id TEXT NOT NULL,
    model_version TEXT,
    fragment_text TEXT NOT NULL,
    sentiment_pred TEXT NOT NULL,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS sentiment_drift_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT NOT NULL UNIQUE,
    store_id TEXT,
    annotator_comment_id INTEGER,
    model_output_id INTEGER,
    original_sentiment TEXT,
    current_sentiment TEXT,
    drift_detected INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (annotator_comment_id) REFERENCES annotator_comments(id),
    FOREIGN KEY (model_output_id) REFERENCES model_outputs(id)
);

CREATE TABLE IF NOT EXISTS manual_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    old_sentiment TEXT NOT NULL,
    new_sentiment TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    overridden INTEGER DEFAULT 0,
    overridden_by TEXT,
    overridden_at TIMESTAMP,
    note TEXT,
    FOREIGN KEY (record_id) REFERENCES sentiment_drift_records(id)
);

CREATE TABLE IF NOT EXISTS self_check_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (record_id) REFERENCES sentiment_drift_records(id)
);

CREATE INDEX IF NOT EXISTS idx_drift_comment_id ON sentiment_drift_records(comment_id);
CREATE INDEX IF NOT EXISTS idx_drift_status ON sentiment_drift_records(status);
CREATE INDEX IF NOT EXISTS idx_annotator_comment_id ON annotator_comments(comment_id);
CREATE INDEX IF NOT EXISTS idx_model_comment_id ON model_outputs(comment_id);
