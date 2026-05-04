package analyzer

import (
	"fmt"
	"math"
	"memreplay/internal/models"
	"memreplay/internal/storage"
	"sort"
	"strconv"
	"strings"
	"time"
)

type AnalysisConfig struct {
	ConfidenceThreshold float64
	SeverityThreshold   string
}

type Analyzer struct {
	config AnalysisConfig
}

func NewAnalyzer(config AnalysisConfig) *Analyzer {
	if config.ConfidenceThreshold <= 0 {
		config.ConfidenceThreshold = 0.5
	}
	return &Analyzer{config: config}
}

func (a *Analyzer) AnalyzeBatch(batchID string) (*models.AnalysisResult, error) {
	memStats, err := storage.GetMemStatsByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 MemStats 失败: %w", err)
	}

	goroutines, err := storage.GetGoroutinesByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 Goroutines 失败: %w", err)
	}

	allocSites, err := storage.GetAllocSitesByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 AllocSites 失败: %w", err)
	}

	traffic, err := storage.GetTrafficByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 Traffic 失败: %w", err)
	}

	configs, err := storage.GetConfigsByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 Configs 失败: %w", err)
	}

	heapProfiles, err := storage.GetHeapProfilesByBatch(batchID)
	if err != nil {
		return nil, fmt.Errorf("获取 HeapProfiles 失败: %w", err)
	}

	result := &models.AnalysisResult{
		BatchID:         batchID,
		Findings:        []models.Finding{},
		Evidence:        []models.EvidenceItem{},
		Recommendations: []models.Recommendation{},
	}

	findingsMap := make(map[string]*models.Finding)

	a.analyzeMemoryTrend(memStats, result, findingsMap)
	a.analyzeGCBehavior(memStats, result, findingsMap)
	a.analyzeGoroutineLeak(goroutines, result, findingsMap)
	a.analyzeAllocSites(allocSites, result, findingsMap)
	a.analyzeHeapProfiles(heapProfiles, result, findingsMap)
	a.analyzeTrafficCorrelation(memStats, traffic, result, findingsMap)
	a.analyzeConfigRisks(configs, result, findingsMap)

	a.calculateFinalConclusion(result)

	return result, nil
}

func (a *Analyzer) analyzeMemoryTrend(memStats []models.MemStatsRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(memStats) < 2 {
		return
	}

	first := memStats[0]
	last := memStats[len(memStats)-1]

	heapGrowth := float64(last.HeapAlloc) - float64(first.HeapAlloc)
	heapGrowthPct := 0.0
	if first.HeapAlloc > 0 {
		heapGrowthPct = (float64(last.HeapAlloc) - float64(first.HeapAlloc)) / float64(first.HeapAlloc) * 100
	}

	objectGrowth := float64(last.HeapObjects) - float64(first.HeapObjects)
	objectGrowthPct := 0.0
	if first.HeapObjects > 0 {
		objectGrowthPct = (float64(last.HeapObjects) - float64(first.HeapObjects)) / float64(first.HeapObjects) * 100
	}

	rssGrowth := float64(last.RSS) - float64(first.RSS)
	rssGrowthPct := 0.0
	if first.RSS > 0 {
		rssGrowthPct = (float64(last.RSS) - float64(first.RSS)) / float64(first.RSS) * 100
	}

	avgHeapPerSample := calculateAverageHeap(memStats)

	a.addEvidence(result, "memory_trend", "heap_growth",
		fmt.Sprintf("%.2f MB (%.2f%%)", heapGrowth/(1024*1024), heapGrowthPct),
		fmt.Sprintf("初始: %.2f MB, 最终: %.2f MB",
			float64(first.HeapAlloc)/(1024*1024), float64(last.HeapAlloc)/(1024*1024)),
		"mem_stats")

	a.addEvidence(result, "memory_trend", "object_growth",
		fmt.Sprintf("%.0f 个 (%.2f%%)", objectGrowth, objectGrowthPct),
		fmt.Sprintf("初始: %d 个, 最终: %d 个", first.HeapObjects, last.HeapObjects),
		"mem_stats")

	if heapGrowthPct > 50 || objectGrowthPct > 50 {
		finding := &models.Finding{
			Category: "memory_growth",
			Title:    "堆内存持续增长",
			Description: fmt.Sprintf("堆内存增长 %.2f%%, 对象数增长 %.2f%%, 平均堆大小 %.2f MB",
				heapGrowthPct, objectGrowthPct, avgHeapPerSample/(1024*1024)),
			Confidence: minFloat64(1.0, heapGrowthPct/200.0+0.3),
			Severity:   a.calculateSeverity(heapGrowthPct),
			Source:     "mem_stats",
		}
		findingsMap["heap_growth"] = finding
		result.Findings = append(result.Findings, *finding)
	}

	if rssGrowthPct > 50 {
		finding := &models.Finding{
			Category: "rss_growth",
			Title:    "RSS 内存持续增长",
			Description: fmt.Sprintf("RSS 增长 %.2f%% (%.2f MB), 可能存在未释放的系统内存",
				rssGrowthPct, rssGrowth/(1024*1024)),
			Confidence: minFloat64(1.0, rssGrowthPct/200.0+0.2),
			Severity:   a.calculateSeverity(rssGrowthPct),
			Source:     "mem_stats",
		}
		findingsMap["rss_growth"] = finding
		result.Findings = append(result.Findings, *finding)
	}
}

