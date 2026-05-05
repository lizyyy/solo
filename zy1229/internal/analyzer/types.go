package analyzer

import (
	"time"
)

// ProfileType 定义性能剖析数据类型
type ProfileType string

const (
	ProfileTypeCPU    ProfileType = "cpu"
	ProfileTypeHeap   ProfileType = "heap"
	ProfileTypeBlock  ProfileType = "block"
	ProfileTypeMutex  ProfileType = "mutex"
	ProfileTypeTrace  ProfileType = "trace"
	ProfileTypeBench  ProfileType = "benchstat"
)

// Profile 表示单个性能剖析数据
type Profile struct {
	ID        string
	Type      ProfileType
	Path      string
	Name      string
	CreatedAt time.Time
}

// StackFrame 表示调用栈帧
type StackFrame struct {
	Function string
	File     string
	Line     int
}

// CallStack 表示调用栈
type CallStack struct {
	Frames []StackFrame
}

// CPUProfileSample CPU 剖析样本
type CPUProfileSample struct {
	CallStack CallStack
	Value     int64
}

// HeapProfileSample 堆内存剖析样本
type HeapProfileSample struct {
	CallStack CallStack
	InUseBytes int64
	InUseObjects int64
	AllocBytes int64
	AllocObjects int64
}

// BlockProfileSample 阻塞剖析样本
type BlockProfileSample struct {
	CallStack CallStack
	Count int64
	Nanoseconds int64
}

// MutexProfileSample 锁竞争剖析样本
type MutexProfileSample struct {
	CallStack CallStack
	Count int64
	Nanoseconds int64
}

// TraceEvent 运行时追踪事件
type TraceEvent struct {
	Type string
	GoroutineID uint64
	Timestamp time.Duration
	Duration time.Duration
	Stack CallStack
}

// BenchmarkResult 基准测试结果
type BenchmarkResult struct {
	Name string
	Iterations int64
	NsPerOp float64
	MBPerSec float64
	BytesPerOp int64
	AllocsPerOp int64
}

// BottleneckType 瓶颈类型
type BottleneckType string

const (
	BottleneckTypeCPU      BottleneckType = "cpu"
	BottleneckTypeMemory   BottleneckType = "memory"
	BottleneckTypeBlocking BottleneckType = "blocking"
	BottleneckTypeMutex    BottleneckType = "mutex"
	BottleneckTypeGoroutine BottleneckType = "goroutine"
)

// Bottleneck 表示性能瓶颈
type Bottleneck struct {
	Type           BottleneckType
	Severity       float64
	Description    string
	Evidence       string
	CallStack      CallStack
	Samples        int64
	Value          float64
	Recommendation string
}

// Recommendation 优化建议
type Recommendation struct {
	Title       string
	Description string
	Priority    int
	Evidence    string
}

// Analysis 表示一次完整的分析结果
type Analysis struct {
	ID           string
	Name         string
	CreatedAt    time.Time
	Profiles     []Profile
	Bottlenecks  []Bottleneck
	Recommendations []Recommendation
	CPUProfile   []CPUProfileSample
	HeapProfile  []HeapProfileSample
	BlockProfile []BlockProfileSample
	MutexProfile []MutexProfileSample
	TraceEvents  []TraceEvent
	Benchmarks   []BenchmarkResult
	Summary      AnalysisSummary
}

// AnalysisSummary 分析摘要
type AnalysisSummary struct {
	TotalCPUSamples      int64
	TotalHeapAlloc       int64
	TotalHeapInUse       int64
	TotalBlockCount      int64
	TotalMutexCount      int64
	TopCPUBottlenecks    []string
	TopMemoryBottlenecks []string
	TopLockingBottlenecks []string
}

// Comparison 两次分析的对比结果
type Comparison struct {
	ID           string
	OldAnalysis  Analysis
	NewAnalysis  Analysis
	CreatedAt    time.Time
	Differences  []Difference
	Improvements []Improvement
	Regressions  []Regression
	Summary      ComparisonSummary
}

// Difference 分析差异
type Difference struct {
	Field       string
	OldValue    string
	NewValue    string
	Change      float64
	Percentage  float64
}

// Improvement 改进项
type Improvement struct {
	Metric      string
	OldValue    float64
	NewValue    float64
	Improvement float64
	Description string
}

// Regression 回归项
type Regression struct {
	Metric      string
	OldValue    float64
	NewValue    float64
	Regression  float64
	Description string
}

// ComparisonSummary 对比摘要
type ComparisonSummary struct {
	TotalImprovements int
	TotalRegressions  int
	OverallScore      float64
	PrimaryMetric     string
}
