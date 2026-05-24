package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create db directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS arbitrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id TEXT NOT NULL UNIQUE,
		vehicle_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'created',
		pickup_time DATETIME,
		return_time DATETIME,
		handler_id TEXT,
		handler_name TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_arbitrations_order_id ON arbitrations(order_id);
	CREATE INDEX IF NOT EXISTS idx_arbitrations_vehicle_id ON arbitrations(vehicle_id);
	CREATE INDEX IF NOT EXISTS idx_arbitrations_user_id ON arbitrations(user_id);
	CREATE INDEX IF NOT EXISTS idx_arbitrations_status ON arbitrations(status);

	CREATE TABLE IF NOT EXISTS damage_details (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL,
		damage_type TEXT NOT NULL,
		location TEXT NOT NULL,
		severity TEXT,
		description TEXT,
		is_new INTEGER NOT NULL DEFAULT 1,
		deduct_amount REAL NOT NULL DEFAULT 0,
		fee_charged INTEGER NOT NULL DEFAULT 0,
		matched_damage_id INTEGER,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_damages_arbitration_id ON damage_details(arbitration_id);
	CREATE INDEX IF NOT EXISTS idx_damages_location ON damage_details(location);

	CREATE TABLE IF NOT EXISTS photos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL,
		photo_type TEXT NOT NULL,
		photo_url TEXT NOT NULL,
		photo_time DATETIME NOT NULL,
		damage_id INTEGER,
		remark TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_photos_arbitration_id ON photos(arbitration_id);
	CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(photo_type);

	CREATE TABLE IF NOT EXISTS appeals (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL UNIQUE,
		user_id TEXT NOT NULL,
		content TEXT NOT NULL,
		evidence_urls TEXT,
		submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		handler_id TEXT,
		handler_remark TEXT,
		is_approved INTEGER,
		refund_amount REAL,
		handled_at DATETIME,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_appeals_arbitration_id ON appeals(arbitration_id);

	CREATE TABLE IF NOT EXISTS processing_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		operator_id TEXT NOT NULL,
		operator_name TEXT NOT NULL,
		old_status TEXT,
		new_status TEXT,
		remark TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_logs_arbitration_id ON processing_logs(arbitration_id);

	CREATE TABLE IF NOT EXISTS change_diffs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL,
		table_name TEXT NOT NULL,
		record_id INTEGER NOT NULL,
		field_name TEXT NOT NULL,
		old_value TEXT,
		new_value TEXT,
		operator_id TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_diffs_arbitration_id ON change_diffs(arbitration_id);

	CREATE TABLE IF NOT EXISTS conclusions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		arbitration_id INTEGER NOT NULL UNIQUE,
		final_result TEXT NOT NULL,
		final_remark TEXT,
		refund_amount REAL NOT NULL DEFAULT 0,
		handler_id TEXT NOT NULL,
		handler_name TEXT NOT NULL,
		closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (arbitration_id) REFERENCES arbitrations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_conclusions_arbitration_id ON conclusions(arbitration_id);

	CREATE TABLE IF NOT EXISTS vehicle_damage_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		vehicle_id TEXT NOT NULL,
		damage_type TEXT NOT NULL,
		location TEXT NOT NULL,
		severity TEXT,
		description TEXT,
		first_report_order_id TEXT,
		first_report_time DATETIME,
		last_report_order_id TEXT,
		last_report_time DATETIME,
		report_count INTEGER NOT NULL DEFAULT 1,
		is_resolved INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_vehicle_history_vehicle_id ON vehicle_damage_history(vehicle_id);
	CREATE INDEX IF NOT EXISTS idx_vehicle_history_location ON vehicle_damage_history(location);
	`

	_, err := DB.Exec(schema)
	return err
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

func BeginTx() (*sql.Tx, error) {
	return DB.Begin()
}
