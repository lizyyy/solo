package store

import (
	"context-health/pkg/model"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

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

func (s *SQLiteStore) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT UNIQUE NOT NULL,
		created_at DATETIME NOT NULL,
		config BLOB,
		total_calls INTEGER DEFAULT 0,
		risk_count INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS calls (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		caller TEXT,
		callee TEXT,
		method TEXT,
		has_deadline BOOLEAN,
		deadline DATETIME,
		timeout_budget INTEGER,
		has_cancel BOOLEAN,
		cancel_propagated BOOLEAN,
		uses_background BOOLEAN,
		uses_todo BOOLEAN,
		with_value_keys TEXT,
		is_goroutine BOOLEAN,
		cancel_called BOOLEAN,
		source_file TEXT,
		line_number INTEGER,
		raw_data BLOB,
		FOREIGN KEY (session_id) REFERENCES sessions(session_id)
	);

	CREATE TABLE IF NOT EXISTS risks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		call_id INTEGER,
		category TEXT,
		level TEXT,
		title TEXT,
		description TEXT,
		suggestion TEXT,
		caller TEXT,
		callee TEXT,
		source_file TEXT,
		line_number INTEGER,
		FOREIGN KEY (session_id) REFERENCES sessions(session_id),
		FOREIGN KEY (call_id) REFERENCES calls(id)
	);

	CREATE TABLE IF NOT EXISTS budgets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		caller TEXT,
		callee TEXT,
		total_budget INTEGER,
		used_budget INTEGER,
		remaining INTEGER,
		percentage REAL,
		is_critical BOOLEAN,
		FOREIGN KEY (session_id) REFERENCES sessions(session_id)
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
	CREATE INDEX IF NOT EXISTS idx_calls_session_id ON calls(session_id);
	CREATE INDEX IF NOT EXISTS idx_risks_session_id ON risks(session_id);
	CREATE INDEX IF NOT EXISTS idx_budgets_session_id ON budgets(session_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *SQLiteStore) CreateSession(session *model.AnalysisSession) error {
	query := `
	INSERT INTO sessions (session_id, created_at, config, total_calls, risk_count)
	VALUES (?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		session.SessionID,
		session.CreatedAt,
		session.Config,
		session.TotalCalls,
		session.RiskCount,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	session.ID = id
	return nil
}

func (s *SQLiteStore) GetSession(sessionID string) (*model.AnalysisSession, error) {
	query := `
	SELECT id, session_id, created_at, config, total_calls, risk_count
	FROM sessions WHERE session_id = ?
	`
	session := &model.AnalysisSession{}
	err := s.db.QueryRow(query, sessionID).Scan(
		&session.ID,
		&session.SessionID,
		&session.CreatedAt,
		&session.Config,
		&session.TotalCalls,
		&session.RiskCount,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	return session, err
}

func (s *SQLiteStore) ListSessions(limit int) ([]model.AnalysisSession, error) {
	query := `
	SELECT id, session_id, created_at, config, total_calls, risk_count
	FROM sessions ORDER BY created_at DESC LIMIT ?
	`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []model.AnalysisSession
	for rows.Next() {
		session := model.AnalysisSession{}
		err := rows.Scan(
			&session.ID,
			&session.SessionID,
			&session.CreatedAt,
			&session.Config,
			&session.TotalCalls,
			&session.RiskCount,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

func (s *SQLiteStore) CreateCall(call *model.CallRecord) error {
	keysJSON, _ := json.Marshal(call.WithValueKeys)
	query := `
	INSERT INTO calls (
		session_id, caller, callee, method, has_deadline, deadline,
		timeout_budget, has_cancel, cancel_propagated, uses_background,
		uses_todo, with_value_keys, is_goroutine, cancel_called, source_file,
		line_number, raw_data
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		call.SessionID,
		call.Caller,
		call.Callee,
		call.Method,
		call.HasDeadline,
		call.Deadline,
		call.TimeoutBudget.Nanoseconds(),
		call.HasCancel,
		call.CancelPropagated,
		call.UsesBackground,
		call.UsesTODO,
		string(keysJSON),
		call.IsGoroutine,
		call.CancelCalled,
		call.SourceFile,
		call.LineNumber,
		call.RawData,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	call.ID = id
	return nil
}

func (s *SQLiteStore) GetCalls(sessionID string) ([]model.CallRecord, error) {
	query := `
	SELECT id, session_id, caller, callee, method, has_deadline, deadline,
	       timeout_budget, has_cancel, cancel_propagated, uses_background,
	       uses_todo, with_value_keys, is_goroutine, cancel_called, source_file,
	       line_number, raw_data
	FROM calls WHERE session_id = ?
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []model.CallRecord
	for rows.Next() {
		call := model.CallRecord{}
		var timeoutNanos int64
		var keysJSON string
		err := rows.Scan(
			&call.ID,
			&call.SessionID,
			&call.Caller,
			&call.Callee,
			&call.Method,
			&call.HasDeadline,
			&call.Deadline,
			&timeoutNanos,
			&call.HasCancel,
			&call.CancelPropagated,
			&call.UsesBackground,
			&call.UsesTODO,
			&keysJSON,
			&call.IsGoroutine,
			&call.CancelCalled,
			&call.SourceFile,
			&call.LineNumber,
			&call.RawData,
		)
		if err != nil {
			return nil, err
		}
		call.TimeoutBudget = time.Duration(timeoutNanos)
		json.Unmarshal([]byte(keysJSON), &call.WithValueKeys)
		calls = append(calls, call)
	}
	return calls, nil
}

func (s *SQLiteStore) CreateRisk(risk *model.RiskIssue) error {
	query := `
	INSERT INTO risks (
		session_id, call_id, category, level, title, description,
		suggestion, caller, callee, source_file, line_number
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		risk.SessionID,
		risk.CallID,
		risk.Category,
		risk.Level,
		risk.Title,
		risk.Description,
		risk.Suggestion,
		risk.Caller,
		risk.Callee,
		risk.SourceFile,
		risk.LineNumber,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	risk.ID = id
	return nil
}

func (s *SQLiteStore) GetRisks(sessionID string) ([]model.RiskIssue, error) {
	query := `
	SELECT id, session_id, call_id, category, level, title, description,
	       suggestion, caller, callee, source_file, line_number
	FROM risks WHERE session_id = ? ORDER BY 
		CASE level
			WHEN 'critical' THEN 1
			WHEN 'high' THEN 2
			WHEN 'medium' THEN 3
			WHEN 'low' THEN 4
			ELSE 5
		END
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.RiskIssue
	for rows.Next() {
		risk := model.RiskIssue{}
		err := rows.Scan(
			&risk.ID,
			&risk.SessionID,
			&risk.CallID,
			&risk.Category,
			&risk.Level,
			&risk.Title,
			&risk.Description,
			&risk.Suggestion,
			&risk.Caller,
			&risk.Callee,
			&risk.SourceFile,
			&risk.LineNumber,
		)
		if err != nil {
			return nil, err
		}
		risks = append(risks, risk)
	}
	return risks, nil
}

func (s *SQLiteStore) CreateBudget(budget *model.BudgetAllocation) error {
	query := `
	INSERT INTO budgets (
		session_id, caller, callee, total_budget, used_budget, remaining,
		percentage, is_critical
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		budget.SessionID,
		budget.Caller,
		budget.Callee,
		budget.TotalBudget.Nanoseconds(),
		budget.UsedBudget.Nanoseconds(),
		budget.Remaining.Nanoseconds(),
		budget.Percentage,
		budget.IsCritical,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	budget.ID = id
	return nil
}

func (s *SQLiteStore) GetBudgets(sessionID string) ([]model.BudgetAllocation, error) {
	query := `
	SELECT id, session_id, caller, callee, total_budget, used_budget, remaining,
	       percentage, is_critical
	FROM budgets WHERE session_id = ?
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var budgets []model.BudgetAllocation
	for rows.Next() {
		budget := model.BudgetAllocation{}
		var totalNanos, usedNanos, remainingNanos int64
		err := rows.Scan(
			&budget.ID,
			&budget.SessionID,
			&budget.Caller,
			&budget.Callee,
			&totalNanos,
			&usedNanos,
			&remainingNanos,
			&budget.Percentage,
			&budget.IsCritical,
		)
		if err != nil {
			return nil, err
		}
		budget.TotalBudget = time.Duration(totalNanos)
		budget.UsedBudget = time.Duration(usedNanos)
		budget.Remaining = time.Duration(remainingNanos)
		budgets = append(budgets, budget)
	}
	return budgets, nil
}

func (s *SQLiteStore) SaveAnalysisResult(result *model.AnalysisResult) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.CreateSession(&result.Session); err != nil {
		return err
	}

	for i := range result.Calls {
		result.Calls[i].SessionID = result.Session.SessionID
		if err := s.CreateCall(&result.Calls[i]); err != nil {
			return err
		}
	}

	for i := range result.Risks {
		result.Risks[i].SessionID = result.Session.SessionID
		if err := s.CreateRisk(&result.Risks[i]); err != nil {
			return err
		}
	}

	for i := range result.Budgets {
		result.Budgets[i].SessionID = result.Session.SessionID
		if err := s.CreateBudget(&result.Budgets[i]); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *SQLiteStore) GetAnalysisResult(sessionID string) (*model.AnalysisResult, error) {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	calls, err := s.GetCalls(sessionID)
	if err != nil {
		return nil, err
	}

	risks, err := s.GetRisks(sessionID)
	if err != nil {
		return nil, err
	}

	budgets, err := s.GetBudgets(sessionID)
	if err != nil {
		return nil, err
	}

	result := &model.AnalysisResult{
		Session: *session,
		Calls:   calls,
		Risks:   risks,
		Budgets: budgets,
	}
	return result, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
