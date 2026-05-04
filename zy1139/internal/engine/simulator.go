package engine

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"capgate/internal/models"
)

type Simulator struct {
	routes        []models.Route
	plan          *models.TrafficPlan
	deps          []models.DependencyLimit
	baseline      []models.BaselineRecord
	scenarioTypes []models.Scenario
	rand          *rand.Rand
}

func NewSimulator(
	routes []models.Route,
	plan *models.TrafficPlan,
	deps []models.DependencyLimit,
	baseline []models.BaselineRecord,
) *Simulator {
	return &Simulator{
		routes:        routes,
		plan:          plan,
		deps:          deps,
		baseline:      baseline,
		scenarioTypes: plan.Scenarios,
		rand:          rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *Simulator) Run() (*models.RunResult, error) {
	result := &models.RunResult{
		Timestamp:     time.Now().Unix(),
		PlanName:      s.plan.PlanName,
		OverallStatus: models.StatusPass,
	}

	routeMap := make(map[string]*models.Route)
	for i := range s.routes {
		routeMap[s.routes[i].Name] = &s.routes[i]
	}

	baselineMap := make(map[string]*models.BaselineRecord)
	for i := range s.baseline {
		baselineMap[s.baseline[i].RouteName] = &s.baseline[i]
	}

	activeScenarios := s.getActiveScenarios()
	for _, sc := range activeScenarios {
		result.AppliedScenarios = append(result.AppliedScenarios, sc.Name)
	}

	for _, planRoute := range s.plan.Routes {
		routeResult := s.simulateRoute(
			planRoute,
			routeMap[planRoute.Name],
			baselineMap[planRoute.Name],
			activeScenarios,
		)

		if routeResult.Status == models.StatusFail {
			result.OverallStatus = models.StatusFail
		} else if routeResult.Status == models.StatusWarning && result.OverallStatus == models.StatusPass {
			result.OverallStatus = models.StatusWarning
		}

		result.RouteResults = append(result.RouteResults, routeResult)
	}

	result.DependencyMetrics = s.calculateDependencyMetrics(result.RouteResults)

	for _, dm := range result.DependencyMetrics {
		if dm.Status == models.StatusFail {
			result.OverallStatus = models.StatusFail
		} else if dm.Status == models.StatusWarning && result.OverallStatus == models.StatusPass {
			result.OverallStatus = models.StatusWarning
		}
	}

	return result, nil
}

func (s *Simulator) getActiveScenarios() []models.Scenario {
	return s.scenarioTypes
}

func (s *Simulator) simulateRoute(
	planRoute models.TrafficRoute,
	route *models.Route,
	baseline *models.BaselineRecord,
	scenarios []models.Scenario,
) models.RouteResult {
	result := models.RouteResult{
		RouteName: planRoute.Name,
		Status:    models.StatusPass,
	}

	if baseline == nil {
		baseline = &models.BaselineRecord{
			P50LatencyMs:   50,
			P95LatencyMs:   150,
			P99LatencyMs:   250,
			AvgLatencyMs:   70,
			ThroughputRPS:  500,
			ErrorRate:      0.001,
			MaxConcurrent:  100,
			CPUPeakPercent: 30,
			MemoryPeakMB:   256,
		}
	}

	routeLatencyFactor := 1.0
	routeErrorFactor := 1.0
	routeThroughputFactor := 1.0
	routeCPUFactor := 1.0

	for _, sc := range scenarios {
		if len(sc.ApplyRoutes) > 0 {
			applies := false
			for _, r := range sc.ApplyRoutes {
				if r == planRoute.Name {
					applies = true
					break
				}
			}
			if !applies {
				continue
			}
		}

		switch sc.Type {
		case models.ScenarioCacheMiss:
			latencyMult := 3.0
			cpuMult := 1.5
			routeLatencyFactor *= latencyMult
			routeCPUFactor *= cpuMult

		case models.ScenarioDownstreamSlow:
			latencyMult := 2.5
			if mult, ok := sc.Params["latency_multiplier"].(float64); ok {
				latencyMult = mult
			}
			routeLatencyFactor *= latencyMult

			if timeoutChance, ok := sc.Params["timeout_chance"].(float64); ok {
				routeErrorFactor += timeoutChance * 10
			}

		case models.ScenarioCircuitOpen:
			errorRateAdd := 0.5
			if er, ok := sc.Params["error_rate"].(float64); ok {
				errorRateAdd = er
			}
			routeErrorFactor = 1000
			_ = errorRateAdd

		case models.ScenarioHighLatency:
			routeLatencyFactor *= 2.0

		case models.ScenarioResourceStress:
			routeCPUFactor *= 2.0
			routeThroughputFactor *= 0.8

		case models.ScenarioRateLimit:
			routeThroughputFactor *= 0.5
			routeErrorFactor += 0.1
		}
	}

	totalDuration := 0
	totalRequests := 0
	maxConcurrent := 0
	peakRPS := 0.0

	for _, step := range planRoute.Steps {
		totalDuration += step.DurationSec
		stepRequests := step.TargetRPS * step.DurationSec
		totalRequests += stepRequests
		if step.ConcurrentUsers > maxConcurrent {
			maxConcurrent = step.ConcurrentUsers
		}
		if float64(step.TargetRPS) > peakRPS {
			peakRPS = float64(step.TargetRPS)
		}
	}

	actualAvgLatencyMs := baseline.AvgLatencyMs * routeLatencyFactor
	actualP50Ms := baseline.P50LatencyMs * routeLatencyFactor
	actualP95Ms := baseline.P95LatencyMs * routeLatencyFactor * (1 + s.rand.Float64()*0.2)
	actualP99Ms := baseline.P99LatencyMs * routeLatencyFactor * (1 + s.rand.Float64()*0.3)

	minLatency := actualP50Ms * 0.6
	maxLatency := actualP99Ms * 1.2

	rpsFactor := routeThroughputFactor
	if float64(maxConcurrent) > float64(baseline.MaxConcurrent)*1.2 {
		overloadFactor := float64(maxConcurrent) / float64(baseline.MaxConcurrent)
		rpsFactor *= (1.0 - (overloadFactor-1.0)*0.3)
		actualP95Ms *= overloadFactor
		actualP99Ms *= overloadFactor * 1.2
	}

	actualRPS := peakRPS * rpsFactor * (0.95 + s.rand.Float64()*0.1)

	baseErrorRate := baseline.ErrorRate
	actualErrorRate := baseErrorRate * routeErrorFactor
	if actualErrorRate > 0.01 {
		actualErrorRate += s.rand.Float64() * 0.02
	}
	if actualErrorRate > 1.0 {
		actualErrorRate = 0.9 + s.rand.Float64()*0.1
	}

	baseCPU := baseline.CPUPeakPercent
	actualCPU := baseCPU * routeCPUFactor
	if float64(maxConcurrent) > float64(baseline.MaxConcurrent) {
		overloadCPU := float64(maxConcurrent) / float64(baseline.MaxConcurrent)
		actualCPU *= overloadCPU * 0.8
	}
	if actualCPU > 100 {
		actualCPU = 95 + s.rand.Float64()*5
	}

	baseMemory := baseline.MemoryPeakMB
	actualMemory := float64(baseMemory) * (0.9 + s.rand.Float64()*0.3)

	result.LatencyMetrics = models.LatencyMetrics{
		P50Ms: roundTo2(actualP50Ms),
		P95Ms: roundTo2(actualP95Ms),
		P99Ms: roundTo2(actualP99Ms),
		AvgMs: roundTo2(actualAvgLatencyMs),
		MinMs: roundTo2(minLatency),
		MaxMs: roundTo2(maxLatency),
	}

	result.Throughput = models.ThroughputMetrics{
		ActualRPS:     roundTo2(actualRPS),
		TargetRPS:     float64(peakRPS),
		TotalRequests: int64(totalRequests),
		ConcurrentAvg: float64(maxConcurrent) * 0.8,
		ConcurrentMax: maxConcurrent,
	}

	result.ErrorMetrics = models.ErrorMetrics{
		ErrorRate:   roundTo4(actualErrorRate),
		TotalErrors: int64(float64(totalRequests) * actualErrorRate),
	}

	result.ResourceMetrics = models.ResourceMetrics{
		CPUPeakPercent: roundTo2(actualCPU),
		CPUAvgPercent:  roundTo2(actualCPU * 0.8),
		MemoryPeakMB:   int(actualMemory),
		MemoryAvgMB:    int(actualMemory * 0.85),
	}

	if route != nil {
		result.BudgetChecks = s.checkBudget(*route, result)

		depCalls := make(map[string]*models.DependencyCall)
		for _, depRef := range route.Dependencies {
			depCalls[depRef.Name] = &models.DependencyCall{
				Name:        depRef.Name,
				TotalCalls:  int64(float64(result.Throughput.TotalRequests) * depRef.Factor),
				CallsPerSec: result.Throughput.ActualRPS * depRef.Factor,
				Factor:      depRef.Factor,
			}
		}

		for _, dc := range depCalls {
			result.DependencyCalls = append(result.DependencyCalls, *dc)
		}
	}

	hasFail := false
	hasWarn := false
	for _, check := range result.BudgetChecks {
		if check.Status == models.CheckFail {
			hasFail = true
		} else if check.Status == models.CheckWarn {
			hasWarn = true
		}
	}

	if hasFail {
		result.Status = models.StatusFail
	} else if hasWarn {
		result.Status = models.StatusWarning
	}

	result.Recommendations = s.generateRecommendations(result)

	return result
}

func (s *Simulator) checkBudget(route models.Route, result models.RouteResult) []models.BudgetCheck {
	var checks []models.BudgetCheck

	budget := route.Budget

	p95Check := models.BudgetCheck{
		Name:      "P95 延迟",
		Threshold: budget.P95LatencyMs,
		Actual:    result.LatencyMetrics.P95Ms,
	}
	if result.LatencyMetrics.P95Ms <= budget.P95LatencyMs {
		p95Check.Status = models.CheckPass
		p95Check.RiskLevel = models.RiskLow
		p95Check.Explanation = fmt.Sprintf("P95 延迟 %.2fms 在预算 %.2fms 内",
			result.LatencyMetrics.P95Ms, budget.P95LatencyMs)
	} else if result.LatencyMetrics.P95Ms <= budget.P95LatencyMs*1.2 {
		p95Check.Status = models.CheckWarn
		p95Check.RiskLevel = models.RiskMedium
		p95Check.Explanation = fmt.Sprintf("P95 延迟 %.2fms 接近预算 %.2fms (超出 %.1f%%)",
			result.LatencyMetrics.P95Ms, budget.P95LatencyMs,
			(result.LatencyMetrics.P95Ms/budget.P95LatencyMs-1)*100)
	} else {
		p95Check.Status = models.CheckFail
		p95Check.RiskLevel = models.RiskHigh
		p95Check.Explanation = fmt.Sprintf("P95 延迟 %.2fms 超过预算 %.2fms (超出 %.1f%%)",
			result.LatencyMetrics.P95Ms, budget.P95LatencyMs,
			(result.LatencyMetrics.P95Ms/budget.P95LatencyMs-1)*100)
	}
	checks = append(checks, p95Check)

	p99Check := models.BudgetCheck{
		Name:      "P99 延迟",
		Threshold: budget.P99LatencyMs,
		Actual:    result.LatencyMetrics.P99Ms,
	}
	if result.LatencyMetrics.P99Ms <= budget.P99LatencyMs {
		p99Check.Status = models.CheckPass
		p99Check.RiskLevel = models.RiskLow
		p99Check.Explanation = fmt.Sprintf("P99 延迟 %.2fms 在预算 %.2fms 内",
			result.LatencyMetrics.P99Ms, budget.P99LatencyMs)
	} else {
		p99Check.Status = models.CheckFail
		p99Check.RiskLevel = models.RiskHigh
		p99Check.Explanation = fmt.Sprintf("P99 延迟 %.2fms 超过预算 %.2fms",
			result.LatencyMetrics.P99Ms, budget.P99LatencyMs)
	}
	checks = append(checks, p99Check)

	errorCheck := models.BudgetCheck{
		Name:      "错误率",
		Threshold: budget.MaxErrorRate,
		Actual:    result.ErrorMetrics.ErrorRate,
	}
	if result.ErrorMetrics.ErrorRate <= budget.MaxErrorRate {
		errorCheck.Status = models.CheckPass
		errorCheck.RiskLevel = models.RiskLow
		errorCheck.Explanation = fmt.Sprintf("错误率 %.4f%% 在预算 %.4f%% 内",
			result.ErrorMetrics.ErrorRate*100, budget.MaxErrorRate*100)
	} else if result.ErrorMetrics.ErrorRate <= budget.MaxErrorRate*2 {
		errorCheck.Status = models.CheckWarn
		errorCheck.RiskLevel = models.RiskMedium
		errorCheck.Explanation = fmt.Sprintf("错误率 %.4f%% 接近预算 %.4f%%",
			result.ErrorMetrics.ErrorRate*100, budget.MaxErrorRate*100)
	} else {
		errorCheck.Status = models.CheckFail
		errorCheck.RiskLevel = models.RiskCritical
		errorCheck.Explanation = fmt.Sprintf("错误率 %.4f%% 超过预算 %.4f%%",
			result.ErrorMetrics.ErrorRate*100, budget.MaxErrorRate*100)
	}
	checks = append(checks, errorCheck)

	rpsCheck := models.BudgetCheck{
		Name:      "RPS",
		Threshold: float64(budget.MaxRPS),
		Actual:    result.Throughput.ActualRPS,
	}
	if result.Throughput.ActualRPS <= float64(budget.MaxRPS) {
		rpsCheck.Status = models.CheckPass
		rpsCheck.RiskLevel = models.RiskLow
		rpsCheck.Explanation = fmt.Sprintf("实际 RPS %.0f 在预算 %d 内",
			result.Throughput.ActualRPS, budget.MaxRPS)
	} else if result.Throughput.ActualRPS <= float64(budget.MaxRPS)*1.1 {
		rpsCheck.Status = models.CheckWarn
		rpsCheck.RiskLevel = models.RiskMedium
		rpsCheck.Explanation = fmt.Sprintf("实际 RPS %.0f 接近预算 %d",
			result.Throughput.ActualRPS, budget.MaxRPS)
	} else {
		rpsCheck.Status = models.CheckFail
		rpsCheck.RiskLevel = models.RiskHigh
		rpsCheck.Explanation = fmt.Sprintf("实际 RPS %.0f 超过预算 %d",
			result.Throughput.ActualRPS, budget.MaxRPS)
	}
	checks = append(checks, rpsCheck)

	concurrentCheck := models.BudgetCheck{
		Name:      "并发数",
		Threshold: float64(budget.MaxConcurrent),
		Actual:    float64(result.Throughput.ConcurrentMax),
	}
	if result.Throughput.ConcurrentMax <= budget.MaxConcurrent {
		concurrentCheck.Status = models.CheckPass
		concurrentCheck.RiskLevel = models.RiskLow
		concurrentCheck.Explanation = fmt.Sprintf("并发 %d 在预算 %d 内",
			result.Throughput.ConcurrentMax, budget.MaxConcurrent)
	} else {
		concurrentCheck.Status = models.CheckFail
		concurrentCheck.RiskLevel = models.RiskHigh
		concurrentCheck.Explanation = fmt.Sprintf("并发 %d 超过预算 %d",
			result.Throughput.ConcurrentMax, budget.MaxConcurrent)
	}
	checks = append(checks, concurrentCheck)

	cpuCheck := models.BudgetCheck{
		Name:      "CPU",
		Threshold: budget.CPUBudgetPercent,
		Actual:    result.ResourceMetrics.CPUPeakPercent,
	}
	if result.ResourceMetrics.CPUPeakPercent <= budget.CPUBudgetPercent {
		cpuCheck.Status = models.CheckPass
		cpuCheck.RiskLevel = models.RiskLow
		cpuCheck.Explanation = fmt.Sprintf("CPU 峰值 %.1f%% 在预算 %.1f%% 内",
			result.ResourceMetrics.CPUPeakPercent, budget.CPUBudgetPercent)
	} else if result.ResourceMetrics.CPUPeakPercent <= 80 {
		cpuCheck.Status = models.CheckWarn
		cpuCheck.RiskLevel = models.RiskMedium
		cpuCheck.Explanation = fmt.Sprintf("CPU 峰值 %.1f%% 接近预算 %.1f%%",
			result.ResourceMetrics.CPUPeakPercent, budget.CPUBudgetPercent)
	} else {
		cpuCheck.Status = models.CheckFail
		cpuCheck.RiskLevel = models.RiskHigh
		cpuCheck.Explanation = fmt.Sprintf("CPU 峰值 %.1f%% 超过预算 %.1f%%，已达警戒线",
			result.ResourceMetrics.CPUPeakPercent, budget.CPUBudgetPercent)
	}
	checks = append(checks, cpuCheck)

	return checks
}

func (s *Simulator) calculateDependencyMetrics(routeResults []models.RouteResult) []models.DependencyMetric {
	depCallsMap := make(map[string]*models.DependencyMetric)
	depLimitsMap := make(map[string]*models.DependencyLimit)

	for i := range s.deps {
		dep := &s.deps[i]
		depLimitsMap[dep.Name] = dep
		depCallsMap[dep.Name] = &models.DependencyMetric{
			Name:          dep.Name,
			MaxQPS:        dep.MaxQPS,
			MaxConcurrent: dep.MaxConcurrent,
			Status:        models.StatusPass,
		}
	}

	for _, rr := range routeResults {
		for _, dc := range rr.DependencyCalls {
			if metric, ok := depCallsMap[dc.Name]; ok {
				metric.TotalCalls += dc.TotalCalls
				metric.CallsPerSec += dc.CallsPerSec
			}
		}
	}

	var metrics []models.DependencyMetric
	for _, dm := range depCallsMap {
		if limit, ok := depLimitsMap[dm.Name]; ok {
			if dm.CallsPerSec > float64(limit.MaxQPS) {
				dm.Status = models.StatusFail
				dm.Warnings = append(dm.Warnings,
					fmt.Sprintf("QPS %.0f 超过限额 %d", dm.CallsPerSec, limit.MaxQPS))
			}
		}
		metrics = append(metrics, *dm)
	}

	return metrics
}

func (s *Simulator) generateRecommendations(result models.RouteResult) []models.Recommendation {
	var recs []models.Recommendation

	for _, check := range result.BudgetChecks {
		if check.Status == models.CheckFail {
			switch check.Name {
			case "P95 延迟", "P99 延迟":
				recs = append(recs, models.Recommendation{
					Action:      "启用降级",
					RiskLevel:   models.RiskMedium,
					Description: "延迟超出预算，建议启用缓存降级或返回简化数据",
					Priority:    1,
				})
			case "错误率":
				recs = append(recs, models.Recommendation{
					Action:      "触发熔断",
					RiskLevel:   models.RiskHigh,
					Description: "错误率过高，建议立即触发熔断保护",
					Priority:    1,
				})
			case "RPS", "并发数":
				recs = append(recs, models.Recommendation{
					Action:      "限流",
					RiskLevel:   models.RiskMedium,
					Description: "流量超过预算，建议启动限流策略",
					Priority:    2,
				})
			case "CPU":
				recs = append(recs, models.Recommendation{
					Action:      "扩容",
					RiskLevel:   models.RiskHigh,
					Description: "CPU 使用率过高，建议扩容或优化计算逻辑",
					Priority:    1,
				})
			}
		} else if check.Status == models.CheckWarn {
			switch check.Name {
			case "P95 延迟":
				recs = append(recs, models.Recommendation{
					Action:      "监控预警",
					RiskLevel:   models.RiskLow,
					Description: "延迟接近阈值，建议开启预警监控",
					Priority:    3,
				})
			case "RPS":
				recs = append(recs, models.Recommendation{
					Action:      "准备限流",
					RiskLevel:   models.RiskLow,
					Description: "流量接近阈值，准备限流策略",
					Priority:    3,
				})
			}
		}
	}

	return recs
}

func roundTo2(val float64) float64 {
	return math.Round(val*100) / 100
}

func roundTo4(val float64) float64 {
	return math.Round(val*10000) / 10000
}
