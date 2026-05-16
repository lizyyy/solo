package storage

import (
	"database/sql"
	"encoding/json"
	"sampling-budget-api/models"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func InitDB(dbPath string) (*DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS services (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			is_active BOOLEAN DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS sampling_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_name TEXT NOT NULL,
			rule_name TEXT NOT NULL,
			description TEXT,
			priority INTEGER DEFAULT 0,
			sample_rate REAL NOT NULL,
			tags TEXT,
			status TEXT DEFAULT 'ACTIVE',
			idempotency_key TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			effective_start DATETIME,
			effective_end DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS budgets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_name TEXT UNIQUE NOT NULL,
			total_budget INTEGER NOT NULL DEFAULT 0,
			used_budget INTEGER NOT NULL DEFAULT 0,
			remaining_budget INTEGER NOT NULL DEFAULT 0,
			compensated_budget INTEGER NOT NULL DEFAULT 0,
			budget_period TEXT DEFAULT 'MONTHLY',
			start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
			end_date DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS budget_transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_name TEXT NOT NULL,
			transaction_type TEXT NOT NULL,
			amount INTEGER NOT NULL,
			trace_id TEXT,
			tags TEXT,
			reason TEXT,
			idempotency_key TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS adjustment_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_name TEXT NOT NULL,
			adjustment_type TEXT NOT NULL,
			adjustment_value INTEGER NOT NULL,
			reason TEXT,
			applicant TEXT,
			approver TEXT,
			status TEXT DEFAULT 'PENDING',
			idempotency_key TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			approved_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS exception_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_name TEXT,
			operation TEXT NOT NULL,
			raw_input TEXT,
			error_type TEXT,
			error_message TEXT,
			processing_conclusion TEXT,
			resolution_status TEXT DEFAULT 'UNRESOLVED',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_service_name ON services(name)`,
		`CREATE INDEX IF NOT EXISTS idx_rule_service ON sampling_rules(service_name)`,
		`CREATE INDEX IF NOT EXISTS idx_budget_service ON budgets(service_name)`,
		`CREATE INDEX IF NOT EXISTS idx_transaction_service ON budget_transactions(service_name)`,
		`CREATE INDEX IF NOT EXISTS idx_transaction_idempotent ON budget_transactions(idempotency_key)`,
		`CREATE INDEX IF NOT EXISTS idx_adjustment_service ON adjustment_requests(service_name)`,
		`CREATE INDEX IF NOT EXISTS idx_exception_service ON exception_logs(service_name)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}

func (db *DB) CreateService(service *models.Service) error {
	query := `INSERT INTO services (name, description, is_active) VALUES (?, ?, ?)`
	result, err := db.Exec(query, service.Name, service.Description, service.IsActive)
	if err != nil {
		return err
	}
	service.ID, err = result.LastInsertId()
	return err
}

func (db *DB) GetService(name string) (*models.Service, error) {
	query := `SELECT id, name, description, created_at, updated_at, is_active FROM services WHERE name = ?`
	var service models.Service
	err := db.QueryRow(query, name).Scan(&service.ID, &service.Name, &service.Description, &service.CreatedAt, &service.UpdatedAt, &service.IsActive)
	if err != nil {
		return nil, err
	}
	return &service, nil
}

func (db *DB) ListServices() ([]models.Service, error) {
	query := `SELECT id, name, description, created_at, updated_at, is_active FROM services ORDER BY created_at DESC`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.CreatedAt, &s.UpdatedAt, &s.IsActive)
		if err != nil {
			return nil, err
		}
		services = append(services, s)
	}
	return services, nil
}

func (db *DB) UpdateService(service *models.Service) error {
	query := `UPDATE services SET description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`
	_, err := db.Exec(query, service.Description, service.IsActive, service.Name)
	return err
}

