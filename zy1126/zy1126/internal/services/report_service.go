package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
	"sort"
	"strings"
	"text/template"
	"time"
)

type ReportService struct {
	repo               *repository.Repository
	comparisonService  *ComparisonService
	attributionService *AttributionService
}

func NewReportService(repo *repository.Repository, comparisonService *ComparisonService, attributionService *AttributionService) *ReportService {
	return &ReportService{
		repo:               repo,
		comparisonService:  comparisonService,
		attributionService: attributionService,
	}
}

func (s *ReportService) ExportReport(ctx context.Context, runID uint, format string) (*models.Report, error) {
	// 获取运行数据
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("run not found: %w", err)
	}

	// 获取比较数据
	comparisons, err := s.repo.GetRunComparisonsByRunID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comparisons: %w", err)
	}

	// 获取归因分析数据
	attributions, err := s.repo.GetSlowPathAttributionsByRunID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get attributions: %w", err)
	}

	// 获取项目数据
	project, err := s.repo.GetProjectByID(ctx, run.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get project: %w", err)
	}

	// 生成报告内容
	var content string
	switch strings.ToLower(format) {
	case "json":
		content, err = s.generateJSONReport(run, comparisons, attributions, project)
	case "csv":
		content, err = s.generateCSVReport(run, comparisons, attributions, project)
	case "markdown", "md":
		content, err = s.generateMarkdownReport(run, comparisons, attributions, project)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to generate report: %w", err)
	}

	// 创建报告记录
	report := &models.Report{
		RunID:   runID,
		Format:  strings.ToLower(format),
		Content: content,
	}

	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to save report: %w", err)
	}

	return report, nil
}

func (s *ReportService) generateJSONReport(run *models.Run, comparisons []models.RunComparison, attributions []models.SlowPathAttribution, project *models.Project) (string, error) {
	reportData := map[string]interface{}{
		"report_generated_at": time.Now().Format(time.RFC3339),
		"project": map[string]interface{}{
			"id":          project.ID,
			"name":        project.Name,
			"description": project.Description,
		},
		"run": map[string]interface{}{
			"id":          run.ID,
			"name":        run.Name,
			"description": run.Description,
			"status":      run.Status,
			"config":      run.Config,
			"metrics":     run.Metrics,
			"created_at":  run.CreatedAt,
			"started_at":  run.StartedAt,
			"ended_at":    run.EndedAt,
		},
		"comparisons": comparisons,
		"attributions": map[string]interface{}{
			"total_issues": len(attributions),
			"issues":       attributions,
			"top_priorities": s.getTopPriorities(attributions, 5),
		},
		"summary": s.generateSummary(run, comparisons, attributions),
	}

	jsonData, err := json.MarshalIndent(reportData, "", "  ")
	if err != nil {
		return "", err
	}

	return string(jsonData), nil
}

