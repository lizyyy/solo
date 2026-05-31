package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func Open(dbPath string) (*DB, error) {
	if dbPath == "" {
		dbPath = "coastline.db"
	}
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create db directory: %w", err)
		}
	}
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	conn.Exec("PRAGMA journal_mode=WAL")
	conn.Exec("PRAGMA foreign_keys=ON")
	d := &DB{conn}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return d, nil
}

func (d *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT NOT NULL DEFAULT '',
		location TEXT NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'imported',
		pending_reason TEXT NOT NULL DEFAULT '',
		operator TEXT NOT NULL DEFAULT '',
		photo_ref TEXT NOT NULL DEFAULT '',
		version INTEGER NOT NULL DEFAULT 1,
		content_hash TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
		updated_at DATETIME NOT NULL DEFAULT (datetime('now','localtime'))
	);

	CREATE TABLE IF NOT EXISTS change_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		record_id INTEGER NOT NULL,
		change_type TEXT NOT NULL DEFAULT '',
		field TEXT NOT NULL DEFAULT '',
		old_value TEXT NOT NULL DEFAULT '',
		new_value TEXT NOT NULL DEFAULT '',
		operator TEXT NOT NULL DEFAULT '',
		reason TEXT NOT NULL DEFAULT '',
		alert INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
		FOREIGN KEY (record_id) REFERENCES records(id)
	);

	CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
	CREATE INDEX IF NOT EXISTS idx_records_source ON records(source);
	CREATE INDEX IF NOT EXISTS idx_change_log_record ON change_log(record_id);
	`
	_, err := d.Exec(schema)
	return err
}

type Record struct {
	ID            int64
	Source        string
	Location      string
	Description   string
	Status        string
	PendingReason string
	Operator      string
	PhotoRef      string
	Version       int
	ContentHash   string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type ChangeLog struct {
	ID         int64
	RecordID   int64
	ChangeType string
	Field      string
	OldValue   string
	NewValue   string
	Operator   string
	Reason     string
	Alert      bool
	CreatedAt  time.Time
}

var ValidStatuses = map[string]bool{
	"imported": true,
	"pending":  true,
	"reviewed": true,
	"fixed":    true,
	"closed":   true,
}

func (d *DB) InsertRecord(r *Record) (int64, error) {
	now := time.Now()
	res, err := d.Exec(
		`INSERT INTO records (source, location, description, status, pending_reason, operator, photo_ref, version, content_hash, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.Source, r.Location, r.Description, r.Status, r.PendingReason, r.Operator, r.PhotoRef, r.Version, r.ContentHash, now, now,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	r.ID = id
	return id, nil
}

func (d *DB) GetRecord(id int64) (*Record, error) {
	r := &Record{}
	err := d.QueryRow(
		`SELECT id, source, location, description, status, pending_reason, operator, photo_ref, version, content_hash, created_at, updated_at
		 FROM records WHERE id = ?`, id,
	).Scan(&r.ID, &r.Source, &r.Location, &r.Description, &r.Status, &r.PendingReason, &r.Operator, &r.PhotoRef, &r.Version, &r.ContentHash, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (d *DB) UpdateRecord(r *Record) error {
	now := time.Now()
	_, err := d.Exec(
		`UPDATE records SET source=?, location=?, description=?, status=?, pending_reason=?, operator=?, photo_ref=?, version=?, content_hash=?, updated_at=?
		 WHERE id=?`,
		r.Source, r.Location, r.Description, r.Status, r.PendingReason, r.Operator, r.PhotoRef, r.Version, r.ContentHash, now, r.ID,
	)
	return err
}

func (d *DB) ListRecords(statusFilter string) ([]Record, error) {
	var rows *sql.Rows
	var err error
	if statusFilter != "" {
		rows, err = d.Query(
			`SELECT id, source, location, description, status, pending_reason, operator, photo_ref, version, content_hash, created_at, updated_at
			 FROM records WHERE status = ? ORDER BY updated_at DESC`, statusFilter)
	} else {
		rows, err = d.Query(
			`SELECT id, source, location, description, status, pending_reason, operator, photo_ref, version, content_hash, created_at, updated_at
			 FROM records ORDER BY updated_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []Record
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.ID, &r.Source, &r.Location, &r.Description, &r.Status, &r.PendingReason, &r.Operator, &r.PhotoRef, &r.Version, &r.ContentHash, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (d *DB) FindBySourceLocation(source, location string) (*Record, error) {
	r := &Record{}
	err := d.QueryRow(
		`SELECT id, source, location, description, status, pending_reason, operator, photo_ref, version, content_hash, created_at, updated_at
		 FROM records WHERE source = ? AND location = ? ORDER BY version DESC LIMIT 1`, source, location,
	).Scan(&r.ID, &r.Source, &r.Location, &r.Description, &r.Status, &r.PendingReason, &r.Operator, &r.PhotoRef, &r.Version, &r.ContentHash, &r.CreatedAt, &r.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (d *DB) InsertChangeLog(cl *ChangeLog) error {
	alertInt := 0
	if cl.Alert {
		alertInt = 1
	}
	_, err := d.Exec(
		`INSERT INTO change_log (record_id, change_type, field, old_value, new_value, operator, reason, alert, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		cl.RecordID, cl.ChangeType, cl.Field, cl.OldValue, cl.NewValue, cl.Operator, cl.Reason, alertInt, time.Now(),
	)
	return err
}

func (d *DB) GetChangeLogs(recordID int64) ([]ChangeLog, error) {
	rows, err := d.Query(
		`SELECT id, record_id, change_type, field, old_value, new_value, operator, reason, alert, created_at
		 FROM change_log WHERE record_id = ? ORDER BY created_at ASC`, recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []ChangeLog
	for rows.Next() {
		var cl ChangeLog
		var alertInt int
		if err := rows.Scan(&cl.ID, &cl.RecordID, &cl.ChangeType, &cl.Field, &cl.OldValue, &cl.NewValue, &cl.Operator, &cl.Reason, &alertInt, &cl.CreatedAt); err != nil {
			return nil, err
		}
		cl.Alert = alertInt == 1
		result = append(result, cl)
	}
	return result, rows.Err()
}

func (d *DB) GetAlertLogs(recordID int64) ([]ChangeLog, error) {
	rows, err := d.Query(
		`SELECT id, record_id, change_type, field, old_value, new_value, operator, reason, alert, created_at
		 FROM change_log WHERE record_id = ? AND alert = 1 ORDER BY created_at ASC`, recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []ChangeLog
	for rows.Next() {
		var cl ChangeLog
		var alertInt int
		if err := rows.Scan(&cl.ID, &cl.RecordID, &cl.ChangeType, &cl.Field, &cl.OldValue, &cl.NewValue, &cl.Operator, &cl.Reason, &alertInt, &cl.CreatedAt); err != nil {
			return nil, err
		}
		cl.Alert = alertInt == 1
		result = append(result, cl)
	}
	return result, rows.Err()
}

func (d *DB) GetAllRecords() ([]Record, error) {
	return d.ListRecords("")
}
