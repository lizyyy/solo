package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/yourteam/sync-analyzer/internal/models"
	"github.com/yourteam/sync-analyzer/internal/storage"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export analysis results to various formats",
	Long: `Export analysis results from the SQLite database to different formats
including JSON and Markdown. You can export a specific run or list all runs.`,
	Run: func(cmd *cobra.Command, args []string) {
		workspace, _ := cmd.Flags().GetString("workspace")
		dbPath, _ := cmd.Flags().GetString("db")
		runID, _ := cmd.Flags().GetInt64("run-id")
		format, _ := cmd.Flags().GetString("format")
		output, _ := cmd.Flags().GetString("output")
		listRuns, _ := cmd.Flags().GetBool("list")

		// 设置默认路径
		if workspace == "" {
			workspace = "."
		}
		if dbPath == "" {
			dbPath = filepath.Join(workspace, "sync-analyzer.db")
		}

		// 打开数据库
		fmt.Printf("Opening database at %s...\n", dbPath)
		store, err := storage.NewSQLiteStore(dbPath)
		if err != nil {
			fmt.Printf("Error opening database: %v\n", err)
			os.Exit(1)
		}
		defer store.Close()

		// 列出所有运行
		if listRuns {
			runs, err := store.ListAnalysisRuns()
			if err != nil {
				fmt.Printf("Error listing analysis runs: %v\n", err)
				os.Exit(1)
			}

			fmt.Println()
			fmt.Println("=== Analysis Runs ===")
			fmt.Println()
			fmt.Printf("%-6s %-30s %-20s %-10s\n", "ID", "Name", "Created At", "Status")
			fmt.Println(strings.Repeat("-", 70))

			for _, run := range runs {
				status := run.Status
				if status == "completed" {
					status = "✓ " + status
				} else if status == "running" {
					status = "⏳ " + status
				} else {
					status = "✗ " + status
				}
				fmt.Printf("%-6d %-30s %-20s %-10s\n",
					run.ID,
					truncateString(run.Name, 28),
					run.CreatedAt.Format("2006-01-02 15:04"),
					status,
				)
			}
			fmt.Println()
			return
		}

		// 验证参数
		if runID == 0 {
			fmt.Println("Error: --run-id must be specified or use --list to view all runs")
			os.Exit(1)
		}

		// 获取分析结果
		fmt.Printf("Fetching analysis run %d...\n", runID)
		result, err := store.GetAnalysisResult(runID)
		if err != nil {
			fmt.Printf("Error getting analysis result: %v\n", err)
			os.Exit(1)
		}

		// 生成输出
		var content string
		switch format {
		case "json":
			content = generateExportJSON(result)
		case "markdown":
			content = generateExportMarkdown(result)
		default:
			// 默认文本格式
			content = generateExportText(result)
		}

		// 输出结果
		if output != "" {
			if err := os.WriteFile(output, []byte(content), 0644); err != nil {
				fmt.Printf("Error writing output file: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("✓ Results exported to %s\n", output)
		} else {
			fmt.Println()
			fmt.Println(content)
		}
	},
}

// truncateString 截断字符串到指定长度
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// generateExportText 生成文本格式的导出
func generateExportText(result *models.AnalysisResult) string {
	var content string

	content += fmt.Sprintf("=== Analysis Report: %s ===\n", result.RunName)
	content += fmt.Sprintf("Run ID: %d\n", result.RunID)
	content += fmt.Sprintf("\n")

	content += fmt.Sprintf("## Summary\n")
	content += fmt.Sprintf("  Total Primitives: %d\n", result.Summary.TotalPrimitives)
	content += fmt.Sprintf("  Total Events: %d\n", result.Summary.TotalEvents)
	content += fmt.Sprintf("  Total Issues: %d\n", result.Summary.TotalIssues)
	content += fmt.Sprintf("\n")

	if result.Summary.TotalIssues > 0 {
		content += fmt.Sprintf("  Issues by Type:\n")
		for issueType, count := range result.Summary.IssuesByType {
			content += fmt.Sprintf("    %s: %d\n", issueType, count)
		}
		content += fmt.Sprintf("\n")

		content += fmt.Sprintf("  Issues by Severity:\n")
		for severity, count := range result.Summary.IssuesBySeverity {
			content += fmt.Sprintf("    %s: %d\n", severity, count)
		}
		content += fmt.Sprintf("\n")
	}

	if len(result.Primitives) > 0 {
		content += fmt.Sprintf("## Sync Primitives\n")
		for i, primitive := range result.Primitives {
			content += fmt.Sprintf("%d. %s (%s)\n", i+1, primitive.Name, primitive.Type)
			if primitive.Location != "" {
				content += fmt.Sprintf("   Location: %s\n", primitive.Location)
			}
			if primitive.Declaration != "" {
				content += fmt.Sprintf("   Declaration: %s\n", primitive.Declaration)
			}
			content += fmt.Sprintf("\n")
		}
	}

	if len(result.Issues) > 0 {
		content += fmt.Sprintf("## Issues\n")
		for i, issue := range result.Issues {
			content += fmt.Sprintf("### Issue %d: %s\n", i+1, issue.Title)
			content += fmt.Sprintf("   Type: %s\n", issue.Type)
			content += fmt.Sprintf("   Severity: %s\n", issue.Severity)
			if issue.Location != "" {
				content += fmt.Sprintf("   Location: %s\n", issue.Location)
			}
			if issue.File != "" {
				content += fmt.Sprintf("   File: %s:%d\n", issue.File, issue.Line)
			}
			if issue.Description != "" {
				content += fmt.Sprintf("   Description: %s\n", issue.Description)
			}
			if issue.Suggestion != "" {
				content += fmt.Sprintf("   Suggestion: %s\n", issue.Suggestion)
			}
			content += fmt.Sprintf("\n")
		}
	}

	return content
}

// generateExportJSON 生成 JSON 格式的导出
func generateExportJSON(result *models.AnalysisResult) string {
	// 使用 encoding/json 进行序列化
	type ExportResult struct {
		RunID      int64                 `json:"run_id"`
		RunName    string                `json:"run_name"`
		Primitives []models.SyncPrimitive `json:"primitives"`
		Events     []models.SyncEvent    `json:"events,omitempty"`
		Issues     []models.Issue        `json:"issues"`
		Summary    models.AnalysisSummary `json:"summary"`
	}

	exportResult := ExportResult{
		RunID:      result.RunID,
		RunName:    result.RunName,
		Primitives: result.Primitives,
		Events:     result.Events,
		Issues:     result.Issues,
		Summary:    result.Summary,
	}

	data, err := json.MarshalIndent(exportResult, "", "  ")
	if err != nil {
		return fmt.Sprintf("Error generating JSON: %v", err)
	}

	return string(data)
}

// generateExportMarkdown 生成 Markdown 格式的导出
func generateExportMarkdown(result *models.AnalysisResult) string {
	var content string

	content += fmt.Sprintf("# Sync Analysis Report: %s\n\n", result.RunName)
	content += fmt.Sprintf("**Run ID**: %d\n\n", result.RunID)

	// Summary
	content += fmt.Sprintf("## Summary\n\n")
	content += fmt.Sprintf("| Metric | Count |\n")
	content += fmt.Sprintf("|--------|-------|\n")
	content += fmt.Sprintf("| Total Primitives | %d |\n", result.Summary.TotalPrimitives)
	content += fmt.Sprintf("| Total Events | %d |\n", result.Summary.TotalEvents)
	content += fmt.Sprintf("| Total Issues | %d |\n", result.Summary.TotalIssues)
	content += fmt.Sprintf("\n")

	if result.Summary.TotalIssues > 0 {
		content += fmt.Sprintf("### Issues by Type\n\n")
		content += fmt.Sprintf("| Type | Count |\n")
		content += fmt.Sprintf("|------|-------|\n")
		for issueType, count := range result.Summary.IssuesByType {
			content += fmt.Sprintf("| %s | %d |\n", issueType, count)
		}
		content += fmt.Sprintf("\n")

		content += fmt.Sprintf("### Issues by Severity\n\n")
		content += fmt.Sprintf("| Severity | Count |\n")
		content += fmt.Sprintf("|----------|-------|\n")
		for severity, count := range result.Summary.IssuesBySeverity {
			content += fmt.Sprintf("| %s | %d |\n", severity, count)
		}
		content += fmt.Sprintf("\n")
	}

	// Primitives
	if len(result.Primitives) > 0 {
		content += fmt.Sprintf("## Sync Primitives\n\n")
		content += fmt.Sprintf("| # | Name | Type | Location |\n")
		content += fmt.Sprintf("|---|------|------|----------|\n")
		for i, primitive := range result.Primitives {
			location := "-"
			if primitive.Location != "" {
				location = primitive.Location
			}
			content += fmt.Sprintf("| %d | %s | %s | %s |\n",
				i+1, primitive.Name, primitive.Type, location)
		}
		content += fmt.Sprintf("\n")
	}

	// Issues
	if len(result.Issues) > 0 {
		content += fmt.Sprintf("## Issues\n\n")

		// 按严重程度分组显示
		severityGroups := map[models.IssueSeverity][]models.Issue{
			models.SeverityCritical: {},
			models.SeverityHigh:     {},
			models.SeverityMedium:   {},
			models.SeverityLow:      {},
		}

		for _, issue := range result.Issues {
			severityGroups[issue.Severity] = append(severityGroups[issue.Severity], issue)
		}

		// Critical Issues
		if len(severityGroups[models.SeverityCritical]) > 0 {
			content += fmt.Sprintf("### Critical Issues\n\n")
			for i, issue := range severityGroups[models.SeverityCritical] {
				content += fmt.Sprintf("#### %d. %s\n\n", i+1, issue.Title)
				content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
				content += fmt.Sprintf("- **Severity**: `critical`\n")
				if issue.File != "" {
					content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
				}
				if issue.Description != "" {
					content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
				}
				if issue.Suggestion != "" {
					content += fmt.Sprintf("- **Suggestion**: %s\n", issue.Suggestion)
				}
				if issue.References != "" {
					content += fmt.Sprintf("- **References**: %s\n", issue.References)
				}
				content += fmt.Sprintf("\n")
			}
		}

		// High Issues
		if len(severityGroups[models.SeverityHigh]) > 0 {
			content += fmt.Sprintf("### High Issues\n\n")
			for i, issue := range severityGroups[models.SeverityHigh] {
				content += fmt.Sprintf("#### %d. %s\n\n", i+1, issue.Title)
				content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
				content += fmt.Sprintf("- **Severity**: `high`\n")
				if issue.File != "" {
					content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
				}
				if issue.Description != "" {
					content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
				}
				if issue.Suggestion != "" {
					content += fmt.Sprintf("- **Suggestion**: %s\n", issue.Suggestion)
				}
				if issue.References != "" {
					content += fmt.Sprintf("- **References**: %s\n", issue.References)
				}
				content += fmt.Sprintf("\n")
			}
		}

		// Medium Issues
		if len(severityGroups[models.SeverityMedium]) > 0 {
			content += fmt.Sprintf("### Medium Issues\n\n")
			for i, issue := range severityGroups[models.SeverityMedium] {
				content += fmt.Sprintf("#### %d. %s\n\n", i+1, issue.Title)
				content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
				content += fmt.Sprintf("- **Severity**: `medium`\n")
				if issue.File != "" {
					content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
				}
				if issue.Description != "" {
					content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
				}
				if issue.Suggestion != "" {
					content += fmt.Sprintf("- **Suggestion**: %s\n", issue.Suggestion)
				}
				if issue.References != "" {
					content += fmt.Sprintf("- **References**: %s\n", issue.References)
				}
				content += fmt.Sprintf("\n")
			}
		}

		// Low Issues
		if len(severityGroups[models.SeverityLow]) > 0 {
			content += fmt.Sprintf("### Low Issues\n\n")
			for i, issue := range severityGroups[models.SeverityLow] {
				content += fmt.Sprintf("#### %d. %s\n\n", i+1, issue.Title)
				content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
				content += fmt.Sprintf("- **Severity**: `low`\n")
				if issue.File != "" {
					content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
				}
				if issue.Description != "" {
					content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
				}
				if issue.Suggestion != "" {
					content += fmt.Sprintf("- **Suggestion**: %s\n", issue.Suggestion)
				}
				if issue.References != "" {
					content += fmt.Sprintf("- **References**: %s\n", issue.References)
				}
				content += fmt.Sprintf("\n")
			}
		}
	}

	return content
}

func init() {
	exportCmd.Flags().StringP("workspace", "w", ".", "Path to the workspace directory")
	exportCmd.Flags().StringP("db", "d", "", "Path to the SQLite database file (default: workspace/sync-analyzer.db)")
	exportCmd.Flags().Int64("run-id", 0, "ID of the analysis run to export")
	exportCmd.Flags().StringP("format", "f", "text", "Output format: text, json, markdown")
	exportCmd.Flags().StringP("output", "o", "", "Output file path (default: stdout)")
	exportCmd.Flags().BoolP("list", "l", false, "List all analysis runs")
}
