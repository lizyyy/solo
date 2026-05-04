package services

import (
	"context"
	"fmt"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
	"sort"
)

type AttributionService struct {
	repo *repository.Repository
}

func NewAttributionService(repo *repository.Repository) *AttributionService {
	return &AttributionService{repo: repo}
}

func (s *AttributionService) AnalyzeSlowPath(ctx context.Context, runID uint) ([]models.SlowPathAttribution, error) {
	// 获取运行数据
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("run not found: %w", err)
	}

	// 检查运行状态
	if run.Status != models.RunStatusCompleted && run.Status != models.RunStatusStopped {
		return nil, fmt.Errorf("run is not completed or stopped, status: %s", run.Status)
	}

	// 获取性能事件
	events, err := s.repo.GetProfileEventsByRunID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get profile events: %w", err)
	}

	// 按类别统计事件
	categoryStats := s.aggregateEventsByCategory(events)

	// 计算总时间
	var totalTimeMs float64
	for _, stats := range categoryStats {
		totalTimeMs += stats.TotalTimeMs
	}

	// 生成归因分析
	var attributions []models.SlowPathAttribution

	for category, stats := range categoryStats {
		attribution := s.analyzeCategory(category, stats, totalTimeMs, run)
		if attribution != nil {
			attribution.RunID = runID
			attributions = append(attributions, *attribution)
		}
	}

	// 分析运行指标
	metricAttributions := s.analyzeRunMetrics(run)
	attributions = append(attributions, metricAttributions...)

	// 按优先级排序
	sort.Slice(attributions, func(i, j int) bool {
		return attributions[i].Priority < attributions[j].Priority
	})

	// 保存归因分析结果
	for i := range attributions {
		attributions[i].Priority = i + 1 // 设置优先级
		if err := s.repo.CreateSlowPathAttribution(ctx, &attributions[i]); err != nil {
			return nil, fmt.Errorf("failed to create attribution: %w", err)
		}
	}

	return attributions, nil
}

type categoryStats struct {
	Category       string
	TotalTimeMs    float64
	Count          int
	AvgTimeMs      float64
	MaxTimeMs      float64
	TimeoutCount   int
	ErrorCount     int
	CacheMissCount int
}

func (s *AttributionService) aggregateEventsByCategory(events []models.ProfileEvent) map[string]*categoryStats {
	stats := make(map[string]*categoryStats)

	for _, event := range events {
		category := event.Category
		if category == "" {
			category = "other"
		}

		if stats[category] == nil {
			stats[category] = &categoryStats{
				Category: category,
			}
		}

		stats[category].TotalTimeMs += event.DurationMs
		stats[category].Count++
		if event.DurationMs > stats[category].MaxTimeMs {
			stats[category].MaxTimeMs = event.DurationMs
		}

		// 分析事件类型
		if event.EventType == "timeout" {
			stats[category].TimeoutCount++
		} else if event.EventType == "error" {
			stats[category].ErrorCount++
		} else if event.EventType == "cache_miss" {
			stats[category].CacheMissCount++
		}
	}

	// 计算平均时间
	for _, stat := range stats {
		if stat.Count > 0 {
			stat.AvgTimeMs = stat.TotalTimeMs / float64(stat.Count)
		}
	}

	return stats
}

