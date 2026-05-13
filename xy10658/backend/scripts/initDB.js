const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS lease_contracts (
    id TEXT PRIMARY KEY,
    room_number TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    tenant_phone TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    monthly_rent REAL NOT NULL,
    deposit_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS renewal_quotes (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    original_end_date TEXT NOT NULL,
    new_end_date TEXT NOT NULL,
    new_monthly_rent REAL NOT NULL,
    deposit_adjustment REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    FOREIGN KEY (contract_id) REFERENCES lease_contracts(id)
  );

  CREATE TABLE IF NOT EXISTS deposit_ledgers (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES lease_contracts(id)
  );

  CREATE TABLE IF NOT EXISTS maintenance_deductions (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    deduction_amount REAL NOT NULL,
    reason TEXT,
    photos TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    FOREIGN KEY (contract_id) REFERENCES lease_contracts(id)
  );

  CREATE TABLE IF NOT EXISTS checkout_inspections (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    overall_condition TEXT NOT NULL,
    notes TEXT,
    total_deductions REAL NOT NULL DEFAULT 0,
    refund_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    FOREIGN KEY (contract_id) REFERENCES lease_contracts(id)
  );

  CREATE TABLE IF NOT EXISTS pending_contracts (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL,
    request_data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES lease_contracts(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_lease_contracts_status ON lease_contracts(status);
  CREATE INDEX IF NOT EXISTS idx_renewal_quotes_contract ON renewal_quotes(contract_id);
  CREATE INDEX IF NOT EXISTS idx_deposit_ledgers_contract ON deposit_ledgers(contract_id);
  CREATE INDEX IF NOT EXISTS idx_maintenance_deductions_contract ON maintenance_deductions(contract_id);
  CREATE INDEX IF NOT EXISTS idx_checkout_inspections_contract ON checkout_inspections(contract_id);
  CREATE INDEX IF NOT EXISTS idx_pending_contracts_status ON pending_contracts(status);
  CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);
`);

console.log('Database initialized successfully!');
db.close();
