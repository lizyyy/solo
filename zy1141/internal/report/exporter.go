package report

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"msctl/internal/analyzer"
	"msctl/internal/models"
	"msctl/internal/plan"
	"msctl/pkg/utils"
)

type Exporter struct {
}

func NewExporter() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportAnalysis(analysis *models.AnalysisResult, format, outputPath string) error {
	switch format {
	case "json":
		return e.exportAnalysisJSON(analysis, outputPath)
	case "csv":
		return e.exportAnalysisCSV(analysis, outputPath)
	case "md", "markdown":
		return e.exportAnalysisMarkdown(analysis, outputPath)
	default:
		return fmt.Errorf("不支持的输出格式: %s", format)
	}
}

func (e *Exporter) ExportPlan(planResult *models.PlanResult, format, outputPath string) error {
	switch format {
	case "json":
		return e.exportPlanJSON(planResult, outputPath)
	case "csv":
		return e.exportPlanCSV(planResult, outputPath)
	case "md", "markdown":
		return e.exportPlanMarkdown(planResult, outputPath)
	default:
		return fmt.Errorf("不支持的输出格式: %s", format)
	}
}

func (e *Exporter) exportAnalysisJSON(analysis *models.AnalysisResult, outputPath string) error {
	return utils.WriteJSON(outputPath, analysis, true)
}

func (e *Exporter) exportPlanJSON(planResult *models.PlanResult, outputPath string) error {
	return utils.WriteJSON(outputPath, planResult, true)
}

func (e *Exporter) exportAnalysisCSV(analysis *models.AnalysisResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"类型", "问题 ID", "严重程度", "服务", "端点", "消息", "证据", "建议"}); err != nil {
		return err
	}

	sortedIssues := analyzer.SortIssuesBySeverity(analysis.Issues)
	for _, issue := range sortedIssues {
		row := []string{
			analyzer.GetIssueTypeLabel(issue.Type),
			issue.ID,
			string(issue.Severity),
			issue.ServiceName,
			issue.Endpoint,
			issue.Message,
			issue.Evidence,
			issue.Recommendation,
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	if err := writer.Write([]string{}); err != nil {
		return err
	}

	if err := writer.Write([]string{"统计摘要"}); err != nil {
		return err
	}
	summary := analysis.Summary
	stats := [][]string{
		{"总服务数", fmt.Sprintf("%d", summary.TotalServices)},
		{"总端点", fmt.Sprintf("%d", summary.TotalEndpoints)},
		{"总调用边", fmt.Sprintf("%d", summary.TotalCallEdges)},
		{"严重问题 (CRITICAL)", fmt.Sprintf("%d", summary.CriticalCount)},
		{"高危问题 (HIGH)", fmt.Sprintf("%d", summary.HighCount)},
		{"中危问题 (MEDIUM)", fmt.Sprintf("%d", summary.MediumCount)},
		{"低危问题 (LOW)", fmt.Sprintf("%d", summary.LowCount)},
		{"是否通过", fmt.Sprintf("%v", summary.Passed)},
	}
	for _, stat := range stats {
		if err := writer.Write(stat); err != nil {
			return err
		}
	}

	return nil
}

func (e *Exporter) exportPlanCSV(planResult *models.PlanResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"发布计划分析报告", planResult.Title}); err != nil {
		return err
	}
	if err := writer.Write([]string{"分析时间", planResult.Date}); err != nil {
		return err
	}
	if err := writer.Write([]string{"准入结论", string(planResult.Admission)}); err != nil {
		return err
	}
	if err := writer.Write([]string{"准入原因", planResult.AdmissionReason}); err != nil {
		return err
	}
	if err := writer.Write([]string{}); err != nil {
		return err
	}

	if len(planResult.BlockingIssues) > 0 {
		if err := writer.Write([]string{"阻断问题"}); err != nil {
			return err
		}
		if err := writer.Write([]string{"ID", "类型", "严重程度", "服务", "描述", "证据", "解决方案"}); err != nil {
			return err
		}
		for _, issue := range planResult.BlockingIssues {
			row := []string{
				issue.ID,
				issue.IssueType,
				string(issue.Severity),
				strings.Join(issue.Services, "; "),
				issue.Description,
				issue.Evidence,
				issue.Resolution,
			}
			if err := writer.Write(row); err != nil {
				return err
			}
		}
		if err := writer.Write([]string{}); err != nil {
			return err
		}
	}

	if len(planResult.Warnings) > 0 {
		if err := writer.Write([]string{"警告事项"}); err != nil {
			return err
		}
		if err := writer.Write([]string{"ID", "类型", "严重程度", "服务", "描述", "证据", "建议"}); err != nil {
			return err
		}
		for _, warn := range planResult.Warnings {
			row := []string{
				warn.ID,
				warn.IssueType,
				string(warn.Severity),
				strings.Join(warn.Services, "; "),
				warn.Description,
				warn.Evidence,
				warn.Recommendation,
			}
			if err := writer.Write(row); err != nil {
				return err
			}
		}
		if err := writer.Write([]string{}); err != nil {
			return err
		}
	}

	if len(planResult.RecommendedOrder) > 0 {
		if err := writer.Write([]string{"建议发布顺序"}); err != nil {
			return err
		}
		if err := writer.Write([]string{"新顺序", "原批次名", "原顺序", "服务列表", "说明"}); err != nil {
			return err
		}
		for _, batch := range planResult.RecommendedOrder {
			row := []string{
				fmt.Sprintf("%d", batch.NewOrder),
				batch.OriginalName,
				fmt.Sprintf("%d", batch.OriginalOrder),
				strings.Join(batch.Services, "; "),
				batch.Reason,
			}
			if err := writer.Write(row); err != nil {
				return err
			}
		}
	}

	return nil
}

