CREATE TABLE IF NOT EXISTS insurance_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_no VARCHAR(50) UNIQUE NOT NULL,
  report_date DATE NOT NULL,
  reporter_name VARCHAR(100) NOT NULL,
  reporter_phone VARCHAR(20) NOT NULL,
  reporter_id_card VARCHAR(18),
  accident_time DATETIME NOT NULL,
  accident_location VARCHAR(200) NOT NULL,
  accident_type VARCHAR(50) NOT NULL,
  accident_description TEXT,
  cycling_route VARCHAR(200),
  cycling_distance DECIMAL(10, 2),
  cycling_duration INTEGER,
  policy_no VARCHAR(100) NOT NULL,
  insurance_company VARCHAR(100) NOT NULL,
  insurance_amount DECIMAL(15, 2),
  injured_count INTEGER DEFAULT 0,
  death_count INTEGER DEFAULT 0,
  vehicle_type VARCHAR(50),
  frame_no VARCHAR(50),
  vehicle_brand VARCHAR(100),
  photo_source VARCHAR(100),
  photo_count INTEGER DEFAULT 0,
  photo_urls TEXT,
  claim_amount DECIMAL(15, 2),
  claim_package_no VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  responsible_person VARCHAR(100),
  store_name VARCHAR(100),
  store_address VARCHAR(200),
  store_phone VARCHAR(20),
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_date ON insurance_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_status ON insurance_reports(status);
CREATE INDEX IF NOT EXISTS idx_responsible_person ON insurance_reports(responsible_person);
CREATE INDEX IF NOT EXISTS idx_store_name ON insurance_reports(store_name);
CREATE INDEX IF NOT EXISTS idx_accident_time ON insurance_reports(accident_time);
CREATE INDEX IF NOT EXISTS idx_claim_package_no ON insurance_reports(claim_package_no);
