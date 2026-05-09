package reporter

import (
	"context"
	"fmt"
	"strings"
	"time"

	"mq-deadletter-review/internal/domain/model"
	"mq-deadletter-review/internal/domain/service"
	"mq-deadletter-review/pkg/logger"
)

type MarkdownReporter struct {
	trackingSvc *service.TrackingService
	replaySvc   *service.ReplayService
}

func NewMarkdownReporter(trackingSvc *service.TrackingService, replaySvc *service.ReplayService) *MarkdownReporter {
	return &MarkdownReporter{
		trackingSvc: trackingSvc,
		replaySvc:   replaySvc,
	}
}

type ReportOptions struct {
	IncludeEventLogs  bool
	IncludeStatistics bool
	IncludeDeadLetter bool
	MaxLogs           int
}

func (r *MarkdownReporter) GenerateTrackingReport(
	ctx context.Context,
	trackingID string,
	opts *ReportOptions,
) (string, error) {
	if opts == nil {
		opts = &ReportOptions{
			IncludeEventLogs:  true,
			IncludeStatistics: true,
			IncludeDeadLetter: true,
			MaxLogs:           50,
		}
	}

	tracking, err := r.trackingSvc.GetByTrackingID(ctx, trackingID)
	if err != nil {
		return "", err
	}

	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# 消息追踪报告 - %s\n\n", tracking.TrackingID))
	builder.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	builder.WriteString("## 基本信息\n\n")
	builder.WriteString("| 字段 | 值 |\n")
	builder.WriteString("|------|-----|\n")
	builder.WriteString(fmt.Sprintf("| 追踪ID | `%s` |\n", tracking.TrackingID))
	builder.WriteString(fmt.Sprintf("| 消息ID | `%s` |\n", tracking.MessageID))
	builder.WriteString(fmt.Sprintf("| Topic | `%s` |\n", tracking.Topic))
	builder.WriteString(fmt.Sprintf("| Tag | `%s` |\n", tracking.Tag))
	builder.WriteString(fmt.Sprintf("| 生产者组 | `%s` |\n", tracking.ProducerGroup))
	builder.WriteString(fmt.Sprintf("| 消费者组 | `%s` |\n", tracking.ConsumerGroup))
	builder.WriteString(fmt.Sprintf("| 当前状态 | **%s** |\n", tracking.Status))
	builder.WriteString(fmt.Sprintf("| 重试次数 | %d/%d |\n", tracking.RetryCount, tracking.MaxRetryCount))
	builder.WriteString("\n")

	builder.WriteString("## 状态流转时间线\n\n")
	builder.WriteString("```mermaid\ngantt\n")
	builder.WriteString("    title 消息状态流转\n")
	builder.WriteString("    dateFormat  YYYY-MM-DD HH:mm:ss\n")

	if tracking.ProducedAt != nil {
		builder.WriteString(fmt.Sprintf("    PRODUCED     :done,    des1, %s, 1h\n", tracking.ProducedAt.Format("2006-01-02 15:04:05")))
	}
	if tracking.SentAt != nil {
		builder.WriteString(fmt.Sprintf("    SENT         :active,  des2, %s, 1h\n", tracking.SentAt.Format("2006-01-02 15:04:05")))
	}
	if tracking.ConsumedAt != nil {
		builder.WriteString(fmt.Sprintf("    CONSUMED     :         des3, %s, 1h\n", tracking.ConsumedAt.Format("2006-01-02 15:04:05")))
	}
	if tracking.DeadLetterAt != nil {
		builder.WriteString(fmt.Sprintf("    DEAD_LETTER  :crit,    des4, %s, 1h\n", tracking.DeadLetterAt.Format("2006-01-02 15:04:05")))
	}
	if tracking.ReplayedAt != nil {
		builder.WriteString(fmt.Sprintf("    REPLAYED     :         des5, %s, 1h\n", tracking.ReplayedAt.Format("2006-01-02 15:04:05")))
	}
	if tracking.ProcessedAt != nil {
		builder.WriteString(fmt.Sprintf("    PROCESSED    :done,    des6, %s, 1h\n", tracking.ProcessedAt.Format("2006-01-02 15:04:05")))
	}
	builder.WriteString("```\n\n")

	if tracking.ErrorMessage != "" {
		builder.WriteString("## 错误信息\n\n")
		builder.WriteString(fmt.Sprintf("> **%s**\n\n", tracking.ErrorMessage))
		if tracking.LatestError != "" && tracking.LatestError != tracking.ErrorMessage {
			builder.WriteString(fmt.Sprintf("**最近错误**: %s\n\n", tracking.LatestError))
		}
		if tracking.ErrorStack != "" {
			builder.WriteString("### 错误堆栈\n\n")
			builder.WriteString("```\n")
			builder.WriteString(tracking.ErrorStack)
			builder.WriteString("\n```\n\n")
		}
	}

	if tracking.Body != "" {
		builder.WriteString("## 消息体\n\n")
		builder.WriteString("```json\n")
		body := tracking.Body
		if len(body) > 10000 {
			body = body[:10000] + "\n...(内容过长已截断)"
		}
		builder.WriteString(body)
		builder.WriteString("\n```\n\n")
	}

	if opts.IncludeEventLogs {
		logs, err := r.trackingSvc.GetEventLogs(ctx, trackingID, opts.MaxLogs)
		if err == nil && len(logs) > 0 {
			builder.WriteString(fmt.Sprintf("## 事件日志 (最近 %d 条)\n\n", len(logs)))
			builder.WriteString("| 时间 | 事件 | 从状态 | 到状态 | 操作 | 成功 | 耗时(ms) |\n")
			builder.WriteString("|------|------|--------|--------|------|------|----------|\n")

			for _, log := range logs {
				success := "✅"
				if !log.Success {
					success = "❌"
				}
				builder.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s | %d |\n",
					log.CreatedAt.Format("2006-01-02 15:04:05"),
					log.EventName,
					log.FromStatus,
					log.ToStatus,
					log.Operation,
					success,
					log.ExecutionTime,
				))
			}
			builder.WriteString("\n")

			for _, log := range logs {
				if log.ErrorInfo != "" || log.Description != "" {
					builder.WriteString(fmt.Sprintf("### %s - %s\n\n", log.EventName, log.CreatedAt.Format("2006-01-02 15:04:05")))
					if log.Description != "" {
						builder.WriteString(fmt.Sprintf("**描述**: %s\n\n", log.Description))
					}
					if log.ErrorInfo != "" {
						builder.WriteString("**错误详情**:\n\n")
						builder.WriteString("```\n")
						builder.WriteString(log.ErrorInfo)
						builder.WriteString("\n```\n\n")
					}
				}
			}
		}
	}

	if opts.IncludeDeadLetter && tracking.Status == model.MessageStatusDeadLetter {
		deadLetter, err := r.trackingSvc.GetDeadLetterByTrackingID(ctx, trackingID)
		if err == nil {
			builder.WriteString("## 死信信息\n\n")
			builder.WriteString("| 字段 | 值 |\n")
			builder.WriteString("|------|-----|\n")
			builder.WriteString(fmt.Sprintf("| 死信ID | `%d` |\n", deadLetter.ID))
			builder.WriteString(fmt.Sprintf("| 原始Topic | `%s` |\n", deadLetter.OriginTopic))
			builder.WriteString(fmt.Sprintf("| 原始消息ID | `%s` |\n", deadLetter.OriginMessageID))
			builder.WriteString(fmt.Sprintf("| 入死信时间 | %s |\n", deadLetter.DeadLetterAt.Format("2006-01-02 15:04:05")))
			builder.WriteString(fmt.Sprintf("| 重放次数 | %d/%d |\n", deadLetter.ReplayCount, deadLetter.MaxReplayCount))
			builder.WriteString(fmt.Sprintf("| 重放状态 | %s |\n", deadLetter.ReplayStatus))
			if deadLetter.LastReplayAt != nil {
				builder.WriteString(fmt.Sprintf("| 最后重放时间 | %s |\n", deadLetter.LastReplayAt.Format("2006-01-02 15:04:05")))
			}
			builder.WriteString("\n")

			if deadLetter.ReplayCount < deadLetter.MaxReplayCount {
				builder.WriteString(fmt.Sprintf("> 💡 **提示**: 此消息仍可重放，剩余重放次数: %d\n\n", deadLetter.MaxReplayCount-deadLetter.ReplayCount))
			} else {
				builder.WriteString("> ⚠️ **警告**: 此消息已达到最大重放次数，需要人工介入处理\n\n")
			}
		}
	}

	builder.WriteString("---\n\n")
	builder.WriteString("*报告由 MQ 死信复盘系统自动生成*\n")

	logger.Info("Generated tracking report for tracking_id=%s", trackingID)
	return builder.String(), nil
}