func (s *ReportService) generateCSVReport(run *models.Run, comparisons []models.RunComparison, attributions []models.SlowPathAttribution, project *models.Project) (string, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// 写入项目信息
	writer.Write([]string{"Project Info"})
	writer.Write([]string{"Project ID", fmt.Sprintf("%d", project.ID)})
	writer.Write([]string{"Project Name", project.Name})
	writer.Write([]string{"Project Description", project.Description})
	writer.Write([]string{})

	// 写入运行信息
	writer.Write([]string{"Run Info"})
	writer.Write([]string{"Run ID", fmt.Sprintf("%d", run.ID)})
	writer.Write([]string{"Run Name", run.Name})
	writer.Write([]string{"Status", run.Status})
	writer.Write([]string{})

	// 写入运行配置
	writer.Write([]string{"Run Configuration"})
	writer.Write([]string{"Concurrency", fmt.Sprintf("%d", run.Config.Concurrency)})
	writer.Write([]string{"Target RPS", fmt.Sprintf("%.2f", run.Config.TargetRPS)})
	writer.Write([]string{"Timeout (ms)", fmt.Sprintf("%d", run.Config.TimeoutMs)})
	writer.Write([]string{"Duration (seconds)", fmt.Sprintf("%d", run.Config.DurationSeconds)})
	writer.Write([]string{"Total Requests", fmt.Sprintf("%d", run.Config.TotalRequests)})
	writer.Write([]string{"Use Weighted", fmt.Sprintf("%t", run.Config.UseWeighted)})
	writer.Write([]string{})

	// 写入性能指标
	writer.Write([]string{"Performance Metrics"})
	writer.Write([]string{"Total Requests", fmt.Sprintf("%d", run.Metrics.TotalRequests)})
	writer.Write([]string{"Successful Requests", fmt.Sprintf("%d", run.Metrics.SuccessfulRequests)})
	writer.Write([]string{"Failed Requests", fmt.Sprintf("%d", run.Metrics.FailedRequests)})
	writer.Write([]string{"Timeout Requests", fmt.Sprintf("%d", run.Metrics.TimeoutRequests)})
	writer.Write([]string{"Throughput (req/s)", fmt.Sprintf("%.2f", run.Metrics.Throughput)})
	writer.Write([]string{"P50 Latency (ms)", fmt.Sprintf("%.2f", run.Metrics.P50Ms)})
	writer.Write([]string{"P95 Latency (ms)", fmt.Sprintf("%.2f", run.Metrics.P95Ms)})
	writer.Write([]string{"P99 Latency (ms)", fmt.Sprintf("%.2f", run.Metrics.P99Ms)})
	writer.Write([]string{"Error Rate", fmt.Sprintf("%.2f%%", run.Metrics.ErrorRate*100)})
	writer.Write([]string{"Timeout Rate", fmt.Sprintf("%.2f%%", run.Metrics.TimeoutRate*100)})
	writer.Write([]string{"Avg Response Size (bytes)", fmt.Sprintf("%d", run.Metrics.AvgResponseSize)})
	writer.Write([]string{})

	// 写入对比信息
	if len(comparisons) > 0 {
		writer.Write([]string{"Baseline Comparison"})
		writer.Write([]string{"Comparison ID", "Baseline ID", "P95 Diff (ms)", "P95 Diff (%)", "Throughput Diff", "Has Regression"})
		for _, comp := range comparisons {
			writer.Write([]string{
				fmt.Sprintf("%d", comp.ID),
				fmt.Sprintf("%d", comp.BaselineID),
				fmt.Sprintf("%.2f", comp.MetricsComparison.P95DiffMs),
				fmt.Sprintf("%.2f%%", comp.MetricsComparison.P95DiffPercent),
				fmt.Sprintf("%.2f", comp.MetricsComparison.ThroughputDiff),
				fmt.Sprintf("%t", comp.MetricsComparison.HasRegression),
			})
		}
		writer.Write([]string{})
	}

	// 写入归因分析
	if len(attributions) > 0 {
		writer.Write([]string{"Slow Path Attributions"})
		writer.Write([]string{"Priority", "Category", "Severity", "Description", "Impact Score", "Recommendation"})
		for _, attr := range attributions {
			writer.Write([]string{
				fmt.Sprintf("%d", attr.Priority),
				attr.Category,
				attr.Severity,
				attr.Description,
				fmt.Sprintf("%.2f", attr.ImpactScore),
				attr.Recommendation,
			})
		}
	}

	writer.Flush()
	return buf.String(), nil
}

