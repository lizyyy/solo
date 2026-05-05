package analyzer

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Analyzer 性能分析引擎
type Analyzer struct {
	config *AnalyzerConfig
}

// AnalyzerConfig 分析引擎配置
type AnalyzerConfig struct {
	CPUThreshold      float64
	MemoryThreshold   float64
	BlockingThreshold float64
	MutexThreshold    float64
}

// DefaultAnalyzerConfig 默认分析引擎配置
func DefaultAnalyzerConfig() *AnalyzerConfig {
	return &AnalyzerConfig{
		CPUThreshold:      0.10, // 10%
		MemoryThreshold:   0.20, // 20%
		BlockingThreshold: 0.10, // 10%
		MutexThreshold:    0.10, // 10%
	}
}

// NewAnalyzer 创建新的分析引擎
func NewAnalyzer(config *AnalyzerConfig) *Analyzer {
	if config == nil {
		config = DefaultAnalyzerConfig()
	}
	return &Analyzer{
		config: config,
	}
}

// AnalysisOptions 分析选项
type AnalysisOptions struct {
	Name         string
	CPUProfile   []CPUProfileSample
	HeapProfile  []HeapProfileSample
	BlockProfile []BlockProfileSample
	MutexProfile []MutexProfileSample
	TraceEvents  []TraceEvent
	Benchmarks   []BenchmarkResult
}

// Analyze 执行性能分析
func (a *Analyzer) Analyze(options *AnalysisOptions) (*Analysis, error) {
	analysis := &Analysis{
		ID:           generateID(),
		Name:         options.Name,
		CreatedAt:    time.Now(),
		CPUProfile:   options.CPUProfile,
		HeapProfile:  options.HeapProfile,
		BlockProfile: options.BlockProfile,
		MutexProfile: options.MutexProfile,
		TraceEvents:  options.TraceEvents,
		Benchmarks:   options.Benchmarks,
	}

	// 识别瓶颈
	bottlenecks := a.identifyBottlenecks(options)
	analysis.Bottlenecks = bottlenecks

	// 生成建议
	recommendations := a.generateRecommendations(bottlenecks, options)
	analysis.Recommendations = recommendations

	// 生成摘要
	summary := a.generateSummary(options, bottlenecks)
	analysis.Summary = summary

	return analysis, nil
}

// identifyBottlenecks 识别性能瓶颈
func (a *Analyzer) identifyBottlenecks(options *AnalysisOptions) []Bottleneck {
	var bottlenecks []Bottleneck

	// 分析 CPU 瓶颈
	if len(options.CPUProfile) > 0 {
		cpuBottlenecks := a.analyzeCPUProfile(options.CPUProfile)
		bottlenecks = append(bottlenecks, cpuBottlenecks...)
	}

	// 分析内存瓶颈
	if len(options.HeapProfile) > 0 {
		memoryBottlenecks := a.analyzeHeapProfile(options.HeapProfile)
		bottlenecks = append(bottlenecks, memoryBottlenecks...)
	}

	// 分析阻塞瓶颈
	if len(options.BlockProfile) > 0 {
		blockBottlenecks := a.analyzeBlockProfile(options.BlockProfile)
		bottlenecks = append(bottlenecks, blockBottlenecks...)
	}

	// 分析锁竞争瓶颈
	if len(options.MutexProfile) > 0 {
		mutexBottlenecks := a.analyzeMutexProfile(options.MutexProfile)
		bottlenecks = append(bottlenecks, mutexBottlenecks...)
	}

	// 分析追踪事件中的 Goroutine 瓶颈
	if len(options.TraceEvents) > 0 {
		traceBottlenecks := a.analyzeTraceEvents(options.TraceEvents)
		bottlenecks = append(bottlenecks, traceBottlenecks...)
	}

	// 按严重程度排序
	sort.Slice(bottlenecks, func(i, j int) bool {
		return bottlenecks[i].Severity > bottlenecks[j].Severity
	})

	return bottlenecks
}

