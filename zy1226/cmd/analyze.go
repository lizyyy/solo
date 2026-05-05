package cmd

import (
	"context-health/pkg/analyzer"
	"context-health/pkg/model"
	"context-health/pkg/parser"
	"context-health/pkg/store"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析 context 调用链健康状况",
	Long: `analyze 命令会读取 context-plan.yaml、calls.jsonl 和 snippets/*.go 文件，
进行全面的 context 健康检查，包括 deadline 继承、取消传播、超时预算分配、
WithValue 滥用、Background/TODO 误用、goroutine 边界资源释放等问题。`,
	RunE: runAnalyze,
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
	analyzeCmd.Flags().StringP("calls", "", "calls.jsonl", "calls.jsonl 文件路径")
	analyzeCmd.Flags().StringP("snippets", "", "snippets", "Go 代码片段目录")
	analyzeCmd.Flags().StringP("db", "", ".context-health.db", "SQLite 数据库路径")
	analyzeCmd.Flags().BoolP("save", "s", true, "保存结果到数据库")
	analyzeCmd.Flags().BoolP("waterfall", "w", true, "显示预算瀑布图")
	analyzeCmd.Flags().BoolP("risks", "r", true, "显示风险清单")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	configPath, _ := cmd.Flags().GetString("config")
	callsPath, _ := cmd.Flags().GetString("calls")
	snippetsDir, _ := cmd.Flags().GetString("snippets")
	dbPath, _ := cmd.Flags().GetString("db")
	saveToDB, _ := cmd.Flags().GetBool("save")
	showWaterfall, _ := cmd.Flags().GetBool("waterfall")
	showRisks, _ := cmd.Flags().GetBool("risks")

	fmt.Println("=== Context 调用链体检 ===")
	fmt.Printf("配置文件: %s\n", configPath)
	fmt.Printf("调用数据: %s\n", callsPath)
	fmt.Printf("代码目录: %s\n", snippetsDir)
	fmt.Println()

	plan, err := parser.ParseContextPlan(configPath)
	if err != nil {
		return fmt.Errorf("解析配置失败: %w", err)
	}

	fmt.Printf("API: %s - %s\n", plan.APIName, plan.Description)
	fmt.Printf("入口点: %s\n", plan.EntryPoint)
	fmt.Printf("总超时预算: %v\n", plan.TotalTimeout)
	fmt.Println()

	var allCalls []model.CallRecord

	if fileExists(callsPath) {
		calls, err := parser.ParseCallsJSONL(callsPath)
		if err != nil {
			return fmt.Errorf("解析 calls.jsonl 失败: %w", err)
		}
		allCalls = append(allCalls, calls...)
		fmt.Printf("✓ 从 calls.jsonl 加载 %d 条调用记录\n", len(calls))
	}

	if dirExists(snippetsDir) {
		goAnalyses, err := parser.ParseGoSnippets(snippetsDir)
		if err != nil {
			return fmt.Errorf("解析 Go 代码失败: %w", err)
		}
		for _, ga := range goAnalyses {
			for i := range ga.Calls {
				ga.Calls[i].SourceFile = ga.SourceFile
			}
			allCalls = append(allCalls, ga.Calls...)
		}
		fmt.Printf("✓ 从 snippets 加载 %d 条调用记录\n", len(allCalls)-len(allCalls)+len(goAnalyses))
	}

	if len(allCalls) == 0 {
		return fmt.Errorf("没有找到任何调用记录，请检查 calls.jsonl 或 snippets 目录")
	}

	fmt.Printf("\n开始分析 %d 条调用记录...\n\n", len(allCalls))

	risks := analyzer.RunAllRules(allCalls, plan)
	waterfall := analyzer.BuildBudgetWaterfall(allCalls, plan)

	sessionID := generateSessionID()

	result := &model.AnalysisResult{
		Session: model.AnalysisSession{
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
			TotalCalls: len(allCalls),
			RiskCount:  len(risks),
		},
		Calls:           allCalls,
		Risks:           risks,
		BudgetWaterfall: waterfall,
	}

	if saveToDB {
		if err := saveToDatabase(result, dbPath); err != nil {
			fmt.Printf("警告: 保存到数据库失败: %v\n", err)
		} else {
			fmt.Printf("✓ 结果已保存，会话 ID: %s\n", sessionID)
		}
	}

	if showRisks && len(risks) > 0 {
		printRiskSummary(risks)
	} else if len(risks) == 0 {
		fmt.Println("\n✓ 太棒了！没有发现任何风险问题")
	}

	if showWaterfall && len(waterfall) > 0 {
		printBudgetWaterfall(waterfall, plan.TotalTimeout)
	}

	printScoreCard(risks, len(allCalls))

	fmt.Printf("\n会话 ID: %s\n", sessionID)

	return nil
}