func (s *ReportService) generateMarkdownReport(run *models.Run, comparisons []models.RunComparison, attributions []models.SlowPathAttribution, project *models.Project) (string, error) {
	const markdownTemplate = `# 性能测试报告

**生成时间**: {{.GeneratedAt}}

---

## 1. 项目信息

| 字段 | 值 |
|------|-----|
| 项目 ID | {{.Project.ID}} |
| 项目名称 | {{.Project.Name}} |
| 项目描述 | {{.Project.Description}} |

---

## 2. 运行信息

| 字段 | 值 |
|------|-----|
| 运行 ID | {{.Run.ID}} |
| 运行名称 | {{.Run.Name}} |
| 运行描述 | {{.Run.Description}} |
| 状态 | {{.Run.Status}} |
| 创建时间 | {{.Run.CreatedAt}} |
| 开始时间 | {{.Run.StartedAt}} |
| 结束时间 | {{.Run.EndedAt}} |

---

## 3. 运行配置

| 字段 | 值 |
|------|-----|
| 并发数 | {{.Run.Config.Concurrency}} |
| 目标 RPS | {{.Run.Config.TargetRPS}} |
| 超时时间 (ms) | {{.Run.Config.TimeoutMs}} |
| 持续时间 (秒) | {{.Run.Config.DurationSeconds}} |
| 总请求数 | {{.Run.Config.TotalRequests}} |
| 使用权重 | {{.Run.Config.UseWeighted}} |

---

## 4. 性能指标

### 4.1 整体指标

| 指标 | 值 |
|------|-----|
| 总请求数 | {{.Run.Metrics.TotalRequests}} |
| 成功请求数 | {{.Run.Metrics.SuccessfulRequests}} |
| 失败请求数 | {{.Run.Metrics.FailedRequests}} |
| 超时请求数 | {{.Run.Metrics.TimeoutRequests}} |
| 吞吐率 (req/s) | {{.Run.Metrics.Throughput}} |
| 平均响应大小 (bytes) | {{.Run.Metrics.AvgResponseSize}} |

### 4.2 延迟指标

| 百分位 | 延迟 (ms) |
|--------|-----------|
| P50 | {{.Run.Metrics.P50Ms}} |
| P95 | {{.Run.Metrics.P95Ms}} |
| P99 | {{.Run.Metrics.P99Ms}} |

### 4.3 错误指标

| 指标 | 值 |
|------|-----|
| 错误率 | {{.ErrorRatePercent}}% |
| 超时率 | {{.TimeoutRatePercent}}% |

---

## 5. 基线对比

{{if .HasComparisons}}
### 5.1 对比摘要

**存在性能回退**: {{.HasRegression}}

### 5.2 详细对比

| 对比项 | 差异值 | 差异百分比 |
|--------|--------|------------|
{{range .Comparisons}}
| P50 延迟 | {{.MetricsComparison.P50DiffMs}} ms | {{.MetricsComparison.P50DiffPercent}}% |
| P95 延迟 | {{.MetricsComparison.P95DiffMs}} ms | {{.MetricsComparison.P95DiffPercent}}% |
| P99 延迟 | {{.MetricsComparison.P99DiffMs}} ms | {{.MetricsComparison.P99DiffPercent}}% |
| 吞吐率 | {{.MetricsComparison.ThroughputDiff}} | {{.MetricsComparison.ThroughputDiffPercent}}% |
| 错误率差异 | {{.MetricsComparison.ErrorRateDiff}} | - |
| 超时率差异 | {{.MetricsComparison.TimeoutRateDiff}} | - |
{{end}}
{{else}}
*暂无基线对比数据*
{{end}}

---

## 6. 慢路径归因分析

{{if .HasAttributions}}
### 6.1 问题摘要

- **总问题数**: {{.TotalIssues}}
- **关键问题**: {{.CriticalIssues}}
- **高优先级问题**: {{.HighIssues}}
- **中优先级问题**: {{.MediumIssues}}
- **低优先级问题**: {{.LowIssues}}

### 6.2 详细分析

{{range .Attributions}}
#### 优先级 {{.Priority}}: {{.Category}}

| 字段 | 值 |
|------|-----|
| 严重程度 | {{.Severity}} |
| 影响分数 | {{.ImpactScore}} |

**描述**: {{.Description}}

**建议**: {{.Recommendation}}

**统计数据**:
- 总耗时: {{.Metrics.TotalTimeMs}} ms
- 占比: {{.Metrics.PercentageOfTotal}}%
- 数量: {{.Metrics.Count}}
- 平均耗时: {{.Metrics.AvgTimeMs}} ms
- 最大耗时: {{.Metrics.MaxTimeMs}} ms

---
{{end}}
{{else}}
*暂无慢路径归因分析数据*
{{end}}

---

## 7. 建议和行动项

### 7.1 优先处理

{{if .TopPriorities}}
{{range .TopPriorities}}
1. **[{{.Severity}}] {{.Category}}**: {{.Description}}
   - 建议: {{.Recommendation}}
{{end}}
{{else}}
*无高优先级问题*
{{end}}

### 7.2 监控建议

- 持续监控 P95 和 P99 延迟指标
- 关注错误率和超时率的变化趋势
- 定期进行基线对比，及时发现性能回退

---

*报告由 Performance Tracker 自动生成*
`

	// 准备模板数据
	type templateData struct {
		GeneratedAt         string
		Project             *models.Project
		Run                 *models.Run
		Comparisons         []models.RunComparison
		Attributions        []models.SlowPathAttribution
		HasComparisons      bool
		HasAttributions     bool
		HasRegression       bool
		TotalIssues         int
		CriticalIssues      int
		HighIssues          int
		MediumIssues        int
		LowIssues           int
		TopPriorities       []models.SlowPathAttribution
		ErrorRatePercent    float64
		TimeoutRatePercent  float64
	}

	data := templateData{
		GeneratedAt:     time.Now().Format(time.RFC3339),
		Project:         project,
		Run:             run,
		Comparisons:     comparisons,
		Attributions:    attributions,
		HasComparisons:  len(comparisons) > 0,
		HasAttributions: len(attributions) > 0,
		TotalIssues:     len(attributions),
		TopPriorities:   s.getTopPriorities(attributions, 3),
		ErrorRatePercent:   run.Metrics.ErrorRate * 100,
		TimeoutRatePercent: run.Metrics.TimeoutRate * 100,
	}

	// 统计严重程度
	for _, attr := range attributions {
		switch attr.Severity {
		case models.SeverityCritical:
			data.CriticalIssues++
		case models.SeverityHigh:
			data.HighIssues++
		case models.SeverityMedium:
			data.MediumIssues++
		case models.SeverityLow:
			data.LowIssues++
		}
	}

	// 检查是否有性能回退
	for _, comp := range comparisons {
		if comp.MetricsComparison.HasRegression {
			data.HasRegression = true
			break
		}
	}

	// 解析模板
	tmpl, err := template.New("markdown-report").Parse(markdownTemplate)
	if err != nil {
		return "", err
	}

	// 执行模板
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (s *ReportService) getTopPriorities(attributions []models.SlowPathAttribution, limit int) []models.SlowPathAttribution {
	if len(attributions) == 0 {
		return []models.SlowPathAttribution{}
	}

	// 按优先级排序
	sorted := make([]models.SlowPathAttribution, len(attributions))
	copy(sorted, attributions)

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Priority < sorted[j].Priority
	})

	// 返回前 N 个
	if len(sorted) > limit {
		return sorted[:limit]
	}
	return sorted
}

