package analyzer

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"go-runtime-analyzer/storage"
)

// AnalysisConfig 分析配置
type AnalysisConfig struct {
	StackThresholdKB     int64 `json:"stack_threshold_kb"`
	LatencyThresholdUS   int64 `json:"latency_threshold_us"`
	HighSyscallThreshold int64 `json:"high_syscall_threshold_us"`
}

// DefaultAnalysisConfig 默认配置
func DefaultAnalysisConfig() *AnalysisConfig {
	return &AnalysisConfig{
		StackThresholdKB:     1024, // 1MB
		LatencyThresholdUS:   100,  // 100us
		HighSyscallThreshold: 1000, // 1ms
	}
}

// AnalysisResult 分析结果
type AnalysisResult struct {
	GeneratedAt     time.Time             `json:"generated_at"`
	Config          *AnalysisConfig       `json:"config"`
	Summary         AnalysisSummary       `json:"summary"`
	StackAnalysis   StackAnalysis         `json:"stack_analysis"`
	PreemptAnalysis PreemptAnalysis       `json:"preempt_analysis"`
	SchedAnalysis   SchedAnalysis         `json:"sched_analysis"`
	LatencyAnalysis LatencyAnalysis       `json:"latency_analysis"`
	CodeIssues      []CodeIssueSummary    `json:"code_issues"`
	BenchmarkTrends []BenchmarkComparison `json:"benchmark_trends"`
	Recommendations []Recommendation      `json:"recommendations"`
}

// AnalysisSummary 分析摘要
type AnalysisSummary struct {
	TotalStacktraces   int `json:"total_stacktraces"`
	TotalPreemptEvents int `json:"total_preempt_events"`
	TotalSchedtraces   int `json:"total_schedtraces"`
	TotalCodeSnippets  int `json:"total_code_snippets"`
	TotalBenchmarks    int `json:"total_benchmarks"`
	TotalGoroutines    int `json:"total_goroutines"`
}

// StackAnalysis 栈分析
type StackAnalysis struct {
	TotalGrowthEvents   int64             `json:"total_growth_events"`
	TotalShrinkEvents   int64             `json:"total_shrink_events"`
	LargestStackSize    int64             `json:"largest_stack_size_bytes"`
	AverageGrowthSize   int64             `json:"average_growth_size_bytes"`
	StacksOverThreshold int               `json:"stacks_over_threshold"`
	GrowthByGoroutine   map[int]int64     `json:"growth_by_goroutine"`
	StackSizeHistory    []StackSizeRecord `json:"stack_size_history,omitempty"`
}

// StackSizeRecord 栈大小记录
type StackSizeRecord struct {
	Timestamp   time.Time `json:"timestamp"`
	GoroutineID int       `json:"goroutine_id"`
	OldSize     int64     `json:"old_size"`
	NewSize     int64     `json:"new_size"`
	GrowthType  string    `json:"growth_type"`
}

// PreemptAnalysis 抢占分析
type PreemptAnalysis struct {
	TotalAsyncPreempts     int64              `json:"total_async_preempts"`
	TotalStackGrowths      int64              `json:"total_stack_growths"`
	TotalNosplitCalls      int64              `json:"total_nosplit_calls"`
	TotalSyscallBlocks     int64              `json:"total_syscall_blocks"`
	PreemptsByReason       map[string]int64   `json:"preempts_by_reason"`
	AveragePreemptLatency  int64              `json:"average_preempt_latency_us"`
	MaxPreemptLatency      int64              `json:"max_preempt_latency_us"`
	TopOffendingGoroutines []GoroutineOffense `json:"top_offending_goroutines"`
}

// GoroutineOffense goroutine 违规记录
type GoroutineOffense struct {
	GoroutineID int     `json:"goroutine_id"`
	Count       int64   `json:"count"`
	TotalDelay  int64   `json:"total_delay_us"`
	AvgDelay    float64 `json:"avg_delay_us"`
	EventType   string  `json:"event_type"`
}

// SchedAnalysis 调度分析
type SchedAnalysis struct {
	AverageGOMAXPROCS     float64                `json:"average_gomaxprocs"`
	AverageIdleProcs      float64                `json:"average_idle_procs"`
	AverageRunQueue       float64                `json:"average_run_queue"`
	MaxRunQueue           int                    `json:"max_run_queue"`
	AverageThreads        float64                `json:"average_threads"`
	MostCommonStatus      string                 `json:"most_common_status"`
	GoroutinesByStatus    map[string]int         `json:"goroutines_by_status"`
	HighLatencyGoroutines []HighLatencyGoroutine `json:"high_latency_goroutines"`
}

// HighLatencyGoroutine 高延迟 goroutine
type HighLatencyGoroutine struct {
	GoroutineID int    `json:"goroutine_id"`
	Status      string `json:"status"`
	MaxLatency  int64  `json:"max_latency_us"`
	AvgLatency  int64  `json:"avg_latency_us"`
	Count       int    `json:"count"`
}

// LatencyAnalysis 延迟分析
type LatencyAnalysis struct {
	TotalLatencyEvents int64            `json:"total_latency_events"`
	TotalLatencyUS     int64            `json:"total_latency_us"`
	AverageLatencyUS   int64            `json:"average_latency_us"`
	MaxLatencyUS       int64            `json:"max_latency_us"`
	LatencyByType      map[string]int64 `json:"latency_by_type"`
	LatencySpikes      []LatencySpike   `json:"latency_spikes"`
}

