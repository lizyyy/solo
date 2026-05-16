package storage

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"gpu-queue-api/models"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.initTables(); err != nil {
		return nil, err
	}

	if err := store.initGPUResources(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) initTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS gpu_resources (
			id TEXT PRIMARY KEY,
			model TEXT UNIQUE NOT NULL,
			total_count INTEGER NOT NULL DEFAULT 0,
			used_count INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			gpu_model TEXT NOT NULL,
			gpu_count INTEGER NOT NULL,
			user_id TEXT NOT NULL,
			priority INTEGER NOT NULL DEFAULT 0,
			duration_min INTEGER NOT NULL,
			status TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			started_at DATETIME,
			ended_at DATETIME,
			request_id TEXT UNIQUE NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS queue_records (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL UNIQUE,
			position INTEGER NOT NULL,
			queue_status TEXT NOT NULL,
			enqueued_at DATETIME NOT NULL,
			dequeued_at DATETIME,
			FOREIGN KEY (job_id) REFERENCES jobs(id)
		)`,
		`CREATE TABLE IF NOT EXISTS release_events (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL,
			gpu_model TEXT NOT NULL,
			gpu_count INTEGER NOT NULL,
			release_type TEXT NOT NULL,
			released_at DATETIME NOT NULL,
			remark TEXT,
			FOREIGN KEY (job_id) REFERENCES jobs(id)
		)`,
		`CREATE TABLE IF NOT EXISTS exception_logs (
			id TEXT PRIMARY KEY,
			request_id TEXT NOT NULL,
			operation TEXT NOT NULL,
			raw_input TEXT NOT NULL,
			error_type TEXT NOT NULL,
			error_message TEXT NOT NULL,
			conclusion TEXT NOT NULL,
			occurred_at DATETIME NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_gpu_model ON jobs(gpu_model)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_request_id ON jobs(request_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exception_request_id ON exception_logs(request_id)`,
	}

	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

func (s *SQLiteStore) initGPUResources() error {
	defaultGPUs := []struct {
		model  string
		total  int
	}{
		{"RTX-3090", 8},
		{"RTX-4090", 4},
		{"A100", 2},
		{"V100", 4},
	}

	for _, gpu := range defaultGPUs {
		var exists int
		err := s.db.QueryRow("SELECT 1 FROM gpu_resources WHERE model = ?", gpu.model).Scan(&exists)
		if err == sql.ErrNoRows {
			now := time.Now()
			_, err = s.db.Exec(
				"INSERT INTO gpu_resources (id, model, total_count, used_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
				uuid.New().String(), gpu.model, gpu.total, now, now,
			)
			if err != nil {
				log.Printf("Warning: failed to init GPU %s: %v", gpu.model, err)
			}
		}
	}
	return nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) GetDB() *sql.DB {
	return s.db
}

func (s *SQLiteStore) CreateJob(job *models.Job) error {
	job.ID = uuid.New().String()
	job.CreatedAt = time.Now()
	job.UpdatedAt = time.Now()

	_, err := s.db.Exec(`
		INSERT INTO jobs (id, name, gpu_model, gpu_count, user_id, priority, duration_min, status, created_at, updated_at, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, job.ID, job.Name, job.GPUModel, job.GPUCount, job.UserID, job.Priority, job.DurationMin, job.Status, job.CreatedAt, job.UpdatedAt, job.RequestID)
	return err
}

func (s *SQLiteStore) GetJobByID(id string) (*models.Job, error) {
	var job models.Job
	var startedAt, endedAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT id, name, gpu_model, gpu_count, user_id, priority, duration_min, status, created_at, updated_at, started_at, ended_at, request_id
		FROM jobs WHERE id = ?
	`, id).Scan(&job.ID, &job.Name, &job.GPUModel, &job.GPUCount, &job.UserID, &job.Priority, &job.DurationMin, &job.Status, &job.CreatedAt, &job.UpdatedAt, &startedAt, &endedAt, &job.RequestID)

	if err != nil {
		return nil, err
	}

	if startedAt.Valid {
		job.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		job.EndedAt = &endedAt.Time
	}

	return &job, nil
}

func (s *SQLiteStore) GetJobByRequestID(requestID string) (*models.Job, error) {
	var job models.Job
	var startedAt, endedAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT id, name, gpu_model, gpu_count, user_id, priority, duration_min, status, created_at, updated_at, started_at, ended_at, request_id
		FROM jobs WHERE request_id = ?
	`, requestID).Scan(&job.ID, &job.Name, &job.GPUModel, &job.GPUCount, &job.UserID, &job.Priority, &job.DurationMin, &job.Status, &job.CreatedAt, &job.UpdatedAt, &startedAt, &endedAt, &job.RequestID)

	if err != nil {
		return nil, err
	}

	if startedAt.Valid {
		job.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		job.EndedAt = &endedAt.Time
	}

	return &job, nil
}

func (s *SQLiteStore) UpdateJob(job *models.Job) error {
	job.UpdatedAt = time.Now()

	_, err := s.db.Exec(`
		UPDATE jobs SET name=?, gpu_model=?, gpu_count=?, user_id=?, priority=?, duration_min=?, status=?, updated_at=?, started_at=?, ended_at=?
		WHERE id=?
	`, job.Name, job.GPUModel, job.GPUCount, job.UserID, job.Priority, job.DurationMin, job.Status, job.UpdatedAt, job.StartedAt, job.EndedAt, job.ID)
	return err
}

func (s *SQLiteStore) ListJobs(status string, gpuModel string, offset, limit int) ([]models.Job, int64, error) {
	query := "SELECT id, name, gpu_model, gpu_count, user_id, priority, duration_min, status, created_at, updated_at, started_at, ended_at, request_id FROM jobs WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM jobs WHERE 1=1"
	args := []interface{}{}
	countArgs := []interface{}{}

	argIdx := 1
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		countArgs = append(countArgs, status)
		argIdx++
	}
	if gpuModel != "" {
		query += fmt.Sprintf(" AND gpu_model = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND gpu_model = $%d", argIdx)
		args = append(args, gpuModel)
		countArgs = append(countArgs, gpuModel)
		argIdx++
	}

	query += " ORDER BY priority DESC, created_at ASC"
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		args = append(args, limit, offset)
	}

	var total int64
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var jobs []models.Job
	for rows.Next() {
		var job models.Job
		var startedAt, endedAt sql.NullTime
		err := rows.Scan(&job.ID, &job.Name, &job.GPUModel, &job.GPUCount, &job.UserID, &job.Priority, &job.DurationMin, &job.Status, &job.CreatedAt, &job.UpdatedAt, &startedAt, &endedAt, &job.RequestID)
		if err != nil {
			return nil, 0, err
		}
		if startedAt.Valid {
			job.StartedAt = &startedAt.Time
		}
		if endedAt.Valid {
			job.EndedAt = &endedAt.Time
		}
		jobs = append(jobs, job)
	}

	return jobs, total, nil
}
