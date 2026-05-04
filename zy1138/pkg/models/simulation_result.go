package models

import "time"

type SimulationResult struct {
	Name               string                 `json:"name"`
	ConfigName         string                 `json:"config_name"`
	SimulationTime     time.Time              `json:"simulation_time"`
	Config             *SimulationConfig      `json:"config"`
	Summary            SimulationSummary      `json:"summary"`
	JobStats           *JobStatistics         `json:"job_stats"`
	WorkerStats        *WorkerSimulationStats `json:"worker_stats"`
	BacklogAnalysis    *BacklogAnalysis       `json:"backlog_analysis"`
	RetryAnalysis      *RetryAnalysis         `json:"retry_analysis"`
	DeadLetterAnalysis *DeadLetterAnalysis    `json:"dead_letter_analysis"`
	Metrics            *SimulationMetrics     `json:"metrics"`
	Issues             []SimulationIssue      `json:"issues"`
}

type SimulationSummary struct {
	TotalJobs           int64         `json:"total_jobs"`
	ProcessedJobs       int64         `json:"processed_jobs"`
	SuccessRate         float64       `json:"success_rate"`
	SimulationDuration  time.Duration `json:"simulation_duration"`
	RealDurationMs      int64         `json:"real_duration_ms"`
	PeakBacklog         int64         `json:"peak_backlog"`
	MaxBacklog          int64         `json:"max_backlog"`
	MaxWaitTimeMs       int64         `json:"max_wait_time_ms"`
	AvgWaitTimeMs       float64       `json:"avg_wait_time_ms"`
	P95WaitTimeMs       float64       `json:"p95_wait_time_ms"`
	P99WaitTimeMs       float64       `json:"p99_wait_time_ms"`
	ThroughputPerSecond float64       `json:"throughput_per_second"`
	TotalRetries        int64         `json:"total_retries"`
	DeadLetterJobs      int64         `json:"dead_letter_jobs"`
	WorkerUtilization   float64       `json:"worker_utilization"`
}

type WorkerSimulationStats struct {
	TotalWorkers       int                          `json:"total_workers"`
	ByPool             map[string]WorkerPoolStats   `json:"by_pool"`
	TotalConcurrency   int                          `json:"total_concurrency"`
	ActiveConcurrency  int                          `json:"active_concurrency"`
	AvgUtilizationRate float64                      `json:"avg_utilization_rate"`
	MaxUtilizationRate float64                      `json:"max_utilization_rate"`
	IdleTimePercent    float64                      `json:"idle_time_percent"`
	WorkerUtilization  map[string]WorkerUtilization `json:"worker_utilization"`
}

type WorkerPoolStats struct {
	WorkerCount        int     `json:"worker_count"`
	Concurrency        int     `json:"concurrency"`
	JobsProcessed      int64   `json:"jobs_processed"`
	JobsSucceeded      int64   `json:"jobs_succeeded"`
	JobsFailed         int64   `json:"jobs_failed"`
	AvgUtilizationRate float64 `json:"avg_utilization_rate"`
	AvgBatchSize       float64 `json:"avg_batch_size"`
}

type WorkerUtilization struct {
	WorkerID        string  `json:"worker_id"`
	PoolName        string  `json:"pool_name"`
	ActiveTimeMs    int64   `json:"active_time_ms"`
	IdleTimeMs      int64   `json:"idle_time_ms"`
	UtilizationRate float64 `json:"utilization_rate"`
	JobsProcessed   int64   `json:"jobs_processed"`
}

type SimulationMetrics struct {
	TotalEnqueueEvents  int64 `json:"total_enqueue_events"`
	TotalDequeueEvents  int64 `json:"total_dequeue_events"`
	TotalCompleteEvents int64 `json:"total_complete_events"`
	TotalFailEvents     int64 `json:"total_fail_events"`
	TotalRetryEvents    int64 `json:"total_retry_events"`
	TotalTimeoutEvents  int64 `json:"total_timeout_events"`
	TotalDLQEvents      int64 `json:"total_dlq_events"`

	AvgEnqueueRatePerSec  float64 `json:"avg_enqueue_rate_per_sec"`
	AvgDequeueRatePerSec  float64 `json:"avg_dequeue_rate_per_sec"`
	AvgCompleteRatePerSec float64 `json:"avg_complete_rate_per_sec"`

	QueueDepthOverTime []QueueDepthSample `json:"queue_depth_over_time,omitempty"`
}

