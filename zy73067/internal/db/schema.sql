CREATE TABLE IF NOT EXISTS runs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tag        TEXT NOT NULL,
    created_at TEXT NOT NULL,
    summary    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS schedule_records (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id            INTEGER NOT NULL,
    unified_name      TEXT NOT NULL,
    original_names    TEXT NOT NULL DEFAULT '[]',
    spec_model        TEXT NOT NULL DEFAULT '',
    required_qty      INTEGER NOT NULL DEFAULT 0,
    arrived_qty       INTEGER NOT NULL DEFAULT 0,
    eta               TEXT NOT NULL DEFAULT '',
    downtime_start    TEXT NOT NULL DEFAULT '',
    downtime_end      TEXT NOT NULL DEFAULT '',
    will_make_window  INTEGER NOT NULL DEFAULT 0,
    days_late         INTEGER NOT NULL DEFAULT 0,
    is_anomaly        INTEGER NOT NULL DEFAULT 0,
    anomaly_reasons   TEXT NOT NULL DEFAULT '[]',
    raw_source_quote  TEXT NOT NULL DEFAULT '',
    threshold_text    TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pending',
    remark            TEXT NOT NULL DEFAULT '',
    screenshot_ref    TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX IF NOT EXISTS idx_records_run ON schedule_records(run_id);
CREATE INDEX IF NOT EXISTS idx_records_unified ON schedule_records(unified_name);

CREATE TABLE IF NOT EXISTS notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unified_name    TEXT NOT NULL,
    spec_model      TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    remark          TEXT NOT NULL DEFAULT '',
    screenshot_ref  TEXT NOT NULL DEFAULT '',
    threshold_note  TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    UNIQUE(unified_name, spec_model)
);

CREATE TABLE IF NOT EXISTS anomalies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL,
    record_id       INTEGER NOT NULL,
    unified_name    TEXT NOT NULL,
    reasons         TEXT NOT NULL,
    raw_source_quote TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    remark          TEXT NOT NULL DEFAULT '',
    screenshot_ref  TEXT NOT NULL DEFAULT '',
    delta_from_prev TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (run_id) REFERENCES runs(id),
    FOREIGN KEY (record_id) REFERENCES schedule_records(id)
);
CREATE INDEX IF NOT EXISTS idx_anomalies_run ON anomalies(run_id);

CREATE TABLE IF NOT EXISTS screenshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unified_name    TEXT NOT NULL,
    ref             TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screenshots_name ON screenshots(unified_name);