// analyzeCPUProfile 分析 CPU 剖析数据
func (a *Analyzer) analyzeCPUProfile(samples []CPUProfileSample) []Bottleneck {
	var bottlenecks []Bottleneck

	if len(samples) == 0 {
		return bottlenecks
	}

	// 计算总 CPU 样本数
	totalSamples := int64(0)
	for _, sample := range samples {
		totalSamples += sample.Value
	}

	if totalSamples == 0 {
		return bottlenecks
	}

	// 识别热点函数
	for _, sample := range samples {
		percentage := float64(sample.Value) / float64(totalSamples)

		// 如果超过阈值，视为瓶颈
		if percentage >= a.config.CPUThreshold {
			severity := percentage * 10 // 将百分比转换为 0-10 的严重程度

			// 生成调用栈描述
			var stackDesc string
			if len(sample.CallStack.Frames) > 0 {
				topFrame := sample.CallStack.Frames[0]
				stackDesc = fmt.Sprintf("%s (%s:%d)", topFrame.Function, topFrame.File, topFrame.Line)
			} else {
				stackDesc = "unknown"
			}

			bottleneck := Bottleneck{
				Type:        BottleneckTypeCPU,
				Severity:    severity,
				Description: fmt.Sprintf("CPU 热点：%s 占用 %.1f%% 的 CPU 时间", stackDesc, percentage*100),
				Evidence:    fmt.Sprintf("CPU 样本数: %d / %d (%.1f%%)", sample.Value, totalSamples, percentage*100),
				CallStack:   sample.CallStack,
				Samples:     sample.Value,
				Value:       percentage,
				Recommendation: a.getCPURecommendation(percentage),
			}
			bottlenecks = append(bottlenecks, bottleneck)
		}
	}

	return bottlenecks
}

// analyzeHeapProfile 分析堆内存剖析数据
func (a *Analyzer) analyzeHeapProfile(samples []HeapProfileSample) []Bottleneck {
	var bottlenecks []Bottleneck

	if len(samples) == 0 {
		return bottlenecks
	}

	// 计算总内存使用
	totalInUse := int64(0)
	totalAlloc := int64(0)
	for _, sample := range samples {
		totalInUse += sample.InUseBytes
		totalAlloc += sample.AllocBytes
	}

	if totalInUse == 0 && totalAlloc == 0 {
		return bottlenecks
	}

	// 识别内存热点
	for _, sample := range samples {
		// 分析正在使用的内存
		if totalInUse > 0 {
			inUsePercentage := float64(sample.InUseBytes) / float64(totalInUse)
			if inUsePercentage >= a.config.MemoryThreshold {
				severity := inUsePercentage * 10

				var stackDesc string
				if len(sample.CallStack.Frames) > 0 {
					topFrame := sample.CallStack.Frames[0]
					stackDesc = fmt.Sprintf("%s (%s:%d)", topFrame.Function, topFrame.File, topFrame.Line)
				} else {
					stackDesc = "unknown"
				}

				bottleneck := Bottleneck{
					Type:        BottleneckTypeMemory,
					Severity:    severity,
					Description: fmt.Sprintf("内存热点：%s 正在使用 %.1f%% 的堆内存", stackDesc, inUsePercentage*100),
					Evidence:    fmt.Sprintf("正在使用: %d bytes (%.1f%%), 已分配: %d bytes", sample.InUseBytes, inUsePercentage*100, sample.AllocBytes),
					CallStack:   sample.CallStack,
					Samples:     sample.InUseObjects,
					Value:       inUsePercentage,
					Recommendation: a.getMemoryRecommendation(inUsePercentage),
				}
				bottlenecks = append(bottlenecks, bottleneck)
			}
		}

		// 分析内存分配频率
		if totalAlloc > 0 {
			allocPercentage := float64(sample.AllocBytes) / float64(totalAlloc)
			if allocPercentage >= a.config.MemoryThreshold && sample.InUseBytes == 0 {
				// 频繁分配但不保留的内存，可能是临时对象
				severity := allocPercentage * 5 // 临时内存分配的严重程度较低

				var stackDesc string
				if len(sample.CallStack.Frames) > 0 {
					topFrame := sample.CallStack.Frames[0]
					stackDesc = fmt.Sprintf("%s (%s:%d)", topFrame.Function, topFrame.File, topFrame.Line)
				} else {
					stackDesc = "unknown"
				}

				bottleneck := Bottleneck{
					Type:        BottleneckTypeMemory,
					Severity:    severity,
					Description: fmt.Sprintf("频繁内存分配：%s 分配了 %.1f%% 的内存但未保留", stackDesc, allocPercentage*100),
					Evidence:    fmt.Sprintf("已分配: %d bytes (%.1f%%), 当前使用: %d bytes", sample.AllocBytes, allocPercentage*100, sample.InUseBytes),
					CallStack:   sample.CallStack,
					Samples:     sample.AllocObjects,
					Value:       allocPercentage,
					Recommendation: "考虑使用对象池 (sync.Pool) 或复用已分配的内存来减少 GC 压力",
				}
				bottlenecks = append(bottlenecks, bottleneck)
			}
		}
	}

	return bottlenecks
}

