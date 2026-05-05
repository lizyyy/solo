package analyzer

import (
	"fmt"
	"sort"
	"time"
)

// ComparisonEngine 版本对比引擎
type ComparisonEngine struct{}

// NewComparisonEngine 创建新的对比引擎
func NewComparisonEngine() *ComparisonEngine {
	return &ComparisonEngine{}
}

// CompareAnalyses 对比两次分析结果
func (e *ComparisonEngine) CompareAnalyses(oldAnalysis, newAnalysis *Analysis) (*Comparison, error) {
	if oldAnalysis == nil || newAnalysis == nil {
		return nil, fmt.Errorf("both analyses must be provided")
	}

	comparison := &Comparison{
		ID:           generateComparisonID(),
		OldAnalysis:  *oldAnalysis,
		NewAnalysis:  *newAnalysis,
		CreatedAt:    time.Now(),
	}

	// 计算差异
	differences := e.calculateDifferences(oldAnalysis, newAnalysis)
	comparison.Differences = differences

	// 识别改进项
	improvements := e.identifyImprovements(oldAnalysis, newAnalysis)
	comparison.Improvements = improvements

	// 识别回归项
	regressions := e.identifyRegressions(oldAnalysis, newAnalysis)
	comparison.Regressions = regressions

	// 生成摘要
	summary := e.generateComparisonSummary(improvements, regressions)
	comparison.Summary = summary

	return comparison, nil
}

// calculateDifferences 计算分析差异
func (e *ComparisonEngine) calculateDifferences(oldAnalysis, newAnalysis *Analysis) []Difference {
	var differences []Difference

	// CPU 样本数差异
	oldCPUSamples := oldAnalysis.Summary.TotalCPUSamples
	newCPUSamples := newAnalysis.Summary.TotalCPUSamples
	if oldCPUSamples != newCPUSamples {
		change := float64(newCPUSamples - oldCPUSamples)
		percentage := 0.0
		if oldCPUSamples > 0 {
			percentage = change / float64(oldCPUSamples) * 100
		}
		differences = append(differences, Difference{
			Field:      "CPU 样本数",
			OldValue:   fmt.Sprintf("%d", oldCPUSamples),
			NewValue:   fmt.Sprintf("%d", newCPUSamples),
			Change:     change,
			Percentage: percentage,
		})
	}

	// 堆内存已分配差异
	oldHeapAlloc := oldAnalysis.Summary.TotalHeapAlloc
	newHeapAlloc := newAnalysis.Summary.TotalHeapAlloc
	if oldHeapAlloc != newHeapAlloc {
		change := float64(newHeapAlloc - oldHeapAlloc)
		percentage := 0.0
		if oldHeapAlloc > 0 {
			percentage = change / float64(oldHeapAlloc) * 100
		}
		differences = append(differences, Difference{
			Field:      "堆内存已分配",
			OldValue:   formatBytes(oldHeapAlloc),
			NewValue:   formatBytes(newHeapAlloc),
			Change:     change,
			Percentage: percentage,
		})
	}

	// 堆内存正在使用差异
	oldHeapInUse := oldAnalysis.Summary.TotalHeapInUse
	newHeapInUse := newAnalysis.Summary.TotalHeapInUse
	if oldHeapInUse != newHeapInUse {
		change := float64(newHeapInUse - oldHeapInUse)
		percentage := 0.0
		if oldHeapInUse > 0 {
			percentage = change / float64(oldHeapInUse) * 100
		}
		differences = append(differences, Difference{
			Field:      "堆内存正在使用",
			OldValue:   formatBytes(oldHeapInUse),
			NewValue:   formatBytes(newHeapInUse),
			Change:     change,
			Percentage: percentage,
		})
	}

	// 阻塞次数差异
	oldBlockCount := oldAnalysis.Summary.TotalBlockCount
	newBlockCount := newAnalysis.Summary.TotalBlockCount
	if oldBlockCount != newBlockCount {
		change := float64(newBlockCount - oldBlockCount)
		percentage := 0.0
		if oldBlockCount > 0 {
			percentage = change / float64(oldBlockCount) * 100
		}
		differences = append(differences, Difference{
			Field:      "阻塞次数",
			OldValue:   fmt.Sprintf("%d", oldBlockCount),
			NewValue:   fmt.Sprintf("%d", newBlockCount),
			Change:     change,
			Percentage: percentage,
		})
	}

	// 锁竞争次数差异
	oldMutexCount := oldAnalysis.Summary.TotalMutexCount
	newMutexCount := newAnalysis.Summary.TotalMutexCount
	if oldMutexCount != newMutexCount {
		change := float64(newMutexCount - oldMutexCount)
		percentage := 0.0
		if oldMutexCount > 0 {
			percentage = change / float64(oldMutexCount) * 100
		}
		differences = append(differences, Difference{
			Field:      "锁竞争次数",
			OldValue:   fmt.Sprintf("%d", oldMutexCount),
			NewValue:   fmt.Sprintf("%d", newMutexCount),
			Change:     change,
			Percentage: percentage,
		})
	}

	// 瓶颈数量差异
	oldBottleneckCount := len(oldAnalysis.Bottlenecks)
	newBottleneckCount := len(newAnalysis.Bottlenecks)
	if oldBottleneckCount != newBottleneckCount {
		change := float64(newBottleneckCount - oldBottleneckCount)
		percentage := 0.0
		if oldBottleneckCount > 0 {
			percentage = change / float64(oldBottleneckCount) * 100
		}
		differences = append(differences, Difference{
			Field:      "瓶颈数量",
			OldValue:   fmt.Sprintf("%d", oldBottleneckCount),
			NewValue:   fmt.Sprintf("%d", newBottleneckCount),
			Change:     change,
			Percentage: percentage,
		})
	}

	return differences
}

