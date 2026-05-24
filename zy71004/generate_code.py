#!/usr/bin/env python3

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)
    print(f"Created: {path}")

# database/db.go
db_content = '''package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}
	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)
	DB.SetConnMaxLifetime(time.Hour)
	if err = createTables(); err != nil {
		return err
	}
	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS exhibit_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			exhibit_no TEXT NOT NULL,
			contract_no TEXT NOT NULL,
			current_version INTEGER DEFAULT 1,
			liability_status TEXT DEFAULT 'pending',
			final_conclusion TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			created_by TEXT NOT NULL,
			updated_by TEXT NOT NULL,
			idempotent_key TEXT UNIQUE,
			UNIQUE(exhibit_no, contract_no)
		)`,
		`CREATE TABLE IF NOT EXISTS condition_versions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			version INTEGER NOT NULL,
			check_point TEXT NOT NULL,
			check_time DATETIME NOT NULL,
			condition_desc TEXT,
			has_scratch BOOLEAN DEFAULT 0,
			scratch_location TEXT,
			scratch_size TEXT,
			insurance_remark TEXT,
			handler TEXT NOT NULL,
			transport_node TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			prev_version_id INTEGER,
			change_summary TEXT,
			FOREIGN KEY (record_id) REFERENCES exhibit_records(id),
			UNIQUE(record_id, version)
		)`,
		`CREATE TABLE IF NOT EXISTS photo_evidences (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			version_id INTEGER NOT NULL,
			record_id INTEGER NOT NULL,
			photo_hash TEXT NOT NULL,
			photo_url TEXT,
			provider TEXT NOT NULL,
			provider_type TEXT NOT NULL,
			photo_time DATETIME,
			time_verified BOOLEAN DEFAULT 0,
			description TEXT,
			sequence INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (version_id) REFERENCES condition_versions(id),
			FOREIGN KEY (record_id) REFERENCES exhibit_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS version_diffs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			old_version_id INTEGER,
			new_version_id INTEGER NOT NULL,
			field_name TEXT NOT NULL,
			old_value TEXT,
			new_value TEXT,
			diff_type TEXT NOT NULL,
			changed_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (record_id) REFERENCES exhibit_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS liability_conclusions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			version_id INTEGER NOT NULL,
			liable_party TEXT,
			liable_reason TEXT,
			confidence_level REAL DEFAULT 0,
			status TEXT DEFAULT 'pending',
			reviewer TEXT,
			review_time DATETIME,
			review_comment TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (record_id) REFERENCES exhibit_records(id),
			FOREIGN KEY (version_id) REFERENCES condition_versions(id)
		)`,
		`CREATE TABLE IF NOT EXISTS operation_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER,
			operation TEXT NOT NULL,
			operator TEXT NOT NULL,
			before_state TEXT,
			after_state TEXT,
			remark TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (record_id) REFERENCES exhibit_records(id)
		)`,
	}
	for _, sql := range tables {
		if _, err := DB.Exec(sql); err != nil {
			return err
		}
	}
	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
'''
write_file('database/db.go', db_content)

# services/state_machine.go
sm_content = '''package services

import (
	"errors"
	"museum-exhibit-condition-api/models"
)

type StateMachine struct{}

func NewStateMachine() *StateMachine {
	return &StateMachine{}
}

var validTransitions = map[models.LiabilityStatus][]models.LiabilityStatus{
	models.StatusPending:    {models.StatusImported, models.StatusRevoked},
	models.StatusImported:   {models.StatusValidated, models.StatusRejected, models.StatusRevoked},
	models.StatusValidated:  {models.StatusProcessing, models.StatusDisputed, models.StatusRevoked},
	models.StatusProcessing: {models.StatusConfirmed, models.StatusDisputed, models.StatusRevoked},
	models.StatusDisputed:   {models.StatusProcessing, models.StatusConfirmed, models.StatusRejected, models.StatusRevoked},
	models.StatusConfirmed:  {models.StatusClosed, models.StatusDisputed, models.StatusRevoked},
	models.StatusRejected:   {models.StatusProcessing, models.StatusRevoked},
	models.StatusClosed:     {models.StatusRevoked},
	models.StatusRevoked:    {models.StatusPending},
}

func (sm *StateMachine) CanTransition(from, to models.LiabilityStatus) bool {
	validTos, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, valid := range validTos {
		if valid == to {
			return true
		}
	}
	return false
}

func (sm *StateMachine) ValidateTransition(from, to models.LiabilityStatus) error {
	if !sm.CanTransition(from, to) {
		return errors.New("invalid state transition from " + string(from) + " to " + string(to))
	}
	return nil
}
'''
write_file('services/state_machine.go', sm_content)

print("All files created successfully!")