// analyzeBlockProfile 分析阻塞剖析数据
func (a *Analyzer) analyzeBlockProfile(samples []BlockProfileSample) []Bottleneck {
	var bottlenecks []Bottleneck

	if len(samples) == 0 {
		return bottlenecks
	}

	// 计算总阻塞时间
	totalNanoseconds := int64(0)
	totalCount := int64(0)
	for _, sample := range samples {
		totalNanoseconds += sample.Nanoseconds
		totalCount += sample.Count
	}

	if totalNanoseconds == 0 && totalCount == 0 {
		return bottlenecks
	}

	// 识别阻塞热点
	for _, sample := range samples {
		if totalNanoseconds > 0 {
			timePercentage := float64(sample.Nanoseconds) / float64(totalNanoseconds)
			if timePercentage >= a.config.BlockingThreshold {
				severity := timePercentage * 10

				var stackDesc string
				if len(sample.CallStack.Frames) > 0 {
					topFrame := sample.CallStack.Frames[0]
					stackDesc = fmt.Sprintf("%s (%s:%d)", topFrame.Function, topFrame.File, topFrame.Line)
				} else {
					stackDesc = "unknown"
				}

				bottleneck := Bottleneck{
					Type:        BottleneckTypeBlocking,
					Severity:    severity,
					Description: fmt.Sprintf("阻塞热点：%s 阻塞了 %.1f%% 的时间", stackDesc, timePercentage*100),
					Evidence:    fmt.Sprintf("阻塞时间: %d ns (%.1f%%), 阻塞次数: %d", sample.Nanoseconds, timePercentage*100, sample.Count),
					CallStack:   sample.CallStack,
					Samples:     sample.Count,
					Value:       timePercentage,
					Recommendation: a.getBlockingRecommendation(timePercentage),
				}
				bottlenecks = append(bottlenecks, bottleneck)
			}
		}
	}

	return bottlenecks
}

// analyzeMutexProfile 分析锁竞争剖析数据
func (a *Analyzer) analyzeMutexProfile(samples []MutexProfileSample) []Bottleneck {
	var bottlenecks []Bottleneck

	if len(samples) == 0 {
		return bottlenecks
	}

	// 计算总锁等待时间
	totalNanoseconds := int64(0)
	totalCount := int64(0)
	for _, sample := range samples {
		totalNanoseconds += sample.Nanoseconds
		totalCount += sample.Count
	}

	if totalNanoseconds == 0 && totalCount == 0 {
		return bottlenecks
	}

	// 识别锁竞争热点
	for _, sample := range samples {
		if totalNanoseconds > 0 {
			timePercentage := float64(sample.Nanoseconds) / float64(totalNanoseconds)
			if timePercentage >= a.config.MutexThreshold {
				severity := timePercentage * 10

				var stackDesc string
				if len(sample.CallStack.Frames) > 0 {
					topFrame := sample.CallStack.Frames[0]
					stackDesc = fmt.Sprintf("%s (%s:%d)", topFrame.Function, topFrame.File, topFrame.Line)
				} else {
					stackDesc = "unknown"
				}

				bottleneck := Bottleneck{
					Type:        BottleneckTypeMutex,
					Severity:    severity,
					Description: fmt.Sprintf("锁竞争热点：%s 等待锁的时间占 %.1f%%", stackDesc, timePercentage*100),
					Evidence:    fmt.Sprintf("等待时间: %d ns (%.1f%%), 竞争次数: %d", sample.Nanoseconds, timePercentage*100, sample.Count),
					CallStack:   sample.CallStack,
					Samples:     sample.Count,
					Value:       timePercentage,
					Recommendation: a.getMutexRecommendation(timePercentage),
				}
				bottlenecks = append(bottlenecks, bottleneck)
			}
		}
	}

	return bottlenecks
}

