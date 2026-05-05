package report

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"deferpanic/pkg/storage"
)

type DiffResult struct {
	FirstID         string
	SecondID        string
	CommonFields    map[string]FieldDiff
	DifferentFields map[string]FieldDiff
	Summary         string
}

type FieldDiff struct {
	FieldName string
	First     interface{}
	Second    interface{}
	IsSame    bool
}

func CompareExecutions(exec1, exec2 *storage.ExecutionRecord) *DiffResult {
	result := &DiffResult{
		FirstID:         exec1.ID,
		SecondID:        exec2.ID,
		CommonFields:    make(map[string]FieldDiff),
		DifferentFields: make(map[string]FieldDiff),
	}

	fields := []struct {
		name string
		val1 interface{}
		val2 interface{}
	}{
		{"用例名称", exec1.CaseName, exec2.CaseName},
		{"执行状态", exec1.Status, exec2.Status},
		{"返回值", exec1.ReturnValue, exec2.ReturnValue},
		{"Panic值", exec1.PanicValue, exec2.PanicValue},
		{"是否恢复", exec1.Recovered, exec2.Recovered},
		{"风险等级", exec1.RiskLevel, exec2.RiskLevel},
	}

	for _, f := range fields {
		isSame := fmt.Sprintf("%v", f.val1) == fmt.Sprintf("%v", f.val2)
		diff := FieldDiff{
			FieldName: f.name,
			First:     f.val1,
			Second:    f.val2,
			IsSame:    isSame,
		}
		if isSame {
			result.CommonFields[f.name] = diff
		} else {
			result.DifferentFields[f.name] = diff
		}
	}

	if len(result.DifferentFields) == 0 {
		result.Summary = "两个执行记录完全相同"
	} else {
		result.Summary = fmt.Sprintf("存在 %d 个不同点", len(result.DifferentFields))
	}

	return result
}

func PrintDiffTable(diff *DiffResult) {
	fmt.Printf("\n========================================\n")
	fmt.Printf("比较执行记录\n")
	fmt.Printf("  记录1: %s\n", diff.FirstID)
	fmt.Printf("  记录2: %s\n", diff.SecondID)
	fmt.Printf("========================================\n\n")

	fmt.Printf("结果: %s\n\n", diff.Summary)

	if len(diff.DifferentFields) > 0 {
		fmt.Printf("--- 不同点 ---\n")
		fmt.Printf("%-15s | %-25s | %-25s\n", "字段", "记录1", "记录2")
		fmt.Printf("%s+%s+%s\n", strings.Repeat("-", 17), strings.Repeat("-", 27), strings.Repeat("-", 27))
		for name, field := range diff.DifferentFields {
			fmt.Printf("%-15s | %-25v | %-25v\n", name, field.First, field.Second)
		}
		fmt.Println()
	}

	if len(diff.CommonFields) > 0 {
		fmt.Printf("--- 相同点 ---\n")
		for name, field := range diff.CommonFields {
			fmt.Printf("  %s: %v\n", name, field.First)
		}
	}
}

func ToJSON(v interface{}) (string, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", fmt.Errorf("序列化 JSON 失败: %w", err)
	}
	return string(data), nil
}

