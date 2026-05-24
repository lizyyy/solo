package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"night-market-api/pkg/utils"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func AuditLog(entityType, entityID, action, oldValue, newValue, operator string) error {
	id := utils.GenerateID()
	_, err := DB.Exec(
		`INSERT INTO audit_logs (id, entity_type, entity_id, action, old_value, new_value, operator, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, entityType, entityID, action, oldValue, newValue, operator, time.Now(),
	)
	return err
}

func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

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
	statements := []string{
		`CREATE TABLE IF NOT EXISTS stalls (
			id TEXT PRIMARY KEY,
			code TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			power_capacity INTEGER NOT NULL DEFAULT 0,
			has_exhaust BOOLEAN NOT NULL DEFAULT 0,
			zone TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS vendors (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			phone TEXT,
			category TEXT NOT NULL,
			power_usage INTEGER NOT NULL DEFAULT 0,
			requires_exhaust BOOLEAN NOT NULL DEFAULT 0,
			score INTEGER NOT NULL DEFAULT 100,
			status TEXT NOT NULL DEFAULT 'active',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS complaints (
			id TEXT PRIMARY KEY,
			vendor_id TEXT NOT NULL,
			type TEXT NOT NULL,
			description TEXT,
			severity TEXT NOT NULL DEFAULT 'minor',
			points_deducted INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending',
			reported_by TEXT,
			reported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			FOREIGN KEY (vendor_id) REFERENCES vendors(id)
		)`,
		`CREATE TABLE IF NOT EXISTS rotation_cycles (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			start_date DATE NOT NULL,
			end_date DATE NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_by TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS stall_assignments (
			id TEXT PRIMARY KEY,
			cycle_id TEXT NOT NULL,
			vendor_id TEXT NOT NULL,
			stall_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'assigned',
			assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			validated_at DATETIME,
			validation_result TEXT,
			notes TEXT,
			FOREIGN KEY (cycle_id) REFERENCES rotation_cycles(id),
			FOREIGN KEY (vendor_id) REFERENCES vendors(id),
			FOREIGN KEY (stall_id) REFERENCES stalls(id),
			UNIQUE(cycle_id, vendor_id),
			UNIQUE(cycle_id, stall_id)
		)`,
		`CREATE TABLE IF NOT EXISTS swap_requests (
			id TEXT PRIMARY KEY,
			cycle_id TEXT NOT NULL,
			requesting_vendor_id TEXT NOT NULL,
			target_vendor_id TEXT NOT NULL,
			requesting_stall_id TEXT NOT NULL,
			target_stall_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			reason TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			approved_at DATETIME,
			approved_by TEXT,
			resolved_at DATETIME,
			FOREIGN KEY (cycle_id) REFERENCES rotation_cycles(id),
			FOREIGN KEY (requesting_vendor_id) REFERENCES vendors(id),
			FOREIGN KEY (target_vendor_id) REFERENCES vendors(id),
			FOREIGN KEY (requesting_stall_id) REFERENCES stalls(id),
			FOREIGN KEY (target_stall_id) REFERENCES stalls(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			action TEXT NOT NULL,
			old_value TEXT,
			new_value TEXT,
			operator TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_complaints_vendor ON complaints(vendor_id)`,
		`CREATE INDEX IF NOT EXISTS idx_assignments_cycle ON stall_assignments(cycle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_assignments_vendor ON stall_assignments(vendor_id)`,
		`CREATE INDEX IF NOT EXISTS idx_swaps_cycle ON swap_requests(cycle_id)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement: %w, sql: %s", err, stmt)
		}
	}

	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
