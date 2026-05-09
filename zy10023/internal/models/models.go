package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal JSONB value")
	}
	return json.Unmarshal(bytes, j)
}

type APIDefinition struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Method      string         `gorm:"size:10;not null" json:"method"`
	Path        string         `gorm:"size:500;not null" json:"path"`
	Description string         `gorm:"type:text" json:"description"`
	Version     string         `gorm:"size:50;default:v1" json:"version"`
	RequestSchema JSONB        `gorm:"type:jsonb" json:"request_schema"`
	ResponseSchema JSONB       `gorm:"type:jsonb" json:"response_schema"`
	Headers     JSONB          `gorm:"type:jsonb" json:"headers"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	MockResponses []MockResponse `gorm:"foreignKey:APIDefinitionID" json:"mock_responses,omitempty"`
	TrafficTests  []TrafficTest  `gorm:"foreignKey:APIDefinitionID" json:"traffic_tests,omitempty"`
}

type MockResponse struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	APIDefinitionID uint          `gorm:"index;not null" json:"api_definition_id"`
	Name           string         `gorm:"size:255;not null" json:"name"`
	StatusCode     int            `gorm:"default:200" json:"status_code"`
	ResponseBody   JSONB          `gorm:"type:jsonb" json:"response_body"`
	Headers        JSONB          `gorm:"type:jsonb" json:"headers"`
	DelayMs        int            `gorm:"default:0" json:"delay_ms"`
	IsDefault      bool           `gorm:"default:false" json:"is_default"`
	FaultInjection *FaultInjectionConfig `gorm:"embedded;embeddedPrefix:fault_" json:"fault_injection,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type FaultInjectionConfig struct {
	Enabled         bool    `gorm:"default:false" json:"enabled"`
	TimeoutMs       int     `gorm:"default:0" json:"timeout_ms"`
	ErrorRate       float64 `gorm:"default:0" json:"error_rate"`
	ErrorStatusCode int     `gorm:"default:500" json:"error_status_code"`
	DisconnectRate  float64 `gorm:"default:0" json:"disconnect_rate"`
	RetryCount      int     `gorm:"default:0" json:"retry_count"`
}