func saveToDatabase(result *model.AnalysisResult, dbPath string) error {
	store, err := store.NewSQLiteStore(dbPath)
	if err != nil {
		return err
	}
	defer store.Close()

	return store.SaveAnalysisResult(result)
}

func printRiskSummary(risks []model.RiskIssue) {
	fmt.Println("\n=== 风险清单 ===")

	countByLevel := make(map[model.RiskLevel]int)
	countByCategory := make(map[string]int)

	for _, r := range risks {
		countByLevel[r.Level]++
		countByCategory[r.Category]++
	}

	fmt.Printf("\n按严重程度统计:\n")
	fmt.Printf("  Critical (严重): %d\n", countByLevel[model.RiskCritical])
	fmt.Printf("  High (高):       %d\n", countByLevel[model.RiskHigh])
	fmt.Printf("  Medium (中):     %d\n", countByLevel[model.RiskMedium])
	fmt.Printf("  Low (低):        %d\n", countByLevel[model.RiskLow])

	fmt.Printf("\n按类别统计:\n")
	for cat, count := range countByCategory {
		fmt.Printf("  %s: %d\n", cat, count)
	}

	fmt.Println("\n详细问题列表:")
	for i, r := range risks {
		levelIcon := ""
		switch r.Level {
		case model.RiskCritical:
			levelIcon = "🔴"
		case model.RiskHigh:
			levelIcon = "🟠"
		case model.RiskMedium:
			levelIcon = "🟡"
		case model.RiskLow:
			levelIcon = "🟢"
		}

		fmt.Printf("\n%d. %s [%s] %s\n", i+1, levelIcon, strings.ToUpper(string(r.Level)), r.Title)
		fmt.Printf("   调用: %s -> %s\n", r.Caller, r.Callee)
		if r.SourceFile != "" {
			fmt.Printf("   位置: %s:%d\n", r.SourceFile, r.LineNumber)
		}
		fmt.Printf("   描述: %s\n", r.Description)
		fmt.Printf("   建议: %s\n", r.Suggestion)
	}
}

func printBudgetWaterfall(segments []model.BudgetSegment, totalBudget time.Duration) {
	fmt.Println("\n=== 预算瀑布图 ===")
	fmt.Printf("\n总预算: %v\n\n", totalBudget)

	used := time.Duration(0)
	for i, seg := range segments {
		barLength := int(seg.Percentage / 2)
		bar := ""
		for j := 0; j < barLength; j++ {
			bar += "█"
		}

		used += seg.Allocated
		remaining := totalBudget - used

		levelColor := ""
		switch seg.Level {
		case "critical":
			levelColor = "🔴"
		case "warning":
			levelColor = "🟡"
		default:
			levelColor = "🟢"
		}

		fmt.Printf("%d. %s -> %s\n", i+1, seg.Caller, seg.Callee)
		fmt.Printf("   %s %s (%.1f%%) | 累计: %v | 剩余: %v\n",
			levelColor, bar, seg.Percentage, used, remaining)
	}

	if used > totalBudget {
		fmt.Printf("\n⚠  警告: 总使用时间 %v 超过预算 %v，超支 %v\n",
			used, totalBudget, used-totalBudget)
	}
}

func printScoreCard(risks []model.RiskIssue, totalCalls int) {
	fmt.Println("\n=== 评分卡 ===")

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

	status := "需要改进"
	if grade == "A" {
		status = "优秀"
	} else if grade == "B" {
		status = "良好"
	}

	fmt.Printf("\n健康评分: %d/100 (%s) - %s\n", score, grade, status)
	fmt.Printf("调用记录数: %d\n", totalCalls)
	fmt.Printf("风险问题数: %d\n", len(risks))

	if criticalCount > 0 {
		fmt.Printf("\n⚠  存在 %d 个严重问题，建议优先修复\n", criticalCount)
	}
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func generateSessionID() string {
	return "sess_" + strings.ReplaceAll(uuid.New().String(), "-", "")[:16]
}
