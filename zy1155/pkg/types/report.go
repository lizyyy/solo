package types

import "time"

type Report struct {
	Version         string                 `json:"version"`
	GeneratedAt     time.Time              `json:"generated_at"`
	ProjectName     string                 `json:"project_name"`
	SchemaInfo      SchemaReport           `json:"schema_info"`
	PayloadInfo     PayloadReport          `json:"payload_info"`
	Compatibility   CompatibilityReport    `json:"compatibility"`
	Performance     PerformanceReport      `json:"performance"`
	Recommendations []Recommendation       `json:"recommendations"`
	Summary         Summary                `json:"summary"`
}

type SchemaReport struct {
	SourceType   string              `json:"source_type"`
	SourceFile   string              `json:"source_file"`
	MessageCount int                 `json:"message_count"`
	EnumCount    int                 `json:"enum_count"`
	Messages     []MessageSummary    `json:"messages"`
}

type MessageSummary struct {
	Name        string `json:"name"`
	FieldCount  int    `json:"field_count"`
	Description string `json:"description"`
}

type PayloadReport struct {
	SourceFile  string          `json:"source_file"`
	TotalCount  int             `json:"total_count"`
	MessageType string          `json:"message_type"`
	SampleSize  int             `json:"sample_size"`
}

type CompatibilityReport struct {
	Issues        IssueCollection  `json:"issues"`
	HasBreaking   bool             `json:"has_breaking"`
	RiskLevel     string           `json:"risk_level"`
}

type PerformanceReport struct {
	Benchmarks    BenchmarkCollection  `json:"benchmarks"`
	Comparisons   ComparisonReport     `json:"comparisons"`
}

type Recommendation struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Action      string `json:"action"`
}

type Summary struct {
	OverallRiskLevel     string  `json:"overall_risk_level"`
	TotalIssues          int     `json:"total_issues"`
	CriticalIssues       int     `json:"critical_issues"`
	HighIssues           int     `json:"high_issues"`
	ProtobufSizeReduction float64 `json:"protobuf_size_reduction"`
	MsgpackSizeReduction  float64 `json:"msgpack_size_reduction"`
	ProtobufSpeedup       float64 `json:"protobuf_speedup"`
	MsgpackSpeedup        float64 `json:"msgpack_speedup"`
}