func (r *MarkdownReporter) GenerateReplayReport(
	ctx context.Context,
	requestID string,
	opts *ReportOptions,
) (string, error) {
	if opts == nil {
		opts = &ReportOptions{
			MaxLogs: 100,
		}
	}

	request, err := r.replaySvc.GetReplayRequest(ctx, requestID)
	if err != nil {
		return "", err
	}

	tasks, err := r.replaySvc.GetReplayTasks(ctx, requestID)
	if err != nil {
		return "", err
	}

	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# 消息重放报告 - %s\n\n", requestID))
	builder.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	builder.WriteString("## 重放任务概览\n\n")
	builder.WriteString("| 字段 | 值 |\n")
	builder.WriteString("|------|-----|\n")
	builder.WriteString(fmt.Sprintf("| 重放请求ID | `%s` |\n", request.RequestID))
	builder.WriteString(fmt.Sprintf("| 状态 | **%s** |\n", request.Status))
	builder.WriteString(fmt.Sprintf("| 消息总数 | %d |\n", request.TotalCount))
	builder.WriteString(fmt.Sprintf("| 成功 | %d |\n", request.SuccessCount))
	builder.WriteString(fmt.Sprintf("| 失败 | %d |\n", request.FailedCount))
	builder.WriteString(fmt.Sprintf("| 并发数 | %d |\n", request.Concurrency))
	builder.WriteString(fmt.Sprintf("| DryRun | %t |\n", request.DryRun))
	if request.Reason != "" {
		builder.WriteString(fmt.Sprintf("| 重放原因 | %s |\n", request.Reason))
	}
	if request.OperatorID != "" {
		builder.WriteString(fmt.Sprintf("| 操作人 | %s |\n", request.OperatorID))
	}
	builder.WriteString("\n")

	if request.StartTime != nil && request.EndTime != nil {
		duration := request.EndTime.Sub(*request.StartTime)
		builder.WriteString(fmt.Sprintf("**执行时长**: %.2f 秒\n\n", duration.Seconds()))
	}

	successRate := 0.0
	if request.TotalCount > 0 {
		successRate = float64(request.SuccessCount) / float64(request.TotalCount) * 100
	}

	builder.WriteString(fmt.Sprintf("**成功率**: %.2f%%\n\n", successRate))

	if request.TotalCount > 0 {
		builder.WriteString("## 重放结果统计\n\n")
		builder.WriteString("```mermaid\n")
		builder.WriteString("pie title 重放结果分布\n")
		builder.WriteString(fmt.Sprintf("    \"成功\" : %d\n", request.SuccessCount))
		builder.WriteString(fmt.Sprintf("    \"失败\" : %d\n", request.FailedCount))
		builder.WriteString("```\n\n")
	}

	if len(tasks) > 0 {
		builder.WriteString(fmt.Sprintf("## 重放明细 (共 %d 条)\n\n", len(tasks)))
		builder.WriteString("| 序号 | 追踪ID | 消息ID | 状态 | 耗时(ms) |\n")
		builder.WriteString("|------|--------|--------|------|----------|\n")

		for _, task := range tasks {
			status := "✅"
			if task.Status == "FAILED" {
				status = "❌"
			} else if task.Status == "PROCESSING" {
				status = "⏳"
			}
			builder.WriteString(fmt.Sprintf("| %d | `%s` | `%s` | %s | %d |\n",
				task.Sequence+1,
				task.TrackingID,
				task.MessageID,
				status,
				task.ExecutionTime,
			))
		}
		builder.WriteString("\n")

		failedTasks := make([]*model.ReplayTask, 0)
		for _, task := range tasks {
			if task.Status == "FAILED" {
				failedTasks = append(failedTasks, task)
			}
		}

		if len(failedTasks) > 0 {
			builder.WriteString(fmt.Sprintf("## 失败明细 (共 %d 条)\n\n", len(failedTasks)))
			for i, task := range failedTasks {
				builder.WriteString(fmt.Sprintf("### %d. %s\n\n", i+1, task.TrackingID))
				builder.WriteString(fmt.Sprintf("**消息ID**: `%s`\n\n", task.MessageID))
				if task.ErrorMessage != "" {
					builder.WriteString("**错误信息**:\n\n")
					builder.WriteString("```\n")
					builder.WriteString(task.ErrorMessage)
					builder.WriteString("\n```\n\n")
				}
			}
		}
	}

	if request.ErrorMessage != "" {
		builder.WriteString("## 重放任务错误\n\n")
		builder.WriteString("```\n")
		builder.WriteString(request.ErrorMessage)
		builder.WriteString("\n```\n\n")
	}

	builder.WriteString("---\n\n")
	builder.WriteString("*报告由 MQ 死信复盘系统自动生成*\n")

	logger.Info("Generated replay report for request_id=%s", requestID)
	return builder.String(), nil
}

