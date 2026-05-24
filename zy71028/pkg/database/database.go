package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=1&_journal_mode=WAL")
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = createTables(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS elderly (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		phone TEXT NOT NULL,
		address TEXT NOT NULL,
		health_note TEXT,
		contact_name TEXT NOT NULL,
		contact_phone TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS volunteers (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		phone TEXT NOT NULL,
		area TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS meal_suspensions (
		id TEXT PRIMARY KEY,
		elderly_id TEXT NOT NULL,
		start_date TEXT NOT NULL,
		end_date TEXT NOT NULL,
		reason TEXT NOT NULL,
		status TEXT NOT NULL,
		requested_by TEXT NOT NULL,
		reviewed_by TEXT,
		reviewed_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (elderly_id) REFERENCES elderly(id)
	);

	CREATE TABLE IF NOT EXISTS delivery_routes (
		id TEXT PRIMARY KEY,
		request_id TEXT NOT NULL UNIQUE,
		elderly_id TEXT NOT NULL,
		volunteer_id TEXT,
		date TEXT NOT NULL,
		status TEXT NOT NULL,
		notes TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (elderly_id) REFERENCES elderly(id),
		FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
	);

	CREATE INDEX IF NOT EXISTS idx_routes_elderly_date ON delivery_routes(elderly_id, date);
	CREATE INDEX IF NOT EXISTS idx_routes_status ON delivery_routes(status);
	CREATE INDEX IF NOT EXISTS idx_routes_date ON delivery_routes(date);

	CREATE TABLE IF NOT EXISTS safety_visits (
		id TEXT PRIMARY KEY,
		route_id TEXT NOT NULL UNIQUE,
		result TEXT NOT NULL,
		evidence_url TEXT,
		notes TEXT,
		needs_follow_up BOOLEAN NOT NULL DEFAULT 0,
		follow_up_status TEXT,
		followed_by TEXT,
		followed_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (route_id) REFERENCES delivery_routes(id)
	);

	CREATE INDEX IF NOT EXISTS idx_visits_followup ON safety_visits(needs_follow_up, follow_up_status);

	CREATE TABLE IF NOT EXISTS service_reports (
		id TEXT PRIMARY KEY,
		date TEXT NOT NULL UNIQUE,
		total_deliveries INTEGER NOT NULL DEFAULT 0,
		completed_count INTEGER NOT NULL DEFAULT 0,
		exception_count INTEGER NOT NULL DEFAULT 0,
		suspended_count INTEGER NOT NULL DEFAULT 0,
		normal_visits INTEGER NOT NULL DEFAULT 0,
		no_answer_visits INTEGER NOT NULL DEFAULT 0,
		abnormal_visits INTEGER NOT NULL DEFAULT 0,
		pending_follow_ups INTEGER NOT NULL DEFAULT 0,
		generated_at DATETIME NOT NULL
	);
	`

	_, err := DB.Exec(schema)
	return err
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