func (e *Exporter) exportAnalysisMarkdown(analysis *models.AnalysisResult, outputPath string) error {
	var sb strings.Builder

	now := time.Now().Format("2006-01-02 15:04:05")
	sb.WriteString("# 微服务治理分析报告\n\n")
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", now))

	summary := analysis.Summary
	sb.WriteString("## 摘要\n\n")

	statusEmoji := "✅"
	if !summary.Passed {
		statusEmoji = "❌"
	}
	sb.WriteString(fmt.Sprintf("- **总体状态**: %s %s\n", statusEmoji, getPassStatus(summary.Passed)))
	sb.WriteString(fmt.Sprintf("- **服务总数**: %d\n", summary.TotalServices))
	sb.WriteString(fmt.Sprintf("- **端点总数**: %d\n", summary.TotalEndpoints))
	sb.WriteString(fmt.Sprintf("- **调用关系总数**: %d\n", summary.TotalCallEdges))
	sb.WriteString("\n")

	sb.WriteString("### 问题统计\n\n")
	sb.WriteString("| 严重程度 | 数量 |\n")
	sb.WriteString("|----------|------|\n")
	sb.WriteString(fmt.Sprintf("| 🔴 CRITICAL | %d |\n", summary.CriticalCount))
	sb.WriteString(fmt.Sprintf("| 🟠 HIGH | %d |\n", summary.HighCount))
	sb.WriteString(fmt.Sprintf("| 🟡 MEDIUM | %d |\n", summary.MediumCount))
	sb.WriteString(fmt.Sprintf("| 🟢 LOW | %d |\n", summary.LowCount))
	sb.WriteString("\n")

	if len(analysis.Issues) > 0 {
		sb.WriteString("## 问题详情\n\n")

		sortedIssues := analyzer.SortIssuesBySeverity(analysis.Issues)

		for _, issue := range sortedIssues {
			sb.WriteString(fmt.Sprintf("### %s %s: %s\n\n",
				analyzer.GetSeverityColor(issue.Severity),
				analyzer.GetIssueTypeLabel(issue.Type),
				issue.ID))

			if issue.ServiceName != "" {
				sb.WriteString(fmt.Sprintf("- **服务**: %s\n", issue.ServiceName))
			}
			if issue.Endpoint != "" {
				sb.WriteString(fmt.Sprintf("- **端点**: %s\n", issue.Endpoint))
			}
			sb.WriteString(fmt.Sprintf("- **消息**: %s\n\n", issue.Message))

			sb.WriteString("**证据**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", issue.Evidence))

			sb.WriteString("**建议**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", issue.Recommendation))
			sb.WriteString("---\n\n")
		}
	}

	if len(analysis.ServiceGraph.Cycles) > 0 {
		sb.WriteString("## 依赖环详情\n\n")
		for i, cycle := range analysis.ServiceGraph.Cycles {
			sb.WriteString(fmt.Sprintf("### 环 %d\n\n", i+1))
			sb.WriteString("```\n")
			sb.WriteString(strings.Join(cycle, " → "))
			sb.WriteString("\n```\n\n")
		}
	}

	sb.WriteString("## 建议行动\n\n")
	recommendations := e.generateRecommendations(analysis)
	for i, rec := range recommendations {
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, rec))
	}
	sb.WriteString("\n")

	return os.WriteFile(outputPath, []byte(sb.String()), 0644)
}

