package models

import (
	"time"
)

type Project struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Design struct {
	ID          int64         `json:"id"`
	ProjectID   int64         `json:"project_id"`
	Name        string        `json:"name"`
	YAMLContent string        `json:"yaml_content"`
	CreatedAt   time.Time     `json:"created_at"`
	Config      *DesignConfig `json:"config,omitempty"`
}

type DesignConfig struct {
	Name        string          `yaml:"name" json:"name"`
	Description string          `yaml:"description" json:"description"`
	Version     string          `yaml:"version" json:"version"`
	Concurrency ConcurrencySpec `yaml:"concurrency" json:"concurrency"`
	Queues      []QueueSpec     `yaml:"queues" json:"queues"`
	Goroutines  []GoroutineSpec `yaml:"goroutines" json:"goroutines"`
	Timeout     TimeoutSpec     `yaml:"timeout" json:"timeout"`
	Error       ErrorSpec       `yaml:"error" json:"error"`
	Shutdown    ShutdownSpec    `yaml:"shutdown" json:"shutdown"`
}

type ConcurrencySpec struct {
	Patterns   []string `yaml:"patterns" json:"patterns"`
	MaxWorkers int      `yaml:"max_workers" json:"max_workers"`
	RateLimit  *RateLimitSpec `yaml:"rate_limit,omitempty" json:"rate_limit,omitempty"`
}

type RateLimitSpec struct {
	Type      string `yaml:"type" json:"type"`
	Requests  int    `yaml:"requests" json:"requests"`
	PerSecond int    `yaml:"per_second" json:"per_second"`
	Burst     int    `yaml:"burst,omitempty" json:"burst,omitempty"`
}

type QueueSpec struct {
	Name        string `yaml:"name" json:"name"`
	Type        string `yaml:"type" json:"type"`
	Capacity    int    `yaml:"capacity" json:"capacity"`
	Priority    bool   `yaml:"priority" json:"priority"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

type GoroutineSpec struct {
	Name         string   `yaml:"name" json:"name"`
	Type         string   `yaml:"type" json:"type"`
	InputQueues  []string `yaml:"input_queues,omitempty" json:"input_queues,omitempty"`
	OutputQueues []string `yaml:"output_queues,omitempty" json:"output_queues,omitempty"`
	Workers      int      `yaml:"workers" json:"workers"`
	Timeout      string   `yaml:"timeout,omitempty" json:"timeout,omitempty"`
	RetryCount   int      `yaml:"retry_count,omitempty" json:"retry_count,omitempty"`
}

type TimeoutSpec struct {
	Default       string `yaml:"default" json:"default"`
	Startup       string `yaml:"startup,omitempty" json:"startup,omitempty"`
	Shutdown      string `yaml:"shutdown,omitempty" json:"shutdown,omitempty"`
	Operation     string `yaml:"operation,omitempty" json:"operation,omitempty"`
	CancelPropagate bool `yaml:"cancel_propagate" json:"cancel_propagate"`
}

type ErrorSpec struct {
	Strategy     string `yaml:"strategy" json:"strategy"`
	MaxRetries   int    `yaml:"max_retries,omitempty" json:"max_retries,omitempty"`
	RetryBackoff string `yaml:"retry_backoff,omitempty" json:"retry_backoff,omitempty"`
	ErrorQueue   string `yaml:"error_queue,omitempty" json:"error_queue,omitempty"`
	PanicHandler bool   `yaml:"panic_handler" json:"panic_handler"`
}

type ShutdownSpec struct {
	Graceful     bool     `yaml:"graceful" json:"graceful"`
	Order        []string `yaml:"order" json:"order"`
	WaitTimeout  string   `yaml:"wait_timeout" json:"wait_timeout"`
	ForceKill    bool     `yaml:"force_kill" json:"force_kill"`
}

type Event struct {
	Timestamp   time.Time `json:"timestamp"`
	Type        string    `json:"type"`
	GoroutineID string    `json:"goroutine_id"`
	QueueName   string    `json:"queue_name,omitempty"`
	Message     string    `json:"message,omitempty"`
	Duration    string    `json:"duration,omitempty"`
	Error       string    `json:"error,omitempty"`
}

type CodeSnippet struct {
	ID        int64     `json:"id"`
	DesignID  int64     `json:"design_id"`
	Filename  string    `json:"filename"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type AnalysisResult struct {
	ID                 int64           `json:"id"`
	DesignID           int64           `json:"design_id"`
	GoroutineTopology  *TopologyResult `json:"goroutine_topology"`
	QueueAnalysis      *QueueAnalysis  `json:"queue_analysis"`
	BackpressureAnalysis *BackpressureAnalysis `json:"backpressure_analysis"`
	PriorityAnalysis   *PriorityAnalysis `json:"priority_analysis"`
	TimeoutAnalysis    *TimeoutAnalysis  `json:"timeout_analysis"`
	ErrorAnalysis      *ErrorAnalysis    `json:"error_analysis"`
	ShutdownAnalysis   *ShutdownAnalysis `json:"shutdown_analysis"`
	Issues             []Issue          `json:"issues"`
	Recommendations    []Recommendation `json:"recommendations"`
	OverallScore       int              `json:"overall_score"`
	CreatedAt          time.Time        `json:"created_at"`
}

type TopologyResult struct {
	Nodes      []TopologyNode `json:"nodes"`
	Edges      []TopologyEdge `json:"edges"`
	Cycles     []string       `json:"cycles"`
	Orphaned   []string       `json:"orphaned"`
	Patterns   []DetectedPattern `json:"patterns"`
}

type TopologyNode struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Workers  int    `json:"workers"`
	Capacity int    `json:"capacity"`
}

type TopologyEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Type string `json:"type"`
}

type DetectedPattern struct {
	Name        string `json:"name"`
	Confidence  float64 `json:"confidence"`
	Description string `json:"description"`
}

type QueueAnalysis struct {
	Queues []QueueStatus `json:"queues"`
	Issues []QueueIssue  `json:"issues"`
}

type QueueStatus struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Capacity    int    `json:"capacity"`
	UsedPercent float64 `json:"used_percent"`
	Status      string `json:"status"`
}

type QueueIssue struct {
	Name        string `json:"name"`
	IssueType   string `json:"issue_type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
}

type BackpressureAnalysis struct {
	HasBackpressure bool   `json:"has_backpressure"`
	Bottlenecks     []string `json:"bottlenecks"`
	Strategies      []string `json:"strategies"`
}

type PriorityAnalysis struct {
	HasPriorityQueues bool         `json:"has_priority_queues"`
	PriorityQueues     []string     `json:"priority_queues"`
	Issues             []PriorityIssue `json:"issues"`
}

type PriorityIssue struct {
	QueueName   string `json:"queue_name"`
	IssueType   string `json:"issue_type"`
	Description string `json:"description"`
}

type TimeoutAnalysis struct {
	DefaultTimeout   string `json:"default_timeout"`
	HasCancelPropagate bool `json:"has_cancel_propagate"`
	UncoveredOperations []string `json:"uncovered_operations"`
	TimeoutBudget    string `json:"timeout_budget"`
}

type ErrorAnalysis struct {
	Strategy       string   `json:"strategy"`
	HasErrorQueue  bool     `json:"has_error_queue"`
	HasPanicHandler bool    `json:"has_panic_handler"`
	RetryConfig    *RetryConfig `json:"retry_config,omitempty"`
	UnhandledPaths []string `json:"unhandled_paths"`
}

type RetryConfig struct {
	MaxRetries int    `json:"max_retries"`
	Backoff    string `json:"backoff"`
}

type ShutdownAnalysis struct {
	Graceful       bool     `json:"graceful"`
	ShutdownOrder  []string `json:"shutdown_order"`
	WaitTimeout    string   `json:"wait_timeout"`
	HasForceKill   bool     `json:"has_force_kill"`
	Issues         []ShutdownIssue `json:"issues"`
}

type ShutdownIssue struct {
	IssueType   string `json:"issue_type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

type Issue struct {
	Severity    string `json:"severity"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Suggestion  string `json:"suggestion,omitempty"`
	Location    string `json:"location,omitempty"`
}

type Recommendation struct {
	Priority    string `json:"priority"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Impact      string `json:"impact"`
}