func (a *Analyzer) analyzeGCBehavior(memStats []models.MemStatsRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(memStats) < 2 {
		return
	}

	first := memStats[0]
	last := memStats[len(memStats)-1]

	gcCount := int(last.NumGC - first.NumGC)
	totalPauseNs := last.PauseTotalNs - first.PauseTotalNs
	avgPauseNs := float64(0)
	if gcCount > 0 {
		avgPauseNs = float64(totalPauseNs) / float64(gcCount)
	}

	gcCPUFractionAvg := calculateAverageGCCPU(memStats)

	a.addEvidence(result, "gc_behavior", "gc_count",
		fmt.Sprintf("%d 次", gcCount),
		fmt.Sprintf("初始 NumGC: %d, 最终 NumGC: %d", first.NumGC, last.NumGC),
		"mem_stats")

	a.addEvidence(result, "gc_behavior", "avg_gc_pause",
		fmt.Sprintf("%.2f ms", avgPauseNs/1e6),
		fmt.Sprintf("总暂停时间: %.2f ms", float64(totalPauseNs)/1e6),
		"mem_stats")

	if avgPauseNs > 50*1e6 {
		finding := &models.Finding{
			Category:    "gc_pause",
			Title:       "GC 暂停时间过长",
			Description: fmt.Sprintf("平均 GC 暂停 %.2f ms, 超过阈值 50ms", avgPauseNs/1e6),
			Confidence:  minFloat64(1.0, avgPauseNs/(100*1e6)),
			Severity:    "medium",
			Source:      "mem_stats",
		}
		findingsMap["gc_pause_long"] = finding
		result.Findings = append(result.Findings, *finding)
	}

	if gcCPUFractionAvg > 0.1 {
		finding := &models.Finding{
			Category:    "gc_cpu",
			Title:       "GC CPU 占用过高",
			Description: fmt.Sprintf("GC CPU 占用平均 %.2f%%, 超过阈值 10%%", gcCPUFractionAvg*100),
			Confidence:  minFloat64(1.0, gcCPUFractionAvg*5),
			Severity:    "medium",
			Source:      "mem_stats",
		}
		findingsMap["gc_cpu_high"] = finding
		result.Findings = append(result.Findings, *finding)
	}
}

func (a *Analyzer) analyzeGoroutineLeak(goroutines []models.GoroutineRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(goroutines) == 0 {
		return
	}

	statusCount := make(map[string]int)
	functionCount := make(map[string]int)
	waitingGoroutines := []models.GoroutineRecord{}

	for _, g := range goroutines {
		statusCount[g.Status]++
		if g.Function != "" {
			functionCount[g.Function]++
		}
		if g.Status == "IO wait" || g.Status == "chan receive" || g.Status == "chan send" {
			waitingGoroutines = append(waitingGoroutines, g)
		}
	}

	a.addEvidence(result, "goroutine_analysis", "total_count",
		fmt.Sprintf("%d 个", len(goroutines)),
		"",
		"goroutines")

	for status, count := range statusCount {
		a.addEvidence(result, "goroutine_analysis", fmt.Sprintf("status_%s", status),
			fmt.Sprintf("%d 个", count),
			"",
			"goroutines")
	}

	leakSuspects := []string{}
	for funcName, count := range functionCount {
		if count > 10 {
			leakSuspects = append(leakSuspects, fmt.Sprintf("%s: %d 个", funcName, count))
		}
	}

	if len(waitingGoroutines) > 20 {
		finding := &models.Finding{
			Category:    "goroutine_leak",
			Title:       "Goroutine 泄漏嫌疑",
			Description: fmt.Sprintf("%d 个 goroutine 处于等待状态 (IO/chan), 可能存在泄漏", len(waitingGoroutines)),
			Confidence:  minFloat64(1.0, float64(len(waitingGoroutines))/100.0),
			Severity:    "high",
			Source:      "goroutines",
		}
		findingsMap["goroutine_leak_wait"] = finding
		result.Findings = append(result.Findings, *finding)

		for _, g := range waitingGoroutines[:10] {
			a.addEvidence(result, "goroutine_leak", "waiting_goroutine",
				fmt.Sprintf("Goroutine #%d", g.GoroutineID),
				fmt.Sprintf("状态: %s, 函数: %s, 文件: %s:%d", g.Status, g.Function, g.File, g.Line),
				"goroutines")
		}
	}

	if len(leakSuspects) > 0 {
		finding := &models.Finding{
			Category:    "goroutine_concentration",
			Title:       "Goroutine 函数集中",
			Description: fmt.Sprintf("多个 goroutine 集中在少数函数: %s", strings.Join(leakSuspects, ", ")),
			Confidence:  0.6,
			Severity:    "medium",
			Source:      "goroutines",
		}
		findingsMap["goroutine_concentration"] = finding
		result.Findings = append(result.Findings, *finding)
	}
}