func (e *Exporter) exportPlanMarkdown(planResult *models.PlanResult, outputPath string) error {
	var sb strings.Builder

	now := time.Now().Format("2006-01-02 15:04:05")
	sb.WriteString("# 发布计划分析报告\n\n")
	sb.WriteString(fmt.Sprintf("**计划名称**: %s\n\n", planResult.Title))
	sb.WriteString(fmt.Sprintf("**分析时间**: %s\n\n", now))

	sb.WriteString("## 准入结论\n\n")
	sb.WriteString(fmt.Sprintf("### %s\n\n", plan.GetAdmissionStatusLabel(planResult.Admission)))
	sb.WriteString(fmt.Sprintf("> %s\n\n", planResult.AdmissionReason))

	if len(planResult.BlockingIssues) > 0 {
		sb.WriteString("## 阻断问题 (必须解决)\n\n")
		for _, issue := range planResult.BlockingIssues {
			sb.WriteString(fmt.Sprintf("### 🔴 %s: %s\n\n", string(issue.Severity), issue.ID))
			sb.WriteString(fmt.Sprintf("- **类型**: %s\n", issue.IssueType))
			if len(issue.Services) > 0 {
				sb.WriteString(fmt.Sprintf("- **涉及服务**: %s\n", strings.Join(issue.Services, ", ")))
			}
			sb.WriteString(fmt.Sprintf("- **描述**: %s\n\n", issue.Description))

			sb.WriteString("**证据**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", issue.Evidence))

			sb.WriteString("**解决方案**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", issue.Resolution))
			sb.WriteString("---\n\n")
		}
	}

	if len(planResult.Warnings) > 0 {
		sb.WriteString("## 警告事项 (建议关注)\n\n")
		for _, warn := range planResult.Warnings {
			sb.WriteString(fmt.Sprintf("### %s %s: %s\n\n",
				analyzer.GetSeverityColor(warn.Severity),
				warn.IssueType,
				warn.ID))
			if len(warn.Services) > 0 {
				sb.WriteString(fmt.Sprintf("- **涉及服务**: %s\n", strings.Join(warn.Services, ", ")))
			}
			sb.WriteString(fmt.Sprintf("- **描述**: %s\n\n", warn.Description))

			sb.WriteString("**证据**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", warn.Evidence))

			sb.WriteString("**建议**:\n")
			sb.WriteString(fmt.Sprintf("> %s\n\n", warn.Recommendation))
			sb.WriteString("---\n\n")
		}
	}

	if len(planResult.RecommendedOrder) > 0 {
		sb.WriteString("## 建议发布顺序\n\n")
		sb.WriteString("| 顺序 | 批次 | 服务 | 说明 |\n")
		sb.WriteString("|------|------|------|------|\n")
		for _, batch := range planResult.RecommendedOrder {
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %s |\n",
				batch.NewOrder,
				batch.OriginalName,
				strings.Join(batch.Services, ", "),
				batch.Reason))
		}
		sb.WriteString("\n")
	}

	if len(planResult.AffectedServices) > 0 {
		sb.WriteString("## 受影响服务\n\n")
		sb.WriteString("| 服务 | 批次 | 风险等级 | 直接调用方 | 直接依赖 |\n")
		sb.WriteString("|------|------|----------|------------|----------|\n")
		for _, svc := range planResult.AffectedServices {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n",
				svc.Name,
				svc.DeployBatch,
				svc.RiskLevel,
				joinOrNone(svc.DirectCallers),
				joinOrNone(svc.DirectCallees)))
		}
		sb.WriteString("\n")
	}

	if planResult.RollbackImpact.TotalAffectedServices > 0 {
		sb.WriteString("## 回滚影响分析\n\n")
		sb.WriteString(fmt.Sprintf("- **受影响服务总数**: %d\n", planResult.RollbackImpact.TotalAffectedServices))
		sb.WriteString(fmt.Sprintf("- **预估停机时间**: %s\n\n", planResult.RollbackImpact.EstimatedDowntime))

		sb.WriteString("### 建议回滚顺序\n\n")
		sb.WriteString("```\n")
		for i, svc := range planResult.RollbackImpact.RollbackOrder {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, svc))
		}
		sb.WriteString("```\n\n")

		sb.WriteString("### 服务影响详情\n\n")
		for svcName, impact := range planResult.RollbackImpact.ServiceImpacts {
			impactEmoji := "🟢"
			if impact.ImpactLevel == "高" {
				impactEmoji = "🔴"
			} else if impact.ImpactLevel == "中" {
				impactEmoji = "🟡"
			}
			sb.WriteString(fmt.Sprintf("- %s **%s**: 影响等级=%s, 直接依赖=%s\n",
				impactEmoji, svcName, impact.ImpactLevel, joinOrNone(impact.DirectDependencies)))
		}
		sb.WriteString("\n")
	}

	return os.WriteFile(outputPath, []byte(sb.String()), 0644)
}