// analyzeTraceEvents 分析追踪事件
func (a *Analyzer) analyzeTraceEvents(events []TraceEvent) []Bottleneck {
	var bottlenecks []Bottleneck

	if len(events) == 0 {
		return bottlenecks
	}

	// 统计各类事件
	eventStats := make(map[string]int)
	goroutineStats := make(map[uint64]int)
	blockedGoroutines := make(map[uint64]time.Duration)

	for _, event := range events {
		eventStats[event.Type]++
		
		if event.GoroutineID != 0 {
			goroutineStats[event.GoroutineID]++
		}

		// 统计阻塞事件
		if event.Type == "GoroutineBlocked" || strings.Contains(event.Type, "Blocked") {
			blockedGoroutines[event.GoroutineID] += event.Duration
		}
	}

	// 检查是否有大量阻塞的 Goroutine
	for gid, duration := range blockedGoroutines {
		if duration > time.Second*1 {
			bottleneck := Bottleneck{
				Type:        BottleneckTypeGoroutine,
				Severity:    7.0,
				Description: fmt.Sprintf("Goroutine G=%d 长时间阻塞，总阻塞时间: %v", gid, duration),
				Evidence:    fmt.Sprintf("Goroutine G=%d 阻塞时间超过阈值", gid),
				CallStack:   CallStack{},
				Samples:     1,
				Value:       float64(duration.Nanoseconds()),
				Recommendation: "检查该 Goroutine 的阻塞原因，可能是死锁、通道问题或 I/O 阻塞",
			}
			bottlenecks = append(bottlenecks, bottleneck)
		}
	}

	// 检查 GC 事件
	gcCount := eventStats["GC"]
	STWCount := eventStats["STW"]
	
	if gcCount > 10 {
		bottleneck := Bottleneck{
			Type:        BottleneckTypeMemory,
			Severity:    6.0,
			Description: fmt.Sprintf("频繁 GC：追踪期间发生了 %d 次 GC", gcCount),
			Evidence:    fmt.Sprintf("GC 次数: %d, STW 次数: %d", gcCount, STWCount),
			CallStack:   CallStack{},
			Samples:     int64(gcCount),
			Value:       float64(gcCount),
			Recommendation: "考虑减少内存分配，使用对象池，或调整 GOGC 参数",
		}
		bottlenecks = append(bottlenecks, bottleneck)
	}

	return bottlenecks
}

// generateRecommendations 生成优化建议
func (a *Analyzer) generateRecommendations(bottlenecks []Bottleneck, options *AnalysisOptions) []Recommendation {
	var recommendations []Recommendation

	// 按瓶颈类型分组
	typeGrouped := make(map[BottleneckType][]Bottleneck)
	for _, b := range bottlenecks {
		typeGrouped[b.Type] = append(typeGrouped[b.Type], b)
	}

	// 为每种瓶颈类型生成综合建议
	for bType, typeBottlenecks := range typeGrouped {
		if len(typeBottlenecks) == 0 {
			continue
		}

		// 计算该类型的总严重程度
		totalSeverity := 0.0
		for _, b := range typeBottlenecks {
			totalSeverity += b.Severity
		}

		var recommendation Recommendation

		switch bType {
		case BottleneckTypeCPU:
			recommendation = Recommendation{
				Title:       "CPU 优化建议",
				Description: fmt.Sprintf("检测到 %d 个 CPU 热点，总严重程度: %.1f", len(typeBottlenecks), totalSeverity),
				Priority:    1,
				Evidence:    fmt.Sprintf("共 %d 个 CPU 瓶颈，建议优先优化最严重的热点", len(typeBottlenecks)),
			}
		case BottleneckTypeMemory:
			recommendation = Recommendation{
				Title:       "内存优化建议",
				Description: fmt.Sprintf("检测到 %d 个内存热点，总严重程度: %.1f", len(typeBottlenecks), totalSeverity),
				Priority:    2,
				Evidence:    fmt.Sprintf("共 %d 个内存瓶颈，建议检查是否有内存泄漏或不必要的内存分配", len(typeBottlenecks)),
			}
		case BottleneckTypeBlocking:
			recommendation = Recommendation{
				Title:       "阻塞优化建议",
				Description: fmt.Sprintf("检测到 %d 个阻塞热点，总严重程度: %.1f", len(typeBottlenecks), totalSeverity),
				Priority:    3,
				Evidence:    fmt.Sprintf("共 %d 个阻塞瓶颈，建议检查 I/O 操作或同步原语的使用", len(typeBottlenecks)),
			}
		case BottleneckTypeMutex:
			recommendation = Recommendation{
				Title:       "锁竞争优化建议",
				Description: fmt.Sprintf("检测到 %d 个锁竞争热点，总严重程度: %.1f", len(typeBottlenecks), totalSeverity),
				Priority:    4,
				Evidence:    fmt.Sprintf("共 %d 个锁竞争瓶颈，建议考虑使用无锁数据结构或减少锁粒度", len(typeBottlenecks)),
			}
		case BottleneckTypeGoroutine:
			recommendation = Recommendation{
				Title:       "Goroutine 优化建议",
				Description: fmt.Sprintf("检测到 %d 个 Goroutine 相关问题", len(typeBottlenecks)),
				Priority:    5,
				Evidence:    fmt.Sprintf("共 %d 个 Goroutine 瓶颈，建议检查是否有 Goroutine 泄漏或阻塞", len(typeBottlenecks)),
			}
		}

		recommendations = append(recommendations, recommendation)
	}

	// 按优先级排序
	sort.Slice(recommendations, func(i, j int) bool {
		return recommendations[i].Priority < recommendations[j].Priority
	})

	return recommendations
}

