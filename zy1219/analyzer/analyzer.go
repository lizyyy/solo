package analyzer

import (
	"sort"
	"time"

	"gcinsight/models"
)

type Analyzer struct {
}

func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

func (a *Analyzer) Analyze(
	traces []models.GCTraceEntry,
	samples []models.HeapSample,
	events []models.AllocEvent,
) *models.AnalysisResult {
	result := &models.AnalysisResult{
		CreatedAt: time.Now(),
	}

	result.PauseDistribution = a.analyzePauseDistribution(traces)
	result.HeapGoalDeviation = a.analyzeHeapGoalDeviation(traces)
	result.AssistPressure = a.analyzeAssistPressure(traces)
	result.MemoryPeaks = a.analyzeMemoryPeaks(traces, samples)
	result.Recommendations = a.generateRecommendations(result)
	result.RawMetrics = a.calculateRawMetrics(traces, samples)

	return result
}

func (a *Analyzer) analyzePauseDistribution(traces []models.GCTraceEntry) models.PauseDistribution {
	if len(traces) == 0 {
		return models.PauseDistribution{}
	}

	var pauses []time.Duration
	var stwPauses []models.PauseInfo
	var concurrentPauses []models.PauseInfo

	for _, t := range traces {
		pauses = append(pauses, t.PauseDuration)

		pauseInfo := models.PauseInfo{
			Timestamp: t.Timestamp,
			Duration:  t.PauseDuration,
			Type:      "concurrent",
			GCPhase:   t.Phase,
			GCNumber:  t.GCNumber,
		}

		if t.PauseDuration > 100*time.Microsecond {
			pauseInfo.Type = "stw"
			stwPauses = append(stwPauses, pauseInfo)
		} else {
			concurrentPauses = append(concurrentPauses, pauseInfo)
		}
	}

	sort.Slice(pauses, func(i, j int) bool { return pauses[i] < pauses[j] })

	total := time.Duration(0)
	for _, p := range pauses {
		total += p
	}

	meanPause := time.Duration(0)
	if len(pauses) > 0 {
		meanPause = total / time.Duration(len(pauses))
	}

	medianPause := time.Duration(0)
	if len(pauses) > 0 {
		medianPause = pauses[len(pauses)/2]
	}

	p95Pause := time.Duration(0)
	if len(pauses) > 0 {
		p95Idx := int(float64(len(pauses)) * 0.95)
		if p95Idx >= len(pauses) {
			p95Idx = len(pauses) - 1
		}
		p95Pause = pauses[p95Idx]
	}

	p99Pause := time.Duration(0)
	if len(pauses) > 0 {
		p99Idx := int(float64(len(pauses)) * 0.99)
		if p99Idx >= len(pauses) {
			p99Idx = len(pauses) - 1
		}
		p99Pause = pauses[p99Idx]
	}

	minPause := time.Duration(0)
	maxPause := time.Duration(0)
	if len(pauses) > 0 {
		minPause = pauses[0]
		maxPause = pauses[len(pauses)-1]
	}

	return models.PauseDistribution{
		TotalPauses:      len(pauses),
		MeanPause:        meanPause,
		MedianPause:      medianPause,
		P95Pause:         p95Pause,
		P99Pause:         p99Pause,
		MaxPause:         maxPause,
		MinPause:         minPause,
		STWPauses:        stwPauses,
		ConcurrentPauses: concurrentPauses,
	}
}

func (a *Analyzer) analyzeHeapGoalDeviation(traces []models.GCTraceEntry) models.HeapGoalDeviation {
	if len(traces) == 0 {
		return models.HeapGoalDeviation{}
	}

	var goalDetails []models.GoalDetail
	goalAchieved := 0
	goalMissed := 0
	totalDeviation := 0.0
	maxDeviation := 0.0
	minDeviation := 100.0

	for _, t := range traces {
		if t.HeapGoal == 0 {
			continue
		}

		deviation := (float64(t.HeapInUse) - float64(t.HeapGoal)) / float64(t.HeapGoal) * 100
		if deviation < 0 {
			deviation = -deviation
		}

		achieved := t.HeapInUse <= t.HeapGoal
		if achieved {
			goalAchieved++
		} else {
			goalMissed++
		}

		totalDeviation += deviation
		if deviation > maxDeviation {
			maxDeviation = deviation
		}
		if deviation < minDeviation {
			minDeviation = deviation
		}

		goalDetails = append(goalDetails, models.GoalDetail{
			GCNumber:   t.GCNumber,
			Timestamp:  t.Timestamp,
			HeapGoal:   t.HeapGoal,
			ActualHeap: t.HeapInUse,
			Deviation:  deviation,
			Achieved:   achieved,
		})
	}

	meanDeviation := 0.0
	if len(goalDetails) > 0 {
		meanDeviation = totalDeviation / float64(len(goalDetails))
	}

	return models.HeapGoalDeviation{
		TotalGCs:      len(traces),
		MeanDeviation: meanDeviation,
		MaxDeviation:  maxDeviation,
		MinDeviation:  minDeviation,
		GoalAchieved:  goalAchieved,
		GoalMissed:    goalMissed,
		GoalDetails:   goalDetails,
	}
}