// identifyImprovements 识别改进项
func (e *ComparisonEngine) identifyImprovements(oldAnalysis, newAnalysis *Analysis) []Improvement {
	var improvements []Improvement

	// 检查 CPU 样本数减少（通常是好事）
	oldCPUSamples := oldAnalysis.Summary.TotalCPUSamples
	newCPUSamples := newAnalysis.Summary.TotalCPUSamples
	if newCPUSamples < oldCPUSamples && oldCPUSamples > 0 {
		improvement := float64(oldCPUSamples-newCPUSamples) / float64(oldCPUSamples)
		if improvement > 0.05 { // 超过 5% 的改进
			improvements = append(improvements, Improvement{
				Metric:      "CPU 使用",
				OldValue:    float64(oldCPUSamples),
				NewValue:    float64(newCPUSamples),
				Improvement: improvement,
				Description: fmt.Sprintf("CPU 样本数从 %d 减少到 %d，减少了 %.1f%%", 
					oldCPUSamples, newCPUSamples, improvement*100),
			})
		}
	}

	// 检查内存使用减少
	oldHeapInUse := oldAnalysis.Summary.TotalHeapInUse
	newHeapInUse := newAnalysis.Summary.TotalHeapInUse
	if newHeapInUse < oldHeapInUse && oldHeapInUse > 0 {
		improvement := float64(oldHeapInUse-newHeapInUse) / float64(oldHeapInUse)
		if improvement > 0.05 {
			improvements = append(improvements, Improvement{
				Metric:      "内存使用",
				OldValue:    float64(oldHeapInUse),
				NewValue:    float64(newHeapInUse),
				Improvement: improvement,
				Description: fmt.Sprintf("堆内存使用从 %s 减少到 %s，减少了 %.1f%%", 
					formatBytes(oldHeapInUse), formatBytes(newHeapInUse), improvement*100),
			})
		}
	}

	// 检查阻塞次数减少
	oldBlockCount := oldAnalysis.Summary.TotalBlockCount
	newBlockCount := newAnalysis.Summary.TotalBlockCount
	if newBlockCount < oldBlockCount && oldBlockCount > 0 {
		improvement := float64(oldBlockCount-newBlockCount) / float64(oldBlockCount)
		if improvement > 0.05 {
			improvements = append(improvements, Improvement{
				Metric:      "阻塞次数",
				OldValue:    float64(oldBlockCount),
				NewValue:    float64(newBlockCount),
				Improvement: improvement,
				Description: fmt.Sprintf("阻塞次数从 %d 减少到 %d，减少了 %.1f%%", 
					oldBlockCount, newBlockCount, improvement*100),
			})
		}
	}

	// 检查锁竞争次数减少
	oldMutexCount := oldAnalysis.Summary.TotalMutexCount
	newMutexCount := newAnalysis.Summary.TotalMutexCount
	if newMutexCount < oldMutexCount && oldMutexCount > 0 {
		improvement := float64(oldMutexCount-newMutexCount) / float64(oldMutexCount)
		if improvement > 0.05 {
			improvements = append(improvements, Improvement{
				Metric:      "锁竞争次数",
				OldValue:    float64(oldMutexCount),
				NewValue:    float64(newMutexCount),
				Improvement: improvement,
				Description: fmt.Sprintf("锁竞争次数从 %d 减少到 %d，减少了 %.1f%%", 
					oldMutexCount, newMutexCount, improvement*100),
			})
		}
	}

	// 检查瓶颈数量减少
	oldBottleneckCount := len(oldAnalysis.Bottlenecks)
	newBottleneckCount := len(newAnalysis.Bottlenecks)
	if newBottleneckCount < oldBottleneckCount && oldBottleneckCount > 0 {
		improvement := float64(oldBottleneckCount-newBottleneckCount) / float64(oldBottleneckCount)
		if improvement > 0.05 {
			improvements = append(improvements, Improvement{
				Metric:      "瓶颈数量",
				OldValue:    float64(oldBottleneckCount),
				NewValue:    float64(newBottleneckCount),
				Improvement: improvement,
				Description: fmt.Sprintf("性能瓶颈从 %d 个减少到 %d 个，减少了 %.1f%%", 
					oldBottleneckCount, newBottleneckCount, improvement*100),
			})
		}
	}

	// 按改进程度排序
	sort.Slice(improvements, func(i, j int) bool {
		return improvements[i].Improvement > improvements[j].Improvement
	})

	return improvements
}