func (s *ReportService) generateSummary(run *models.Run, comparisons []models.RunComparison, attributions []models.SlowPathAttribution) map[string]interface{} {
	summary := map[string]interface{}{
		"overall_status": "unknown",
		"key_findings":   []string{},
		"recommendations": []string{},
	}

	// 检查整体状态
	if run.Metrics.ErrorRate > 0.1 || run.Metrics.TimeoutRate > 0.05 || run.Metrics.P95Ms > 500 {
		summary["overall_status"] = "critical"
	} else if run.Metrics.ErrorRate > 0.05 || run.Metrics.TimeoutRate > 0.02 || run.Metrics.P95Ms > 300 {
		summary["overall_status"] = "warning"
	} else {
		summary["overall_status"] = "good"
	}

	// 收集关键发现
	findings := []string{}

	if run.Metrics.P95Ms > 500 {
		findings = append(findings, fmt.Sprintf("P95 延迟过高 (%.2fms)", run.Metrics.P95Ms))
	}

	if run.Metrics.ErrorRate > 0.1 {
		findings = append(findings, fmt.Sprintf("错误率过高 (%.2f%%)", run.Metrics.ErrorRate*100))
	}

	if run.Metrics.TimeoutRate > 0.05 {
		findings = append(findings, fmt.Sprintf("超时率过高 (%.2f%%)", run.Metrics.TimeoutRate*100))
	}

	// 检查基线对比
	for _, comp := range comparisons {
		if comp.MetricsComparison.HasRegression {
			findings = append(findings, "检测到性能回退")
			break
		}
	}

	// 检查归因分析
	for _, attr := range attributions {
		if attr.Severity == models.SeverityCritical || attr.Severity == models.SeverityHigh {
			findings = append(findings, attr.Description)
		}
	}

	summary["key_findings"] = findings

	// 收集建议
	recommendations := []string{}
	for _, attr := range attributions {
		if attr.Priority <= 3 {
			recommendations = append(recommendations, attr.Recommendation)
		}
	}

	summary["recommendations"] = recommendations

	return summary
}

func (s *ReportService) GetReportByID(ctx context.Context, id uint) (*models.Report, error) {
	return s.repo.GetReportByID(ctx, id)
}

func (s *ReportService) GetReportsByRunID(ctx context.Context, runID uint) ([]models.Report, error) {
	return s.repo.GetReportsByRunID(ctx, runID)
}