func (a *Analyzer) analyzeAllocSites(allocSites []models.AllocSite, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(allocSites) == 0 {
		return
	}

	sort.Slice(allocSites, func(i, j int) bool {
		return allocSites[i].InuseBytes > allocSites[j].InuseBytes
	})

	topN := min(10, len(allocSites))
	for i := 0; i < topN; i++ {
		site := allocSites[i]
		a.addEvidence(result, "alloc_sites", fmt.Sprintf("top_%d", i+1),
			fmt.Sprintf("%.2f MB", float64(site.InuseBytes)/(1024*1024)),
			fmt.Sprintf("函数: %s, 文件: %s:%d, 活跃对象: %d",
				site.Function, site.File, site.Line, site.InuseObjects),
			"alloc_sites")
	}

	if len(allocSites) > 0 {
		topSite := allocSites[0]
		totalInuseBytes := uint64(0)
		for _, site := range allocSites {
			totalInuseBytes += site.InuseBytes
		}

		topPercentage := float64(0)
		if totalInuseBytes > 0 {
			topPercentage = float64(topSite.InuseBytes) / float64(totalInuseBytes) * 100
		}

		if topPercentage > 50 {
			finding := &models.Finding{
				Category: "alloc_concentration",
				Title:    "分配点过于集中",
				Description: fmt.Sprintf("单一分配点占用 %.2f%% 的活跃内存: %s",
					topPercentage, topSite.Function),
				Confidence: 0.8,
				Severity:   "medium",
				Source:     "alloc_sites",
			}
			findingsMap["alloc_concentration"] = finding
			result.Findings = append(result.Findings, *finding)
		}

		if topSite.InuseObjects > 10000 {
			finding := &models.Finding{
				Category: "long_lived_objects",
				Title:    "大量长期存活对象",
				Description: fmt.Sprintf("分配点 %s 有 %d 个活跃对象, 可能存在缓存未淘汰或对象泄漏",
					topSite.Function, topSite.InuseObjects),
				Confidence: 0.7,
				Severity:   "high",
				Source:     "alloc_sites",
			}
			findingsMap["long_lived_objects"] = finding
			result.Findings = append(result.Findings, *finding)
		}
	}
}

func (a *Analyzer) analyzeHeapProfiles(heapProfiles []models.HeapProfileRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(heapProfiles) == 0 {
		return
	}

	sort.Slice(heapProfiles, func(i, j int) bool {
		return heapProfiles[i].InuseBytes > heapProfiles[j].InuseBytes
	})

	topN := min(5, len(heapProfiles))
	for i := 0; i < topN; i++ {
		prof := heapProfiles[i]
		a.addEvidence(result, "heap_profile", fmt.Sprintf("top_%d", i+1),
			fmt.Sprintf("%.2f MB (type: %s)", float64(prof.InuseBytes)/(1024*1024), prof.Type),
			fmt.Sprintf("函数: %s, 文件: %s:%d", prof.Function, prof.File, prof.Line),
			"heap_profile")
	}

	for _, prof := range heapProfiles {
		if strings.Contains(strings.ToLower(prof.Function), "timer") ||
			strings.Contains(strings.ToLower(prof.Function), "ticker") ||
			strings.Contains(strings.ToLower(prof.File), "time") {
			if prof.InuseObjects > 100 {
				finding := &models.Finding{
					Category: "timer_leak",
					Title:    "Timer/Ticker 未释放嫌疑",
					Description: fmt.Sprintf("发现大量 Timer 相关对象: %s 有 %d 个活跃对象",
						prof.Function, prof.InuseObjects),
					Confidence: 0.6,
					Severity:   "medium",
					Source:     "heap_profile",
				}
				findingsMap["timer_leak"] = finding
				result.Findings = append(result.Findings, *finding)
			}
		}
	}
}

