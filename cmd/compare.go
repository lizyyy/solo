package cmd

import (
	"context-health/pkg/model"
	"context-health/pkg/store"
	"fmt"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "对比两次分析结果",
	Long: `compare 命令用于对比两次不同的分析会话结果，
显示风险变化、预算变化等差异，帮助团队追踪 context 健康状况的改进情况。`,
	RunE: runCompare,
}

func init() {
	rootCmd.AddCommand(compareCmd)
	compareCmd.Flags().StringP("db", "", ".context-health.db", "SQLite 数据库路径")
	compareCmd.Flags().StringP("old", "", "", "旧会话 ID")
	compareCmd.Flags().StringP("new", "", "", "新会话 ID")
	compareCmd.Flags().BoolP("list", "l", false, "列出所有会话")
}

func runCompare(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	oldSessionID, _ := cmd.Flags().GetString("old")
	newSessionID, _ := cmd.Flags().GetString("new")
	listMode, _ := cmd.Flags().GetBool("list")

	st, err := store.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer st.Close()

	if listMode {
		sessions, err := st.ListSessions(20)
		if err != nil {
			return fmt.Errorf("列出会话失败: %w", err)
		}

		fmt.Println("=== 历史分析会话 ===")
		fmt.Println()
		for i, s := range sessions {
			fmt.Printf("%d. 会话ID: %s\n", i+1, s.SessionID)
			fmt.Printf("   时间: %s\n", s.CreatedAt.Format("2006-01-02 15:04:05"))
			fmt.Printf("   调用数: %d, 风险数: %d\n", s.TotalCalls, s.RiskCount)
			fmt.Println()
		}

		if len(sessions) == 0 {
			fmt.Println("没有找到历史会话，请先运行 'context-health analyze'")
		}

		return nil
	}

	if oldSessionID == "" || newSessionID == "" {
		return fmt.Errorf("请使用 --old 和 --new 指定要对比的两个会话 ID，或使用 -l 列出历史会话")
	}

	fmt.Println("=== 对比分析 ===")
	fmt.Printf("旧会话: %s\n", oldSessionID)
	fmt.Printf("新会话: %s\n", newSessionID)
	fmt.Println()

	oldResult, err := st.GetAnalysisResult(oldSessionID)
	if err != nil {
		return fmt.Errorf("获取旧会话失败: %w", err)
	}

	newResult, err := st.GetAnalysisResult(newSessionID)
	if err != nil {
		return fmt.Errorf("获取新会话失败: %w", err)
	}

	printComparisonSummary(oldResult, newResult)
	printRiskComparison(oldResult.Risks, newResult.Risks)

	return nil
}

func printComparisonSummary(oldResult, newResult *model.AnalysisResult) {
	fmt.Println("=== 摘要对比 ===")
	fmt.Println()

	fmt.Printf("调用记录数: %d -> %d", oldResult.Session.TotalCalls, newResult.Session.TotalCalls)
	if newResult.Session.TotalCalls > oldResult.Session.TotalCalls {
		fmt.Printf(" (+%d)", newResult.Session.TotalCalls-oldResult.Session.TotalCalls)
	} else if newResult.Session.TotalCalls < oldResult.Session.TotalCalls {
		fmt.Printf(" (-%d)", oldResult.Session.TotalCalls-newResult.Session.TotalCalls)
	}
	fmt.Println()

	fmt.Printf("风险问题数: %d -> %d", oldResult.Session.RiskCount, newResult.Session.RiskCount)
	if newResult.Session.RiskCount > oldResult.Session.RiskCount {
		fmt.Printf(" (+%d) ⚠  增加了", newResult.Session.RiskCount-oldResult.Session.RiskCount)
	} else if newResult.Session.RiskCount < oldResult.Session.RiskCount {
		fmt.Printf(" (-%d) ✓ 减少了", oldResult.Session.RiskCount-newResult.Session.RiskCount)
	}
	fmt.Println()

	oldCritical := countByLevel(oldResult.Risks, model.RiskCritical)
	newCritical := countByLevel(newResult.Risks, model.RiskCritical)
	fmt.Printf("严重问题(Critical): %d -> %d", oldCritical, newCritical)
	if newCritical > oldCritical {
		fmt.Printf(" (+%d) 🔴 增加了", newCritical-oldCritical)
	} else if newCritical < oldCritical {
		fmt.Printf(" (-%d) 🟢 减少了", oldCritical-newCritical)
	}
	fmt.Println()

	oldHigh := countByLevel(oldResult.Risks, model.RiskHigh)
	newHigh := countByLevel(newResult.Risks, model.RiskHigh)
	fmt.Printf("高风险(High): %d -> %d", oldHigh, newHigh)
	if newHigh > oldHigh {
		fmt.Printf(" (+%d) 🟠 增加了", newHigh-oldHigh)
	} else if newHigh < oldHigh {
		fmt.Printf(" (-%d) 🟢 减少了", oldHigh-newHigh)
	}
	fmt.Println()
}

func countByLevel(risks []model.RiskIssue, level model.RiskLevel) int {
	count := 0
	for _, r := range risks {
		if r.Level == level {
			count++
		}
	}
	return count
}

func printRiskComparison(oldRisks, newRisks []model.RiskIssue) {
	fmt.Println("\n=== 风险对比详情 ===")
	fmt.Println()

	oldRiskMap := make(map[string]model.RiskIssue)
	for _, r := range oldRisks {
		key := fmt.Sprintf("%s:%s:%s", r.Caller, r.Callee, r.Title)
		oldRiskMap[key] = r
	}

	newRiskMap := make(map[string]model.RiskIssue)
	for _, r := range newRisks {
		key := fmt.Sprintf("%s:%s:%s", r.Caller, r.Callee, r.Title)
		newRiskMap[key] = r
	}

	resolved := []model.RiskIssue{}
	newIssues := []model.RiskIssue{}
	persisted := []model.RiskIssue{}

	for key, r := range oldRiskMap {
		if _, exists := newRiskMap[key]; !exists {
			resolved = append(resolved, r)
		} else {
			persisted = append(persisted, r)
		}
	}

	for key, r := range newRiskMap {
		if _, exists := oldRiskMap[key]; !exists {
			newIssues = append(newIssues, r)
		}
	}

	if len(resolved) > 0 {
		fmt.Printf("✅ 已修复的问题 (%d):\n", len(resolved))
		for i, r := range resolved {
			fmt.Printf("  %d. [%s] %s: %s -> %s\n", i+1, r.Level, r.Title, r.Caller, r.Callee)
		}
		fmt.Println()
	}

	if len(newIssues) > 0 {
		fmt.Printf("⚠️  新增的问题 (%d):\n", len(newIssues))
		for i, r := range newIssues {
			fmt.Printf("  %d. [%s] %s: %s -> %s\n", i+1, r.Level, r.Title, r.Caller, r.Callee)
		}
		fmt.Println()
	}

	if len(persisted) > 0 {
		fmt.Printf("⏳ 仍存在的问题 (%d):\n", len(persisted))
		for i, r := range persisted {
			fmt.Printf("  %d. [%s] %s: %s -> %s\n", i+1, r.Level, r.Title, r.Caller, r.Callee)
		}
	}
}
