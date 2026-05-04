package models

import "time"

type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusRunning    JobStatus = "running"
	JobStatusSucceeded  JobStatus = "succeeded"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusRetrying   JobStatus = "retrying"
	JobStatusDeadLetter JobStatus = "dead_letter"
)

type Job struct {
	ID              string            `json:"id"`
	Type            string            `json:"type"`
	Priority        int               `json:"priority"`
	Status          JobStatus         `json:"status"`
	Payload         map[string]any    `json:"payload"`
	EnqueueTime     time.Time         `json:"enqueue_time"`
	StartTime       *time.Time        `json:"start_time,omitempty"`
	EndTime         *time.Time        `json:"end_time,omitempty"`
	ExecutionTimeMs int64             `json:"execution_time_ms,omitempty"`
	WaitTimeMs      int64             `json:"wait_time_ms,omitempty"`
	RetryCount      int               `json:"retry_count"`
	MaxRetries      int               `json:"max_retries"`
	TimeoutMs       int64             `json:"timeout_ms"`
	FailReason      string            `json:"fail_reason,omitempty"`
	WorkerID        string            `json:"worker_id,omitempty"`
	QueueName       string            `json:"queue_name,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

type JobStatistics struct {
	TotalJobs            int64
	ByType               map[string]int64
	ByStatus             map[JobStatus]int64
	ByPriority           map[int]int64
	AvgExecutionTimeMs   float64
	P50ExecutionTimeMs   float64
	P95ExecutionTimeMs   float64
	P99ExecutionTimeMs   float64
	AvgWaitTimeMs        float64
	P50WaitTimeMs        float64
	P95WaitTimeMs        float64
	P99WaitTimeMs        float64
	AvgRetryCount        float64
	MaxRetryCount        int
	DeadLetterCount      int64
	TimeoutCount         int64
	SuccessRate          float64
	ThroughputPerSecond  float64
}
