import sqlite3
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_no TEXT NOT NULL,
    version INTEGER NOT NULL,
    weight REAL,
    original_weight REAL,
    route TEXT,
    original_route TEXT,
    freight_fee REAL,
    standard_fee REAL,
    shipper TEXT,
    receiver TEXT,
    import_batch TEXT,
    import_time TIMESTAMP,
    update_time TIMESTAMP,
    UNIQUE(shipment_no, version)
);

CREATE TABLE IF NOT EXISTS shipment_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER,
    shipment_no TEXT,
    version INTEGER,
    change_type TEXT,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    change_time TIMESTAMP,
    import_batch TEXT,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE INDEX IF NOT EXISTS idx_changelog_shipment ON shipment_changelog(shipment_no);

CREATE TABLE IF NOT EXISTS bad_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT,
    line_number INTEGER,
    raw_data TEXT,
    error_type TEXT,
    error_message TEXT,
    import_batch TEXT,
    import_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time TIMESTAMP,
    config_hash TEXT,
    total_shipments INTEGER,
    total_findings INTEGER,
    status TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER,
    finding_type TEXT,
    severity TEXT,
    shipment_no TEXT,
    old_version INTEGER,
    new_version INTEGER,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    fee_difference REAL,
    description TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_findings_audit ON audit_findings(audit_run_id);
"""


def get_db_path(project_dir: str) -> str:
    return os.path.join(project_dir, 'data', 'freight_audit.db')


def get_config_path(project_dir: str) -> str:
    return os.path.join(project_dir, 'config.yaml')


def init_db(project_dir: str) -> None:
    data_dir = os.path.join(project_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    db_path = get_db_path(project_dir)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()


def get_connection(project_dir: str) -> sqlite3.Connection:
    db_path = get_db_path(project_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


def get_connection_dict(project_dir: str) -> sqlite3.Connection:
    db_path = get_db_path(project_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = dict_factory
    return conn


def now_timestamp() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