// LatencySpike 延迟尖刺
type LatencySpike struct {
	Timestamp   time.Time `json:"timestamp"`
	GoroutineID int       `json:"goroutine_id"`
	EventType   string    `json:"event_type"`
	LatencyUS   int64     `json:"latency_us"`
	Details     string    `json:"details,omitempty"`
}

// CodeIssueSummary 代码问题摘要
type CodeIssueSummary struct {
	FilePath    string `json:"file_path"`
	IssueType   string `json:"issue_type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Line        int    `json:"line"`
}

// BenchmarkComparison benchmark 比较
type BenchmarkComparison struct {
	TestName      string  `json:"test_name"`
	LatestNsPerOp int64   `json:"latest_ns_per_op"`
	ChangePct     float64 `json:"change_pct"`
	Trend         string  `json:"trend"` // improving, worsening, stable
	Count         int     `json:"count"`
}

// Recommendation 建议
type Recommendation struct {
	Priority    string `json:"priority"` // high, medium, low
	Category    string `json:"category"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Suggestion  string `json:"suggestion"`
	Evidence    string `json:"evidence,omitempty"`
}

// Analyzer 分析器
type Analyzer struct {
	db     *storage.DB
	config *AnalysisConfig
}

// NewAnalyzer 创建新的分析器
func NewAnalyzer(db *storage.DB, config *AnalysisConfig) *Analyzer {
	if config == nil {
		config = DefaultAnalysisConfig()
	}
	return &Analyzer{
		db:     db,
		config: config,
	}
}

// Analyze 执行完整分析
func (a *Analyzer) Analyze() (*AnalysisResult, error) {
	result := &AnalysisResult{
		GeneratedAt: time.Now(),
		Config:      a.config,
	}

	// 获取基础数据
	stacktraces, _ := a.db.GetAllStacktraces()
	preemptEvents, _ := a.db.GetAllPreemptEvents()
	schedtraces, _ := a.db.GetAllSchedtraces()
	snippets, _ := a.db.GetAllSnippets()
	benchmarks, _ := a.db.GetAllBenchmarks()
	stackGrowths, _ := a.db.GetStackGrowths()

	// 填充摘要
	result.Summary = AnalysisSummary{
		TotalStacktraces:   len(stacktraces),
		TotalPreemptEvents: len(preemptEvents),
		TotalSchedtraces:   len(schedtraces),
		TotalCodeSnippets:  len(snippets),
		TotalBenchmarks:    len(benchmarks),
		TotalGoroutines:    countUniqueGoroutines(stacktraces, preemptEvents),
	}

	// 分析栈
	result.StackAnalysis = a.analyzeStack(stacktraces, stackGrowths)

	// 分析抢占
	result.PreemptAnalysis = a.analyzePreempt(preemptEvents)

	// 分析调度
	result.SchedAnalysis = a.analyzeSched(schedtraces)

	// 分析延迟
	result.LatencyAnalysis = a.analyzeLatency(preemptEvents, schedtraces)

	// 分析代码问题
	result.CodeIssues = a.analyzeCodeIssues(snippets)

	// 分析 benchmark 趋势
	result.BenchmarkTrends = a.analyzeBenchmarks(benchmarks)

	// 生成建议
	result.Recommendations = a.generateRecommendations(result)

	return result, nil
}

// 分析栈增长
func (a *Analyzer) analyzeStack(stacktraces []storage.Stacktrace, growths []storage.StackGrowth) StackAnalysis {
	analysis := StackAnalysis{
		GrowthByGoroutine: make(map[int]int64),
	}

	// 统计增长/收缩事件
	for _, g := range growths {
		if g.GrowthType == "growth" {
			analysis.TotalGrowthEvents++
			analysis.StackSizeHistory = append(analysis.StackSizeHistory, StackSizeRecord{
				GoroutineID: 0, // 暂时无法关联
				OldSize:     g.OldSize,
				NewSize:     g.NewSize,
				GrowthType:  g.GrowthType,
			})
		} else if g.GrowthType == "shrink" {
			analysis.TotalShrinkEvents++
		}

		// 跟踪最大栈大小
		if g.NewSize > analysis.LargestStackSize {
			analysis.LargestStackSize = g.NewSize
		}

		// 计算平均增长
		if g.GrowthType == "growth" {
			analysis.AverageGrowthSize += (g.NewSize - g.OldSize)
		}
	}

	if analysis.TotalGrowthEvents > 0 {
		analysis.AverageGrowthSize /= analysis.TotalGrowthEvents
	}

	// 检查超过阈值的栈
	thresholdBytes := a.config.StackThresholdKB * 1024
	for _, g := range growths {
		if g.NewSize > thresholdBytes {
			analysis.StacksOverThreshold++
		}
	}

	return analysis
}

