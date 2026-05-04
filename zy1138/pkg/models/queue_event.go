package models

import "time"

type EventType string

const (
	EventTypeEnqueue   EventType = "enqueue"
	EventTypeDequeue   EventType = "dequeue"
	EventTypeStart     EventType = "start"
	EventTypeComplete  EventType = "complete"
	EventTypeFail      EventType = "fail"
	EventTypeRetry     EventType = "retry"
	EventTypeTimeout   EventType = "timeout"
	EventTypeDeadLetter EventType = "dead_letter"
)

type QueueEvent struct {
	ID            string            `json:"id"`
	JobID         string            `json:"job_id"`
	WorkerID      string            `json:"worker_id,omitempty"`
	EventType     EventType         `json:"event_type"`
	Timestamp     time.Time         `json:"timestamp"`
	QueueName     string            `json:"queue_name"`
	JobType       string            `json:"job_type"`
	Priority      int               `json:"priority"`
	RetryCount    int               `json:"retry_count,omitempty"`
	ErrorMessage  string            `json:"error_message,omitempty"`
	ExecutionTime int64             `json:"execution_time_ms,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type BacklogSnapshot struct {
	Timestamp      time.Time
	QueueName      string
	PendingCount   int64
	RunningCount   int64
	RetryCount     int64
	DeadLetterCount int64
	ByPriority     map[int]int64
	ByJobType      map[string]int64
}

type RetryEvent struct {
	JobID         string
	OriginalFail  time.Time
	RetrySchedule time.Time
	RetryCount    int
	FailReason    string
	WorkerID      string
}

type PriorityInversionIndicator struct {
	Timestamp     time.Time
	HighPriorityJobID string
	LowPriorityJobID  string
	HighPriorityEnqueueTime time.Time
	LowPriorityStartTime    time.Time
	WaitTimeDiffMs int64
}