func (a *Analyzer) analyzeTrafficCorrelation(memStats []models.MemStatsRecord, traffic []models.TrafficRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	if len(memStats) < 2 || len(traffic) == 0 {
		return
	}

	totalRequests := uint64(0)
	maxQPS := float64(0)
	for _, t := range traffic {
		totalRequests += t.Requests
		if t.QPS > maxQPS {
			maxQPS = t.QPS
		}
	}

	first := memStats[0]
	last := memStats[len(memStats)-1]
	memGrowth := float64(last.HeapAlloc) - float64(first.HeapAlloc)

	var memPerRequest float64
	if totalRequests > 0 {
		memPerRequest = memGrowth / float64(totalRequests)
	}

	a.addEvidence(result, "traffic_correlation", "total_requests",
		fmt.Sprintf("%d", totalRequests),
		"",
		"traffic")

	a.addEvidence(result, "traffic_correlation", "max_qps",
		fmt.Sprintf("%.2f", maxQPS),
		"",
		"traffic")

	a.addEvidence(result, "traffic_correlation", "mem_per_request",
		fmt.Sprintf("%.2f bytes", memPerRequest),
		"内存增长 / 请求数",
		"mem_stats+traffic")

	if maxQPS < 100 && memGrowth > 100*1024*1024 {
		finding := &models.Finding{
			Category: "memory_vs_traffic",
			Title:    "内存增长与流量不匹配",
			Description: fmt.Sprintf("QPS 较低 (%.2f) 但内存增长显著 (%.2f MB), 内存增长与流量不成正比",
				maxQPS, memGrowth/(1024*1024)),
			Confidence: 0.7,
			Severity:   "high",
			Source:     "mem_stats+traffic",
		}
		findingsMap["memory_vs_traffic"] = finding
		result.Findings = append(result.Findings, *finding)
	}
}

func (a *Analyzer) analyzeConfigRisks(configs []models.ConfigRecord, result *models.AnalysisResult, findingsMap map[string]*models.Finding) {
	configMap := make(map[string]string)
	for _, c := range configs {
		configMap[c.Key] = c.Value
	}

	riskyConfigs := []string{}

	for key, value := range configMap {
		keyLower := strings.ToLower(key)

		if strings.Contains(keyLower, "ttl") || strings.Contains(keyLower, "expire") {
			ttlVal := parseDuration(value)
			if ttlVal > 24*time.Hour || ttlVal == 0 {
				riskyConfigs = append(riskyConfigs,
					fmt.Sprintf("%s=%s (TTL 过长或为0, 可能导致缓存永不过期)", key, value))
			}
		}

		if strings.Contains(keyLower, "cache") && strings.Contains(keyLower, "size") {
			sizeVal := parseInt(value)
			if sizeVal > 1000000 || sizeVal == 0 {
				riskyConfigs = append(riskyConfigs,
					fmt.Sprintf("%s=%s (缓存大小过大或无限制)", key, value))
			}
		}

		if strings.Contains(keyLower, "worker") || strings.Contains(keyLower, "goroutine") {
			workerVal := parseInt(value)
			if workerVal > 10000 {
				riskyConfigs = append(riskyConfigs,
					fmt.Sprintf("%s=%s (worker 数过大)", key, value))
			}
		}

		if strings.Contains(keyLower, "gc") && strings.Contains(keyLower, "percent") {
			gcPercent := parseInt(value)
			if gcPercent > 100 {
				riskyConfigs = append(riskyConfigs,
					fmt.Sprintf("%s=%s (GC 百分比过高)", key, value))
			}
		}
	}

	for _, risky := range riskyConfigs {
		a.addEvidence(result, "config_risk", "risky_config",
			risky,
			"",
			"configs")
	}

	if len(riskyConfigs) > 0 {
		finding := &models.Finding{
			Category:    "config_risk",
			Title:       "存在风险配置",
			Description: fmt.Sprintf("发现 %d 个可能导致内存问题的配置项", len(riskyConfigs)),
			Confidence:  0.5,
			Severity:    "low",
			Source:      "configs",
		}
		findingsMap["config_risk"] = finding
		result.Findings = append(result.Findings, *finding)
	}
}

