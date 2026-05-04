package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"concurrency-detector/internal/models"
)

type Store struct {
	db *sql.DB
	mu sync.RWMutex
}

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS map_events (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		map_name TEXT NOT NULL,
		key TEXT NOT NULL,
		operation TEXT NOT NULL,
		goroutine_id INTEGER NOT NULL,
		has_lock BOOLEAN NOT NULL,
		lock_type TEXT,
		timestamp DATETIME NOT NULL,
		stack_frame TEXT,
		metadata_raw TEXT,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE INDEX IF NOT EXISTS idx_map_events_project ON map_events(project_id);
	CREATE INDEX IF NOT EXISTS idx_map_events_timestamp ON map_events(timestamp);

	CREATE TABLE IF NOT EXISTS goroutine_snapshots (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		snapshot_id TEXT NOT NULL,
		goroutine_id INTEGER NOT NULL,
		state TEXT NOT NULL,
		stack TEXT NOT NULL,
		blocked_reason TEXT,
		blocked_since DATETIME,
		timestamp DATETIME NOT NULL,
		metadata_raw TEXT,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE INDEX IF NOT EXISTS idx_goroutines_project ON goroutine_snapshots(project_id);
	CREATE INDEX IF NOT EXISTS idx_goroutines_snapshot ON goroutine_snapshots(snapshot_id);

	CREATE TABLE IF NOT EXISTS worker_queues (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		queue_name TEXT NOT NULL,
		worker_count INTEGER NOT NULL,
		queue_capacity INTEGER NOT NULL,
		queue_length INTEGER NOT NULL,
		pending_tasks INTEGER NOT NULL,
		failed_tasks INTEGER NOT NULL,
		completed_tasks INTEGER NOT NULL,
		last_task_duration_ms INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE INDEX IF NOT EXISTS idx_workers_project ON worker_queues(project_id);

	CREATE TABLE IF NOT EXISTS analysis_results (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		category TEXT NOT NULL,
		severity TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		evidence_count INTEGER NOT NULL,
		evidence_raw TEXT,
		suggestions_raw TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results(project_id);

	CREATE TABLE IF NOT EXISTS replay_tasks (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		analysis_result_id TEXT,
		target_category TEXT NOT NULL,
		status TEXT NOT NULL,
		config_raw TEXT,
		concurrency INTEGER NOT NULL,
		duration_seconds INTEGER NOT NULL,
		timeout_seconds INTEGER NOT NULL,
		result TEXT,
		error TEXT,
		created_at DATETIME NOT NULL,
		started_at DATETIME,
		completed_at DATETIME,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	);

	CREATE INDEX IF NOT EXISTS idx_replay_project ON replay_tasks(project_id);
	CREATE INDEX IF NOT EXISTS idx_replay_status ON replay_tasks(status);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) CreateProject(p *models.Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO projects (id, name, description, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query, p.ID, p.Name, p.Description, p.CreatedAt, p.UpdatedAt)
	return err
}

func (s *Store) GetProject(id string) (*models.Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?`
	row := s.db.QueryRow(query, id)

	var p models.Project
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (s *Store) ListProjects() ([]*models.Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, &p)
	}
	return projects, rows.Err()
}

func (s *Store) CreateMapEvent(e *models.MapEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO map_events (
			id, project_id, map_name, key, operation, goroutine_id, 
			has_lock, lock_type, timestamp, stack_frame, metadata_raw
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		e.ID, e.ProjectID, e.MapName, e.Key, e.Operation,
		e.GoroutineID, e.HasLock, e.LockType, e.Timestamp,
		e.StackFrame, e.MetadataRaw,
	)
	return err
}

func (s *Store) GetMapEvents(projectID string, limit int) ([]*models.MapEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, map_name, key, operation, goroutine_id,
			   has_lock, lock_type, timestamp, stack_frame, metadata_raw
		FROM map_events
		WHERE project_id = ?
		ORDER BY timestamp DESC
	`
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*models.MapEvent
	for rows.Next() {
		var e models.MapEvent
		if err := rows.Scan(
			&e.ID, &e.ProjectID, &e.MapName, &e.Key, &e.Operation,
			&e.GoroutineID, &e.HasLock, &e.LockType, &e.Timestamp,
			&e.StackFrame, &e.MetadataRaw,
		); err != nil {
			return nil, err
		}
		_ = e.LoadMetadata()
		events = append(events, &e)
	}
	return events, rows.Err()
}

func (s *Store) CreateGoroutineSnapshot(snap *models.GoroutineSnapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO goroutine_snapshots (
			id, project_id, snapshot_id, goroutine_id, state, stack,
			blocked_reason, blocked_since, timestamp, metadata_raw
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		snap.ID, snap.ProjectID, snap.SnapshotID, snap.GoroutineID,
		snap.State, snap.Stack, snap.BlockedReason, snap.BlockedSince,
		snap.Timestamp, snap.MetadataRaw,
	)
	return err
}

func (s *Store) GetGoroutineSnapshots(projectID string) ([]*models.GoroutineSnapshot, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, snapshot_id, goroutine_id, state, stack,
			   blocked_reason, blocked_since, timestamp, metadata_raw
		FROM goroutine_snapshots
		WHERE project_id = ?
		ORDER BY timestamp DESC
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []*models.GoroutineSnapshot
	for rows.Next() {
		var s models.GoroutineSnapshot
		if err := rows.Scan(
			&s.ID, &s.ProjectID, &s.SnapshotID, &s.GoroutineID,
			&s.State, &s.Stack, &s.BlockedReason, &s.BlockedSince,
			&s.Timestamp, &s.MetadataRaw,
		); err != nil {
			return nil, err
		}
		_ = s.LoadMetadata()
		snapshots = append(snapshots, &s)
	}
	return snapshots, rows.Err()
}

func (s *Store) CreateWorkerQueue(w *models.WorkerQueue) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO worker_queues (
			id, project_id, queue_name, worker_count, queue_capacity,
			queue_length, pending_tasks, failed_tasks, completed_tasks,
			last_task_duration_ms, timestamp
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		w.ID, w.ProjectID, w.QueueName, w.WorkerCount, w.QueueCapacity,
		w.QueueLength, w.PendingTasks, w.FailedTasks, w.CompletedTasks,
		int64(w.LastTaskDuration), w.Timestamp,
	)
	return err
}

func (s *Store) GetWorkerQueues(projectID string) ([]*models.WorkerQueue, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, queue_name, worker_count, queue_capacity,
			   queue_length, pending_tasks, failed_tasks, completed_tasks,
			   last_task_duration_ms, timestamp
		FROM worker_queues
		WHERE project_id = ?
		ORDER BY timestamp DESC
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var queues []*models.WorkerQueue
	for rows.Next() {
		var w models.WorkerQueue
		var duration int64
		if err := rows.Scan(
			&w.ID, &w.ProjectID, &w.QueueName, &w.WorkerCount, &w.QueueCapacity,
			&w.QueueLength, &w.PendingTasks, &w.FailedTasks, &w.CompletedTasks,
			&duration, &w.Timestamp,
		); err != nil {
			return nil, err
		}
		w.LastTaskDuration = time.Duration(duration)
		queues = append(queues, &w)
	}
	return queues, rows.Err()
}

func (s *Store) CreateAnalysisResult(r *models.AnalysisResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO analysis_results (
			id, project_id, category, severity, title, description,
			evidence_count, evidence_raw, suggestions_raw, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		r.ID, r.ProjectID, r.Category, r.Severity, r.Title, r.Description,
		r.EvidenceCount, r.EvidenceRaw, r.SuggestionsRaw, r.CreatedAt,
	)
	return err
}

func (s *Store) GetAnalysisResults(projectID string) ([]*models.AnalysisResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, category, severity, title, description,
			   evidence_count, evidence_raw, suggestions_raw, created_at
		FROM analysis_results
		WHERE project_id = ?
		ORDER BY 
			CASE severity 
				WHEN 'critical' THEN 1 
				WHEN 'high' THEN 2 
				WHEN 'medium' THEN 3 
				ELSE 4 
			END,
			created_at DESC
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*models.AnalysisResult
	for rows.Next() {
		var r models.AnalysisResult
		if err := rows.Scan(
			&r.ID, &r.ProjectID, &r.Category, &r.Severity, &r.Title, &r.Description,
			&r.EvidenceCount, &r.EvidenceRaw, &r.SuggestionsRaw, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		_ = r.LoadEvidence()
		_ = r.LoadSuggestions()
		results = append(results, &r)
	}
	return results, rows.Err()
}

func (s *Store) DeleteAnalysisResults(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `DELETE FROM analysis_results WHERE project_id = ?`
	_, err := s.db.Exec(query, projectID)
	return err
}

func (s *Store) CreateReplayTask(t *models.ReplayTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO replay_tasks (
			id, project_id, analysis_result_id, target_category, status,
			config_raw, concurrency, duration_seconds, timeout_seconds,
			result, error, created_at, started_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		t.ID, t.ProjectID, t.AnalysisResultID, t.TargetCategory, t.Status,
		t.ConfigRaw, t.Concurrency, int64(t.Duration), int64(t.Timeout),
		t.Result, t.Error, t.CreatedAt, t.StartedAt, t.CompletedAt,
	)
	return err
}

func (s *Store) UpdateReplayTask(t *models.ReplayTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		UPDATE replay_tasks SET
			status = ?, config_raw = ?, concurrency = ?, duration_seconds = ?,
			timeout_seconds = ?, result = ?, error = ?, started_at = ?, completed_at = ?
		WHERE id = ?
	`
	_, err := s.db.Exec(query,
		t.Status, t.ConfigRaw, t.Concurrency, int64(t.Duration),
		int64(t.Timeout), t.Result, t.Error, t.StartedAt, t.CompletedAt,
		t.ID,
	)
	return err
}

func (s *Store) GetReplayTask(id string) (*models.ReplayTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, analysis_result_id, target_category, status,
			   config_raw, concurrency, duration_seconds, timeout_seconds,
			   result, error, created_at, started_at, completed_at
		FROM replay_tasks
		WHERE id = ?
	`

	row := s.db.QueryRow(query, id)
	var t models.ReplayTask
	var duration, timeout int64
	err := row.Scan(
		&t.ID, &t.ProjectID, &t.AnalysisResultID, &t.TargetCategory, &t.Status,
		&t.ConfigRaw, &t.Concurrency, &duration, &timeout,
		&t.Result, &t.Error, &t.CreatedAt, &t.StartedAt, &t.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t.Duration = time.Duration(duration)
	t.Timeout = time.Duration(timeout)
	_ = t.LoadConfig()
	return &t, nil
}

func (s *Store) GetReplayTasks(projectID string) ([]*models.ReplayTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
		SELECT id, project_id, analysis_result_id, target_category, status,
			   config_raw, concurrency, duration_seconds, timeout_seconds,
			   result, error, created_at, started_at, completed_at
		FROM replay_tasks
		WHERE project_id = ?
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*models.ReplayTask
	for rows.Next() {
		var t models.ReplayTask
		var duration, timeout int64
		if err := rows.Scan(
			&t.ID, &t.ProjectID, &t.AnalysisResultID, &t.TargetCategory, &t.Status,
			&t.ConfigRaw, &t.Concurrency, &duration, &timeout,
			&t.Result, &t.Error, &t.CreatedAt, &t.StartedAt, &t.CompletedAt,
		); err != nil {
			return nil, err
		}
		t.Duration = time.Duration(duration)
		t.Timeout = time.Duration(timeout)
		_ = t.LoadConfig()
		tasks = append(tasks, &t)
	}
	return tasks, rows.Err()
}

func (s *Store) Stats(projectID string) (map[string]interface{}, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]interface{})

	var mapCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM map_events WHERE project_id = ?`, projectID).Scan(&mapCount)
	stats["map_events_count"] = mapCount

	var goroutineCount int
	_ = s.db.QueryRow(`SELECT COUNT(DISTINCT goroutine_id) FROM goroutine_snapshots WHERE project_id = ?`, projectID).Scan(&goroutineCount)
	stats["unique_goroutines"] = goroutineCount

	var analysisCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM analysis_results WHERE project_id = ?`, projectID).Scan(&analysisCount)
	stats["analysis_results_count"] = analysisCount

	var criticalCount, highCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM analysis_results WHERE project_id = ? AND severity = 'critical'`, projectID).Scan(&criticalCount)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM analysis_results WHERE project_id = ? AND severity = 'high'`, projectID).Scan(&highCount)
	stats["critical_count"] = criticalCount
	stats["high_count"] = highCount

	return stats, nil
}

func jsonString(v interface{}) string {
	data, _ := json.Marshal(v)
	return string(data)
}
