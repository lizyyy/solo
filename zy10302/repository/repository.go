package repository

import (
	"database/sql"
	"lease-api/model"
	"time"
)

type Repository struct {
	DB *SQLiteDB
}

func NewRepository(db *SQLiteDB) *Repository {
	return &Repository{DB: db}
}

func (r *Repository) CreateTask(task *model.Task) error {
	query := `
	INSERT INTO tasks (id, name, payload, status, priority, created_at, updated_at, max_retries, retry_count, lease_timeout)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, task.ID, task.Name, task.Payload, task.Status, task.Priority,
		task.CreatedAt, task.UpdatedAt, task.MaxRetries, task.RetryCount, task.LeaseTimeout)
	return err
}

func (r *Repository) GetTask(id string) (*model.Task, error) {
	query := `
	SELECT id, name, payload, status, priority, created_at, updated_at, max_retries, retry_count, lease_timeout
	FROM tasks WHERE id = ?
	`
	var task model.Task
	err := r.DB.QueryRow(query, id).Scan(&task.ID, &task.Name, &task.Payload, &task.Status,
		&task.Priority, &task.CreatedAt, &task.UpdatedAt, &task.MaxRetries, &task.RetryCount, &task.LeaseTimeout)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *Repository) ListTasks(status *model.TaskStatus) ([]model.Task, error) {
	var query string
	var args []interface{}
	if status != nil {
		query = `
		SELECT id, name, payload, status, priority, created_at, updated_at, max_retries, retry_count, lease_timeout
		FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC
		`
		args = append(args, *status)
	} else {
		query = `
		SELECT id, name, payload, status, priority, created_at, updated_at, max_retries, retry_count, lease_timeout
		FROM tasks ORDER BY priority DESC, created_at ASC
		`
	}
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tasks []model.Task
	for rows.Next() {
		var task model.Task
		err := rows.Scan(&task.ID, &task.Name, &task.Payload, &task.Status, &task.Priority,
			&task.CreatedAt, &task.UpdatedAt, &task.MaxRetries, &task.RetryCount, &task.LeaseTimeout)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (r *Repository) UpdateTaskStatus(taskID string, status model.TaskStatus) error {
	query := `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, status, r.DB.Now(), taskID)
	return err
}

func (r *Repository) IncrementTaskRetry(taskID string) error {
	query := `UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, r.DB.Now(), taskID)
	return err
}

func (r *Repository) CreateLease(lease *model.Lease) error {
	query := `
	INSERT INTO leases (id, task_id, holder_id, holder_name, acquired_at, expires_at, renew_count, is_active)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, lease.ID, lease.TaskID, lease.HolderID, lease.HolderName,
		lease.AcquiredAt, lease.ExpiresAt, lease.RenewCount, lease.IsActive)
	return err
}

func (r *Repository) GetActiveLease(taskID string) (*model.Lease, error) {
	query := `
	SELECT id, task_id, holder_id, holder_name, acquired_at, expires_at, renew_count, is_active
	FROM leases WHERE task_id = ? AND is_active = 1
	`
	var lease model.Lease
	err := r.DB.QueryRow(query, taskID).Scan(&lease.ID, &lease.TaskID, &lease.HolderID, &lease.HolderName,
		&lease.AcquiredAt, &lease.ExpiresAt, &lease.RenewCount, &lease.IsActive)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &lease, nil
}

func (r *Repository) RenewLease(leaseID string, newExpiresAt time.Time) error {
	query := `UPDATE leases SET expires_at = ?, renew_count = renew_count + 1 WHERE id = ?`
	_, err := r.DB.Exec(query, newExpiresAt, leaseID)
	return err
}

func (r *Repository) DeactivateLease(leaseID string) error {
	query := `UPDATE leases SET is_active = 0 WHERE id = ?`
	_, err := r.DB.Exec(query, leaseID)
	return err
}