// 分析抢占
func (a *Analyzer) analyzePreempt(events []storage.PreemptEvent) PreemptAnalysis {
	analysis := PreemptAnalysis{
		PreemptsByReason:       make(map[string]int64),
		TopOffendingGoroutines: make([]GoroutineOffense, 0),
	}

	goroutineStats := make(map[int]map[string]goroutineStat) // goroutineID -> eventType -> stat
	var totalLatency int64
	var maxLatency int64
	var latencyCount int64

	for _, e := range events {
		// 按类型统计
		switch e.EventType {
		case "async_preempt":
			analysis.TotalAsyncPreempts++
		case "stack_growth":
			analysis.TotalStackGrowths++
		case "nosplit_call":
			analysis.TotalNosplitCalls++
		case "syscall_block":
			analysis.TotalSyscallBlocks++
		}

		// 按原因统计
		if e.Reason != "" {
			analysis.PreemptsByReason[e.Reason]++
		}

		// 统计延迟
		if e.Duration > 0 {
			totalLatency += e.Duration
			latencyCount++
			if e.Duration > maxLatency {
				maxLatency = e.Duration
			}
		}

		// 按 goroutine 统计
		if goroutineStats[e.GoroutineID] == nil {
			goroutineStats[e.GoroutineID] = make(map[string]goroutineStat)
		}
		stat := goroutineStats[e.GoroutineID][e.EventType]
		stat.count++
		stat.totalDelay += e.Duration
		goroutineStats[e.GoroutineID][e.EventType] = stat
	}

	if latencyCount > 0 {
		analysis.AveragePreemptLatency = totalLatency / latencyCount
	}
	analysis.MaxPreemptLatency = maxLatency

	// 找出问题最严重的 goroutine
	for gid, typeMap := range goroutineStats {
		for eventType, stat := range typeMap {
			if stat.totalDelay > a.config.LatencyThresholdUS || stat.count > 5 {
				analysis.TopOffendingGoroutines = append(analysis.TopOffendingGoroutines, GoroutineOffense{
					GoroutineID: gid,
					Count:       stat.count,
					TotalDelay:  stat.totalDelay,
					AvgDelay:    float64(stat.totalDelay) / float64(stat.count),
					EventType:   eventType,
				})
			}
		}
	}

	// 按总延迟排序
	sort.Slice(analysis.TopOffendingGoroutines, func(i, j int) bool {
		return analysis.TopOffendingGoroutines[i].TotalDelay > analysis.TopOffendingGoroutines[j].TotalDelay
	})

	// 只保留前 10 个
	if len(analysis.TopOffendingGoroutines) > 10 {
		analysis.TopOffendingGoroutines = analysis.TopOffendingGoroutines[:10]
	}

	return analysis
}

type goroutineStat struct {
	count      int64
	totalDelay int64
}

// 分析调度
func (a *Analyzer) analyzeSched(traces []storage.Schedtrace) SchedAnalysis {
	analysis := SchedAnalysis{
		GoroutinesByStatus:    make(map[string]int),
		HighLatencyGoroutines: make([]HighLatencyGoroutine, 0),
	}

	if len(traces) == 0 {
		return analysis
	}

	var totalGOMAXPROCS, totalIdleProcs, totalRunQueue, totalThreads float64
	var maxRunQueue int

	goroutineLatency := make(map[int]goroutineLatencyStat) // goroutineID -> stat
	statusCount := make(map[string]int)

	for _, t := range traces {
		totalGOMAXPROCS += float64(t.GOMAXPROCS)
		totalIdleProcs += float64(t.IdleProcs)
		totalRunQueue += float64(t.RunQueue)
		totalThreads += float64(t.Threads)

		if t.RunQueue > maxRunQueue {
			maxRunQueue = t.RunQueue
		}

		// 获取该 schedtrace 的 goroutines
		goroutines, _ := a.db.GetSchedGoroutinesByTraceID(t.ID)
		for _, g := range goroutines {
			statusCount[g.Status]++

			// 统计高延迟
			if g.Latency > a.config.LatencyThresholdUS {
				stat := goroutineLatency[g.GoroutineID]
				stat.count++
				stat.totalLatency += g.Latency
				if g.Latency > stat.maxLatency {
					stat.maxLatency = g.Latency
				}
				stat.status = g.Status
				goroutineLatency[g.GoroutineID] = stat
			}
		}
	}

	n := float64(len(traces))
	analysis.AverageGOMAXPROCS = totalGOMAXPROCS / n
	analysis.AverageIdleProcs = totalIdleProcs / n
	analysis.AverageRunQueue = totalRunQueue / n
	analysis.MaxRunQueue = maxRunQueue
	analysis.AverageThreads = totalThreads / n
	analysis.GoroutinesByStatus = statusCount

	// 找出最常见的状态
	var maxCount int
	for status, count := range statusCount {
		if count > maxCount {
			maxCount = count
			analysis.MostCommonStatus = status
		}
	}

	// 构建高延迟 goroutine 列表
	for gid, stat := range goroutineLatency {
		analysis.HighLatencyGoroutines = append(analysis.HighLatencyGoroutines, HighLatencyGoroutine{
			GoroutineID: gid,
			Status:      stat.status,
			MaxLatency:  stat.maxLatency,
			AvgLatency:  stat.totalLatency / int64(stat.count),
			Count:       stat.count,
		})
	}

	// 按最大延迟排序
	sort.Slice(analysis.HighLatencyGoroutines, func(i, j int) bool {
		return analysis.HighLatencyGoroutines[i].MaxLatency > analysis.HighLatencyGoroutines[j].MaxLatency
	})

	// 只保留前 10 个
	if len(analysis.HighLatencyGoroutines) > 10 {
		analysis.HighLatencyGoroutines = analysis.HighLatencyGoroutines[:10]
	}

	return analysis
}

