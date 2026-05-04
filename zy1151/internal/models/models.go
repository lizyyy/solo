package models

import (
	"time"
)

type Batch struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	ServiceName string    `json:"service_name" db:"service_name"`
}

type SamplePoint struct {
	ID           string    `json:"id" db:"id"`
	BatchID      string    `json:"batch_id" db:"batch_id"`
	Timestamp    time.Time `json:"timestamp" db:"timestamp"`
	Description  string    `json:"description,omitempty" db:"description"`
	SourceType   string    `json:"source_type" db:"source_type"`
}

type MemStatsRecord struct {
	ID                string    `json:"id" db:"id"`
	SamplePointID     string    `json:"sample_point_id" db:"sample_point_id"`
	Timestamp         time.Time `json:"timestamp" db:"timestamp"`
	Alloc             uint64    `json:"alloc" db:"alloc"`
	TotalAlloc        uint64    `json:"total_alloc" db:"total_alloc"`
	Sys               uint64    `json:"sys" db:"sys"`
	Lookups           uint64    `json:"lookups" db:"lookups"`
	Mallocs           uint64    `json:"mallocs" db:"mallocs"`
	Frees             uint64    `json:"frees" db:"frees"`
	HeapAlloc         uint64    `json:"heap_alloc" db:"heap_alloc"`
	HeapSys           uint64    `json:"heap_sys" db:"heap_sys"`
	HeapIdle          uint64    `json:"heap_idle" db:"heap_idle"`
	HeapInuse         uint64    `json:"heap_inuse" db:"heap_inuse"`
	HeapReleased      uint64    `json:"heap_released" db:"heap_released"`
	HeapObjects       uint64    `json:"heap_objects" db:"heap_objects"`
	StackInuse        uint64    `json:"stack_inuse" db:"stack_inuse"`
	StackSys          uint64    `json:"stack_sys" db:"stack_sys"`
	MSpanInuse        uint64    `json:"mspan_inuse" db:"mspan_inuse"`
	MSpanSys          uint64    `json:"mspan_sys" db:"mspan_sys"`
	MCacheInuse       uint64    `json:"mcache_inuse" db:"mcache_inuse"`
	MCacheSys         uint64    `json:"mcache_sys" db:"mcache_sys"`
	BuckHashSys       uint64    `json:"buck_hash_sys" db:"buck_hash_sys"`
	GCSys             uint64    `json:"gc_sys" db:"gc_sys"`
	OtherSys          uint64    `json:"other_sys" db:"other_sys"`
	NextGC            uint64    `json:"next_gc" db:"next_gc"`
	LastGC            uint64    `json:"last_gc" db:"last_gc"`
	PauseTotalNs      uint64    `json:"pause_total_ns" db:"pause_total_ns"`
	PauseNs           []uint64  `json:"pause_ns" db:"pause_ns"`
	NumGC             uint32    `json:"num_gc" db:"num_gc"`
	NumForcedGC       uint32    `json:"num_forced_gc" db:"num_forced_gc"`
	GCCPUFraction     float64   `json:"gc_cpu_fraction" db:"gc_cpu_fraction"`
	RSS               uint64    `json:"rss,omitempty" db:"rss"`
}

