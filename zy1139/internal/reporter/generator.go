package reporter

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"capgate/internal/models"
)

type Generator struct {
	result     *models.RunResult
	comparison *models.ComparisonResult
}

func NewGenerator(result *models.RunResult, comparison *models.ComparisonResult) *Generator {
	return &Generator{
		result:     result,
		comparison: comparison,
	}
}

func (g *Generator) GenerateMarkdown() string {
	var sb strings.Builder

	sb.WriteString("# 容量闸门测试报告\n\n")

	if g.result != nil {
		sb.WriteString("## 执行摘要\n\n")
		sb.WriteString(fmt.Sprintf("- **计划名称**: %s\n", g.result.PlanName))
		sb.WriteString(fmt.Sprintf("- **执行时间**: %s\n", time.Unix(g.result.Timestamp, 0).Format("2006-01-02 15:04:05")))
		sb.WriteString(fmt.Sprintf("- **总体状态**: %s\n", g.result.OverallStatus))

		if len(g.result.AppliedScenarios) > 0 {
			sb.WriteString(fmt.Sprintf("- **应用场景**: %s\n", strings.Join(g.result.AppliedScenarios, ", ")))
		}
		sb.WriteString("\n")

		sb.WriteString("### 路由结果汇总\n\n")
		sb.WriteString("| 路由 | 状态 | P50(ms) | P95(ms) | P99(ms) | RPS | 错误率 | CPU峰值 |\n")
		sb.WriteString("|------|------|---------|---------|---------|-----|--------|---------|\n")

		for _, rr := range g.result.RouteResults {
			statusIcon := "✅"
			if rr.Status == models.StatusWarning {
				statusIcon = "⚠️"
			} else if rr.Status == models.StatusFail {
				statusIcon = "❌"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %.1f | %.1f | %.1f | %.0f | %.4f%% | %.1f%% |\n",
				rr.RouteName,
				statusIcon,
				rr.LatencyMetrics.P50Ms,
				rr.LatencyMetrics.P95Ms,
				rr.LatencyMetrics.P99Ms,
				rr.Throughput.ActualRPS,
				rr.ErrorMetrics.ErrorRate*100,
				rr.ResourceMetrics.CPUPeakPercent,
			))
		}
		sb.WriteString("\n")

		sb.WriteString("### 预算闸门检查详情\n\n")
		for _, rr := range g.result.RouteResults {
			sb.WriteString(fmt.Sprintf("#### %s\n\n", rr.RouteName))

			statusIcon := "✅"
			if rr.Status == models.StatusWarning {
				statusIcon = "⚠️"
			} else if rr.Status == models.StatusFail {
				statusIcon = "❌"
			}
			sb.WriteString(fmt.Sprintf("**状态**: %s %s\n\n", statusIcon, rr.Status))

			sb.WriteString("| 检查项 | 阈值 | 实际值 | 状态 | 风险 | 说明 |\n")
			sb.WriteString("|--------|------|--------|------|------|------|\n")

			for _, check := range rr.BudgetChecks {
				checkIcon := "✅"
				if check.Status == models.CheckWarn {
					checkIcon = "⚠️"
				} else if check.Status == models.CheckFail {
					checkIcon = "❌"
				}

				sb.WriteString(fmt.Sprintf("| %s | %.2f | %.2f | %s %s | %s | %s |\n",
					check.Name,
					check.Threshold,
					check.Actual,
					checkIcon,
					check.Status,
					check.RiskLevel,
					check.Explanation,
				))
			}
			sb.WriteString("\n")

			if len(rr.DependencyCalls) > 0 {
				sb.WriteString("**依赖调用**:\n\n")
				sb.WriteString("| 依赖 | 总调用 | QPS | 系数 |\n")
				sb.WriteString("|------|--------|-----|------|\n")
				for _, dc := range rr.DependencyCalls {
					sb.WriteString(fmt.Sprintf("| %s | %d | %.0f | %.1f |\n",
						dc.Name, dc.TotalCalls, dc.CallsPerSec, dc.Factor))
				}
				sb.WriteString("\n")
			}

			if len(rr.Recommendations) > 0 {
				sb.WriteString("**建议动作**:\n\n")
				for i, rec := range rr.Recommendations {
					riskIcon := "🟢"
					if rec.RiskLevel == models.RiskCritical {
						riskIcon = "🔴"
					} else if rec.RiskLevel == models.RiskHigh {
						riskIcon = "🟠"
					} else if rec.RiskLevel == models.RiskMedium {
						riskIcon = "🟡"
					}
					sb.WriteString(fmt.Sprintf("%d. %s **[%s]** %s\n", i+1, riskIcon, rec.Action, rec.Description))
				}
				sb.WriteString("\n")
			}
		}

		if len(g.result.DependencyMetrics) > 0 {
			sb.WriteString("### 依赖限额检查\n\n")
			sb.WriteString("| 依赖 | 总调用 | QPS | 限额QPS | 状态 |\n")
			sb.WriteString("|------|--------|-----|---------|------|\n")

			for _, dm := range g.result.DependencyMetrics {
				if dm.TotalCalls == 0 {
					continue
				}
				statusIcon := "✅"
				if dm.Status == models.StatusFail {
					statusIcon = "❌"
				}
				sb.WriteString(fmt.Sprintf("| %s | %d | %.0f | %d | %s %s |\n",
					dm.Name, dm.TotalCalls, dm.CallsPerSec, dm.MaxQPS, statusIcon, dm.Status))
			}
			sb.WriteString("\n")
		}
	}

	if g.comparison != nil {
		sb.WriteString("## 基线对比分析\n\n")

		statusIcon := "✅"
		if g.comparison.OverallStatus == models.ComparisonWarning {
			statusIcon = "⚠️"
		} else if g.comparison.OverallStatus == models.ComparisonDegraded {
			statusIcon = "❌"
		}
		sb.WriteString(fmt.Sprintf("- **对比时间**: %s\n", time.Unix(g.comparison.Timestamp, 0).Format("2006-01-02 15:04:05")))
		sb.WriteString(fmt.Sprintf("- **总体状态**: %s %s\n", statusIcon, g.comparison.OverallStatus))
		sb.WriteString(fmt.Sprintf("- **基线来源**: %s\n", g.comparison.BaselineSource))
		sb.WriteString(fmt.Sprintf("- **当前来源**: %s\n\n", g.comparison.CurrentSource))

		if len(g.comparison.DegradedRoutes) > 0 {
			sb.WriteString("### ❌ 退化接口\n\n")
			for _, r := range g.comparison.DegradedRoutes {
				sb.WriteString(fmt.Sprintf("- %s\n", r))
			}
			sb.WriteString("\n")
		}

		if len(g.comparison.ImprovedRoutes) > 0 {
			sb.WriteString("### ✅ 改进接口\n\n")
			for _, r := range g.comparison.ImprovedRoutes {
				sb.WriteString(fmt.Sprintf("- %s\n", r))
			}
			sb.WriteString("\n")
		}

		if len(g.comparison.Bottlenecks) > 0 {
			sb.WriteString("### ⚠️ 容量瓶颈\n\n")
			sb.WriteString("| 类型 | 位置 | 严重程度 | 描述 |\n")
			sb.WriteString("|------|------|----------|------|\n")

			for _, b := range g.comparison.Bottlenecks {
				severityIcon := "🟢"
				switch b.Severity {
				case models.SeverityCritical:
					severityIcon = "🔴"
				case models.SeverityMajor:
					severityIcon = "🟠"
				case models.SeverityModerate:
					severityIcon = "🟡"
				}
				sb.WriteString(fmt.Sprintf("| %s | %s | %s %s | %s |\n",
					b.Type, b.Location, severityIcon, b.Severity, b.Description))
			}
			sb.WriteString("\n")
		}

		if len(g.comparison.Recommendations) > 0 {
			sb.WriteString("### 💡 建议动作\n\n")
			for i, rec := range g.comparison.Recommendations {
				riskIcon := "🟢"
				if rec.RiskLevel == models.RiskCritical {
					riskIcon = "🔴"
				} else if rec.RiskLevel == models.RiskHigh {
					riskIcon = "🟠"
				} else if rec.RiskLevel == models.RiskMedium {
					riskIcon = "🟡"
				}

				targets := ""
				if len(rec.TargetRoutes) > 0 {
					targets = fmt.Sprintf(" (目标: %s)", strings.Join(rec.TargetRoutes, ", "))
				}

				sb.WriteString(fmt.Sprintf("%d. %s **[%s]** %s%s\n", i+1, riskIcon, rec.Action, rec.Description, targets))
				sb.WriteString(fmt.Sprintf("   > %s\n\n", rec.Justification))
			}
		}

		sb.WriteString("### 路由对比详情\n\n")
		for _, comp := range g.comparison.RouteComparisons {
			sb.WriteString(fmt.Sprintf("#### %s\n\n", comp.RouteName))

			statusIcon := "✅"
			if comp.Status == models.ComparisonWarning {
				statusIcon = "⚠️"
			} else if comp.Status == models.ComparisonDegraded {
				statusIcon = "❌"
			}
			sb.WriteString(fmt.Sprintf("**状态**: %s %s\n\n", statusIcon, comp.Status))

			sb.WriteString("| 指标 | 变化值 | 变化率 |\n")
			sb.WriteString("|------|--------|--------|\n")
			sb.WriteString(fmt.Sprintf("| P95 延迟 | %+.1fms | %+.1f%% |\n",
				comp.LatencyDelta.P95DeltaMs, comp.LatencyDelta.P95DeltaPct))
			sb.WriteString(fmt.Sprintf("| P99 延迟 | %+.1fms | %+.1f%% |\n",
				comp.LatencyDelta.P99DeltaMs, comp.LatencyDelta.P99DeltaPct))
			sb.WriteString(fmt.Sprintf("| RPS | %+.0f | %+.1f%% |\n",
				comp.ThroughputDelta.RPSDelta, comp.ThroughputDelta.RPSDeltaPct))
			sb.WriteString(fmt.Sprintf("| 错误率 | %+.4f | %+.1f%% |\n",
				comp.ErrorDelta.ErrorRateDelta, comp.ErrorDelta.ErrorRateDeltaPct))
			sb.WriteString(fmt.Sprintf("| CPU | %+.1f%% | - |\n",
				comp.ResourceDelta.CPUDeltaPct))
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

func (g *Generator) GenerateCSV() [][]string {
	var records [][]string

	if g.result != nil {
		records = append(records, []string{"路由名称", "状态", "P50(ms)", "P95(ms)", "P99(ms)",
			"实际RPS", "目标RPS", "错误率", "CPU峰值(%)", "内存峰值(MB)", "并发最大值"})

		for _, rr := range g.result.RouteResults {
			records = append(records, []string{
				rr.RouteName,
				string(rr.Status),
				fmt.Sprintf("%.1f", rr.LatencyMetrics.P50Ms),
				fmt.Sprintf("%.1f", rr.LatencyMetrics.P95Ms),
				fmt.Sprintf("%.1f", rr.LatencyMetrics.P99Ms),
				fmt.Sprintf("%.0f", rr.Throughput.ActualRPS),
				fmt.Sprintf("%.0f", rr.Throughput.TargetRPS),
				fmt.Sprintf("%.4f", rr.ErrorMetrics.ErrorRate),
				fmt.Sprintf("%.1f", rr.ResourceMetrics.CPUPeakPercent),
				fmt.Sprintf("%d", rr.ResourceMetrics.MemoryPeakMB),
				fmt.Sprintf("%d", rr.Throughput.ConcurrentMax),
			})
		}

		records = append(records, []string{})
		records = append(records, []string{"预算检查详情"})
		records = append(records, []string{"路由", "检查项", "阈值", "实际值", "状态", "风险级别", "说明"})

		for _, rr := range g.result.RouteResults {
			for _, check := range rr.BudgetChecks {
				records = append(records, []string{
					rr.RouteName,
					check.Name,
					fmt.Sprintf("%.2f", check.Threshold),
					fmt.Sprintf("%.2f", check.Actual),
					string(check.Status),
					string(check.RiskLevel),
					check.Explanation,
				})
			}
		}
	}

	if g.comparison != nil {
		records = append(records, []string{})
		records = append(records, []string{"基线对比"})
		records = append(records, []string{"路由", "状态", "P95变化(ms)", "P95变化(%)",
			"RPS变化", "RPS变化(%)", "错误率变化", "CPU变化(%)"})

		for _, comp := range g.comparison.RouteComparisons {
			records = append(records, []string{
				comp.RouteName,
				string(comp.Status),
				fmt.Sprintf("%+.1f", comp.LatencyDelta.P95DeltaMs),
				fmt.Sprintf("%+.1f", comp.LatencyDelta.P95DeltaPct),
				fmt.Sprintf("%+.0f", comp.ThroughputDelta.RPSDelta),
				fmt.Sprintf("%+.1f", comp.ThroughputDelta.RPSDeltaPct),
				fmt.Sprintf("%+.4f", comp.ErrorDelta.ErrorRateDelta),
				fmt.Sprintf("%+.1f", comp.ResourceDelta.CPUDeltaPct),
			})
		}
	}

	return records
}

func (g *Generator) GenerateJSON() (string, error) {
	output := make(map[string]interface{})

	if g.result != nil {
		output["run_result"] = g.result
	}
	if g.comparison != nil {
		output["comparison"] = g.comparison
	}

	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func SaveMarkdown(content string, filePath string) error {
	return os.WriteFile(filePath, []byte(content), 0644)
}

func SaveCSV(records [][]string, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	return writer.WriteAll(records)
}

func SaveJSON(content string, filePath string) error {
	return os.WriteFile(filePath, []byte(content), 0644)
}
