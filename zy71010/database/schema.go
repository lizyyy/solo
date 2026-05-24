package database

const Schema = `
CREATE TABLE IF NOT EXISTS refrigerators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vaccines (
    batch_number TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer TEXT,
    expiry_date DATE NOT NULL,
    total_doses INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vaccine_inventory (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    refrigerator_id TEXT NOT NULL,
    doses_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_stock',
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_number) REFERENCES vaccines(batch_number),
    FOREIGN KEY (refrigerator_id) REFERENCES refrigerators(id)
);

CREATE TABLE IF NOT EXISTS temperature_records (
    id TEXT PRIMARY KEY,
    refrigerator_id TEXT NOT NULL,
    temperature REAL NOT NULL,
    recorded_at DATETIME NOT NULL,
    recorded_by TEXT,
    evidence_id TEXT,
    FOREIGN KEY (refrigerator_id) REFERENCES refrigerators(id)
);

CREATE TABLE IF NOT EXISTS open_records (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    opened_at DATETIME NOT NULL,
    opened_by TEXT NOT NULL,
    doses_used INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'opened',
    closed_at DATETIME,
    closed_by TEXT,
    evidence_id TEXT,
    FOREIGN KEY (inventory_id) REFERENCES vaccine_inventory(id),
    FOREIGN KEY (batch_number) REFERENCES vaccines(batch_number)
);

CREATE TABLE IF NOT EXISTS transfer_records (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    from_refrigerator_id TEXT NOT NULL,
    to_refrigerator_id TEXT NOT NULL,
    doses_count INTEGER NOT NULL,
    transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    transferred_by TEXT NOT NULL,
    reason TEXT,
    evidence_id TEXT,
    FOREIGN KEY (batch_number) REFERENCES vaccines(batch_number),
    FOREIGN KEY (from_refrigerator_id) REFERENCES refrigerators(id),
    FOREIGN KEY (to_refrigerator_id) REFERENCES refrigerators(id)
);

CREATE TABLE IF NOT EXISTS discard_records (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    inventory_id TEXT,
    open_record_id TEXT,
    doses_count INTEGER NOT NULL,
    reason TEXT NOT NULL,
    discarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    discarded_by TEXT NOT NULL,
    confirmed BOOLEAN DEFAULT 0,
    confirmed_at DATETIME,
    confirmed_by TEXT,
    evidence_id TEXT,
    FOREIGN KEY (batch_number) REFERENCES vaccines(batch_number),
    FOREIGN KEY (inventory_id) REFERENCES vaccine_inventory(id),
    FOREIGN KEY (open_record_id) REFERENCES open_records(id)
);

CREATE TABLE IF NOT EXISTS vaccination_records (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    open_record_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    vaccinated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    doctor_signature TEXT NOT NULL,
    evidence_id TEXT,
    FOREIGN KEY (batch_number) REFERENCES vaccines(batch_number),
    FOREIGN KEY (open_record_id) REFERENCES open_records(id)
);

CREATE TABLE IF NOT EXISTS evidence_chains (
    id TEXT PRIMARY KEY,
    business_key TEXT NOT NULL,
    business_type TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_data TEXT,
    submitted_by TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS business_results (
    id TEXT PRIMARY KEY,
    business_key TEXT NOT NULL UNIQUE,
    business_type TEXT NOT NULL,
    result_status TEXT NOT NULL,
    result_data TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recalculated_count INTEGER DEFAULT 0,
    last_recalculated_at DATETIME
);

CREATE TABLE IF NOT EXISTS cold_chain_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    batch_number TEXT,
    refrigerator_id TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    report_data TEXT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_temp_refrigerator_time ON temperature_records(refrigerator_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_open_status ON open_records(status);
CREATE INDEX IF NOT EXISTS idx_evidence_business ON evidence_chains(business_key, business_type);
CREATE INDEX IF NOT EXISTS idx_transfer_batch ON transfer_records(batch_number);
`