// identifyRegressions 识别回归项
func (e *ComparisonEngine) identifyRegressions(oldAnalysis, newAnalysis *Analysis) []Regression {
	var regressions []Regression

	// 检查 CPU 样本数增加
	oldCPUSamples := oldAnalysis.Summary.TotalCPUSamples
	newCPUSamples := newAnalysis.Summary.TotalCPUSamples
	if newCPUSamples > oldCPUSamples && oldCPUSamples > 0 {
		regression := float64(newCPUSamples-oldCPUSamples) / float64(oldCPUSamples)
		if regression > 0.05 { // 超过 5% 的回归
			regressions = append(regressions, Regression{
				Metric:      "CPU 使用",
				OldValue:    float64(oldCPUSamples),
				NewValue:    float64(newCPUSamples),
				Regression:  regression,
				Description: fmt.Sprintf("CPU 样本数从 %d 增加到 %d，增加了 %.1f%%", 
					oldCPUSamples, newCPUSamples, regression*100),
			})
		}
	}

	// 检查内存使用增加
	oldHeapInUse := oldAnalysis.Summary.TotalHeapInUse
	newHeapInUse := newAnalysis.Summary.TotalHeapInUse
	if newHeapInUse > oldHeapInUse && oldHeapInUse > 0 {
		regression := float64(newHeapInUse-oldHeapInUse) / float64(oldHeapInUse)
		if regression > 0.05 {
			regressions = append(regressions, Regression{
				Metric:      "内存使用",
				OldValue:    float64(oldHeapInUse),
				NewValue:    float64(newHeapInUse),
				Regression:  regression,
				Description: fmt.Sprintf("堆内存使用从 %s 增加到 %s，增加了 %.1f%%", 
					formatBytes(oldHeapInUse), formatBytes(newHeapInUse), regression*100),
			})
		}
	}

	// 检查阻塞次数增加
	oldBlockCount := oldAnalysis.Summary.TotalBlockCount
	newBlockCount := newAnalysis.Summary.TotalBlockCount
	if newBlockCount > oldBlockCount && oldBlockCount > 0 {
		regression := float64(newBlockCount-oldBlockCount) / float64(oldBlockCount)
		if regression > 0.05 {
			regressions = append(regressions, Regression{
				Metric:      "阻塞次数",
				OldValue:    float64(oldBlockCount),
				NewValue:    float64(newBlockCount),
				Regression:  regression,
				Description: fmt.Sprintf("阻塞次数从 %d 增加到 %d，增加了 %.1f%%", 
					oldBlockCount, newBlockCount, regression*100),
			})
		}
	}

	// 检查锁竞争次数增加
	oldMutexCount := oldAnalysis.Summary.TotalMutexCount
	newMutexCount := newAnalysis.Summary.TotalMutexCount
	if newMutexCount > oldMutexCount && oldMutexCount > 0 {
		regression := float64(newMutexCount-oldMutexCount) / float64(oldMutexCount)
		if regression > 0.05 {
			regressions = append(regressions, Regression{
				Metric:      "锁竞争次数",
				OldValue:    float64(oldMutexCount),
				NewValue:    float64(newMutexCount),
				Regression:  regression,
				Description: fmt.Sprintf("锁竞争次数从 %d 增加到 %d，增加了 %.1f%%", 
					oldMutexCount, newMutexCount, regression*100),
			})
		}
	}

	// 检查瓶颈数量增加
	oldBottleneckCount := len(oldAnalysis.Bottlenecks)
	newBottleneckCount := len(newAnalysis.Bottlenecks)
	if newBottleneckCount > oldBottleneckCount && oldBottleneckCount > 0 {
		regression := float64(newBottleneckCount-oldBottleneckCount) / float64(oldBottleneckCount)
		if regression > 0.05 {
			regressions = append(regressions, Regression{
				Metric:      "瓶颈数量",
				OldValue:    float64(oldBottleneckCount),
				NewValue:    float64(newBottleneckCount),
				Regression:  regression,
				Description: fmt.Sprintf("性能瓶颈从 %d 个增加到 %d 个，增加了 %.1f%%", 
					oldBottleneckCount, newBottleneckCount, regression*100),
			})
		}
	}

	// 按回归程度排序
	sort.Slice(regressions, func(i, j int) bool {
		return regressions[i].Regression > regressions[j].Regression
	})

	return regressions
}

// generateComparisonSummary 生成对比摘要
func (e *ComparisonEngine) generateComparisonSummary(improvements []Improvement, regressions []Regression) ComparisonSummary {
	summary := ComparisonSummary{
		TotalImprovements: len(improvements),
		TotalRegressions:  len(regressions),
	}

	// 计算总体评分
	totalScore := 0.0
	for _, imp := range improvements {
		totalScore += imp.Improvement
	}
	for _, reg := range regressions {
		totalScore -= reg.Regression
	}
	summary.OverallScore = totalScore

	// 确定主要指标
	primaryMetric := "总体"
	if len(improvements) > 0 {
		primaryMetric = improvements[0].Metric
	} else if len(regressions) > 0 {
		primaryMetric = regressions[0].Metric
	}
	summary.PrimaryMetric = primaryMetric

	return summary
}

// generateComparisonID 生成对比 ID
func generateComparisonID() string {
	return fmt.Sprintf("cmp_%d", time.Now().UnixNano())
}

// formatBytes 格式化字节数
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
