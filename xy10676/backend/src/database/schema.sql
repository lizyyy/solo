CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  party_a VARCHAR(200) NOT NULL,
  party_b VARCHAR(200) NOT NULL,
  contract_amount DECIMAL(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_clause TEXT,
  electronic_sign_status VARCHAR(20) DEFAULT 'pending',
  paper_archived BOOLEAN DEFAULT 0,
  payment_nodes TEXT,
  responsible_person VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(100) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS flow_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_data TEXT,
  operator VARCHAR(100) NOT NULL,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  review_status VARCHAR(20) DEFAULT 'pending',
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  exception_type VARCHAR(50) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  resolved BOOLEAN DEFAULT 0,
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contract_no ON contracts(contract_no);
CREATE INDEX idx_contract_status ON contracts(status);
CREATE INDEX idx_responsible_person ON contracts(responsible_person);
CREATE INDEX idx_flow_contract_id ON flow_records(contract_id);
CREATE INDEX idx_history_contract_id ON status_history(contract_id);
CREATE INDEX idx_exceptions_contract_id ON exceptions(contract_id);
