package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Database struct {
	db *sql.DB
}

func New(path string) (*Database, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	database := &Database{db: db}
	if err := database.initTables(); err != nil {
		return nil, err
	}

	return database, nil
}

func (d *Database) initTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS reagents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			batch_no TEXT UNIQUE NOT NULL,
			reagent_type TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'frozen',
			thawed_at DATETIME,
			thawed_by TEXT,
			project TEXT,
			expire_at DATETIME,
			discarded_at DATETIME,
			discarded_by TEXT,
			discard_reason TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			request_id TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS usage_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			reagent_id INTEGER NOT NULL,
			batch_no TEXT NOT NULL,
			used_by TEXT NOT NULL,
			project TEXT NOT NULL,
			volume TEXT,
			notes TEXT,
			used_at DATETIME NOT NULL,
			request_id TEXT UNIQUE,
			FOREIGN KEY (reagent_id) REFERENCES reagents(id)
		)`,
		`CREATE TABLE IF NOT EXISTS processing_orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_no TEXT UNIQUE NOT NULL,
			batch_no TEXT NOT NULL,
			type TEXT NOT NULL,
			status TEXT NOT NULL,
			created_by TEXT NOT NULL,
			reviewed_by TEXT,
			review_notes TEXT,
			reviewed_at DATETIME,
			needs_review INTEGER DEFAULT 0,
			created_at DATETIME NOT NULL,
			request_id TEXT UNIQUE
		)`,
		`CREATE TABLE IF NOT EXISTS judgment_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			order_no TEXT NOT NULL,
			judgment TEXT NOT NULL,
			judged_by TEXT NOT NULL,
			notes TEXT,
			judged_at DATETIME NOT NULL,
			request_id TEXT UNIQUE,
			FOREIGN KEY (order_id) REFERENCES processing_orders(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_reagents_batch_no ON reagents(batch_no)`,
		`CREATE INDEX IF NOT EXISTS idx_reagents_status ON reagents(status)`,
		`CREATE INDEX IF NOT EXISTS idx_usage_records_batch_no ON usage_records(batch_no)`,
		`CREATE INDEX IF NOT EXISTS idx_usage_records_request_id ON usage_records(request_id)`,
		`CREATE INDEX IF NOT EXISTS idx_processing_orders_order_no ON processing_orders(order_no)`,
		`CREATE INDEX IF NOT EXISTS idx_judgment_history_order_id ON judgment_history(order_id)`,
		`CREATE INDEX IF NOT EXISTS idx_judgment_history_order_no ON judgment_history(order_no)`,
		`CREATE INDEX IF NOT EXISTS idx_judgment_history_request_id ON judgment_history(request_id)`,
	}

	for _, schema := range schemas {
		if _, err := d.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to exec schema: %w", err)
		}
	}

	return nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) Begin() (*sql.Tx, error) {
	return d.db.Begin()
}

func (d *Database) DB() *sql.DB {
	return d.db
}

func ParseTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.Format(time.RFC3339)
}

func ScanTime(src interface{}) *time.Time {
	if src == nil {
		return nil
	}
	switch v := src.(type) {
	case string:
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			return &t
		}
	case time.Time:
		return &v
	}
	return nil
}