type TrafficTest struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	APIDefinitionID   uint           `gorm:"index;not null" json:"api_definition_id"`
	Name              string         `gorm:"size:255;not null" json:"name"`
	Description       string         `gorm:"type:text" json:"description"`
	ConcurrentUsers   int            `gorm:"default:10" json:"concurrent_users"`
	RequestsPerUser   int            `gorm:"default:100" json:"requests_per_user"`
	DurationSeconds   int            `gorm:"default:60" json:"duration_seconds"`
	Method            string         `gorm:"size:10;not null" json:"method"`
	TargetURL         string         `gorm:"size:500;not null" json:"target_url"`
	RequestBody       JSONB          `gorm:"type:jsonb" json:"request_body"`
	Headers           JSONB          `gorm:"type:jsonb" json:"headers"`
	TimeoutMs         int            `gorm:"default:30000" json:"timeout_ms"`
	RetryOnFailure    bool           `gorm:"default:false" json:"retry_on_failure"`
	MaxRetries        int            `gorm:"default:3" json:"max_retries"`
	Status            string         `gorm:"size:50;default:pending" json:"status"`
	StartTime         *time.Time     `json:"start_time"`
	EndTime           *time.Time     `json:"end_time"`
	TotalRequests     int            `gorm:"default:0" json:"total_requests"`
	SuccessCount      int            `gorm:"default:0" json:"success_count"`
	FailureCount      int            `gorm:"default:0" json:"failure_count"`
	AvgResponseTimeMs float64        `gorm:"default:0" json:"avg_response_time_ms"`
	P95ResponseTimeMs float64        `gorm:"default:0" json:"p95_response_time_ms"`
	P99ResponseTimeMs float64        `gorm:"default:0" json:"p99_response_time_ms"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	TrafficTestResults []TrafficTestResult `gorm:"foreignKey:TrafficTestID" json:"results,omitempty"`
}

type TrafficTestResult struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	TrafficTestID     uint       `gorm:"index;not null" json:"traffic_test_id"`
	RequestNumber     int        `json:"request_number"`
	StatusCode        int        `json:"status_code"`
	ResponseTimeMs    int64      `json:"response_time_ms"`
	IsSuccess         bool       `json:"is_success"`
	ErrorMessage      string     `gorm:"type:text" json:"error_message"`
	RequestURL        string     `gorm:"size:500" json:"request_url"`
	RequestBody       JSONB      `gorm:"type:jsonb" json:"request_body"`
	ResponseBody      JSONB      `gorm:"type:jsonb" json:"response_body"`
	TraceID           string     `gorm:"size:255" json:"trace_id"`
	Timestamp         time.Time  `json:"timestamp"`
	RetryAttempt      int        `gorm:"default:0" json:"retry_attempt"`
}

type MessageQueueSimulation struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"size:255;not null" json:"name"`
	Topic            string         `gorm:"size:255;not null" json:"topic"`
	ConsumerGroup    string         `gorm:"size:255" json:"consumer_group"`
	MessageContent   JSONB          `gorm:"type:jsonb" json:"message_content"`
	TotalMessages    int            `gorm:"default:100" json:"total_messages"`
	DuplicateRate    float64        `gorm:"default:0" json:"duplicate_rate"`
	DelayMs          int            `gorm:"default:0" json:"delay_ms"`
	ErrorRate        float64        `gorm:"default:0" json:"error_rate"`
	Status           string         `gorm:"size:50;default:pending" json:"status"`
	StartTime        *time.Time     `json:"start_time"`
	EndTime          *time.Time     `json:"end_time"`
	ConsumedCount    int            `gorm:"default:0" json:"consumed_count"`
	FailedCount      int            `gorm:"default:0" json:"failed_count"`
	DuplicateCount   int            `gorm:"default:0" json:"duplicate_count"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type TraceRecord struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TraceID       string    `gorm:"size:255;index;not null" json:"trace_id"`
	SpanID        string    `gorm:"size:255;not null" json:"span_id"`
	ParentSpanID  string    `gorm:"size:255" json:"parent_span_id"`
	ServiceName   string    `gorm:"size:255;not null" json:"service_name"`
	OperationName string    `gorm:"size:500;not null" json:"operation_name"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	DurationMs    int64     `json:"duration_ms"`
	StatusCode    string    `gorm:"size:50" json:"status_code"`
	Attributes    JSONB     `gorm:"type:jsonb" json:"attributes"`
	Logs          JSONB     `gorm:"type:jsonb" json:"logs"`
	HasError      bool      `gorm:"default:false" json:"has_error"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
}

type IssueReport struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Title            string         `gorm:"size:500;not null" json:"title"`
	Description      string         `gorm:"type:text" json:"description"`
	Severity         string         `gorm:"size:50;default:medium" json:"severity"`
	Category         string         `gorm:"size:100" json:"category"`
	Status           string         `gorm:"size:50;default:open" json:"status"`
	SourceType       string         `gorm:"size:50" json:"source_type"`
	SourceID         uint           `json:"source_id"`
	AffectedAPIs     JSONB          `gorm:"type:jsonb" json:"affected_apis"`
	TraceIDs         JSONB          `gorm:"type:jsonb" json:"trace_ids"`
	EvidenceData     JSONB          `gorm:"type:jsonb" json:"evidence_data"`
	ReportedBy       string         `gorm:"size:255" json:"reported_by"`
	AssignedTo       string         `gorm:"size:255" json:"assigned_to"`
	ResolutionNotes  string         `gorm:"type:text" json:"resolution_notes"`
	ResolvedAt       *time.Time     `json:"resolved_at"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type ConsistencyCheck struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	APIDefinitionID uint           `gorm:"index;not null" json:"api_definition_id"`
	CheckType       string         `gorm:"size:100;not null" json:"check_type"`
	Description     string         `gorm:"type:text" json:"description"`
	IsConsistent    bool           `gorm:"default:true" json:"is_consistent"`
	Issues          JSONB          `gorm:"type:jsonb" json:"issues"`
	CheckedAt       time.Time      `json:"checked_at"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}