// generateSummary 生成分析摘要
func (a *Analyzer) generateSummary(options *AnalysisOptions, bottlenecks []Bottleneck) AnalysisSummary {
	summary := AnalysisSummary{}

	// 统计 CPU 样本
	for _, sample := range options.CPUProfile {
		summary.TotalCPUSamples += sample.Value
	}

	// 统计内存
	for _, sample := range options.HeapProfile {
		summary.TotalHeapAlloc += sample.AllocBytes
		summary.TotalHeapInUse += sample.InUseBytes
	}

	// 统计阻塞
	for _, sample := range options.BlockProfile {
		summary.TotalBlockCount += sample.Count
	}

	// 统计锁竞争
	for _, sample := range options.MutexProfile {
		summary.TotalMutexCount += sample.Count
	}

	// 提取前几个瓶颈的描述
	for _, b := range bottlenecks {
		switch b.Type {
		case BottleneckTypeCPU:
			if len(summary.TopCPUBottlenecks) < 3 {
				summary.TopCPUBottlenecks = append(summary.TopCPUBottlenecks, b.Description)
			}
		case BottleneckTypeMemory:
			if len(summary.TopMemoryBottlenecks) < 3 {
				summary.TopMemoryBottlenecks = append(summary.TopMemoryBottlenecks, b.Description)
			}
		case BottleneckTypeBlocking, BottleneckTypeMutex:
			if len(summary.TopLockingBottlenecks) < 3 {
				summary.TopLockingBottlenecks = append(summary.TopLockingBottlenecks, b.Description)
			}
		}
	}

	return summary
}

// getCPURecommendation 获取 CPU 优化建议
func (a *Analyzer) getCPURecommendation(percentage float64) string {
	if percentage >= 0.50 {
		return "这是主要的 CPU 热点，建议使用 pprof 详细分析，考虑算法优化、减少循环次数或使用并发处理"
	} else if percentage >= 0.20 {
		return "这是重要的 CPU 热点，建议检查是否有不必要的计算或可以优化的代码路径"
	}
	return "这是一个次要的 CPU 热点，可以考虑优化，但优先级较低"
}

// getMemoryRecommendation 获取内存优化建议
func (a *Analyzer) getMemoryRecommendation(percentage float64) string {
	if percentage >= 0.50 {
		return "这是主要的内存热点，建议检查是否有内存泄漏，考虑使用更小的数据结构或减少不必要的内存分配"
	} else if percentage >= 0.20 {
		return "这是重要的内存热点，建议检查内存分配模式，考虑使用对象池或复用已分配的内存"
	}
	return "这是一个次要的内存热点，可以考虑优化，但优先级较低"
}

// getBlockingRecommendation 获取阻塞优化建议
func (a *Analyzer) getBlockingRecommendation(percentage float64) string {
	if percentage >= 0.50 {
		return "这是主要的阻塞热点，建议检查 I/O 操作，考虑使用异步 I/O、超时控制或增加并发度"
	} else if percentage >= 0.20 {
		return "这是重要的阻塞热点，建议检查是否有不必要的同步等待或可以优化的 I/O 路径"
	}
	return "这是一个次要的阻塞热点，可以考虑优化，但优先级较低"
}

// getMutexRecommendation 获取锁竞争优化建议
func (a *Analyzer) getMutexRecommendation(percentage float64) string {
	if percentage >= 0.50 {
		return "这是主要的锁竞争热点，建议考虑减少锁粒度、使用读写锁（sync.RWMutex）、无锁数据结构或原子操作"
	} else if percentage >= 0.20 {
		return "这是重要的锁竞争热点，建议检查锁的持有时间，考虑在临界区外进行计算"
	}
	return "这是一个次要的锁竞争热点，可以考虑优化，但优先级较低"
}

// generateID 生成唯一 ID
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
