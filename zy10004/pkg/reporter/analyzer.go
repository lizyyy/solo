package reporter

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
)

type ProblemAnalyzer struct {
	repo *repository.SQLiteRepository
}

func NewProblemAnalyzer(repo *repository.SQLiteRepository) *ProblemAnalyzer {
	return &ProblemAnalyzer{repo: repo}
}

type AnalysisResult struct {
	TraceID        string
	ProblemType    string
	Severity       string
	RootCause      string
	AffectedServices []string
	Evidence       []types.EvidenceItem
	Timeline       []types.TimelineEvent
	RetryPattern   *RetryPattern
}

type RetryPattern struct {
	TotalAttempts   int
	FailedAttempts  int
	SuccessOnRetry  bool
	LastAttemptTime time.Time
	AverageLatency  int64
}

func (a *ProblemAnalyzer) AnalyzeTrace(ctx context.Context, traceID string) (*AnalysisResult, error) {
	records, err := a.repo.GetTraceRecords(ctx, traceID)
	if err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return nil, nil
	}

	sort.Slice(records, func(i, j int) bool {
		return records[i].StartTime.Before(records[j].StartTime)
	})

	result := &AnalysisResult{
		TraceID: traceID,
	}

	result.Timeline = a.buildTimeline(records)
	result.Evidence = a.collectEvidence(records)
	result.AffectedServices = a.getAffectedServices(records)
	result.RetryPattern = a.analyzeRetryPattern(records)
	result.ProblemType = a.detectProblemType(records)
	result.Severity = a.determineSeverity(result)
	result.RootCause = a.identifyRootCause(result, records)

	return result, nil
}

func (a *ProblemAnalyzer) buildTimeline(records []*types.TraceRecord) []types.TimelineEvent {
	var events []types.TimelineEvent

	for _, record := range records {
		events = append(events, types.TimelineEvent{
			Time:    record.StartTime,
			Service: record.Service,
			Event:   "Started " + record.Method,
			Details: a.formatEventDetails(record, "start"),
		})

		if !record.EndTime.IsZero() {
			events = append(events, types.TimelineEvent{
				Time:    record.EndTime,
				Service: record.Service,
				Event:   "Completed " + record.Method + " (" + record.Status + ")",
				Details: a.formatEventDetails(record, "end"),
			})
		}
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Time.Before(events[j].Time)
	})

	return events
}

