const { run } = require('./database');

function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      donor_type TEXT NOT NULL,
      donor_name TEXT,
      donor_tax_id TEXT,
      donor_phone TEXT,
      donor_email TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL,
      invoice_no TEXT UNIQUE,
      invoice_type TEXT NOT NULL,
      title TEXT NOT NULL,
      tax_id TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      merge_request_id TEXT,
      download_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (donation_id) REFERENCES donations(id),
      FOREIGN KEY (merge_request_id) REFERENCES merge_requests(id)
    )`,
    `CREATE TABLE IF NOT EXISTS merge_requests (
      id TEXT PRIMARY KEY,
      request_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      tax_id TEXT,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL,
      merged_invoice_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (merged_invoice_id) REFERENCES invoices(id)
    )`,
    `CREATE TABLE IF NOT EXISTS merge_request_items (
      id TEXT PRIMARY KEY,
      merge_request_id TEXT NOT NULL,
      donation_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (merge_request_id) REFERENCES merge_requests(id),
      FOREIGN KEY (donation_id) REFERENCES donations(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS fund_usages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      amount REAL NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      before_data TEXT,
      after_data TEXT,
      diff TEXT,
      operator TEXT NOT NULL,
      reason TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      endpoint TEXT NOT NULL,
      request_data TEXT NOT NULL,
      response_data TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donations_project ON donations(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_donation ON invoices(donation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_history_entity ON history(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_fund_usages_project ON fund_usages(project_id)`
  ];

  tables.forEach(sql => run(sql));
}

module.exports = { createTables };