func (db *DB) CreateSamplingRule(rule *models.SamplingRule) error {
	tagsJSON, _ := json.Marshal(rule.Tags)
	query := `INSERT INTO sampling_rules (service_name, rule_name, description, priority, sample_rate, tags, status, idempotency_key, effective_start, effective_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, rule.ServiceName, rule.RuleName, rule.Description, rule.Priority, rule.SampleRate, string(tagsJSON), rule.Status, rule.IdempotencyKey, rule.EffectiveStart, rule.EffectiveEnd)
	if err != nil {
		return err
	}
	rule.ID, err = result.LastInsertId()
	return err
}

func (db *DB) GetSamplingRule(serviceName string, ruleID int64) (*models.SamplingRule, error) {
	query := `SELECT id, service_name, rule_name, description, priority, sample_rate, tags, status, idempotency_key, created_at, updated_at, effective_start, effective_end FROM sampling_rules WHERE service_name = ? AND id = ?`
	var rule models.SamplingRule
	var tagsJSON string
	err := db.QueryRow(query, serviceName, ruleID).Scan(&rule.ID, &rule.ServiceName, &rule.RuleName, &rule.Description, &rule.Priority, &rule.SampleRate, &tagsJSON, &rule.Status, &rule.IdempotencyKey, &rule.CreatedAt, &rule.UpdatedAt, &rule.EffectiveStart, &rule.EffectiveEnd)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(tagsJSON), &rule.Tags)
	return &rule, nil
}

func (db *DB) ListSamplingRules(serviceName string) ([]models.SamplingRule, error) {
	query := `SELECT id, service_name, rule_name, description, priority, sample_rate, tags, status, idempotency_key, created_at, updated_at, effective_start, effective_end FROM sampling_rules WHERE service_name = ? ORDER BY priority DESC, created_at DESC`
	rows, err := db.Query(query, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.SamplingRule
	for rows.Next() {
		var r models.SamplingRule
		var tagsJSON string
		err := rows.Scan(&r.ID, &r.ServiceName, &r.RuleName, &r.Description, &r.Priority, &r.SampleRate, &tagsJSON, &r.Status, &r.IdempotencyKey, &r.CreatedAt, &r.UpdatedAt, &r.EffectiveStart, &r.EffectiveEnd)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(tagsJSON), &r.Tags)
		rules = append(rules, r)
	}
	return rules, nil
}

func (db *DB) UpdateSamplingRule(rule *models.SamplingRule) error {
	tagsJSON, _ := json.Marshal(rule.Tags)
	query := `UPDATE sampling_rules SET rule_name = ?, description = ?, priority = ?, sample_rate = ?, tags = ?, status = ?, effective_start = ?, effective_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, rule.RuleName, rule.Description, rule.Priority, rule.SampleRate, string(tagsJSON), rule.Status, rule.EffectiveStart, rule.EffectiveEnd, rule.ID)
	return err
}

func (db *DB) UpdateRuleStatus(ruleID int64, status string) error {
	query := `UPDATE sampling_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, status, ruleID)
	return err
}

func (db *DB) GetBudget(serviceName string) (*models.Budget, error) {
	query := `SELECT id, service_name, total_budget, used_budget, remaining_budget, compensated_budget, budget_period, start_date, end_date, created_at, updated_at FROM budgets WHERE service_name = ?`
	var budget models.Budget
	err := db.QueryRow(query, serviceName).Scan(&budget.ID, &budget.ServiceName, &budget.TotalBudget, &budget.UsedBudget, &budget.RemainingBudget, &budget.CompensatedBudget, &budget.BudgetPeriod, &budget.StartDate, &budget.EndDate, &budget.CreatedAt, &budget.UpdatedAt)
	if err == sql.ErrNoRows {
		return db.createDefaultBudget(serviceName)
	}
	return &budget, err
}

func (db *DB) createDefaultBudget(serviceName string) (*models.Budget, error) {
	defaultTotal := int64(1000000)
	now := time.Now()
	query := `INSERT INTO budgets (service_name, total_budget, used_budget, remaining_budget, compensated_budget, budget_period, start_date, end_date, created_at, updated_at) VALUES (?, ?, 0, ?, 0, 'MONTHLY', ?, ?, ?, ?)`
	_, err := db.Exec(query, serviceName, defaultTotal, defaultTotal, now, now, now, now)
	if err != nil {
		return nil, err
	}
	return db.GetBudget(serviceName)
}

func (db *DB) UpdateBudget(budget *models.Budget) error {
	query := `UPDATE budgets SET total_budget = ?, used_budget = ?, remaining_budget = ?, compensated_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE service_name = ?`
	_, err := db.Exec(query, budget.TotalBudget, budget.UsedBudget, budget.RemainingBudget, budget.CompensatedBudget, budget.ServiceName)
	return err
}

func (db *DB) CheckIdempotentTransaction(key string) (bool, error) {
	query := `SELECT COUNT(*) FROM budget_transactions WHERE idempotency_key = ?`
	var count int
	err := db.QueryRow(query, key).Scan(&count)
	return count > 0, err
}

func (db *DB) CreateTransaction(tx *models.BudgetTransaction) error {
	tagsJSON, _ := json.Marshal(tx.Tags)
	query := `INSERT INTO budget_transactions (service_name, transaction_type, amount, trace_id, tags, reason, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, tx.ServiceName, tx.TransactionType, tx.Amount, tx.TraceID, string(tagsJSON), tx.Reason, tx.IdempotencyKey)
	if err != nil {
		return err
	}
	tx.ID, err = result.LastInsertId()
	return err
}