func (e *Exporter) generateRecommendations(analysis *models.AnalysisResult) []string {
	var recs []string

	if analysis.Summary.CriticalCount > 0 {
		recs = append(recs, "立即解决所有 CRITICAL 级别的问题")
	}
	if analysis.Summary.HighCount > 0 {
		recs = append(recs, "尽快修复所有 HIGH 级别的问题")
	}

	for _, issue := range analysis.Issues {
		if issue.Type == models.IssueDependencyCycle {
			recs = append(recs, "解耦依赖环，考虑使用事件驱动架构")
			break
		}
	}

	for _, issue := range analysis.Issues {
		if issue.Type == models.IssueUndeclaredCall {
			recs = append(recs, "核实所有未声明的调用，更新服务契约")
			break
		}
	}

	for _, issue := range analysis.Issues {
		if issue.Type == models.IssueMissingOwner {
			recs = append(recs, "为所有服务分配负责人")
			break
		}
	}

	if len(recs) == 0 {
		recs = append(recs, "所有检查通过，建议继续监控服务健康状况")
	}

	return recs
}

func getPassStatus(passed bool) string {
	if passed {
		return "通过"
	}
	return "未通过"
}

func joinOrNone(slice []string) string {
	if len(slice) == 0 {
		return "-"
	}
	return strings.Join(slice, ", ")
}

func (e *Exporter) ExportCombined(analysis *models.AnalysisResult, planResult *models.PlanResult, format, outputDir string) error {
	if err := utils.EnsureDir(outputDir); err != nil {
		return err
	}

	timestamp := time.Now().Format("20060102-150405")

	if analysis != nil {
		analysisPath := filepath.Join(outputDir, fmt.Sprintf("analysis-%s.%s", timestamp, format))
		if err := e.ExportAnalysis(analysis, format, analysisPath); err != nil {
			return err
		}
	}

	if planResult != nil {
		planPath := filepath.Join(outputDir, fmt.Sprintf("plan-%s.%s", timestamp, format))
		if err := e.ExportPlan(planResult, format, planPath); err != nil {
			return err
		}
	}

	return nil
}
