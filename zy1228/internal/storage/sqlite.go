package storage

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	storage := &SQLiteStorage{db: db}
	if err := storage.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return storage, nil
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}

func (s *SQLiteStorage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS designs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id INTEGER,
		name TEXT NOT NULL,
		yaml_content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE TABLE IF NOT EXISTS events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		design_id INTEGER,
		jsonl_content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (design_id) REFERENCES designs(id)
	);

	CREATE TABLE IF NOT EXISTS code_snippets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		design_id INTEGER,
		filename TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (design_id) REFERENCES designs(id)
	);

	CREATE TABLE IF NOT EXISTS analysis_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		design_id INTEGER UNIQUE,
		goroutine_topology TEXT NOT NULL,
		queue_analysis TEXT NOT NULL,
		backpressure_analysis TEXT NOT NULL,
		priority_analysis TEXT NOT NULL,
		timeout_analysis TEXT NOT NULL,
		error_analysis TEXT NOT NULL,
		shutdown_analysis TEXT NOT NULL,
		issues TEXT NOT NULL,
		recommendations TEXT NOT NULL,
		overall_score INTEGER,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (design_id) REFERENCES designs(id)
	);

	CREATE TABLE IF NOT EXISTS issues (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		analysis_id INTEGER,
		severity TEXT NOT NULL,
		category TEXT NOT NULL,
		description TEXT NOT NULL,
		suggestion TEXT,
		location TEXT,
		FOREIGN KEY (analysis_id) REFERENCES analysis_results(id)
	);

	CREATE INDEX IF NOT EXISTS idx_designs_project ON designs(project_id);
	CREATE INDEX IF NOT EXISTS idx_analysis_design ON analysis_results(design_id);
	CREATE INDEX IF NOT EXISTS idx_issues_analysis ON issues(analysis_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *SQLiteStorage) DB() *sql.DB {
	return s.db
}