func (r *Repository) HasExecutionResult(taskID string) (bool, error) {
	query := `SELECT COUNT(*) FROM execution_results WHERE task_id = ?`
	var count int
	err := r.DB.QueryRow(query, taskID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *Repository) CreateExecutionResult(result *model.ExecutionResult) error {
	query := `
	INSERT INTO execution_results (id, task_id, lease_id, holder_id, status, result_data, error_message, started_at, completed_at, duration_ms)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, result.ID, result.TaskID, result.LeaseID, result.HolderID,
		result.Status, result.ResultData, result.ErrorMessage, result.StartedAt, result.CompletedAt, result.DurationMs)
	return err
}

func (r *Repository) GetExecutionResults(taskID string) ([]model.ExecutionResult, error) {
	query := `
	SELECT id, task_id, lease_id, holder_id, status, result_data, error_message, started_at, completed_at, duration_ms
	FROM execution_results WHERE task_id = ? ORDER BY completed_at DESC
	`
	rows, err := r.DB.Query(query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []model.ExecutionResult
	for rows.Next() {
		var result model.ExecutionResult
		err := rows.Scan(&result.ID, &result.TaskID, &result.LeaseID, &result.HolderID, &result.Status,
			&result.ResultData, &result.ErrorMessage, &result.StartedAt, &result.CompletedAt, &result.DurationMs)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}
	return results, nil
}

func (r *Repository) CreateReleaseRecord(record *model.ReleaseRecord) error {
	query := `
	INSERT INTO release_records (id, task_id, lease_id, holder_id, released_at, release_type, reason, preempted_by)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, record.ID, record.TaskID, record.LeaseID, record.HolderID,
		record.ReleasedAt, record.ReleaseType, record.Reason, record.PreemptedBy)
	return err
}

func (r *Repository) CreateTimelineEvent(event *model.TimelineEvent) error {
	query := `
	INSERT INTO timeline_events (id, task_id, lease_id, event_type, holder_id, message, details, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, event.ID, event.TaskID, event.LeaseID, event.EventType,
		event.HolderID, event.Message, event.Details, event.CreatedAt)
	return err
}

func (r *Repository) GetTaskTimeline(taskID string) ([]model.TimelineEvent, error) {
	query := `
	SELECT id, task_id, lease_id, event_type, holder_id, message, details, created_at
	FROM timeline_events WHERE task_id = ? ORDER BY created_at ASC
	`
	rows, err := r.DB.Query(query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []model.TimelineEvent
	for rows.Next() {
		var event model.TimelineEvent
		err := rows.Scan(&event.ID, &event.TaskID, &event.LeaseID, &event.EventType,
			&event.HolderID, &event.Message, &event.Details, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (r *Repository) GetRecentTimelineEvents(limit int) ([]model.TimelineEvent, error) {
	query := `
	SELECT id, task_id, lease_id, event_type, holder_id, message, details, created_at
	FROM timeline_events ORDER BY created_at DESC LIMIT ?
	`
	rows, err := r.DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []model.TimelineEvent
	for rows.Next() {
		var event model.TimelineEvent
		err := rows.Scan(&event.ID, &event.TaskID, &event.LeaseID, &event.EventType,
			&event.HolderID, &event.Message, &event.Details, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (r *Repository) CountTasksByStatus(status model.TaskStatus) (int, error) {
	query := `SELECT COUNT(*) FROM tasks WHERE status = ?`
	var count int
	err := r.DB.QueryRow(query, status).Scan(&count)
	return count, err
}

func (r *Repository) CountAllTasks() (int, error) {
	query := `SELECT COUNT(*) FROM tasks`
	var count int
	err := r.DB.QueryRow(query).Scan(&count)
	return count, err
}

func (r *Repository) CountActiveLeases() (int, error) {
	query := `SELECT COUNT(*) FROM leases WHERE is_active = 1`
	var count int
	err := r.DB.QueryRow(query).Scan(&count)
	return count, err
}

func (r *Repository) BeginTx() (*sql.Tx, error) {
	return r.DB.Begin()
}
