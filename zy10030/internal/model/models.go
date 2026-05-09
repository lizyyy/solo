package model

import (
	"encoding/json"
	"time"
)

type GrayRelease struct {
	ID             int64           `db:"id" json:"id"`
	ServiceName    string          `db:"service_name" json:"service_name"`
	Version        string          `db:"version" json:"version"`
	Description    string          `db:"description" json:"description"`
	Strategy       string          `db:"strategy" json:"strategy"`
	StrategyConfig json.RawMessage `db:"strategy_config" json:"strategy_config"`
	Status         string          `db:"status" json:"status"`
	CreatedBy      string          `db:"created_by" json:"created_by"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time       `db:"updated_at" json:"updated_at"`
	StartedAt      *time.Time      `db:"started_at" json:"started_at"`
	CompletedAt    *time.Time      `db:"completed_at" json:"completed_at"`
}

type GrayInstance struct {
	ID           int64      `db:"id" json:"id"`
	ReleaseID    int64      `db:"release_id" json:"release_id"`
	InstanceID   string     `db:"instance_id" json:"instance_id"`
	Host         string     `db:"host" json:"host"`
	Port         int        `db:"port" json:"port"`
	Version      string     `db:"version" json:"version"`
	Status       string     `db:"status" json:"status"`
	TrafficWeight int       `db:"traffic_weight" json:"traffic_weight"`
	AssignedAt   *time.Time `db:"assigned_at" json:"assigned_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type RollbackRecord struct {
	ID          int64           `db:"id" json:"id"`
	ReleaseID   int64           `db:"release_id" json:"release_id"`
	TriggerType string          `db:"trigger_type" json:"trigger_type"`
	TriggerBy   string          `db:"trigger_by" json:"trigger_by"`
	Reason      string          `db:"reason" json:"reason"`
	Status      string          `db:"status" json:"status"`
	StartedAt   time.Time       `db:"started_at" json:"started_at"`
	CompletedAt *time.Time      `db:"completed_at" json:"completed_at"`
	FailedSteps json.RawMessage `db:"failed_steps" json:"failed_steps"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
}

type RollbackStep struct {
	ID            int64           `db:"id" json:"id"`
	RollbackID    int64           `db:"rollback_id" json:"rollback_id"`
	StepIndex     int             `db:"step_index" json:"step_index"`
	StepType      string          `db:"step_type" json:"step_type"`
	TargetInstance string         `db:"target_instance" json:"target_instance"`
	Action        string          `db:"action" json:"action"`
	Params        json.RawMessage `db:"params" json:"params"`
	Status        string          `db:"status" json:"status"`
	RetryCount    int             `db:"retry_count" json:"retry_count"`
	MaxRetries    int             `db:"max_retries" json:"max_retries"`
	StartedAt     *time.Time      `db:"started_at" json:"started_at"`
	CompletedAt   *time.Time      `db:"completed_at" json:"completed_at"`
	ErrorMessage  string          `db:"error_message" json:"error_message"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
}

type TraceSpan struct {
	ID              int64           `db:"id" json:"id"`
	TraceID         string          `db:"trace_id" json:"trace_id"`
	SpanID          string          `db:"span_id" json:"span_id"`
	ParentSpanID    string          `db:"parent_span_id" json:"parent_span_id"`
	ServiceName     string          `db:"service_name" json:"service_name"`
	OperationName   string          `db:"operation_name" json:"operation_name"`
	StartTime       time.Time       `db:"start_time" json:"start_time"`
	EndTime         *time.Time      `db:"end_time" json:"end_time"`
	DurationMs      int64           `db:"duration_ms" json:"duration_ms"`
	Status          string          `db:"status" json:"status"`
	HTTPMethod      string          `db:"http_method" json:"http_method"`
	HTTPURL         string          `db:"http_url" json:"http_url"`
	HTTPStatusCode  int             `db:"http_status_code" json:"http_status_code"`
	DBStatement     string          `db:"db_statement" json:"db_statement"`
	DBTable         string          `db:"db_table" json:"db_table"`
	MessageTopic    string          `db:"message_topic" json:"message_topic"`
	MessagePartition int            `db:"message_partition" json:"message_partition"`
	MessageOffset   int64           `db:"message_offset" json:"message_offset"`
	Attributes      json.RawMessage `db:"attributes" json:"attributes"`
	Events          json.RawMessage `db:"events" json:"events"`
	CreatedAt       time.Time       `db:"created_at" json:"created_at"`
}

