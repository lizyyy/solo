package repository

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"quality-control-system/internal/config"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(cfg *config.DatabaseConfig) error {
	var err error

	dbDir := filepath.Dir(cfg.DSN)
	if dbDir != "." {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	DB, err = sql.Open(cfg.Driver, cfg.DSN)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)

	if err := initSchema(); err != nil {
		return fmt.Errorf("failed to init schema: %w", err)
	}

	return nil
}

func initSchema() error {
	schema := `
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    manager_name VARCHAR(50),
    manager_phone VARCHAR(20),
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_no VARCHAR(64) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    dish_name VARCHAR(100) NOT NULL,
    dish_batch VARCHAR(50) NOT NULL,
    sample_weight DECIMAL(10,2),
    sample_time DATETIME NOT NULL,
    keeper VARCHAR(50),
    keeper_phone VARCHAR(20),
    storage_location VARCHAR(100),
    expire_time DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT 'normal',
    is_destroyed INTEGER DEFAULT 0,
    destroy_time DATETIME,
    destroy_operator VARCHAR(50),
    destroy_reason TEXT,
    idempotent_key VARCHAR(64) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temperature_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_no VARCHAR(64) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    fridge_id VARCHAR(50) NOT NULL,
    fridge_name VARCHAR(100),
    temperature DECIMAL(5,2) NOT NULL,
    check_time DATETIME NOT NULL,
    checker VARCHAR(50),
    checker_phone VARCHAR(20),
    is_normal INTEGER DEFAULT 1,
    anomaly_reason TEXT,
    idempotent_key VARCHAR(64) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waste_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waste_no VARCHAR(64) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    dish_name VARCHAR(100) NOT NULL,
    dish_batch VARCHAR(50) NOT NULL,
    waste_type VARCHAR(50),
    waste_weight DECIMAL(10,2),
    waste_time DATETIME NOT NULL,
    waste_reason TEXT,
    operator VARCHAR(50),
    operator_phone VARCHAR(20),
    witness VARCHAR(50),
    idempotent_key VARCHAR(64) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_no VARCHAR(64) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    inspection_type VARCHAR(50) NOT NULL,
    inspector VARCHAR(50),
    inspector_phone VARCHAR(20),
    inspection_time DATETIME NOT NULL,
    inspection_result VARCHAR(20),
    issues_found TEXT,
    corrective_actions TEXT,
    idempotent_key VARCHAR(64) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_ref_id INTEGER,
    item_ref_no VARCHAR(64),
    check_result VARCHAR(20),
    check_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    record_ref_no VARCHAR(64) NOT NULL,
    store_id VARCHAR(50),
    execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    action_taken VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    operator VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_no VARCHAR(64) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    reminder_type VARCHAR(50) NOT NULL,
    related_ref_no VARCHAR(64),
    message TEXT NOT NULL,
    remind_time DATETIME NOT NULL,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledge_time DATETIME,
    acknowledged_by VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id VARCHAR(64) UNIQUE NOT NULL,
    operator VARCHAR(50),
    operation_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_ref_no VARCHAR(64),
    request_data TEXT,
    response_data TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    status VARCHAR(20),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_samples_store ON food_samples(store_id);
CREATE INDEX IF NOT EXISTS idx_samples_batch ON food_samples(dish_batch);
CREATE INDEX IF NOT EXISTS idx_samples_status ON food_samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_expire ON food_samples(expire_time);
CREATE INDEX IF NOT EXISTS idx_temp_store ON temperature_records(store_id);
CREATE INDEX IF NOT EXISTS idx_temp_time ON temperature_records(check_time);
CREATE INDEX IF NOT EXISTS idx_waste_store ON waste_records(store_id);
CREATE INDEX IF NOT EXISTS idx_waste_batch ON waste_records(dish_batch);
CREATE INDEX IF NOT EXISTS idx_inspection_store ON inspections(store_id);
CREATE INDEX IF NOT EXISTS idx_rule_record ON rule_execution_logs(record_ref_no);
CREATE INDEX IF NOT EXISTS idx_reminder_store ON reminders(store_id);
`

	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	initDataSQL := `
INSERT OR IGNORE INTO stores (store_id, name, address, manager_name, manager_phone, status) VALUES
('ST001', '中关村店', '北京市海淀区中关村大街1号', '张三', '13800138001', 1),
('ST002', '国贸店', '北京市朝阳区建国门外大街1号', '李四', '13800138002', 1),
('ST003', '望京店', '北京市朝阳区望京街9号', '王五', '13800138003', 1);
`
	_, err = DB.Exec(initDataSQL)
	return err
}

func CloseDB() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
