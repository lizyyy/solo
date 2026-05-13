package storage

import (
	"database/sql"
	"fmt"
	"log"
	"read-write-split-api/internal/model"
	"read-write-split-api/pkg/utils"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	storage := &SQLiteStorage{db: db}
	if err := storage.initTables(); err != nil {
		return nil, err
	}

	return storage, nil
}

func (s *SQLiteStorage) initTables() error {
	createStrategyTable := `
	CREATE TABLE IF NOT EXISTS strategies (
		id TEXT PRIMARY KEY,
		path TEXT NOT NULL,
		method TEXT NOT NULL,
		query_params TEXT NOT NULL DEFAULT '{}',
		operation_type TEXT NOT NULL,
		db_role TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL DEFAULT 'enabled',
		priority INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		UNIQUE(path, method, query_params)
	);`

	createHitRecordTable := `
	CREATE TABLE IF NOT EXISTS hit_records (
		id TEXT PRIMARY KEY,
		request_id TEXT NOT NULL UNIQUE,
		strategy_id TEXT,
		path TEXT NOT NULL,
		method TEXT NOT NULL,
		query_params TEXT NOT NULL DEFAULT '{}',
		matched_operation TEXT NOT NULL,
		actual_operation TEXT NOT NULL,
		db_role_used TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		correction_action TEXT NOT NULL DEFAULT 'none',
		correction_note TEXT,
		corrected_by TEXT,
		corrected_at DATETIME,
		created_at DATETIME NOT NULL
	);`

	createIndex := `
	CREATE INDEX IF NOT EXISTS idx_hit_records_request_id ON hit_records(request_id);
	CREATE INDEX IF NOT EXISTS idx_hit_records_strategy_id ON hit_records(strategy_id);
	CREATE INDEX IF NOT EXISTS idx_hit_records_status ON hit_records(status);
	CREATE INDEX IF NOT EXISTS idx_strategies_path ON strategies(path);
	`

	if _, err := s.db.Exec(createStrategyTable); err != nil {
		return err
	}

	if _, err := s.db.Exec(createHitRecordTable); err != nil {
		return err
	}

	if _, err := s.db.Exec(createIndex); err != nil {
		log.Printf("Warning: failed to create indexes: %v", err)
	}

	return nil
}

