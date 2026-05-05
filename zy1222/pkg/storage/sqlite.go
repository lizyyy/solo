package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"mapdebug/pkg/types"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	store := &SQLiteStore{db: db}
	if err := store.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return store, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) initSchema() error {
	createTables := []string{
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			name TEXT,
			case_id TEXT,
			seed INTEGER,
			op_count INTEGER,
			step_count INTEGER,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS steps (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			step_index INTEGER,
			op_type TEXT,
			op_key TEXT,
			op_value TEXT,
			map_count INTEGER,
			map_b INTEGER,
			bucket_count INTEGER,
			old_bucket_count INTEGER,
			load_factor REAL,
			overflow_count INTEGER,
			avg_chain_length REAL,
			max_chain_length INTEGER,
			evac_progress REAL,
			lookup_cost REAL,
			lookup_overflow_walk INTEGER,
			expand_triggered INTEGER,
			expand_phase TEXT,
			bucket_dist_json TEXT,
			risks_json TEXT,
			created_at DATETIME,
			FOREIGN KEY (session_id) REFERENCES sessions(id)
		)`,
		`CREATE TABLE IF NOT EXISTS risks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			step_index INTEGER,
			level TEXT,
			category TEXT,
			message TEXT,
			suggestion TEXT,
			affected_key TEXT,
			FOREIGN KEY (session_id) REFERENCES sessions(id)
		)`,
		`CREATE TABLE IF NOT EXISTS expand_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			step_index INTEGER,
			phase TEXT,
			old_b INTEGER,
			new_b INTEGER,
			FOREIGN KEY (session_id) REFERENCES sessions(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_steps_session ON steps(session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_risks_session ON risks(session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category)`,
	}

	for _, stmt := range createTables {
		_, err := s.db.Exec(stmt)
		if err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	return nil
}

func (s *SQLiteStore) CreateSession(session *types.Session) error {
	query := `
		INSERT INTO sessions (id, name, case_id, seed, op_count, step_count, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		session.ID,
		session.Name,
		session.CaseID,
		session.Seed,
		session.OpCount,
		session.StepCount,
		session.CreatedAt,
		session.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetSession(id string) (*types.Session, error) {
	query := `
		SELECT id, name, case_id, seed, op_count, step_count, created_at, updated_at
		FROM sessions WHERE id = ?
	`
	var session types.Session
	err := s.db.QueryRow(query, id).Scan(
		&session.ID,
		&session.Name,
		&session.CaseID,
		&session.Seed,
		&session.OpCount,
		&session.StepCount,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *SQLiteStore) ListSessions() ([]types.Session, error) {
	query := `
		SELECT id, name, case_id, seed, op_count, step_count, created_at, updated_at
		FROM sessions ORDER BY created_at DESC
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []types.Session
	for rows.Next() {
		var session types.Session
		err := rows.Scan(
			&session.ID,
			&session.Name,
			&session.CaseID,
			&session.Seed,
			&session.OpCount,
			&session.StepCount,
			&session.CreatedAt,
			&session.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

func (s *SQLiteStore) SaveStep(sessionID string, step *types.StepResult) error {
	bucketDistJSON, _ := json.Marshal(step.BucketDist)
	risksJSON, _ := json.Marshal(step.RiskAlerts)

	query := `
		INSERT INTO steps (
			session_id, step_index, op_type, op_key, op_value,
			map_count, map_b, bucket_count, old_bucket_count,
			load_factor, overflow_count, avg_chain_length, max_chain_length,
			evac_progress, lookup_cost, lookup_overflow_walk,
			expand_triggered, expand_phase, bucket_dist_json, risks_json, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	expandTriggered := 0
	if step.ExpandTriggered {
		expandTriggered = 1
	}

	_, err := s.db.Exec(query,
		sessionID,
		step.StepIndex,
		string(step.Op.Type),
		step.Op.Key,
		step.Op.Value,
		step.MapState.Count,
		step.MapState.B,
		step.MapState.BucketCount,
		step.MapState.OldBucketCount,
		step.MapState.LoadFactor,
		step.MapState.OverflowCount,
		step.MapState.AvgChainLength,
		step.MapState.MaxChainLength,
		step.MapState.EvacProgress,
		step.LookupCost.CostScore,
		step.LookupCost.OverflowWalk,
		expandTriggered,
		step.ExpandPhase,
		string(bucketDistJSON),
		string(risksJSON),
		time.Now(),
	)

	if err != nil {
		return err
	}

	for _, risk := range step.RiskAlerts {
		if err := s.saveRisk(sessionID, step.StepIndex, &risk); err != nil {
			return err
		}
	}

	if step.ExpandTriggered || step.ExpandPhase != "none" {
		if err := s.saveExpandEvent(sessionID, step); err != nil {
			return err
		}
	}

	return nil
}

func (s *SQLiteStore) saveRisk(sessionID string, stepIndex int, risk *types.RiskAlert) error {
	query := `
		INSERT INTO risks (session_id, step_index, level, category, message, suggestion, affected_key)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		sessionID,
		stepIndex,
		string(risk.Level),
		string(risk.Category),
		risk.Message,
		risk.Suggestion,
		risk.AffectedKey,
	)
	return err
}

func (s *SQLiteStore) saveExpandEvent(sessionID string, step *types.StepResult) error {
	query := `
		INSERT INTO expand_events (session_id, step_index, phase, old_b, new_b)
		VALUES (?, ?, ?, ?, ?)
	`
	oldB := step.MapState.B
	if step.ExpandPhase == "started" {
		oldB = step.MapState.B - 1
	}

	_, err := s.db.Exec(query,
		sessionID,
		step.StepIndex,
		step.ExpandPhase,
		oldB,
		step.MapState.B,
	)
	return err
}

func (s *SQLiteStore) GetSteps(sessionID string) ([]types.StepResult, error) {
	query := `
		SELECT 
			step_index, op_type, op_key, op_value,
			map_count, map_b, bucket_count, old_bucket_count,
			load_factor, overflow_count, avg_chain_length, max_chain_length,
			evac_progress, lookup_cost, lookup_overflow_walk,
			expand_triggered, expand_phase, bucket_dist_json, risks_json
		FROM steps WHERE session_id = ? ORDER BY step_index
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []types.StepResult
	for rows.Next() {
		var step types.StepResult
		var opType string
		var expandTriggered int
		var bucketDistJSON, risksJSON string

		err := rows.Scan(
			&step.StepIndex,
			&opType,
			&step.Op.Key,
			&step.Op.Value,
			&step.MapState.Count,
			&step.MapState.B,
			&step.MapState.BucketCount,
			&step.MapState.OldBucketCount,
			&step.MapState.LoadFactor,
			&step.MapState.OverflowCount,
			&step.MapState.AvgChainLength,
			&step.MapState.MaxChainLength,
			&step.MapState.EvacProgress,
			&step.LookupCost.CostScore,
			&step.LookupCost.OverflowWalk,
			&expandTriggered,
			&step.ExpandPhase,
			&bucketDistJSON,
			&risksJSON,
		)
		if err != nil {
			return nil, err
		}

		step.Op.Type = types.OpType(opType)
		step.ExpandTriggered = expandTriggered == 1

		json.Unmarshal([]byte(bucketDistJSON), &step.BucketDist)
		json.Unmarshal([]byte(risksJSON), &step.RiskAlerts)

		steps = append(steps, step)
	}
	return steps, nil
}

func (s *SQLiteStore) GetRisks(sessionID string) ([]types.RiskAlert, error) {
	query := `
		SELECT level, category, message, suggestion, affected_key
		FROM risks WHERE session_id = ? ORDER BY step_index
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []types.RiskAlert
	for rows.Next() {
		var risk types.RiskAlert
		var level, category string
		err := rows.Scan(&level, &category, &risk.Message, &risk.Suggestion, &risk.AffectedKey)
		if err != nil {
			return nil, err
		}
		risk.Level = types.RiskLevel(level)
		risk.Category = types.RiskCategory(category)
		risks = append(risks, risk)
	}
	return risks, nil
}

func (s *SQLiteStore) GetExpandEvents(sessionID string) ([]ExpandEvent, error) {
	query := `
		SELECT step_index, phase, old_b, new_b
		FROM expand_events WHERE session_id = ? ORDER BY step_index
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []ExpandEvent
	for rows.Next() {
		var event ExpandEvent
		err := rows.Scan(&event.StepIndex, &event.Phase, &event.OldB, &event.NewB)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

type ExpandEvent struct {
	StepIndex int
	Phase     string
	OldB      int
	NewB      int
}

func (s *SQLiteStore) GetAggregatedStats(sessionID string) (*SessionStats, error) {
	query := `
		SELECT 
			COUNT(*) as total_steps,
			AVG(lookup_cost) as avg_cost,
			MAX(lookup_cost) as max_cost,
			AVG(lookup_overflow_walk) as avg_overflow,
			MAX(lookup_overflow_walk) as max_overflow,
			SUM(CASE WHEN expand_triggered = 1 THEN 1 ELSE 0 END) as expand_count
		FROM steps WHERE session_id = ?
	`

	var stats SessionStats
	err := s.db.QueryRow(query, sessionID).Scan(
		&stats.TotalSteps,
		&stats.AvgCost,
		&stats.MaxCost,
		&stats.AvgOverflow,
		&stats.MaxOverflow,
		&stats.ExpandCount,
	)
	if err != nil {
		return nil, err
	}

	riskQuery := `
		SELECT category, COUNT(*) as cnt
		FROM risks WHERE session_id = ?
		GROUP BY category
	`
	rows, err := s.db.Query(riskQuery, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats.RiskByCategory = make(map[string]int)
	for rows.Next() {
		var category string
		var count int
		if err := rows.Scan(&category, &count); err != nil {
			return nil, err
		}
		stats.RiskByCategory[category] = count
	}

	return &stats, nil
}

type SessionStats struct {
	TotalSteps      int
	AvgCost         float64
	MaxCost         float64
	AvgOverflow     float64
	MaxOverflow     int
	ExpandCount     int
	RiskByCategory  map[string]int
}

func (s *SQLiteStore) UpdateSession(sessionID string, stepCount int) error {
	query := `
		UPDATE sessions SET step_count = ?, updated_at = ? WHERE id = ?
	`
	_, err := s.db.Exec(query, stepCount, time.Now(), sessionID)
	return err
}