func (a *Analyzer) addEvidence(result *models.AnalysisResult, findingType, evidenceType, value, details, source string) {
	evidence := models.EvidenceItem{
		Type:    evidenceType,
		Value:   value,
		Details: details,
		Source:  source,
	}
	result.Evidence = append(result.Evidence, evidence)
}

func (a *Analyzer) calculateSeverity(growthPct float64) string {
	if growthPct > 200 {
		return "critical"
	} else if growthPct > 100 {
		return "high"
	} else if growthPct > 50 {
		return "medium"
	}
	return "low"
}

func (a *Analyzer) calculateFinalConclusion(result *models.AnalysisResult) {
	highSeverityCount := 0
	mediumSeverityCount := 0
	totalConfidence := 0.0

	for _, f := range result.Findings {
		if f.Severity == "critical" || f.Severity == "high" {
			highSeverityCount++
		} else if f.Severity == "medium" {
			mediumSeverityCount++
		}
		totalConfidence += f.Confidence
	}

	if len(result.Findings) > 0 {
		result.Confidence = totalConfidence / float64(len(result.Findings))
	} else {
		result.Confidence = 0.0
	}

	if highSeverityCount > 0 {
		result.RiskLevel = "high"
		result.Conclusion = fmt.Sprintf("发现 %d 个高风险问题, %d 个中等风险问题, 建议立即排查",
			highSeverityCount, mediumSeverityCount)
	} else if mediumSeverityCount > 0 {
		result.RiskLevel = "medium"
		result.Conclusion = fmt.Sprintf("发现 %d 个中等风险问题, 建议关注并排查",
			mediumSeverityCount)
	} else if len(result.Findings) > 0 {
		result.RiskLevel = "low"
		result.Conclusion = "发现一些低风险问题, 建议定期监控"
	} else {
		result.RiskLevel = "none"
		result.Conclusion = "未发现明显的内存问题"
	}

	a.generateRecommendations(result)
}

func (a *Analyzer) generateRecommendations(result *models.AnalysisResult) {
	for _, finding := range result.Findings {
		var rec models.Recommendation
		rec.AnalysisID = result.ID

		switch finding.Category {
		case "memory_growth":
			rec.Priority = "high"
			rec.Action = "检查主要分配点的对象生命周期"
			rec.Details = "分析内存增长趋势, 确认是否是预期的缓存增长还是对象泄漏。重点关注 top 分配点。"
		case "goroutine_leak", "goroutine_leak_wait":
			rec.Priority = "high"
			rec.Action = "检查 goroutine 泄漏点"
			rec.Details = "分析等待状态的 goroutine, 检查 channel 是否正确关闭, IO 操作是否有超时设置。"
		case "timer_leak":
			rec.Priority = "high"
			rec.Action = "检查 Timer/Ticker 释放逻辑"
			rec.Details = "确认所有 time.NewTicker 都有对应的 Stop(), time.AfterFunc 是否有正确的终止逻辑。"
		case "long_lived_objects":
			rec.Priority = "medium"
			rec.Action = "检查缓存淘汰策略"
			rec.Details = "确认 LRU 缓存是否正确工作, TTL 设置是否合理, 是否存在内存泄漏。"
		case "gc_pause", "gc_cpu":
			rec.Priority = "medium"
			rec.Action = "优化 GC 配置"
			rec.Details = "考虑调整 GOGC, 或使用 runtime/debug.SetGCPercent。检查是否有大量小对象导致 GC 压力。"
		case "memory_vs_traffic":
			rec.Priority = "high"
			rec.Action = "分析内存增长与流量的相关性"
			rec.Details = "低 QPS 但内存持续增长, 很可能存在泄漏。检查是否有后台任务、定时器、或未释放的资源。"
		case "config_risk":
			rec.Priority = "medium"
			rec.Action = "审查风险配置项"
			rec.Details = "检查 TTL、缓存大小、worker 数等配置是否合理, 避免无限制的资源消耗。"
		default:
			rec.Priority = "low"
			rec.Action = fmt.Sprintf("关注 %s 问题", finding.Category)
			rec.Details = finding.Description
		}

		result.Recommendations = append(result.Recommendations, rec)
	}

	if len(result.Recommendations) == 0 {
		result.Recommendations = append(result.Recommendations, models.Recommendation{
			Priority: "low",
			Action:   "继续监控",
			Details:  "当前未发现明显问题, 建议持续监控内存使用情况。",
		})
	}
}