func (s *AttributionService) analyzeCategory(category string, stats *categoryStats, totalTimeMs float64, run *models.Run) *models.SlowPathAttribution {
	if totalTimeMs <= 0 {
		return nil
	}

	percentage := (stats.TotalTimeMs / totalTimeMs) * 100

	// 定义阈值
	const (
		highTimeThreshold        = 30.0 // 占总时间 30%
		mediumTimeThreshold      = 15.0 // 占总时间 15%
		highTimeoutThreshold     = 10   // 超时次数
		highErrorThreshold       = 10   // 错误次数
		highCacheMissThreshold   = 20   // 缓存未命中次数
		highAvgTimeThreshold     = 500.0 // 平均时间 500ms
	)

	var severity string
	var description string
	var recommendation string
	var impactScore float64
	var priority int

	// 根据类别分析
	switch category {
	case models.EventCategorySQL:
		if percentage > highTimeThreshold || stats.AvgTimeMs > highAvgTimeThreshold {
			severity = models.SeverityHigh
			description = fmt.Sprintf("SQL 操作耗时占比过高 (%.1f%%)，平均耗时 %.2fms", percentage, stats.AvgTimeMs)
			recommendation = "建议：1. 检查慢查询日志，优化 SQL 语句；2. 添加适当的索引；3. 考虑使用查询缓存；4. 分析执行计划。"
			impactScore = percentage * 2
			priority = 1
		} else if percentage > mediumTimeThreshold {
			severity = models.SeverityMedium
			description = fmt.Sprintf("SQL 操作耗时占比中等 (%.1f%%)，平均耗时 %.2fms", percentage, stats.AvgTimeMs)
			recommendation = "建议：监控 SQL 性能，考虑优化查询或添加索引。"
			impactScore = percentage
			priority = 3
		} else {
			return nil
		}

	case models.EventCategoryCache:
		cacheMissRate := 0.0
		if stats.Count > 0 {
			cacheMissRate = float64(stats.CacheMissCount) / float64(stats.Count) * 100
		}

		if cacheMissRate > 50 {
			severity = models.SeverityCritical
			description = fmt.Sprintf("缓存命中率极低 (%.1f%%)，未命中次数 %d", 100-cacheMissRate, stats.CacheMissCount)
			recommendation = "建议：1. 检查缓存键设计是否合理；2. 增加缓存容量；3. 调整缓存过期时间；4. 考虑使用多级缓存。"
			impactScore = cacheMissRate * 2
			priority = 1
		} else if cacheMissRate > 30 {
			severity = models.SeverityHigh
			description = fmt.Sprintf("缓存命中率偏低 (%.1f%%)，未命中次数 %d", 100-cacheMissRate, stats.CacheMissCount)
			recommendation = "建议：分析缓存未命中原因，优化缓存策略。"
			impactScore = cacheMissRate
			priority = 2
		} else if percentage > highTimeThreshold {
			severity = models.SeverityMedium
			description = fmt.Sprintf("缓存操作耗时占比过高 (%.1f%%)", percentage)
			recommendation = "建议：检查缓存服务性能，考虑使用本地缓存或更高效的缓存服务。"
			impactScore = percentage
			priority = 3
		} else {
			return nil
		}

	case models.EventCategoryDownstream:
		if stats.TimeoutCount > highTimeoutThreshold {
			severity = models.SeverityCritical
			description = fmt.Sprintf("下游服务超时次数过多 (%d 次)，占比 %.1f%%", stats.TimeoutCount, percentage)
			recommendation = "建议：1. 检查下游服务健康状态；2. 增加超时时间；3. 实现降级和熔断机制；4. 考虑异步处理。"
			impactScore = float64(stats.TimeoutCount) * 10
			priority = 1
		} else if stats.ErrorCount > highErrorThreshold {
			severity = models.SeverityHigh
			description = fmt.Sprintf("下游服务错误次数过多 (%d 次)，占比 %.1f%%", stats.ErrorCount, percentage)
			recommendation = "建议：检查下游服务错误日志，实现重试机制和降级策略。"
			impactScore = float64(stats.ErrorCount) * 5
			priority = 2
		} else if percentage > highTimeThreshold {
			severity = models.SeverityHigh
			description = fmt.Sprintf("下游服务调用耗时占比过高 (%.1f%%)，平均耗时 %.2fms", percentage, stats.AvgTimeMs)
			recommendation = "建议：1. 检查下游服务性能；2. 考虑使用连接池；3. 实现请求合并和批处理；4. 增加缓存层。"
			impactScore = percentage * 1.5
			priority = 2
		} else {
			return nil
		}

	case models.EventCategorySerialization:
		if percentage > highTimeThreshold || stats.AvgTimeMs > 100 {
			severity = models.SeverityHigh
			description = fmt.Sprintf("序列化/反序列化耗时过高 (%.1f%%)，平均耗时 %.2fms", percentage, stats.AvgTimeMs)
			recommendation = "建议：1. 使用更高效的序列化格式（如 Protocol Buffers）；2. 减少响应数据大小；3. 考虑使用流式处理；4. 优化数据结构。"
			impactScore = percentage
			priority = 2
		} else if percentage > mediumTimeThreshold {
			severity = models.SeverityMedium
			description = fmt.Sprintf("序列化/反序列化耗时占比中等 (%.1f%%)", percentage)
			recommendation = "建议：监控序列化性能，考虑优化数据结构。"
			impactScore = percentage * 0.5
			priority = 4
		} else {
			return nil
		}

	case models.EventCategoryResponseSize:
		if stats.MaxTimeMs > 1000 || run.Metrics.AvgResponseSize > 100000 { // 平均响应超过 100KB
			severity = models.SeverityHigh
			description = fmt.Sprintf("响应体过大，平均响应大小 %.2f KB，最大处理时间 %.2fms", float64(run.Metrics.AvgResponseSize)/1024, stats.MaxTimeMs)
			recommendation = "建议：1. 实现分页和增量加载；2. 使用压缩传输；3. 减少不必要的字段；4. 考虑使用 GraphQL 或字段选择。"
			impactScore = float64(run.Metrics.AvgResponseSize) / 10000
			priority = 2
		} else if run.Metrics.AvgResponseSize > 50000 { // 平均响应超过 50KB
			severity = models.SeverityMedium
			description = fmt.Sprintf("响应体中等，平均响应大小 %.2f KB", float64(run.Metrics.AvgResponseSize)/1024)
			recommendation = "建议：评估响应数据大小，考虑优化数据传输。"
			impactScore = float64(run.Metrics.AvgResponseSize) / 50000
			priority = 4
		} else {
			return nil
		}

	case models.EventCategoryConnectionPool:
		if percentage > highTimeThreshold || stats.AvgTimeMs > 100 {
			severity = models.SeverityCritical
			description = fmt.Sprintf("连接池等待时间过长 (%.1f%%)，平均等待时间 %.2fms", percentage, stats.AvgTimeMs)
			recommendation = "建议：1. 增加连接池大小；2. 检查连接泄漏；3. 优化连接使用模式；4. 考虑使用连接复用。"
			impactScore = percentage * 2
			priority = 1
		} else if percentage > mediumTimeThreshold {
			severity = models.SeverityHigh
			description = fmt.Sprintf("连接池等待时间占比中等 (%.1f%%)", percentage)
			recommendation = "建议：监控连接池状态，考虑调整连接池配置。"
			impactScore = percentage
			priority = 3
		} else {
			return nil
		}

	default:
		if percentage > highTimeThreshold {
			severity = models.SeverityMedium
			description = fmt.Sprintf("未知类别操作耗时占比过高 (%.1f%%)，类别: %s", percentage, category)
			recommendation = "建议：分析此类别的具体操作，确定性能瓶颈。"
			impactScore = percentage
			priority = 4
		} else {
			return nil
		}
	}

	return &models.SlowPathAttribution{
		Category:       category,
		Severity:       severity,
		Description:    description,
		ImpactScore:    impactScore,
		Priority:       priority,
		Recommendation: recommendation,
		Metrics: models.AttributionMetrics{
			TotalTimeMs:       stats.TotalTimeMs,
			PercentageOfTotal: percentage,
			Count:             stats.Count,
			AvgTimeMs:         stats.AvgTimeMs,
			MaxTimeMs:         stats.MaxTimeMs,
		},
	}
}