func (s *SQLiteStorage) CreateStrategy(strategy *model.Strategy) error {
	query := `
	INSERT INTO strategies (id, path, method, query_params, operation_type, db_role, description, status, priority, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		strategy.ID,
		strategy.Path,
		strategy.Method,
		utils.MapToJSON(strategy.QueryParams),
		strategy.OperationType,
		strategy.DBRole,
		strategy.Description,
		strategy.Status,
		strategy.Priority,
		strategy.CreatedAt,
		strategy.UpdatedAt,
	)
	return err
}

func (s *SQLiteStorage) GetStrategyByID(id string) (*model.Strategy, error) {
	query := `
	SELECT id, path, method, query_params, operation_type, db_role, description, status, priority, created_at, updated_at
	FROM strategies
	WHERE id = ?
	`

	var strategy model.Strategy
	var queryParams string
	err := s.db.QueryRow(query, id).Scan(
		&strategy.ID,
		&strategy.Path,
		&strategy.Method,
		&queryParams,
		&strategy.OperationType,
		&strategy.DBRole,
		&strategy.Description,
		&strategy.Status,
		&strategy.Priority,
		&strategy.CreatedAt,
		&strategy.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	strategy.QueryParams = utils.JSONToMap(queryParams)
	return &strategy, nil
}

func (s *SQLiteStorage) GetStrategyByUniqueKey(path, method, queryParams string) (*model.Strategy, error) {
	query := `
	SELECT id, path, method, query_params, operation_type, db_role, description, status, priority, created_at, updated_at
	FROM strategies
	WHERE path = ? AND method = ? AND query_params = ?
	`

	var strategy model.Strategy
	var qp string
	err := s.db.QueryRow(query, path, method, queryParams).Scan(
		&strategy.ID,
		&strategy.Path,
		&strategy.Method,
		&qp,
		&strategy.OperationType,
		&strategy.DBRole,
		&strategy.Description,
		&strategy.Status,
		&strategy.Priority,
		&strategy.CreatedAt,
		&strategy.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	strategy.QueryParams = utils.JSONToMap(qp)
	return &strategy, nil
}

func (s *SQLiteStorage) ListStrategies() ([]*model.Strategy, error) {
	query := `
	SELECT id, path, method, query_params, operation_type, db_role, description, status, priority, created_at, updated_at
	FROM strategies
	ORDER BY priority DESC, created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var strategies []*model.Strategy
	for rows.Next() {
		var strategy model.Strategy
		var queryParams string
		err := rows.Scan(
			&strategy.ID,
			&strategy.Path,
			&strategy.Method,
			&queryParams,
			&strategy.OperationType,
			&strategy.DBRole,
			&strategy.Description,
			&strategy.Status,
			&strategy.Priority,
			&strategy.CreatedAt,
			&strategy.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		strategy.QueryParams = utils.JSONToMap(queryParams)
		strategies = append(strategies, &strategy)
	}

	return strategies, nil
}

func (s *SQLiteStorage) UpdateStrategyStatus(id string, status model.StrategyStatus) error {
	query := `
	UPDATE strategies
	SET status = ?, updated_at = ?
	WHERE id = ?
	`

	result, err := s.db.Exec(query, status, utils.Now(), id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("strategy not found")
	}

	return nil
}

func (s *SQLiteStorage) CreateHitRecord(record *model.HitRecord) error {
	query := `
	INSERT INTO hit_records (id, request_id, strategy_id, path, method, query_params, matched_operation, actual_operation, db_role_used, status, correction_action, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		record.ID,
		record.RequestID,
		record.StrategyID,
		record.Path,
		record.Method,
		utils.MapToJSON(record.QueryParams),
		record.MatchedOperation,
		record.ActualOperation,
		record.DBRoleUsed,
		record.Status,
		record.CorrectionAction,
		record.CreatedAt,
	)
	return err
}

func (s *SQLiteStorage) GetHitRecordByRequestID(requestID string) (*model.HitRecord, error) {
	query := `
	SELECT id, request_id, strategy_id, path, method, query_params, matched_operation, actual_operation, db_role_used, status, correction_action, correction_note, corrected_by, corrected_at, created_at
	FROM hit_records
	WHERE request_id = ?
	`

	var record model.HitRecord
	var queryParams string
	var correctedAt sql.NullTime
	err := s.db.QueryRow(query, requestID).Scan(
		&record.ID,
		&record.RequestID,
		&record.StrategyID,
		&record.Path,
		&record.Method,
		&queryParams,
		&record.MatchedOperation,
		&record.ActualOperation,
		&record.DBRoleUsed,
		&record.Status,
		&record.CorrectionAction,
		&record.CorrectionNote,
		&record.CorrectedBy,
		&correctedAt,
		&record.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	record.QueryParams = utils.JSONToMap(queryParams)
	if correctedAt.Valid {
		record.CorrectedAt = &correctedAt.Time
	}

	return &record, nil
}

func (s *SQLiteStorage) GetHitRecordByID(id string) (*model.HitRecord, error) {
	query := `
	SELECT id, request_id, strategy_id, path, method, query_params, matched_operation, actual_operation, db_role_used, status, correction_action, correction_note, corrected_by, corrected_at, created_at
	FROM hit_records
	WHERE id = ?
	`

	var record model.HitRecord
	var queryParams string
	var correctedAt sql.NullTime
	err := s.db.QueryRow(query, id).Scan(
		&record.ID,
		&record.RequestID,
		&record.StrategyID,
		&record.Path,
		&record.Method,
		&queryParams,
		&record.MatchedOperation,
		&record.ActualOperation,
		&record.DBRoleUsed,
		&record.Status,
		&record.CorrectionAction,
		&record.CorrectionNote,
		&record.CorrectedBy,
		&correctedAt,
		&record.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	record.QueryParams = utils.JSONToMap(queryParams)
	if correctedAt.Valid {
		record.CorrectedAt = &correctedAt.Time
	}

	return &record, nil
}

func (s *SQLiteStorage) QueryHitRecords(req *model.QueryHitRecordsRequest) ([]*model.HitRecord, int64, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if req.StrategyID != "" {
		whereClauses = append(whereClauses, "strategy_id = ?")
		args = append(args, req.StrategyID)
	}

	if req.Status != "" {
		whereClauses = append(whereClauses, "status = ?")
		args = append(args, req.Status)
	}

	if req.Path != "" {
		whereClauses = append(whereClauses, "path LIKE ?")
		args = append(args, "%"+req.Path+"%")
	}

	if req.StartTime != nil {
		whereClauses = append(whereClauses, "created_at >= ?")
		args = append(args, *req.StartTime)
	}

	if req.EndTime != nil {
		whereClauses = append(whereClauses, "created_at <= ?")
		args = append(args, *req.EndTime)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM hit_records WHERE %s", whereSQL)
	var total int64
	err := s.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	dataQuery := fmt.Sprintf(`
	SELECT id, request_id, strategy_id, path, method, query_params, matched_operation, actual_operation, db_role_used, status, correction_action, correction_note, corrected_by, corrected_at, created_at
	FROM hit_records
	WHERE %s
	ORDER BY created_at DESC
	LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, pageSize, offset)
	rows, err := s.db.Query(dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []*model.HitRecord
	for rows.Next() {
		var record model.HitRecord
		var queryParams string
		var correctedAt sql.NullTime
		err := rows.Scan(
			&record.ID,
			&record.RequestID,
			&record.StrategyID,
			&record.Path,
			&record.Method,
			&queryParams,
			&record.MatchedOperation,
			&record.ActualOperation,
			&record.DBRoleUsed,
			&record.Status,
			&record.CorrectionAction,
			&record.CorrectionNote,
			&record.CorrectedBy,
			&correctedAt,
			&record.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		record.QueryParams = utils.JSONToMap(queryParams)
		if correctedAt.Valid {
			record.CorrectedAt = &correctedAt.Time
		}
		records = append(records, &record)
	}

	return records, total, nil
}

func (s *SQLiteStorage) UpdateHitRecordStatus(id string, status model.HitStatus, userID, note string) error {
	query := `
	UPDATE hit_records
	SET status = ?, corrected_by = ?, correction_note = ?, corrected_at = ?
	WHERE id = ?
	`

	result, err := s.db.Exec(query, status, userID, note, utils.Now(), id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("hit record not found")
	}

	return nil
}

func (s *SQLiteStorage) UpdateHitRecordCorrection(id string, action model.CorrectionAction, note, userID string) error {
	query := `
	UPDATE hit_records
	SET correction_action = ?, correction_note = ?, corrected_by = ?, corrected_at = ?, status = ?
	WHERE id = ?
	`

	newStatus := model.HitStatusIncorrect
	if action == model.CorrectionActionNone {
		newStatus = model.HitStatusCorrect
	}

	result, err := s.db.Exec(query, action, note, userID, utils.Now(), newStatus, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("hit record not found")
	}

	return nil
}

func (s *SQLiteStorage) RevokeHitRecord(id string, userID string) error {
	query := `
	UPDATE hit_records
	SET status = ?, corrected_by = ?, corrected_at = ?
	WHERE id = ?
	`

	result, err := s.db.Exec(query, model.HitStatusRevoked, userID, utils.Now(), id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("hit record not found")
	}

	return nil
}

func (s *SQLiteStorage) GetStatistics(startTime, endTime time.Time) (*model.SplitReport, error) {
	report := &model.SplitReport{}
	report.TimeRange.Start = startTime
	report.TimeRange.End = endTime

	baseQuery := `
	SELECT 
		COUNT(*) as total,
		SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct,
		SUM(CASE WHEN status = 'incorrect' THEN 1 ELSE 0 END) as incorrect,
		SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
		SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
	FROM hit_records
	WHERE created_at >= ? AND created_at <= ?
	`

	err := s.db.QueryRow(baseQuery, startTime, endTime).Scan(
		&report.TotalHits,
		&report.CorrectHits,
		&report.IncorrectHits,
		&report.PendingHits,
		&report.RevokedHits,
	)
	if err != nil {
		return nil, err
	}

	if report.TotalHits > 0 {
		report.AccuracyRate = float64(report.CorrectHits) / float64(report.TotalHits) * 100
	}

	strategyQuery := `
	SELECT strategy_id, COUNT(*) as count
	FROM hit_records
	WHERE created_at >= ? AND created_at <= ? AND strategy_id IS NOT NULL
	GROUP BY strategy_id
	`

	rows, err := s.db.Query(strategyQuery, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	report.StrategyBreakdown = make(map[string]int)
	for rows.Next() {
		var strategyID string
		var count int
		if err := rows.Scan(&strategyID, &count); err == nil {
			report.StrategyBreakdown[strategyID] = count
		}
	}

	operationQuery := `
	SELECT matched_operation, COUNT(*) as count
	FROM hit_records
	WHERE created_at >= ? AND created_at <= ?
	GROUP BY matched_operation
	`

	rows2, err := s.db.Query(operationQuery, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	report.OperationBreakdown = make(map[string]int)
	for rows2.Next() {
		var op string
		var count int
		if err := rows2.Scan(&op, &count); err == nil {
			report.OperationBreakdown[op] = count
		}
	}

	return report, nil
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}