func calculateAverageHeap(memStats []models.MemStatsRecord) float64 {
	if len(memStats) == 0 {
		return 0
	}
	total := uint64(0)
	for _, m := range memStats {
		total += m.HeapAlloc
	}
	return float64(total) / float64(len(memStats))
}

func calculateAverageGCCPU(memStats []models.MemStatsRecord) float64 {
	if len(memStats) == 0 {
		return 0
	}
	total := float64(0)
	for _, m := range memStats {
		total += m.GCCPUFraction
	}
	return total / float64(len(memStats))
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err == nil {
		return d
	}

	seconds, err := strconv.ParseFloat(s, 64)
	if err == nil {
		return time.Duration(seconds) * time.Second
	}

	return 0
}

func parseInt(s string) int {
	val, err := strconv.Atoi(s)
	if err == nil {
		return val
	}
	return 0
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func minFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func (a *Analyzer) CompareBatches(baseBatchID, targetBatchID string) (*models.CompareResult, error) {
	result := &models.CompareResult{
		BaseBatchID:   baseBatchID,
		TargetBatchID: targetBatchID,
		Differences:   []models.Difference{},
	}

	baseMemStats, err := storage.GetMemStatsByBatch(baseBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取基线批次 MemStats 失败: %w", err)
	}

	targetMemStats, err := storage.GetMemStatsByBatch(targetBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取目标批次 MemStats 失败: %w", err)
	}

	baseGoroutines, err := storage.GetGoroutinesByBatch(baseBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取基线批次 Goroutines 失败: %w", err)
	}

	targetGoroutines, err := storage.GetGoroutinesByBatch(targetBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取目标批次 Goroutines 失败: %w", err)
	}

	baseTraffic, err := storage.GetTrafficByBatch(baseBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取基线批次 Traffic 失败: %w", err)
	}

	targetTraffic, err := storage.GetTrafficByBatch(targetBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取目标批次 Traffic 失败: %w", err)
	}

	baseConfigs, err := storage.GetConfigsByBatch(baseBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取基线批次 Configs 失败: %w", err)
	}

	targetConfigs, err := storage.GetConfigsByBatch(targetBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取目标批次 Configs 失败: %w", err)
	}

	baseAllocSites, err := storage.GetAllocSitesByBatch(baseBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取基线批次 AllocSites 失败: %w", err)
	}

	targetAllocSites, err := storage.GetAllocSitesByBatch(targetBatchID)
	if err != nil {
		return nil, fmt.Errorf("获取目标批次 AllocSites 失败: %w", err)
	}

	a.compareMemStats(baseMemStats, targetMemStats, result)
	a.compareGoroutines(baseGoroutines, targetGoroutines, result)
	a.compareTraffic(baseTraffic, targetTraffic, result)
	a.compareConfigs(baseConfigs, targetConfigs, result)
	a.compareAllocSites(baseAllocSites, targetAllocSites, result)

	a.calculateCompareConclusion(result)

	return result, nil
}

func (a *Analyzer) compareMemStats(base, target []models.MemStatsRecord, result *models.CompareResult) {
	if len(base) == 0 || len(target) == 0 {
		return
	}

	baseLast := base[len(base)-1]
	targetLast := target[len(target)-1]

	heapAllocPct := 0.0
	if baseLast.HeapAlloc > 0 {
		heapAllocPct = (float64(targetLast.HeapAlloc) - float64(baseLast.HeapAlloc)) / float64(baseLast.HeapAlloc) * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "memory",
		Metric:      "heap_alloc",
		BaseValue:   fmt.Sprintf("%.2f MB", float64(baseLast.HeapAlloc)/(1024*1024)),
		TargetValue: fmt.Sprintf("%.2f MB", float64(targetLast.HeapAlloc)/(1024*1024)),
		ChangePct:   heapAllocPct,
		Importance:  a.getImportance(heapAllocPct),
		Description: "堆内存使用量变化",
	})

	objectPct := 0.0
	if baseLast.HeapObjects > 0 {
		objectPct = (float64(targetLast.HeapObjects) - float64(baseLast.HeapObjects)) / float64(baseLast.HeapObjects) * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "memory",
		Metric:      "heap_objects",
		BaseValue:   fmt.Sprintf("%d", baseLast.HeapObjects),
		TargetValue: fmt.Sprintf("%d", targetLast.HeapObjects),
		ChangePct:   objectPct,
		Importance:  a.getImportance(objectPct),
		Description: "堆对象数量变化",
	})

	gcPct := 0.0
	if baseLast.NumGC > 0 {
		gcPct = (float64(targetLast.NumGC) - float64(baseLast.NumGC)) / float64(baseLast.NumGC) * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "gc",
		Metric:      "num_gc",
		BaseValue:   fmt.Sprintf("%d", baseLast.NumGC),
		TargetValue: fmt.Sprintf("%d", targetLast.NumGC),
		ChangePct:   gcPct,
		Importance:  a.getImportance(gcPct),
		Description: "GC 次数变化",
	})
}