type GoroutineRecord struct {
	ID            string    `json:"id" db:"id"`
	SamplePointID string    `json:"sample_point_id" db:"sample_point_id"`
	GoroutineID   uint64    `json:"goroutine_id" db:"goroutine_id"`
	Status        string    `json:"status" db:"status"`
	Stack         string    `json:"stack" db:"stack"`
	Function      string    `json:"function" db:"function"`
	File          string    `json:"file" db:"file"`
	Line          int       `json:"line" db:"line"`
	WaitDuration  int64     `json:"wait_duration,omitempty" db:"wait_duration"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

type AllocSite struct {
	ID            string    `json:"id" db:"id"`
	SamplePointID string    `json:"sample_point_id" db:"sample_point_id"`
	Function      string    `json:"function" db:"function"`
	File          string    `json:"file" db:"file"`
	Line          int       `json:"line" db:"line"`
	AllocBytes    uint64    `json:"alloc_bytes" db:"alloc_bytes"`
	AllocObjects  uint64    `json:"alloc_objects" db:"alloc_objects"`
	InuseBytes    uint64    `json:"inuse_bytes" db:"inuse_bytes"`
	InuseObjects  uint64    `json:"inuse_objects" db:"inuse_objects"`
	StackID       string    `json:"stack_id,omitempty" db:"stack_id"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

type TrafficRecord struct {
	ID            string    `json:"id" db:"id"`
	SamplePointID string    `json:"sample_point_id" db:"sample_point_id"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
	Endpoint      string    `json:"endpoint" db:"endpoint"`
	Method        string    `json:"method,omitempty" db:"method"`
	Requests      uint64    `json:"requests" db:"requests"`
	Errors        uint64    `json:"errors,omitempty" db:"errors"`
	LatencyP50    float64   `json:"latency_p50,omitempty" db:"latency_p50"`
	LatencyP99    float64   `json:"latency_p99,omitempty" db:"latency_p99"`
	QPS           float64   `json:"qps" db:"qps"`
}

type ConfigRecord struct {
	ID            string    `json:"id" db:"id"`
	SamplePointID string    `json:"sample_point_id" db:"sample_point_id"`
	Key           string    `json:"key" db:"key"`
	Value         string    `json:"value" db:"value"`
	Source        string    `json:"source,omitempty" db:"source"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

type HeapProfileRecord struct {
	ID            string    `json:"id" db:"id"`
	SamplePointID string    `json:"sample_point_id" db:"sample_point_id"`
	Type          string    `json:"type" db:"type"`
	Function      string    `json:"function" db:"function"`
	File          string    `json:"file" db:"file"`
	Line          int       `json:"line" db:"line"`
	InuseBytes    uint64    `json:"inuse_bytes" db:"inuse_bytes"`
	InuseObjects  uint64    `json:"inuse_objects" db:"inuse_objects"`
	AllocBytes    uint64    `json:"alloc_bytes" db:"alloc_bytes"`
	AllocObjects  uint64    `json:"alloc_objects" db:"alloc_objects"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

type AnalysisResult struct {
	ID          string            `json:"id" db:"id"`
	BatchID     string            `json:"batch_id" db:"batch_id"`
	CreatedAt   time.Time         `json:"created_at" db:"created_at"`
	Conclusion  string            `json:"conclusion" db:"conclusion"`
	Confidence  float64           `json:"confidence" db:"confidence"`
	RiskLevel   string            `json:"risk_level" db:"risk_level"`
	Findings    []Finding         `json:"findings" db:"-"`
	Evidence    []EvidenceItem    `json:"evidence" db:"-"`
	Recommendations []Recommendation `json:"recommendations" db:"-"`
}

type Finding struct {
	ID           string  `json:"id"`
	AnalysisID   string  `json:"analysis_id"`
	Category     string  `json:"category"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	Confidence   float64 `json:"confidence"`
	Severity     string  `json:"severity"`
	Source       string  `json:"source"`
}

type EvidenceItem struct {
	ID         string `json:"id"`
	AnalysisID string `json:"analysis_id"`
	FindingID  string `json:"finding_id"`
	Type       string `json:"type"`
	Value      string `json:"value"`
	Details    string `json:"details,omitempty"`
	Source     string `json:"source"`
}

type Recommendation struct {
	ID         string `json:"id"`
	AnalysisID string `json:"analysis_id"`
	Priority   string `json:"priority"`
	Action     string `json:"action"`
	Details    string `json:"details,omitempty"`
}

type CompareResult struct {
	ID           string             `json:"id"`
	BaseBatchID  string             `json:"base_batch_id"`
	TargetBatchID string            `json:"target_batch_id"`
	CreatedAt    time.Time          `json:"created_at"`
	Differences  []Difference       `json:"differences"`
	Conclusion   string             `json:"conclusion"`
	Confidence   float64            `json:"confidence"`
}

type Difference struct {
	ID           string  `json:"id"`
	CompareID    string  `json:"compare_id"`
	Category     string  `json:"category"`
	Metric       string  `json:"metric"`
	BaseValue    string  `json:"base_value"`
	TargetValue  string  `json:"target_value"`
	ChangePct    float64 `json:"change_pct"`
	Importance   string  `json:"importance"`
	Description  string  `json:"description"`
}

type SimulationParams struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	CreatedAt       time.Time              `json:"created_at"`
	Params          map[string]interface{} `json:"params"`
}

type SimulationResult struct {
	ID           string                 `json:"id"`
	ParamsID     string                 `json:"params_id"`
	CreatedAt    time.Time              `json:"created_at"`
	RiskLevel    string                 `json:"risk_level"`
	Metrics      map[string]interface{} `json:"metrics"`
	Conclusion   string                 `json:"conclusion"`
	Warnings     []string               `json:"warnings"`
}

type ServiceInfo struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
