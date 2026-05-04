package models

type BaselineRecord struct {
	RouteName       string  `csv:"route_name" json:"route_name"`
	P50LatencyMs    float64 `csv:"p50_latency_ms" json:"p50_latency_ms"`
	P95LatencyMs    float64 `csv:"p95_latency_ms" json:"p95_latency_ms"`
	P99LatencyMs    float64 `csv:"p99_latency_ms" json:"p99_latency_ms"`
	AvgLatencyMs    float64 `csv:"avg_latency_ms" json:"avg_latency_ms"`
	ThroughputRPS   float64 `csv:"throughput_rps" json:"throughput_rps"`
	ErrorRate       float64 `csv:"error_rate" json:"error_rate"`
	MaxConcurrent   int     `csv:"max_concurrent" json:"max_concurrent"`
	CPUPeakPercent  float64 `csv:"cpu_peak_percent" json:"cpu_peak_percent"`
	MemoryPeakMB    int     `csv:"memory_peak_mb" json:"memory_peak_mb"`
}
