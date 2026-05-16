package storage

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"export-quota-api/models"
	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	storage := &SQLiteStorage{db: db}
	if err := storage.initTables(); err != nil {
		return nil, fmt.Errorf("failed to init tables: %w", err)
	}

	return storage, nil
}

func (s *SQLiteStorage) initTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			max_concurrent INTEGER NOT NULL DEFAULT 3,
			max_daily_size INTEGER NOT NULL DEFAULT 1073741824,
			max_queue_size INTEGER NOT NULL DEFAULT 10
		)`,
		`CREATE TABLE IF NOT EXISTS export_tasks (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			file_type TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			started_at DATETIME,
			completed_at DATETIME,
			reject_reason TEXT,
			reject_detail TEXT,
			raw_request TEXT NOT NULL,
			processing_log TEXT NOT NULL DEFAULT '',
			priority INTEGER NOT NULL DEFAULT 0,
			download_url TEXT,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id)
		)`,
		`CREATE TABLE IF NOT EXISTS quota_windows (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			window_type TEXT NOT NULL,
			window_start DATETIME NOT NULL,
			window_end DATETIME NOT NULL,
			used_size INTEGER NOT NULL DEFAULT 0,
			used_count INTEGER NOT NULL DEFAULT 0,
			max_size INTEGER NOT NULL,
			max_count INTEGER NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id)
		)`,
		`CREATE TABLE IF NOT EXISTS usage_reports (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			report_date DATETIME NOT NULL,
			total_tasks INTEGER NOT NULL DEFAULT 0,
			completed_tasks INTEGER NOT NULL DEFAULT 0,
			failed_tasks INTEGER NOT NULL DEFAULT 0,
			rejected_tasks INTEGER NOT NULL DEFAULT 0,
			total_size INTEGER NOT NULL DEFAULT 0,
			avg_duration_seconds REAL NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id)
		)`,
		`CREATE TABLE IF NOT EXISTS task_history (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			from_status TEXT NOT NULL,
			to_status TEXT NOT NULL,
			reason TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			operator TEXT,
			FOREIGN KEY (task_id) REFERENCES export_tasks(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON export_tasks(tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_created ON export_tasks(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_quota_window_tenant ON quota_windows(tenant_id, window_type)`,
		`CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id)`,
	}

	for _, query := range queries {
		if _, err := s.db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}

func (s *SQLiteStorage) CreateTenant(tenant *models.Tenant) error {
	query := `INSERT INTO tenants (id, name, created_at, updated_at, max_concurrent, max_daily_size, max_queue_size) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, tenant.ID, tenant.Name, tenant.CreatedAt, tenant.UpdatedAt, tenant.MaxConcurrent, tenant.MaxDailySize, tenant.MaxQueueSize)
	return err
}

func (s *SQLiteStorage) GetTenant(id string) (*models.Tenant, error) {
	query := `SELECT id, name, created_at, updated_at, max_concurrent, max_daily_size, max_queue_size FROM tenants WHERE id = ?`
	var tenant models.Tenant
	err := s.db.QueryRow(query, id).Scan(&tenant.ID, &tenant.Name, &tenant.CreatedAt, &tenant.UpdatedAt, &tenant.MaxConcurrent, &tenant.MaxDailySize, &tenant.MaxQueueSize)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &tenant, err
}

func (s *SQLiteStorage) UpdateTenant(tenant *models.Tenant) error {
	tenant.UpdatedAt = time.Now()
	query := `UPDATE tenants SET name = ?, updated_at = ?, max_concurrent = ?, max_daily_size = ?, max_queue_size = ? WHERE id = ?`
	_, err := s.db.Exec(query, tenant.Name, tenant.UpdatedAt, tenant.MaxConcurrent, tenant.MaxDailySize, tenant.MaxQueueSize, tenant.ID)
	return err
}

func (s *SQLiteStorage) CreateTask(task *models.ExportTask) error {
	query := `INSERT INTO export_tasks (id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, task.ID, task.TenantID, task.FileName, task.FileSize, task.FileType, task.Status, task.CreatedAt, task.UpdatedAt, task.StartedAt, task.CompletedAt, task.RejectReason, task.RejectDetail, task.RawRequest, task.ProcessingLog, task.Priority, task.DownloadURL)
	return err
}

func (s *SQLiteStorage) GetTask(id string) (*models.ExportTask, error) {
	query := `SELECT id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url FROM export_tasks WHERE id = ?`
	var task models.ExportTask
	err := s.db.QueryRow(query, id).Scan(&task.ID, &task.TenantID, &task.FileName, &task.FileSize, &task.FileType, &task.Status, &task.CreatedAt, &task.UpdatedAt, &task.StartedAt, &task.CompletedAt, &task.RejectReason, &task.RejectDetail, &task.RawRequest, &task.ProcessingLog, &task.Priority, &task.DownloadURL)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &task, err
}

func (s *SQLiteStorage) UpdateTask(task *models.ExportTask) error {
	task.UpdatedAt = time.Now()
	query := `UPDATE export_tasks SET status = ?, updated_at = ?, started_at = ?, completed_at = ?, reject_reason = ?, reject_detail = ?, processing_log = ?, download_url = ? WHERE id = ?`
	_, err := s.db.Exec(query, task.Status, task.UpdatedAt, task.StartedAt, task.CompletedAt, task.RejectReason, task.RejectDetail, task.ProcessingLog, task.DownloadURL, task.ID)
	return err
}

func (s *SQLiteStorage) GetTasksByTenant(tenantID string, status *models.ExportTaskStatus, limit, offset int) ([]*models.ExportTask, error) {
	var query string
	var args []interface{}

	if status != nil {
		query = `SELECT id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url FROM export_tasks WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
		args = []interface{}{tenantID, *status, limit, offset}
	} else {
		query = `SELECT id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url FROM export_tasks WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
		args = []interface{}{tenantID, limit, offset}
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*models.ExportTask
	for rows.Next() {
		var task models.ExportTask
		err := rows.Scan(&task.ID, &task.TenantID, &task.FileName, &task.FileSize, &task.FileType, &task.Status, &task.CreatedAt, &task.UpdatedAt, &task.StartedAt, &task.CompletedAt, &task.RejectReason, &task.RejectDetail, &task.RawRequest, &task.ProcessingLog, &task.Priority, &task.DownloadURL)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func (s *SQLiteStorage) CountTasksByStatus(tenantID string, status models.ExportTaskStatus) (int, error) {
	query := `SELECT COUNT(*) FROM export_tasks WHERE tenant_id = ? AND status = ?`
	var count int
	err := s.db.QueryRow(query, tenantID, status).Scan(&count)
	return count, err
}

func (s *SQLiteStorage) CreateQuotaWindow(window *models.QuotaWindow) error {
	query := `INSERT INTO quota_windows (id, tenant_id, window_type, window_start, window_end, used_size, used_count, max_size, max_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, window.ID, window.TenantID, window.WindowType, window.WindowStart, window.WindowEnd, window.UsedSize, window.UsedCount, window.MaxSize, window.MaxCount, window.CreatedAt, window.UpdatedAt)
	return err
}

func (s *SQLiteStorage) GetCurrentQuotaWindow(tenantID string, windowType string) (*models.QuotaWindow, error) {
	now := time.Now()
	query := `SELECT id, tenant_id, window_type, window_start, window_end, used_size, used_count, max_size, max_count, created_at, updated_at FROM quota_windows WHERE tenant_id = ? AND window_type = ? AND window_start <= ? AND window_end > ? ORDER BY window_start DESC LIMIT 1`
	var window models.QuotaWindow
	err := s.db.QueryRow(query, tenantID, windowType, now, now).Scan(&window.ID, &window.TenantID, &window.WindowType, &window.WindowStart, &window.WindowEnd, &window.UsedSize, &window.UsedCount, &window.MaxSize, &window.MaxCount, &window.CreatedAt, &window.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &window, err
}

func (s *SQLiteStorage) UpdateQuotaWindow(window *models.QuotaWindow) error {
	window.UpdatedAt = time.Now()
	query := `UPDATE quota_windows SET used_size = ?, used_count = ?, updated_at = ? WHERE id = ?`
	_, err := s.db.Exec(query, window.UsedSize, window.UsedCount, window.UpdatedAt, window.ID)
	return err
}

func (s *SQLiteStorage) CreateTaskHistory(history *models.TaskHistory) error {
	query := `INSERT INTO task_history (id, task_id, from_status, to_status, reason, created_at, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, history.ID, history.TaskID, history.FromStatus, history.ToStatus, history.Reason, history.CreatedAt, history.Operator)
	return err
}

func (s *SQLiteStorage) GetTaskHistory(taskID string) ([]*models.TaskHistory, error) {
	query := `SELECT id, task_id, from_status, to_status, reason, created_at, operator FROM task_history WHERE task_id = ? ORDER BY created_at ASC`
	rows, err := s.db.Query(query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*models.TaskHistory
	for rows.Next() {
		var h models.TaskHistory
		err := rows.Scan(&h.ID, &h.TaskID, &h.FromStatus, &h.ToStatus, &h.Reason, &h.CreatedAt, &h.Operator)
		if err != nil {
			return nil, err
		}
		history = append(history, &h)
	}
	return history, nil
}

func (s *SQLiteStorage) CreateUsageReport(report *models.UsageReport) error {
	query := `INSERT INTO usage_reports (id, tenant_id, report_date, total_tasks, completed_tasks, failed_tasks, rejected_tasks, total_size, avg_duration_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, report.ID, report.TenantID, report.ReportDate, report.TotalTasks, report.CompletedTasks, report.FailedTasks, report.RejectedTasks, report.TotalSize, report.AvgDuration, report.CreatedAt)
	return err
}

func (s *SQLiteStorage) GetUsageReports(tenantID string, startDate, endDate time.Time) ([]*models.UsageReport, error) {
	query := `SELECT id, tenant_id, report_date, total_tasks, completed_tasks, failed_tasks, rejected_tasks, total_size, avg_duration_seconds, created_at FROM usage_reports WHERE tenant_id = ? AND report_date >= ? AND report_date <= ? ORDER BY report_date DESC`
	rows, err := s.db.Query(query, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*models.UsageReport
	for rows.Next() {
		var report models.UsageReport
		err := rows.Scan(&report.ID, &report.TenantID, &report.ReportDate, &report.TotalTasks, &report.CompletedTasks, &report.FailedTasks, &report.RejectedTasks, &report.TotalSize, &report.AvgDuration, &report.CreatedAt)
		if err != nil {
			return nil, err
		}
		reports = append(reports, &report)
	}
	return reports, nil
}

func (s *SQLiteStorage) GetQueuedTasksForExecution(tenantID string, limit int) ([]*models.ExportTask, error) {
	query := `SELECT id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url FROM export_tasks WHERE tenant_id = ? AND status = ? ORDER BY priority DESC, created_at ASC LIMIT ?`
	rows, err := s.db.Query(query, tenantID, models.StatusQueued, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*models.ExportTask
	for rows.Next() {
		var task models.ExportTask
		err := rows.Scan(&task.ID, &task.TenantID, &task.FileName, &task.FileSize, &task.FileType, &task.Status, &task.CreatedAt, &task.UpdatedAt, &task.StartedAt, &task.CompletedAt, &task.RejectReason, &task.RejectDetail, &task.RawRequest, &task.ProcessingLog, &task.Priority, &task.DownloadURL)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func (s *SQLiteStorage) BeginTx() (*sql.Tx, error) {
	return s.db.Begin()
}

func (s *SQLiteStorage) GetDB() *sql.DB {
	return s.db
}

func (s *SQLiteStorage) GetAllTenants() ([]*models.Tenant, error) {
	query := `SELECT id, name, created_at, updated_at, max_concurrent, max_daily_size, max_queue_size FROM tenants ORDER BY created_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []*models.Tenant
	for rows.Next() {
		var tenant models.Tenant
		err := rows.Scan(&tenant.ID, &tenant.Name, &tenant.CreatedAt, &tenant.UpdatedAt, &tenant.MaxConcurrent, &tenant.MaxDailySize, &tenant.MaxQueueSize)
		if err != nil {
			return nil, err
		}
		tenants = append(tenants, &tenant)
	}
	return tenants, nil
}

func (s *SQLiteStorage) GetAllTasksForReport(startDate, endDate time.Time) ([]*models.ExportTask, error) {
	query := `SELECT id, tenant_id, file_name, file_size, file_type, status, created_at, updated_at, started_at, completed_at, reject_reason, reject_detail, raw_request, processing_log, priority, download_url FROM export_tasks WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`
	rows, err := s.db.Query(query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*models.ExportTask
	for rows.Next() {
		var task models.ExportTask
		err := rows.Scan(&task.ID, &task.TenantID, &task.FileName, &task.FileSize, &task.FileType, &task.Status, &task.CreatedAt, &task.UpdatedAt, &task.StartedAt, &task.CompletedAt, &task.RejectReason, &task.RejectDetail, &task.RawRequest, &task.ProcessingLog, &task.Priority, &task.DownloadURL)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}
