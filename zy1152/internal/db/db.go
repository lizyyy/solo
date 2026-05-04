package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var (
	db     *sql.DB
	dbOnce sync.Once
)

func InitDB(dbPath string) error {
	var err error

	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err = os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	db, err = sql.Open("sqlite3", dbPath+"?_journal=WAL&_timeout=5000")
	if err != nil {
		return err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	if err = migrate(); err != nil {
		return err
	}

	if err = seedDefaultThresholds(); err != nil {
		log.Printf("Warning: failed to seed default thresholds: %v", err)
	}

	return nil
}

func GetDB() *sql.DB {
	return db
}

func CloseDB() {
	if db != nil {
		db.Close()
	}
}

func migrate() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS cache_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME NOT NULL,
			business_domain TEXT NOT NULL,
			cache_key TEXT NOT NULL,
			ttl_seconds INTEGER DEFAULT 0,
			is_hit BOOLEAN NOT NULL,
			backend_latency_ms REAL DEFAULT 0,
			request_source TEXT,
			user_agent TEXT,
			ip_address TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_events_timestamp ON cache_events(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_events_domain ON cache_events(business_domain)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_events_key ON cache_events(cache_key)`,

		`CREATE TABLE IF NOT EXISTS cache_keys (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_domain TEXT NOT NULL,
			cache_key TEXT UNIQUE NOT NULL,
			ttl_seconds INTEGER DEFAULT 3600,
			expire_at DATETIME NOT NULL,
			is_hot BOOLEAN DEFAULT 0,
			access_count INTEGER DEFAULT 0,
			last_access_at DATETIME,
			data_type TEXT DEFAULT 'string',
			value_hash TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_keys_domain ON cache_keys(business_domain)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_keys_expire ON cache_keys(expire_at)`,
		`CREATE INDEX IF NOT EXISTS idx_cache_keys_hot ON cache_keys(is_hot)`,

		`CREATE TABLE IF NOT EXISTS backend_metrics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_domain TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			max_connections INTEGER DEFAULT 100,
			current_connections INTEGER DEFAULT 0,
			qps REAL DEFAULT 0,
			max_qps REAL DEFAULT 1000,
			avg_latency_ms REAL DEFAULT 0,
			p95_latency_ms REAL DEFAULT 0,
			p99_latency_ms REAL DEFAULT 0,
			error_rate REAL DEFAULT 0,
			cpu_usage REAL DEFAULT 0,
			memory_usage REAL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_backend_metrics_timestamp ON backend_metrics(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_backend_metrics_domain ON backend_metrics(business_domain)`,

		`CREATE TABLE IF NOT EXISTS traffic_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_name TEXT NOT NULL,
			business_domain TEXT NOT NULL,
			start_time DATETIME NOT NULL,
			end_time DATETIME NOT NULL,
			expected_qps REAL DEFAULT 0,
			peak_qps REAL DEFAULT 0,
			hot_key_ratio REAL DEFAULT 0.2,
			cold_start_ratio REAL DEFAULT 0.1,
			invalid_key_ratio REAL DEFAULT 0.05,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS strategies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			strategy_name TEXT NOT NULL,
			strategy_type TEXT NOT NULL,
			business_domain TEXT,
			is_enabled BOOLEAN DEFAULT 1,
			priority INTEGER DEFAULT 0,
			config_json TEXT NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(strategy_type)`,
		`CREATE INDEX IF NOT EXISTS idx_strategies_enabled ON strategies(is_enabled)`,

		`CREATE TABLE IF NOT EXISTS risk_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			risk_type TEXT NOT NULL,
			severity TEXT NOT NULL,
			business_domain TEXT NOT NULL,
			cache_key TEXT,
			evidence_json TEXT NOT NULL,
			impact_score REAL DEFAULT 0,
			recommended_action TEXT NOT NULL,
			detected_at DATETIME NOT NULL,
			is_resolved BOOLEAN DEFAULT 0,
			resolved_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(risk_type)`,
		`CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity)`,
		`CREATE INDEX IF NOT EXISTS idx_risk_events_detected ON risk_events(detected_at)`,

		`CREATE TABLE IF NOT EXISTS simulation_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			simulation_name TEXT NOT NULL,
			strategy_types_json TEXT NOT NULL,
			business_domain TEXT,
			original_metrics_json TEXT NOT NULL,
			simulated_metrics_json TEXT NOT NULL,
			comparison_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			operation TEXT NOT NULL,
			resource TEXT NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			user_agent TEXT,
			ip_address TEXT,
			status_code INTEGER DEFAULT 0,
			request_id TEXT,
			duration_ms INTEGER DEFAULT 0,
			detail_json TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation)`,

		`CREATE TABLE IF NOT EXISTS threshold_configs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			penetration_miss_rate_threshold REAL DEFAULT 0.3,
			hot_key_access_threshold INTEGER DEFAULT 1000,
			ttl_cluster_threshold REAL DEFAULT 0.5,
			backend_capacity_threshold REAL DEFAULT 0.8,
			bloom_filter_false_positive_rate REAL DEFAULT 0.01,
			mutex_wait_threshold_ms INTEGER DEFAULT 500,
			stale_revalidate_ratio REAL DEFAULT 0.1,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			return err
		}
	}

	return nil
}

func seedDefaultThresholds() error {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM threshold_configs").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		_, err = db.Exec(`
			INSERT INTO threshold_configs (
				penetration_miss_rate_threshold,
				hot_key_access_threshold,
				ttl_cluster_threshold,
				backend_capacity_threshold,
				bloom_filter_false_positive_rate,
				mutex_wait_threshold_ms,
				stale_revalidate_ratio,
				updated_at
			) VALUES (0.3, 1000, 0.5, 0.8, 0.01, 500, 0.1, CURRENT_TIMESTAMP)
		`)
	}

	return err
}
