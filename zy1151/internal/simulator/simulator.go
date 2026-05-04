package simulator

import (
	"fmt"
	"math"
	"memreplay/internal/models"
	"time"
)

type SimulationConfig struct {
	CacheTTL           time.Duration
	MaxCacheSize       int
	WorkerCount        int
	SamplingWindow     time.Duration
	GCPercent          int
	RequestRate        float64
	AvgRequestSize     int
	AvgResponseSize    int
	Duration           time.Duration
}

type Simulator struct {
	config SimulationConfig
}

func NewSimulator(config SimulationConfig) *Simulator {
	if config.CacheTTL <= 0 {
		config.CacheTTL = 1 * time.Hour
	}
	if config.MaxCacheSize <= 0 {
		config.MaxCacheSize = 100000
	}
	if config.WorkerCount <= 0 {
		config.WorkerCount = 100
	}
	if config.SamplingWindow <= 0 {
		config.SamplingWindow = 1 * time.Minute
	}
	if config.GCPercent <= 0 {
		config.GCPercent = 100
	}
	if config.RequestRate <= 0 {
		config.RequestRate = 100
	}
	if config.AvgRequestSize <= 0 {
		config.AvgRequestSize = 1024
	}
	if config.AvgResponseSize <= 0 {
		config.AvgResponseSize = 2048
	}
	if config.Duration <= 0 {
		config.Duration = 24 * time.Hour
	}

	return &Simulator{config: config}
}

func (s *Simulator) Run() (*models.SimulationParams, *models.SimulationResult, error) {
	params := &models.SimulationParams{
		Name: fmt.Sprintf("simulation_%s", time.Now().Format("20060102_150405")),
		Params: map[string]interface{}{
			"cache_ttl_seconds":    s.config.CacheTTL.Seconds(),
			"max_cache_size":       s.config.MaxCacheSize,
			"worker_count":         s.config.WorkerCount,
			"sampling_window_sec":  s.config.SamplingWindow.Seconds(),
			"gc_percent":           s.config.GCPercent,
			"request_rate":         s.config.RequestRate,
			"avg_request_size":     s.config.AvgRequestSize,
			"avg_response_size":    s.config.AvgResponseSize,
			"duration_hours":       s.config.Duration.Hours(),
		},
	}

	result := &models.SimulationResult{
		Metrics:  make(map[string]interface{}),
		Warnings: []string{},
	}

	totalRequests := s.config.RequestRate * s.config.Duration.Seconds()
	result.Metrics["total_requests"] = totalRequests

	peakCacheSize := s.estimatePeakCacheSize()
	result.Metrics["peak_cache_size"] = peakCacheSize
	result.Metrics["peak_cache_size_mb"] = float64(peakCacheSize) / (1024 * 1024)

	peakMemory := s.estimatePeakMemory()
	result.Metrics["peak_memory_mb"] = peakMemory / (1024 * 1024)

	gcPressure := s.estimateGCPressure()
	result.Metrics["gc_pressure"] = gcPressure

	goroutineRisk := s.estimateGoroutineRisk()
	result.Metrics["goroutine_risk_score"] = goroutineRisk

	cacheRisk := s.estimateCacheRisk(peakCacheSize)
	result.Metrics["cache_risk_score"] = cacheRisk

	memoryLeakRisk := s.estimateMemoryLeakRisk()
	result.Metrics["memory_leak_risk_score"] = memoryLeakRisk

	result.RiskLevel = s.calculateOverallRisk(peakMemory, goroutineRisk, cacheRisk, gcPressure)
	result.Conclusion = s.generateConclusion(peakMemory, goroutineRisk, cacheRisk, gcPressure)
	result.Warnings = s.generateWarnings(peakCacheSize, goroutineRisk, cacheRisk, gcPressure)

	return params, result, nil
}

func (s *Simulator) estimatePeakCacheSize() int {
	cacheHitRate := 0.8
	uniqueKeysPerSecond := s.config.RequestRate * (1 - cacheHitRate)
	keysInCache := int(uniqueKeysPerSecond * s.config.CacheTTL.Seconds())

	if keysInCache > s.config.MaxCacheSize {
		return s.config.MaxCacheSize
	}
	return keysInCache
}

