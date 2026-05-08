package types

import "time"

type Order struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Items       []OrderItem       `json:"items"`
	Status      string            `json:"status"`
	TotalAmount int64             `json:"total_amount"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type OrderItem struct {
	ProductID string `json:"product_id"`
	Quantity  int32  `json:"quantity"`
	UnitPrice int64  `json:"unit_price"`
}

type Payment struct {
	ID            string            `json:"id"`
	OrderID       string            `json:"order_id"`
	UserID        string            `json:"user_id"`
	Amount        int64             `json:"amount"`
	Currency      string            `json:"currency"`
	PaymentMethod string            `json:"payment_method"`
	Status        string            `json:"status"`
	TransactionID string            `json:"transaction_id"`
	Metadata      map[string]string `json:"metadata"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

type StockRecord struct {
	ProductID  string `json:"product_id"`
	Available  int32  `json:"available"`
	Reserved   int32  `json:"reserved"`
	Total      int32  `json:"total"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ChaosScenario struct {
	ID            string           `json:"id"`
	Name          string           `json:"name"`
	Description   string           `json:"description"`
	TargetService string           `json:"target_service"`
	TargetMethod  string           `json:"target_method"`
	Type          ChaosType        `json:"type"`
	Config        ChaosConfig      `json:"config"`
	Enabled       bool             `json:"enabled"`
	CreatedAt     time.Time        `json:"created_at"`
}

type ChaosType string

const (
	ChaosTypeTimeout        ChaosType = "timeout"
	ChaosTypeError          ChaosType = "error"
	ChaosTypeNetworkDown    ChaosType = "network_down"
	ChaosTypeSlowResponse   ChaosType = "slow_response"
	ChaosTypeDuplicate      ChaosType = "duplicate"
	ChaosTypeCircuitBreaker ChaosType = "circuit_breaker"
)

type ChaosConfig struct {
	TimeoutMS        int                   `json:"timeout_ms,omitempty"`
	ErrorRate        float64               `json:"error_rate,omitempty"`
	ErrorMessage     string                `json:"error_message,omitempty"`
	DelayMS          int                   `json:"delay_ms,omitempty"`
	DuplicateCount   int                   `json:"duplicate_count,omitempty"`
	Duration         time.Duration         `json:"duration,omitempty"`
	Probability      float64               `json:"probability,omitempty"`
	MaxRetries       int                   `json:"max_retries,omitempty"`
	RetryBackoffMS   int                   `json:"retry_backoff_ms,omitempty"`
}

type TraceRecord struct {
	ID           string            `json:"id"`
	TraceID      string            `json:"trace_id"`
	SpanID       string            `json:"span_id"`
	ParentSpanID string            `json:"parent_span_id,omitempty"`
	Service      string            `json:"service"`
	Method       string            `json:"method"`
	Status       string            `json:"status"`
	StartTime    time.Time         `json:"start_time"`
	EndTime      time.Time         `json:"end_time,omitempty"`
	DurationMS   int64             `json:"duration_ms,omitempty"`
	Attempt      int               `json:"attempt"`
	MaxAttempts  int               `json:"max_attempts"`
	Error        string            `json:"error,omitempty"`
	Metadata     map[string]string `json:"metadata"`
}

type ProblemReport struct {
	ID              string               `json:"id"`
	Title           string               `json:"title"`
	Summary         string               `json:"summary"`
	TraceID         string               `json:"trace_id"`
	ProblemType     string               `json:"problem_type"`
	Severity        string               `json:"severity"`
	AffectedServices []string            `json:"affected_services"`
	RootCause       string               `json:"root_cause"`
	Evidence        []EvidenceItem       `json:"evidence"`
	Recommendations []string             `json:"recommendations"`
	Timeline        []TimelineEvent      `json:"timeline"`
	GeneratedAt     time.Time            `json:"generated_at"`
}

type EvidenceItem struct {
	Service string    `json:"service"`
	Method  string    `json:"method"`
	Status  string    `json:"status"`
	Error   string    `json:"error,omitempty"`
	Time    time.Time `json:"time"`
	Attempt int       `json:"attempt"`
}

type TimelineEvent struct {
	Time    time.Time `json:"time"`
	Service string    `json:"service"`
	Event   string    `json:"event"`
	Details string    `json:"details"`
}

type ServiceStatus struct {
	ServiceName string    `json:"service_name"`
	Status      string    `json:"status"`
	LastCheck   time.Time `json:"last_check"`
	LatencyMS   int64     `json:"latency_ms"`
	ErrorRate   float64   `json:"error_rate"`
}

type ScenarioExecution struct {
	ID          string    `json:"id"`
	ScenarioID  string    `json:"scenario_id"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time,omitempty"`
	Status      string    `json:"status"`
	RequestCount int      `json:"request_count"`
	ErrorCount  int       `json:"error_count"`
	Reports     []string  `json:"reports,omitempty"`
}
