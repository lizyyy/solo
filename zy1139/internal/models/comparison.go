package models

type ComparisonResult struct {
	Timestamp         int64                 `json:"timestamp"`
	BaselineSource    string                `json:"baseline_source"`
	CurrentSource     string                `json:"current_source"`
	OverallStatus     ComparisonStatus      `json:"overall_status"`
	RouteComparisons  []RouteComparison     `json:"route_comparisons"`
	DegradedRoutes    []string              `json:"degraded_routes"`
	ImprovedRoutes    []string              `json:"improved_routes"`
	Bottlenecks       []Bottleneck          `json:"bottlenecks"`
	Recommendations   []DegradationRec      `json:"recommendations"`
}

type ComparisonStatus string

const (
	ComparisonPass    ComparisonStatus = "PASS"
	ComparisonWarning ComparisonStatus = "WARNING"
	ComparisonDegraded ComparisonStatus = "DEGRADED"
)

type RouteComparison struct {
	RouteName        string           `json:"route_name"`
	Status           ComparisonStatus `json:"status"`
	LatencyDelta     LatencyDelta     `json:"latency_delta"`
	ThroughputDelta  ThroughputDelta  `json:"throughput_delta"`
	ErrorDelta       ErrorDelta       `json:"error_delta"`
	ResourceDelta    ResourceDelta    `json:"resource_delta"`
	DegradationChecks []DegradationCheck `json:"degradation_checks"`
}

type LatencyDelta struct {
	P50DeltaMs   float64 `json:"p50_delta_ms"`
	P50DeltaPct  float64 `json:"p50_delta_pct"`
	P95DeltaMs   float64 `json:"p95_delta_ms"`
	P95DeltaPct  float64 `json:"p95_delta_pct"`
	P99DeltaMs   float64 `json:"p99_delta_ms"`
	P99DeltaPct  float64 `json:"p99_delta_pct"`
}

type ThroughputDelta struct {
	RPSDelta    float64 `json:"rps_delta"`
	RPSDeltaPct float64 `json:"rps_delta_pct"`
	ConcurrentDelta float64 `json:"concurrent_delta"`
}

type ErrorDelta struct {
	ErrorRateDelta    float64 `json:"error_rate_delta"`
	ErrorRateDeltaPct float64 `json:"error_rate_delta_pct"`
	ErrorCountDelta   int64   `json:"error_count_delta"`
}

type ResourceDelta struct {
	CPUDeltaPct    float64 `json:"cpu_delta_pct"`
	MemoryDeltaMB  int     `json:"memory_delta_mb"`
}

type DegradationCheck struct {
	Name        string           `json:"name"`
	Baseline    float64          `json:"baseline"`
	Current     float64          `json:"current"`
	Threshold   float64          `json:"threshold"`
	IsDegraded  bool             `json:"is_degraded"`
	Severity    DegradationSeverity `json:"severity"`
}

type DegradationSeverity string

const (
	SeverityMinor    DegradationSeverity = "MINOR"
	SeverityModerate DegradationSeverity = "MODERATE"
	SeverityMajor    DegradationSeverity = "MAJOR"
	SeverityCritical DegradationSeverity = "CRITICAL"
)

type Bottleneck struct {
	Type        BottleneckType `json:"type"`
	Location    string         `json:"location"`
	Description string         `json:"description"`
	Severity    DegradationSeverity `json:"severity"`
	Metrics     map[string]float64 `json:"metrics,omitempty"`
}

type BottleneckType string

const (
	BottleneckCPU         BottleneckType = "CPU"
	BottleneckMemory      BottleneckType = "MEMORY"
	BottleneckLatency     BottleneckType = "LATENCY"
	BottleneckErrorRate   BottleneckType = "ERROR_RATE"
	BottleneckDependency  BottleneckType = "DEPENDENCY"
	BottleneckConnection  BottleneckType = "CONNECTION_POOL"
)

type DegradationRec struct {
	Action       DegradationAction  `json:"action"`
	TargetRoutes []string           `json:"target_routes"`
	RiskLevel    RiskLevel          `json:"risk_level"`
	Description  string             `json:"description"`
	Justification string            `json:"justification"`
}

type DegradationAction string

const (
	ActionRollback        DegradationAction = "ROLLBACK"
	ActionLimitTraffic    DegradationAction = "LIMIT_TRAFFIC"
	ActionEnableCircuit   DegradationAction = "ENABLE_CIRCUIT"
	ActionSwitchToFallback DegradationAction = "SWITCH_TO_FALLBACK"
	ActionIncreaseResources DegradationAction = "INCREASE_RESOURCES"
	ActionInvestigate     DegradationAction = "INVESTIGATE"
	ActionProceed         DegradationAction = "PROCEED"
)
