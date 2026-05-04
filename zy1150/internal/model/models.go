package model

import (
	"time"
)

type Service struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Route struct {
	ID          int64     `json:"id"`
	ServiceID   int64     `json:"service_id"`
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	Middlewares []RouteMiddlewareInfo `json:"middlewares,omitempty"`
}

type Middleware struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Description string    `json:"description,omitempty"`
	Config      string    `json:"config,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type RouteMiddlewareInfo struct {
	Position     int    `json:"position"`
	MiddlewareID int64  `json:"middleware_id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
}

type RequestTrace struct {
	ID            int64          `json:"id"`
	TraceID       string         `json:"trace_id"`
	ServiceID     *int64         `json:"service_id,omitempty"`
	RouteID       *int64         `json:"route_id,omitempty"`
	Method        string         `json:"method"`
	Path          string         `json:"path"`
	Headers       map[string]string `json:"headers,omitempty"`
	BodyReadCount int            `json:"body_read_count"`
	StatusCode    int            `json:"status_code"`
	ResponseBody  string         `json:"response_body,omitempty"`
	StartTime     *time.Time     `json:"start_time,omitempty"`
	EndTime       *time.Time     `json:"end_time,omitempty"`
	DurationMs    int64          `json:"duration_ms,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
}

type ContextEvent struct {
	ID             int64      `json:"id"`
	TraceID        string     `json:"trace_id"`
	MiddlewareName *string    `json:"middleware_name,omitempty"`
	EventType      string     `json:"event_type"`
	Key            *string    `json:"key,omitempty"`
	Value          *string    `json:"value,omitempty"`
	OldValue       *string    `json:"old_value,omitempty"`
	Timestamp      time.Time  `json:"timestamp"`
	CreatedAt      time.Time  `json:"created_at"`
}

type Policy struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Rules       string    `json:"rules"`
	Description string    `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type DiagnosticRule struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Category    string    `json:"category"`
	Severity    string    `json:"severity"`
	Description string    `json:"description,omitempty"`
	CheckLogic  string    `json:"check_logic,omitempty"`
	IsEnabled   bool      `json:"is_enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Risk struct {
	ID         int64      `json:"id"`
	RuleID     int64      `json:"rule_id"`
	RouteID    *int64     `json:"route_id,omitempty"`
	TraceID    *string    `json:"trace_id,omitempty"`
	Status     string     `json:"status"`
	Evidence   string     `json:"evidence"`
	Impact     string     `json:"impact"`
	Suggestion string     `json:"suggestion"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	Rule       *DiagnosticRule `json:"rule,omitempty"`
}

type AuditEvent struct {
	ID         int64     `json:"id"`
	EventType  string    `json:"event_type"`
	EntityType *string   `json:"entity_type,omitempty"`
	EntityID   *int64    `json:"entity_id,omitempty"`
	Details    *string   `json:"details,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type ImportResult struct {
	Success  bool                   `json:"success"`
	Stats    map[string]int         `json:"stats"`
	Errors   []string               `json:"errors,omitempty"`
}

type DiagnosticResult struct {
	TotalRisks      int            `json:"total_risks"`
	BySeverity      map[string]int `json:"by_severity"`
	ByCategory      map[string]int `json:"by_category"`
	Risks           []Risk         `json:"risks,omitempty"`
}

type ReplayRequest struct {
	TraceIDs    []string `json:"trace_ids,omitempty"`
	RouteIDs    []int64  `json:"route_ids,omitempty"`
	ServiceIDs  []int64  `json:"service_ids,omitempty"`
}

type ReplayResult struct {
	TotalRequests int `json:"total_requests"`
	Passed        int `json:"passed"`
	Failed        int `json:"failed"`
	Details       []ReplayDetail `json:"details,omitempty"`
}

type ReplayDetail struct {
	TraceID       string `json:"trace_id"`
	OriginalStatus int   `json:"original_status"`
	ReplayStatus  int    `json:"replay_status,omitempty"`
	IsMatch       bool   `json:"is_match"`
	Diff          string `json:"diff,omitempty"`
}
