package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"traffic-mirror-controller/internal/model"

	_ "github.com/mattn/go-sqlite3"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(dbPath string) (*Database, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	database := &Database{db: db}
	if err := database.initTables(); err != nil {
		return nil, err
	}

	return database, nil
}

func (d *Database) initTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS target_environments (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			base_url TEXT NOT NULL,
			auth_type TEXT,
			auth_token TEXT,
			headers TEXT,
			timeout_sec INTEGER DEFAULT 30,
			enabled BOOLEAN DEFAULT 1,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS mirror_rules (
			id TEXT PRIMARY KEY,
			idempotency_key TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			source_path TEXT NOT NULL,
			source_method TEXT NOT NULL,
			sample_rate REAL DEFAULT 1.0,
			targets TEXT NOT NULL,
			status TEXT NOT NULL,
			compare_mode BOOLEAN DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			created_by TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS masking_fields (
			id TEXT PRIMARY KEY,
			rule_id TEXT NOT NULL,
			field_path TEXT NOT NULL,
			mask_type TEXT NOT NULL,
			mask_pattern TEXT,
			FOREIGN KEY (rule_id) REFERENCES mirror_rules(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS request_copies (
			id TEXT PRIMARY KEY,
			rule_id TEXT NOT NULL,
			trace_id TEXT NOT NULL,
			target_env_id TEXT NOT NULL,
			original_url TEXT NOT NULL,
			method TEXT NOT NULL,
			request_headers TEXT,
			request_body TEXT,
			masked_body TEXT,
			status_code INTEGER,
			response TEXT,
			error_msg TEXT,
			status TEXT NOT NULL,
			duration_ms INTEGER,
			created_at DATETIME NOT NULL,
			delivered_at DATETIME,
			FOREIGN KEY (rule_id) REFERENCES mirror_rules(id),
			FOREIGN KEY (target_env_id) REFERENCES target_environments(id)
		)`,
		`CREATE TABLE IF NOT EXISTS compare_results (
			id TEXT PRIMARY KEY,
			original_copy_id TEXT NOT NULL,
			mirrored_copy_id TEXT NOT NULL,
			rule_id TEXT NOT NULL,
			status_code_match BOOLEAN,
			body_match BOOLEAN,
			headers_match BOOLEAN,
			similarity_score REAL DEFAULT 0,
			diff_details TEXT,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (original_copy_id) REFERENCES request_copies(id),
			FOREIGN KEY (mirrored_copy_id) REFERENCES request_copies(id),
			FOREIGN KEY (rule_id) REFERENCES mirror_rules(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_mirror_rules_idempotency ON mirror_rules(idempotency_key)`,
		`CREATE INDEX IF NOT EXISTS idx_request_copies_rule_id ON request_copies(rule_id)`,
		`CREATE INDEX IF NOT EXISTS idx_request_copies_trace_id ON request_copies(trace_id)`,
		`CREATE INDEX IF NOT EXISTS idx_compare_results_rule_id ON compare_results(rule_id)`,
	}

	for _, schema := range schemas {
		if _, err := d.db.Exec(schema); err != nil {
			return err
		}
	}

	return nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) CreateTargetEnv(env *model.TargetEnvironment) error {
	env.ID = model.GenerateID()
	env.CreatedAt = time.Now()
	env.UpdatedAt = time.Now()

	query := `INSERT INTO target_environments (id, name, base_url, auth_type, auth_token, headers, timeout_sec, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.Exec(query, env.ID, env.Name, env.BaseURL, env.AuthType, env.AuthToken, env.Headers, env.TimeoutSec, env.Enabled, env.CreatedAt, env.UpdatedAt)
	return err
}

func (d *Database) GetTargetEnvByID(id string) (*model.TargetEnvironment, error) {
	query := `SELECT id, name, base_url, auth_type, auth_token, headers, timeout_sec, enabled, created_at, updated_at FROM target_environments WHERE id = ?`
	env := &model.TargetEnvironment{}
	err := d.db.QueryRow(query, id).Scan(&env.ID, &env.Name, &env.BaseURL, &env.AuthType, &env.AuthToken, &env.Headers, &env.TimeoutSec, &env.Enabled, &env.CreatedAt, &env.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return env, err
}

func (d *Database) ListTargetEnvs(page, pageSize int) ([]*model.TargetEnvironment, int, error) {
	countQuery := `SELECT COUNT(*) FROM target_environments`
	var total int
	if err := d.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	query := `SELECT id, name, base_url, auth_type, auth_token, headers, timeout_sec, enabled, created_at, updated_at FROM target_environments ORDER BY created_at DESC LIMIT ? OFFSET ?`
	rows, err := d.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var envs []*model.TargetEnvironment
	for rows.Next() {
		env := &model.TargetEnvironment{}
		err := rows.Scan(&env.ID, &env.Name, &env.BaseURL, &env.AuthType, &env.AuthToken, &env.Headers, &env.TimeoutSec, &env.Enabled, &env.CreatedAt, &env.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		envs = append(envs, env)
	}

	return envs, total, nil
}

func (d *Database) CreateMirrorRule(rule *model.MirrorRule) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	existing, err := d.GetMirrorRuleByIdempotencyKey(rule.IdempotencyKey)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("idempotency_key already exists")
	}

	rule.ID = model.GenerateID()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	if rule.Status == "" {
		rule.Status = model.RuleStatusDraft
	}

	targetsJSON, _ := json.Marshal(rule.Targets)
	rule.TargetsJSON = string(targetsJSON)

	query := `INSERT INTO mirror_rules (id, idempotency_key, name, description, source_path, source_method, sample_rate, targets, status, compare_mode, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, rule.ID, rule.IdempotencyKey, rule.Name, rule.Description, rule.SourcePath, rule.SourceMethod, rule.SampleRate, rule.TargetsJSON, rule.Status, rule.CompareMode, rule.CreatedAt, rule.UpdatedAt, rule.CreatedBy)
	if err != nil {
		return err
	}

	for i := range rule.MaskingFields {
		mf := &rule.MaskingFields[i]
		mf.ID = model.GenerateID()
		mf.RuleID = rule.ID
		mfQuery := `INSERT INTO masking_fields (id, rule_id, field_path, mask_type, mask_pattern) VALUES (?, ?, ?, ?, ?)`
		_, err = tx.Exec(mfQuery, mf.ID, mf.RuleID, mf.FieldPath, mf.MaskType, mf.MaskPattern)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *Database) GetMirrorRuleByIdempotencyKey(key string) (*model.MirrorRule, error) {
	query := `SELECT id, idempotency_key, name, description, source_path, source_method, sample_rate, targets, status, compare_mode, created_at, updated_at, created_by FROM mirror_rules WHERE idempotency_key = ?`
	rule := &model.MirrorRule{}
	var targetsJSON string
	err := d.db.QueryRow(query, key).Scan(&rule.ID, &rule.IdempotencyKey, &rule.Name, &rule.Description, &rule.SourcePath, &rule.SourceMethod, &rule.SampleRate, &targetsJSON, &rule.Status, &rule.CompareMode, &rule.CreatedAt, &rule.UpdatedAt, &rule.CreatedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(targetsJSON), &rule.Targets)
	rule.MaskingFields, _ = d.GetMaskingFieldsByRuleID(rule.ID)
	return rule, nil
}

func (d *Database) GetMirrorRuleByID(id string) (*model.MirrorRule, error) {
	query := `SELECT id, idempotency_key, name, description, source_path, source_method, sample_rate, targets, status, compare_mode, created_at, updated_at, created_by FROM mirror_rules WHERE id = ?`
	rule := &model.MirrorRule{}
	var targetsJSON string
	err := d.db.QueryRow(query, id).Scan(&rule.ID, &rule.IdempotencyKey, &rule.Name, &rule.Description, &rule.SourcePath, &rule.SourceMethod, &rule.SampleRate, &targetsJSON, &rule.Status, &rule.CompareMode, &rule.CreatedAt, &rule.UpdatedAt, &rule.CreatedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(targetsJSON), &rule.Targets)
	rule.MaskingFields, _ = d.GetMaskingFieldsByRuleID(rule.ID)
	return rule, nil
}

func (d *Database) GetMaskingFieldsByRuleID(ruleID string) ([]model.MaskingField, error) {
	query := `SELECT id, rule_id, field_path, mask_type, mask_pattern FROM masking_fields WHERE rule_id = ?`
	rows, err := d.db.Query(query, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []model.MaskingField
	for rows.Next() {
		var mf model.MaskingField
		err := rows.Scan(&mf.ID, &mf.RuleID, &mf.FieldPath, &mf.MaskType, &mf.MaskPattern)
		if err != nil {
			return nil, err
		}
		fields = append(fields, mf)
	}
	return fields, nil
}

func (d *Database) ListMirrorRules(status string, page, pageSize int) ([]*model.MirrorRule, int, error) {
	var args []interface{}
	countQuery := `SELECT COUNT(*) FROM mirror_rules WHERE 1=1`
	listQuery := `SELECT id, idempotency_key, name, description, source_path, source_method, sample_rate, targets, status, compare_mode, created_at, updated_at, created_by FROM mirror_rules WHERE 1=1`

	if status != "" {
		countQuery += ` AND status = ?`
		listQuery += ` AND status = ?`
		args = append(args, status)
	}

	var total int
	if err := d.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	listQuery += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, offset)

	rows, err := d.db.Query(listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var rules []*model.MirrorRule
	for rows.Next() {
		rule := &model.MirrorRule{}
		var targetsJSON string
		err := rows.Scan(&rule.ID, &rule.IdempotencyKey, &rule.Name, &rule.Description, &rule.SourcePath, &rule.SourceMethod, &rule.SampleRate, &targetsJSON, &rule.Status, &rule.CompareMode, &rule.CreatedAt, &rule.UpdatedAt, &rule.CreatedBy)
		if err != nil {
			return nil, 0, err
		}
		json.Unmarshal([]byte(targetsJSON), &rule.Targets)
		rules = append(rules, rule)
	}

	return rules, total, nil
}

func (d *Database) UpdateMirrorRuleStatus(id string, status model.MirrorRuleStatus) error {
	query := `UPDATE mirror_rules SET status = ?, updated_at = ? WHERE id = ?`
	_, err := d.db.Exec(query, status, time.Now(), id)
	return err
}

func (d *Database) CreateRequestCopy(rc *model.RequestCopy) error {
	rc.ID = model.GenerateID()
	rc.CreatedAt = time.Now()
	rc.Status = model.RequestStatusPending

	query := `INSERT INTO request_copies (id, rule_id, trace_id, target_env_id, original_url, method, request_headers, request_body, masked_body, status_code, response, error_msg, status, duration_ms, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.Exec(query, rc.ID, rc.RuleID, rc.TraceID, rc.TargetEnvID, rc.OriginalURL, rc.Method, rc.RequestHeaders, rc.RequestBody, rc.MaskedBody, rc.StatusCode, rc.Response, rc.ErrorMsg, rc.Status, rc.DurationMs, rc.CreatedAt, rc.DeliveredAt)
	return err
}

func (d *Database) UpdateRequestCopy(rc *model.RequestCopy) error {
	query := `UPDATE request_copies SET status_code = ?, response = ?, error_msg = ?, status = ?, duration_ms = ?, delivered_at = ? WHERE id = ?`
	_, err := d.db.Exec(query, rc.StatusCode, rc.Response, rc.ErrorMsg, rc.Status, rc.DurationMs, rc.DeliveredAt, rc.ID)
	return err
}

func (d *Database) ListRequestCopies(ruleID, traceID, status string, page, pageSize int) ([]*model.RequestCopy, int, error) {
	var args []interface{}
	countQuery := `SELECT COUNT(*) FROM request_copies WHERE 1=1`
	listQuery := `SELECT id, rule_id, trace_id, target_env_id, original_url, method, request_headers, request_body, masked_body, status_code, response, error_msg, status, duration_ms, created_at, delivered_at FROM request_copies WHERE 1=1`

	if ruleID != "" {
		countQuery += ` AND rule_id = ?`
		listQuery += ` AND rule_id = ?`
		args = append(args, ruleID)
	}
	if traceID != "" {
		countQuery += ` AND trace_id = ?`
		listQuery += ` AND trace_id = ?`
		args = append(args, traceID)
	}
	if status != "" {
		countQuery += ` AND status = ?`
		listQuery += ` AND status = ?`
		args = append(args, status)
	}

	var total int
	if err := d.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	listQuery += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, offset)

	rows, err := d.db.Query(listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var copies []*model.RequestCopy
	for rows.Next() {
		rc := &model.RequestCopy{}
		err := rows.Scan(&rc.ID, &rc.RuleID, &rc.TraceID, &rc.TargetEnvID, &rc.OriginalURL, &rc.Method, &rc.RequestHeaders, &rc.RequestBody, &rc.MaskedBody, &rc.StatusCode, &rc.Response, &rc.ErrorMsg, &rc.Status, &rc.DurationMs, &rc.CreatedAt, &rc.DeliveredAt)
		if err != nil {
			return nil, 0, err
		}
		copies = append(copies, rc)
	}

	return copies, total, nil
}

func (d *Database) GetPendingRequestCopies(limit int) ([]*model.RequestCopy, error) {
	query := `SELECT id, rule_id, trace_id, target_env_id, original_url, method, request_headers, request_body, masked_body, status_code, response, error_msg, status, duration_ms, created_at, delivered_at FROM request_copies WHERE status = ? ORDER BY created_at ASC LIMIT ?`
	rows, err := d.db.Query(query, model.RequestStatusPending, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var copies []*model.RequestCopy
	for rows.Next() {
		rc := &model.RequestCopy{}
		err := rows.Scan(&rc.ID, &rc.RuleID, &rc.TraceID, &rc.TargetEnvID, &rc.OriginalURL, &rc.Method, &rc.RequestHeaders, &rc.RequestBody, &rc.MaskedBody, &rc.StatusCode, &rc.Response, &rc.ErrorMsg, &rc.Status, &rc.DurationMs, &rc.CreatedAt, &rc.DeliveredAt)
		if err != nil {
			return nil, err
		}
		copies = append(copies, rc)
	}

	return copies, nil
}

func (d *Database) CreateCompareResult(cr *model.CompareResult) error {
	cr.ID = model.GenerateID()
	cr.CreatedAt = time.Now()

	query := `INSERT INTO compare_results (id, original_copy_id, mirrored_copy_id, rule_id, status_code_match, body_match, headers_match, similarity_score, diff_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.Exec(query, cr.ID, cr.OriginalCopyID, cr.MirroredCopyID, cr.RuleID, cr.StatusCodeMatch, cr.BodyMatch, cr.HeadersMatch, cr.SimilarityScore, cr.DiffDetails, cr.CreatedAt)
	return err
}

func (d *Database) ListCompareResults(ruleID string, page, pageSize int) ([]*model.CompareResult, int, error) {
	var args []interface{}
	countQuery := `SELECT COUNT(*) FROM compare_results WHERE 1=1`
	listQuery := `SELECT id, original_copy_id, mirrored_copy_id, rule_id, status_code_match, body_match, headers_match, similarity_score, diff_details, created_at FROM compare_results WHERE 1=1`

	if ruleID != "" {
		countQuery += ` AND rule_id = ?`
		listQuery += ` AND rule_id = ?`
		args = append(args, ruleID)
	}

	var total int
	if err := d.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	listQuery += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, offset)

	rows, err := d.db.Query(listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*model.CompareResult
	for rows.Next() {
		cr := &model.CompareResult{}
		err := rows.Scan(&cr.ID, &cr.OriginalCopyID, &cr.MirroredCopyID, &cr.RuleID, &cr.StatusCodeMatch, &cr.BodyMatch, &cr.HeadersMatch, &cr.SimilarityScore, &cr.DiffDetails, &cr.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, cr)
	}

	return results, total, nil
}

func (d *Database) GetRequestCopiesByTraceID(traceID string) ([]*model.RequestCopy, error) {
	query := `SELECT id, rule_id, trace_id, target_env_id, original_url, method, request_headers, request_body, masked_body, status_code, response, error_msg, status, duration_ms, created_at, delivered_at FROM request_copies WHERE trace_id = ? ORDER BY created_at ASC`
	rows, err := d.db.Query(query, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var copies []*model.RequestCopy
	for rows.Next() {
		rc := &model.RequestCopy{}
		err := rows.Scan(&rc.ID, &rc.RuleID, &rc.TraceID, &rc.TargetEnvID, &rc.OriginalURL, &rc.Method, &rc.RequestHeaders, &rc.RequestBody, &rc.MaskedBody, &rc.StatusCode, &rc.Response, &rc.ErrorMsg, &rc.Status, &rc.DurationMs, &rc.CreatedAt, &rc.DeliveredAt)
		if err != nil {
			return nil, err
		}
		copies = append(copies, rc)
	}

	return copies, nil
}

func (d *Database) GetAllMirrorRules(status string) ([]*model.MirrorRule, error) {
	var args []interface{}
	query := `SELECT id, idempotency_key, name, description, source_path, source_method, sample_rate, targets, status, compare_mode, created_at, updated_at, created_by FROM mirror_rules WHERE 1=1`

	if status != "" {
		query += ` AND status = ?`
		args = append(args, status)
	}

	query += ` ORDER BY created_at DESC`

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []*model.MirrorRule
	for rows.Next() {
		rule := &model.MirrorRule{}
		var targetsJSON string
		err := rows.Scan(&rule.ID, &rule.IdempotencyKey, &rule.Name, &rule.Description, &rule.SourcePath, &rule.SourceMethod, &rule.SampleRate, &targetsJSON, &rule.Status, &rule.CompareMode, &rule.CreatedAt, &rule.UpdatedAt, &rule.CreatedBy)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(targetsJSON), &rule.Targets)
		rule.MaskingFields, _ = d.GetMaskingFieldsByRuleID(rule.ID)
		rules = append(rules, rule)
	}

	return rules, nil
}

func (d *Database) GetAllRequestCopies(ruleID, traceID, status string) ([]*model.RequestCopy, error) {
	var args []interface{}
	query := `SELECT id, rule_id, trace_id, target_env_id, original_url, method, request_headers, request_body, masked_body, status_code, response, error_msg, status, duration_ms, created_at, delivered_at FROM request_copies WHERE 1=1`

	if ruleID != "" {
		query += ` AND rule_id = ?`
		args = append(args, ruleID)
	}
	if traceID != "" {
		query += ` AND trace_id = ?`
		args = append(args, traceID)
	}
	if status != "" {
		query += ` AND status = ?`
		args = append(args, status)
	}

	query += ` ORDER BY created_at DESC`

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var copies []*model.RequestCopy
	for rows.Next() {
		rc := &model.RequestCopy{}
		err := rows.Scan(&rc.ID, &rc.RuleID, &rc.TraceID, &rc.TargetEnvID, &rc.OriginalURL, &rc.Method, &rc.RequestHeaders, &rc.RequestBody, &rc.MaskedBody, &rc.StatusCode, &rc.Response, &rc.ErrorMsg, &rc.Status, &rc.DurationMs, &rc.CreatedAt, &rc.DeliveredAt)
		if err != nil {
			return nil, err
		}
		copies = append(copies, rc)
	}

	return copies, nil
}

func (d *Database) GetAllCompareResults(ruleID string) ([]*model.CompareResult, error) {
	var args []interface{}
	query := `SELECT id, original_copy_id, mirrored_copy_id, rule_id, status_code_match, body_match, headers_match, similarity_score, diff_details, created_at FROM compare_results WHERE 1=1`

	if ruleID != "" {
		query += ` AND rule_id = ?`
		args = append(args, ruleID)
	}

	query += ` ORDER BY created_at DESC`

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.CompareResult
	for rows.Next() {
		cr := &model.CompareResult{}
		err := rows.Scan(&cr.ID, &cr.OriginalCopyID, &cr.MirroredCopyID, &cr.RuleID, &cr.StatusCodeMatch, &cr.BodyMatch, &cr.HeadersMatch, &cr.SimilarityScore, &cr.DiffDetails, &cr.CreatedAt)
		if err != nil {
			return nil, err
		}
		results = append(results, cr)
	}

	return results, nil
}
