package cmd

import (
	"fmt"
	"mapdebug/pkg/storage"
	"mapdebug/pkg/types"
	"sort"

	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze [session-id]",
	Short: "分析复盘会话并生成报告",
	Long: `analyze 命令从 SQLite 数据库读取会话数据，进行深入分析，
输出桶分布、溢出链、扩容触发点、查找成本和风险解释。

示例:
  mapdebug analyze <session-id>
  mapdebug analyze <session-id> --detailed
  mapdebug analyze <session-id> --risks-only`,
	Args: cobra.ExactArgs(1),
	RunE: runAnalyze,
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
	analyzeCmd.Flags().BoolP("detailed", "d", false, "显示详细步骤分析")
	analyzeCmd.Flags().Bool("risks-only", false, "只显示风险信息")
	analyzeCmd.Flags().Bool("list", false, "列出所有会话")
	analyzeCmd.Flags().Int("top-n", 10, "显示前 N 个高成本操作")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	detailed, _ := cmd.Flags().GetBool("detailed")
	risksOnly, _ := cmd.Flags().GetBool("risks-only")
	listSessions, _ := cmd.Flags().GetBool("list")
	topN, _ := cmd.Flags().GetInt("top-n")

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer store.Close()

	if listSessions {
		return listAllSessions(store)
	}

	sessionID := args[0]

	session, err := store.GetSession(sessionID)
	if err != nil {
		return fmt.Errorf("获取会话失败: %w", err)
	}

	stats, err := store.GetAggregatedStats(sessionID)
	if err != nil {
		return fmt.Errorf("获取统计数据失败: %w", err)
	}

	risks, err := store.GetRisks(sessionID)
	if err != nil {
		return fmt.Errorf("获取风险数据失败: %w", err)
	}

	expandEvents, err := store.GetExpandEvents(sessionID)
	if err != nil {
		return fmt.Errorf("获取扩容事件失败: %w", err)
	}

	fmt.Printf("\n========== 会话分析报告 ==========\n\n")
	fmt.Printf("会话 ID: %s\n", session.ID)
	fmt.Printf("会话名称: %s\n", session.Name)
	fmt.Printf("种子: %d\n", session.Seed)
	fmt.Printf("总步数: %d\n", stats.TotalSteps)
	fmt.Printf("创建时间: %s\n", session.CreatedAt.Format("2006-01-02 15:04:05"))

	if !risksOnly {
		fmt.Printf("\n---------- 性能统计 ----------\n")
		fmt.Printf("平均查找成本: %.2f\n", stats.AvgCost)
		fmt.Printf("最高查找成本: %.2f\n", stats.MaxCost)
		fmt.Printf("平均溢出遍历: %.2f\n", stats.AvgOverflow)
		fmt.Printf("最大溢出链长度: %d\n", stats.MaxOverflow)
		fmt.Printf("扩容事件数: %d\n", stats.ExpandCount)

		if len(expandEvents) > 0 {
			fmt.Printf("\n---------- 扩容事件 ----------\n")
			for _, event := range expandEvents {
				fmt.Printf("  步骤 %d: %s (B=%d → B=%d)\n",
					event.StepIndex, event.Phase, event.OldB, event.NewB)
			}
		}
	}

	if len(risks) > 0 {
		fmt.Printf("\n---------- 风险分析 ----------\n")
		riskByCategory := make(map[types.RiskCategory][]types.RiskAlert)
		for _, risk := range risks {
			riskByCategory[risk.Category] = append(riskByCategory[risk.Category], risk)
		}

		for cat, riskList := range riskByCategory {
			level := types.RiskInfo
			for _, r := range riskList {
				if r.Level == types.RiskError {
					level = types.RiskError
					break
				} else if r.Level == types.RiskWarning && level != types.RiskError {
					level = types.RiskWarning
				}
			}
			
			fmt.Printf("\n[%s] %s (%d 次)\n", level, cat, len(riskList))
			
			suggestions := make(map[string]bool)
			for _, risk := range riskList {
				if risk.AffectedKey != "" {
					fmt.Printf("  影响: %s\n", risk.AffectedKey)
				}
				suggestions[risk.Suggestion] = true
			}
			
			for s := range suggestions {
				fmt.Printf("  💡 建议: %s\n", s)
			}
		}
	} else {
		fmt.Printf("\n✅ 未检测到风险\n")
	}

	if detailed && !risksOnly {
		steps, err := store.GetSteps(sessionID)
		if err != nil {
			return fmt.Errorf("获取步骤数据失败: %w", err)
		}

		fmt.Printf("\n---------- 高成本操作 TOP %d ----------\n", topN)
		sort.Slice(steps, func(i, j int) bool {
			return steps[i].LookupCost.CostScore > steps[j].LookupCost.CostScore
		})

		for i := 0; i < topN && i < len(steps); i++ {
			step := steps[i]
			fmt.Printf("\n  #%d (步骤 %d)\n", i+1, step.StepIndex)
			fmt.Printf("    操作: %s %s\n", step.Op.Type, step.Op.Key)
			fmt.Printf("    成本: %.2f\n", step.LookupCost.CostScore)
			fmt.Printf("    溢出遍历: %d\n", step.LookupCost.OverflowWalk)
			if len(step.RiskAlerts) > 0 {
				for _, risk := range step.RiskAlerts {
					fmt.Printf("    风险: [%s] %s\n", risk.Level, risk.Message)
				}
			}
		}

		fmt.Printf("\n---------- 桶分布趋势 ----------\n")
		if len(steps) > 0 {
			first := steps[0]
			last := steps[len(steps)-1]
			
			fmt.Printf("初始状态:\n")
			fmt.Printf("  桶数: %d, 元素数: %d, 装载因子: %.2f\n",
				first.MapState.BucketCount, first.MapState.Count, first.MapState.LoadFactor)
			fmt.Printf("  溢出桶: %d, 最大链长: %d\n",
				first.MapState.OverflowCount, first.MapState.MaxChainLength)
			
			fmt.Printf("\n最终状态:\n")
			fmt.Printf("  桶数: %d, 元素数: %d, 装载因子: %.2f\n",
				last.MapState.BucketCount, last.MapState.Count, last.MapState.LoadFactor)
			fmt.Printf("  溢出桶: %d, 最大链长: %d\n",
				last.MapState.OverflowCount, last.MapState.MaxChainLength)
			
			if last.MapState.BucketCount > first.MapState.BucketCount {
				fmt.Printf("\n📈 发生扩容: 桶数从 %d 增加到 %d\n",
					first.MapState.BucketCount, last.MapState.BucketCount)
			}
		}
	}

	fmt.Printf("\n==================================\n")
	fmt.Println("运行 'mapdebug export' 导出完整报告")

	return nil
}

func listAllSessions(store *storage.SQLiteStore) error {
	sessions, err := store.ListSessions()
	if err != nil {
		return fmt.Errorf("获取会话列表失败: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("没有找到会话")
		return nil
	}

	fmt.Printf("\n========== 会话列表 ==========\n\n")
	fmt.Printf("%-36s  %-20s  %-10s  %s\n", "ID", "名称", "步数", "创建时间")
	fmt.Println("----------------------------------------------------------------------------------")
	
	for _, s := range sessions {
		fmt.Printf("%-36s  %-20s  %-10d  %s\n",
			s.ID,
			truncateString(s.Name, 20),
			s.StepCount,
			s.CreatedAt.Format("2006-01-02 15:04"),
		)
	}

	fmt.Printf("\n使用 'mapdebug analyze <session-id>' 查看详细分析\n")
	return nil
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
