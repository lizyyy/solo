package engine

import (
	"fmt"
	"math"
	"time"

	"capgate/internal/models"
)

type Comparator struct {
	baseline  []models.BaselineRecord
	current   *models.RunResult
	threshold *ComparisonThreshold
}

type ComparisonThreshold struct {
	LatencyDegradePct   float64
	RPSDegradePct       float64
	ErrorRateIncrease   float64
	CPUDegradePct       float64
	MinorSeverityPct    float64
	ModerateSeverityPct float64
	MajorSeverityPct    float64
}

func DefaultThreshold() *ComparisonThreshold {
	return &ComparisonThreshold{
		LatencyDegradePct:   20.0,
		RPSDegradePct:       15.0,
		ErrorRateIncrease:   0.01,
		CPUDegradePct:       10.0,
		MinorSeverityPct:    20.0,
		ModerateSeverityPct: 50.0,
		MajorSeverityPct:    100.0,
	}
}

func NewComparator(baseline []models.BaselineRecord, current *models.RunResult) *Comparator {
	return &Comparator{
		baseline:  baseline,
		current:   current,
		threshold: DefaultThreshold(),
	}
}

func (c *Comparator) Compare() *models.ComparisonResult {
	result := &models.ComparisonResult{
		Timestamp:     time.Now().Unix(),
		OverallStatus: models.ComparisonPass,
	}

	baselineMap := make(map[string]*models.BaselineRecord)
	for i := range c.baseline {
		baselineMap[c.baseline[i].RouteName] = &c.baseline[i]
	}

	for _, currentRoute := range c.current.RouteResults {
		routeComp := c.compareRoute(currentRoute, baselineMap[currentRoute.RouteName])
		result.RouteComparisons = append(result.RouteComparisons, routeComp)

		if routeComp.Status == models.ComparisonDegraded {
			result.OverallStatus = models.ComparisonDegraded
			result.DegradedRoutes = append(result.DegradedRoutes, routeComp.RouteName)
		} else if routeComp.Status == models.ComparisonWarning && result.OverallStatus == models.ComparisonPass {
			result.OverallStatus = models.ComparisonWarning
		}

		isImproved := c.checkImprovement(routeComp)
		if isImproved {
			result.ImprovedRoutes = append(result.ImprovedRoutes, routeComp.RouteName)
		}
	}

	result.Bottlenecks = c.identifyBottlenecks(result.RouteComparisons)
	result.Recommendations = c.generateRecommendations(result)

	return result
}

func (c *Comparator) compareRoute(current models.RouteResult, baseline *models.BaselineRecord) models.RouteComparison {
	comp := models.RouteComparison{
		RouteName: current.RouteName,
		Status:    models.ComparisonPass,
	}

	if baseline == nil {
		comp.Status = models.ComparisonWarning
		return comp
	}

	comp.LatencyDelta = c.calculateLatencyDelta(current, baseline)
	comp.ThroughputDelta = c.calculateThroughputDelta(current, baseline)
	comp.ErrorDelta = c.calculateErrorDelta(current, baseline)
	comp.ResourceDelta = c.calculateResourceDelta(current, baseline)

	comp.DegradationChecks = c.generateDegradationChecks(comp, current, baseline)

	for _, check := range comp.DegradationChecks {
		if check.IsDegraded {
			if check.Severity == models.SeverityCritical || check.Severity == models.SeverityMajor {
				comp.Status = models.ComparisonDegraded
			} else if comp.Status == models.ComparisonPass {
				comp.Status = models.ComparisonWarning
			}
		}
	}

	return comp
}

func (c *Comparator) calculateLatencyDelta(current models.RouteResult, baseline *models.BaselineRecord) models.LatencyDelta {
	return models.LatencyDelta{
		P50DeltaMs:  current.LatencyMetrics.P50Ms - baseline.P50LatencyMs,
		P50DeltaPct: calculateDeltaPct(current.LatencyMetrics.P50Ms, baseline.P50LatencyMs),
		P95DeltaMs:  current.LatencyMetrics.P95Ms - baseline.P95LatencyMs,
		P95DeltaPct: calculateDeltaPct(current.LatencyMetrics.P95Ms, baseline.P95LatencyMs),
		P99DeltaMs:  current.LatencyMetrics.P99Ms - baseline.P99LatencyMs,
		P99DeltaPct: calculateDeltaPct(current.LatencyMetrics.P99Ms, baseline.P99LatencyMs),
	}
}

func (c *Comparator) calculateThroughputDelta(current models.RouteResult, baseline *models.BaselineRecord) models.ThroughputDelta {
	return models.ThroughputDelta{
		RPSDelta:        current.Throughput.ActualRPS - baseline.ThroughputRPS,
		RPSDeltaPct:     calculateDeltaPct(current.Throughput.ActualRPS, baseline.ThroughputRPS),
		ConcurrentDelta: float64(current.Throughput.ConcurrentMax - baseline.MaxConcurrent),
	}
}

