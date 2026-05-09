package chaos

import (
	"time"
)

type ChaosType string

const (
	ChaosTypeHighConcurrency ChaosType = "high_concurrency"
	ChaosTypeTimeout         ChaosType = "timeout"
	ChaosTypeNetworkDrop     ChaosType = "network_drop"
	ChaosTypeDuplicateRequest ChaosType = "duplicate_request"
	ChaosTypeDuplicateMessage ChaosType = "duplicate_message"
	ChaosTypeSlowQuery       ChaosType = "slow_query"
	ChaosTypeConnectionDrop  ChaosType = "connection_drop"
	ChaosTypeLockContention  ChaosType = "lock_contention"
)

type ChaosStatus string

const (
	ChaosStatusPending   ChaosStatus = "pending"
	ChaosStatusRunning   ChaosStatus = "running"
	ChaosStatusCompleted ChaosStatus = "completed"
	ChaosStatusFailed    ChaosStatus = "failed"
	ChaosStatusStopped   ChaosStatus = "stopped"
)

type ChaosExperiment struct {
	ID             string
	Name           string
	Type           ChaosType
	Target         string
	Config         ExperimentConfig
	Status         ChaosStatus
	StartTime      time.Time
	EndTime        time.Time
	ErrorCount     int
	SuccessCount   int
	TotalRequests  int
	Metadata       map[string]interface{}
	CreatedBy      string
	TraceID        string
}

type ExperimentConfig struct {
	Duration              time.Duration
	ConcurrentUsers       int
	TimeoutMs             int
	NetworkDropRate       float64
	DuplicateRate         float64
	SlowQueryDelayMs      int
	LockHoldTimeMs        int
	QueryPattern          string
	RetryCount            int
	RequestsPerSecond     int
	PayloadSizeBytes      int
	MessageQueueTarget    string
	DatabaseTarget        string
}

type ChaosResult struct {
	ExperimentID   string
	TotalRequests  int
	SuccessCount   int
	ErrorCount     int
	LatencyStats   LatencyStats
	ErrorDetails   []ErrorDetail
	StartTimestamp time.Time
	EndTimestamp   time.Time
}

type LatencyStats struct {
	Min    time.Duration
	Max    time.Duration
	Avg    time.Duration
	P50    time.Duration
	P90    time.Duration
	P95    time.Duration
	P99    time.Duration
}

type ErrorDetail struct {
	Timestamp   time.Time
	Type        string
	Message     string
	RequestID   string
	TraceID     string
	Stacktrace  string
	Context     map[string]interface{}
}

type InjectedError struct {
	Type    string
	Message string
	Delay   time.Duration
}

func (e *InjectedError) Error() string {
	return e.Message
}

type ChaosMetrics struct {
	ExperimentID      string
	ActiveConnections int
	RequestsPerSecond float64
	ErrorsPerSecond   float64
	AvgLatency        time.Duration
	QueueBacklog      int
	Timestamp         time.Time
}