func ExportMarkdown(executions []*storage.ExecutionRecord, includeRisk bool) (string, error) {
	var sb strings.Builder

	sb.WriteString("# Defer/Panic/Recover 执行链分析报告\n\n")
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("执行记录数: %d\n\n", len(executions)))
	sb.WriteString("---\n\n")

	for i, exec := range executions {
		if i > 0 {
			sb.WriteString("\n---\n\n")
		}

		sb.WriteString(fmt.Sprintf("## 执行记录: %s\n\n", exec.CaseName))
		sb.WriteString(fmt.Sprintf("- **ID**: %s\n", exec.ID))
		sb.WriteString(fmt.Sprintf("- **状态**: %s\n", statusToEmoji(exec.Status)+" "+exec.Status))
		sb.WriteString(fmt.Sprintf("- **是否恢复**: %v\n", exec.Recovered))
		sb.WriteString(fmt.Sprintf("- **风险等级**: %s\n", riskToEmoji(exec.RiskLevel)+" "+exec.RiskLevel))
		sb.WriteString(fmt.Sprintf("- **执行时间**: %s\n", exec.CreatedAt.Format("2006-01-02 15:04:05")))

		if exec.ReturnValue != nil {
			sb.WriteString(fmt.Sprintf("- **返回值**: %v\n", exec.ReturnValue))
		}
		if exec.PanicValue != nil {
			sb.WriteString(fmt.Sprintf("- **Panic值**: %v\n", exec.PanicValue))
		}
		sb.WriteString("\n")

		if len(exec.DeferStack) > 0 {
			sb.WriteString("### Defer 栈\n\n")
			sb.WriteString("| 位置 | 函数 | 状态 |\n")
			sb.WriteString("|------|------|------|\n")
			for j, d := range exec.DeferStack {
				status := "未执行"
				if strings.Contains(d, "已执行") {
					status = "已执行"
				}
				sb.WriteString(fmt.Sprintf("| %d | %s | %s |\n", j+1, strings.Replace(d, " (已执行)", "", -1), status))
			}
			sb.WriteString("\n")
		}

		if exec.TimelineJSON != "" {
			var timeline []map[string]interface{}
			if err := json.Unmarshal([]byte(exec.TimelineJSON), &timeline); err == nil && len(timeline) > 0 {
				sb.WriteString("### 执行时间线\n\n")
				sb.WriteString("| 步骤 | 类型 | 描述 |\n")
				sb.WriteString("|------|------|------|\n")
				for _, event := range timeline {
					step, _ := event["Step"].(float64)
					etype, _ := event["Type"].(string)
					desc, _ := event["Description"].(string)
					sb.WriteString(fmt.Sprintf("| %.0f | %s | %s |\n", step, etype, desc))
				}
				sb.WriteString("\n")
			}
		}

		if includeRisk && exec.RiskJSON != "" {
			var risk map[string]interface{}
			if err := json.Unmarshal([]byte(exec.RiskJSON), &risk); err == nil {
				sb.WriteString("### 风险分析\n\n")

				if level, ok := risk["Level"].(string); ok {
					sb.WriteString(fmt.Sprintf("- **风险等级**: %s %s\n", riskToEmoji(level), level))
				}

				if desc, ok := risk["Description"].(string); ok {
					sb.WriteString(fmt.Sprintf("- **描述**: %s\n", desc))
				}
				sb.WriteString("\n")

				if issues, ok := risk["Issues"].([]interface{}); ok && len(issues) > 0 {
					sb.WriteString("#### 风险点\n\n")
					for _, issue := range issues {
						if m, ok := issue.(map[string]interface{}); ok {
							loc, _ := m["Location"].(string)
							desc, _ := m["Description"].(string)
							sev, _ := m["Severity"].(string)
							sb.WriteString(fmt.Sprintf("- **[%s]** %s: %s\n", sev, loc, desc))
						}
					}
					sb.WriteString("\n")
				}

				if suggestions, ok := risk["Suggestions"].([]interface{}); ok && len(suggestions) > 0 {
					sb.WriteString("#### 修复建议\n\n")
					for i, sug := range suggestions {
						sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, sug))
					}
					sb.WriteString("\n")
				}
			}
		}
	}

	return sb.String(), nil
}

func ExportJSON(executions []*storage.ExecutionRecord, includeRisk bool) (string, error) {
	type ReportExecution struct {
		ID          string      `json:"id"`
		CaseName    string      `json:"case_name"`
		Status      string      `json:"status"`
		ReturnValue interface{} `json:"return_value,omitempty"`
		PanicValue  interface{} `json:"panic_value,omitempty"`
		Recovered   bool        `json:"recovered"`
		DeferStack  []string    `json:"defer_stack,omitempty"`
		RiskLevel   string      `json:"risk_level,omitempty"`
		Risk        interface{} `json:"risk,omitempty"`
		CreatedAt   time.Time   `json:"created_at"`
	}

	type Report struct {
		GeneratedAt time.Time          `json:"generated_at"`
		Total       int                `json:"total"`
		Executions  []*ReportExecution `json:"executions"`
	}

	report := &Report{
		GeneratedAt: time.Now(),
		Total:       len(executions),
		Executions:  make([]*ReportExecution, 0, len(executions)),
	}

	for _, exec := range executions {
		re := &ReportExecution{
			ID:          exec.ID,
			CaseName:    exec.CaseName,
			Status:      exec.Status,
			ReturnValue: exec.ReturnValue,
			PanicValue:  exec.PanicValue,
			Recovered:   exec.Recovered,
			DeferStack:  exec.DeferStack,
			RiskLevel:   exec.RiskLevel,
			CreatedAt:   exec.CreatedAt,
		}

		if includeRisk && exec.RiskJSON != "" {
			var risk interface{}
			if err := json.Unmarshal([]byte(exec.RiskJSON), &risk); err == nil {
				re.Risk = risk
			}
		}

		report.Executions = append(report.Executions, re)
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	return string(data), nil
}

func statusToEmoji(status string) string {
	switch status {
	case "normal":
		return "✅"
	case "recovered":
		return "🆗"
	case "panicked":
		return "💥"
	default:
		return "❓"
	}
}

func riskToEmoji(level string) string {
	switch level {
	case "high":
		return "🔴"
	case "medium":
		return "🟡"
	case "low":
		return "🟢"
	default:
		return "⚪"
	}
}
