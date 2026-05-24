package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func NewDB(dataSourceName string) (*DB, error) {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return nil, err
	}

	if err = db.Ping(); err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	return &DB{db}, nil
}

func (db *DB) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS warehouse_areas (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		capacity INTEGER NOT NULL DEFAULT 0,
		humidity_min REAL NOT NULL DEFAULT 40.0,
		humidity_max REAL NOT NULL DEFAULT 65.0,
		status TEXT NOT NULL DEFAULT 'active',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS fireworks_batches (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_no TEXT UNIQUE NOT NULL,
		product_name TEXT NOT NULL,
		quantity INTEGER NOT NULL,
		current_area_id INTEGER NOT NULL,
		current_area_code TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'normal',
		manufacture_date DATETIME NOT NULL,
		expiry_date DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (current_area_id) REFERENCES warehouse_areas(id)
	);

	CREATE TABLE IF NOT EXISTS humidity_samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id TEXT UNIQUE NOT NULL,
		area_id INTEGER NOT NULL,
		area_code TEXT NOT NULL,
		humidity REAL NOT NULL,
		temperature REAL NOT NULL DEFAULT 25.0,
		sampled_at DATETIME NOT NULL,
		sampled_by TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		window_start DATETIME NOT NULL,
		window_end DATETIME NOT NULL,
		risk_level TEXT NOT NULL DEFAULT 'normal',
		disposal_id INTEGER,
		reviewed_by TEXT,
		reviewed_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (area_id) REFERENCES warehouse_areas(id)
	);

	CREATE TABLE IF NOT EXISTS ventilation_actions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id TEXT UNIQUE NOT NULL,
		area_id INTEGER NOT NULL,
		area_code TEXT NOT NULL,
		sample_id INTEGER NOT NULL,
		started_at DATETIME NOT NULL,
		ended_at DATETIME,
		duration_minutes INTEGER,
		operator TEXT NOT NULL,
		before_humidity REAL NOT NULL,
		after_humidity REAL,
		status TEXT NOT NULL DEFAULT 'pending',
		reviewed_by TEXT,
		reviewed_at DATETIME,
		remark TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (area_id) REFERENCES warehouse_areas(id),
		FOREIGN KEY (sample_id) REFERENCES humidity_samples(id)
	);

	CREATE TABLE IF NOT EXISTS transfer_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id TEXT UNIQUE NOT NULL,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		from_area_id INTEGER NOT NULL,
		from_area_code TEXT NOT NULL,
		to_area_id INTEGER NOT NULL,
		to_area_code TEXT NOT NULL,
		quantity INTEGER NOT NULL,
		operator TEXT NOT NULL,
		transferred_at DATETIME NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		reviewed_by TEXT,
		reviewed_at DATETIME,
		remark TEXT,
		undone BOOLEAN NOT NULL DEFAULT 0,
		undone_by TEXT,
		undone_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (batch_id) REFERENCES fireworks_batches(id),
		FOREIGN KEY (from_area_id) REFERENCES warehouse_areas(id),
		FOREIGN KEY (to_area_id) REFERENCES warehouse_areas(id)
	);

	CREATE TABLE IF NOT EXISTS inspection_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id TEXT UNIQUE NOT NULL,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		area_id INTEGER NOT NULL,
		area_code TEXT NOT NULL,
		inspected_at DATETIME NOT NULL,
		inspector TEXT NOT NULL,
		package_check TEXT NOT NULL,
		humidity_check TEXT NOT NULL,
		quality_status TEXT NOT NULL,
		photos TEXT,
		remark TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		reviewed_by TEXT,
		reviewed_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (batch_id) REFERENCES fireworks_batches(id),
		FOREIGN KEY (area_id) REFERENCES warehouse_areas(id)
	);

	CREATE TABLE IF NOT EXISTS risk_reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		report_no TEXT UNIQUE NOT NULL,
		report_type TEXT NOT NULL,
		period_start DATETIME NOT NULL,
		period_end DATETIME NOT NULL,
		generated_at DATETIME NOT NULL,
		generated_by TEXT NOT NULL,
		total_samples INTEGER NOT NULL DEFAULT 0,
		over_limit_count INTEGER NOT NULL DEFAULT 0,
		transfer_count INTEGER NOT NULL DEFAULT 0,
		inspection_count INTEGER NOT NULL DEFAULT 0,
		ventilation_count INTEGER NOT NULL DEFAULT 0,
		risk_level TEXT NOT NULL DEFAULT 'normal',
		summary TEXT NOT NULL,
		recommendations TEXT,
		status TEXT NOT NULL DEFAULT 'generated',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS idempotent_requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id TEXT UNIQUE NOT NULL,
		request_type TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		resource_id INTEGER NOT NULL,
		response_body TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		action TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		resource_id INTEGER NOT NULL,
		operator TEXT NOT NULL,
		old_value TEXT,
		new_value TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_samples_area_time ON humidity_samples(area_id, sampled_at);
	CREATE INDEX IF NOT EXISTS idx_samples_request_id ON humidity_samples(request_id);
	CREATE INDEX IF NOT EXISTS idx_transfers_batch ON transfer_records(batch_id);
	CREATE INDEX IF NOT EXISTS idx_transfers_request_id ON transfer_records(request_id);
	CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspection_records(batch_id);
	CREATE INDEX IF NOT EXISTS idx_idempotent_request_id ON idempotent_requests(request_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to init schema: %w", err)
	}

	return nil
}

