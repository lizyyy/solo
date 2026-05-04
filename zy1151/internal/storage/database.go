package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

type DBConfig struct {
	DBPath string
}

func InitDB(cfg DBConfig) error {
	var err error

	if cfg.DBPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("无法获取用户主目录: %w", err)
		}
		cfg.DBPath = filepath.Join(homeDir, ".memreplay", "memreplay.db")
	}

	dir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("无法创建数据库目录: %w", err)
	}

	db, err = sql.Open("sqlite3", cfg.DBPath)
	if err != nil {
		return fmt.Errorf("无法打开数据库: %w", err)
	}

	if err := db.Ping(); err != nil {
		return fmt.Errorf("无法连接数据库: %w", err)
	}

	if err := initSchema(); err != nil {
		return fmt.Errorf("无法初始化数据库 schema: %w", err)
	}

	return nil
}

func GetDB() *sql.DB {
	return db
}

func CloseDB() error {
	if db != nil {
		return db.Close()
	}
	return nil
}

func initSchema() error {
	schema := []string{
		`CREATE TABLE IF NOT EXISTS batches (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			created_at DATETIME NOT NULL,
			service_name TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS sample_points (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			description TEXT,
			source_type TEXT NOT NULL,
			FOREIGN KEY (batch_id) REFERENCES batches(id)
		)`,
		`CREATE TABLE IF NOT EXISTS mem_stats (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			alloc INTEGER,
			total_alloc INTEGER,
			sys INTEGER,
			lookups INTEGER,
			mallocs INTEGER,
			frees INTEGER,
			heap_alloc INTEGER,
			heap_sys INTEGER,
			heap_idle INTEGER,
			heap_inuse INTEGER,
			heap_released INTEGER,
			heap_objects INTEGER,
			stack_inuse INTEGER,
			stack_sys INTEGER,
			mspan_inuse INTEGER,
			mspan_sys INTEGER,
			mcache_inuse INTEGER,
			mcache_sys INTEGER,
			buck_hash_sys INTEGER,
			gc_sys INTEGER,
			other_sys INTEGER,
			next_gc INTEGER,
			last_gc INTEGER,
			pause_total_ns INTEGER,
			num_gc INTEGER,
			num_forced_gc INTEGER,
			gc_cpu_fraction REAL,
			rss INTEGER,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS goroutines (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			goroutine_id INTEGER,
			status TEXT,
			stack TEXT,
			function TEXT,
			file TEXT,
			line INTEGER,
			wait_duration INTEGER,
			timestamp DATETIME NOT NULL,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS alloc_sites (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			function TEXT,
			file TEXT,
			line INTEGER,
			alloc_bytes INTEGER,
			alloc_objects INTEGER,
			inuse_bytes INTEGER,
			inuse_objects INTEGER,
			stack_id TEXT,
			timestamp DATETIME NOT NULL,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS traffic (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			endpoint TEXT,
			method TEXT,
			requests INTEGER,
			errors INTEGER,
			latency_p50 REAL,
			latency_p99 REAL,
			qps REAL,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS configs (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			key TEXT NOT NULL,
			value TEXT,
			source TEXT,
			timestamp DATETIME NOT NULL,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS heap_profiles (
			id TEXT PRIMARY KEY,
			sample_point_id TEXT NOT NULL,
			type TEXT,
			function TEXT,
			file TEXT,
			line INTEGER,
			inuse_bytes INTEGER,
			inuse_objects INTEGER,
			alloc_bytes INTEGER,
			alloc_objects INTEGER,
			timestamp DATETIME NOT NULL,
			FOREIGN KEY (sample_point_id) REFERENCES sample_points(id)
		)`,
		`CREATE TABLE IF NOT EXISTS analysis_results (
			id TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			conclusion TEXT,
			confidence REAL,
			risk_level TEXT,
			FOREIGN KEY (batch_id) REFERENCES batches(id)
		)`,
		`CREATE TABLE IF NOT EXISTS findings (
			id TEXT PRIMARY KEY,
			analysis_id TEXT NOT NULL,
			category TEXT,
			title TEXT,
			description TEXT,
			confidence REAL,
			severity TEXT,
			source TEXT,
			FOREIGN KEY (analysis_id) REFERENCES analysis_results(id)
		)`,
		`CREATE TABLE IF NOT EXISTS evidence (
			id TEXT PRIMARY KEY,
			analysis_id TEXT NOT NULL,
			finding_id TEXT,
			type TEXT,
			value TEXT,
			details TEXT,
			source TEXT,
			FOREIGN KEY (analysis_id) REFERENCES analysis_results(id),
			FOREIGN KEY (finding_id) REFERENCES findings(id)
		)`,
		`CREATE TABLE IF NOT EXISTS recommendations (
			id TEXT PRIMARY KEY,
			analysis_id TEXT NOT NULL,
			priority TEXT,
			action TEXT,
			details TEXT,
			FOREIGN KEY (analysis_id) REFERENCES analysis_results(id)
		)`,
		`CREATE TABLE IF NOT EXISTS compare_results (
			id TEXT PRIMARY KEY,
			base_batch_id TEXT NOT NULL,
			target_batch_id TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			conclusion TEXT,
			confidence REAL
		)`,
		`CREATE TABLE IF NOT EXISTS differences (
			id TEXT PRIMARY KEY,
			compare_id TEXT NOT NULL,
			category TEXT,
			metric TEXT,
			base_value TEXT,
			target_value TEXT,
			change_pct REAL,
			importance TEXT,
			description TEXT,
			FOREIGN KEY (compare_id) REFERENCES compare_results(id)
		)`,
		`CREATE TABLE IF NOT EXISTS simulation_params (
			id TEXT PRIMARY KEY,
			name TEXT,
			created_at DATETIME NOT NULL,
			params TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS simulation_results (
			id TEXT PRIMARY KEY,
			params_id TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			risk_level TEXT,
			metrics TEXT,
			conclusion TEXT,
			warnings TEXT,
			FOREIGN KEY (params_id) REFERENCES simulation_params(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sample_points_batch_id ON sample_points(batch_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mem_stats_sample_point_id ON mem_stats(sample_point_id)`,
		`CREATE INDEX IF NOT EXISTS idx_goroutines_sample_point_id ON goroutines(sample_point_id)`,
		`CREATE INDEX IF NOT EXISTS idx_traffic_sample_point_id ON traffic(sample_point_id)`,
		`CREATE INDEX IF NOT EXISTS idx_configs_sample_point_id ON configs(sample_point_id)`,
		`CREATE INDEX IF NOT EXISTS idx_heap_profiles_sample_point_id ON heap_profiles(sample_point_id)`,
	}

	for _, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("执行 schema 语句失败: %w", err)
		}
	}

	return nil
}