func (a *Analyzer) analyzeAssistPressure(traces []models.GCTraceEntry) models.AssistPressure {
	if len(traces) == 0 {
		return models.AssistPressure{}
	}

	var assistPerGC []models.AssistPerGC
	var highPressureGCs []int
	totalAssistedBytes := uint64(0)
	maxAssistBytes := uint64(0)
	totalAssists := 0

	for _, t := range traces {
		if t.AssistedG > 0 || t.AssistedBytes > 0 {
			totalAssists++
			totalAssistedBytes += t.AssistedBytes
			if t.AssistedBytes > maxAssistBytes {
				maxAssistBytes = t.AssistedBytes
			}

			pressureLevel := "low"
			if t.AssistedBytes > 100*1024*1024 {
				pressureLevel = "high"
				highPressureGCs = append(highPressureGCs, t.GCNumber)
			} else if t.AssistedBytes > 10*1024*1024 {
				pressureLevel = "medium"
			}

			assistPerGC = append(assistPerGC, models.AssistPerGC{
				GCNumber:      t.GCNumber,
				AssistedG:     t.AssistedG,
				AssistedBytes: t.AssistedBytes,
				PressureLevel: pressureLevel,
			})
		}
	}

	meanAssistBytes := uint64(0)
	if totalAssists > 0 {
		meanAssistBytes = totalAssistedBytes / uint64(totalAssists)
	}

	return models.AssistPressure{
		TotalAssists:       totalAssists,
		TotalAssistedBytes: totalAssistedBytes,
		MeanAssistBytes:    meanAssistBytes,
		MaxAssistBytes:     maxAssistBytes,
		AssistPerGC:        assistPerGC,
		HighPressureGCs:    highPressureGCs,
	}
}

func (a *Analyzer) analyzeMemoryPeaks(traces []models.GCTraceEntry, samples []models.HeapSample) models.MemoryPeaks {
	peaks := models.MemoryPeaks{}

	peakHeapAlloc := uint64(0)
	peakHeapInUse := uint64(0)
	peakHeapSys := uint64(0)
	peakObjects := uint64(0)
	peakTimestamp := time.Time{}

	for _, t := range traces {
		if t.HeapInUse > peakHeapInUse {
			peakHeapInUse = t.HeapInUse
			peakHeapAlloc = t.HeapInUse
			peakTimestamp = t.Timestamp
		}
	}

	for _, s := range samples {
		if s.HeapAlloc > peakHeapAlloc {
			peakHeapAlloc = s.HeapAlloc
			peakTimestamp = s.Timestamp
		}
		if s.HeapInUse > peakHeapInUse {
			peakHeapInUse = s.HeapInUse
			peakTimestamp = s.Timestamp
		}
		if s.HeapSys > peakHeapSys {
			peakHeapSys = s.HeapSys
			peakTimestamp = s.Timestamp
		}
		if s.HeapObjects > peakObjects {
			peakObjects = s.HeapObjects
			peakTimestamp = s.Timestamp
		}
	}

	peaks.PeakHeapAlloc = peakHeapAlloc
	peaks.PeakHeapInUse = peakHeapInUse
	peaks.PeakHeapSys = peakHeapSys
	peaks.PeakObjects = peakObjects
	peaks.PeakTimestamp = peakTimestamp

	return peaks
}

