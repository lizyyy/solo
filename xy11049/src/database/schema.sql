CREATE TABLE IF NOT EXISTS maintenance_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_code VARCHAR(20) UNIQUE NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    leader_name VARCHAR(50),
    leader_phone VARCHAR(20),
    responsible_area TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS green_plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_code VARCHAR(50) UNIQUE NOT NULL,
    plant_name VARCHAR(100) NOT NULL,
    plant_type VARCHAR(50),
    location_area VARCHAR(100),
    location_detail TEXT,
    planting_date DATE,
    maintenance_level VARCHAR(20),
    status VARCHAR(20) DEFAULT '正常',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_no VARCHAR(50) UNIQUE NOT NULL,
    team_id INTEGER NOT NULL,
    plant_id INTEGER NOT NULL,
    inspector_name VARCHAR(50),
    inspection_date DATE NOT NULL,
    inspection_time TIME NOT NULL,
    weather_condition VARCHAR(30),
    temperature DECIMAL(4,1),
    plant_health_status VARCHAR(20) NOT NULL,
    issue_type VARCHAR(50),
    issue_description TEXT,
    issue_severity VARCHAR(20) DEFAULT '一般',
    recurrence_count INTEGER DEFAULT 0,
    upgrade_flag BOOLEAN DEFAULT FALSE,
    last_recurrence_date DATE,
    treatment_measure TEXT,
    treatment_person VARCHAR(50),
    follow_up_date DATE,
    record_status VARCHAR(20) DEFAULT '待处理',
    board_sync_status VARCHAR(20) DEFAULT '未同步',
    data_source VARCHAR(30),
    import_batch_no VARCHAR(50),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES maintenance_teams(id),
    FOREIGN KEY (plant_id) REFERENCES green_plants(id)
);

CREATE TABLE IF NOT EXISTS inspection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    operation_type VARCHAR(20) NOT NULL,
    operation_detail TEXT,
    operator VARCHAR(50),
    old_values TEXT,
    new_values TEXT,
    conflict_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES inspection_records(id)
);

CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    file_name VARCHAR(255),
    total_rows INTEGER,
    success_rows INTEGER DEFAULT 0,
    conflict_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    import_status VARCHAR(20) DEFAULT '处理中',
    imported_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(50) NOT NULL,
    row_number INTEGER,
    row_data TEXT,
    error_type VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inspection_plant_date ON inspection_records(plant_id, inspection_date);
CREATE INDEX idx_inspection_team_date ON inspection_records(team_id, inspection_date);
CREATE INDEX idx_inspection_status ON inspection_records(record_status, issue_severity);
