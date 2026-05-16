package storage

import (
	"database/sql"
	"time"

	"gpu-queue-api/models"

	"github.com/google/uuid"
)

func (s *SQLiteStore) GetGPUResource(model string) (*models.GPUResource, error) {
	var res models.GPUResource
	err := s.db.QueryRow(`
		SELECT id, model, total_count, used_count, created_at, updated_at
		FROM gpu_resources WHERE model = ?
	`, model).Scan(&res.ID, &res.Model, &res.TotalCount, &res.UsedCount, &res.CreatedAt, &res.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (s *SQLiteStore) ListGPUResources() ([]models.GPUResource, error) {
	rows, err := s.db.Query(`
		SELECT id, model, total_count, used_count, created_at, updated_at
		FROM gpu_resources ORDER BY model
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resources []models.GPUResource
	for rows.Next() {
		var res models.GPUResource
		err := rows.Scan(&res.ID, &res.Model, &res.TotalCount, &res.UsedCount, &res.CreatedAt, &res.UpdatedAt)
		if err != nil {
			return nil, err
		}
		resources = append(resources, res)
	}
	return resources, nil
}

func (s *SQLiteStore) UpdateGPUResource(res *models.GPUResource) error {
	res.UpdatedAt = time.Now()
	_, err := s.db.Exec(`
		UPDATE gpu_resources SET total_count=?, used_count=?, updated_at=? WHERE id=?
	`, res.TotalCount, res.UsedCount, res.UpdatedAt, res.ID)
	return err
}

func (s *SQLiteStore) CreateQueueRecord(record *models.QueueRecord) error {
	record.ID = uuid.New().String()
	record.EnqueuedAt = time.Now()
	_, err := s.db.Exec(`
		INSERT INTO queue_records (id, job_id, position, queue_status, enqueued_at)
		VALUES (?, ?, ?, ?, ?)
	`, record.ID, record.JobID, record.Position, record.QueueStatus, record.EnqueuedAt)
	return err
}

func (s *SQLiteStore) UpdateQueueRecord(record *models.QueueRecord) error {
	_, err := s.db.Exec(`
		UPDATE queue_records SET position=?, queue_status=?, dequeued_at=? WHERE job_id=?
	`, record.Position, record.QueueStatus, record.DequeuedAt, record.JobID)
	return err
}

func (s *SQLiteStore) GetQueueRecordByJobID(jobID string) (*models.QueueRecord, error) {
	var record models.QueueRecord
	var dequeuedAt sql.NullTime
	err := s.db.QueryRow(`
		SELECT id, job_id, position, queue_status, enqueued_at, dequeued_at
		FROM queue_records WHERE job_id = ?
	`, jobID).Scan(&record.ID, &record.JobID, &record.Position, &record.QueueStatus, &record.EnqueuedAt, &dequeuedAt)
	if err != nil {
		return nil, err
	}
	if dequeuedAt.Valid {
		record.DequeuedAt = &dequeuedAt.Time
	}
	return &record, nil
}

func (s *SQLiteStore) GetQueuedJobs(gpuModel string) ([]models.Job, error) {
	rows, err := s.db.Query(`
		SELECT j.id, j.name, j.gpu_model, j.gpu_count, j.user_id, j.priority, j.duration_min, j.status, j.created_at, j.updated_at, j.started_at, j.ended_at, j.request_id
		FROM jobs j
		INNER JOIN queue_records qr ON j.id = qr.job_id
		WHERE j.status = ? AND j.gpu_model = ? AND qr.queue_status = 'queued'
		ORDER BY j.priority DESC, j.created_at ASC
	`, models.StatusQueued, gpuModel)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []models.Job
	for rows.Next() {
		var job models.Job
		var startedAt, endedAt sql.NullTime
		err := rows.Scan(&job.ID, &job.Name, &job.GPUModel, &job.GPUCount, &job.UserID, &job.Priority, &job.DurationMin, &job.Status, &job.CreatedAt, &job.UpdatedAt, &startedAt, &endedAt, &job.RequestID)
		if err != nil {
			return nil, err
		}
		if startedAt.Valid {
			job.StartedAt = &startedAt.Time
		}
		if endedAt.Valid {
			job.EndedAt = &endedAt.Time
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func (s *SQLiteStore) CreateReleaseEvent(event *models.ReleaseEvent) error {
	event.ID = uuid.New().String()
	event.ReleasedAt = time.Now()
	_, err := s.db.Exec(`
		INSERT INTO release_events (id, job_id, gpu_model, gpu_count, release_type, released_at, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, event.ID, event.JobID, event.GPUModel, event.GPUCount, event.ReleaseType, event.ReleasedAt, event.Remark)
	return err
}

func (s *SQLiteStore) ListReleaseEvents(jobID string, limit int) ([]models.ReleaseEvent, error) {
	query := `
		SELECT id, job_id, gpu_model, gpu_count, release_type, released_at, remark
		FROM release_events WHERE 1=1
	`
	args := []interface{}{}

	if jobID != "" {
		query += " AND job_id = ?"
		args = append(args, jobID)
	}

	query += " ORDER BY released_at DESC"
	if limit > 0 {
		query += " LIMIT ?"
		args = append(args, limit)
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.ReleaseEvent
	for rows.Next() {
		var event models.ReleaseEvent
		err := rows.Scan(&event.ID, &event.JobID, &event.GPUModel, &event.GPUCount, &event.ReleaseType, &event.ReleasedAt, &event.Remark)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (s *SQLiteStore) CreateExceptionLog(log *models.ExceptionLog) error {
	log.ID = uuid.New().String()
	log.OccurredAt = time.Now()
	_, err := s.db.Exec(`
		INSERT INTO exception_logs (id, request_id, operation, raw_input, error_type, error_message, conclusion, occurred_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, log.ID, log.RequestID, log.Operation, log.RawInput, log.ErrorType, log.ErrorMessage, log.Conclusion, log.OccurredAt)
	return err
}

func (s *SQLiteStore) ListExceptionLogs(requestID string, offset, limit int) ([]models.ExceptionLog, int, error) {
	query := `
		SELECT id, request_id, operation, raw_input, error_type, error_message, conclusion, occurred_at
		FROM exception_logs WHERE 1=1
	`
	countQuery := "SELECT COUNT(*) FROM exception_logs WHERE 1=1"
	args := []interface{}{}
	countArgs := []interface{}{}

	if requestID != "" {
		query += " AND request_id = ?"
		countQuery += " AND request_id = ?"
		args = append(args, requestID)
		countArgs = append(countArgs, requestID)
	}

	query += " ORDER BY occurred_at DESC"
	if limit > 0 {
		query += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}

	var total int
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.ExceptionLog
	for rows.Next() {
		var log models.ExceptionLog
		err := rows.Scan(&log.ID, &log.RequestID, &log.Operation, &log.RawInput, &log.ErrorType, &log.ErrorMessage, &log.Conclusion, &log.OccurredAt)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}
	return logs, total, nil
}

func (s *SQLiteStore) GetRunningJobs() ([]models.Job, error) {
	rows, err := s.db.Query(`
		SELECT id, name, gpu_model, gpu_count, user_id, priority, duration_min, status, created_at, updated_at, started_at, ended_at, request_id
		FROM jobs WHERE status = ?
	`, models.StatusRunning)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []models.Job
	for rows.Next() {
		var job models.Job
		var startedAt, endedAt sql.NullTime
		err := rows.Scan(&job.ID, &job.Name, &job.GPUModel, &job.GPUCount, &job.UserID, &job.Priority, &job.DurationMin, &job.Status, &job.CreatedAt, &job.UpdatedAt, &startedAt, &endedAt, &job.RequestID)
		if err != nil {
			return nil, err
		}
		if startedAt.Valid {
			job.StartedAt = &startedAt.Time
		}
		if endedAt.Valid {
			job.EndedAt = &endedAt.Time
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}
