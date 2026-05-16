package models

import (
	"time"
)

type JobStatus string

const (
	StatusPending   JobStatus = "pending"
	StatusQueued    JobStatus = "queued"
	StatusRunning   JobStatus = "running"
	StatusCompleted JobStatus = "completed"
	StatusFailed    JobStatus = "failed"
	StatusCancelled JobStatus = "cancelled"
	StatusTimeout   JobStatus = "timeout"
)

type Job struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	GPUModel    string    `json:"gpu_model" db:"gpu_model"`
	GPUCount    int       `json:"gpu_count" db:"gpu_count"`
	UserID      string    `json:"user_id" db:"user_id"`
	Priority    int       `json:"priority" db:"priority"`
	DurationMin int       `json:"duration_min" db:"duration_min"`
	Status      JobStatus `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	StartedAt   *time.Time `json:"started_at,omitempty" db:"started_at"`
	EndedAt     *time.Time `json:"ended_at,omitempty" db:"ended_at"`
	RequestID   string    `json:"request_id" db:"request_id"`
}

type GPUResource struct {
	ID         string    `json:"id" db:"id"`
	Model      string    `json:"model" db:"model"`
	TotalCount int       `json:"total_count" db:"total_count"`
	UsedCount  int       `json:"used_count" db:"used_count"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type ReleaseEvent struct {
	ID          string    `json:"id" db:"id"`
	JobID       string    `json:"job_id" db:"job_id"`
	GPUModel    string    `json:"gpu_model" db:"gpu_model"`
	GPUCount    int       `json:"gpu_count" db:"gpu_count"`
	ReleaseType string    `json:"release_type" db:"release_type"`
	ReleasedAt  time.Time `json:"released_at" db:"released_at"`
	Remark      string    `json:"remark,omitempty" db:"remark"`
}

type QueueRecord struct {
	ID           string    `json:"id" db:"id"`
	JobID        string    `json:"job_id" db:"job_id"`
	Position     int       `json:"position" db:"position"`
	QueueStatus  string    `json:"queue_status" db:"queue_status"`
	EnqueuedAt   time.Time `json:"enqueued_at" db:"enqueued_at"`
	DequeuedAt   *time.Time `json:"dequeued_at,omitempty" db:"dequeued_at"`
}

type ExceptionLog struct {
	ID            string    `json:"id" db:"id"`
	RequestID     string    `json:"request_id" db:"request_id"`
	Operation     string    `json:"operation" db:"operation"`
	RawInput      string    `json:"raw_input" db:"raw_input"`
	ErrorType     string    `json:"error_type" db:"error_type"`
	ErrorMessage  string    `json:"error_message" db:"error_message"`
	Conclusion    string    `json:"conclusion" db:"conclusion"`
	OccurredAt    time.Time `json:"occurred_at" db:"occurred_at"`
}

type QueueSummaryItem struct {
	GPUModel      string `json:"gpu_model"`
	TotalCapacity int    `json:"total_capacity"`
	UsedCapacity  int    `json:"used_capacity"`
	QueuedJobs    int    `json:"queued_jobs"`
	RunningJobs   int    `json:"running_jobs"`
	AvgWaitTime   string `json:"avg_wait_time"`
}

type QueueSummary struct {
	GeneratedAt time.Time          `json:"generated_at"`
	Items       []QueueSummaryItem `json:"items"`
}
