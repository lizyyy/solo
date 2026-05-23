package repository

import (
	"database/sql"
	"visitor-pass/internal/config"
)

func Migrate() error {
	db := config.DB

	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS batches (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			source TEXT NOT NULL,
			status TEXT NOT NULL,
			is_frozen BOOLEAN DEFAULT 0,
			frozen_at DATETIME,
			frozen_by TEXT,
			total_records INTEGER DEFAULT 0,
			failed_records INTEGER DEFAULT 0,
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS visitor_appointments (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			visitor_name TEXT NOT NULL,
			visitor_id_card TEXT NOT NULL,
			visitor_phone TEXT,
			license_plate TEXT,
			visit_date DATETIME NOT NULL,
			visit_end_date DATETIME NOT NULL,
			visit_reason TEXT,
			visitor_company TEXT,
			host_name TEXT,
			host_department TEXT,
			access_area TEXT,
			status TEXT NOT NULL,
			is_frozen BOOLEAN DEFAULT 0,
			frozen_at DATETIME,
			frozen_by TEXT,
			created_by TEXT NOT NULL,
			reviewed_by TEXT,
			reviewed_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (batch_id) REFERENCES batches(id)
		)`,
		`CREATE TABLE IF NOT EXISTS gate_records (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			gate_name TEXT NOT NULL,
			pass_direction TEXT NOT NULL,
			pass_time DATETIME NOT NULL,
			license_plate TEXT,
			visitor_name TEXT,
			visitor_id_card TEXT,
			temperature REAL,
			staff_name TEXT,
			image_path TEXT,
			status TEXT NOT NULL,
			matched_appt_id TEXT,
			match_status TEXT,
			reconciled BOOLEAN DEFAULT 0,
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (batch_id) REFERENCES batches(id),
			FOREIGN KEY (matched_appt_id) REFERENCES visitor_appointments(id)
		)`,
		`CREATE TABLE IF NOT EXISTS temp_plate_images (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			image_file_name TEXT NOT NULL,
			image_hash TEXT NOT NULL,
			license_plate TEXT,
			recognized_plate TEXT,
			recognition_confidence REAL,
			capture_time DATETIME NOT NULL,
			capture_gate TEXT,
			status TEXT NOT NULL,
			matched_gate_id TEXT,
			match_status TEXT,
			reconciled BOOLEAN DEFAULT 0,
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (batch_id) REFERENCES batches(id),
			FOREIGN KEY (matched_gate_id) REFERENCES gate_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS reconciliation_results (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			reconcile_date DATETIME NOT NULL,
			total_appointments INTEGER DEFAULT 0,
			total_gate_records INTEGER DEFAULT 0,
			total_plate_images INTEGER DEFAULT 0,
			matched_count INTEGER DEFAULT 0,
			unmatched_count INTEGER DEFAULT 0,
			cross_day_risk_count INTEGER DEFAULT 0,
			expired_not_revoked INTEGER DEFAULT 0,
			status TEXT NOT NULL,
			report_path TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (batch_id) REFERENCES batches(id)
		)`,
		`CREATE TABLE IF NOT EXISTS import_failures (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			source_type TEXT NOT NULL,
			row_number INTEGER NOT NULL,
			raw_data TEXT NOT NULL,
			failure_reason TEXT NOT NULL,
			field_errors TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (batch_id) REFERENCES batches(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			username TEXT NOT NULL,
			role TEXT NOT NULL,
			action TEXT NOT NULL,
			resource_type TEXT NOT NULL,
			resource_id TEXT,
			old_value TEXT,
			new_value TEXT,
			ip_address TEXT,
			user_agent TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_appt_batch ON visitor_appointments(batch_id)`,
		`CREATE INDEX IF NOT EXISTS idx_appt_date ON visitor_appointments(visit_date)`,
		`CREATE INDEX IF NOT EXISTS idx_appt_frozen ON visitor_appointments(is_frozen)`,
		`CREATE INDEX IF NOT EXISTS idx_gate_batch ON gate_records(batch_id)`,
		`CREATE INDEX IF NOT EXISTS idx_gate_time ON gate_records(pass_time)`,
		`CREATE INDEX IF NOT EXISTS idx_plate_batch ON temp_plate_images(batch_id)`,
		`CREATE INDEX IF NOT EXISTS idx_plate_capture ON temp_plate_images(capture_time)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			return err
		}
	}

	return nil
}

func InitDefaultUsers(tx *sql.Tx) error {
	checkSQL := `SELECT COUNT(*) FROM users`
	var count int
	if err := tx.QueryRow(checkSQL).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	users := []struct {
		id       string
		username string
		password string
		role     string
	}{
		{"u-super", "supervisor", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", "supervisor"},
		{"u-review", "reviewer", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", "reviewer"},
		{"u-entry", "data_entry", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", "data_entry"},
		{"u-read", "readonly", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", "read_only"},
	}

	insertSQL := `INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`
	for _, u := range users {
		if _, err := tx.Exec(insertSQL, u.id, u.username, u.password, u.role); err != nil {
			return err
		}
	}

	return nil
}
