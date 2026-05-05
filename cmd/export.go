package cmd

import (
	"context-health/pkg/model"
	"context-health/pkg/store"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出分析报告",
	Long: `export 命令用于将分析结果导出为 Markdown 或 JSON 格式的报告，
方便团队共享和归档。`,
	RunE: runExport,
}

func init() {
	rootCmd.AddCommand(exportCmd)
	exportCmd.Flags().StringP("db", "", ".context-health.db", "SQLite 数据库路径")
	exportCmd.Flags().StringP("session", "s", "", "会话 ID（不指定则使用最新的）")
	exportCmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown, json")
	exportCmd.Flags().StringP("output", "o", "", "输出文件路径（不指定则打印到标准输出）")
	exportCmd.Flags().BoolP("full", "", false, "输出完整报告（包含所有调用记录）")
}

func runExport(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	sessionID, _ := cmd.Flags().GetString("session")
	format, _ := cmd.Flags().GetString("format")
	outputPath, _ := cmd.Flags().GetString("output")
	fullReport, _ := cmd.Flags().GetBool("full")

	st, err := store.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer st.Close()

	var result *model.AnalysisResult

	if sessionID == "" {
		sessions, err := st.ListSessions(1)
		if err != nil {
			return fmt.Errorf("获取最新会话失败: %w", err)
		}
		if len(sessions) == 0 {
			return fmt.Errorf("没有找到分析会话，请先运行 'context-health analyze'")
		}
		sessionID = sessions[0].SessionID
		fmt.Printf("使用最新会话: %s\n", sessionID)
	}

	result, err = st.GetAnalysisResult(sessionID)
	if err != nil {
		return fmt.Errorf("获取会话结果失败: %w", err)
	}

	var content string

	switch strings.ToLower(format) {
	case "json":
		content, err = generateJSONReport(result, fullReport)
	case "markdown", "md":
		content, err = generateMarkdownReport(result, fullReport)
	default:
		return fmt.Errorf("不支持的格式: %s，支持的格式: markdown, json", format)
	}

	if err != nil {
		return fmt.Errorf("生成报告失败: %w", err)
	}

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}
		if err := os.WriteFile(outputPath, []byte(content), 0644); err != nil {
			return fmt.Errorf("写入文件失败: %w", err)
		}
		fmt.Printf("报告已导出到: %s\n", outputPath)
	} else {
		fmt.Println(content)
	}

	return nil
}