type goroutineLatencyStat struct {
	count        int
	totalLatency int64
	maxLatency   int64
	status       string
}

// 分析延迟
func (a *Analyzer) analyzeLatency(events []storage.PreemptEvent, traces []storage.Schedtrace) LatencyAnalysis {
	analysis := LatencyAnalysis{
		LatencyByType: make(map[string]int64),
		LatencySpikes: make([]LatencySpike, 0),
	}

	var totalLatency int64
	var maxLatency int64
	var eventCount int64

	// 从抢占事件中提取延迟
	for _, e := range events {
		if e.Duration > 0 {
			totalLatency += e.Duration
			eventCount++
			analysis.LatencyByType[e.EventType] += e.Duration

			if e.Duration > maxLatency {
				maxLatency = e.Duration
			}

			// 记录延迟尖刺
			if e.Duration > a.config.HighSyscallThreshold {
				analysis.LatencySpikes = append(analysis.LatencySpikes, LatencySpike{
					Timestamp:   e.Timestamp,
					GoroutineID: e.GoroutineID,
					EventType:   e.EventType,
					LatencyUS:   e.Duration,
					Details:     e.Reason,
				})
			}
		}
	}

	if eventCount > 0 {
		analysis.TotalLatencyEvents = eventCount
		analysis.TotalLatencyUS = totalLatency
		analysis.AverageLatencyUS = totalLatency / eventCount
		analysis.MaxLatencyUS = maxLatency
	}

	// 按延迟排序尖刺
	sort.Slice(analysis.LatencySpikes, func(i, j int) bool {
		return analysis.LatencySpikes[i].LatencyUS > analysis.LatencySpikes[j].LatencyUS
	})

	// 只保留前 20 个
	if len(analysis.LatencySpikes) > 20 {
		analysis.LatencySpikes = analysis.LatencySpikes[:20]
	}

	return analysis
}

// 分析代码问题
func (a *Analyzer) analyzeCodeIssues(snippets []storage.CodeSnippet) []CodeIssueSummary {
	var issues []CodeIssueSummary

	for _, s := range snippets {
		if s.Issues == "" || s.Issues == "[]" {
			continue
		}

		var parsedIssues []CodeIssueSummary
		if err := json.Unmarshal([]byte(s.Issues), &parsedIssues); err == nil {
			// 添加文件路径
			for i := range parsedIssues {
				parsedIssues[i].FilePath = s.FilePath
			}
			issues = append(issues, parsedIssues...)
		}
	}

	return issues
}

// 分析 benchmark 趋势
func (a *Analyzer) analyzeBenchmarks(benchmarks []storage.BenchmarkResult) []BenchmarkComparison {
	// 按测试名分组
	byTest := make(map[string][]storage.BenchmarkResult)
	for _, b := range benchmarks {
		byTest[b.TestName] = append(byTest[b.TestName], b)
	}

	var comparisons []BenchmarkComparison

	for testName, results := range byTest {
		if len(results) < 2 {
			// 数据点不足，无法比较
			comparisons = append(comparisons, BenchmarkComparison{
				TestName:      testName,
				LatestNsPerOp: results[0].NsPerOp,
				ChangePct:     0,
				Trend:         "stable",
				Count:         len(results),
			})
			continue
		}

		// 按时间排序
		sort.Slice(results, func(i, j int) bool {
			return results[i].Timestamp.Before(results[j].Timestamp)
		})

		first := results[0]
		latest := results[len(results)-1]

		changePct := float64(latest.NsPerOp-first.NsPerOp) / float64(first.NsPerOp) * 100

		trend := "stable"
		if changePct < -10 {
			trend = "improving"
		} else if changePct > 10 {
			trend = "worsening"
		}

		comparisons = append(comparisons, BenchmarkComparison{
			TestName:      testName,
			LatestNsPerOp: latest.NsPerOp,
			ChangePct:     changePct,
			Trend:         trend,
			Count:         len(results),
		})
	}

	return comparisons
}