func (s *Simulator) estimatePeakMemory() float64 {
	baseMemory := 50 * 1024 * 1024.0

	cacheMemory := float64(s.estimatePeakCacheSize()) * float64(s.config.AvgResponseSize)

	workerStackMemory := float64(s.config.WorkerCount) * 8 * 1024 * 1024.0

	requestBufferMemory := s.config.RequestRate * float64(s.config.AvgRequestSize) * 10

	gcOverhead := baseMemory * (float64(s.config.GCPercent) / 100.0)

	return baseMemory + cacheMemory + workerStackMemory + requestBufferMemory + gcOverhead
}

func (s *Simulator) estimateGCPressure() float64 {
	allocRate := s.config.RequestRate * float64(s.config.AvgRequestSize+s.config.AvgResponseSize)

	gcThreshold := 4 * 1024 * 1024.0 * (float64(s.config.GCPercent) / 100.0)

	if gcThreshold <= 0 {
		return 1.0
	}

	pressure := allocRate / gcThreshold
	return math.Min(1.0, pressure)
}

func (s *Simulator) estimateGoroutineRisk() float64 {
	riskScore := 0.0

	if s.config.WorkerCount > 1000 {
		riskScore += 0.3
	}
	if s.config.WorkerCount > 5000 {
		riskScore += 0.3
	}
	if s.config.WorkerCount > 10000 {
		riskScore += 0.4
	}

	workerPerRequest := float64(s.config.WorkerCount) / s.config.RequestRate
	if workerPerRequest > 10 {
		riskScore += 0.2
	}

	return math.Min(1.0, riskScore)
}

func (s *Simulator) estimateCacheRisk(peakCacheSize int) float64 {
	riskScore := 0.0

	if s.config.CacheTTL > 24*time.Hour {
		riskScore += 0.3
	}
	if s.config.CacheTTL > 72*time.Hour {
		riskScore += 0.2
	}

	if s.config.MaxCacheSize == 0 {
		riskScore += 0.5
	}

	cacheUtilization := float64(peakCacheSize) / float64(s.config.MaxCacheSize)
	if cacheUtilization > 0.9 {
		riskScore += 0.3
	}

	return math.Min(1.0, riskScore)
}

func (s *Simulator) estimateMemoryLeakRisk() float64 {
	riskScore := 0.0

	if s.config.CacheTTL > 24*time.Hour && s.config.MaxCacheSize == 0 {
		riskScore += 0.6
	}

	if s.config.WorkerCount > 10000 {
		riskScore += 0.2
	}

	if s.config.GCPercent > 200 {
		riskScore += 0.2
	}

	return math.Min(1.0, riskScore)
}

func (s *Simulator) calculateOverallRisk(peakMemory float64, goroutineRisk, cacheRisk, gcPressure float64) string {
	combinedRisk := (goroutineRisk*0.3 + cacheRisk*0.4 + gcPressure*0.3)

	if combinedRisk > 0.7 || peakMemory > 4*1024*1024*1024 {
		return "high"
	} else if combinedRisk > 0.4 || peakMemory > 1*1024*1024*1024 {
		return "medium"
	} else if combinedRisk > 0.2 {
		return "low"
	}
	return "none"
}

func (s *Simulator) generateConclusion(peakMemory float64, goroutineRisk, cacheRisk, gcPressure float64) string {
	combinedRisk := (goroutineRisk*0.3 + cacheRisk*0.4 + gcPressure*0.3)

	if combinedRisk > 0.7 {
		return fmt.Sprintf("高风险配置。预计峰值内存 %.2f GB, 存在较高的内存泄漏风险。建议立即审查配置参数。",
			peakMemory/(1024*1024*1024))
	} else if combinedRisk > 0.4 {
		return fmt.Sprintf("中等风险配置。预计峰值内存 %.2f GB, 部分参数需要关注。建议监控内存使用情况。",
			peakMemory/(1024*1024*1024))
	} else if combinedRisk > 0.2 {
		return fmt.Sprintf("低风险配置。预计峰值内存 %.2f GB, 配置整体合理, 建议持续监控。",
			peakMemory/(1024*1024*1024))
	}
	return fmt.Sprintf("配置风险较低。预计峰值内存 %.2f GB, 参数设置合理。",
		peakMemory/(1024*1024*1024))
}