type MessageDedupRecord struct {
	ID            int64      `db:"id" json:"id"`
	MessageID     string     `db:"message_id" json:"message_id"`
	Topic         string     `db:"topic" json:"topic"`
	Partition     int        `db:"partition" json:"partition"`
	Offset        int64      `db:"offset" json:"offset"`
	ConsumerGroup string     `db:"consumer_group" json:"consumer_group"`
	Status        string     `db:"status" json:"status"`
	ProcessedAt   *time.Time `db:"processed_at" json:"processed_at"`
	ErrorMessage  string     `db:"error_message" json:"error_message"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

type IncidentReport struct {
	ID               int64           `db:"id" json:"id"`
	ReportID         string          `db:"report_id" json:"report_id"`
	Title            string          `db:"title" json:"title"`
	Severity         string          `db:"severity" json:"severity"`
	Category         string          `db:"category" json:"category"`
	Status           string          `db:"status" json:"status"`
	TriggerReleaseID *int64          `db:"trigger_release_id" json:"trigger_release_id"`
	TriggerRollbackID *int64         `db:"trigger_rollback_id" json:"trigger_rollback_id"`
	AffectedServices []string        `db:"affected_services" json:"affected_services"`
	RootCause        string          `db:"root_cause" json:"root_cause"`
	ImpactAnalysis   string          `db:"impact_analysis" json:"impact_analysis"`
	ResolutionSteps  string          `db:"resolution_steps" json:"resolution_steps"`
	Timeline         json.RawMessage `db:"timeline" json:"timeline"`
	RelatedTraces    []string        `db:"related_traces" json:"related_traces"`
	ExportFormat     string          `db:"export_format" json:"export_format"`
	ExportedAt       *time.Time      `db:"exported_at" json:"exported_at"`
	FilePath         string          `db:"file_path" json:"file_path"`
	ReportedBy       string          `db:"reported_by" json:"reported_by"`
	CreatedAt        time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time       `db:"updated_at" json:"updated_at"`
	ResolvedAt       *time.Time      `db:"resolved_at" json:"resolved_at"`
}

type FaultInjectionConfig struct {
	ID             int64           `db:"id" json:"id"`
	Name           string          `db:"name" json:"name"`
	FaultType      string          `db:"fault_type" json:"fault_type"`
	TargetService  string          `db:"target_service" json:"target_service"`
	Enabled        bool            `db:"enabled" json:"enabled"`
	Config         json.RawMessage `db:"config" json:"config"`
	Probability    float64         `db:"probability" json:"probability"`
	DurationSeconds int            `db:"duration_seconds" json:"duration_seconds"`
	CreatedBy      string          `db:"created_by" json:"created_by"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time       `db:"updated_at" json:"updated_at"`
}

type RequestMetrics struct {
	ID             int64     `db:"id" json:"id"`
	ServiceName    string    `db:"service_name" json:"service_name"`
	Endpoint       string    `db:"endpoint" json:"endpoint"`
	HTTPMethod     string    `db:"http_method" json:"http_method"`
	Timestamp      time.Time `db:"timestamp" json:"timestamp"`
	RequestCount   int       `db:"request_count" json:"request_count"`
	ErrorCount     int       `db:"error_count" json:"error_count"`
	P50LatencyMs   int       `db:"p50_latency_ms" json:"p50_latency_ms"`
	P95LatencyMs   int       `db:"p95_latency_ms" json:"p95_latency_ms"`
	P99LatencyMs   int       `db:"p99_latency_ms" json:"p99_latency_ms"`
	AvgLatencyMs   float64   `db:"avg_latency_ms" json:"avg_latency_ms"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type SagaTransaction struct {
	ID              int64           `db:"id" json:"id"`
	SagaID          string          `db:"saga_id" json:"saga_id"`
	SagaName        string          `db:"saga_name" json:"saga_name"`
	Status          string          `db:"status" json:"status"`
	CurrentStep     int             `db:"current_step" json:"current_step"`
	TotalSteps      int             `db:"total_steps" json:"total_steps"`
	CompensatingMode bool          `db:"compensating_mode" json:"compensating_mode"`
	Context         json.RawMessage `db:"context" json:"context"`
	StartedAt       time.Time       `db:"started_at" json:"started_at"`
	UpdatedAt       time.Time       `db:"updated_at" json:"updated_at"`
	CompletedAt     *time.Time      `db:"completed_at" json:"completed_at"`
}

type SagaStep struct {
	ID                int64           `db:"id" json:"id"`
	SagaID            string          `db:"saga_id" json:"saga_id"`
	StepIndex         int             `db:"step_index" json:"step_index"`
	StepName          string          `db:"step_name" json:"step_name"`
	Status            string          `db:"status" json:"status"`
	ActionParams      json.RawMessage `db:"action_params" json:"action_params"`
	CompensationParams json.RawMessage `db:"compensation_params" json:"compensation_params"`
	ErrorMessage      string          `db:"error_message" json:"error_message"`
	ExecutedAt        *time.Time      `db:"executed_at" json:"executed_at"`
	CompensatedAt     *time.Time      `db:"compensated_at" json:"compensated_at"`
	CreatedAt         time.Time       `db:"created_at" json:"created_at"`
}

type GrayEvent struct {
	EventType   string          `json:"event_type"`
	ReleaseID   int64           `json:"release_id"`
	ServiceName string          `json:"service_name"`
	Version     string          `json:"version"`
	InstanceID  string          `json:"instance_id"`
	Timestamp   time.Time       `json:"timestamp"`
	Payload     json.RawMessage `json:"payload"`
}