func (db *DB) ListTransactions(serviceName string, limit int) ([]models.BudgetTransaction, error) {
	query := `SELECT id, service_name, transaction_type, amount, trace_id, tags, reason, idempotency_key, created_at FROM budget_transactions WHERE service_name = ? ORDER BY created_at DESC LIMIT ?`
	rows, err := db.Query(query, serviceName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.BudgetTransaction
	for rows.Next() {
		var t models.BudgetTransaction
		var tagsJSON string
		err := rows.Scan(&t.ID, &t.ServiceName, &t.TransactionType, &t.Amount, &t.TraceID, &tagsJSON, &t.Reason, &t.IdempotencyKey, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(tagsJSON), &t.Tags)
		transactions = append(transactions, t)
	}
	return transactions, nil
}

func (db *DB) CreateAdjustmentRequest(adj *models.AdjustmentRequest) error {
	query := `INSERT INTO adjustment_requests (service_name, adjustment_type, adjustment_value, reason, applicant, approver, status, idempotency_key) VALUES (?, ?, ?, ?, ?, '', ?, ?)`
	result, err := db.Exec(query, adj.ServiceName, adj.AdjustmentType, adj.AdjustmentValue, adj.Reason, adj.Applicant, adj.Status, adj.IdempotencyKey)
	if err != nil {
		return err
	}
	adj.ID, err = result.LastInsertId()
	return err
}

func (db *DB) GetAdjustmentRequest(serviceName string, adjID int64) (*models.AdjustmentRequest, error) {
	query := `SELECT id, service_name, adjustment_type, adjustment_value, reason, applicant, approver, status, idempotency_key, created_at, approved_at FROM adjustment_requests WHERE service_name = ? AND id = ?`
	var adj models.AdjustmentRequest
	err := db.QueryRow(query, serviceName, adjID).Scan(&adj.ID, &adj.ServiceName, &adj.AdjustmentType, &adj.AdjustmentValue, &adj.Reason, &adj.Applicant, &adj.Approver, &adj.Status, &adj.IdempotencyKey, &adj.CreatedAt, &adj.ApprovedAt)
	if err != nil {
		return nil, err
	}
	return &adj, nil
}

func (db *DB) ListAdjustmentRequests(serviceName string) ([]models.AdjustmentRequest, error) {
	query := `SELECT id, service_name, adjustment_type, adjustment_value, reason, applicant, approver, status, idempotency_key, created_at, approved_at FROM adjustment_requests WHERE service_name = ? ORDER BY created_at DESC`
	rows, err := db.Query(query, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var adjustments []models.AdjustmentRequest
	for rows.Next() {
		var a models.AdjustmentRequest
		err := rows.Scan(&a.ID, &a.ServiceName, &a.AdjustmentType, &a.AdjustmentValue, &a.Reason, &a.Applicant, &a.Approver, &a.Status, &a.IdempotencyKey, &a.CreatedAt, &a.ApprovedAt)
		if err != nil {
			return nil, err
		}
		adjustments = append(adjustments, a)
	}
	return adjustments, nil
}

func (db *DB) ApproveAdjustment(adjID int64, approver string) error {
	now := time.Now()
	query := `UPDATE adjustment_requests SET status = 'APPROVED', approver = ?, approved_at = ? WHERE id = ?`
	_, err := db.Exec(query, approver, now, adjID)
	return err
}

func (db *DB) RejectAdjustment(adjID int64, approver string) error {
	query := `UPDATE adjustment_requests SET status = 'REJECTED', approver = ? WHERE id = ?`
	_, err := db.Exec(query, approver, adjID)
	return err
}

func (db *DB) CreateExceptionLog(log *models.ExceptionLog) error {
	query := `INSERT INTO exception_logs (service_name, operation, raw_input, error_type, error_message, processing_conclusion, resolution_status) VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, log.ServiceName, log.Operation, log.RawInput, log.ErrorType, log.ErrorMessage, log.ProcessingConclusion, log.ResolutionStatus)
	if err != nil {
		return err
	}
	log.ID, err = result.LastInsertId()
	return err
}

func (db *DB) GetExceptionLog(logID int64) (*models.ExceptionLog, error) {
	query := `SELECT id, service_name, operation, raw_input, error_type, error_message, processing_conclusion, resolution_status, created_at, resolved_at FROM exception_logs WHERE id = ?`
	var log models.ExceptionLog
	err := db.QueryRow(query, logID).Scan(&log.ID, &log.ServiceName, &log.Operation, &log.RawInput, &log.ErrorType, &log.ErrorMessage, &log.ProcessingConclusion, &log.ResolutionStatus, &log.CreatedAt, &log.ResolvedAt)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (db *DB) ListExceptionLogs(serviceName string, limit int) ([]models.ExceptionLog, error) {
	var query string
	var rows *sql.Rows
	var err error

	if serviceName != "" {
		query = `SELECT id, service_name, operation, raw_input, error_type, error_message, processing_conclusion, resolution_status, created_at, resolved_at FROM exception_logs WHERE service_name = ? ORDER BY created_at DESC LIMIT ?`
		rows, err = db.Query(query, serviceName, limit)
	} else {
		query = `SELECT id, service_name, operation, raw_input, error_type, error_message, processing_conclusion, resolution_status, created_at, resolved_at FROM exception_logs ORDER BY created_at DESC LIMIT ?`
		rows, err = db.Query(query, limit)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.ExceptionLog
	for rows.Next() {
		var l models.ExceptionLog
		err := rows.Scan(&l.ID, &l.ServiceName, &l.Operation, &l.RawInput, &l.ErrorType, &l.ErrorMessage, &l.ProcessingConclusion, &l.ResolutionStatus, &l.CreatedAt, &l.ResolvedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (db *DB) GetTraceSummary(serviceName string, limit int) ([]models.TraceSummary, error) {
	query := `SELECT trace_id, COUNT(*) as count FROM budget_transactions WHERE service_name = ? AND trace_id IS NOT NULL GROUP BY trace_id ORDER BY count DESC LIMIT ?`
	rows, err := db.Query(query, serviceName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []models.TraceSummary
	for rows.Next() {
		var t models.TraceSummary
		err := rows.Scan(&t.TraceID, &t.Count)
		if err != nil {
			return nil, err
		}
		traces = append(traces, t)
	}
	return traces, nil
}

func (db *DB) GetAdjustmentCount(serviceName string, status string) (int, error) {
	query := `SELECT COUNT(*) FROM adjustment_requests WHERE service_name = ? AND status = ?`
	var count int
	err := db.QueryRow(query, serviceName, status).Scan(&count)
	return count, err
}

func (db *DB) CheckIdempotentAdjustment(key string) (bool, error) {
	query := `SELECT COUNT(*) FROM adjustment_requests WHERE idempotency_key = ?`
	var count int
	err := db.QueryRow(query, key).Scan(&count)
	return count > 0, err
}

func (db *DB) CheckIdempotentRule(key string) (bool, error) {
	query := `SELECT COUNT(*) FROM sampling_rules WHERE idempotency_key = ?`
	var count int
	err := db.QueryRow(query, key).Scan(&count)
	return count > 0, err
}