type QueueDepthSample struct {
	Timestamp  time.Time     `json:"timestamp"`
	QueueName  string        `json:"queue_name"`
	Depth      int64         `json:"depth"`
	ByPriority map[int]int64 `json:"by_priority,omitempty"`
}

type SimulationIssue struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Timestamp   time.Time `json:"timestamp"`
	Description string    `json:"description"`
	Details     string    `json:"details"`
	RelatedJobs []string  `json:"related_jobs,omitempty"`
}

type ComparisonResult struct {
	Name                string             `json:"name"`
	ComparisonTime      time.Time          `json:"comparison_time"`
	BaseConfigName      string             `json:"base_config_name"`
	ComparedConfigNames []string           `json:"compared_config_names"`
	Summary             ComparisonSummary  `json:"summary"`
	DetailedComparison  DetailedComparison `json:"detailed_comparison"`
	Recommendations     []Recommendation   `json:"recommendations"`
}

type ComparisonSummary struct {
	TotalSimulations int     `json:"total_simulations"`
	BestConfigName   string  `json:"best_config_name"`
	WorstConfigName  string  `json:"worst_config_name"`
	BestSuccessRate  float64 `json:"best_success_rate"`
	BestThroughput   float64 `json:"best_throughput"`
	BestMaxWaitTime  int64   `json:"best_max_wait_time"`
	BestPeakBacklog  int64   `json:"best_peak_backlog"`
	BestUtilization  float64 `json:"best_utilization"`
}

type DetailedComparison struct {
	ByConfig  map[string]ConfigComparison `json:"by_config"`
	ByMetric  map[string]MetricComparison `json:"by_metric"`
	Tradeoffs []Tradeoff                  `json:"tradeoffs"`
}

type ConfigComparison struct {
	ConfigName      string  `json:"config_name"`
	IsBase          bool    `json:"is_base"`
	SuccessRate     float64 `json:"success_rate"`
	SuccessRateDiff float64 `json:"success_rate_diff"`
	Throughput      float64 `json:"throughput"`
	ThroughputDiff  float64 `json:"throughput_diff"`
	AvgWaitTimeMs   float64 `json:"avg_wait_time_ms"`
	WaitTimeDiff    float64 `json:"wait_time_diff"`
	MaxWaitTimeMs   int64   `json:"max_wait_time_ms"`
	PeakBacklog     int64   `json:"peak_backlog"`
	BacklogDiff     int64   `json:"backlog_diff"`
	UtilizationRate float64 `json:"utilization_rate"`
	UtilizationDiff float64 `json:"utilization_diff"`
	RetryRate       float64 `json:"retry_rate"`
	RetryRateDiff   float64 `json:"retry_rate_diff"`
	DLQRate         float64 `json:"dlq_rate"`
	DLQRateDiff     float64 `json:"dlq_rate_diff"`
	Score           float64 `json:"score"`
	Rank            int     `json:"rank"`
}

type MetricComparison struct {
	MetricName     string             `json:"metric_name"`
	BaseValue      float64            `json:"base_value"`
	BestValue      float64            `json:"best_value"`
	WorstValue     float64            `json:"worst_value"`
	ByConfig       map[string]float64 `json:"by_config"`
	HigherIsBetter bool               `json:"higher_is_better"`
}

type Tradeoff struct {
	Description    string            `json:"description"`
	ConfigA        string            `json:"config_a"`
	ConfigB        string            `json:"config_b"`
	TradeoffPoints map[string]string `json:"tradeoff_points"`
	Recommendation string            `json:"recommendation"`
}
