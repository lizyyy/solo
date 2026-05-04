package exporter

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/zy1153/pool-diagnostic/internal/diagnostics"
	"github.com/zy1153/pool-diagnostic/internal/models"
	"github.com/zy1153/pool-diagnostic/internal/storage"
)

type Exporter struct {
	store  *storage.BoltStore
	engine *diagnostics.DiagnosticEngine
}

func NewExporter(store *storage.BoltStore, engine *diagnostics.DiagnosticEngine) *Exporter {
	return &Exporter{
		store:  store,
		engine: engine,
	}
}

// ExportReport 导出报告
func (e *Exporter) ExportReport(format string) (*models.ReportExport, error) {
	// 运行诊断
	analysisResult, err := e.engine.RunFullDiagnostics()
	if err != nil {
		return nil, err
	}

	// 获取连接池状态
	pool, err := e.store.GetDefaultPool()
	if err != nil {
		return nil, err
	}

	// 获取活跃连接
	activeLeases, err := e.store.GetActiveLeases()
	if err != nil {
		return nil, err
	}

	// 获取等待队列
	waitingItems, err := e.store.GetActiveQueueItems()
	if err != nil {
		return nil, err
	}

	// 获取租户信息
	tenants, err := e.store.GetAllTenants()
	if err != nil {
		return nil, err
	}

	reportData := &ReportData{
		GeneratedAt:   time.Now(),
		Pool:          pool,
		Analysis:      analysisResult,
		ActiveLeases:  activeLeases,
		WaitingItems:  waitingItems,
		Tenants:       tenants,
	}

	var content string
	switch strings.ToLower(format) {
	case "json":
		content, err = e.exportAsJSON(reportData)
	case "csv":
		content, err = e.exportAsCSV(reportData)
	case "markdown", "md":
		content, err = e.exportAsMarkdown(reportData)
	default:
		return nil, fmt.Errorf("unsupported format: %s. supported formats: json, csv, markdown", format)
	}

	if err != nil {
		return nil, err
	}

	return &models.ReportExport{
		Format:      format,
		GeneratedAt: reportData.GeneratedAt,
		Content:     content,
	}, nil
}

type ReportData struct {
	GeneratedAt   time.Time
	Pool          *models.ConnectionPool
	Analysis      *models.AnalysisResult
	ActiveLeases  []models.ConnectionLease
	WaitingItems  []models.WaitQueueItem
	Tenants       []models.Tenant
}