// 生成建议
func (a *Analyzer) generateRecommendations(result *AnalysisResult) []Recommendation {
	var recommendations []Recommendation

	// 高优先级：严重的延迟问题
	if result.LatencyAnalysis.MaxLatencyUS > a.config.HighSyscallThreshold {
		recommendations = append(recommendations, Recommendation{
			Priority:    "high",
			Category:    "latency",
			Title:       "检测到严重的延迟尖刺",
			Description: fmt.Sprintf("最大延迟达到 %d µs，超过阈值 %d µs", result.LatencyAnalysis.MaxLatencyUS, a.config.HighSyscallThreshold),
			Suggestion:  "检查延迟最高的事件类型。如果是 syscall_block，考虑使用非阻塞 I/O 或异步处理；如果是 stack_growth，考虑预分配更大的栈；如果是 async_preempt，检查是否有长运行的计算循环。",
			Evidence:    fmt.Sprintf("最大延迟: %d µs, 延迟事件数: %d", result.LatencyAnalysis.MaxLatencyUS, result.LatencyAnalysis.TotalLatencyEvents),
		})
	}

	// 高优先级：频繁的栈增长
	if result.StackAnalysis.TotalGrowthEvents > 10 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "high",
			Category:    "stack",
			Title:       "频繁的栈增长操作",
			Description: fmt.Sprintf("检测到 %d 次栈增长事件，平均每次增长 %d 字节", result.StackAnalysis.TotalGrowthEvents, result.StackAnalysis.AverageGrowthSize),
			Suggestion:  "栈增长涉及拷贝整个栈，会带来显著延迟。考虑：1) 使用 runtime.Stack 检查实际栈使用情况；2) 在热点路径上预先分配足够的栈空间；3) 减少递归深度。",
			Evidence:    fmt.Sprintf("栈增长次数: %d, 平均增长: %d 字节, 最大栈: %d 字节", result.StackAnalysis.TotalGrowthEvents, result.StackAnalysis.AverageGrowthSize, result.StackAnalysis.LargestStackSize),
		})
	}

	// 中优先级：长运行的 goroutine
	if len(result.PreemptAnalysis.TopOffendingGoroutines) > 0 {
		worst := result.PreemptAnalysis.TopOffendingGoroutines[0]
		recommendations = append(recommendations, Recommendation{
			Priority:    "medium",
			Category:    "goroutine",
			Title:       "问题 Goroutine 检测",
			Description: fmt.Sprintf("Goroutine %d (%s) 累计延迟 %d µs，平均 %0.1f µs/次", worst.GoroutineID, worst.EventType, worst.TotalDelay, worst.AvgDelay),
			Suggestion:  "检查该 goroutine 的代码。如果是 async_preempt，可能是长循环；如果是 nosplit_call，检查 nosplit 函数链；如果是 syscall_block，考虑异步 I/O。",
			Evidence:    fmt.Sprintf("Goroutine %d: 事件数=%d, 总延迟=%d µs", worst.GoroutineID, worst.Count, worst.TotalDelay),
		})
	}

	// 中优先级：高 runqueue
	if result.SchedAnalysis.MaxRunQueue > 2 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "medium",
			Category:    "scheduling",
			Title:       "高 RunQueue 检测",
			Description: fmt.Sprintf("最大 RunQueue 达到 %d，平均 %0.1f", result.SchedAnalysis.MaxRunQueue, result.SchedAnalysis.AverageRunQueue),
			Suggestion:  "高 RunQueue 表示 goroutine 等待 CPU。考虑：1) 增加 GOMAXPROCS；2) 减少 goroutine 数量；3) 检查是否有 goroutine 占用 CPU 时间过长。",
			Evidence:    fmt.Sprintf("最大 RunQueue: %d, 平均: %0.1f, GOMAXPROCS: %0.1f", result.SchedAnalysis.MaxRunQueue, result.SchedAnalysis.AverageRunQueue, result.SchedAnalysis.AverageGOMAXPROCS),
		})
	}

	// 低优先级：代码问题
	severityCount := make(map[string]int)
	for _, issue := range result.CodeIssues {
		severityCount[issue.Severity]++
	}

	if severityCount["warning"] > 0 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "low",
			Category:    "code",
			Title:       "代码潜在问题",
			Description: fmt.Sprintf("检测到 %d 个警告级别的代码问题", severityCount["warning"]),
			Suggestion:  "审查代码片段中的问题。nosplit 函数可能导致栈问题；长循环可能导致抢占延迟；syscall 可能阻塞调度器。",
			Evidence:    fmt.Sprintf("警告: %d, 信息: %d", severityCount["warning"], severityCount["info"]),
		})
	}

	// 低优先级：benchmark 趋势
	worseningCount := 0
	for _, trend := range result.BenchmarkTrends {
		if trend.Trend == "worsening" {
			worseningCount++
		}
	}

	if worseningCount > 0 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "low",
			Category:    "benchmark",
			Title:       "Benchmark 性能下降",
			Description: fmt.Sprintf("有 %d 个 benchmark 显示性能下降趋势", worseningCount),
			Suggestion:  "调查性能下降的 benchmark。检查最近的代码变更，使用 pprof 定位热点。",
			Evidence:    fmt.Sprintf("下降: %d, 改善: %d, 稳定: %d", worseningCount, countTrends(result.BenchmarkTrends, "improving"), countTrends(result.BenchmarkTrends, "stable")),
		})
	}

	return recommendations
}

func countTrends(trends []BenchmarkComparison, target string) int {
	count := 0
	for _, t := range trends {
		if t.Trend == target {
			count++
		}
	}
	return count
}

// 辅助函数

func countUniqueGoroutines(stacktraces []storage.Stacktrace, events []storage.PreemptEvent) int {
	seen := make(map[int]bool)
	for _, s := range stacktraces {
		seen[s.GoroutineID] = true
	}
	for _, e := range events {
		seen[e.GoroutineID] = true
	}
	return len(seen)
}

