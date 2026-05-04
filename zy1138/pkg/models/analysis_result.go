package models

import "time"

type AnalysisResult struct {
	Name               string                     `json:"name"`
	AnalysisTime       time.Time                  `json:"analysis_time"`
	TimeRange          TimeRange                  `json:"time_range"`
	Summary            AnalysisSummary            `json:"summary"`
	JobStats           *JobStatistics             `json:"job_stats"`
	WorkerStats        *WorkerStatistics          `json:"worker_stats"`
	BacklogAnalysis    *BacklogAnalysis           `json:"backlog_analysis"`
	RetryAnalysis      *RetryAnalysis             `json:"retry_analysis"`
	PriorityAnalysis   *PriorityAnalysis          `json:"priority_analysis"`
	DeadLetterAnalysis *DeadLetterAnalysis        `json:"dead_letter_analysis"`
	TimeoutAnalysis    *TimeoutAnalysis           `json:"timeout_analysis"`
	Recommendations    []Recommendation           `json:"recommendations"`
	Anomalies          []Anomaly                  `json:"anomalies"`
}

type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

type AnalysisSummary struct {
	TotalJobs           int64   `json:"total_jobs"`
	TotalWorkers        int     `json:"total_workers"`
	TotalQueues         int     `json:"total_queues"`
	SuccessRate         float64 `json:"success_rate"`
	AvgThroughputPerSec float64 `json:"avg_throughput_per_sec"`
	MaxBacklog          int64   `json:"max_backlog"`
	MaxWaitTimeMs       int64   `json:"max_wait_time_ms"`
	AnalysisDurationMs  int64   `json:"analysis_duration_ms"`
}

type BacklogAnalysis struct {
	PeakBacklog         int64                     `json:"peak_backlog"`
	PeakTime            time.Time                 `json:"peak_time"`
	AvgBacklog          float64                   `json:"avg_backlog"`
	BacklogGrowthRate   float64                   `json:"backlog_growth_rate"`
	BacklogByPriority   map[int]BacklogTrend      `json:"backlog_by_priority"`
	BacklogByQueue      map[string]BacklogTrend   `json:"backlog_by_queue"`
	BacklogByJobType    map[string]BacklogTrend   `json:"backlog_by_job_type"`
	BacklogResolvedTime *time.Duration            `json:"backlog_resolved_time,omitempty"`
}

type BacklogTrend struct {
	Peak    int64         `json:"peak"`
	Avg     float64       `json:"avg"`
	Min     int64         `json:"min"`
	Max     int64         `json:"max"`
	Growth  float64       `json:"growth_rate"`
	Samples []BacklogSample `json:"samples,omitempty"`
}

type BacklogSample struct {
	Timestamp time.Time `json:"timestamp"`
	Count     int64     `json:"count"`
}

type RetryAnalysis struct {
	TotalRetryEvents     int64                  `json:"total_retry_events"`
	MaxRetryCount        int                    `json:"max_retry_count"`
	AvgRetryCount        float64                `json:"avg_retry_count"`
	RetryRate            float64                `json:"retry_rate"`
	RetryStormIndicators []RetryStormIndicator  `json:"retry_storm_indicators"`
	RetryByReason        map[string]int64       `json:"retry_by_reason"`
	RetryByJobType       map[string]RetryStats  `json:"retry_by_job_type"`
	AvgRetryIntervalMs   float64                `json:"avg_retry_interval_ms"`
}

type RetryStats struct {
	TotalRetries int64   `json:"total_retries"`
	AvgCount     float64 `json:"avg_count"`
	SuccessRate  float64 `json:"success_rate"`
}

type RetryStormIndicator struct {
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	RetryCount   int64     `json:"retry_count"`
	AffectedJobs int64     `json:"affected_jobs"`
	Severity     string    `json:"severity"`
	Reason       string    `json:"reason"`
}

