package model

import (
	"time"
)

type CacheEvent struct {
	ID             int64     `json:"id" db:"id"`
	Timestamp      time.Time `json:"timestamp" db:"timestamp"`
	BusinessDomain string    `json:"business_domain" db:"business_domain"`
	CacheKey       string    `json:"cache_key" db:"cache_key"`
	TTL            int64     `json:"ttl_seconds" db:"ttl_seconds"`
	IsHit          bool      `json:"is_hit" db:"is_hit"`
	BackendLatency float64   `json:"backend_latency_ms" db:"backend_latency_ms"`
	RequestSource  string    `json:"request_source" db:"request_source"`
	UserAgent      string    `json:"user_agent,omitempty" db:"user_agent"`
	IPAddress      string    `json:"ip_address,omitempty" db:"ip_address"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type CacheKey struct {
	ID             int64     `json:"id" db:"id"`
	BusinessDomain string    `json:"business_domain" db:"business_domain"`
	CacheKey       string    `json:"cache_key" db:"cache_key"`
	TTL            int64     `json:"ttl_seconds" db:"ttl_seconds"`
	ExpireAt       time.Time `json:"expire_at" db:"expire_at"`
	IsHot          bool      `json:"is_hot" db:"is_hot"`
	AccessCount    int64     `json:"access_count" db:"access_count"`
	LastAccessAt   time.Time `json:"last_access_at" db:"last_access_at"`
	DataType       string    `json:"data_type" db:"data_type"`
	ValueHash      string    `json:"value_hash,omitempty" db:"value_hash"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type BackendMetric struct {
	ID                int64     `json:"id" db:"id"`
	BusinessDomain    string    `json:"business_domain" db:"business_domain"`
	Timestamp         time.Time `json:"timestamp" db:"timestamp"`
	MaxConnections    int       `json:"max_connections" db:"max_connections"`
	CurrentConnections int      `json:"current_connections" db:"current_connections"`
	QueryPerSecond    float64   `json:"qps" db:"qps"`
	MaxQPS            float64   `json:"max_qps" db:"max_qps"`
	AvgLatencyMS      float64   `json:"avg_latency_ms" db:"avg_latency_ms"`
	P95LatencyMS      float64   `json:"p95_latency_ms" db:"p95_latency_ms"`
	P99LatencyMS      float64   `json:"p99_latency_ms" db:"p99_latency_ms"`
	ErrorRate         float64   `json:"error_rate" db:"error_rate"`
	CPUUsage          float64   `json:"cpu_usage" db:"cpu_usage"`
	MemoryUsage       float64   `json:"memory_usage" db:"memory_usage"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type TrafficPlan struct {
	ID             int64     `json:"id" db:"id"`
	PlanName       string    `json:"plan_name" db:"plan_name"`
	BusinessDomain string    `json:"business_domain" db:"business_domain"`
	StartTime      time.Time `json:"start_time" db:"start_time"`
	EndTime        time.Time `json:"end_time" db:"end_time"`
	ExpectedQPS    float64   `json:"expected_qps" db:"expected_qps"`
	PeakQPS        float64   `json:"peak_qps" db:"peak_qps"`
	HotKeyRatio    float64   `json:"hot_key_ratio" db:"hot_key_ratio"`
	ColdStartRatio float64   `json:"cold_start_ratio" db:"cold_start_ratio"`
	InvalidKeyRatio float64  `json:"invalid_key_ratio" db:"invalid_key_ratio"`
	Description    string    `json:"description,omitempty" db:"description"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type Strategy struct {
	ID             int64     `json:"id" db:"id"`
	StrategyName   string    `json:"strategy_name" db:"strategy_name"`
	StrategyType   string    `json:"strategy_type" db:"strategy_type"`
	BusinessDomain string    `json:"business_domain,omitempty" db:"business_domain"`
	IsEnabled      bool      `json:"is_enabled" db:"is_enabled"`
	Priority       int       `json:"priority" db:"priority"`
	Config         string    `json:"config_json" db:"config_json"`
	Description    string    `json:"description,omitempty" db:"description"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type RiskEvent struct {
	ID             int64     `json:"id" db:"id"`
	RiskType       string    `json:"risk_type" db:"risk_type"`
	Severity       string    `json:"severity" db:"severity"`
	BusinessDomain string    `json:"business_domain" db:"business_domain"`
	CacheKey       string    `json:"cache_key,omitempty" db:"cache_key"`
	Evidence       string    `json:"evidence_json" db:"evidence_json"`
	ImpactScore    float64   `json:"impact_score" db:"impact_score"`
	RecommendedAction string    `json:"recommended_action" db:"recommended_action"`
	DetectedAt     time.Time `json:"detected_at" db:"detected_at"`
	IsResolved     bool      `json:"is_resolved" db:"is_resolved"`
	ResolvedAt     time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type SimulationResult struct {
	ID             int64     `json:"id" db:"id"`
	SimulationName string    `json:"simulation_name" db:"simulation_name"`
	StrategyTypes  string    `json:"strategy_types_json" db:"strategy_types_json"`
	BusinessDomain string    `json:"business_domain,omitempty" db:"business_domain"`
	OriginalMetrics string   `json:"original_metrics_json" db:"original_metrics_json"`
	SimulatedMetrics string  `json:"simulated_metrics_json" db:"simulated_metrics_json"`
	Comparison     string    `json:"comparison_json" db:"comparison_json"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type AuditLog struct {
	ID          int64     `json:"id" db:"id"`
	Operation   string    `json:"operation" db:"operation"`
	Resource    string    `json:"resource" db:"resource"`
	Method      string    `json:"method" db:"method"`
	Path        string    `json:"path" db:"path"`
	UserAgent   string    `json:"user_agent" db:"user_agent"`
	IPAddress   string    `json:"ip_address" db:"ip_address"`
	StatusCode  int       `json:"status_code" db:"status_code"`
	RequestID   string    `json:"request_id" db:"request_id"`
	DurationMS  int64     `json:"duration_ms" db:"duration_ms"`
	Detail      string    `json:"detail_json,omitempty" db:"detail_json"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type ThresholdConfig struct {
	ID                         int64   `json:"id" db:"id"`
	PenetrationMissRateThreshold float64 `json:"penetration_miss_rate_threshold" db:"penetration_miss_rate_threshold"`
	HotKeyAccessThreshold      int64   `json:"hot_key_access_threshold" db:"hot_key_access_threshold"`
	TTLClusterThreshold        float64 `json:"ttl_cluster_threshold" db:"ttl_cluster_threshold"`
	BackendCapacityThreshold   float64 `json:"backend_capacity_threshold" db:"backend_capacity_threshold"`
	BloomFilterFalsePositiveRate float64 `json:"bloom_filter_false_positive_rate" db:"bloom_filter_false_positive_rate"`
	MutexWaitThresholdMS       int64   `json:"mutex_wait_threshold_ms" db:"mutex_wait_threshold_ms"`
	StaleRevalidateRatio       float64 `json:"stale_revalidate_ratio" db:"stale_revalidate_ratio"`
	UpdatedAt                  time.Time `json:"updated_at" db:"updated_at"`
}