func (a *ProblemAnalyzer) formatEventDetails(record *types.TraceRecord, phase string) string {
	var details []string

	if record.Attempt > 0 {
		details = append(details, "Attempt "+itoa(record.Attempt)+"/"+itoa(record.MaxAttempts))
	}

	if phase == "end" {
		if record.DurationMS > 0 {
			details = append(details, "Duration: "+itoa(int(record.DurationMS))+"ms")
		}
		if record.Error != "" {
			details = append(details, "Error: "+record.Error)
		}
	}

	return strings.Join(details, " | ")
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func (a *ProblemAnalyzer) collectEvidence(records []*types.TraceRecord) []types.EvidenceItem {
	var evidence []types.EvidenceItem

	for _, record := range records {
		if record.Status == "ERROR" || record.Error != "" || record.Attempt > 1 {
			evidence = append(evidence, types.EvidenceItem{
				Service: record.Service,
				Method:  record.Method,
				Status:  record.Status,
				Error:   record.Error,
				Time:    record.StartTime,
				Attempt: record.Attempt,
			})
		}
	}

	return evidence
}

func (a *ProblemAnalyzer) getAffectedServices(records []*types.TraceRecord) []string {
	serviceSet := make(map[string]struct{})
	for _, record := range records {
		serviceSet[record.Service] = struct{}{}
	}

	var services []string
	for service := range serviceSet {
		services = append(services, service)
	}
	return services
}

func (a *ProblemAnalyzer) analyzeRetryPattern(records []*types.TraceRecord) *RetryPattern {
	pattern := &RetryPattern{}
	var totalLatency int64
	var latencyCount int

	for _, record := range records {
		if record.Attempt > 0 {
			pattern.TotalAttempts++
		}
		if record.Status == "ERROR" {
			pattern.FailedAttempts++
		}
		if record.DurationMS > 0 {
			totalLatency += record.DurationMS
			latencyCount++
		}
		if !record.EndTime.IsZero() {
			pattern.LastAttemptTime = record.EndTime
		}
	}

	if latencyCount > 0 {
		pattern.AverageLatency = totalLatency / int64(latencyCount)
	}

	for _, record := range records {
		if record.Status == "SUCCESS" && record.Attempt > 1 {
			pattern.SuccessOnRetry = true
		}
	}

	return pattern
}

func (a *ProblemAnalyzer) detectProblemType(records []*types.TraceRecord) string {
	var hasTimeout, hasRetryStorm, hasCascadingFailure, hasNetworkError bool

	for _, record := range records {
		if record.Error != "" {
			errLower := strings.ToLower(record.Error)
			if strings.Contains(errLower, "timeout") || strings.Contains(errLower, "timed out") {
				hasTimeout = true
			}
			if strings.Contains(errLower, "network") || strings.Contains(errLower, "connection") {
				hasNetworkError = true
			}
		}
	}

	maxAttempts := 0
	for _, record := range records {
		if record.Attempt > maxAttempts {
			maxAttempts = record.Attempt
		}
	}
	if maxAttempts >= 3 {
		hasRetryStorm = true
	}

	services := a.getAffectedServices(records)
	if len(services) >= 3 {
		hasCascadingFailure = true
	}

	switch {
	case hasRetryStorm && hasCascadingFailure:
		return "RETRY_STORM_AVALANCHE"
	case hasRetryStorm && hasTimeout:
		return "TIMEOUT_RETRY_STORM"
	case hasCascadingFailure:
		return "CASCADING_FAILURE"
	case hasNetworkError:
		return "NETWORK_PARTITION"
	case hasTimeout:
		return "SERVICE_TIMEOUT"
	default:
		return "UNKNOWN"
	}
}

func (a *ProblemAnalyzer) determineSeverity(result *AnalysisResult) string {
	score := 0

	if len(result.AffectedServices) >= 3 {
		score += 3
	} else if len(result.AffectedServices) >= 2 {
		score += 2
	}

	if result.RetryPattern != nil {
		if result.RetryPattern.TotalAttempts >= 5 {
			score += 3
		} else if result.RetryPattern.TotalAttempts >= 3 {
			score += 2
		}
	}

	if len(result.Evidence) >= 5 {
		score += 2
	}

	switch {
	case score >= 6:
		return "CRITICAL"
	case score >= 4:
		return "HIGH"
	case score >= 2:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

func (a *ProblemAnalyzer) identifyRootCause(result *AnalysisResult, records []*types.TraceRecord) string {
	switch result.ProblemType {
	case "RETRY_STORM_AVALANCHE":
		return "上游服务超时触发了指数退避重试机制，导致请求风暴向下游扩散，形成雪崩效应。多个服务同时收到重复请求，超过了系统的处理能力阈值。"

	case "TIMEOUT_RETRY_STORM":
		return "下游服务响应缓慢或超时，触发了自动重试逻辑。重试请求与正常请求形成正反馈，导致服务负载持续增加，最终引发雪崩。"

	case "CASCADING_FAILURE":
		return "某个核心服务故障导致依赖它的上游服务无法正常工作，故障沿着服务调用链向上传递，形成连锁反应。"

	case "NETWORK_PARTITION":
		return "网络分区导致部分服务节点无法通信，客户端误判为服务不可用而触发重试，加剧了正常节点的负载。"

	case "SERVICE_TIMEOUT":
		return "服务处理时间超过了客户端配置的超时阈值，可能是由于高负载、资源瓶颈或依赖服务响应缓慢导致。"

	default:
		return "需要进一步分析追踪数据以确定根本原因。"
	}
}

func (a *ProblemAnalyzer) GenerateReport(ctx context.Context, analysis *AnalysisResult) (*types.ProblemReport, error) {
	if analysis == nil {
		return nil, nil
	}

	report := &types.ProblemReport{
		ID:               utils.NewUUID(),
		Title:            a.generateReportTitle(analysis),
		Summary:          a.generateSummary(analysis),
		TraceID:          analysis.TraceID,
		ProblemType:      analysis.ProblemType,
		Severity:         analysis.Severity,
		AffectedServices: analysis.AffectedServices,
		RootCause:        analysis.RootCause,
		Evidence:         analysis.Evidence,
		Recommendations:  a.generateRecommendations(analysis),
		Timeline:         analysis.Timeline,
		GeneratedAt:      time.Now(),
	}

	if err := a.repo.SaveProblemReport(ctx, report); err != nil {
		utils.GetLogger().Error("Failed to save problem report", zap.Error(err))
	}

	return report, nil
}

func (a *ProblemAnalyzer) generateReportTitle(analysis *AnalysisResult) string {
	titles := map[string]string{
		"RETRY_STORM_AVALANCHE":   "重试风暴雪崩故障",
		"TIMEOUT_RETRY_STORM":     "超时引发的重试风暴",
		"CASCADING_FAILURE":       "服务级联故障",
		"NETWORK_PARTITION":       "网络分区故障",
		"SERVICE_TIMEOUT":         "服务超时故障",
	}

	if title, exists := titles[analysis.ProblemType]; exists {
		return title
	}
	return "未知类型系统故障"
}

func (a *ProblemAnalyzer) generateSummary(analysis *AnalysisResult) string {
	summary := "检测到 [" + analysis.ProblemType + "] 类型的系统问题。"

	if len(analysis.AffectedServices) > 0 {
		summary += " 影响服务: " + strings.Join(analysis.AffectedServices, ", ") + "。"
	}

	if analysis.RetryPattern != nil {
		summary += " 总重试次数: " + itoa(analysis.RetryPattern.TotalAttempts) + "。"
	}

	summary += " 严重程度: " + analysis.Severity + "。"

	return summary
}

func (a *ProblemAnalyzer) generateRecommendations(analysis *AnalysisResult) []string {
	var recommendations []string

	switch analysis.ProblemType {
	case "RETRY_STORM_AVALANCHE":
		recommendations = append(recommendations,
			"实现断路器模式（Circuit Breaker）防止故障扩散",
			"降低重试次数或使用更长的退避时间",
			"增加服务限流（Rate Limiting）保护",
			"实现请求去重和幂等性保证",
			"增加熔断阈值监控和告警")

	case "TIMEOUT_RETRY_STORM":
		recommendations = append(recommendations,
			"优化超时配置，区分不同服务的合理超时时间",
			"实现熔断机制，在多次失败后停止重试",
			"检查下游服务的性能瓶颈",
			"增加服务队列长度监控",
			"考虑使用异步处理模式")

	case "CASCADING_FAILURE":
		recommendations = append(recommendations,
			"实现服务降级（Fallback）机制",
			"增加缓存层减少对下游服务的依赖",
			"实现异步解耦，使用消息队列",
			"拆分服务调用链，减少单点依赖",
			"增加服务健康检查")

	case "NETWORK_PARTITION":
		recommendations = append(recommendations,
			"检查网络基础设施的稳定性",
			"实现跨可用区的服务部署",
			"增加连接池和健康检查频率",
			"实现优雅降级策略",
			"考虑使用服务网格进行流量管理")

	case "SERVICE_TIMEOUT":
		recommendations = append(recommendations,
			"分析服务性能瓶颈，优化慢查询",
			"增加服务资源（CPU/内存/连接数）",
			"实现请求优先级和限流",
			"检查依赖服务的响应时间",
			"考虑服务拆分或水平扩展")

	default:
		recommendations = append(recommendations,
			"收集更多追踪数据进行深入分析",
			"检查服务日志找出异常模式",
			"增加监控告警阈值")
	}

	recommendations = append(recommendations,
		"立即在测试环境复现问题，验证修复方案",
		"建立故障演练机制，定期进行混沌工程测试")

	return recommendations
}
