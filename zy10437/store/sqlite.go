package store

import (
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"config-drift-exemption/models"

	_ "github.com/mattn/go-sqlite3"
)

type DriftStore struct {
	db *sql.DB
}

func NewDriftStore(dbPath string) (*DriftStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	store := &DriftStore{db: db}
	if err := store.initTables(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *DriftStore) initTables() error {
	driftTable := `
	CREATE TABLE IF NOT EXISTS config_drifts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		service_name TEXT NOT NULL,
		config_key TEXT NOT NULL,
		expected_value TEXT NOT NULL,
		actual_value TEXT NOT NULL,
		drift_hash TEXT NOT NULL UNIQUE,
		reason TEXT NOT NULL,
		reporter TEXT NOT NULL,
		status TEXT NOT NULL,
		reviewer TEXT,
		review_comment TEXT,
		exemption_expiry DATETIME NOT NULL,
		report_data TEXT,
		raw_input TEXT,
		processing_note TEXT,
		compensation_log TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		reviewed_at DATETIME
	);`

	historyTable := `
	CREATE TABLE IF NOT EXISTS drift_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		drift_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		old_status TEXT,
		new_status TEXT,
		operator TEXT NOT NULL,
		change_comment TEXT,
		changed_at DATETIME NOT NULL,
		FOREIGN KEY (drift_id) REFERENCES config_drifts(id)
	);`

	index1 := `CREATE INDEX IF NOT EXISTS idx_service_config ON config_drifts(service_name, config_key);`
	index2 := `CREATE INDEX IF NOT EXISTS idx_status ON config_drifts(status);`
	index3 := `CREATE INDEX IF NOT EXISTS idx_expiry ON config_drifts(exemption_expiry);`

	for _, stmt := range []string{driftTable, historyTable, index1, index2, index3} {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *DriftStore) Close() error {
	return s.db.Close()
}

func GenerateDriftHash(serviceName, configKey, expectedValue, actualValue string) string {
	data := fmt.Sprintf("%s|%s|%s|%s", serviceName, configKey, expectedValue, actualValue)
	return fmt.Sprintf("%x", md5.Sum([]byte(data)))
}

func (s *DriftStore) CreateDrift(req *models.CreateDriftRequest) (*models.ConfigDriftRecord, models.ApiResultCode, error) {
	driftHash := GenerateDriftHash(req.ServiceName, req.ConfigKey, req.ExpectedValue, req.ActualValue)

	var existingID int64
	err := s.db.QueryRow("SELECT id FROM config_drifts WHERE drift_hash = ?", driftHash).Scan(&existingID)
	if err == nil {
		existing, err := s.GetDriftByID(existingID)
		if err != nil {
			return nil, models.ResultBlocked, fmt.Errorf("failed to get existing drift: %w", err)
		}
		existing.ProcessingNote = fmt.Sprintf("重复导入，原记录ID: %d", existingID)
		return existing, models.ResultSuccess, nil
	}

	if err != sql.ErrNoRows {
		return nil, models.ResultBlocked, fmt.Errorf("hash check failed: %w", err)
	}

	now := time.Now()
	status := models.StatusPendingReview

	tx, err := s.db.Begin()
	if err != nil {
		return nil, models.ResultBlocked, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(`
		INSERT INTO config_drifts (
			service_name, config_key, expected_value, actual_value, drift_hash,
			reason, reporter, status, exemption_expiry, report_data, raw_input,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		req.ServiceName, req.ConfigKey, req.ExpectedValue, req.ActualValue, driftHash,
		req.Reason, req.Reporter, status, req.ExemptionExpiry, req.ReportData, req.RawInput,
		now, now,
	)
	if err != nil {
		return nil, models.ResultBlocked, fmt.Errorf("insert failed: %w", err)
	}

	id, _ := result.LastInsertId()

	_, err = tx.Exec(`
		INSERT INTO drift_history (drift_id, action, new_status, operator, change_comment, changed_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		id, "CREATE", string(status), req.Reporter, "创建配置漂移豁免申请", now,
	)
	if err != nil {
		return nil, models.ResultBlocked, fmt.Errorf("history insert failed: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, models.ResultBlocked, err
	}

	record := &models.ConfigDriftRecord{
		ID:              id,
		ServiceName:     req.ServiceName,
		ConfigKey:       req.ConfigKey,
		ExpectedValue:   req.ExpectedValue,
		ActualValue:     req.ActualValue,
		DriftHash:       driftHash,
		Reason:          req.Reason,
		Reporter:        req.Reporter,
		Status:          status,
		ExemptionExpiry: req.ExemptionExpiry,
		ReportData:      req.ReportData,
		RawInput:        req.RawInput,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	return record, models.ResultPendingReview, nil
}

func (s *DriftStore) GetDriftByID(id int64) (*models.ConfigDriftRecord, error) {
	row := s.db.QueryRow(`
		SELECT id, service_name, config_key, expected_value, actual_value, drift_hash,
		       reason, reporter, status, reviewer, review_comment, exemption_expiry,
		       report_data, raw_input, processing_note, compensation_log,
		       created_at, updated_at, reviewed_at
		FROM config_drifts WHERE id = ?`, id)

	var r models.ConfigDriftRecord
	var reviewer, reviewComment, reportData, rawInput, processingNote, compensationLog sql.NullString
	var reviewedAt sql.NullTime

	err := row.Scan(
		&r.ID, &r.ServiceName, &r.ConfigKey, &r.ExpectedValue, &r.ActualValue, &r.DriftHash,
		&r.Reason, &r.Reporter, &r.Status, &reviewer, &reviewComment, &r.ExemptionExpiry,
		&reportData, &rawInput, &processingNote, &compensationLog,
		&r.CreatedAt, &r.UpdatedAt, &reviewedAt,
	)
	if err != nil {
		return nil, err
	}

	r.Reviewer = reviewer.String
	r.ReviewComment = reviewComment.String
	r.ReportData = reportData.String
	r.RawInput = rawInput.String
	r.ProcessingNote = processingNote.String
	r.CompensationLog = compensationLog.String
	if reviewedAt.Valid {
		r.ReviewedAt = &reviewedAt.Time
	}

	return &r, nil
}

func (s *DriftStore) QueryDrifts(filter *models.QueryFilter) ([]*models.ConfigDriftRecord, int, error) {
	baseQuery := `
		SELECT id, service_name, config_key, expected_value, actual_value, drift_hash,
		       reason, reporter, status, reviewer, review_comment, exemption_expiry,
		       report_data, raw_input, processing_note, compensation_log,
		       created_at, updated_at, reviewed_at
		FROM config_drifts WHERE 1=1`

	countQuery := `SELECT COUNT(*) FROM config_drifts WHERE 1=1`

	var args []interface{}
	var whereClause string

	if filter.ServiceName != "" {
		whereClause += " AND service_name = ?"
		args = append(args, filter.ServiceName)
	}
	if filter.ConfigKey != "" {
		whereClause += " AND config_key = ?"
		args = append(args, filter.ConfigKey)
	}
	if filter.Status != "" {
		whereClause += " AND status = ?"
		args = append(args, filter.Status)
	}
	if filter.Reporter != "" {
		whereClause += " AND reporter = ?"
		args = append(args, filter.Reporter)
	}
	if filter.Reviewer != "" {
		whereClause += " AND reviewer = ?"
		args = append(args, filter.Reviewer)
	}
	if filter.IsExpired != nil {
		if *filter.IsExpired {
			whereClause += " AND exemption_expiry < ?"
		} else {
			whereClause += " AND exemption_expiry >= ?"
		}
		args = append(args, time.Now())
	}

	var total int
	err := s.db.QueryRow(countQuery+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	rows, err := s.db.Query(
		baseQuery+whereClause+" ORDER BY created_at DESC LIMIT ? OFFSET ?",
		append(args, pageSize, offset)...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []*models.ConfigDriftRecord
	for rows.Next() {
		var r models.ConfigDriftRecord
		var reviewer, reviewComment, reportData, rawInput, processingNote, compensationLog sql.NullString
		var reviewedAt sql.NullTime

		err := rows.Scan(
			&r.ID, &r.ServiceName, &r.ConfigKey, &r.ExpectedValue, &r.ActualValue, &r.DriftHash,
			&r.Reason, &r.Reporter, &r.Status, &reviewer, &reviewComment, &r.ExemptionExpiry,
			&reportData, &rawInput, &processingNote, &compensationLog,
			&r.CreatedAt, &r.UpdatedAt, &reviewedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		r.Reviewer = reviewer.String
		r.ReviewComment = reviewComment.String
		r.ReportData = reportData.String
		r.RawInput = rawInput.String
		r.ProcessingNote = processingNote.String
		r.CompensationLog = compensationLog.String
		if reviewedAt.Valid {
			r.ReviewedAt = &reviewedAt.Time
		}

		records = append(records, &r)
	}

	return records, total, nil
}

func (s *DriftStore) ReviewDrift(id int64, req *models.ReviewRequest) (*models.ConfigDriftRecord, models.ApiResultCode, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, models.ResultBlocked, err
	}
	defer tx.Rollback()

	var oldStatus models.DriftStatus
	err = tx.QueryRow("SELECT status FROM config_drifts WHERE id = ?", id).Scan(&oldStatus)
	if err != nil {
		return nil, models.ResultBlocked, fmt.Errorf("drift not found: %w", err)
	}

	if oldStatus != models.StatusPendingReview {
		return nil, models.ResultBlocked, fmt.Errorf("only pending records can be reviewed, current status: %s", oldStatus)
	}

	if req.Status != models.StatusApproved && req.Status != models.StatusRejected {
		return nil, models.ResultBlocked, fmt.Errorf("invalid review status: %s", req.Status)
	}

	now := time.Now()
	_, err = tx.Exec(`
		UPDATE config_drifts
		SET status = ?, reviewer = ?, review_comment = ?, reviewed_at = ?, updated_at = ?
		WHERE id = ?`,
		req.Status, req.Reviewer, req.ReviewComment, now, now, id,
	)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	_, err = tx.Exec(`
		INSERT INTO drift_history (drift_id, action, old_status, new_status, operator, change_comment, changed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, "REVIEW", string(oldStatus), string(req.Status), req.Reviewer, req.ReviewComment, now,
	)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	if err := tx.Commit(); err != nil {
		return nil, models.ResultBlocked, err
	}

	updated, err := s.GetDriftByID(id)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	return updated, models.ResultSuccess, nil
}

func (s *DriftStore) ManualFix(id int64, req *models.ManualFixRequest) (*models.ConfigDriftRecord, models.ApiResultCode, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, models.ResultBlocked, err
	}
	defer tx.Rollback()

	var oldRecord models.ConfigDriftRecord
	err = tx.QueryRow(`
		SELECT status, expected_value, actual_value
		FROM config_drifts WHERE id = ?`, id).Scan(&oldRecord.Status, &oldRecord.ExpectedValue, &oldRecord.ActualValue)
	if err != nil {
		return nil, models.ResultBlocked, fmt.Errorf("drift not found: %w", err)
	}

	now := time.Now()
	newExpected := req.NewExpectedValue
	if newExpected == "" {
		newExpected = oldRecord.ExpectedValue
	}
	newActual := req.NewActualValue
	if newActual == "" {
		newActual = oldRecord.ActualValue
	}

	newStatus := models.StatusCompensated
	compensationLog := fmt.Sprintf("人工修正: %s, 原值[%s->%s], 新值[%s->%s]",
		req.FixReason, oldRecord.ExpectedValue, oldRecord.ActualValue, newExpected, newActual)

	_, err = tx.Exec(`
		UPDATE config_drifts
		SET status = ?, expected_value = ?, actual_value = ?, compensation_log = ?, updated_at = ?
		WHERE id = ?`,
		newStatus, newExpected, newActual, compensationLog, now, id,
	)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	_, err = tx.Exec(`
		INSERT INTO drift_history (drift_id, action, old_status, new_status, operator, change_comment, changed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, "MANUAL_FIX", string(oldRecord.Status), string(newStatus), req.Operator, req.FixReason, now,
	)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	if err := tx.Commit(); err != nil {
		return nil, models.ResultBlocked, err
	}

	updated, err := s.GetDriftByID(id)
	if err != nil {
		return nil, models.ResultBlocked, err
	}

	return updated, models.ResultCompensated, nil
}

func (s *DriftStore) ExportDrifts(filter *models.QueryFilter) ([]byte, error) {
	filter.Page = 1
	filter.PageSize = 10000

	records, _, err := s.QueryDrifts(filter)
	if err != nil {
		return nil, err
	}

	var exportRecords []models.ExportRecord
	for _, r := range records {
		diffType := "VALUE_DIFF"
		if r.ExpectedValue == r.ActualValue {
			diffType = "NO_DIFF"
		}
		exportRecords = append(exportRecords, models.ExportRecord{
			ID:              r.ID,
			ServiceName:     r.ServiceName,
			ConfigKey:       r.ConfigKey,
			ExpectedValue:   r.ExpectedValue,
			ActualValue:     r.ActualValue,
			DiffType:        diffType,
			Reason:          r.Reason,
			Reporter:        r.Reporter,
			Status:          string(r.Status),
			Reviewer:        r.Reviewer,
			ExemptionExpiry: r.ExemptionExpiry,
			CreatedAt:       r.CreatedAt,
		})
	}

	return json.MarshalIndent(exportRecords, "", "  ")
}

func (s *DriftStore) GetDriftHistory(driftID int64) ([]*models.DriftHistory, error) {
	rows, err := s.db.Query(`
		SELECT id, drift_id, action, old_status, new_status, operator, change_comment, changed_at
		FROM drift_history WHERE drift_id = ? ORDER BY changed_at DESC`, driftID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*models.DriftHistory
	for rows.Next() {
		var h models.DriftHistory
		var oldStatus sql.NullString
		err := rows.Scan(&h.ID, &h.DriftID, &h.Action, &oldStatus, &h.NewStatus, &h.Operator, &h.ChangeComment, &h.ChangedAt)
		if err != nil {
			return nil, err
		}
		h.OldStatus = oldStatus.String
		history = append(history, &h)
	}
	return history, nil
}

func (s *DriftStore) CheckAndMarkExpired() ([]int64, error) {
	now := time.Now()
	rows, err := s.db.Query(`
		SELECT id FROM config_drifts
		WHERE status = ? AND exemption_expiry < ?`,
		models.StatusApproved, now,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expiredIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		expiredIDs = append(expiredIDs, id)
	}

	for _, id := range expiredIDs {
		_, err := s.db.Exec(`
			UPDATE config_drifts SET status = ?, updated_at = ? WHERE id = ?`,
			models.StatusExpired, now, id,
		)
		if err != nil {
			return nil, err
		}

		_, err = s.db.Exec(`
			INSERT INTO drift_history (drift_id, action, old_status, new_status, operator, change_comment, changed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, "EXPIRE", string(models.StatusApproved), string(models.StatusExpired), "SYSTEM", "豁免到期自动过期", now,
		)
		if err != nil {
			return nil, err
		}
	}

	return expiredIDs, nil
}
