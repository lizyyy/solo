export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT,
    phone TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    domain TEXT,
    issuer TEXT,
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    serial_number TEXT,
    fingerprint TEXT,
    description TEXT,
    owner_id TEXT,
    owner_name TEXT,
    owner_email TEXT,
    department TEXT,
    source TEXT NOT NULL,
    source_file TEXT,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    certificate_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL,
    actor TEXT,
    FOREIGN KEY (certificate_id) REFERENCES certificates(id)
);

CREATE TABLE IF NOT EXISTS duplicates (
    id TEXT PRIMARY KEY,
    primary_certificate_id TEXT NOT NULL,
    duplicate_certificate_ids TEXT NOT NULL,
    merged_at TEXT NOT NULL,
    FOREIGN KEY (primary_certificate_id) REFERENCES certificates(id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(type);
CREATE INDEX IF NOT EXISTS idx_certificates_expiry_date ON certificates(expiry_date);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_owner ON certificates(owner_id);
CREATE INDEX IF NOT EXISTS idx_history_certificate ON history(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_fingerprint ON certificates(fingerprint);
CREATE INDEX IF NOT EXISTS idx_certificates_serial ON certificates(serial_number);
`;
