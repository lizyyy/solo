CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    weight INTEGER NOT NULL,
    size TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proof_versions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    paper_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    is_color_approved BOOLEAN DEFAULT 0,
    is_paper_approved BOOLEAN DEFAULT 0,
    is_final_version BOOLEAN DEFAULT 0,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    UNIQUE(order_id, version_no)
);

CREATE TABLE IF NOT EXISTS color_values (
    id TEXT PRIMARY KEY,
    proof_version_id TEXT NOT NULL,
    color_type TEXT NOT NULL,
    color_name TEXT NOT NULL,
    c_value INTEGER,
    m_value INTEGER,
    y_value INTEGER,
    k_value INTEGER,
    hex_value TEXT,
    is_out_of_gamut BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proof_version_id) REFERENCES proof_versions(id)
);

CREATE TABLE IF NOT EXISTS confirmations (
    id TEXT PRIMARY KEY,
    proof_version_id TEXT NOT NULL,
    confirmer TEXT NOT NULL,
    confirm_type TEXT NOT NULL,
    result TEXT NOT NULL,
    comments TEXT,
    confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proof_version_id) REFERENCES proof_versions(id)
);

CREATE TABLE IF NOT EXISTS change_logs (
    id TEXT PRIMARY KEY,
    proof_version_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT NOT NULL,
    change_type TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proof_version_id) REFERENCES proof_versions(id)
);

CREATE TABLE IF NOT EXISTS production_reports (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    proof_version_id TEXT NOT NULL,
    report_no TEXT UNIQUE NOT NULL,
    production_date DATE,
    actual_quantity INTEGER,
    result TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (proof_version_id) REFERENCES proof_versions(id)
);

CREATE TABLE IF NOT EXISTS handlers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proof_versions_order ON proof_versions(order_id);
CREATE INDEX IF NOT EXISTS idx_color_values_version ON color_values(proof_version_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_version ON change_logs(proof_version_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_version ON confirmations(proof_version_id);