func (db *DB) BeginTx() (*sql.Tx, error) {
	return db.Begin()
}

func FormatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func ParseTime(s string) (time.Time, error) {
	return time.Parse("2006-01-02 15:04:05", s)
}

func JoinStrings(items []string) string {
	return strings.Join(items, ",")
}

func SplitStrings(s string) []string {
	if s == "" {
		return []string{}
	}
	return strings.Split(s, ",")
}

func NullTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return FormatTime(*t)
}

func ScanTime(rows *sql.Rows) (time.Time, error) {
	var s string
	err := rows.Scan(&s)
	if err != nil {
		return time.Time{}, err
	}
	return ParseTime(s)
}

func SeedInitialData(db *DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var count int
	err = tx.QueryRow("SELECT COUNT(*) FROM warehouse_areas").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return tx.Commit()
	}

	areas := []struct {
		code        string
		name        string
		capacity    int
		humidityMin float64
		humidityMax float64
	}{
		{"A-01", "A区一号库", 1000, 40.0, 65.0},
		{"A-02", "A区二号库", 1000, 40.0, 65.0},
		{"B-01", "B区一号库", 800, 35.0, 60.0},
		{"B-02", "B区二号库", 800, 35.0, 60.0},
		{"C-01", "C区待检库", 500, 45.0, 70.0},
	}

	for _, a := range areas {
		now := FormatTime(time.Now())
		_, err = tx.Exec(`
			INSERT INTO warehouse_areas (code, name, capacity, humidity_min, humidity_max, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
		`, a.code, a.name, a.capacity, a.humidityMin, a.humidityMax, now, now)
		if err != nil {
			log.Printf("Failed to insert area %s: %v", a.code, err)
			return err
		}
	}

	batches := []struct {
		batchNo     string
		productName string
		quantity    int
		areaID      int
		areaCode    string
	}{
		{"FH202405001", "迎宾礼花", 500, 1, "A-01"},
		{"FH202405002", "彩色烟花", 300, 1, "A-01"},
		{"FH202405003", "爆竹套装", 200, 2, "A-02"},
		{"FH202405004", "高空烟花", 150, 3, "B-01"},
	}

	manuDate := FormatTime(time.Now().AddDate(0, -1, 0))
	expiryDate := FormatTime(time.Now().AddDate(2, 0, 0))

	for _, b := range batches {
		now := FormatTime(time.Now())
		_, err = tx.Exec(`
			INSERT INTO fireworks_batches (batch_no, product_name, quantity, current_area_id, current_area_code, status, manufacture_date, expiry_date, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, ?)
		`, b.batchNo, b.productName, b.quantity, b.areaID, b.areaCode, manuDate, expiryDate, now, now)
		if err != nil {
			log.Printf("Failed to insert batch %s: %v", b.batchNo, err)
			return err
		}
	}

	return tx.Commit()
}
