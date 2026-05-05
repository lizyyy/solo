package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gcinsight/models"

	_ "github.com/mattn/go-sqlite3"
)

type Storage struct {
	db *sql.DB
}

func NewStorage(dbPath string) (*Storage, error) {
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	s := &Storage{db: db}
	if err := s.initSchema(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		description TEXT,
		created_at DATETIME NOT NULL,
		gc_trace_path TEXT,
		heap_sample_path TEXT,
		alloc_event_path TEXT
	);

	CREATE TABLE IF NOT EXISTS gc_traces (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		gc_number INTEGER NOT NULL,
		phase TEXT NOT NULL,
		start_timestamp REAL,
		pause_duration INTEGER,
		heap_in_use INTEGER,
		heap_goal INTEGER,
		heap_marked INTEGER,
		stack_marked INTEGER,
		assisted_bytes INTEGER,
		assisted_g INTEGER,
		cpu_fraction REAL,
		gogc INTEGER,
		gomemlimit INTEGER,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	);

	CREATE TABLE IF NOT EXISTS heap_samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		heap_alloc INTEGER,
		heap_sys INTEGER,
		heap_in_use INTEGER,
		heap_idle INTEGER,
		heap_released INTEGER,
		heap_objects INTEGER,
		mallocs INTEGER,
		frees INTEGER,
		next_gc INTEGER,
		last_gc INTEGER,
		num_gc INTEGER,
		num_forced_gc INTEGER,
		gc_cpu_fraction REAL,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	);

	CREATE TABLE IF NOT EXISTS alloc_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		type TEXT,
		size INTEGER,
		address INTEGER,
		stack TEXT,
		goroutine INTEGER,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	);

	CREATE TABLE IF NOT EXISTS analysis_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		created_at DATETIME NOT NULL,
		pause_distribution TEXT,
		heap_goal_deviation TEXT,
		assist_pressure TEXT,
		memory_peaks TEXT,
		recommendations TEXT,
		raw_metrics TEXT,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	);

	CREATE INDEX IF NOT EXISTS idx_gc_traces_session ON gc_traces(session_id);
	CREATE INDEX IF NOT EXISTS idx_heap_samples_session ON heap_samples(session_id);
	CREATE INDEX IF NOT EXISTS idx_alloc_events_session ON alloc_events(session_id);
	CREATE INDEX IF NOT EXISTS idx_analysis_results_session ON analysis_results(session_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Storage) CreateSession(session *models.AnalysisSession) error {
	query := `
	INSERT INTO sessions (name, description, created_at, gc_trace_path, heap_sample_path, alloc_event_path)
	VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		session.Name,
		session.Description,
		session.CreatedAt,
		session.GCTracePath,
		session.HeapSamplePath,
		session.AllocEventPath,
	)
	if err != nil {
		return err
	}

	session.ID, err = result.LastInsertId()
	return err
}

func (s *Storage) GetSession(id int64) (*models.AnalysisSession, error) {
	query := `
	SELECT id, name, description, created_at, gc_trace_path, heap_sample_path, alloc_event_path
	FROM sessions WHERE id = ?
	`
	session := &models.AnalysisSession{}
	err := s.db.QueryRow(query, id).Scan(
		&session.ID,
		&session.Name,
		&session.Description,
		&session.CreatedAt,
		&session.GCTracePath,
		&session.HeapSamplePath,
		&session.AllocEventPath,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("session not found")
	}
	return session, err
}

func (s *Storage) ListSessions() ([]models.AnalysisSession, error) {
	query := `
	SELECT id, name, description, created_at, gc_trace_path, heap_sample_path, alloc_event_path
	FROM sessions ORDER BY created_at DESC
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.AnalysisSession
	for rows.Next() {
		var session models.AnalysisSession
		err := rows.Scan(
			&session.ID,
			&session.Name,
			&session.Description,
			&session.CreatedAt,
			&session.GCTracePath,
			&session.HeapSamplePath,
			&session.AllocEventPath,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

func (s *Storage) SaveGCTraces(sessionID int64, traces []models.GCTraceEntry) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
	INSERT INTO gc_traces (
		session_id, timestamp, gc_number, phase, start_timestamp,
		pause_duration, heap_in_use, heap_goal, heap_marked, stack_marked,
		assisted_bytes, assisted_g, cpu_fraction, gogc, gomemlimit
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range traces {
		_, err = stmt.Exec(
			sessionID,
			t.Timestamp,
			t.GCNumber,
			t.Phase,
			t.StartTimestamp,
			t.PauseDuration.Nanoseconds(),
			t.HeapInUse,
			t.HeapGoal,
			t.HeapMarked,
			t.StackMarked,
			t.AssistedBytes,
			t.AssistedG,
			t.CPUFraction,
			t.GOGC,
			t.GOMEMLIMIT,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) GetGCTraces(sessionID int64) ([]models.GCTraceEntry, error) {
	query := `
	SELECT timestamp, gc_number, phase, start_timestamp, pause_duration,
		heap_in_use, heap_goal, heap_marked, stack_marked,
		assisted_bytes, assisted_g, cpu_fraction, gogc, gomemlimit
	FROM gc_traces WHERE session_id = ? ORDER BY timestamp ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []models.GCTraceEntry
	for rows.Next() {
		var t models.GCTraceEntry
		var pauseNano int64
		err := rows.Scan(
			&t.Timestamp,
			&t.GCNumber,
			&t.Phase,
			&t.StartTimestamp,
			&pauseNano,
			&t.HeapInUse,
			&t.HeapGoal,
			&t.HeapMarked,
			&t.StackMarked,
			&t.AssistedBytes,
			&t.AssistedG,
			&t.CPUFraction,
			&t.GOGC,
			&t.GOMEMLIMIT,
		)
		if err != nil {
			return nil, err
		}
		t.PauseDuration = time.Duration(pauseNano)
		traces = append(traces, t)
	}
	return traces, nil
}

func (s *Storage) SaveHeapSamples(sessionID int64, samples []models.HeapSample) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
	INSERT INTO heap_samples (
		session_id, timestamp, heap_alloc, heap_sys, heap_in_use,
		heap_idle, heap_released, heap_objects, mallocs, frees,
		next_gc, last_gc, num_gc, num_forced_gc, gc_cpu_fraction
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, s := range samples {
		_, err = stmt.Exec(
			sessionID,
			s.Timestamp,
			s.HeapAlloc,
			s.HeapSys,
			s.HeapInUse,
			s.HeapIdle,
			s.HeapReleased,
			s.HeapObjects,
			s.Mallocs,
			s.Frees,
			s.NextGC,
			s.LastGC,
			s.NumGC,
			s.NumForcedGC,
			s.GCCPUFraction,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) GetHeapSamples(sessionID int64) ([]models.HeapSample, error) {
	query := `
	SELECT timestamp, heap_alloc, heap_sys, heap_in_use,
		heap_idle, heap_released, heap_objects, mallocs, frees,
		next_gc, last_gc, num_gc, num_forced_gc, gc_cpu_fraction
	FROM heap_samples WHERE session_id = ? ORDER BY timestamp ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []models.HeapSample
	for rows.Next() {
		var s models.HeapSample
		err := rows.Scan(
			&s.Timestamp,
			&s.HeapAlloc,
			&s.HeapSys,
			&s.HeapInUse,
			&s.HeapIdle,
			&s.HeapReleased,
			&s.HeapObjects,
			&s.Mallocs,
			&s.Frees,
			&s.NextGC,
			&s.LastGC,
			&s.NumGC,
			&s.NumForcedGC,
			&s.GCCPUFraction,
		)
		if err != nil {
			return nil, err
		}
		samples = append(samples, s)
	}
	return samples, nil
}

func (s *Storage) SaveAllocEvents(sessionID int64, events []models.AllocEvent) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
	INSERT INTO alloc_events (
		session_id, timestamp, type, size, address, stack, goroutine
	) VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, e := range events {
		_, err = stmt.Exec(
			sessionID,
			e.Timestamp,
			e.Type,
			e.Size,
			e.Address,
			e.Stack,
			e.Goroutine,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) GetAllocEvents(sessionID int64) ([]models.AllocEvent, error) {
	query := `
	SELECT timestamp, type, size, address, stack, goroutine
	FROM alloc_events WHERE session_id = ? ORDER BY timestamp ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.AllocEvent
	for rows.Next() {
		var e models.AllocEvent
		err := rows.Scan(
			&e.Timestamp,
			&e.Type,
			&e.Size,
			&e.Address,
			&e.Stack,
			&e.Goroutine,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (s *Storage) SaveAnalysisResult(result *models.AnalysisResult) error {
	pauseDist, err := json.Marshal(result.PauseDistribution)
	if err != nil {
		return err
	}

	goalDeviation, err := json.Marshal(result.HeapGoalDeviation)
	if err != nil {
		return err
	}

	assistPressure, err := json.Marshal(result.AssistPressure)
	if err != nil {
		return err
	}

	memoryPeaks, err := json.Marshal(result.MemoryPeaks)
	if err != nil {
		return err
	}

	recommendations, err := json.Marshal(result.Recommendations)
	if err != nil {
		return err
	}

	rawMetrics, err := json.Marshal(result.RawMetrics)
	if err != nil {
		return err
	}

	query := `
	INSERT INTO analysis_results (
		session_id, created_at, pause_distribution, heap_goal_deviation,
		assist_pressure, memory_peaks, recommendations, raw_metrics
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	resultSet, err := s.db.Exec(query,
		result.SessionID,
		result.CreatedAt,
		string(pauseDist),
		string(goalDeviation),
		string(assistPressure),
		string(memoryPeaks),
		string(recommendations),
		string(rawMetrics),
	)
	if err != nil {
		return err
	}

	result.ID, err = resultSet.LastInsertId()
	return err
}

func (s *Storage) GetAnalysisResult(sessionID int64) (*models.AnalysisResult, error) {
	query := `
	SELECT id, session_id, created_at, pause_distribution, heap_goal_deviation,
		assist_pressure, memory_peaks, recommendations, raw_metrics
	FROM analysis_results WHERE session_id = ? ORDER BY created_at DESC LIMIT 1
	`

	var result models.AnalysisResult
	var pauseDistStr, goalDeviationStr, assistPressureStr string
	var memoryPeaksStr, recommendationsStr, rawMetricsStr string

	err := s.db.QueryRow(query, sessionID).Scan(
		&result.ID,
		&result.SessionID,
		&result.CreatedAt,
		&pauseDistStr,
		&goalDeviationStr,
		&assistPressureStr,
		&memoryPeaksStr,
		&recommendationsStr,
		&rawMetricsStr,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("analysis result not found")
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal([]byte(pauseDistStr), &result.PauseDistribution); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(goalDeviationStr), &result.HeapGoalDeviation); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(assistPressureStr), &result.AssistPressure); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(memoryPeaksStr), &result.MemoryPeaks); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(recommendationsStr), &result.Recommendations); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(rawMetricsStr), &result.RawMetrics); err != nil {
		return nil, err
	}

	return &result, nil
}
