package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if _, err := DB.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		return fmt.Errorf("failed to set journal mode: %w", err)
	}

	if _, err := DB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	return nil
}

func CreateTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS members (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		member_no TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		phone TEXT UNIQUE NOT NULL,
		level TEXT DEFAULT '普通会员',
		balance REAL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS stations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		station_no TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		status TEXT DEFAULT '空闲',
		current_queue_id INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (current_queue_id) REFERENCES queue_numbers(id)
	);

	CREATE TABLE IF NOT EXISTS appointments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		appointment_no TEXT UNIQUE NOT NULL,
		member_id INTEGER NOT NULL,
		service_type TEXT NOT NULL,
		appointment_date DATE NOT NULL,
		appointment_time TEXT NOT NULL,
		status TEXT DEFAULT '待确认',
		station_id INTEGER,
		locked_until DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (member_id) REFERENCES members(id),
		FOREIGN KEY (station_id) REFERENCES stations(id)
	);

	CREATE TABLE IF NOT EXISTS queue_numbers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		queue_no TEXT UNIQUE NOT NULL,
		member_id INTEGER,
		appointment_id INTEGER,
		service_type TEXT NOT NULL,
		status TEXT DEFAULT '等待中',
		station_id INTEGER,
		position INTEGER NOT NULL,
		called_at DATETIME,
		started_at DATETIME,
		completed_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (member_id) REFERENCES members(id),
		FOREIGN KEY (appointment_id) REFERENCES appointments(id),
		FOREIGN KEY (station_id) REFERENCES stations(id)
	);

	CREATE TABLE IF NOT EXISTS overnumber_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		queue_id INTEGER NOT NULL,
		original_queue_no TEXT NOT NULL,
		new_queue_id INTEGER,
		reason TEXT NOT NULL,
		requeue_count INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (queue_id) REFERENCES queue_numbers(id),
		FOREIGN KEY (new_queue_id) REFERENCES queue_numbers(id)
	);

	CREATE TABLE IF NOT EXISTS exception_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		api_path TEXT NOT NULL,
		request_method TEXT NOT NULL,
		raw_input TEXT NOT NULL,
		error_message TEXT NOT NULL,
		handling_conclusion TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS queue_reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		report_date DATE UNIQUE NOT NULL,
		total_queue INTEGER DEFAULT 0,
		completed_count INTEGER DEFAULT 0,
		overnumber_count INTEGER DEFAULT 0,
		avg_wait_time REAL DEFAULT 0,
		avg_service_time REAL DEFAULT 0,
		peak_hour TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_numbers(status);
	CREATE INDEX IF NOT EXISTS idx_queue_date ON queue_numbers(created_at);
	CREATE INDEX IF NOT EXISTS idx_appointment_date ON appointments(appointment_date);
	CREATE INDEX IF NOT EXISTS idx_exception_date ON exception_logs(created_at);
	`

	_, err := DB.Exec(schema)
	return err
}

func CloseDB() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

func GetDB() *sql.DB {
	return DB
}