func (a *Analyzer) generateRecommendations(result *models.AnalysisResult) []models.Recommendation {
	var recommendations []models.Recommendation

	if result.PauseDistribution.P99Pause > 10*time.Millisecond {
		recommendations = append(recommendations, models.Recommendation{
			Category:    "PauseTime",
			Severity:    "High",
			Title:       "GC 暂停时间过高",
			Description: "P99 暂停时间超过 10ms，可能影响延迟敏感的应用",
			Action:      "建议：1) 检查是否有大对象分配 2) 考虑调整 GOGC 或 GOMEMLIMIT 3) 查看写屏障开销",
		})
	}

	if result.PauseDistribution.MaxPause > 50*time.Millisecond {
		recommendations = append(recommendations, models.Recommendation{
			Category:    "PauseTime",
			Severity:    "Critical",
			Title:       "存在超长 GC 暂停",
			Description: "检测到超过 50ms 的 GC 暂停，这可能导致严重的服务抖动",
			Action:      "建议：1) 检查是否有内存泄漏 2) 分析堆对象分布 3) 考虑使用内存池 4) 检查是否触发了强制 GC",
		})
	}

	if result.HeapGoalDeviation.GoalMissed > 0 {
		goalMissRate := float64(result.HeapGoalDeviation.GoalMissed) / float64(result.HeapGoalDeviation.TotalGCs) * 100
		if goalMissRate > 20 {
			recommendations = append(recommendations, models.Recommendation{
				Category:    "HeapGoal",
				Severity:    "Medium",
				Title:       "堆目标达成率低",
				Description: "超过 20% 的 GC 循环未能在堆目标内完成",
				Action:      "建议：1) 检查分配速率 2) 考虑增加 GOGC 值 3) 分析 GC assist 压力",
			})
		}
	}

	if len(result.AssistPressure.HighPressureGCs) > 0 {
		recommendations = append(recommendations, models.Recommendation{
			Category:    "AssistPressure",
			Severity:    "High",
			Title:       "存在 GC assist 高压",
			Description: "检测到需要用户 goroutine 协助 GC 标记的高压情况",
			Action:      "建议：1) 降低分配速率 2) 考虑使用内存池 3) 增加 GOGC 或设置 GOMEMLIMIT 4) 检查大对象分配",
		})
	}

	if result.AssistPressure.TotalAssists > 0 {
		recommendations = append(recommendations, models.Recommendation{
			Category:    "AssistPressure",
			Severity:    "Low",
			Title:       "存在 GC assist",
			Description: "检测到用户 goroutine 参与了 GC 标记工作",
			Action:      "建议：如果 assist 频率高，考虑优化分配模式",
		})
	}

	if result.MemoryPeaks.PeakHeapAlloc > 0 {
		allocGB := float64(result.MemoryPeaks.PeakHeapAlloc) / (1024 * 1024 * 1024)
		if allocGB > 4 {
			recommendations = append(recommendations, models.Recommendation{
				Category:    "Memory",
				Severity:    "Medium",
				Title:       "内存峰值较高",
				Description: "内存峰值超过 4GB",
				Action:      "建议：1) 分析内存使用模式 2) 检查是否有内存泄漏 3) 考虑设置 GOMEMLIMIT",
			})
		}
	}

	return recommendations
}

func (a *Analyzer) calculateRawMetrics(traces []models.GCTraceEntry, samples []models.HeapSample) models.RawMetrics {
	metrics := models.RawMetrics{
		TotalGCs: len(traces),
	}

	if len(traces) > 0 {
		totalPauseTime := time.Duration(0)
		totalCPUFraction := 0.0
		startTime := traces[0].Timestamp
		endTime := traces[len(traces)-1].Timestamp

		for _, t := range traces {
			totalPauseTime += t.PauseDuration
			totalCPUFraction += t.CPUFraction
			if t.Timestamp.Before(startTime) {
				startTime = t.Timestamp
			}
			if t.Timestamp.After(endTime) {
				endTime = t.Timestamp
			}
			metrics.GOGC = t.GOGC
			metrics.GOMEMLIMIT = t.GOMEMLIMIT
		}

		metrics.TotalPauseTime = totalPauseTime
		if len(traces) > 0 {
			metrics.MeanGCCPUFraction = totalCPUFraction / float64(len(traces))
		}
		metrics.StartTime = startTime
		metrics.EndTime = endTime
		metrics.TotalDuration = endTime.Sub(startTime)
	}

	return metrics
}

func (a *Analyzer) Compare(resultA, resultB *models.AnalysisResult) *models.ComparisonResult {
	comparison := &models.ComparisonResult{
		SessionAID: resultA.SessionID,
		SessionBID: resultB.SessionID,
		CreatedAt:  time.Now(),
	}

	var differences []models.Difference
	var insights []models.KeyInsight

	pauseDiff := calculatePercentageChange(
		float64(resultA.PauseDistribution.MeanPause),
		float64(resultB.PauseDistribution.MeanPause),
	)
	if pauseDiff != 0 {
		significance := "normal"
		if pauseDiff > 50 {
			significance = "significant"
		}
		differences = append(differences, models.Difference{
			Metric:        "Mean Pause Time",
			ValueA:        resultA.PauseDistribution.MeanPause,
			ValueB:        resultB.PauseDistribution.MeanPause,
			ChangePercent: pauseDiff,
			Significance:  significance,
		})
	}

	if len(resultB.Recommendations) < len(resultA.Recommendations) {
		insights = append(insights, models.KeyInsight{
			Title:       "优化效果显著",
			Description: "优化后需要注意的问题减少了",
			Impact:      "Positive",
		})
	}

	if resultB.PauseDistribution.P99Pause < resultA.PauseDistribution.P99Pause {
		insights = append(insights, models.KeyInsight{
			Title:       "延迟改善",
			Description: "P99 暂停时间有所改善",
			Impact:      "Positive",
		})
	}

	comparison.Differences = differences
	comparison.KeyInsights = insights

	if len(insights) > 0 {
		comparison.OverallTrend = "Improving"
	} else {
		comparison.OverallTrend = "Stable"
	}

	return comparison
}

func calculatePercentageChange(old, new float64) float64 {
	if old == 0 {
		return 0
	}
	return (new - old) / old * 100
}