func (a *Analyzer) compareGoroutines(base, target []models.GoroutineRecord, result *models.CompareResult) {
	goroutinePct := 0.0
	if len(base) > 0 {
		goroutinePct = (float64(len(target)) - float64(len(base))) / float64(len(base)) * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "goroutine",
		Metric:      "goroutine_count",
		BaseValue:   fmt.Sprintf("%d", len(base)),
		TargetValue: fmt.Sprintf("%d", len(target)),
		ChangePct:   goroutinePct,
		Importance:  a.getImportance(goroutinePct),
		Description: "Goroutine 数量变化",
	})

	baseStatus := countGoroutineStatus(base)
	targetStatus := countGoroutineStatus(target)

	for status, baseCount := range baseStatus {
		targetCount := targetStatus[status]
		diff := float64(targetCount) - float64(baseCount)
		if math.Abs(diff) > 10 {
			pct := 0.0
			if baseCount > 0 {
				pct = (float64(targetCount) - float64(baseCount)) / float64(baseCount) * 100
			}
			result.Differences = append(result.Differences, models.Difference{
				Category:    "goroutine",
				Metric:      fmt.Sprintf("goroutine_%s", status),
				BaseValue:   fmt.Sprintf("%d", baseCount),
				TargetValue: fmt.Sprintf("%d", targetCount),
				ChangePct:   pct,
				Importance:  a.getImportance(pct),
				Description: fmt.Sprintf("%s 状态 Goroutine 变化", status),
			})
		}
	}
}

func (a *Analyzer) compareTraffic(base, target []models.TrafficRecord, result *models.CompareResult) {
	baseTotalRequests := uint64(0)
	baseMaxQPS := float64(0)
	for _, t := range base {
		baseTotalRequests += t.Requests
		if t.QPS > baseMaxQPS {
			baseMaxQPS = t.QPS
		}
	}

	targetTotalRequests := uint64(0)
	targetMaxQPS := float64(0)
	for _, t := range target {
		targetTotalRequests += t.Requests
		if t.QPS > targetMaxQPS {
			targetMaxQPS = t.QPS
		}
	}

	requestsPct := 0.0
	if baseTotalRequests > 0 {
		requestsPct = (float64(targetTotalRequests) - float64(baseTotalRequests)) / float64(baseTotalRequests) * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "traffic",
		Metric:      "total_requests",
		BaseValue:   fmt.Sprintf("%d", baseTotalRequests),
		TargetValue: fmt.Sprintf("%d", targetTotalRequests),
		ChangePct:   requestsPct,
		Importance:  a.getImportance(requestsPct),
		Description: "总请求数变化",
	})

	qpsPct := 0.0
	if baseMaxQPS > 0 {
		qpsPct = (targetMaxQPS - baseMaxQPS) / baseMaxQPS * 100
	}

	result.Differences = append(result.Differences, models.Difference{
		Category:    "traffic",
		Metric:      "max_qps",
		BaseValue:   fmt.Sprintf("%.2f", baseMaxQPS),
		TargetValue: fmt.Sprintf("%.2f", targetMaxQPS),
		ChangePct:   qpsPct,
		Importance:  a.getImportance(qpsPct),
		Description: "峰值 QPS 变化",
	})
}

func (a *Analyzer) compareConfigs(base, target []models.ConfigRecord, result *models.CompareResult) {
	baseMap := make(map[string]string)
	for _, c := range base {
		baseMap[c.Key] = c.Value
	}

	targetMap := make(map[string]string)
	for _, c := range target {
		targetMap[c.Key] = c.Value
	}

	changedKeys := []string{}
	newKeys := []string{}
	removedKeys := []string{}

	for key, baseVal := range baseMap {
		if targetVal, ok := targetMap[key]; ok {
			if baseVal != targetVal {
				changedKeys = append(changedKeys, key)
			}
		} else {
			removedKeys = append(removedKeys, key)
		}
	}

	for key := range targetMap {
		if _, ok := baseMap[key]; !ok {
			newKeys = append(newKeys, key)
		}
	}

	for _, key := range changedKeys {
		result.Differences = append(result.Differences, models.Difference{
			Category:    "config",
			Metric:      key,
			BaseValue:   baseMap[key],
			TargetValue: targetMap[key],
			ChangePct:   0,
			Importance:  "medium",
			Description: "配置项变化",
		})
	}

	for _, key := range newKeys {
		result.Differences = append(result.Differences, models.Difference{
			Category:    "config",
			Metric:      key,
			BaseValue:   "(不存在)",
			TargetValue: targetMap[key],
			ChangePct:   100,
			Importance:  "low",
			Description: "新增配置项",
		})
	}

	for _, key := range removedKeys {
		result.Differences = append(result.Differences, models.Difference{
			Category:    "config",
			Metric:      key,
			BaseValue:   baseMap[key],
			TargetValue: "(已删除)",
			ChangePct:   -100,
			Importance:  "low",
			Description: "删除配置项",
		})
	}
}

