package models

type RunResult struct {
	Timestamp      int64                 `json:"timestamp"`
	PlanName       string                `json:"plan_name"`
	OverallStatus  ResultStatus          `json:"overall_status"`
	RouteResults   []RouteResult         `json:"route_results"`
	DependencyMetrics []DependencyMetric `json:"dependency_metrics"`
	AppliedScenarios []string            `json:"applied_scenarios,omitempty"`
	Warnings       []string              `json:"warnings,omitempty"`
}

type ResultStatus string

const (
	StatusPass    ResultStatus = "PASS"
	StatusWarning ResultStatus = "WARNING"
	StatusFail    ResultStatus = "FAIL"
)

type RouteResult struct {
	RouteName       string            `json:"route_name"`
	Status          ResultStatus      `json:"status"`
	LatencyMetrics  LatencyMetrics    `json:"latency_metrics"`
	Throughput      ThroughputMetrics `json:"throughput"`
	ErrorMetrics    ErrorMetrics      `json:"error_metrics"`
	ResourceMetrics ResourceMetrics   `json:"resource_metrics"`
	BudgetChecks    []BudgetCheck     `json:"budget_checks"`
	DependencyCalls []DependencyCall  `json:"dependency_calls,omitempty"`
	Recommendations []Recommendation  `json:"recommendations,omitempty"`
}

type LatencyMetrics struct {
	P50Ms float64 `json:"p50_ms"`
	P95Ms float64 `json:"p95_ms"`
	P99Ms float64 `json:"p99_ms"`
	AvgMs float64 `json:"avg_ms"`
	MinMs float64 `json:"min_ms"`
	MaxMs float64 `json:"max_ms"`
}

type ThroughputMetrics struct {
	ActualRPS     float64 `json:"actual_rps"`
	TargetRPS     float64 `json:"target_rps"`
	TotalRequests int64   `json:"total_requests"`
	ConcurrentAvg float64 `json:"concurrent_avg"`
	ConcurrentMax int     `json:"concurrent_max"`
}

type ErrorMetrics struct {
	ErrorRate    float64         `json:"error_rate"`
	TotalErrors  int64           `json:"total_errors"`
	ErrorByType  map[string]int64 `json:"error_by_type,omitempty"`
}

type ResourceMetrics struct {
	CPUPeakPercent    float64 `json:"cpu_peak_percent"`
	CPUAvgPercent     float64 `json:"cpu_avg_percent"`
	MemoryPeakMB      int     `json:"memory_peak_mb"`
	MemoryAvgMB       int     `json:"memory_avg_mb"`
	ConnectionPoolUse float64 `json:"connection_pool_use_percent,omitempty"`
}

type BudgetCheck struct {
	Name        string       `json:"name"`
	Threshold   float64      `json:"threshold"`
	Actual      float64      `json:"actual"`
	Status      CheckStatus  `json:"status"`
	RiskLevel   RiskLevel    `json:"risk_level"`
	Explanation string       `json:"explanation"`
}

type CheckStatus string

const (
	CheckPass   CheckStatus = "PASS"
	CheckWarn   CheckStatus = "WARN"
	CheckFail   CheckStatus = "FAIL"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "LOW"
	RiskMedium RiskLevel = "MEDIUM"
	RiskHigh   RiskLevel = "HIGH"
	RiskCritical RiskLevel = "CRITICAL"
)

type DependencyMetric struct {
	Name          string `json:"name"`
	TotalCalls    int64  `json:"total_calls"`
	CallsPerSec   float64 `json:"calls_per_sec"`
	MaxQPS        int     `json:"max_qps"`
	MaxConcurrent int     `json:"max_concurrent"`
	Status        ResultStatus `json:"status"`
	Warnings      []string `json:"warnings,omitempty"`
}

type DependencyCall struct {
	Name         string  `json:"name"`
	TotalCalls   int64   `json:"total_calls"`
	CallsPerSec  float64 `json:"calls_per_sec"`
	Factor       float64 `json:"factor"`
}

type Recommendation struct {
	Action      string `json:"action"`
	RiskLevel   RiskLevel `json:"risk_level"`
	Description string `json:"description"`
	Priority    int    `json:"priority"`
}
