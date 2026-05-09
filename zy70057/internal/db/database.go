package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"fundservice/internal/model"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode=WAL&_pragma=foreign_keys=on")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err := initSchema(); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	return nil
}

func initSchema() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY,
			code TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			parent_id TEXT,
			level INTEGER NOT NULL DEFAULT 1,
			company_type TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'ACTIVE',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (parent_id) REFERENCES accounts(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(company_type)`,

		`CREATE TABLE IF NOT EXISTS aggregation_tasks (
			id TEXT PRIMARY KEY,
			task_date TEXT NOT NULL,
			idempotency_key TEXT UNIQUE NOT NULL,
			source_account TEXT NOT NULL,
			target_account TEXT NOT NULL,
			amount INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING',
			retry_count INTEGER NOT NULL DEFAULT 0,
			max_retries INTEGER NOT NULL DEFAULT 3,
			last_error TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_date ON aggregation_tasks(task_date)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_status ON aggregation_tasks(status)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_source ON aggregation_tasks(source_account)`,

		`CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			account_id TEXT NOT NULL,
			transaction_date TEXT NOT NULL,
			transaction_type TEXT NOT NULL,
			amount INTEGER NOT NULL,
			balance INTEGER NOT NULL,
			reference_id TEXT,
			task_id TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (account_id) REFERENCES accounts(id),
			FOREIGN KEY (task_id) REFERENCES aggregation_tasks(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_trans_account ON transactions(account_id)`,
		`CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(transaction_date)`,
		`CREATE INDEX IF NOT EXISTS idx_trans_task ON transactions(task_id)`,

		`CREATE TABLE IF NOT EXISTS daily_reports (
			id TEXT PRIMARY KEY,
			report_date TEXT UNIQUE NOT NULL,
			status TEXT NOT NULL DEFAULT 'GENERATING',
			total_tasks INTEGER NOT NULL DEFAULT 0,
			successful_tasks INTEGER NOT NULL DEFAULT 0,
			failed_tasks INTEGER NOT NULL DEFAULT 0,
			discrepancy_count INTEGER NOT NULL DEFAULT 0,
			discrepancy_amount INTEGER NOT NULL DEFAULT 0,
			discrepant_accounts TEXT DEFAULT '[]',
			generated_at DATETIME
		)`,

		`CREATE TABLE IF NOT EXISTS discrepancy_records (
			id TEXT PRIMARY KEY,
			account_id TEXT NOT NULL,
			record_date TEXT NOT NULL,
			expected_balance INTEGER NOT NULL,
			actual_balance INTEGER NOT NULL,
			diff_amount INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING',
			resolved_by TEXT,
			resolved_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (account_id) REFERENCES accounts(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_discrepancy_date ON discrepancy_records(record_date)`,
		`CREATE INDEX IF NOT EXISTS idx_discrepancy_status ON discrepancy_records(status)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_discrepancy_unique ON discrepancy_records(account_id, record_date)`,
	}

	for _, schema := range schemas {
		if _, err := DB.Exec(schema); err != nil {
			return fmt.Errorf("failed to execute schema: %w", err)
		}
	}

	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}

func CreateAccount(acc *model.Account) error {
	now := time.Now()
	var parentID interface{}
	if acc.ParentID.Valid {
		parentID = acc.ParentID.String
	} else {
		parentID = nil
	}

	query := `INSERT INTO accounts (id, code, name, parent_id, level, company_type, status, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, acc.ID, acc.Code, acc.Name, parentID, acc.Level, acc.CompanyType, acc.Status, now, now)
	return err
}

func scanAccount(row interface{ Scan(...interface{}) error }) (*model.Account, error) {
	var acc model.Account
	err := row.Scan(&acc.ID, &acc.Code, &acc.Name, &acc.ParentID, &acc.Level, &acc.CompanyType, &acc.Status, &acc.CreatedAt, &acc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &acc, err
}

func GetAccountByID(id string) (*model.Account, error) {
	query := `SELECT id, code, name, parent_id, level, company_type, status, created_at, updated_at FROM accounts WHERE id = ?`
	return scanAccount(DB.QueryRow(query, id))
}

func GetAccountByCode(code string) (*model.Account, error) {
	query := `SELECT id, code, name, parent_id, level, company_type, status, created_at, updated_at FROM accounts WHERE code = ?`
	return scanAccount(DB.QueryRow(query, code))
}

func GetChildAccounts(parentID string) ([]*model.Account, error) {
	var rows *sql.Rows
	var err error

	if parentID == "" {
		query := `SELECT id, code, name, parent_id, level, company_type, status, created_at, updated_at 
			FROM accounts WHERE parent_id IS NULL AND status = 'ACTIVE'`
		rows, err = DB.Query(query)
	} else {
		query := `SELECT id, code, name, parent_id, level, company_type, status, created_at, updated_at 
			FROM accounts WHERE parent_id = ? AND status = 'ACTIVE'`
		rows, err = DB.Query(query, parentID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		var acc model.Account
		if err := rows.Scan(&acc.ID, &acc.Code, &acc.Name, &acc.ParentID, &acc.Level, &acc.CompanyType, &acc.Status, &acc.CreatedAt, &acc.UpdatedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, &acc)
	}
	return accounts, nil
}

func GetAllAccounts() ([]*model.Account, error) {
	query := `SELECT id, code, name, parent_id, level, company_type, status, created_at, updated_at FROM accounts ORDER BY level, code`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		var acc model.Account
		if err := rows.Scan(&acc.ID, &acc.Code, &acc.Name, &acc.ParentID, &acc.Level, &acc.CompanyType, &acc.Status, &acc.CreatedAt, &acc.UpdatedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, &acc)
	}
	return accounts, nil
}

func CreateTask(task *model.AggregationTask) error {
	now := time.Now()
	query := `INSERT INTO aggregation_tasks (id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, task.ID, task.TaskDate, task.IDEMPOTENCYKEY, task.SourceAccount, task.TargetAccount, task.Amount, task.Status, task.RetryCount, task.MaxRetries, task.LastError, now, now)
	return err
}

func scanTask(row interface{ Scan(...interface{}) error }) (*model.AggregationTask, error) {
	var task model.AggregationTask
	err := row.Scan(&task.ID, &task.TaskDate, &task.IDEMPOTENCYKEY, &task.SourceAccount, &task.TargetAccount, &task.Amount, &task.Status, &task.RetryCount, &task.MaxRetries, &task.LastError, &task.CreatedAt, &task.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &task, err
}

func GetTaskByIdempotencyKey(key string) (*model.AggregationTask, error) {
	query := `SELECT id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at 
		FROM aggregation_tasks WHERE idempotency_key = ?`
	return scanTask(DB.QueryRow(query, key))
}

func GetTaskByID(id string) (*model.AggregationTask, error) {
	query := `SELECT id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at 
		FROM aggregation_tasks WHERE id = ?`
	return scanTask(DB.QueryRow(query, id))
}

func UpdateTaskStatus(task *model.AggregationTask) error {
	now := time.Now()
	query := `UPDATE aggregation_tasks SET status = ?, retry_count = ?, last_error = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, task.Status, task.RetryCount, task.LastError, now, task.ID)
	return err
}

func GetTasksByDateAndStatus(date string, status string) ([]*model.AggregationTask, error) {
	query := `SELECT id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at 
		FROM aggregation_tasks WHERE task_date = ? AND status = ?`
	rows, err := DB.Query(query, date, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.AggregationTask
	for rows.Next() {
		var task model.AggregationTask
		if err := rows.Scan(&task.ID, &task.TaskDate, &task.IDEMPOTENCYKEY, &task.SourceAccount, &task.TargetAccount, &task.Amount, &task.Status, &task.RetryCount, &task.MaxRetries, &task.LastError, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func CreateTransaction(tx *model.Transaction) error {
	var taskID interface{}
	if tx.TaskID == "" {
		taskID = nil
	} else {
		taskID = tx.TaskID
	}
	
	query := `INSERT INTO transactions (id, account_id, transaction_date, transaction_type, amount, balance, reference_id, task_id, created_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, tx.ID, tx.AccountID, tx.TransactionDate, tx.TransactionType, tx.Amount, tx.Balance, tx.ReferenceID, taskID, time.Now())
	return err
}

func GetTransactionsByAccountAndDate(accountID string, date string) ([]*model.Transaction, error) {
	query := `SELECT id, account_id, transaction_date, transaction_type, amount, balance, reference_id, task_id, created_at 
		FROM transactions WHERE account_id = ? AND transaction_date = ? ORDER BY created_at`
	rows, err := DB.Query(query, accountID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []*model.Transaction
	for rows.Next() {
		var tx model.Transaction
		if err := rows.Scan(&tx.ID, &tx.AccountID, &tx.TransactionDate, &tx.TransactionType, &tx.Amount, &tx.Balance, &tx.ReferenceID, &tx.TaskID, &tx.CreatedAt); err != nil {
			return nil, err
		}
		transactions = append(transactions, &tx)
	}
	return transactions, nil
}

func GetLatestBalance(accountID string, date string) (int64, error) {
	var balance int64
	query := `SELECT balance FROM transactions WHERE account_id = ? AND transaction_date <= ? ORDER BY transaction_date DESC, created_at DESC LIMIT 1`
	err := DB.QueryRow(query, accountID, date).Scan(&balance)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return balance, err
}

func CreateDailyReport(report *model.DailyReport) error {
	query := `INSERT INTO daily_reports (id, report_date, status, total_tasks, successful_tasks, failed_tasks, discrepancy_count, discrepancy_amount, discrepant_accounts, generated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, report.ID, report.ReportDate, report.Status, report.TotalTasks, report.SuccessfulTasks, report.FailedTasks, report.DiscrepancyCount, report.DiscrepancyAmount, report.DiscrepantAccounts, report.GeneratedAt)
	return err
}

func UpdateDailyReport(report *model.DailyReport) error {
	query := `UPDATE daily_reports SET status = ?, total_tasks = ?, successful_tasks = ?, failed_tasks = ?, 
		discrepancy_count = ?, discrepancy_amount = ?, discrepant_accounts = ?, generated_at = ? WHERE report_date = ?`
	_, err := DB.Exec(query, report.Status, report.TotalTasks, report.SuccessfulTasks, report.FailedTasks, 
		report.DiscrepancyCount, report.DiscrepancyAmount, report.DiscrepantAccounts, report.GeneratedAt, report.ReportDate)
	return err
}

func scanDailyReport(row interface{ Scan(...interface{}) error }) (*model.DailyReport, error) {
	var report model.DailyReport
	err := row.Scan(&report.ID, &report.ReportDate, &report.Status, &report.TotalTasks, &report.SuccessfulTasks, &report.FailedTasks, 
		&report.DiscrepancyCount, &report.DiscrepancyAmount, &report.DiscrepantAccounts, &report.GeneratedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &report, err
}

func GetDailyReport(date string) (*model.DailyReport, error) {
	query := `SELECT id, report_date, status, total_tasks, successful_tasks, failed_tasks, discrepancy_count, discrepancy_amount, discrepant_accounts, generated_at 
		FROM daily_reports WHERE report_date = ?`
	return scanDailyReport(DB.QueryRow(query, date))
}

func GetDailyReports(startDate, endDate string) ([]*model.DailyReport, error) {
	query := `SELECT id, report_date, status, total_tasks, successful_tasks, failed_tasks, discrepancy_count, discrepancy_amount, discrepant_accounts, generated_at 
		FROM daily_reports WHERE report_date BETWEEN ? AND ? ORDER BY report_date DESC`
	rows, err := DB.Query(query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*model.DailyReport
	for rows.Next() {
		var report model.DailyReport
		if err := rows.Scan(&report.ID, &report.ReportDate, &report.Status, &report.TotalTasks, &report.SuccessfulTasks, &report.FailedTasks, 
			&report.DiscrepancyCount, &report.DiscrepancyAmount, &report.DiscrepantAccounts, &report.GeneratedAt); err != nil {
			return nil, err
		}
		reports = append(reports, &report)
	}
	return reports, nil
}

func CreateDiscrepancyRecord(dr *model.DiscrepancyRecord) error {
	query := `INSERT INTO discrepancy_records (id, account_id, record_date, expected_balance, actual_balance, diff_amount, status, resolved_by, resolved_at, created_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, dr.ID, dr.AccountID, dr.RecordDate, dr.ExpectedBalance, dr.ActualBalance, dr.DiffAmount, dr.Status, dr.ResolvedBy, dr.ResolvedAt, time.Now())
	return err
}

func GetDiscrepanciesByDate(date string) ([]*model.DiscrepancyRecord, error) {
	query := `SELECT id, account_id, record_date, expected_balance, actual_balance, diff_amount, status, resolved_by, resolved_at, created_at 
		FROM discrepancy_records WHERE record_date = ?`
	rows, err := DB.Query(query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.DiscrepancyRecord
	for rows.Next() {
		var dr model.DiscrepancyRecord
		if err := rows.Scan(&dr.ID, &dr.AccountID, &dr.RecordDate, &dr.ExpectedBalance, &dr.ActualBalance, &dr.DiffAmount, &dr.Status, &dr.ResolvedBy, &dr.ResolvedAt, &dr.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, &dr)
	}
	return records, nil
}

func GetPendingDiscrepancies() ([]*model.DiscrepancyRecord, error) {
	query := `SELECT id, account_id, record_date, expected_balance, actual_balance, diff_amount, status, resolved_by, resolved_at, created_at 
		FROM discrepancy_records WHERE status IN ('PENDING', 'INVESTIGATING') ORDER BY record_date DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.DiscrepancyRecord
	for rows.Next() {
		var dr model.DiscrepancyRecord
		if err := rows.Scan(&dr.ID, &dr.AccountID, &dr.RecordDate, &dr.ExpectedBalance, &dr.ActualBalance, &dr.DiffAmount, &dr.Status, &dr.ResolvedBy, &dr.ResolvedAt, &dr.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, &dr)
	}
	return records, nil
}

func UpdateDiscrepancyStatus(id, status, resolvedBy string) error {
	now := time.Now()
	query := `UPDATE discrepancy_records SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`
	_, err := DB.Exec(query, status, resolvedBy, now, id)
	return err
}

func GetFailedTasksForRetry(date string) ([]*model.AggregationTask, error) {
	query := `SELECT id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at 
		FROM aggregation_tasks WHERE task_date = ? AND status = 'FAILED' AND retry_count < max_retries`
	rows, err := DB.Query(query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.AggregationTask
	for rows.Next() {
		var task model.AggregationTask
		if err := rows.Scan(&task.ID, &task.TaskDate, &task.IDEMPOTENCYKEY, &task.SourceAccount, &task.TargetAccount, &task.Amount, &task.Status, &task.RetryCount, &task.MaxRetries, &task.LastError, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func GetAllTasksByDate(date string) ([]*model.AggregationTask, error) {
	query := `SELECT id, task_date, idempotency_key, source_account, target_account, amount, status, retry_count, max_retries, last_error, created_at, updated_at 
		FROM aggregation_tasks WHERE task_date = ?`
	rows, err := DB.Query(query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.AggregationTask
	for rows.Next() {
		var task model.AggregationTask
		if err := rows.Scan(&task.ID, &task.TaskDate, &task.IDEMPOTENCYKEY, &task.SourceAccount, &task.TargetAccount, &task.Amount, &task.Status, &task.RetryCount, &task.MaxRetries, &task.LastError, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}
