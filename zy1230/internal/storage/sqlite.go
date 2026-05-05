package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"go-policy-scanner/pkg/model"

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

func (s *SQLiteStorage) initSchema() error {
	createTableQueries := []string{
		`CREATE TABLE IF NOT EXISTS scan_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			repo_name TEXT NOT NULL,
			branch TEXT,
			commit TEXT,
			scan_time TIMESTAMP NOT NULL,
			summary_json TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS violations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			scan_result_id INTEGER NOT NULL,
			type TEXT NOT NULL,
			severity TEXT NOT NULL,
			message TEXT NOT NULL,
			file TEXT,
			line INTEGER,
			detail TEXT,
			detected_at TIMESTAMP NOT NULL,
			FOREIGN KEY (scan_result_id) REFERENCES scan_results(id)
		)`,
		`CREATE TABLE IF NOT EXISTS dependencies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			scan_result_id INTEGER NOT NULL,
			module_path TEXT NOT NULL,
			import_path TEXT NOT NULL,
			version TEXT,
			indirect INTEGER,
			FOREIGN KEY (scan_result_id) REFERENCES scan_results(id)
		)`,
		`CREATE TABLE IF NOT EXISTS package_imports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			scan_result_id INTEGER NOT NULL,
			importing_pkg TEXT NOT NULL,
			imported_pkg TEXT NOT NULL,
			FOREIGN KEY (scan_result_id) REFERENCES scan_results(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_violations_scan_result_id ON violations(scan_result_id)`,
		`CREATE INDEX IF NOT EXISTS idx_scan_results_time ON scan_results(scan_time)`,
	}

	for _, query := range createTableQueries {
		_, err := s.db.Exec(query)
		if err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

func (s *SQLiteStorage) SaveScanResult(result *model.ScanResult) (int64, error) {
	summaryJSON, err := json.Marshal(result.Summary)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal summary: %w", err)
	}

	result.ScanTime = time.Now()
	res, err := s.db.Exec(
		`INSERT INTO scan_results (repo_name, branch, commit, scan_time, summary_json)
		 VALUES (?, ?, ?, ?, ?)`,
		result.RepoName, result.Branch, result.Commit, result.ScanTime, string(summaryJSON),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert scan result: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert id: %w", err)
	}

	result.ID = id
	return id, nil
}

func (s *SQLiteStorage) SaveViolations(scanResultID int64, violations []model.Violation) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO violations (scan_result_id, type, severity, message, file, line, detail, detected_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, v := range violations {
		v.ScanResultID = scanResultID
		v.DetectedAt = time.Now()
		_, err := stmt.Exec(
			scanResultID, v.Type, v.Severity, v.Message, v.File, v.Line, v.Detail, v.DetectedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert violation: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SQLiteStorage) GetScanResult(id int64) (*model.ScanResult, error) {
	var result model.ScanResult
	var summaryJSON string
	var scanTimeStr string

	err := s.db.QueryRow(
		`SELECT id, repo_name, branch, commit, scan_time, summary_json
		 FROM scan_results WHERE id = ?`,
		id,
	).Scan(&result.ID, &result.RepoName, &result.Branch, &result.Commit, &scanTimeStr, &summaryJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("scan result not found: %d", id)
		}
		return nil, fmt.Errorf("failed to get scan result: %w", err)
	}

	result.ScanTime, err = time.Parse("2006-01-02 15:04:05-07:00", scanTimeStr)
	if err != nil {
		result.ScanTime, _ = time.Parse("2006-01-02 15:04:05", scanTimeStr)
	}

	if err := json.Unmarshal([]byte(summaryJSON), &result.Summary); err != nil {
		return nil, fmt.Errorf("failed to unmarshal summary: %w", err)
	}

	return &result, nil
}

func (s *SQLiteStorage) GetViolations(scanResultID int64) ([]model.Violation, error) {
	rows, err := s.db.Query(
		`SELECT id, scan_result_id, type, severity, message, file, line, detail, detected_at
		 FROM violations WHERE scan_result_id = ?`,
		scanResultID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query violations: %w", err)
	}
	defer rows.Close()

	var violations []model.Violation
	for rows.Next() {
		var v model.Violation
		var detectedAtStr string
		err := rows.Scan(
			&v.ID, &v.ScanResultID, &v.Type, &v.Severity, &v.Message,
			&v.File, &v.Line, &v.Detail, &detectedAtStr,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan violation: %w", err)
		}

		v.DetectedAt, err = time.Parse("2006-01-02 15:04:05-07:00", detectedAtStr)
		if err != nil {
			v.DetectedAt, _ = time.Parse("2006-01-02 15:04:05", detectedAtStr)
		}

		violations = append(violations, v)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return violations, nil
}

func (s *SQLiteStorage) ListScanResults(limit int) ([]model.ScanResult, error) {
	rows, err := s.db.Query(
		`SELECT id, repo_name, branch, commit, scan_time, summary_json
		 FROM scan_results ORDER BY scan_time DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query scan results: %w", err)
	}
	defer rows.Close()

	var results []model.ScanResult
	for rows.Next() {
		var result model.ScanResult
		var summaryJSON string
		var scanTimeStr string

		err := rows.Scan(
			&result.ID, &result.RepoName, &result.Branch, &result.Commit,
			&scanTimeStr, &summaryJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan scan result: %w", err)
		}

		result.ScanTime, err = time.Parse("2006-01-02 15:04:05-07:00", scanTimeStr)
		if err != nil {
			result.ScanTime, _ = time.Parse("2006-01-02 15:04:05", scanTimeStr)
		}

		if err := json.Unmarshal([]byte(summaryJSON), &result.Summary); err != nil {
			return nil, fmt.Errorf("failed to unmarshal summary: %w", err)
		}

		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return results, nil
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}
