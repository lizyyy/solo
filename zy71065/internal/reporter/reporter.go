package reporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"proto-enum-lint/pkg/types"
)

type Reporter struct {
	outputDir string
	service   string
}

func NewReporter(outputDir, service string) *Reporter {
	return &Reporter{
		outputDir: outputDir,
		service:   service,
	}
}

func (r *Reporter) Generate(report types.Report) error {
	if err := os.MkdirAll(r.outputDir, 0755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	if err := r.writeJSON(report); err != nil {
		return err
	}

	if err := r.writeMarkdown(report); err != nil {
		return err
	}

	r.printConsole(report)

	return nil
}

func (r *Reporter) writeJSON(report types.Report) error {
	filename := fmt.Sprintf("report_%s_%s.json",
		r.service,
		time.Now().Format("20060102_150405"))
	filePath := filepath.Join(r.outputDir, filename)

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal json: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("write json: %w", err)
	}

	return nil
}

func (r *Reporter) writeMarkdown(report types.Report) error {
	filename := fmt.Sprintf("report_%s_%s.md",
		r.service,
		time.Now().Format("20060102_150405"))
	filePath := filepath.Join(r.outputDir, filename)

	content := r.generateMarkdown(report)

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("write markdown: %w", err)
	}

	return nil
}

func (r *Reporter) generateMarkdown(report types.Report) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Proto 枚举兼容性检查报告\n\n"))
	sb.WriteString(fmt.Sprintf("**服务名称**: %s\n\n", report.Service))
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("**退出码**: %d - %s\n\n", report.ExitCode, report.ExitCodeDesc))

	sb.WriteString("## 摘要\n\n")
	sb.WriteString(fmt.Sprintf("- 检查文件数: %d\n", len(report.InputFiles)))
	sb.WriteString(fmt.Sprintf("- 错误数: **%d**\n", report.TotalErrors))
	sb.WriteString(fmt.Sprintf("- 警告数: %d\n\n", report.TotalWarnings))

	if report.SnapshotFile != "" {
		sb.WriteString(fmt.Sprintf("- 对比快照: %s\n\n", report.SnapshotFile))
	}

	if len(report.InputFiles) > 0 {
		sb.WriteString("## 输入文件\n\n")
		for _, f := range report.InputFiles {
			sb.WriteString(fmt.Sprintf("- `%s`\n", f))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 问题详情\n\n")

	if len(report.Issues) == 0 {
		sb.WriteString("✅ **未发现任何问题**\n\n")
	} else {
		errorIssues := filterIssuesBySeverity(report.Issues, types.SeverityError)
		warningIssues := filterIssuesBySeverity(report.Issues, types.SeverityWarning)

		if len(errorIssues) > 0 {
			sb.WriteString("### ❌ 错误\n\n")
			for _, issue := range errorIssues {
				sb.WriteString(formatMarkdownIssue(issue))
			}
		}

		if len(warningIssues) > 0 {
			sb.WriteString("### ⚠️ 警告\n\n")
			for _, issue := range warningIssues {
				sb.WriteString(formatMarkdownIssue(issue))
			}
		}
	}

	sb.WriteString("## 退出码说明\n\n")
	sb.WriteString("| 退出码 | 说明 |\n")
	sb.WriteString("|--------|------|\n")
	for code, desc := range types.ExitCodeDescriptions {
		sb.WriteString(fmt.Sprintf("| %d | %s |\n", code, desc))
	}
	sb.WriteString("\n")

	sb.WriteString("## 修复建议\n\n")
	sb.WriteString("### 编号复用问题\n")
	sb.WriteString("- 为新枚举值使用未使用过的编号\n")
	sb.WriteString("- 删除枚举值后，务必将编号加入 `reserved`\n")
	sb.WriteString("- 示例: `reserved 5, 10 to 15;`\n\n")

	sb.WriteString("### Reserved 漏写问题\n")
	sb.WriteString("- 删除枚举值时，同时添加 reserved 声明\n")
	sb.WriteString("- 可以按编号或名称保留: `reserved \"DEPRECATED_VALUE\";`\n\n")

	sb.WriteString("### 别名使用问题\n")
	sb.WriteString("- 在枚举开头添加 `option allow_alias = true;`\n")
	sb.WriteString("- 确保第一个出现的值是主值，后续同名值为别名\n\n")

	return sb.String()
}

func filterIssuesBySeverity(issues []types.Issue, severity types.IssueSeverity) []types.Issue {
	var result []types.Issue
	for _, issue := range issues {
		if issue.Severity == severity {
			result = append(result, issue)
		}
	}
	return result
}

func formatMarkdownIssue(issue types.Issue) string {
	var sb strings.Builder

	icon := "❌"
	if issue.Severity == types.SeverityWarning {
		icon = "⚠️"
	}

	sb.WriteString(fmt.Sprintf("#### %s %s\n\n", icon, issue.Message))
	sb.WriteString(fmt.Sprintf("- **类型**: `%s`\n", issue.Type))
	sb.WriteString(fmt.Sprintf("- **文件**: `%s`\n", issue.FilePath))
	sb.WriteString(fmt.Sprintf("- **枚举**: `%s`\n", issue.EnumName))
	if issue.ValueName != "" {
		sb.WriteString(fmt.Sprintf("- **枚举值**: `%s`\n", issue.ValueName))
	}
	if issue.Number != 0 {
		sb.WriteString(fmt.Sprintf("- **编号**: %d\n", issue.Number))
	}
	if issue.Details != "" {
		sb.WriteString(fmt.Sprintf("\n**详情**: %s\n\n", issue.Details))
	}
	sb.WriteString("\n")

	return sb.String()
}

func (r *Reporter) printConsole(report types.Report) {
	fmt.Println()
	fmt.Println("========================================")
	fmt.Println("  Proto 枚举兼容性检查报告")
	fmt.Println("========================================")
	fmt.Println()
	fmt.Printf("服务: %s\n", report.Service)
	fmt.Printf("时间: %s\n", report.GeneratedAt.Format("2006-01-02 15:04:05"))
	fmt.Println()

	fmt.Println("-------- 摘要 --------")
	fmt.Printf("检查文件: %d 个\n", len(report.InputFiles))
	fmt.Printf("错误: %d 个\n", report.TotalErrors)
	fmt.Printf("警告: %d 个\n", report.TotalWarnings)
	fmt.Println()

	if len(report.Issues) > 0 {
		fmt.Println("-------- 问题列表 --------")
		fmt.Println()

		for i, issue := range report.Issues {
			prefix := "❌"
			if issue.Severity == types.SeverityWarning {
				prefix = "⚠️"
			}
			fmt.Printf("%d. %s %s\n", i+1, prefix, issue.Message)
			fmt.Printf("   文件: %s\n", issue.FilePath)
			fmt.Printf("   枚举: %s\n", issue.EnumName)
			if issue.Details != "" {
				fmt.Printf("   详情: %s\n", issue.Details)
			}
			fmt.Println()
		}
	} else {
		fmt.Println("✅ 未发现任何问题!")
		fmt.Println()
	}

	fmt.Println("-------- 退出码 --------")
	fmt.Printf("退出码: %d\n", report.ExitCode)
	fmt.Printf("说明: %s\n", report.ExitCodeDesc)
	fmt.Println()

	if report.ExitCode == types.ExitCodeSuccess {
		fmt.Println("✅ 检查通过!")
	} else {
		fmt.Println("❌ 检查失败，请修复上述问题后重试")
	}
	fmt.Println()
}

func CalculateExitCode(issues []types.Issue) (int, string) {
	for _, issue := range issues {
		if issue.Severity == types.SeverityError {
			return types.ExitCodeBreakingChange, types.ExitCodeDescriptions[types.ExitCodeBreakingChange]
		}
	}
	return types.ExitCodeSuccess, types.ExitCodeDescriptions[types.ExitCodeSuccess]
}
