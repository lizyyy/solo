package models

import "time"

type WorkerStatus string

const (
	WorkerStatusIdle    WorkerStatus = "idle"
	WorkerStatusBusy    WorkerStatus = "busy"
	WorkerStatusBlocked WorkerStatus = "blocked"
	WorkerStatusError   WorkerStatus = "error"
)

type Worker struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	QueueTypes   []string          `json:"queue_types"`
	Concurrency  int               `json:"concurrency"`
	BatchSize    int               `json:"batch_size"`
	PollInterval time.Duration     `json:"poll_interval"`
	Status       WorkerStatus      `json:"status"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type WorkerStatistics struct {
	TotalWorkers        int
	ByStatus            map[WorkerStatus]int
	ByQueueType         map[string]int
	AvgConcurrency      float64
	TotalConcurrency    int
	AvgBatchSize        float64
	AvgPollIntervalMs   float64
	IdleWorkers         int
	BusyWorkers         int
	BlockedWorkers      int
}

type WorkerMetrics struct {
	WorkerID          string
	StartTime         time.Time
	EndTime           time.Time
	ActiveTimeMs      int64
	IdleTimeMs        int64
	JobsProcessed     int64
	JobsSucceeded     int64
	JobsFailed        int64
	AvgExecutionTimeMs float64
	UtilizationRate   float64
}