func (r *MarkdownReporter) GenerateStatisticsReport(
	ctx context.Context,
) (string, error) {
	stats, err := r.trackingSvc.GetStatistics(ctx)
	if err != nil {
		return "", err
	}

	var builder strings.Builder

	builder.WriteString("# MQ 消息追踪系统统计报告\n\n")
	builder.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	builder.WriteString("## 消息状态分布\n\n")
	builder.WriteString("| 状态 | 数量 |\n")
	builder.WriteString("|------|------|\n")

	statuses := []string{
		"PRODUCED", "SENT", "CONSUMED", "RETRY",
		"DEAD_LETTER", "REPLAYED", "PROCESSED", "FAILED",
	}

	for _, status := range statuses {
		count := int64(0)
		if val, exists := stats[status]; exists {
			count = val.(int64)
		}
		builder.WriteString(fmt.Sprintf("| %s | %d |\n", status, count))
	}

	if deadLetterTotal, exists := stats["DEAD_LETTER_TOTAL"]; exists {
		builder.WriteString(fmt.Sprintf("| **死信消息总数** | **%d** |\n", deadLetterTotal.(int64)))
	}
	builder.WriteString("\n")

	total := int64(0)
	for _, status := range statuses {
		if val, exists := stats[status]; exists {
			total += val.(int64)
		}
	}

	if total > 0 {
		builder.WriteString("```mermaid\n")
		builder.WriteString("pie title 消息状态分布\n")
		for _, status := range statuses {
			if val, exists := stats[status]; exists {
				count := val.(int64)
				if count > 0 {
					builder.WriteString(fmt.Sprintf("    \"%s\" : %d\n", status, count))
				}
			}
		}
		builder.WriteString("```\n\n")
	}

	builder.WriteString("## 健康度分析\n\n")

	produced, _ := stats["PRODUCED"].(int64)
	processed, _ := stats["PROCESSED"].(int64)
	deadLetter, _ := stats["DEAD_LETTER"].(int64)
	retry, _ := stats["RETRY"].(int64)

	if produced > 0 {
		processRate := float64(processed) / float64(produced) * 100
		builder.WriteString(fmt.Sprintf("- **消息处理成功率**: %.2f%%\n", processRate))
	}

	if produced > 0 {
		deadLetterRate := float64(deadLetter) / float64(produced) * 100
		builder.WriteString(fmt.Sprintf("- **死信率**: %.2f%%\n", deadLetterRate))
	}

	if retry > 0 {
		builder.WriteString(fmt.Sprintf("- **重试中的消息**: %d 条 (需要关注)\n", retry))
	}

	if deadLetter > 0 {
		builder.WriteString(fmt.Sprintf("- **待处理死信**: %d 条 (需要处理)\n", deadLetter))
	}

	builder.WriteString("\n")

	if deadLetter > 0 {
		builder.WriteString(fmt.Sprintf("> ⚠️ **注意**: 系统存在 %d 条死信消息，建议尽快处理\n\n", deadLetter))
	} else if retry > 0 {
		builder.WriteString(fmt.Sprintf("> ℹ️ **提示**: 系统存在 %d 条重试中的消息，请监控是否能正常恢复\n\n", retry))
	} else {
		builder.WriteString("> ✅ **健康**: 系统运行正常，无积压的死信消息\n\n")
	}

	builder.WriteString("---\n\n")
	builder.WriteString("*报告由 MQ 死信复盘系统自动生成*\n")

	logger.Info("Generated statistics report")
	return builder.String(), nil
}