type PriorityAnalysis struct {
	HasPrioritySystem        bool                        `json:"has_priority_system"`
	PriorityInversionCases   []PriorityInversionCase     `json:"priority_inversion_cases"`
	StarvationIndicators     []StarvationIndicator       `json:"starvation_indicators"`
	PriorityDistribution     map[int]PriorityStats       `json:"priority_distribution"`
	WaitTimeByPriority       map[int]WaitTimeStats       `json:"wait_time_by_priority"`
}

type PriorityStats struct {
	TotalJobs     int64   `json:"total_jobs"`
	SuccessRate   float64 `json:"success_rate"`
	AvgWaitTimeMs float64 `json:"avg_wait_time_ms"`
}

type WaitTimeStats struct {
	AvgMs   float64 `json:"avg_ms"`
	P50Ms   float64 `json:"p50_ms"`
	P95Ms   float64 `json:"p95_ms"`
	P99Ms   float64 `json:"p99_ms"`
	MaxMs   int64   `json:"max_ms"`
}

type PriorityInversionCase struct {
	Timestamp          time.Time `json:"timestamp"`
	HighPriorityJobID  string    `json:"high_priority_job_id"`
	LowPriorityJobID   string    `json:"low_priority_job_id"`
	HighPriority       int       `json:"high_priority"`
	LowPriority        int       `json:"low_priority"`
	HighPriorityWaitMs int64     `json:"high_priority_wait_ms"`
	LowPriorityExecMs  int64     `json:"low_priority_exec_ms"`
	Severity           string    `json:"severity"`
}

type StarvationIndicator struct {
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	PriorityLevel    int       `json:"priority_level"`
	WaitTimeMs       int64     `json:"wait_time_ms"`
	QueuedJobsCount  int64     `json:"queued_jobs_count"`
	ProcessedJobsCount int64   `json:"processed_jobs_count"`
}

type DeadLetterAnalysis struct {
	TotalDeadLetterJobs int64                  `json:"total_dead_letter_jobs"`
	DeadLetterRate      float64                `json:"dead_letter_rate"`
	ByReason            map[string]int64       `json:"by_reason"`
	ByJobType           map[string]int64       `json:"by_job_type"`
	ByPriority          map[int]int64          `json:"by_priority"`
	AvgRetryBeforeDLQ   float64                `json:"avg_retry_before_dlq"`
	RecentDeadLetters   []DeadLetterJob        `json:"recent_dead_letters,omitempty"`
}

type DeadLetterJob struct {
	JobID       string    `json:"job_id"`
	JobType     string    `json:"job_type"`
	Priority    int       `json:"priority"`
	FailReason  string    `json:"fail_reason"`
	RetryCount  int       `json:"retry_count"`
	DeadLetterTime time.Time `json:"dead_letter_time"`
}

type TimeoutAnalysis struct {
	TotalTimeouts         int64                `json:"total_timeouts"`
	TimeoutRate           float64              `json:"timeout_rate"`
	ByJobType             map[string]int64     `json:"by_job_type"`
	ByTimeoutThreshold    map[string]TimeoutStats `json:"by_timeout_threshold"`
	AvgTimeoutOccurrence  float64              `json:"avg_timeout_occurrence"`
	TimeoutStormCases     []TimeoutStormCase   `json:"timeout_storm_cases"`
}

type TimeoutStats struct {
	ThresholdMs int64   `json:"threshold_ms"`
	Count       int64   `json:"count"`
	AvgExecMs   float64 `json:"avg_exec_ms"`
}

type TimeoutStormCase struct {
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Count       int64     `json:"count"`
	AffectedJobTypes []string `json:"affected_job_types"`
}

type Recommendation struct {
	ID           string   `json:"id"`
	Category     string   `json:"category"`
	Priority     string   `json:"priority"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	RootCause    string   `json:"root_cause"`
	Suggestion   string   `json:"suggestion"`
	Evidence     string   `json:"evidence"`
	Impact       string   `json:"impact"`
	RelatedData  []string `json:"related_data,omitempty"`
}

type Anomaly struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Timestamp   time.Time `json:"timestamp"`
	Description string    `json:"description"`
	Details     string    `json:"details"`
}
