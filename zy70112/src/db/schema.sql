CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    report_no TEXT UNIQUE NOT NULL,
    farmer_name TEXT NOT NULL,
    farmer_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    insurance_policy_no TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    disaster_type TEXT NOT NULL,
    disaster_time TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    plot_name TEXT NOT NULL,
    polygon_geojson TEXT NOT NULL,
    area_sqm REAL NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS weather_evidences (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    weather_type TEXT NOT NULL,
    occurred_time TEXT NOT NULL,
    intensity TEXT NOT NULL,
    source TEXT NOT NULL,
    raw_data TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS photo_versions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    photo_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    uploader TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id),
    UNIQUE(report_id, photo_type, version)
);

CREATE TABLE IF NOT EXISTS dispatches (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    inspector_id TEXT NOT NULL,
    inspector_name TEXT NOT NULL,
    dispatch_time TEXT NOT NULL,
    scheduled_time TEXT,
    actual_time TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    estimated_amount REAL NOT NULL,
    actual_amount REAL,
    calculation_rules TEXT NOT NULL,
    damage_ratio REAL NOT NULL,
    affected_area_sqm REAL NOT NULL,
    unit_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS status_logs (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    operator TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_policy ON reports(insurance_policy_no);
CREATE INDEX IF NOT EXISTS idx_plots_report ON plots(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_report ON photo_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_report ON status_logs(report_id);