func (c *Comparator) calculateErrorDelta(current models.RouteResult, baseline *models.BaselineRecord) models.ErrorDelta {
	return models.ErrorDelta{
		ErrorRateDelta:    current.ErrorMetrics.ErrorRate - baseline.ErrorRate,
		ErrorRateDeltaPct: calculateDeltaPct(current.ErrorMetrics.ErrorRate, baseline.ErrorRate),
		ErrorCountDelta:   current.ErrorMetrics.TotalErrors,
	}
}

func (c *Comparator) calculateResourceDelta(current models.RouteResult, baseline *models.BaselineRecord) models.ResourceDelta {
	return models.ResourceDelta{
		CPUDeltaPct:   current.ResourceMetrics.CPUPeakPercent - baseline.CPUPeakPercent,
		MemoryDeltaMB: current.ResourceMetrics.MemoryPeakMB - baseline.MemoryPeakMB,
	}
}

func (c *Comparator) generateDegradationChecks(
	comp models.RouteComparison,
	current models.RouteResult,
	baseline *models.BaselineRecord,
) []models.DegradationCheck {
	var checks []models.DegradationCheck

	if comp.LatencyDelta.P95DeltaPct > c.threshold.LatencyDegradePct {
		checks = append(checks, models.DegradationCheck{
			Name:       "P95 延迟",
			Baseline:   baseline.P95LatencyMs,
			Current:    current.LatencyMetrics.P95Ms,
			Threshold:  c.threshold.LatencyDegradePct,
			IsDegraded: true,
			Severity:   c.getSeverity(comp.LatencyDelta.P95DeltaPct),
		})
	} else {
		checks = append(checks, models.DegradationCheck{
			Name:       "P95 延迟",
			Baseline:   baseline.P95LatencyMs,
			Current:    current.LatencyMetrics.P95Ms,
			Threshold:  c.threshold.LatencyDegradePct,
			IsDegraded: false,
			Severity:   models.SeverityMinor,
		})
	}

	if comp.LatencyDelta.P99DeltaPct > c.threshold.LatencyDegradePct*1.5 {
		checks = append(checks, models.DegradationCheck{
			Name:       "P99 延迟",
			Baseline:   baseline.P99LatencyMs,
			Current:    current.LatencyMetrics.P99Ms,
			Threshold:  c.threshold.LatencyDegradePct * 1.5,
			IsDegraded: true,
			Severity:   c.getSeverity(comp.LatencyDelta.P99DeltaPct),
		})
	}

	if comp.ErrorDelta.ErrorRateDelta > c.threshold.ErrorRateIncrease {
		checks = append(checks, models.DegradationCheck{
			Name:       "错误率",
			Baseline:   baseline.ErrorRate,
			Current:    current.ErrorMetrics.ErrorRate,
			Threshold:  c.threshold.ErrorRateIncrease,
			IsDegraded: true,
			Severity:   c.getErrorSeverity(comp.ErrorDelta.ErrorRateDelta),
		})
	}

	if comp.ResourceDelta.CPUDeltaPct > c.threshold.CPUDegradePct {
		checks = append(checks, models.DegradationCheck{
			Name:       "CPU",
			Baseline:   baseline.CPUPeakPercent,
			Current:    current.ResourceMetrics.CPUPeakPercent,
			Threshold:  c.threshold.CPUDegradePct,
			IsDegraded: true,
			Severity:   c.getSeverity(comp.ResourceDelta.CPUDeltaPct),
		})
	}

	return checks
}

func (c *Comparator) getSeverity(deltaPct float64) models.DegradationSeverity {
	if deltaPct > c.threshold.MajorSeverityPct {
		return models.SeverityCritical
	} else if deltaPct > c.threshold.ModerateSeverityPct {
		return models.SeverityMajor
	} else if deltaPct > c.threshold.MinorSeverityPct {
		return models.SeverityModerate
	}
	return models.SeverityMinor
}

func (c *Comparator) getErrorSeverity(delta float64) models.DegradationSeverity {
	if delta > 0.1 {
		return models.SeverityCritical
	} else if delta > 0.05 {
		return models.SeverityMajor
	} else if delta > 0.02 {
		return models.SeverityModerate
	}
	return models.SeverityMinor
}

func (c *Comparator) checkImprovement(comp models.RouteComparison) bool {
	if comp.LatencyDelta.P95DeltaPct < -10 {
		return true
	}
	if comp.ThroughputDelta.RPSDeltaPct > 10 {
		return true
	}
	if comp.ErrorDelta.ErrorRateDelta < -0.005 {
		return true
	}
	return false
}