func generateJSONReport(result *model.AnalysisResult, full bool) (string, error) {
	type Report struct {
		Session    model.AnalysisSession `json:"session"`
		Summary    ReportSummary         `json:"summary"`
		Risks      []model.RiskIssue     `json:"risks"`
		Budgets    []model.BudgetSegment `json:"budgets,omitempty"`
		Calls      []model.CallRecord    `json:"calls,omitempty"`
		GeneratedAt time.Time            `json:"generated_at"`
	}

	type ReportSummary struct {
		TotalCalls    int            `json:"total_calls"`
		TotalRisks    int            `json:"total_risks"`
		RiskByLevel   map[string]int `json:"risk_by_level"`
		RiskByCategory map[string]int `json:"risk_by_category"`
		HealthScore   int            `json:"health_score"`
		HealthGrade   string         `json:"health_grade"`
	}

	score, grade := calculateScore(result.Risks)

	summary := ReportSummary{
		TotalCalls:     result.Session.TotalCalls,
		TotalRisks:     result.Session.RiskCount,
		RiskByLevel:    make(map[string]int),
		RiskByCategory: make(map[string]int),
		HealthScore:    score,
		HealthGrade:    grade,
	}

	for _, r := range result.Risks {
		summary.RiskByLevel[string(r.Level)]++
		summary.RiskByCategory[r.Category]++
	}

	report := Report{
		Session:     result.Session,
		Summary:     summary,
		Risks:       result.Risks,
		Budgets:     result.BudgetWaterfall,
		GeneratedAt: time.Now(),
	}

	if full {
		report.Calls = result.Calls
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func generateMarkdownReport(result *model.AnalysisResult, full bool) (string, error) {
	var sb strings.Builder

	score, grade := calculateScore(result.Risks)

	sb.WriteString("# Context 调用链体检报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s  \n", time.Now().Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("**会话ID**: %s  \n", result.Session.SessionID))
	sb.WriteString(fmt.Sprintf("**分析时间**: %s  \n\n", result.Session.CreatedAt.Format("2006-01-02 15:04:05")))

	sb.WriteString("## 健康评分\n\n")
	sb.WriteString(fmt.Sprintf("| 评分 | 等级 | 调用数 | 风险数 |\n"))
	sb.WriteString(fmt.Sprintf("|------|------|--------|--------|\n"))
	sb.WriteString(fmt.Sprintf("| %d/100 | %s | %d | %d |\n\n", score, grade, result.Session.TotalCalls, result.Session.RiskCount))

	sb.WriteString("## 风险统计\n\n")

	criticalCount := countByLevel(result.Risks, model.RiskCritical)
	highCount := countByLevel(result.Risks, model.RiskHigh)
	mediumCount := countByLevel(result.Risks, model.RiskMedium)
	lowCount := countByLevel(result.Risks, model.RiskLow)

	sb.WriteString("### 按严重程度\n\n")
	sb.WriteString(fmt.Sprintf("| 等级 | 数量 |\n"))
	sb.WriteString(fmt.Sprintf("|------|------|\n"))
	sb.WriteString(fmt.Sprintf("| Critical (严重) | %d |\n", criticalCount))
	sb.WriteString(fmt.Sprintf("| High (高) | %d |\n", highCount))
	sb.WriteString(fmt.Sprintf("| Medium (中) | %d |\n", mediumCount))
	sb.WriteString(fmt.Sprintf("| Low (低) | %d |\n\n", lowCount))

	catCounts := make(map[string]int)
	for _, r := range result.Risks {
		catCounts[r.Category]++
	}

	if len(catCounts) > 0 {
		sb.WriteString("### 按类别\n\n")
		sb.WriteString(fmt.Sprintf("| 类别 | 数量 |\n"))
		sb.WriteString(fmt.Sprintf("|------|------|\n"))
		for cat, count := range catCounts {
			sb.WriteString(fmt.Sprintf("| %s | %d |\n", cat, count))
		}
		sb.WriteString("\n")
	}

	if len(result.Risks) > 0 {
		sb.WriteString("## 风险详情\n\n")

		levelEmoji := map[model.RiskLevel]string{
			model.RiskCritical: "🔴",
			model.RiskHigh:     "🟠",
			model.RiskMedium:   "🟡",
			model.RiskLow:      "🟢",
			model.RiskInfo:     "🔵",
		}

		for i, r := range result.Risks {
			emoji := levelEmoji[r.Level]
			sb.WriteString(fmt.Sprintf("### %d. %s [%s] %s\n\n", i+1, emoji, strings.ToUpper(string(r.Level)), r.Title))
			sb.WriteString(fmt.Sprintf("**调用**: %s → %s  \n", r.Caller, r.Callee))
			if r.SourceFile != "" {
				sb.WriteString(fmt.Sprintf("**位置**: %s:%d  \n", r.SourceFile, r.LineNumber))
			}
			sb.WriteString(fmt.Sprintf("**类别**: %s  \n\n", r.Category))
			sb.WriteString(fmt.Sprintf("**描述**: %s  \n\n", r.Description))
			sb.WriteString(fmt.Sprintf("**建议**: %s  \n\n", r.Suggestion))
		}
	}

	if len(result.BudgetWaterfall) > 0 {
		sb.WriteString("## 预算瀑布图\n\n")

		var totalBudget time.Duration
		for _, b := range result.Budgets {
			totalBudget = b.TotalBudget
			break
		}

		sb.WriteString(fmt.Sprintf("**总预算**: %v\n\n", totalBudget))

		used := time.Duration(0)
		for i, seg := range result.BudgetWaterfall {
			used += seg.Allocated
			sb.WriteString(fmt.Sprintf("%d. **%s → %s**\n", i+1, seg.Caller, seg.Callee))
			sb.WriteString(fmt.Sprintf("   - 分配: %v (%.1f%%)\n", seg.Allocated, seg.Percentage))
			sb.WriteString(fmt.Sprintf("   - 累计使用: %v\n", used))
			sb.WriteString(fmt.Sprintf("   - 剩余: %v\n\n", totalBudget-used))
		}

		if used > totalBudget {
			sb.WriteString(fmt.Sprintf("⚠️  **警告**: 总使用时间 %v 超过预算 %v，超支 %v\n\n", used, totalBudget, used-totalBudget))
		}
	}

	if full && len(result.Calls) > 0 {
		sb.WriteString("## 调用记录\n\n")
		sb.WriteString(fmt.Sprintf("| # | 调用方 | 被调用方 | 超时 | Deadline | Cancel | Background | TODO | Goroutine |\n"))
		sb.WriteString(fmt.Sprintf("|---|--------|----------|------|----------|--------|------------|------|-----------|\n"))
		for i, c := range result.Calls {
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %v | %v | %v | %v | %v | %v |\n",
				i+1, c.Caller, c.Callee, c.TimeoutBudget, c.HasDeadline, c.HasCancel, c.UsesBackground, c.UsesTODO, c.IsGoroutine))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")
	sb.WriteString("*此报告由 context-health CLI 生成*\n")

	return sb.String(), nil
}

func calculateScore(risks []model.RiskIssue) (int, string) {
	criticalCount := 0
	highCount := 0
	for _, r := range risks {
		if r.Level == model.RiskCritical {
			criticalCount++
		} else if r.Level == model.RiskHigh {
			highCount++
		}
	}

	score := 100
	score -= criticalCount * 20
	score -= highCount * 10

	if score < 0 {
		score = 0
	}

	grade := "F"
	if score >= 90 {
		grade = "A"
	} else if score >= 80 {
		grade = "B"
	} else if score >= 70 {
		grade = "C"
	} else if score >= 60 {
		grade = "D"
	}

	return score, grade
}