func (a *Analyzer) compareAllocSites(base, target []models.AllocSite, result *models.CompareResult) {
	baseMap := make(map[string]models.AllocSite)
	for _, s := range base {
		key := fmt.Sprintf("%s:%d", s.File, s.Line)
		baseMap[key] = s
	}

	targetMap := make(map[string]models.AllocSite)
	for _, s := range target {
		key := fmt.Sprintf("%s:%d", s.File, s.Line)
		targetMap[key] = s
	}

	for key, targetSite := range targetMap {
		if baseSite, ok := baseMap[key]; ok {
			inusePct := 0.0
			if baseSite.InuseBytes > 0 {
				inusePct = (float64(targetSite.InuseBytes) - float64(baseSite.InuseBytes)) / float64(baseSite.InuseBytes) * 100
			}

			if math.Abs(inusePct) > 30 && targetSite.InuseBytes > 1024*1024 {
				result.Differences = append(result.Differences, models.Difference{
					Category:    "alloc_site",
					Metric:      fmt.Sprintf("%s:%d", targetSite.File, targetSite.Line),
					BaseValue:   fmt.Sprintf("%.2f MB", float64(baseSite.InuseBytes)/(1024*1024)),
					TargetValue: fmt.Sprintf("%.2f MB", float64(targetSite.InuseBytes)/(1024*1024)),
					ChangePct:   inusePct,
					Importance:  a.getImportance(inusePct),
					Description: fmt.Sprintf("分配点内存变化: %s", targetSite.Function),
				})
			}
		} else {
			if targetSite.InuseBytes > 1024*1024 {
				result.Differences = append(result.Differences, models.Difference{
					Category:    "alloc_site",
					Metric:      fmt.Sprintf("%s:%d", targetSite.File, targetSite.Line),
					BaseValue:   "(新分配点)",
					TargetValue: fmt.Sprintf("%.2f MB", float64(targetSite.InuseBytes)/(1024*1024)),
					ChangePct:   100,
					Importance:  "high",
					Description: fmt.Sprintf("新增分配点: %s", targetSite.Function),
				})
			}
		}
	}
}

func (a *Analyzer) getImportance(changePct float64) string {
	absChange := math.Abs(changePct)
	if absChange > 100 {
		return "high"
	} else if absChange > 50 {
		return "medium"
	}
	return "low"
}

func (a *Analyzer) calculateCompareConclusion(result *models.CompareResult) {
	highImportanceCount := 0
	mediumImportanceCount := 0
	totalChange := 0.0

	for _, diff := range result.Differences {
		if diff.Importance == "high" {
			highImportanceCount++
		} else if diff.Importance == "medium" {
			mediumImportanceCount++
		}
		totalChange += math.Abs(diff.ChangePct)
	}

	if len(result.Differences) > 0 {
		result.Confidence = minFloat64(1.0, totalChange/float64(len(result.Differences))/100)
	} else {
		result.Confidence = 0.0
	}

	if highImportanceCount > 0 {
		result.Conclusion = fmt.Sprintf("两个批次存在显著差异。发现 %d 个高重要性变化, %d 个中等重要性变化。建议重点关注高重要性的差异项。",
			highImportanceCount, mediumImportanceCount)
	} else if mediumImportanceCount > 0 {
		result.Conclusion = fmt.Sprintf("两个批次存在一些差异。发现 %d 个中等重要性变化, 建议关注。",
			mediumImportanceCount)
	} else if len(result.Differences) > 0 {
		result.Conclusion = "两个批次存在少量差异, 但均为低重要性。"
	} else {
		result.Conclusion = "两个批次没有发现显著差异。"
	}
}

func countGoroutineStatus(goroutines []models.GoroutineRecord) map[string]int {
	statusCount := make(map[string]int)
	for _, g := range goroutines {
		statusCount[g.Status]++
	}
	return statusCount
}