func (c *Comparator) identifyBottlenecks(comparisons []models.RouteComparison) []models.Bottleneck {
	var bottlenecks []models.Bottleneck

	for _, comp := range comparisons {
		for _, check := range comp.DegradationChecks {
			if check.IsDegraded {
				var bType models.BottleneckType
				description := ""
				metrics := make(map[string]float64)

				switch check.Name {
				case "P95 延迟", "P99 延迟":
					bType = models.BottleneckLatency
					description = fmt.Sprintf("路由 %s 的 %s 退化 %.1f%%，基线 %.2fms，当前 %.2fms",
						comp.RouteName, check.Name, check.Current/check.Baseline*100-100, check.Baseline, check.Current)
					metrics["baseline"] = check.Baseline
					metrics["current"] = check.Current
					metrics["delta_pct"] = check.Current/check.Baseline*100 - 100

				case "错误率":
					bType = models.BottleneckErrorRate
					description = fmt.Sprintf("路由 %s 的错误率上升 %.4f，基线 %.4f，当前 %.4f",
						comp.RouteName, check.Current-check.Baseline, check.Baseline, check.Current)
					metrics["baseline"] = check.Baseline
					metrics["current"] = check.Current
					metrics["delta"] = check.Current - check.Baseline

				case "CPU":
					bType = models.BottleneckCPU
					description = fmt.Sprintf("路由 %s 的 CPU 使用增加 %.1f%%，基线 %.1f%%，当前 %.1f%%",
						comp.RouteName, check.Current-check.Baseline, check.Baseline, check.Current)
					metrics["baseline"] = check.Baseline
					metrics["current"] = check.Current
					metrics["delta"] = check.Current - check.Baseline
				}

				bottlenecks = append(bottlenecks, models.Bottleneck{
					Type:        bType,
					Location:    comp.RouteName,
					Description: description,
					Severity:    check.Severity,
					Metrics:     metrics,
				})
			}
		}
	}

	return bottlenecks
}

func (c *Comparator) generateRecommendations(result *models.ComparisonResult) []models.DegradationRec {
	var recs []models.DegradationRec

	criticalBottlenecks := []models.Bottleneck{}
	majorBottlenecks := []models.Bottleneck{}
	minorBottlenecks := []models.Bottleneck{}

	for _, b := range result.Bottlenecks {
		switch b.Severity {
		case models.SeverityCritical:
			criticalBottlenecks = append(criticalBottlenecks, b)
		case models.SeverityMajor:
			majorBottlenecks = append(majorBottlenecks, b)
		default:
			minorBottlenecks = append(minorBottlenecks, b)
		}
	}

	if len(criticalBottlenecks) > 0 {
		routes := []string{}
		for _, b := range criticalBottlenecks {
			routes = append(routes, b.Location)
		}
		routes = uniqueStrings(routes)

		recs = append(recs, models.DegradationRec{
			Action:        models.ActionRollback,
			TargetRoutes:  routes,
			RiskLevel:     models.RiskCritical,
			Description:   "存在严重退化，建议回滚到上一版本",
			Justification: fmt.Sprintf("检测到 %d 个严重瓶颈，包括关键指标严重退化", len(criticalBottlenecks)),
		})
	}

	if len(majorBottlenecks) > 0 {
		routes := []string{}
		for _, b := range majorBottlenecks {
			routes = append(routes, b.Location)
		}
		routes = uniqueStrings(routes)

		for _, b := range majorBottlenecks {
			switch b.Type {
			case models.BottleneckErrorRate:
				recs = append(recs, models.DegradationRec{
					Action:        models.ActionEnableCircuit,
					TargetRoutes:  []string{b.Location},
					RiskLevel:     models.RiskHigh,
					Description:   "启用熔断保护",
					Justification: fmt.Sprintf("错误率过高：%s", b.Description),
				})
			case models.BottleneckLatency:
				recs = append(recs, models.DegradationRec{
					Action:        models.ActionSwitchToFallback,
					TargetRoutes:  []string{b.Location},
					RiskLevel:     models.RiskMedium,
					Description:   "切换到降级返回",
					Justification: fmt.Sprintf("延迟严重退化：%s", b.Description),
				})
			case models.BottleneckCPU:
				recs = append(recs, models.DegradationRec{
					Action:        models.ActionIncreaseResources,
					TargetRoutes:  []string{b.Location},
					RiskLevel:     models.RiskMedium,
					Description:   "增加 CPU 资源",
					Justification: fmt.Sprintf("CPU 资源瓶颈：%s", b.Description),
				})
			}
		}
	}

	if len(minorBottlenecks) > 0 {
		routes := []string{}
		for _, b := range minorBottlenecks {
			routes = append(routes, b.Location)
		}
		routes = uniqueStrings(routes)

		recs = append(recs, models.DegradationRec{
			Action:        models.ActionInvestigate,
			TargetRoutes:  routes,
			RiskLevel:     models.RiskLow,
			Description:   "建议进一步调查",
			Justification: fmt.Sprintf("检测到 %d 个轻微退化，建议关注", len(minorBottlenecks)),
		})
	}

	if len(recs) == 0 {
		recs = append(recs, models.DegradationRec{
			Action:        models.ActionProceed,
			TargetRoutes:  nil,
			RiskLevel:     models.RiskLow,
			Description:   "可以正常上线",
			Justification: "所有指标在可接受范围内",
		})
	}

	return recs
}

func calculateDeltaPct(current, baseline float64) float64 {
	if baseline == 0 {
		return 0
	}
	return (current - baseline) / math.Abs(baseline) * 100
}

func uniqueStrings(slice []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}