// CompareResults 比较两个分析结果
func CompareResults(r1, r2 *AnalysisResult) *ComparisonResult {
	result := &ComparisonResult{
		GeneratedAt: time.Now(),
		Differences: make([]Difference, 0),
	}

	// 比较栈增长
	if r2.StackAnalysis.TotalGrowthEvents != r1.StackAnalysis.TotalGrowthEvents {
		result.Differences = append(result.Differences, Difference{
			Category:    "stack",
			Field:       "total_growth_events",
			OldValue:    r1.StackAnalysis.TotalGrowthEvents,
			NewValue:    r2.StackAnalysis.TotalGrowthEvents,
			ChangePct:   calcChangePct(float64(r1.StackAnalysis.TotalGrowthEvents), float64(r2.StackAnalysis.TotalGrowthEvents)),
			Description: "栈增长事件数变化",
		})
	}

	// 比较最大延迟
	if r2.LatencyAnalysis.MaxLatencyUS != r1.LatencyAnalysis.MaxLatencyUS {
		result.Differences = append(result.Differences, Difference{
			Category:    "latency",
			Field:       "max_latency_us",
			OldValue:    r1.LatencyAnalysis.MaxLatencyUS,
			NewValue:    r2.LatencyAnalysis.MaxLatencyUS,
			ChangePct:   calcChangePct(float64(r1.LatencyAnalysis.MaxLatencyUS), float64(r2.LatencyAnalysis.MaxLatencyUS)),
			Description: "最大延迟变化",
		})
	}

	// 比较平均延迟
	if r2.LatencyAnalysis.AverageLatencyUS != r1.LatencyAnalysis.AverageLatencyUS {
		result.Differences = append(result.Differences, Difference{
			Category:    "latency",
			Field:       "avg_latency_us",
			OldValue:    r1.LatencyAnalysis.AverageLatencyUS,
			NewValue:    r2.LatencyAnalysis.AverageLatencyUS,
			ChangePct:   calcChangePct(float64(r1.LatencyAnalysis.AverageLatencyUS), float64(r2.LatencyAnalysis.AverageLatencyUS)),
			Description: "平均延迟变化",
		})
	}

	// 比较抢占事件类型
	eventTypes := []string{"async_preempt", "stack_growth", "nosplit_call", "syscall_block"}
	for _, et := range eventTypes {
		oldCount := getEventCount(r1, et)
		newCount := getEventCount(r2, et)
		if oldCount != newCount {
			result.Differences = append(result.Differences, Difference{
				Category:    "preempt",
				Field:       et + "_count",
				OldValue:    oldCount,
				NewValue:    newCount,
				ChangePct:   calcChangePct(float64(oldCount), float64(newCount)),
				Description: fmt.Sprintf("%s 事件数变化", et),
			})
		}
	}

	// 生成总结
	result.Summary = generateComparisonSummary(result.Differences)

	return result
}

// ComparisonResult 比较结果
type ComparisonResult struct {
	GeneratedAt time.Time    `json:"generated_at"`
	Summary     string       `json:"summary"`
	Differences []Difference `json:"differences"`
}

// Difference 差异项
type Difference struct {
	Category    string      `json:"category"`
	Field       string      `json:"field"`
	OldValue    interface{} `json:"old_value"`
	NewValue    interface{} `json:"new_value"`
	ChangePct   float64     `json:"change_pct"`
	Description string      `json:"description"`
}

func getEventCount(r *AnalysisResult, eventType string) int64 {
	switch eventType {
	case "async_preempt":
		return r.PreemptAnalysis.TotalAsyncPreempts
	case "stack_growth":
		return r.PreemptAnalysis.TotalStackGrowths
	case "nosplit_call":
		return r.PreemptAnalysis.TotalNosplitCalls
	case "syscall_block":
		return r.PreemptAnalysis.TotalSyscallBlocks
	}
	return 0
}

func calcChangePct(old, new float64) float64 {
	if old == 0 {
		if new == 0 {
			return 0
		}
		return 100 // 从 0 增长到某个值
	}
	return (new - old) / old * 100
}

func generateComparisonSummary(diffs []Difference) string {
	if len(diffs) == 0 {
		return "两个分析结果没有显著差异"
	}

	var improvements, regressions int
	for _, d := range diffs {
		if isImprovement(d) {
			improvements++
		} else {
			regressions++
		}
	}

	summary := fmt.Sprintf("检测到 %d 个差异：", len(diffs))
	if improvements > 0 {
		summary += fmt.Sprintf(" %d 个改善", improvements)
	}
	if regressions > 0 {
		summary += fmt.Sprintf(" %d 个恶化", regressions)
	}

	return summary
}

func isImprovement(d Difference) bool {
	// 根据字段类型判断是否是改善
	switch d.Field {
	case "max_latency_us", "avg_latency_us", "total_growth_events":
		return d.ChangePct < 0
	case "async_preempt_count", "stack_growth_count", "nosplit_call_count", "syscall_block_count":
		return d.ChangePct < 0
	}
	return false
}