func (s *AttributionService) analyzeRunMetrics(run *models.Run) []models.SlowPathAttribution {
	var attributions []models.SlowPathAttribution

	// 分析错误率
	if run.Metrics.ErrorRate > 0.1 { // 错误率超过 10%
		attribution := models.SlowPathAttribution{
			Category:    "error_rate",
			Severity:    models.SeverityHigh,
			Description: fmt.Sprintf("错误率过高 (%.2f%%)，失败请求 %d 次", run.Metrics.ErrorRate*100, run.Metrics.FailedRequests),
			ImpactScore: run.Metrics.ErrorRate * 100,
			Priority:    1,
			Recommendation: "建议：1. 检查错误日志，定位具体错误原因；2. 增加错误处理和重试机制；3. 检查依赖服务状态；4. 实现降级策略。",
			Metrics: models.AttributionMetrics{
				TotalTimeMs:       0,
				PercentageOfTotal: 0,
				Count:             int(run.Metrics.FailedRequests),
				AvgTimeMs:         0,
				MaxTimeMs:         0,
			},
		}
		attributions = append(attributions, attribution)
	} else if run.Metrics.ErrorRate > 0.05 { // 错误率超过 5%
		attribution := models.SlowPathAttribution{
			Category:    "error_rate",
			Severity:    models.SeverityMedium,
			Description: fmt.Sprintf("错误率偏高 (%.2f%%)，失败请求 %d 次", run.Metrics.ErrorRate*100, run.Metrics.FailedRequests),
			ImpactScore: run.Metrics.ErrorRate * 100,
			Priority:    3,
			Recommendation: "建议：监控错误率趋势，分析失败请求原因。",
			Metrics: models.AttributionMetrics{
				TotalTimeMs:       0,
				PercentageOfTotal: 0,
				Count:             int(run.Metrics.FailedRequests),
				AvgTimeMs:         0,
				MaxTimeMs:         0,
			},
		}
		attributions = append(attributions, attribution)
	}

	// 分析超时率
	if run.Metrics.TimeoutRate > 0.05 { // 超时率超过 5%
		attribution := models.SlowPathAttribution{
			Category:    "timeout_rate",
			Severity:    models.SeverityCritical,
			Description: fmt.Sprintf("超时率过高 (%.2f%%)，超时请求 %d 次", run.Metrics.TimeoutRate*100, run.Metrics.TimeoutRequests),
			ImpactScore: run.Metrics.TimeoutRate * 200,
			Priority:    1,
			Recommendation: "建议：1. 检查下游服务性能；2. 增加超时时间；3. 实现降级和熔断；4. 考虑异步处理。",
			Metrics: models.AttributionMetrics{
				TotalTimeMs:       0,
				PercentageOfTotal: 0,
				Count:             int(run.Metrics.TimeoutRequests),
				AvgTimeMs:         0,
				MaxTimeMs:         0,
			},
		}
		attributions = append(attributions, attribution)
	} else if run.Metrics.TimeoutRate > 0.02 { // 超时率超过 2%
		attribution := models.SlowPathAttribution{
			Category:    "timeout_rate",
			Severity:    models.SeverityHigh,
			Description: fmt.Sprintf("超时率偏高 (%.2f%%)，超时请求 %d 次", run.Metrics.TimeoutRate*100, run.Metrics.TimeoutRequests),
			ImpactScore: run.Metrics.TimeoutRate * 100,
			Priority:    2,
			Recommendation: "建议：分析超时原因，检查网络和服务性能。",
			Metrics: models.AttributionMetrics{
				TotalTimeMs:       0,
				PercentageOfTotal: 0,
				Count:             int(run.Metrics.TimeoutRequests),
				AvgTimeMs:         0,
				MaxTimeMs:         0,
			},
		}
		attributions = append(attributions, attribution)
	}

	// 分析延迟
	if run.Metrics.P95Ms > 500 { // P95 超过 500ms
		attribution := models.SlowPathAttribution{
			Category:    "latency_p95",
			Severity:    models.SeverityHigh,
			Description: fmt.Sprintf("P95 延迟过高 (%.2fms)，P99 延迟 %.2fms", run.Metrics.P95Ms, run.Metrics.P99Ms),
			ImpactScore: run.Metrics.P95Ms / 10,
			Priority:    2,
			Recommendation: "建议：1. 分析性能事件，确定慢路径原因；2. 优化关键路径；3. 增加缓存层；4. 考虑水平扩展。",
			Metrics: models.AttributionMetrics{
				TotalTimeMs:       0,
				PercentageOfTotal: 0,
				Count:             int(run.Metrics.TotalRequests),
				AvgTimeMs:         run.Metrics.P50Ms,
				MaxTimeMs:         run.Metrics.P99Ms,
			},
		}
		attributions = append(attributions, attribution)
	}

	return attributions
}

func (s *AttributionService) GetSlowPathAttributionsByRunID(ctx context.Context, runID uint) ([]models.SlowPathAttribution, error) {
	return s.repo.GetSlowPathAttributionsByRunID(ctx, runID)
}