func (s *Simulator) generateWarnings(peakCacheSize int, goroutineRisk, cacheRisk, gcPressure float64) []string {
	warnings := []string{}

	if s.config.CacheTTL > 24*time.Hour {
		warnings = append(warnings,
			fmt.Sprintf("缓存 TTL 较长 (%v), 可能导致缓存堆积", s.config.CacheTTL))
	}

	if s.config.MaxCacheSize == 0 {
		warnings = append(warnings,
			"未设置最大缓存大小, 存在内存无限增长风险")
	}

	if float64(peakCacheSize)/float64(s.config.MaxCacheSize) > 0.8 {
		warnings = append(warnings,
			fmt.Sprintf("缓存使用率较高 (%.1f%%), 可能接近容量上限",
				float64(peakCacheSize)/float64(s.config.MaxCacheSize)*100))
	}

	if s.config.WorkerCount > 10000 {
		warnings = append(warnings,
			fmt.Sprintf("Worker 数量较大 (%d), 存在 goroutine 泄漏风险", s.config.WorkerCount))
	}

	if s.config.GCPercent > 200 {
		warnings = append(warnings,
			fmt.Sprintf("GC 百分比较高 (%d%%), 可能导致 GC 不及时", s.config.GCPercent))
	}

	if gcPressure > 0.7 {
		warnings = append(warnings,
			"GC 压力较高, 可能导致频繁 GC")
	}

	return warnings
}

func (s *Simulator) CompareConfigs(baseConfig, targetConfig SimulationConfig) (string, map[string]float64, []string) {
	baseSim := NewSimulator(baseConfig)
	targetSim := NewSimulator(targetConfig)

	baseParams, baseResult, _ := baseSim.Run()
	targetParams, targetResult, _ := targetSim.Run()

	diffs := make(map[string]float64)

	basePeakMB := baseResult.Metrics["peak_memory_mb"].(float64)
	targetPeakMB := targetResult.Metrics["peak_memory_mb"].(float64)
	if basePeakMB > 0 {
		diffs["peak_memory_change_pct"] = (targetPeakMB - basePeakMB) / basePeakMB * 100
	}

	baseCacheSize := baseResult.Metrics["peak_cache_size"].(int)
	targetCacheSize := targetResult.Metrics["peak_cache_size"].(int)
	if baseCacheSize > 0 {
		diffs["cache_size_change_pct"] = float64(targetCacheSize-baseCacheSize) / float64(baseCacheSize) * 100
	}

	baseGoroutineRisk := baseResult.Metrics["goroutine_risk_score"].(float64)
	targetGoroutineRisk := targetResult.Metrics["goroutine_risk_score"].(float64)
	diffs["goroutine_risk_change"] = targetGoroutineRisk - baseGoroutineRisk

	baseCacheRisk := baseResult.Metrics["cache_risk_score"].(float64)
	targetCacheRisk := targetResult.Metrics["cache_risk_score"].(float64)
	diffs["cache_risk_change"] = targetCacheRisk - baseCacheRisk

	conclusion := ""
	if targetResult.RiskLevel == "high" && baseResult.RiskLevel != "high" {
		conclusion = "警告: 目标配置风险显著升高, 建议仔细审查参数变化"
	} else if targetResult.RiskLevel == "medium" && baseResult.RiskLevel == "low" {
		conclusion = "注意: 目标配置风险有所升高, 建议关注相关参数"
	} else if targetResult.RiskLevel == "low" && baseResult.RiskLevel == "high" {
		conclusion = "好消息: 目标配置风险显著降低"
	} else {
		conclusion = "两个配置风险等级相似"
	}

	warnings := []string{}
	if diffs["peak_memory_change_pct"] > 50 {
		warnings = append(warnings,
			fmt.Sprintf("预计内存增长 %.1f%%, 建议确认是否可接受", diffs["peak_memory_change_pct"]))
	}
	if diffs["goroutine_risk_change"] > 0.2 {
		warnings = append(warnings,
			"Goroutine 风险增加, 建议检查 worker 数量配置")
	}
	if diffs["cache_risk_change"] > 0.2 {
		warnings = append(warnings,
			"缓存风险增加, 建议检查 TTL 和缓存大小配置")
	}

	_ = baseParams
	_ = targetParams

	return conclusion, diffs, warnings
}
