package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/yourteam/sync-analyzer/internal/storage"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "Compare two analysis runs",
	Long: `Compare two analysis runs to identify new issues, fixed issues,
and changes in issue severity between runs.`,
	Run: func(cmd *cobra.Command, args []string) {
		workspace, _ := cmd.Flags().GetString("workspace")
		dbPath, _ := cmd.Flags().GetString("db")
		baseRunID, _ := cmd.Flags().GetInt64("base-run-id")
		compareRunID, _ := cmd.Flags().GetInt64("compare-run-id")
		format, _ := cmd.Flags().GetString("format")
		output, _ := cmd.Flags().GetString("output")

		// 设置默认路径
		if workspace == "" {
			workspace = "."
		}
		if dbPath == "" {
			dbPath = filepath.Join(workspace, "sync-analyzer.db")
		}

		// 验证参数
		if baseRunID == 0 || compareRunID == 0 {
			fmt.Println("Error: Both --base-run-id and --compare-run-id must be specified")
			os.Exit(1)
		}

		// 打开数据库
		fmt.Printf("Opening database at %s...\n", dbPath)
		store, err := storage.NewSQLiteStore(dbPath)
		if err != nil {
			fmt.Printf("Error opening database: %v\n", err)
			os.Exit(1)
		}
		defer store.Close()

		// 执行比较
		fmt.Printf("Comparing run %d (base) with run %d (compare)...\n", baseRunID, compareRunID)
		result, err := store.CompareRuns(baseRunID, compareRunID)
		if err != nil {
			fmt.Printf("Error comparing runs: %v\n", err)
			os.Exit(1)
		}

		// 生成输出
		var content string
		switch format {
		case "json":
			content = generateCompareJSON(result)
		case "markdown":
			content = generateCompareMarkdown(result)
		default:
			// 默认文本格式
			content = generateCompareText(result)
		}

		// 输出结果
		if output != "" {
			if err := os.WriteFile(output, []byte(content), 0644); err != nil {
				fmt.Printf("Error writing output file: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("✓ Comparison results written to %s\n", output)
		} else {
			fmt.Println()
			fmt.Println(content)
		}
	},
}

// generateCompareText 生成文本格式的比较结果
func generateCompareText(result *storage.ComparisonResult) string {
	var content string

	content += fmt.Sprintf("=== Comparison Results ===\n")
	content += fmt.Sprintf("Base Run: %s (ID: %d)\n", result.BaseRunName, result.BaseRunID)
	content += fmt.Sprintf("Compare Run: %s (ID: %d)\n", result.CompareRunName, result.CompareRunID)
	content += fmt.Sprintf("\n")

	content += fmt.Sprintf("Summary:\n")
	content += fmt.Sprintf("  New Issues: %d\n", result.Summary.NewIssueCount)
	content += fmt.Sprintf("  Fixed Issues: %d\n", result.Summary.FixedIssueCount)
	content += fmt.Sprintf("  Changed Issues: %d\n", result.Summary.ChangedIssueCount)
	content += fmt.Sprintf("\n")

	if len(result.NewIssues) > 0 {
		content += fmt.Sprintf("--- New Issues ---\n")
		for i, issue := range result.NewIssues {
			content += fmt.Sprintf("%d. [%s] %s\n", i+1, issue.Severity, issue.Title)
			content += fmt.Sprintf("   Location: %s:%d\n", issue.File, issue.Line)
			content += fmt.Sprintf("   Description: %s\n", issue.Description)
			content += fmt.Sprintf("\n")
		}
	}

	if len(result.FixedIssues) > 0 {
		content += fmt.Sprintf("--- Fixed Issues ---\n")
		for i, issue := range result.FixedIssues {
			content += fmt.Sprintf("%d. [%s] %s\n", i+1, issue.Severity, issue.Title)
			content += fmt.Sprintf("   Location: %s:%d\n", issue.File, issue.Line)
			content += fmt.Sprintf("   Description: %s\n", issue.Description)
			content += fmt.Sprintf("\n")
		}
	}

	if len(result.ChangedIssues) > 0 {
		content += fmt.Sprintf("--- Changed Issues ---\n")
		for i, change := range result.ChangedIssues {
			content += fmt.Sprintf("%d. Issue ID: %d\n", i+1, change.IssueID)
			content += fmt.Sprintf("   Severity: %s -> %s\n", change.OldSeverity, change.NewSeverity)
			content += fmt.Sprintf("   Description: %s\n", change.Description)
			content += fmt.Sprintf("\n")
		}
	}

	return content
}

// generateCompareJSON 生成 JSON 格式的比较结果
func generateCompareJSON(result *storage.ComparisonResult) string {
	// 简单的 JSON 生成，实际项目中应该使用 encoding/json
	var content string
	content += "{\n"
	content += fmt.Sprintf("  \"base_run_id\": %d,\n", result.BaseRunID)
	content += fmt.Sprintf("  \"base_run_name\": \"%s\",\n", result.BaseRunName)
	content += fmt.Sprintf("  \"compare_run_id\": %d,\n", result.CompareRunID)
	content += fmt.Sprintf("  \"compare_run_name\": \"%s\",\n", result.CompareRunName)
	content += fmt.Sprintf("  \"summary\": {\n")
	content += fmt.Sprintf("    \"new_issues\": %d,\n", result.Summary.NewIssueCount)
	content += fmt.Sprintf("    \"fixed_issues\": %d,\n", result.Summary.FixedIssueCount)
	content += fmt.Sprintf("    \"changed_issues\": %d\n", result.Summary.ChangedIssueCount)
	content += fmt.Sprintf("  }\n")
	content += "}\n"
	return content
}

// generateCompareMarkdown 生成 Markdown 格式的比较结果
func generateCompareMarkdown(result *storage.ComparisonResult) string {
	var content string

	content += fmt.Sprintf("# Comparison Results\n\n")
	content += fmt.Sprintf("## Summary\n\n")
	content += fmt.Sprintf("| Metric | Count |\n")
	content += fmt.Sprintf("|--------|-------|\n")
	content += fmt.Sprintf("| New Issues | %d |\n", result.Summary.NewIssueCount)
	content += fmt.Sprintf("| Fixed Issues | %d |\n", result.Summary.FixedIssueCount)
	content += fmt.Sprintf("| Changed Issues | %d |\n", result.Summary.ChangedIssueCount)
	content += fmt.Sprintf("\n")

	content += fmt.Sprintf("## Runs\n\n")
	content += fmt.Sprintf("- **Base Run**: %s (ID: %d)\n", result.BaseRunName, result.BaseRunID)
	content += fmt.Sprintf("- **Compare Run**: %s (ID: %d)\n", result.CompareRunName, result.CompareRunID)
	content += fmt.Sprintf("\n")

	if len(result.NewIssues) > 0 {
		content += fmt.Sprintf("## New Issues\n\n")
		for i, issue := range result.NewIssues {
			content += fmt.Sprintf("### %d. %s\n\n", i+1, issue.Title)
			content += fmt.Sprintf("- **Severity**: `%s`\n", issue.Severity)
			content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
			content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
			content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
			if issue.Suggestion != "" {
				content += fmt.Sprintf("- **Suggestion**: %s\n", issue.Suggestion)
			}
			content += fmt.Sprintf("\n")
		}
	}

	if len(result.FixedIssues) > 0 {
		content += fmt.Sprintf("## Fixed Issues\n\n")
		for i, issue := range result.FixedIssues {
			content += fmt.Sprintf("### %d. %s\n\n", i+1, issue.Title)
			content += fmt.Sprintf("- **Severity**: `%s`\n", issue.Severity)
			content += fmt.Sprintf("- **Type**: `%s`\n", issue.Type)
			content += fmt.Sprintf("- **Location**: `%s:%d`\n", issue.File, issue.Line)
			content += fmt.Sprintf("- **Description**: %s\n", issue.Description)
			content += fmt.Sprintf("\n")
		}
	}

	if len(result.ChangedIssues) > 0 {
		content += fmt.Sprintf("## Changed Issues\n\n")
		for i, change := range result.ChangedIssues {
			content += fmt.Sprintf("### %d. Issue ID: %d\n\n", i+1, change.IssueID)
			content += fmt.Sprintf("- **Severity Change**: `%s` → `%s`\n", change.OldSeverity, change.NewSeverity)
			content += fmt.Sprintf("- **Description**: %s\n", change.Description)
			content += fmt.Sprintf("\n")
		}
	}

	return content
}

func init() {
	compareCmd.Flags().StringP("workspace", "w", ".", "Path to the workspace directory")
	compareCmd.Flags().StringP("db", "d", "", "Path to the SQLite database file (default: workspace/sync-analyzer.db)")
	compareCmd.Flags().Int64("base-run-id", 0, "ID of the base run to compare against")
	compareCmd.Flags().Int64("compare-run-id", 0, "ID of the run to compare")
	compareCmd.Flags().StringP("format", "f", "text", "Output format: text, json, markdown")
	compareCmd.Flags().StringP("output", "o", "", "Output file path (default: stdout)")
}
