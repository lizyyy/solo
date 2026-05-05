package storage

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// SQLiteStore 实现了基于 SQLite 的存储
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore 创建一个新的 SQLite 存储
func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// 测试连接
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

// Close 关闭数据库连接
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// Init 初始化数据库 schema
func (s *SQLiteStore) Init() error {
	// 执行创建表的 SQL
	sqlStatements := []string{
		createAnalysisRunsTable,
		createSyncPrimitivesTable,
		createSyncEventsTable,
		createIssuesTable,
		createIndexes,
	}

	for _, stmt := range sqlStatements {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute SQL: %w", err)
		}
	}

	return nil
}

// BeginTransaction 开始事务
func (s *SQLiteStore) BeginTransaction() (*sql.Tx, error) {
	return s.db.Begin()
}

// CreateAnalysisRun 创建新的分析运行
func (s *SQLiteStore) CreateAnalysisRun(tx *sql.Tx, run *models.AnalysisRun) (int64, error) {
	query := `
	INSERT INTO analysis_runs (name, start_time, status, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?)
	`

	result, err := tx.Exec(query,
		run.Name,
		run.StartTime,
		run.Status,
		run.CreatedAt,
		run.UpdatedAt,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to create analysis run: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// UpdateAnalysisRun 更新分析运行
func (s *SQLiteStore) UpdateAnalysisRun(tx *sql.Tx, run *models.AnalysisRun) error {
	query := `
	UPDATE analysis_runs
	SET name = ?, end_time = ?, status = ?, updated_at = ?
	WHERE id = ?
	`

	_, err := tx.Exec(query,
		run.Name,
		run.EndTime,
		run.Status,
		time.Now(),
		run.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update analysis run: %w", err)
	}

	return nil
}

// GetAnalysisRun 获取分析运行
func (s *SQLiteStore) GetAnalysisRun(id int64) (*models.AnalysisRun, error) {
	query := `
	SELECT id, name, start_time, end_time, status, created_at, updated_at
	FROM analysis_runs
	WHERE id = ?
	`

	var run models.AnalysisRun
	err := s.db.QueryRow(query, id).Scan(
		&run.ID,
		&run.Name,
		&run.StartTime,
		&run.EndTime,
		&run.Status,
		&run.CreatedAt,
		&run.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("analysis run not found: %d", id)
		}
		return nil, fmt.Errorf("failed to get analysis run: %w", err)
	}

	return &run, nil
}

// ListAnalysisRuns 列出所有分析运行
func (s *SQLiteStore) ListAnalysisRuns() ([]*models.AnalysisRun, error) {
	query := `
	SELECT id, name, start_time, end_time, status, created_at, updated_at
	FROM analysis_runs
	ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list analysis runs: %w", err)
	}
	defer rows.Close()

	var runs []*models.AnalysisRun
	for rows.Next() {
		var run models.AnalysisRun
		err := rows.Scan(
			&run.ID,
			&run.Name,
			&run.StartTime,
			&run.EndTime,
			&run.Status,
			&run.CreatedAt,
			&run.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan analysis run: %w", err)
		}
		runs = append(runs, &run)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate analysis runs: %w", err)
	}

	return runs, nil
}

// SavePrimitive 保存 sync 原语
func (s *SQLiteStore) SavePrimitive(tx *sql.Tx, primitive *models.SyncPrimitive) (int64, error) {
	query := `
	INSERT INTO sync_primitives (run_id, type, name, location, file, line, declaration, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := tx.Exec(query,
		primitive.RunID,
		primitive.Type,
		primitive.Name,
		primitive.Location,
		primitive.File,
		primitive.Line,
		primitive.Declaration,
		primitive.CreatedAt,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save primitive: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// SaveEvent 保存事件
func (s *SQLiteStore) SaveEvent(tx *sql.Tx, event *models.SyncEvent) (int64, error) {
	query := `
	INSERT INTO sync_events (
		run_id, primitive_id, event_type, primitive_name, primitive_type,
		goroutine_id, timestamp, location, file, line, details, created_at
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := tx.Exec(query,
		event.RunID,
		event.PrimitiveID,
		event.EventType,
		event.PrimitiveName,
		event.PrimitiveType,
		event.GoroutineID,
		event.Timestamp,
		event.Location,
		event.File,
		event.Line,
		event.Details,
		event.CreatedAt,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// SaveIssue 保存问题
func (s *SQLiteStore) SaveIssue(tx *sql.Tx, issue *models.Issue) (int64, error) {
	query := `
	INSERT INTO issues (
		run_id, type, severity, title, description, location,
		file, line, code_snippet, suggestion, references, created_at
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := tx.Exec(query,
		issue.RunID,
		issue.Type,
		issue.Severity,
		issue.Title,
		issue.Description,
		issue.Location,
		issue.File,
		issue.Line,
		issue.CodeSnippet,
		issue.Suggestion,
		issue.References,
		issue.CreatedAt,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save issue: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetPrimitivesByRunID 获取指定运行的所有原语
func (s *SQLiteStore) GetPrimitivesByRunID(runID int64) ([]*models.SyncPrimitive, error) {
	query := `
	SELECT id, run_id, type, name, location, file, line, declaration, created_at
	FROM sync_primitives
	WHERE run_id = ?
	`

	rows, err := s.db.Query(query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get primitives: %w", err)
	}
	defer rows.Close()

	var primitives []*models.SyncPrimitive
	for rows.Next() {
		var p models.SyncPrimitive
		err := rows.Scan(
			&p.ID,
			&p.RunID,
			&p.Type,
			&p.Name,
			&p.Location,
			&p.File,
			&p.Line,
			&p.Declaration,
			&p.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan primitive: %w", err)
		}
		primitives = append(primitives, &p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate primitives: %w", err)
	}

	return primitives, nil
}

// GetEventsByRunID 获取指定运行的所有事件
func (s *SQLiteStore) GetEventsByRunID(runID int64) ([]*models.SyncEvent, error) {
	query := `
	SELECT id, run_id, primitive_id, event_type, primitive_name, primitive_type,
	       goroutine_id, timestamp, location, file, line, details, created_at
	FROM sync_events
	WHERE run_id = ?
	ORDER BY timestamp ASC
	`

	rows, err := s.db.Query(query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get events: %w", err)
	}
	defer rows.Close()

	var events []*models.SyncEvent
	for rows.Next() {
		var e models.SyncEvent
		err := rows.Scan(
			&e.ID,
			&e.RunID,
			&e.PrimitiveID,
			&e.EventType,
			&e.PrimitiveName,
			&e.PrimitiveType,
			&e.GoroutineID,
			&e.Timestamp,
			&e.Location,
			&e.File,
			&e.Line,
			&e.Details,
			&e.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}
		events = append(events, &e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate events: %w", err)
	}

	return events, nil
}

// GetIssuesByRunID 获取指定运行的所有问题
func (s *SQLiteStore) GetIssuesByRunID(runID int64) ([]*models.Issue, error) {
	query := `
	SELECT id, run_id, type, severity, title, description, location,
	       file, line, code_snippet, suggestion, references, created_at
	FROM issues
	WHERE run_id = ?
	ORDER BY 
		CASE severity
			WHEN 'critical' THEN 1
			WHEN 'high' THEN 2
			WHEN 'medium' THEN 3
			WHEN 'low' THEN 4
		END,
		created_at ASC
	`

	rows, err := s.db.Query(query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get issues: %w", err)
	}
	defer rows.Close()

	var issues []*models.Issue
	for rows.Next() {
		var i models.Issue
		err := rows.Scan(
			&i.ID,
			&i.RunID,
			&i.Type,
			&i.Severity,
			&i.Title,
			&i.Description,
			&i.Location,
			&i.File,
			&i.Line,
			&i.CodeSnippet,
			&i.Suggestion,
			&i.References,
			&i.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan issue: %w", err)
		}
		issues = append(issues, &i)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate issues: %w", err)
	}

	return issues, nil
}

// SaveAnalysisResult 保存完整的分析结果
func (s *SQLiteStore) SaveAnalysisResult(result *models.AnalysisResult) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// 更新分析运行状态为完成
	run := &models.AnalysisRun{
		ID:     result.RunID,
		Status: "completed",
		EndTime: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
	}
	if err := s.UpdateAnalysisRun(tx, run); err != nil {
		return err
	}

	// 保存原语
	for _, primitive := range result.Primitives {
		primitive.RunID = result.RunID
		id, err := s.SavePrimitive(tx, &primitive)
		if err != nil {
			return err
		}
		primitive.ID = id
	}

	// 保存事件
	for _, event := range result.Events {
		event.RunID = result.RunID
		id, err := s.SaveEvent(tx, &event)
		if err != nil {
			return err
		}
		event.ID = id
	}

	// 保存问题
	for _, issue := range result.Issues {
		issue.RunID = result.RunID
		id, err := s.SaveIssue(tx, &issue)
		if err != nil {
			return err
		}
		issue.ID = id
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetAnalysisResult 获取完整的分析结果
func (s *SQLiteStore) GetAnalysisResult(runID int64) (*models.AnalysisResult, error) {
	run, err := s.GetAnalysisRun(runID)
	if err != nil {
		return nil, err
	}

	primitives, err := s.GetPrimitivesByRunID(runID)
	if err != nil {
		return nil, err
	}

	events, err := s.GetEventsByRunID(runID)
	if err != nil {
		return nil, err
	}

	issues, err := s.GetIssuesByRunID(runID)
	if err != nil {
		return nil, err
	}

	// 转换类型
	resultPrimitives := make([]models.SyncPrimitive, len(primitives))
	for i, p := range primitives {
		resultPrimitives[i] = *p
	}

	resultEvents := make([]models.SyncEvent, len(events))
	for i, e := range events {
		resultEvents[i] = *e
	}

	resultIssues := make([]models.Issue, len(issues))
	for i, issue := range issues {
		resultIssues[i] = *issue
	}

	result := &models.AnalysisResult{
		RunID:      run.ID,
		RunName:    run.Name,
		Primitives: resultPrimitives,
		Events:     resultEvents,
		Issues:     resultIssues,
	}

	// 生成摘要
	result.Summary = models.AnalysisSummary{
		TotalPrimitives:  len(resultPrimitives),
		TotalEvents:      len(resultEvents),
		TotalIssues:      len(resultIssues),
		IssuesByType:     make(map[models.IssueType]int),
		IssuesBySeverity: make(map[models.IssueSeverity]int),
	}

	for _, issue := range resultIssues {
		result.Summary.IssuesByType[issue.Type]++
		result.Summary.IssuesBySeverity[issue.Severity]++
	}

	return result, nil
}
