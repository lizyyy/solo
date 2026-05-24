package store

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteDB struct {
	*sql.DB
}

func NewSQLiteDB(path string) (*SQLiteDB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}
	return &SQLiteDB{DB: db}, nil
}

func (db *SQLiteDB) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS inverters (
			sn TEXT PRIMARY KEY,
			model TEXT NOT NULL,
			manufacturer TEXT NOT NULL,
			production_date TEXT NOT NULL,
			installation_date TEXT,
			station TEXT NOT NULL,
			warranty_period_months INTEGER DEFAULT 24,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS fault_codes (
			code TEXT PRIMARY KEY,
			description TEXT NOT NULL,
			is_warranty_covered INTEGER DEFAULT 1,
			severity TEXT DEFAULT 'medium',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS spare_parts (
			sn TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			model TEXT NOT NULL,
			manufacturer TEXT NOT NULL,
			production_date TEXT NOT NULL,
			status TEXT DEFAULT 'available',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS factory_orders (
			id TEXT PRIMARY KEY,
			inverter_sn TEXT NOT NULL,
			fault_code TEXT NOT NULL,
			spare_part_sn TEXT,
			issue_date TEXT NOT NULL,
			description TEXT,
			status TEXT DEFAULT 'pending',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (inverter_sn) REFERENCES inverters(sn),
			FOREIGN KEY (fault_code) REFERENCES fault_codes(code)
		)`,
		`CREATE TABLE IF NOT EXISTS replacements (
			id TEXT PRIMARY KEY,
			inverter_sn TEXT NOT NULL,
			new_inverter_sn TEXT,
			fault_code TEXT NOT NULL,
			spare_part_sn TEXT,
			factory_order_id TEXT,
			old_inverter_photo_url TEXT,
			new_inverter_photo_url TEXT,
			fault_photo_url TEXT,
			warranty_certificate_url TEXT,
			replacement_date TEXT,
			technician TEXT,
			remark TEXT,
			status TEXT DEFAULT 'draft',
			verification_result TEXT,
			review_result TEXT,
			acceptance_result TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (inverter_sn) REFERENCES inverters(sn),
			FOREIGN KEY (new_inverter_sn) REFERENCES inverters(sn),
			FOREIGN KEY (fault_code) REFERENCES fault_codes(code),
			FOREIGN KEY (spare_part_sn) REFERENCES spare_parts(sn),
			FOREIGN KEY (factory_order_id) REFERENCES factory_orders(id)
		)`,
		`CREATE TABLE IF NOT EXISTS replacement_status_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			replacement_id TEXT NOT NULL,
			from_status TEXT NOT NULL,
			to_status TEXT NOT NULL,
			operator TEXT NOT NULL,
			remark TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (replacement_id) REFERENCES replacements(id)
		)`,
		`CREATE TABLE IF NOT EXISTS warranty_reports (
			id TEXT PRIMARY KEY,
			replacement_id TEXT NOT NULL,
			report_number TEXT UNIQUE NOT NULL,
			content TEXT NOT NULL,
			generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (replacement_id) REFERENCES replacements(id)
		)`,
		`CREATE TABLE IF NOT EXISTS evidence_chain (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			replacement_id TEXT NOT NULL,
			evidence_type TEXT NOT NULL,
			evidence_value TEXT NOT NULL,
			file_url TEXT,
			operator TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (replacement_id) REFERENCES replacements(id)
		)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
