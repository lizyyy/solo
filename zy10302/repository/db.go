package repository

import (
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteDB struct {
	*sql.DB
}

func NewSQLiteDB(dbPath string) (*SQLiteDB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	return &SQLiteDB{db}, nil
}

func (db *SQLiteDB) InitTables() error {
	createTables := `
	CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		payload TEXT,
		status TEXT NOT NULL,
		priority INTEGER DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		max_retries INTEGER DEFAULT 3,
		retry_count INTEGER DEFAULT 0,
		lease_timeout INTEGER DEFAULT 300
	);

	CREATE TABLE IF NOT EXISTS leases (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		holder_id TEXT NOT NULL,
		holder_name TEXT,
		acquired_at DATETIME NOT NULL,
		expires_at DATETIME NOT NULL,
		renew_count INTEGER DEFAULT 0,
		is_active BOOLEAN DEFAULT 1,
		FOREIGN KEY (task_id) REFERENCES tasks(id)
	);

	CREATE TABLE IF NOT EXISTS execution_results (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		lease_id TEXT NOT NULL,
		holder_id TEXT NOT NULL,
		status TEXT NOT NULL,
		result_data TEXT,
		error_message TEXT,
		started_at DATETIME NOT NULL,
		completed_at DATETIME NOT NULL,
		duration_ms INTEGER NOT NULL,
		FOREIGN KEY (task_id) REFERENCES tasks(id),
		FOREIGN KEY (lease_id) REFERENCES leases(id)
	);

	CREATE TABLE IF NOT EXISTS release_records (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		lease_id TEXT NOT NULL,
		holder_id TEXT NOT NULL,
		released_at DATETIME NOT NULL,
		release_type TEXT NOT NULL,
		reason TEXT,
		preempted_by TEXT,
		FOREIGN KEY (task_id) REFERENCES tasks(id),
		FOREIGN KEY (lease_id) REFERENCES leases(id)
	);

	CREATE TABLE IF NOT EXISTS timeline_events (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		lease_id TEXT,
		event_type TEXT NOT NULL,
		holder_id TEXT,
		message TEXT NOT NULL,
		details TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (task_id) REFERENCES tasks(id)
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
	CREATE INDEX IF NOT EXISTS idx_leases_task_id ON leases(task_id);
	CREATE INDEX IF NOT EXISTS idx_leases_active ON leases(is_active);
	CREATE INDEX IF NOT EXISTS idx_timeline_task_id ON timeline_events(task_id);
	CREATE INDEX IF NOT EXISTS idx_results_task_id ON execution_results(task_id);
	`
	_, err := db.Exec(createTables)
	return err
}

func (db *SQLiteDB) Now() time.Time {
	return time.Now().UTC()
}
