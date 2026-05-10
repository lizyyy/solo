package chaos

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

type DurationString time.Duration

func (d *DurationString) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		if s == "" {
			*d = 0
			return nil
		}
		parsed, err := time.ParseDuration(s)
		if err != nil {
			return err
		}
		*d = DurationString(parsed)
		return nil
	}

	var n int64
	if err := json.Unmarshal(data, &n); err == nil {
		*d = DurationString(time.Duration(n))
		return nil
	}

	var f float64
	if err := json.Unmarshal(data, &f); err == nil {
		*d = DurationString(time.Duration(f))
		return nil
	}

	return errors.New("invalid duration format")
}

func (d DurationString) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).String())
}

func (d DurationString) Duration() time.Duration {
	return time.Duration(d)
}

func (d DurationString) Seconds() int {
	return int(time.Duration(d).Seconds())
}

func (d DurationString) String() string {
	return time.Duration(d).String()
}

func ParseDuration(s string) (DurationString, error) {
	if s == "" {
		return 0, nil
	}
	s = strings.TrimSpace(s)
	if !strings.ContainsAny(s, "hmsuµn") {
		n, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, err
		}
		return DurationString(time.Duration(n) * time.Second), nil
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, err
	}
	return DurationString(d), nil
}

type ChaosType string

const (
	ChaosTypeHighConcurrency  ChaosType = "high_concurrency"
	ChaosTypeTimeout          ChaosType = "timeout"
	ChaosTypeNetworkDrop      ChaosType = "network_drop"
	ChaosTypeDuplicateRequest ChaosType = "duplicate_request"
	ChaosTypeDuplicateMessage ChaosType = "duplicate_message"
	ChaosTypeSlowQuery        ChaosType = "slow_query"
	ChaosTypeConnectionDrop   ChaosType = "connection_drop"
	ChaosTypeLockContention   ChaosType = "lock_contention"
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
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Type          ChaosType              `json:"type"`
	Target        string                 `json:"target"`
	Config        ExperimentConfig       `json:"config"`
	Status        ChaosStatus            `json:"status"`
	StartTime     time.Time              `json:"start_time"`
	EndTime       time.Time              `json:"end_time"`
	ErrorCount    int64                  `json:"error_count"`
	SuccessCount  int64                  `json:"success_count"`
	TotalRequests int64                  `json:"total_requests"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedBy     string                 `json:"created_by"`
	TraceID       string                 `json:"trace_id"`
}

type ExperimentConfig struct {
	Duration           DurationString `json:"duration"`
	ConcurrentUsers    int            `json:"concurrent_users"`
	TimeoutMs          int            `json:"timeout_ms"`
	NetworkDropRate    float64        `json:"network_drop_rate"`
	DuplicateRate      float64        `json:"duplicate_rate"`
	SlowQueryDelayMs   int            `json:"slow_query_delay_ms"`
	LockHoldTimeMs     int            `json:"lock_hold_time_ms"`
	QueryPattern       string         `json:"query_pattern"`
	RetryCount         int            `json:"retry_count"`
	RequestsPerSecond  int            `json:"requests_per_second"`
	PayloadSizeBytes   int            `json:"payload_size_bytes"`
	MessageQueueTarget string         `json:"message_queue_target"`
	DatabaseTarget     string         `json:"database_target"`
}

type ChaosResult struct {
	ExperimentID   string
	TotalRequests  int64
	SuccessCount   int64
	ErrorCount     int64
	LatencyStats   LatencyStats
	ErrorDetails   []ErrorDetail
	StartTimestamp time.Time
	EndTimestamp   time.Time
}

type LatencyStats struct {
	Min time.Duration
	Max time.Duration
	Avg time.Duration
	P50 time.Duration
	P90 time.Duration
	P95 time.Duration
	P99 time.Duration
}

type ErrorDetail struct {
	Timestamp  time.Time
	Type       string
	Message    string
	RequestID  string
	TraceID    string
	Stacktrace string
	Context    map[string]interface{}
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