// ToJSON 序列化为 JSON
func (r *AnalysisResult) ToJSON() (string, error) {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ToMarkdown 生成 Markdown 报告
func (r *AnalysisResult) ToMarkdown() string {
	var sb strings.Builder

	// 标题
	sb.WriteString("# Go Runtime 栈增长和抢占分析报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", r.GeneratedAt.Format("2006-01-02 15:04:05")))

	// 摘要
	sb.WriteString("## 摘要\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| Stacktrace 总数 | %d |\n", r.Summary.TotalStacktraces))
	sb.WriteString(fmt.Sprintf("| 抢占事件总数 | %d |\n", r.Summary.TotalPreemptEvents))
	sb.WriteString(fmt.Sprintf("| Schedtrace 总数 | %d |\n", r.Summary.TotalSchedtraces))
	sb.WriteString(fmt.Sprintf("| 代码片段数 | %d |\n", r.Summary.TotalCodeSnippets))
	sb.WriteString(fmt.Sprintf("| Benchmark 数 | %d |\n", r.Summary.TotalBenchmarks))
	sb.WriteString(fmt.Sprintf("| Goroutine 总数 | %d |\n\n", r.Summary.TotalGoroutines))

	// 栈分析
	sb.WriteString("## 栈分析\n\n")
	sb.WriteString("### 栈增长/收缩统计\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| 栈增长事件数 | %d |\n", r.StackAnalysis.TotalGrowthEvents))
	sb.WriteString(fmt.Sprintf("| 栈收缩事件数 | %d |\n", r.StackAnalysis.TotalShrinkEvents))
	sb.WriteString(fmt.Sprintf("| 最大栈大小 | %d 字节 (%.2f KB) |\n", r.StackAnalysis.LargestStackSize, float64(r.StackAnalysis.LargestStackSize)/1024))
	sb.WriteString(fmt.Sprintf("| 平均增长大小 | %d 字节 |\n", r.StackAnalysis.AverageGrowthSize))
	sb.WriteString(fmt.Sprintf("| 超过阈值的栈 | %d 个 (阈值: %d KB) |\n\n", r.StackAnalysis.StacksOverThreshold, r.Config.StackThresholdKB))

	// 抢占分析
	sb.WriteString("## 抢占分析\n\n")
	sb.WriteString("### 事件类型统计\n\n")
	sb.WriteString("| 类型 | 数量 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 异步抢占 | %d |\n", r.PreemptAnalysis.TotalAsyncPreempts))
	sb.WriteString(fmt.Sprintf("| 栈增长 | %d |\n", r.PreemptAnalysis.TotalStackGrowths))
	sb.WriteString(fmt.Sprintf("| Nosplit 调用 | %d |\n", r.PreemptAnalysis.TotalNosplitCalls))
	sb.WriteString(fmt.Sprintf("| 系统调用阻塞 | %d |\n\n", r.PreemptAnalysis.TotalSyscallBlocks))

	sb.WriteString("### 延迟统计\n\n")
	sb.WriteString(fmt.Sprintf("- 平均抢占延迟: %d µs\n", r.PreemptAnalysis.AveragePreemptLatency))
	sb.WriteString(fmt.Sprintf("- 最大抢占延迟: %d µs\n\n", r.PreemptAnalysis.MaxPreemptLatency))

	if len(r.PreemptAnalysis.TopOffendingGoroutines) > 0 {
		sb.WriteString("### 问题最严重的 Goroutine\n\n")
		sb.WriteString("| Goroutine ID | 事件类型 | 次数 | 总延迟 (µs) | 平均延迟 (µs) |\n")
		sb.WriteString("|--------------|----------|------|-------------|---------------|\n")
		for _, g := range r.PreemptAnalysis.TopOffendingGoroutines {
			sb.WriteString(fmt.Sprintf("| %d | %s | %d | %d | %.1f |\n",
				g.GoroutineID, g.EventType, g.Count, g.TotalDelay, g.AvgDelay))
		}
		sb.WriteString("\n")
	}

	// 调度分析
	sb.WriteString("## 调度分析\n\n")
	sb.WriteString("### 调度器统计\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| 平均 GOMAXPROCS | %.1f |\n", r.SchedAnalysis.AverageGOMAXPROCS))
	sb.WriteString(fmt.Sprintf("| 平均空闲 P | %.1f |\n", r.SchedAnalysis.AverageIdleProcs))
	sb.WriteString(fmt.Sprintf("| 平均 RunQueue | %.1f |\n", r.SchedAnalysis.AverageRunQueue))
	sb.WriteString(fmt.Sprintf("| 最大 RunQueue | %d |\n", r.SchedAnalysis.MaxRunQueue))
	sb.WriteString(fmt.Sprintf("| 平均线程数 | %.1f |\n\n", r.SchedAnalysis.AverageThreads))

	if len(r.SchedAnalysis.GoroutinesByStatus) > 0 {
		sb.WriteString("### Goroutine 状态分布\n\n")
		sb.WriteString("| 状态 | 数量 |\n")
		sb.WriteString("|------|------|\n")
		for status, count := range r.SchedAnalysis.GoroutinesByStatus {
			sb.WriteString(fmt.Sprintf("| %s | %d |\n", status, count))
		}
		sb.WriteString("\n")
	}

	if len(r.SchedAnalysis.HighLatencyGoroutines) > 0 {
		sb.WriteString("### 高延迟 Goroutine\n\n")
		sb.WriteString("| Goroutine ID | 状态 | 最大延迟 (µs) | 平均延迟 (µs) | 次数 |\n")
		sb.WriteString("|--------------|------|---------------|---------------|------|\n")
		for _, g := range r.SchedAnalysis.HighLatencyGoroutines {
			sb.WriteString(fmt.Sprintf("| %d | %s | %d | %d | %d |\n",
				g.GoroutineID, g.Status, g.MaxLatency, g.AvgLatency, g.Count))
		}
		sb.WriteString("\n")
	}

	// 延迟分析
	sb.WriteString("## 延迟分析\n\n")
	sb.WriteString("### 延迟统计\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| 延迟事件总数 | %d |\n", r.LatencyAnalysis.TotalLatencyEvents))
	sb.WriteString(fmt.Sprintf("| 总延迟 | %d µs (%.2f ms) |\n", r.LatencyAnalysis.TotalLatencyUS, float64(r.LatencyAnalysis.TotalLatencyUS)/1000))
	sb.WriteString(fmt.Sprintf("| 平均延迟 | %d µs |\n", r.LatencyAnalysis.AverageLatencyUS))
	sb.WriteString(fmt.Sprintf("| 最大延迟 | %d µs (%.2f ms) |\n\n", r.LatencyAnalysis.MaxLatencyUS, float64(r.LatencyAnalysis.MaxLatencyUS)/1000))

	if len(r.LatencyAnalysis.LatencyByType) > 0 {
		sb.WriteString("### 延迟按类型分布\n\n")
		sb.WriteString("| 类型 | 总延迟 (µs) |\n")
		sb.WriteString("|------|-------------|\n")
		for et, delay := range r.LatencyAnalysis.LatencyByType {
			sb.WriteString(fmt.Sprintf("| %s | %d |\n", et, delay))
		}
		sb.WriteString("\n")
	}

	if len(r.LatencyAnalysis.LatencySpikes) > 0 {
		sb.WriteString("### 延迟尖刺 (Top 10)\n\n")
		sb.WriteString("| 时间 | Goroutine ID | 事件类型 | 延迟 (µs) | 详情 |\n")
		sb.WriteString("|------|--------------|----------|-----------|------|\n")
		for i, spike := range r.LatencyAnalysis.LatencySpikes {
			if i >= 10 {
				break
			}
			sb.WriteString(fmt.Sprintf("| %s | %d | %s | %d | %s |\n",
				spike.Timestamp.Format("15:04:05"), spike.GoroutineID, spike.EventType, spike.LatencyUS, spike.Details))
		}
		sb.WriteString("\n")
	}

	// 代码问题
	if len(r.CodeIssues) > 0 {
		sb.WriteString("## 代码问题\n\n")

		// 按严重程度分组
		bySeverity := make(map[string][]CodeIssueSummary)
		for _, issue := range r.CodeIssues {
			bySeverity[issue.Severity] = append(bySeverity[issue.Severity], issue)
		}

		for _, severity := range []string{"warning", "info"} {
			if issues, ok := bySeverity[severity]; ok && len(issues) > 0 {
				sb.WriteString(fmt.Sprintf("### %s 级问题\n\n", strings.Title(severity)))
				for _, issue := range issues {
					sb.WriteString(fmt.Sprintf("**文件**: %s:%d\n\n", issue.FilePath, issue.Line))
					sb.WriteString(fmt.Sprintf("**类型**: %s\n\n", issue.IssueType))
					sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", issue.Description))
					sb.WriteString("---\n\n")
				}
			}
		}
	}

	// Benchmark 趋势
	if len(r.BenchmarkTrends) > 0 {
		sb.WriteString("## Benchmark 趋势\n\n")
		sb.WriteString("| 测试名 | 最新 ns/op | 变化率 | 趋势 | 数据点 |\n")
		sb.WriteString("|--------|------------|--------|------|--------|\n")
		for _, trend := range r.BenchmarkTrends {
			trendEmoji := ""
			switch trend.Trend {
			case "improving":
				trendEmoji = "✅"
			case "worsening":
				trendEmoji = "⚠️"
			default:
				trendEmoji = "➖"
			}
			sb.WriteString(fmt.Sprintf("| %s | %d | %.1f%% | %s %s | %d |\n",
				trend.TestName, trend.LatestNsPerOp, trend.ChangePct, trendEmoji, trend.Trend, trend.Count))
		}
		sb.WriteString("\n")
	}

	// 建议
	if len(r.Recommendations) > 0 {
		sb.WriteString("## 建议\n\n")

		// 按优先级分组
		byPriority := make(map[string][]Recommendation)
		for _, rec := range r.Recommendations {
			byPriority[rec.Priority] = append(byPriority[rec.Priority], rec)
		}

		for _, priority := range []string{"high", "medium", "low"} {
			if recs, ok := byPriority[priority]; ok && len(recs) > 0 {
				priorityLabel := map[string]string{"high": "高", "medium": "中", "low": "低"}[priority]
				sb.WriteString(fmt.Sprintf("### %s优先级\n\n", priorityLabel))
				for i, rec := range recs {
					sb.WriteString(fmt.Sprintf("#### %d. %s\n\n", i+1, rec.Title))
					sb.WriteString(fmt.Sprintf("**分类**: %s\n\n", rec.Category))
					sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
					sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", rec.Suggestion))
					if rec.Evidence != "" {
						sb.WriteString(fmt.Sprintf("**依据**: %s\n\n", rec.Evidence))
					}
				}
			}
		}
	}

	// 配置
	sb.WriteString("## 分析配置\n\n")
	sb.WriteString("| 配置项 | 值 |\n")
	sb.WriteString("|--------|-----|\n")
	sb.WriteString(fmt.Sprintf("| 栈大小阈值 | %d KB |\n", r.Config.StackThresholdKB))
	sb.WriteString(fmt.Sprintf("| 延迟阈值 | %d µs |\n", r.Config.LatencyThresholdUS))
	sb.WriteString(fmt.Sprintf("| 高系统调用阈值 | %d µs |\n\n", r.Config.HighSyscallThreshold))

	return sb.String()
}