// exportAsJSON 导出为 JSON 格式
func (e *Exporter) exportAsJSON(data *ReportData) (string, error) {
	type JSONReport struct {
		GeneratedAt     time.Time                     `json:"generated_at"`
		PoolConfig      *models.ConnectionPool        `json:"pool_config"`
		AnalysisSummary *models.AnalysisSummary       `json:"analysis_summary"`
		Alerts          []models.Alert                `json:"alerts"`
		ActiveLeases    []models.ConnectionLease      `json:"active_leases"`
		WaitingRequests []models.WaitQueueItem        `json:"waiting_requests"`
		Tenants         []models.Tenant               `json:"tenants"`
	}

	report := JSONReport{
		GeneratedAt:     data.GeneratedAt,
		PoolConfig:      data.Pool,
		AnalysisSummary: &data.Analysis.Summary,
		Alerts:          data.Analysis.Alerts,
		ActiveLeases:    data.ActiveLeases,
		WaitingRequests: data.WaitingItems,
		Tenants:         data.Tenants,
	}

	bytes, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// exportAsCSV 导出为 CSV 格式
func (e *Exporter) exportAsCSV(data *ReportData) (string, error) {
	var builder strings.Builder
	writer := csv.NewWriter(&builder)

	// 写入摘要部分
	writer.Write([]string{"# 连接池诊断报告", data.GeneratedAt.Format(time.RFC3339)})
	writer.Write([]string{})

	// 连接池配置
	writer.Write([]string{"## 连接池配置"})
	writer.Write([]string{"配置项", "值"})
	writer.Write([]string{"名称", data.Pool.Name})
	writer.Write([]string{"最大连接数", fmt.Sprintf("%d", data.Pool.MaxOpen)})
	writer.Write([]string{"最大空闲连接数", fmt.Sprintf("%d", data.Pool.MaxIdle)})
	writer.Write([]string{"空闲超时", data.Pool.IdleTimeout.String()})
	writer.Write([]string{"租户配额", fmt.Sprintf("%d", data.Pool.TenantQuota)})
	writer.Write([]string{})

	// 分析摘要
	writer.Write([]string{"## 分析摘要"})
	writer.Write([]string{"指标", "值"})
	writer.Write([]string{"总告警数", fmt.Sprintf("%d", data.Analysis.Summary.TotalAlerts)})
	writer.Write([]string{"严重告警", fmt.Sprintf("%d", data.Analysis.Summary.CriticalAlerts)})
	writer.Write([]string{"高危告警", fmt.Sprintf("%d", data.Analysis.Summary.HighAlerts)})
	writer.Write([]string{"中危告警", fmt.Sprintf("%d", data.Analysis.Summary.MediumAlerts)})
	writer.Write([]string{"低危告警", fmt.Sprintf("%d", data.Analysis.Summary.LowAlerts)})
	writer.Write([]string{"活跃连接数", fmt.Sprintf("%d", len(data.ActiveLeases))})
	writer.Write([]string{"等待请求数", fmt.Sprintf("%d", len(data.WaitingItems))})
	writer.Write([]string{})

	// 告警列表
	if len(data.Analysis.Alerts) > 0 {
		writer.Write([]string{"## 告警列表"})
		writer.Write([]string{"严重程度", "类型", "标题", "描述", "建议"})
		for _, alert := range data.Analysis.Alerts {
			writer.Write([]string{
				string(alert.Severity),
				string(alert.Type),
				alert.Title,
				alert.Description,
				alert.Recommendation,
			})
		}
		writer.Write([]string{})
	}

	// 活跃连接
	if len(data.ActiveLeases) > 0 {
		writer.Write([]string{"## 活跃连接列表"})
		writer.Write([]string{"连接ID", "请求ID", "租户ID", "借出时间", "状态", "等待耗时", "SQL数量"})
		for _, lease := range data.ActiveLeases {
			writer.Write([]string{
				lease.ConnectionID,
				lease.RequestID,
				lease.TenantID,
				lease.BorrowedAt.Format(time.RFC3339),
				string(lease.Status),
				lease.WaitDuration.String(),
				fmt.Sprintf("%d", lease.SQLCount),
			})
		}
		writer.Write([]string{})
	}

	// 等待队列
	if len(data.WaitingItems) > 0 {
		writer.Write([]string{"## 等待队列"})
		writer.Write([]string{"请求ID", "租户ID", "入队时间", "等待耗时", "超时时间", "状态"})
		for _, item := range data.WaitingItems {
			waitTime := time.Since(item.EnqueuedAt)
			writer.Write([]string{
				item.RequestID,
				item.TenantID,
				item.EnqueuedAt.Format(time.RFC3339),
				waitTime.String(),
				item.Timeout.String(),
				string(item.Status),
			})
		}
		writer.Write([]string{})
	}

	// 租户统计
	if len(data.Tenants) > 0 {
		writer.Write([]string{"## 租户统计"})
		writer.Write([]string{"租户ID", "租户名称", "配额", "当前连接数", "总借出次数", "平均等待时间", "告警数"})
		for _, tenant := range data.Tenants {
			writer.Write([]string{
				tenant.ID,
				tenant.Name,
				fmt.Sprintf("%d", tenant.Quota),
				fmt.Sprintf("%d", tenant.CurrentConnections),
				fmt.Sprintf("%d", tenant.TotalBorrows),
				tenant.AvgWaitTime.String(),
				fmt.Sprintf("%d", tenant.AlertCount),
			})
		}
	}

	writer.Flush()
	return builder.String(), nil
}

// exportAsMarkdown 导出为 Markdown 格式
func (e *Exporter) exportAsMarkdown(data *ReportData) (string, error) {
	var builder strings.Builder

	// 标题
	builder.WriteString("# 数据库连接池诊断报告\n\n")
	builder.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", data.GeneratedAt.Format("2006-01-02 15:04:05")))

	// 摘要统计
	builder.WriteString("## 摘要\n\n")
	builder.WriteString(fmt.Sprintf("- **总告警数**: %d\n", data.Analysis.Summary.TotalAlerts))
	builder.WriteString(fmt.Sprintf("- **严重告警**: %d ⚠️\n", data.Analysis.Summary.CriticalAlerts))
	builder.WriteString(fmt.Sprintf("- **高危告警**: %d ⚠️\n", data.Analysis.Summary.HighAlerts))
	builder.WriteString(fmt.Sprintf("- **中危告警**: %d\n", data.Analysis.Summary.MediumAlerts))
	builder.WriteString(fmt.Sprintf("- **低危告警**: %d\n", data.Analysis.Summary.LowAlerts))
	builder.WriteString(fmt.Sprintf("- **活跃连接数**: %d\n", len(data.ActiveLeases)))
	builder.WriteString(fmt.Sprintf("- **等待请求数**: %d\n\n", len(data.WaitingItems)))

	// 连接池配置
	builder.WriteString("## 连接池配置\n\n")
	builder.WriteString("| 配置项 | 当前值 |\n")
	builder.WriteString("|--------|--------|\n")
	builder.WriteString(fmt.Sprintf("| 名称 | %s |\n", data.Pool.Name))
	builder.WriteString(fmt.Sprintf("| 最大连接数 (max_open) | %d |\n", data.Pool.MaxOpen))
	builder.WriteString(fmt.Sprintf("| 最大空闲连接数 (max_idle) | %d |\n", data.Pool.MaxIdle))
	builder.WriteString(fmt.Sprintf("| 空闲超时 (idle_timeout) | %s |\n", data.Pool.IdleTimeout))
	builder.WriteString(fmt.Sprintf("| 租户配额 (tenant_quota) | %d |\n\n", data.Pool.TenantQuota))

	// 告警详情
	if len(data.Analysis.Alerts) > 0 {
		builder.WriteString("## 告警详情\n\n")

		// 按严重程度分组
		sort.Slice(data.Analysis.Alerts, func(i, j int) bool {
			severityOrder := map[models.AlertSeverity]int{
				models.AlertSeverityCritical: 0,
				models.AlertSeverityHigh:     1,
				models.AlertSeverityMedium:   2,
				models.AlertSeverityLow:      3,
			}
			return severityOrder[data.Analysis.Alerts[i].Severity] < severityOrder[data.Analysis.Alerts[j].Severity]
		})

		for i, alert := range data.Analysis.Alerts {
			severityEmoji := map[models.AlertSeverity]string{
				models.AlertSeverityCritical: "🔴",
				models.AlertSeverityHigh:     "🟠",
				models.AlertSeverityMedium:   "🟡",
				models.AlertSeverityLow:      "🟢",
			}[alert.Severity]

			builder.WriteString(fmt.Sprintf("### %d. %s %s\n\n", i+1, severityEmoji, alert.Title))
			builder.WriteString(fmt.Sprintf("- **类型**: `%s`\n", alert.Type))
			builder.WriteString(fmt.Sprintf("- **严重程度**: `%s`\n", alert.Severity))
			builder.WriteString(fmt.Sprintf("- **置信分数**: %.1f\n\n", alert.Score))

			builder.WriteString("**描述**:\n")
			builder.WriteString(fmt.Sprintf("> %s\n\n", alert.Description))

			builder.WriteString("**可能原因**:\n")
			builder.WriteString(fmt.Sprintf("> %s\n\n", alert.RootCause))

			builder.WriteString("**建议**:\n")
			builder.WriteString(fmt.Sprintf("> %s\n\n", alert.Recommendation))

			// 关联信息
			var relatedInfo []string
			if alert.ConnectionID != nil {
				relatedInfo = append(relatedInfo, fmt.Sprintf("连接ID: `%s`", *alert.ConnectionID))
			}
			if alert.RequestID != nil {
				relatedInfo = append(relatedInfo, fmt.Sprintf("请求ID: `%s`", *alert.RequestID))
			}
			if alert.TenantID != nil {
				relatedInfo = append(relatedInfo, fmt.Sprintf("租户ID: `%s`", *alert.TenantID))
			}
			if alert.TransactionID != nil {
				relatedInfo = append(relatedInfo, fmt.Sprintf("事务ID: `%s`", *alert.TransactionID))
			}
			if alert.QueryID != nil {
				relatedInfo = append(relatedInfo, fmt.Sprintf("查询ID: `%s`", *alert.QueryID))
			}

			if len(relatedInfo) > 0 {
				builder.WriteString("**关联信息**:\n")
				builder.WriteString("- " + strings.Join(relatedInfo, "\n- ") + "\n\n")
			}

			// 状态
			builder.WriteString(fmt.Sprintf("- **状态**: `%s`\n", alert.Status))
			if alert.IsFalsePositive {
				builder.WriteString("- **误报**: 是\n")
			}
			builder.WriteString("\n")
		}
	}

	// 活跃连接
	if len(data.ActiveLeases) > 0 {
		builder.WriteString("## 活跃连接列表\n\n")
		builder.WriteString("| 连接ID | 请求ID | 租户ID | 借出时间 | 状态 | 等待耗时 | SQL数量 |\n")
		builder.WriteString("|--------|--------|--------|----------|------|----------|---------|\n")
		for _, lease := range data.ActiveLeases {
			builder.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s | %d |\n",
				lease.ConnectionID,
				lease.RequestID,
				lease.TenantID,
				lease.BorrowedAt.Format("15:04:05"),
				lease.Status,
				lease.WaitDuration,
				lease.SQLCount,
			))
		}
		builder.WriteString("\n")
	}

	// 等待队列
	if len(data.WaitingItems) > 0 {
		builder.WriteString("## 等待队列\n\n")
		builder.WriteString("| 请求ID | 租户ID | 入队时间 | 已等待 | 超时时间 | 状态 |\n")
		builder.WriteString("|--------|--------|----------|--------|----------|------|\n")
		for _, item := range data.WaitingItems {
			waitTime := time.Since(item.EnqueuedAt)
			builder.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s |\n",
				item.RequestID,
				item.TenantID,
				item.EnqueuedAt.Format("15:04:05"),
				waitTime.Round(time.Second),
				item.Timeout,
				item.Status,
			))
		}
		builder.WriteString("\n")
	}

	// 租户统计
	if len(data.Tenants) > 0 {
		builder.WriteString("## 租户统计\n\n")
		builder.WriteString("| 租户ID | 名称 | 配额 | 当前连接 | 总借出 | 平均等待 | 告警数 |\n")
		builder.WriteString("|--------|------|------|----------|--------|----------|--------|\n")
		for _, tenant := range data.Tenants {
			builder.WriteString(fmt.Sprintf("| %s | %s | %d | %d | %d | %s | %d |\n",
				tenant.ID,
				tenant.Name,
				tenant.Quota,
				tenant.CurrentConnections,
				tenant.TotalBorrows,
				tenant.AvgWaitTime,
				tenant.AlertCount,
			))
		}
		builder.WriteString("\n")
	}

	// 建议总结
	builder.WriteString("## 建议总结\n\n")
	if data.Analysis.Summary.CriticalAlerts > 0 {
		builder.WriteString("### 🔴 紧急处理\n\n")
		builder.WriteString("- 立即处理所有严重告警\n")
		builder.WriteString("- 检查是否有连接泄漏或长事务\n")
		builder.WriteString("- 考虑临时扩容连接池\n\n")
	}

	if data.Analysis.Summary.HighAlerts > 0 {
		builder.WriteString("### 🟠 重要处理\n\n")
		builder.WriteString("- 分析慢 SQL 并优化\n")
		builder.WriteString("- 检查等待队列情况\n")
		builder.WriteString("- 验证连接池配置合理性\n\n")
	}

	if data.Analysis.Summary.TotalAlerts == 0 {
		builder.WriteString("### 🟢 系统健康\n\n")
		builder.WriteString("当前连接池状态良好，没有发现异常告警。\n\n")
	}

	// 页脚
	builder.WriteString("---\n\n")
	builder.WriteString(fmt.Sprintf("*报告由 Pool Diagnostic Service 生成于 %s*\n", data.GeneratedAt.Format(time.RFC3339)))

	return builder.String(), nil
}
