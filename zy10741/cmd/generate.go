package cmd

import (
	"fmt"
	"os"
	"sync-failure-replay/internal/parser"
	"sync-failure-replay/internal/report"
	"sync-failure-replay/internal/replay"

	"github.com/spf13/cobra"
)

var (
	inputFiles []string
	stateDir   string
	outputDir  string
	force      bool
)

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "生成同步失败日志批次重放计划",
	Long: `解析同步失败日志文件，生成可重放的批次计划，支持幂等运行。
重复运行同一批输入时结果稳定，不重复追加。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(inputFiles) == 0 {
			return fmt.Errorf("请指定输入文件")
		}

		for _, f := range inputFiles {
			if _, err := os.Stat(f); os.IsNotExist(err) {
				return fmt.Errorf("文件不存在: %s", f)
			}
		}

		sm := replay.NewStateManager(stateDir)
		inputHash := sm.ComputeInputHash(inputFiles)

		var plan *replay.BatchPlan
		var isReplay bool

		existingPlan, err := sm.GetExistingPlan(inputHash)
		if err != nil {
			return fmt.Errorf("检查状态失败: %w", err)
		}

		if existingPlan != nil && !force {
			fmt.Printf("检测到已有计划 (批次: %s)，使用已存在的批次\n", existingPlan.BatchID)
			plan = existingPlan
			isReplay = true
		} else {
			fmt.Println("生成新的批次重放计划...")
			lp := parser.NewLogParser()
			entries, err := lp.ParseFiles(inputFiles)
			if err != nil {
				return fmt.Errorf("解析日志失败: %w", err)
			}

			plan = replay.NewBatchPlan(inputHash, entries)

			for i := range entries {
				plan.ClassifyEntry(entries[i])
				plan.AddToReplayOrder(entries[i].ID)
			}

			plan.Status = "generated"
		}

		rg := report.NewReportGenerator(outputDir)
		reportPath, err := rg.GenerateReport(plan)
		if err != nil {
			return fmt.Errorf("生成报告失败: %w", err)
		}

		if err := sm.SavePlan(plan); err != nil {
			return fmt.Errorf("保存状态失败: %w", err)
		}

		rg.PrintConsoleSummary(plan)

		if isReplay {
			fmt.Printf("✓ 重复运行 - 使用已有批次计划\n")
		} else {
			fmt.Printf("✓ 新批次计划已生成\n")
		}
		fmt.Printf("  报告文件: %s\n", reportPath)
		fmt.Printf("  状态文件: %s/%s.json\n", stateDir, inputHash)

		if len(plan.PartialSuccess) > 0 || len(plan.PrimaryKeyConflict) > 0 || len(plan.OrderDependency) > 0 {
			os.Exit(2)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(generateCmd)

	generateCmd.Flags().StringSliceVarP(&inputFiles, "input", "i", []string{}, "输入日志文件（可多个）")
	generateCmd.Flags().StringVarP(&stateDir, "state", "s", "./state", "状态目录（用于幂等检查）")
	generateCmd.Flags().StringVarP(&outputDir, "output", "o", "./reports", "报告输出目录")
	generateCmd.Flags().BoolVarP(&force, "force", "f", false, "强制重新生成计划（忽略已有状态）")
}
